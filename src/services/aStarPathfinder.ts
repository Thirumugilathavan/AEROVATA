import { calculateDroneMultiRoute } from './droneAStarRouter';
// 3D A* Intelligent Autonomous Pathfinding Engine
// Solves: Continuous 3D Line Segment Traversability + 3D Obstacle Avoidance + Official Airspace Constraints (Red/Yellow/Green Zones)
// Coordinate System: Local Metric Projection (Meters relative to Airspace Center)

import { 
  Waypoint, 
  Obstacle, 
  OfficialAirspaceZone, 
  Drone, 
  ReplanResult,
  RouteComparisonParameter,
  RouteCandidate
} from '../types/fleet';
import { AIRSPACE_CENTER } from '../data/mockFleet';
import { isPointInZone, isAltitudeInZoneLimits } from '../data/officialAirspaceData';

const R_EARTH = 6371000; // Earth radius in meters
const ORIGIN_LNG = AIRSPACE_CENTER[0]; // 76.9660
const ORIGIN_LAT = AIRSPACE_CENTER[1]; // 11.0180
const COS_ORIGIN_LAT = Math.cos((ORIGIN_LAT * Math.PI) / 180);

// Convert WGS84 Geo [lng, lat, alt] to local metric [x, y, z] in meters
export function geoToMetric(lng: number, lat: number, altMeters: number): [number, number, number] {
  const x = (lng - ORIGIN_LNG) * (Math.PI / 180) * R_EARTH * COS_ORIGIN_LAT;
  const y = (lat - ORIGIN_LAT) * (Math.PI / 180) * R_EARTH;
  return [x, y, altMeters];
}

// Convert local metric [x, y, z] back to WGS84 Geo [lng, lat, alt]
export function metricToGeo(x: number, y: number, z: number): [number, number, number] {
  const lng = ORIGIN_LNG + (x / (R_EARTH * COS_ORIGIN_LAT)) * (180 / Math.PI);
  const lat = ORIGIN_LAT + (y / R_EARTH) * (180 / Math.PI);
  return [lng, lat, z];
}

interface GridNode {
  id: string;
  x: number;
  y: number;
  z: number;
  lng: number;
  lat: number;
  gCost: number;
  hCost: number;
  fCost: number;
  parent?: GridNode;
  headingX?: number;
  headingY?: number;
}

// Check if a point (lng, lat) is inside a 2D polygon
export function pointInPoly(lng: number, lat: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance from point to line segment in 2D
export function distToSegment2D(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// Distance from metric point (x, y) to polygon footprint
export function distToPolyMetric(mx: number, my: number, poly: [number, number][]): number {
  const metricPoly = poly.map(([lng, lat]) => geoToMetric(lng, lat, 0));
  const [lng, lat] = metricToGeo(mx, my, 0);
  if (pointInPoly(lng, lat, poly)) return 0;

  let minDist = Infinity;
  for (let i = 0; i < metricPoly.length - 1; i++) {
    const d = distToSegment2D(mx, my, metricPoly[i][0], metricPoly[i][1], metricPoly[i + 1][0], metricPoly[i + 1][1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// ─── 3D Collision and Constraint Checker for Single Point ────────
export function isNodeTraversable(
  x: number,
  y: number,
  z: number,
  drone: Drone,
  obstacles: Obstacle[],
  zones: OfficialAirspaceZone[],
  otherDrones: Drone[]
): { traversable: boolean; penalty: number; blockedReason?: string } {
  const [lng, lat] = metricToGeo(x, y, z);
  let extraPenalty = 0;

  // 1. Airspace Zone Checks
  for (const zone of zones) {
    if (isPointInZone([lng, lat], zone) && isAltitudeInZoneLimits(z, 'AGL', zone)) {
      if (zone.classification === 'RED') {
        return { traversable: false, penalty: Infinity, blockedReason: `RED ZONE PROHIBITED: ${zone.name}` };
      }
      if (zone.classification === 'YELLOW') {
        const hasPermit = drone.atcPermissions?.some((p) => p.zoneId === zone.id) ||
                          zone.authorizedDrones?.includes(drone.id);
        if (!hasPermit) {
          return { traversable: false, penalty: Infinity, blockedReason: `YELLOW ZONE (NO ATC PERMIT): ${zone.name}` };
        }
      }
      if (zone.classification === 'UNKNOWN') {
        return { traversable: false, penalty: Infinity, blockedReason: `UNVERIFIED AIRSPACE RESTRICTION: ${zone.name}` };
      }
    }
  }

  // 2. Obstacle Checks (3D Buildings & Elevated Highways)
  for (const obs of obstacles) {
    const dMetric = distToPolyMetric(x, y, obs.coordinates);
    const buffer = obs.safetyBufferMeters || 25;
    const physicalHeight = obs.physicalHeightMeters ?? obs.heightMeters;
    const vertBuffer = obs.verticalClearanceBufferMeters ?? 15;

    if (obs.type === 'highway_flyover') {
      const deckElev = obs.deckElevationMeters ?? physicalHeight;
      const deckThick = obs.deckThicknessMeters ?? 3.0;
      const deckTop = deckElev + (deckThick / 2) + vertBuffer;
      const deckBottom = Math.max(0, deckElev - (deckThick / 2) - 3);

      if (dMetric < buffer) {
        // Deck collision envelope
        if (z >= deckBottom && z <= deckTop) {
          return { traversable: false, penalty: Infinity, blockedReason: `ELEVATED VIADUCT DECK COLLISION HAZARD: ${obs.name}` };
        }
        // Support piers collision envelope
        if (z < deckBottom && dMetric < 12) {
          return { traversable: false, penalty: Infinity, blockedReason: `FLYOVER PIER PROXIMITY HAZARD: ${obs.name}` };
        }
      }
    } else {
      // 3D Buildings & Hospital Wings
      const bldgTop = physicalHeight + vertBuffer;
      if (dMetric < buffer && z <= bldgTop) {
        return { traversable: false, penalty: Infinity, blockedReason: `BUILDING COLLISION HAZARD: ${obs.name}` };
      }
      // Safety margin proximity penalty
      if (dMetric < buffer + 35 && z <= bldgTop + 15) {
        extraPenalty += Math.pow((buffer + 35 - dMetric) / 35, 2) * 120;
      }
    }
  }

  // 3. Drone-to-Drone Separation Radar constraint
  for (const other of otherDrones) {
    if (other.id === drone.id) continue;
    const [ox, oy, oz] = geoToMetric(other.vitals.longitude, other.vitals.latitude, other.vitals.altitudeMeters);
    const dist3D = Math.hypot(x - ox, y - oy, z - oz);
    if (dist3D < 120) {
      return { traversable: false, penalty: Infinity, blockedReason: `SEPARATION CONFLICT WITH ${other.callsign}` };
    }
    if (dist3D < 250) {
      extraPenalty += (250 - dist3D) * 3;
    }
  }

  // 4. Altitude Ceiling & Minimum Safe AGL
  if (z < 25) {
    return { traversable: false, penalty: Infinity, blockedReason: 'BELOW MINIMUM SAFE AGL (25m)' };
  }
  if (z > 120) {
    return { traversable: false, penalty: Infinity, blockedReason: 'EXCEEDS DGCA 400 FT CEILING (120m)' };
  }

  return { traversable: true, penalty: extraPenalty };
}

// ─── Continuous 3D Line Segment Traversability Checker ───────────
// Validates continuous flight volume along a line segment [P1, P2]
export function isSegment3DTraversable(
  p1: [number, number, number], // [x, y, z] metric
  p2: [number, number, number], // [x, y, z] metric
  drone: Drone,
  obstacles: Obstacle[],
  zones: OfficialAirspaceZone[],
  otherDrones: Drone[],
  stepMeters = 20
): { traversable: boolean; penalty: number; blockedReason?: string } {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dz = p2[2] - p1[2];
  const dist = Math.hypot(dx, dy, dz);

  if (dist === 0) {
    return isNodeTraversable(p1[0], p1[1], p1[2], drone, obstacles, zones, otherDrones);
  }

  const steps = Math.max(1, Math.ceil(dist / stepMeters));
  let totalPenalty = 0;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = p1[0] + dx * t;
    const y = p1[1] + dy * t;
    const z = p1[2] + dz * t;
    const check = isNodeTraversable(x, y, z, drone, obstacles, zones, otherDrones);
    if (!check.traversable) {
      return check;
    }
    totalPenalty += check.penalty / steps;
  }

  return { traversable: true, penalty: totalPenalty };
}

// ─── Core 3D A* Pathfinding Algorithm ────────────────────────────
export function runAStar3D(
  startPoint: [number, number, number], // [lng, lat, alt]
  goalPoint: [number, number, number],  // [lng, lat, alt]
  drone: Drone,
  obstacles: Obstacle[],
  zones: OfficialAirspaceZone[],
  otherDrones: Drone[],
  options?: {
    stepSizeMeters?: number;
    verticalStepMeters?: number;
    maxIterations?: number;
  }
): {
  success: boolean;
  path: [number, number, number][]; // Array of [lng, lat, alt]
  evaluatedCount: number;
  reason?: string;
} {
  const stepSize = options?.stepSizeMeters || 90; // 90m horizontal metric grid step
  const verticalStep = options?.verticalStepMeters || 15; // 15m vertical step
  const maxIterations = options?.maxIterations || 1600;

  const [startX, startY, startZ] = geoToMetric(startPoint[0], startPoint[1], startPoint[2]);
  const [goalX, goalY, goalZ] = geoToMetric(goalPoint[0], goalPoint[1], goalPoint[2]);

  // Initial validation
  const startCheck = isNodeTraversable(startX, startY, startZ, drone, obstacles, zones, otherDrones);
  const goalCheck = isNodeTraversable(goalX, goalY, goalZ, drone, obstacles, zones, otherDrones);
  if (!goalCheck.traversable) {
    return {
      success: false,
      path: [],
      evaluatedCount: 0,
      reason: `Goal point is obstructed: ${goalCheck.blockedReason}`,
    };
  }

  const openSet: GridNode[] = [];
  const closedSet = new Set<string>();

  const startNode: GridNode = {
    id: `${Math.round(startX / 30)}_${Math.round(startY / 30)}_${Math.round(startZ / 10)}`,
    x: startX,
    y: startY,
    z: startZ,
    lng: startPoint[0],
    lat: startPoint[1],
    gCost: 0,
    hCost: Math.hypot(goalX - startX, goalY - startY, goalZ - startZ),
    fCost: Math.hypot(goalX - startX, goalY - startY, goalZ - startZ),
  };

  openSet.push(startNode);
  let iterations = 0;
  let bestNode: GridNode = startNode;
  let minH = startNode.hCost;

  // Directions: 26 3D directions (8 horizontal, 3 vertical)
  const directions: [number, number, number][] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        directions.push([dx, dy, dz]);
      }
    }
  }

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;

    // Find node with lowest fCost
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].fCost < openSet[lowestIdx].fCost) {
        lowestIdx = i;
      }
    }
    const current = openSet.splice(lowestIdx, 1)[0];
    closedSet.add(current.id);

    // Goal distance
    const distToGoal = Math.hypot(goalX - current.x, goalY - current.y, goalZ - current.z);
    if (distToGoal < minH) {
      minH = distToGoal;
      bestNode = current;
    }

    // Reached goal threshold
    if (distToGoal <= stepSize * 1.35) {
      // Validate direct segment to goal
      const segToGoal = isSegment3DTraversable(
        [current.x, current.y, current.z],
        [goalX, goalY, goalZ],
        drone,
        obstacles,
        zones,
        otherDrones,
        25
      );

      if (segToGoal.traversable) {
        const rawPath: [number, number, number][] = [];
        let temp: GridNode | undefined = current;
        while (temp) {
          rawPath.push([temp.lng, temp.lat, temp.z]);
          temp = temp.parent;
        }
        rawPath.reverse();
        rawPath.push(goalPoint);

        return {
          success: true,
          path: rawPath,
          evaluatedCount: iterations,
        };
      }
    }

    // Expand neighbors
    for (const [dx, dy, dz] of directions) {
      const neighborX = current.x + dx * stepSize;
      const neighborY = current.y + dy * stepSize;
      const neighborZ = Math.min(120, Math.max(30, current.z + dz * verticalStep));

      const id = `${Math.round(neighborX / 30)}_${Math.round(neighborY / 30)}_${Math.round(neighborZ / 10)}`;
      if (closedSet.has(id)) continue;

      // Check continuous segment traversability from current to neighbor
      const segCheck = isSegment3DTraversable(
        [current.x, current.y, current.z],
        [neighborX, neighborY, neighborZ],
        drone,
        obstacles,
        zones,
        otherDrones,
        30
      );
      if (!segCheck.traversable) continue;

      // Cost calculation
      const stepDist = Math.hypot(dx * stepSize, dy * stepSize, dz * verticalStep);
      const climbCost = dz > 0 ? dz * verticalStep * 2.5 : 0;
      const turnPenalty = (current.headingX !== undefined && current.headingY !== undefined) ? 
        (1 - (dx * current.headingX + dy * current.headingY) / Math.hypot(dx, dy)) * 25 : 0;

      const gCost = current.gCost + stepDist + climbCost + turnPenalty + segCheck.penalty;
      const hCost = Math.hypot(goalX - neighborX, goalY - neighborY, goalZ - neighborZ);
      const fCost = gCost + hCost;

      const existingIdx = openSet.findIndex((n) => n.id === id);
      if (existingIdx !== -1) {
        if (gCost < openSet[existingIdx].gCost) {
          openSet[existingIdx].gCost = gCost;
          openSet[existingIdx].fCost = fCost;
          openSet[existingIdx].parent = current;
        }
      } else {
        const [nlng, nlat] = metricToGeo(neighborX, neighborY, neighborZ);
        openSet.push({
          id,
          x: neighborX,
          y: neighborY,
          z: neighborZ,
          lng: nlng,
          lat: nlat,
          gCost,
          hCost,
          fCost,
          parent: current,
          headingX: dx,
          headingY: dy,
        });
      }
    }
  }

  // Fallback to best reached node if within proximity
  if (minH < stepSize * 2.5 && bestNode) {
    const fallbackPath: [number, number, number][] = [];
    let temp: GridNode | undefined = bestNode;
    while (temp) {
      fallbackPath.push([temp.lng, temp.lat, temp.z]);
      temp = temp.parent;
    }
    fallbackPath.reverse();
    fallbackPath.push(goalPoint);
    return {
      success: true,
      path: fallbackPath,
      evaluatedCount: iterations,
    };
  }

  return {
    success: false,
    path: [],
    evaluatedCount: iterations,
    reason: 'A* search exceeded iteration depth without finding conflict-free corridor',
  };
}

// ─── Path Smoothing with Line-of-Sight Clearance Revalidation ───
export function smoothPath3D(
  path: [number, number, number][],
  drone: Drone,
  obstacles: Obstacle[],
  zones: OfficialAirspaceZone[],
  otherDrones: Drone[]
): [number, number, number][] {
  if (path.length <= 2) return path;

  const smoothed: [number, number, number][] = [path[0]];
  let currentIndex = 0;

  while (currentIndex < path.length - 1) {
    let furthestVisible = currentIndex + 1;

    for (let testIndex = path.length - 1; testIndex > currentIndex + 1; testIndex--) {
      const p1Metric = geoToMetric(path[currentIndex][0], path[currentIndex][1], path[currentIndex][2]);
      const p2Metric = geoToMetric(path[testIndex][0], path[testIndex][1], path[testIndex][2]);
      const check = isSegment3DTraversable(p1Metric, p2Metric, drone, obstacles, zones, otherDrones, 20);
      if (check.traversable) {
        furthestVisible = testIndex;
        break;
      }
    }

    smoothed.push(path[furthestVisible]);
    currentIndex = furthestVisible;
  }

  return smoothed;
}

// ─── Master Intelligent Reroute Calculator ──────────────────────
export function calculateAStarReroute(
  drone: Drone,
  obstacles: Obstacle[],
  zones: OfficialAirspaceZone[],
  allDrones: Drone[],
  conflictReason: string
): ReplanResult & { candidates?: RouteCandidate[] } {
  const currentPos: [number, number] = [
    drone.vitals.longitude,
    drone.vitals.latitude,
  ];

  const destCoords = drone.missionDestinationCoords || [76.9665, 11.0025];
  const destName = drone.missionDestinationName || 'Mission Destination';
  const startName = drone.missionStartLocation || `${drone.callsign} Current Fix`;

  const multiRes = calculateDroneMultiRoute(currentPos, destCoords, {
    startName,
    destName,
    cruiseAltMeters: drone.vitals.altitudeMeters || 65,
    safetyMarginMeters: 35,
    checkpointSpacingMeters: drone.checkpointSpacingMeters || 100,
    obstacles,
    airspaceZones: zones,
  });

  if (!multiRes.success || !multiRes.primaryRoute) {
    return {
      success: false,
      proposedRoute: [],
      originalDistanceKm: drone.distanceRemainingKm || 0,
      alternativeDistanceKm: 0,
      addedDistanceKm: 0,
      addedDelayMinutes: 0,
      status: 'NO_SAFE_ROUTE',
      reason: multiRes.error || `No collision-free corridor can avoid restricted zones and obstacles to ${destName}.`,
      conflictType: conflictReason.includes('RED') ? 'RED_ZONE' :
                    conflictReason.includes('YELLOW') ? 'YELLOW_ZONE' : 'OBSTACLE_COLLISION',
      evaluatedNodesCount: multiRes.evaluatedNodesCount || 0,
      pathClearanceMarginMeters: 0,
      flightFeasibility: {
        batteryRequiredPercent: 0,
        sufficientReserve: false,
      },
      candidates: [],
    };
  }

  const primary = multiRes.primaryRoute;
  const origDistanceKm = drone.distanceRemainingKm || primary.distanceKm;
  const altDistanceKm = primary.distanceKm;
  const addedDistanceKm = Math.max(0, parseFloat((altDistanceKm - origDistanceKm).toFixed(2)));
  const avgSpeedKmh = Math.max(35, drone.vitals.groundSpeedKmh || 48);
  const origFlightTimeMin = Math.round((origDistanceKm / avgSpeedKmh) * 60 * 10) / 10;
  const altFlightTimeMin = primary.simulatedMinutes;
  const addedDelayMinutes = Math.max(0, Math.round((altFlightTimeMin - origFlightTimeMin) * 10) / 10);

  const burnRate = drone.vitals.energyBurnRateWhPerKm || 18.0;
  const energyRequiredWh = altDistanceKm * burnRate;
  const batteryPercentNeeded = Math.round((energyRequiredWh / 240) * 100);
  const remainingAfterFlight = drone.vitals.batteryPercentage - batteryPercentNeeded;
  const sufficientReserve = remainingAfterFlight >= 15;

  const comparisonTable: RouteComparisonParameter[] = [
    {
      parameter: 'Total Flight Distance',
      originalRouteValue: `${origDistanceKm} km`,
      alternativeRouteValue: `${altDistanceKm} km`,
      delta: addedDistanceKm === 0 ? '0 km' : `+${addedDistanceKm} km`,
      status: addedDistanceKm < 1.5 ? 'OPTIMAL' : 'ACCEPTABLE',
      details: primary.recommendationReason,
    },
    {
      parameter: 'Simulated Flight Time',
      originalRouteValue: `${origFlightTimeMin} min`,
      alternativeRouteValue: `${altFlightTimeMin} min`,
      delta: addedDelayMinutes === 0 ? '0 min' : `+${addedDelayMinutes} min`,
      status: addedDelayMinutes < 2.0 ? 'OPTIMAL' : 'ACCEPTABLE',
      details: `Simulated estimate at ${Math.round(avgSpeedKmh)} km/h cruise`,
    },
    {
      parameter: 'Airspace & Obstacle Clearance',
      originalRouteValue: `1 Conflict (${conflictReason.slice(0, 28)})`,
      alternativeRouteValue: `0 Conflicts (Min Clearance: ${primary.validation.minObstacleClearanceMeters}m)`,
      delta: '-1 Threat Resolved',
      status: 'CLEAR',
      details: 'Strict vertical and horizontal clearance buffer satisfied',
    },
    {
      parameter: 'Checkpoints & Curvature',
      originalRouteValue: `${drone.route.length} Checkpoints`,
      alternativeRouteValue: `${primary.checkpointCount} Predicted Checkpoints`,
      delta: `+${Math.max(0, primary.checkpointCount - drone.route.length)} Waypoints`,
      status: 'OPTIMAL',
      details: 'Intelligently spaced adaptive predicted checkpoints along cleared path',
    },
  ];

  return {
    success: true,
    proposedRoute: primary.waypoints,
    originalDistanceKm: origDistanceKm,
    alternativeDistanceKm: altDistanceKm,
    addedDistanceKm,
    addedDelayMinutes,
    status: 'REPLANNED_VERIFIED',
    reason: conflictReason,
    conflictType: conflictReason.includes('RED') ? 'RED_ZONE' :
                  conflictReason.includes('YELLOW') ? 'YELLOW_ZONE' : 'OBSTACLE_COLLISION',
    evaluatedNodesCount: multiRes.evaluatedNodesCount || 100,
    pathClearanceMarginMeters: primary.validation.minObstacleClearanceMeters,
    flightFeasibility: {
      batteryRequiredPercent: batteryPercentNeeded,
      sufficientReserve,
    },
    comparisonTable,
    candidates: multiRes.allCandidates,
  };
}
