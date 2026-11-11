/**
 * Obstacle-Aware 3D Drone Route Planner
 * AEROVATA by TASPORA - UTM Autonomous Airspace Command
 * 
 * Implements realistic 3D building-aware waypoint generation.
 * - Navigates around 3D building extrusions using realistic lateral detours.
 * - Strictly enforces DGCA 120m AGL altitude ceilings.
 * - Prioritizes horizontal detours around buildings over unnecessary altitude climbing.
 * - Employs altitude changes only when safe, appropriate, and within permitted limits.
 * - Guarantees continuous segment-level collision freedom without corner clipping.
 * - Rejects impossible routes with honest, actionable failure reporting.
 */

import { 
  Waypoint, 
  RouteCandidate, 
  RouteValidationResult, 
  RouteValidationStatus,
  OfficialAirspaceZone,
  Obstacle
} from '../../types/fleet';
import { 
  PathPlanningRequest, 
  PathPlanningResponse, 
  IPathPlanner, 
  IWorldModel3D, 
  ISegmentCollisionChecker,
  BuildingObstacle3D
} from './types';
import { WorldModel3D, isPointInsidePolygon } from './worldModel';
import { 
  ExactSegmentCollisionChecker3D, 
  geoToLocalMetric, 
  localMetricToGeo,
  segmentToPolygonDistanceMetric
} from './collisionChecker';
import { CollisionSafeRouteSimplifier } from './routeSimplifier';
import { 
  DEFAULT_ALTITUDE_CONFIG, 
  aglToAmsl, 
  DEFAULT_REGIONAL_GROUND_ELEVATION_METERS 
} from './altitudeUtils';
import { 
  COIMBATORE_LOCATIONS,
  SIMULATION_BOUNDS, 
  isCoordinateWithinBounds 
} from './locations';
import { 
  calculateBearing, 
  getDistanceMeters, 
  OFFICIAL_REGULATORY_CONFIG 
} from '../droneAStarRouter';

interface NavNode {
  id: string;
  lng: number;
  lat: number;
  altMeters: number;
  x: number;
  y: number;
  gCost: number;
  hCost: number;
  fCost: number;
  parent?: NavNode;
  isDetourNode?: boolean;
}

export class ObstacleAwarePlanner3D implements IPathPlanner {
  private worldModel: IWorldModel3D;
  private collisionChecker: ISegmentCollisionChecker;
  private simplifier: CollisionSafeRouteSimplifier;

  constructor(
    worldModel?: IWorldModel3D,
    collisionChecker?: ISegmentCollisionChecker
  ) {
    this.worldModel = worldModel ?? new WorldModel3D();
    this.collisionChecker = collisionChecker ?? new ExactSegmentCollisionChecker3D(this.worldModel);
    this.simplifier = new CollisionSafeRouteSimplifier();
  }

  public planRoute(request: PathPlanningRequest): PathPlanningResponse {
    const start = request.start;
    const dest = request.destination;
    const cruiseAlt = request.cruiseAltitudeMeters ?? DEFAULT_ALTITUDE_CONFIG.defaultCruiseAltitudeMeters;
    const minAlt = request.minAltitudeMeters ?? DEFAULT_ALTITUDE_CONFIG.minFlightAltitudeMeters;
    const maxCeiling = request.maxAltitudeMeters ?? DEFAULT_ALTITUDE_CONFIG.maxPermittedCeilingMeters;
    const droneRadius = request.droneRadiusMeters ?? DEFAULT_ALTITUDE_CONFIG.droneRadiusMeters;
    const safetyMargin = request.safetyMarginMeters ?? DEFAULT_ALTITUDE_CONFIG.defaultHorizontalBufferMeters;
    const checkpointSpacing = request.checkpointSpacingMeters ?? 100.0;
    const startName = request.startName || 'Departure Pad';
    const destName = request.destName || 'Arrival Pad';
    const allowYellowZones = request.allowYellowZones ?? false;
    const preferHorizontal = request.preferHorizontalDetour ?? true;

    // Use custom obstacles or airspace zones if provided in request
    let activeWorld = this.worldModel;
    let activeChecker = this.collisionChecker;
    if (request.customObstacles || request.customAirspaceZones) {
      activeWorld = new WorldModel3D(
        request.customObstacles ?? this.worldModel.getBuildingObstacles().map(b => b.metadata?.rawObstacle!).filter(Boolean),
        request.customAirspaceZones ?? this.worldModel.getAirspaceZones()
      );
      activeChecker = new ExactSegmentCollisionChecker3D(activeWorld);
    }

    // ─── 1. VALIDATE START & DESTINATION COORDINATES ───────────────────────

    // Check bounds
    if (!isCoordinateWithinBounds(start[0], start[1])) {
      return this.createFailureResponse(`Starting coordinates [${start[0]}, ${start[1]}] are outside the authorized simulation bounds.`);
    }
    if (!isCoordinateWithinBounds(dest[0], dest[1])) {
      return this.createFailureResponse(`Destination coordinates [${dest[0]}, ${dest[1]}] are outside the authorized simulation bounds.`);
    }

    // Identical start & destination check
    const dLng = Math.abs(start[0] - dest[0]);
    const dLat = Math.abs(start[1] - dest[1]);
    if (dLng < 0.0001 && dLat < 0.0001) {
      return this.createFailureResponse('Destination cannot be the same as the starting point. Please select a different location.');
    }

    // Check if start or dest is an authorized designated hub pad (e.g. CMCH rooftop pad)
    const isStartDesignatedPad = (COIMBATORE_LOCATIONS || []).some(
      (loc) => Math.hypot(loc.coordinates[0] - start[0], loc.coordinates[1] - start[1]) < 0.001
    );
    const isDestDesignatedPad = (COIMBATORE_LOCATIONS || []).some(
      (loc) => Math.hypot(loc.coordinates[0] - dest[0], loc.coordinates[1] - dest[1]) < 0.001
    );

    // Check if destination is inside a building footprint
    if (!isDestDesignatedPad) {
      const destBuilding = activeWorld.findObstacleAtPoint(dest[0], dest[1]);
      if (destBuilding) {
        return this.createFailureResponse(
          `Destination is inside building footprint: ${destBuilding.name}. Landing sites must be clear of physical structures.`
        );
      }
    }

    // Check if start is inside a building footprint
    if (!isStartDesignatedPad) {
      const startBuilding = activeWorld.findObstacleAtPoint(start[0], start[1]);
      if (startBuilding) {
        return this.createFailureResponse(
          `Starting point is inside building footprint: ${startBuilding.name}. Takeoff sites must be clear of physical structures.`
        );
      }
    }

    // Check Red Airspace Zones
    for (const zone of activeWorld.getAirspaceZones()) {
      if (zone.classification === 'RED') {
        const [sMx, sMy] = geoToLocalMetric(start[0], start[1]);
        const [dMx, dMy] = geoToLocalMetric(dest[0], dest[1]);
        const startCheck = segmentToPolygonDistanceMetric([sMx, sMy], [sMx, sMy], zone.coordinates);
        if (startCheck.isIntersecting || startCheck.minDistance < 10.0) {
          return this.createFailureResponse(`Departure denied: Starting location is inside prohibited DGCA Red Zone: ${zone.name}.`);
        }
        const destCheck = segmentToPolygonDistanceMetric([dMx, dMy], [dMx, dMy], zone.coordinates);
        if (destCheck.isIntersecting || destCheck.minDistance < 10.0) {
          return this.createFailureResponse(`Arrival denied: Destination is inside prohibited DGCA Red Zone: ${zone.name}.`);
        }
      }
    }

    // ─── 2. CHECK DIRECT PATH & DETECT INTERSECTING OBSTACLES ──────────────

    const directStart: [number, number, number] = [start[0], start[1], cruiseAlt];
    const directDest: [number, number, number] = [dest[0], dest[1], cruiseAlt];

    const directCheck = activeChecker.checkSegment(directStart, directDest, {
      droneRadiusMeters: droneRadius,
      horizontalBufferMeters: safetyMargin,
      allowYellowZones,
    });

    // ─── 3. STRATEGY SELECTION: DIRECT vs HORIZONTAL DETOUR vs ALTITUDE ───

    let rawPath: [number, number, number][] = [];
    let detourCount = 0;
    let altitudeAdjusted = false;
    let totalEvaluatedNodes = 1;

    if (directCheck.isCollisionFree) {
      // Direct path is completely unobstructed!
      rawPath = [directStart, directDest];
    } else {
      // Direct path is obstructed!
      // Examine intersecting obstacles and search for a collision-free route.
      const searchRes = this.searchObstacleAvoidancePath({
        start: directStart,
        destination: directDest,
        cruiseAlt,
        minAlt,
        maxCeiling,
        droneRadius,
        safetyMargin,
        allowYellowZones,
        preferHorizontal,
        worldModel: activeWorld,
        checker: activeChecker,
      });

      if (!searchRes.success || searchRes.path.length < 2) {
        return this.createFailureResponse(
          searchRes.error || `Path blocked: No continuous collision-free corridor could be found avoiding physical structures and restricted airspace.`
        );
      }

      rawPath = searchRes.path;
      detourCount = searchRes.detourCount;
      altitudeAdjusted = searchRes.altitudeAdjusted;
      totalEvaluatedNodes = searchRes.evaluatedNodes;
    }

    // ─── 4. ROUTE SIMPLIFICATION (LINE-OF-SIGHT SHORTCUTTING) ──────────────

    const simplified = altitudeAdjusted
      ? rawPath
      : this.simplifier.simplify(rawPath, activeChecker, {
          droneRadiusMeters: droneRadius,
          maxDistanceBetweenCheckpoints: checkpointSpacing * 2.5,
        });

    // ─── 5. ADAPTIVE CHECKPOINT MANIFEST GENERATION ────────────────────────

    const waypoints = this.generateRealisticCheckpoints(simplified, {
      spacingMeters: checkpointSpacing,
      cruiseAltMeters: cruiseAlt,
      startName,
      destName,
      maxClimbRateMs: DEFAULT_ALTITUDE_CONFIG.maxClimbRateMs,
      maxDescentRateMs: DEFAULT_ALTITUDE_CONFIG.maxDescentRateMs,
    });

    // ─── 6. FINAL FULL-ROUTE COLLISION RE-VALIDATION ───────────────────────

    const polylineCoords = waypoints.map(w => [w.lng, w.lat, w.altitudeMeters] as [number, number, number]);
    const finalValidationCheck = activeChecker.checkPolyline(polylineCoords, {
      droneRadiusMeters: droneRadius,
      horizontalBufferMeters: safetyMargin,
      allowYellowZones,
      checkTerrainFloor: false, // pads at 0m are valid
    });

    if (!finalValidationCheck.isCollisionFree) {
      return this.createFailureResponse(
        `Final route validation failed: ${finalValidationCheck.blockedReason}`
      );
    }

    // Calculate total flight distance
    let totalDistMeters = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      totalDistMeters += getDistanceMeters(
        waypoints[i].lat,
        waypoints[i].lng,
        waypoints[i + 1].lat,
        waypoints[i + 1].lng
      );
    }
    const distanceKm = Math.round((totalDistMeters / 1000) * 100) / 100;
    const estimatedMinutes = Math.max(1, Math.ceil((distanceKm / DEFAULT_ALTITUDE_CONFIG.cruiseSpeedKmh) * 60 + 0.75));

    // Construct validation result object
    const warnings: string[] = [];
    if (finalValidationCheck.hasUnverifiedData) {
      warnings.push('Some building obstacles have estimated or provisional height data. Clearance buffer has been increased conservatively.');
    }
    warnings.push('Flight path strictly verified collision-free against all surveyed 3D building extrusions and elevation bounds.');

    const validation: RouteValidationResult = {
      isValid: true,
      status: finalValidationCheck.hasUnverifiedData ? 'UNVERIFIED_DATA' : 'VALIDATED',
      reasons: [],
      warnings,
      minObstacleClearanceMeters: Math.max(0, Math.round(finalValidationCheck.minimumHorizontalSeparationMeters)),
      minVerticalClearanceMeters: Math.max(0, Math.round(finalValidationCheck.minimumVerticalSeparationMeters)),
      intersectedZones: [],
      regulatoryReference: OFFICIAL_REGULATORY_CONFIG,
    };

    // Primary route candidate
    const primaryCandidate: RouteCandidate = {
      id: 'cand-optimal-3d',
      name: '3D Building-Aware Optimal Corridor',
      description: detourCount > 0
        ? `Collision-free corridor navigating around ${detourCount} building structure(s) at ${cruiseAlt}m AGL.`
        : `Direct unobstructed aerial corridor at ${cruiseAlt}m AGL.`,
      coordinates: waypoints.map(w => [w.lng, w.lat]),
      waypoints,
      distanceKm,
      simulatedMinutes: estimatedMinutes,
      checkpointCount: waypoints.length,
      validation,
      isRecommended: true,
      recommendationReason: `Recommended: Confirmed 0 building intersections, ${validation.minObstacleClearanceMeters}m minimum clearance, within ${maxCeiling}m regulatory ceiling.`,
      strategy: 'optimal',
      color: '#00f0ff',
    };

    return {
      success: true,
      primaryPath: polylineCoords,
      waypoints,
      distanceKm,
      estimatedMinutes,
      validation,
      detourCount,
      altitudeAdjusted,
      evaluatedNodesCount: totalEvaluatedNodes,
      candidates: [primaryCandidate],
    };
  }

  /**
   * Searches for a collision-free 3D path using lateral detours (preferred)
   * or altitude adjustments when safe and permitted.
   */
  private searchObstacleAvoidancePath(options: {
    start: [number, number, number];
    destination: [number, number, number];
    cruiseAlt: number;
    minAlt: number;
    maxCeiling: number;
    droneRadius: number;
    safetyMargin: number;
    allowYellowZones: boolean;
    preferHorizontal: boolean;
    worldModel: IWorldModel3D;
    checker: ISegmentCollisionChecker;
  }): {
    success: boolean;
    path: [number, number, number][];
    detourCount: number;
    altitudeAdjusted: boolean;
    evaluatedNodes: number;
    error?: string;
  } {
    const { start, destination, cruiseAlt, minAlt, maxCeiling, droneRadius, safetyMargin, allowYellowZones, preferHorizontal, worldModel, checker } = options;

    const [startMx, startMy] = geoToLocalMetric(start[0], start[1]);
    const [destMx, destMy] = geoToLocalMetric(destination[0], destination[1]);

    // 1. Gather all obstacles
    const obstacles = worldModel.getBuildingObstacles();

    const tryOverflight = (currentIterations: number): {
      success: boolean;
      path: [number, number, number][];
      detourCount: number;
      altitudeAdjusted: boolean;
      evaluatedNodes: number;
      error?: string;
    } | null => {
      let highestObstacleHeight = 0;
      let highestObstacleName = '';
      let highestObstacleVertBuffer = DEFAULT_ALTITUDE_CONFIG.defaultVerticalBufferMeters;

      for (const obs of obstacles) {
        const [sMx, sMy] = geoToLocalMetric(start[0], start[1]);
        const [dMx, dMy] = geoToLocalMetric(destination[0], destination[1]);
        const distMetric = segmentToPolygonDistanceMetric([sMx, sMy], [dMx, dMy], obs.footprint);
        const reqClearance = obs.horizontalSafetyBufferMeters + droneRadius;
        if (distMetric.isIntersecting || distMetric.minDistance < reqClearance) {
          if (obs.heightAboveGroundMeters > highestObstacleHeight) {
            highestObstacleHeight = obs.heightAboveGroundMeters;
            highestObstacleName = obs.name;
            highestObstacleVertBuffer = obs.verticalClearanceBufferMeters || DEFAULT_ALTITUDE_CONFIG.defaultVerticalBufferMeters;
          }
        }
      }

      if (highestObstacleHeight > 0) {
        const requiredOverflightAlt = highestObstacleHeight + highestObstacleVertBuffer + 5.0;

        // Check if required overflight altitude exceeds regional ceiling!
        if (requiredOverflightAlt > maxCeiling) {
          return {
            success: false,
            path: [],
            detourCount: 0,
            altitudeAdjusted: false,
            evaluatedNodes: currentIterations,
            error: `Path blocked: Obstacle ${highestObstacleName} (Height: ${highestObstacleHeight}m) cannot be bypassed within the permitted altitude ceiling of ${maxCeiling}m AGL (${requiredOverflightAlt}m required), and no lateral bypass corridor is open.`,
          };
        }

        // Safe overflight is within ceiling! Generate smooth vertical climb profile
        const midLng = (start[0] + destination[0]) / 2;
        const midLat = (start[1] + destination[1]) / 2;

        const overflightPath: [number, number, number][] = [
          [start[0], start[1], cruiseAlt],
          [start[0] * 0.7 + midLng * 0.3, start[1] * 0.7 + midLat * 0.3, requiredOverflightAlt], // Climb point
          [midLng, midLat, requiredOverflightAlt], // Overflight point
          [midLng * 0.3 + destination[0] * 0.7, midLat * 0.3 + destination[1] * 0.7, requiredOverflightAlt], // Pre-descent point
          [destination[0], destination[1], cruiseAlt],
        ];

        // Re-validate the vertical adjustment path
        const overflightValidation = checker.checkPolyline(overflightPath, {
          droneRadiusMeters: droneRadius,
          horizontalBufferMeters: safetyMargin,
          allowYellowZones,
        });

        if (overflightValidation.isCollisionFree) {
          return {
            success: true,
            path: overflightPath,
            detourCount: 0,
            altitudeAdjusted: true,
            evaluatedNodes: currentIterations + 5,
          };
        }
      }
      return null;
    };

    // If caller explicitly preferred altitude overflight, try it first
    if (!preferHorizontal) {
      const overflightRes = tryOverflight(1);
      if (overflightRes) return overflightRes;
    }

    // 2. Generate Lateral Bypass Detour Vertices around Obstacles
    // For every obstacle near the flight vector, compute convex corner detour nodes
    const detourNodes: { x: number; y: number; lng: number; lat: number; alt: number; obstacleId: string }[] = [];

    for (const obs of obstacles) {
      // Offset along corner bisector must scale by sqrt(2) (~1.42x - 1.55x) so perpendicular wall clearance satisfies safety buffer
      const horizBuffer = (obs.horizontalSafetyBufferMeters + droneRadius + 8.0) * 1.55;
      const footprint = obs.footprint;

      // Generate corner bypass points
      for (let i = 0; i < footprint.length - 1; i++) {
        const pt = footprint[i];
        const [mx, my] = geoToLocalMetric(pt[0], pt[1]);
        const [cMx, cMy] = geoToLocalMetric(obs.center[0], obs.center[1]);

        // Direction vector from center to corner
        const vX = mx - cMx;
        const vY = my - cMy;
        const vLen = Math.hypot(vX, vY);
        if (vLen === 0) continue;

        // Offset outward along corner bisector
        const detourMx = mx + (vX / vLen) * horizBuffer;
        const detourMy = my + (vY / vLen) * horizBuffer;
        const [dLng, dLat] = localMetricToGeo(detourMx, detourMy);

        // Ensure detour point is in bounds and collision-free
        if (isCoordinateWithinBounds(dLng, dLat)) {
          const ptCheck = checker.checkPoint([dLng, dLat, cruiseAlt], {
            droneRadiusMeters: droneRadius,
            horizontalBufferMeters: safetyMargin,
            allowYellowZones,
          });
          if (ptCheck.isCollisionFree) {
            detourNodes.push({
              x: detourMx,
              y: detourMy,
              lng: dLng,
              lat: dLat,
              alt: cruiseAlt,
              obstacleId: obs.id,
            });
          }
        }
      }
    }

    // 3. Graph Search (A* over Detour Vertices & Corridor)
    // Nodes: Start, Detour Vertices, Destination
    const startNode: NavNode = {
      id: 'start',
      lng: start[0],
      lat: start[1],
      altMeters: cruiseAlt,
      x: startMx,
      y: startMy,
      gCost: 0,
      hCost: Math.hypot(destMx - startMx, destMy - startMy),
      fCost: Math.hypot(destMx - startMx, destMy - startMy),
    };

    const destNode: NavNode = {
      id: 'dest',
      lng: destination[0],
      lat: destination[1],
      altMeters: cruiseAlt,
      x: destMx,
      y: destMy,
      gCost: Infinity,
      hCost: 0,
      fCost: Infinity,
    };

    const graphNodes: NavNode[] = [
      startNode,
      ...detourNodes.map((dn, idx): NavNode => ({
        id: `detour-${idx}`,
        lng: dn.lng,
        lat: dn.lat,
        altMeters: dn.alt,
        x: dn.x,
        y: dn.y,
        gCost: Infinity,
        hCost: Math.hypot(destMx - dn.x, destMy - dn.y),
        fCost: Infinity,
        isDetourNode: true,
      })),
      destNode,
    ];

    const openSet: NavNode[] = [startNode];
    const closedSet = new Set<string>();
    let iterations = 0;
    const maxIterations = 3500;
    let targetReached = false;

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      // Pick lowest fCost
      let bestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].fCost < openSet[bestIdx].fCost) {
          bestIdx = i;
        }
      }

      const current = openSet.splice(bestIdx, 1)[0];
      closedSet.add(current.id);

      // Check if reached destination
      if (current.id === 'dest') {
        targetReached = true;
        break;
      }

      // Check direct visibility to destination
      if (current.id !== 'dest') {
        const segToDest = checker.checkSegment(
          [current.lng, current.lat, current.altMeters],
          [destNode.lng, destNode.lat, destNode.altMeters],
          { droneRadiusMeters: droneRadius, horizontalBufferMeters: safetyMargin, allowYellowZones }
        );

        if (segToDest.isCollisionFree) {
          const edgeDist = Math.hypot(destNode.x - current.x, destNode.y - current.y);
          const tentativeG = current.gCost + edgeDist;
          if (tentativeG < destNode.gCost) {
            destNode.gCost = tentativeG;
            destNode.fCost = tentativeG;
            destNode.parent = current;
            if (!openSet.some(n => n.id === 'dest')) {
              openSet.push(destNode);
            }
          }
        }
      }

      // Expand to other detour nodes
      for (const neighbor of graphNodes) {
        if (neighbor.id === current.id || closedSet.has(neighbor.id)) continue;

        // Metric distance
        const edgeDist = Math.hypot(neighbor.x - current.x, neighbor.y - current.y);
        // Avoid excessive jumps between distant detour points
        if (edgeDist > 2500) continue;

        // Check if edge is collision-free
        const segCheck = checker.checkSegment(
          [current.lng, current.lat, current.altMeters],
          [neighbor.lng, neighbor.lat, neighbor.altMeters],
          { droneRadiusMeters: droneRadius, horizontalBufferMeters: safetyMargin, allowYellowZones }
        );

        if (!segCheck.isCollisionFree) continue;

        const tentativeG = current.gCost + edgeDist;
        if (tentativeG < neighbor.gCost) {
          neighbor.gCost = tentativeG;
          neighbor.fCost = tentativeG + neighbor.hCost;
          neighbor.parent = current;

          if (!openSet.some(n => n.id === neighbor.id)) {
            openSet.push(neighbor);
          }
        }
      }
    }

    if (targetReached) {
      // Reconstruct horizontal detour path
      const pathReconstructed: [number, number, number][] = [];
      let curr: NavNode | undefined = destNode;
      let detourCount = 0;
      while (curr) {
        pathReconstructed.push([curr.lng, curr.lat, curr.altMeters]);
        if (curr.isDetourNode) detourCount++;
        curr = curr.parent;
      }
      pathReconstructed.reverse();

      return {
        success: true,
        path: pathReconstructed,
        detourCount,
        altitudeAdjusted: false,
        evaluatedNodes: iterations,
      };
    }

    // ─── 4. PERMITTED ALTITUDE ADJUSTMENT (When Horizontal Detour is Blocked) ─
    // If lateral detour is blocked, test if climbing over the obstacle is valid
    // within the configured altitude ceiling (<= 120m AGL).
    const overflightRes = tryOverflight(iterations);
    if (overflightRes) return overflightRes;

    return {
      success: false,
      path: [],
      detourCount: 0,
      altitudeAdjusted: false,
      evaluatedNodes: iterations,
      error: `Path blocked: No continuous collision-free corridor could be found between departure and destination avoiding physical building obstacles.`,
    };
  }

  /**
   * Generates realistic, structured Waypoint checkpoints along the simplified path.
   */
  private generateRealisticCheckpoints(
    coordinates: [number, number, number][],
    options: {
      spacingMeters: number;
      cruiseAltMeters: number;
      startName: string;
      destName: string;
      maxClimbRateMs: number;
      maxDescentRateMs: number;
    }
  ): Waypoint[] {
    if (coordinates.length < 2) return [];

    const { spacingMeters, cruiseAltMeters, startName, destName } = options;
    const densePoints: { coord: [number, number, number]; isTurn: boolean; heading?: number }[] = [];

    // Detect turn vertices
    const isBend: boolean[] = new Array(coordinates.length).fill(false);
    for (let i = 1; i < coordinates.length - 1; i++) {
      const pPrev = coordinates[i - 1];
      const pCurr = coordinates[i];
      const pNext = coordinates[i + 1];

      const b1 = calculateBearing(pPrev[1], pPrev[0], pCurr[1], pCurr[0]);
      const b2 = calculateBearing(pCurr[1], pCurr[0], pNext[1], pNext[0]);
      const angleDiff = Math.abs((b2 - b1 + 540) % 360 - 180);
      if (angleDiff >= 15.0) {
        isBend[i] = true;
      }
    }

    densePoints.push({ coord: coordinates[0], isTurn: false });

    for (let i = 0; i < coordinates.length - 1; i++) {
      const p1 = coordinates[i];
      const p2 = coordinates[i + 1];
      const segDist = getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);
      const heading = calculateBearing(p1[1], p1[0], p2[1], p2[0]);

      // Subdivide long straight sections to maintain telemetry monitoring
      const subCount = Math.max(1, Math.round(segDist / spacingMeters));

      for (let s = 1; s < subCount; s++) {
        const frac = s / subCount;
        const interpLng = p1[0] + frac * (p2[0] - p1[0]);
        const interpLat = p1[1] + frac * (p2[1] - p1[1]);
        const interpAlt = Math.round((p1[2] + frac * (p2[2] - p1[2])) * 10) / 10;
        densePoints.push({ coord: [interpLng, interpLat, interpAlt], isTurn: false, heading });
      }

      const nextIsTurn = isBend[i + 1] || false;
      densePoints.push({ coord: p2, isTurn: nextIsTurn, heading });
    }

    // Calculate cumulative distances
    let cumulativeMeters = 0;
    const cumDists: number[] = [0];
    for (let i = 0; i < densePoints.length - 1; i++) {
      cumulativeMeters += getDistanceMeters(
        densePoints[i].coord[1],
        densePoints[i].coord[0],
        densePoints[i + 1].coord[1],
        densePoints[i + 1].coord[0]
      );
      cumDists.push(cumulativeMeters);
    }
    const totalKm = cumulativeMeters / 1000;
    const totalMinutes = Math.max(1, Math.ceil((totalKm / DEFAULT_ALTITUDE_CONFIG.cruiseSpeedKmh) * 60 + 0.75));

    const timestamp = Date.now();
    return densePoints.map((pt, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === densePoints.length - 1;
      const progressFrac = cumDists[idx] / Math.max(1, cumulativeMeters);
      const etaMinutes = Math.round(progressFrac * totalMinutes);
      const seqNum = String(idx + 1).padStart(2, '0');
      const pointAlt = isFirst ? 0 : isLast ? 0 : pt.coord[2];

      let name = '';
      if (isFirst) {
        name = `${startName} (Departure Pad)`;
      } else if (isLast) {
        name = `${destName} (Arrival Pad)`;
      } else if (pt.isTurn) {
        name = `Turn CP-${seqNum} [HDG ${Math.round(pt.heading || 0)}°] (${Math.round(pointAlt)}m AGL)`;
      } else {
        name = `Waypoint CP-${seqNum} (${Math.round(pointAlt)}m AGL)`;
      }

      return {
        id: `cp-${seqNum}-${timestamp}`,
        name,
        lat: pt.coord[1],
        lng: pt.coord[0],
        altitudeMeters: pointAlt,
        type: isFirst ? 'base' : isLast ? 'delivery' : 'transit',
        status: isFirst ? 'completed' : 'upcoming',
        etaMinutes,
      };
    });
  }

  private createFailureResponse(errorMsg: string): PathPlanningResponse {
    return {
      success: false,
      primaryPath: [],
      waypoints: [],
      distanceKm: 0,
      estimatedMinutes: 0,
      error: errorMsg,
      detourCount: 0,
      altitudeAdjusted: false,
      validation: {
        isValid: false,
        status: 'BLOCKED',
        reasons: [errorMsg],
        warnings: [],
        minObstacleClearanceMeters: 0,
        minVerticalClearanceMeters: 0,
        intersectedZones: [],
        regulatoryReference: OFFICIAL_REGULATORY_CONFIG,
      },
    };
  }
}
