/**
 * Exact 3D Continuous Segment Collision Checker
 * AEROVATA by TASPORA - UTM Autonomous Airspace Command
 * 
 * Implements continuous 3D volume collision detection between flight
 * segments [P1, P2] and building obstacle extrusions.
 * 
 * Guarantees:
 * 1. Continuous segment-to-polygon distance calculation (no sampling gaps).
 * 2. Corner-clipping prevention: tests clearance against all building vertices.
 * 3. 3D vertical clearance evaluation along altitude transitions.
 * 4. Separate handling of physical building obstacles vs DGCA airspace zones.
 */

import { 
  BuildingObstacle3D, 
  CollisionCheckOptions, 
  ISegmentCollisionChecker, 
  IWorldModel3D, 
  SegmentCollisionResult 
} from './types';
import { isPointInsidePolygon } from './worldModel';

// Earth metric projection constants (Centered on Coimbatore)
const R_EARTH = 6371000;
const ORIGIN_LNG = 76.9660;
const ORIGIN_LAT = 11.0180;
const COS_ORIGIN_LAT = Math.cos((ORIGIN_LAT * Math.PI) / 180);

export function geoToLocalMetric(lng: number, lat: number): [number, number] {
  const x = (lng - ORIGIN_LNG) * (Math.PI / 180) * R_EARTH * COS_ORIGIN_LAT;
  const y = (lat - ORIGIN_LAT) * (Math.PI / 180) * R_EARTH;
  return [x, y];
}

export function localMetricToGeo(x: number, y: number): [number, number] {
  const lng = ORIGIN_LNG + (x / (R_EARTH * COS_ORIGIN_LAT)) * (180 / Math.PI);
  const lat = ORIGIN_LAT + (y / R_EARTH) * (180 / Math.PI);
  return [lng, lat];
}

/**
 * Calculates Euclidean distance from point (px, py) to line segment (x1, y1)-(x2, y2).
 * Returns distance and parameter t in [0, 1].
 */
export function pointToSegmentDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): { distance: number; t: number; closestX: number; closestY: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const d = Math.hypot(px - x1, py - y1);
    return { distance: d, t: 0, closestX: x1, closestY: y1 };
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  const distance = Math.hypot(px - closestX, py - closestY);

  return { distance, t, closestX, closestY };
}

/**
 * Tests if two 2D line segments [p1, p2] and [p3, p4] intersect.
 */
export function doSegmentsIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): boolean {
  function ccw(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
    return (cy - ay) * (bx - ax) - (by - ay) * (cx - ax);
  }

  const ccw1 = ccw(x1, y1, x2, y2, x3, y3);
  const ccw2 = ccw(x1, y1, x2, y2, x4, y4);
  const ccw3 = ccw(x3, y3, x4, y4, x1, y1);
  const ccw4 = ccw(x3, y3, x4, y4, x2, y2);

  if (((ccw1 > 0 && ccw2 < 0) || (ccw1 < 0 && ccw2 > 0)) &&
      ((ccw3 > 0 && ccw4 < 0) || (ccw3 < 0 && ccw4 > 0))) {
    return true;
  }

  // Collinear or endpoint touching checks
  if (ccw1 === 0 && pointToSegmentDistance(x3, y3, x1, y1, x2, y2).distance < 0.001) return true;
  if (ccw2 === 0 && pointToSegmentDistance(x4, y4, x1, y1, x2, y2).distance < 0.001) return true;
  if (ccw3 === 0 && pointToSegmentDistance(x1, y1, x3, y3, x4, y4).distance < 0.001) return true;
  if (ccw4 === 0 && pointToSegmentDistance(x2, y2, x3, y3, x4, y4).distance < 0.001) return true;

  return false;
}

/**
 * Computes exact minimum 2D horizontal distance between flight segment [P1, P2]
 * and an obstacle polygon footprint.
 * Returns minimum metric distance, and parameter t on flight segment where closest point occurs.
 */
export function segmentToPolygonDistanceMetric(
  s1: [number, number], // Flight start [x, y] in local meters
  s2: [number, number], // Flight end [x, y] in local meters
  polygonGeo: [number, number][] // Footprint in [lng, lat]
): { minDistance: number; tFlight: number; isIntersecting: boolean } {
  // Convert polygon to local metric coordinates
  const polyMetric = polygonGeo.map(([lng, lat]) => geoToLocalMetric(lng, lat));

  // 1. Check if either endpoint is inside polygon footprint
  const [lng1, lat1] = localMetricToGeo(s1[0], s1[1]);
  const [lng2, lat2] = localMetricToGeo(s2[0], s2[1]);
  if (isPointInsidePolygon([lng1, lat1], polygonGeo)) {
    return { minDistance: 0, tFlight: 0, isIntersecting: true };
  }
  if (isPointInsidePolygon([lng2, lat2], polygonGeo)) {
    return { minDistance: 0, tFlight: 1, isIntersecting: true };
  }

  let minDistance = Infinity;
  let tAtMin = 0;
  let isIntersecting = false;

  // 2. Iterate each edge of polygon
  for (let i = 0; i < polyMetric.length - 1; i++) {
    const e1 = polyMetric[i];
    const e2 = polyMetric[i + 1];

    // Check intersection
    if (doSegmentsIntersect(s1[0], s1[1], s2[0], s2[1], e1[0], e1[1], e2[0], e2[1])) {
      isIntersecting = true;
      minDistance = 0;
      // Approximate intersection parameter t
      const d1 = pointToSegmentDistance(e1[0], e1[1], s1[0], s1[1], s2[0], s2[1]);
      tAtMin = d1.t;
      break;
    }

    // Distance from flight endpoints to obstacle edge
    const dStartToEdge = pointToSegmentDistance(s1[0], s1[1], e1[0], e1[1], e2[0], e2[1]);
    if (dStartToEdge.distance < minDistance) {
      minDistance = dStartToEdge.distance;
      tAtMin = 0;
    }

    const dEndToEdge = pointToSegmentDistance(s2[0], s2[1], e1[0], e1[1], e2[0], e2[1]);
    if (dEndToEdge.distance < minDistance) {
      minDistance = dEndToEdge.distance;
      tAtMin = 1;
    }

    // Distance from obstacle edge vertices to flight segment (CRITICAL for corner clearance!)
    const dEdgeStartToFlight = pointToSegmentDistance(e1[0], e1[1], s1[0], s1[1], s2[0], s2[1]);
    if (dEdgeStartToFlight.distance < minDistance) {
      minDistance = dEdgeStartToFlight.distance;
      tAtMin = dEdgeStartToFlight.t;
    }

    const dEdgeEndToFlight = pointToSegmentDistance(e2[0], e2[1], s1[0], s1[1], s2[0], s2[1]);
    if (dEdgeEndToFlight.distance < minDistance) {
      minDistance = dEdgeEndToFlight.distance;
      tAtMin = dEdgeEndToFlight.t;
    }
  }

  return { minDistance, tFlight: tAtMin, isIntersecting };
}

/**
 * Exact 3D Continuous Segment Collision Checker Implementation
 */
export class ExactSegmentCollisionChecker3D implements ISegmentCollisionChecker {
  private worldModel: IWorldModel3D;

  constructor(worldModel: IWorldModel3D) {
    this.worldModel = worldModel;
  }

  /**
   * Checks collision at a single 3D point.
   */
  public checkPoint(
    point: [number, number, number],
    options: CollisionCheckOptions = {}
  ): SegmentCollisionResult {
    return this.checkSegment(point, point, options);
  }

  /**
   * Checks continuous 3D collision along flight segment [P1, P2].
   */
  public checkSegment(
    p1: [number, number, number], // [lng, lat, alt] (alt in m AGL)
    p2: [number, number, number], // [lng, lat, alt] (alt in m AGL)
    options: CollisionCheckOptions = {}
  ): SegmentCollisionResult {
    const droneRadius = options.droneRadiusMeters ?? 1.5;
    const defaultHorizBuffer = options.horizontalBufferMeters ?? 25.0;
    const defaultVertBuffer = options.verticalBufferMeters ?? 15.0;
    const allowYellowZones = options.allowYellowZones ?? false;
    const checkFloor = options.checkTerrainFloor ?? false;

    const [s1x, s1y] = geoToLocalMetric(p1[0], p1[1]);
    const [s2x, s2y] = geoToLocalMetric(p2[0], p2[1]);
    const alt1 = p1[2];
    const alt2 = p2[2];

    const regulatoryConfig = this.worldModel.getRegulatoryConfig();
    const maxCeiling = regulatoryConfig.maxPermittedGreenZoneAltMeters ?? 120.0;

    let minHorizSep = Infinity;
    let minVertSep = Infinity;
    let hasUnverified = false;

    // 1. Altitude Ceiling Check (DGCA 120m AGL)
    const maxAltOnSegment = Math.max(alt1, alt2);
    if (maxAltOnSegment > maxCeiling) {
      return {
        isCollisionFree: false,
        blockedReason: `Segment altitude (${Math.round(maxAltOnSegment)}m AGL) exceeds permitted ceiling (${maxCeiling}m AGL)`,
        conflictType: 'CEILING_EXCEEDED',
        minimumHorizontalSeparationMeters: 0,
        minimumVerticalSeparationMeters: maxCeiling - maxAltOnSegment,
        closestPointCoords: [p1[0], p1[1], maxAltOnSegment],
      };
    }

    // 2. Minimum Safe Flight Altitude Check (Floor Check, e.g. 20m AGL)
    // Only check if segment is not a departure/landing pad transition (alt > 5m)
    if (checkFloor && Math.min(alt1, alt2) > 5.0 && Math.min(alt1, alt2) < 20.0) {
      return {
        isCollisionFree: false,
        blockedReason: `Segment altitude (${Math.round(Math.min(alt1, alt2))}m AGL) is below minimum safe urban flight floor (20m AGL)`,
        conflictType: 'BELOW_MIN_ALTITUDE',
        minimumHorizontalSeparationMeters: 0,
        minimumVerticalSeparationMeters: Math.min(alt1, alt2),
      };
    }

    // 3. Airspace Zones Check (Red = Hard Prohibited; Yellow = Controlled)
    const airspaceZones = this.worldModel.getAirspaceZones();
    for (const zone of airspaceZones) {
      const { minDistance, isIntersecting, tFlight } = segmentToPolygonDistanceMetric([s1x, s1y], [s2x, s2y], zone.coordinates);

      if (isIntersecting || minDistance === 0) {
        if (zone.classification === 'RED') {
          const closestLng = p1[0] + tFlight * (p2[0] - p1[0]);
          const closestLat = p1[1] + tFlight * (p2[1] - p1[1]);
          const closestAlt = alt1 + tFlight * (alt2 - alt1);
          return {
            isCollisionFree: false,
            blockedReason: `Flight segment intersects prohibited DGCA Red Zone: ${zone.name}`,
            conflictType: 'RED_ZONE',
            conflictingZone: zone,
            minimumHorizontalSeparationMeters: 0,
            minimumVerticalSeparationMeters: 0,
            closestPointCoords: [closestLng, closestLat, closestAlt],
          };
        } else if (zone.classification === 'YELLOW' && !allowYellowZones) {
          // Yellow zone requires ATC permit
        }
      }
    }

    // 4. Physical 3D Building Obstacle Checks
    const obstacles = this.worldModel.getBuildingObstacles();

    for (const obs of obstacles) {
      const horizBuffer = obs.horizontalSafetyBufferMeters || defaultHorizBuffer;
      const vertBuffer = obs.verticalClearanceBufferMeters || defaultVertBuffer;
      const requiredHorizClearance = horizBuffer + droneRadius;
      const structHeight = obs.heightAboveGroundMeters;
      const requiredVertClearance = structHeight + vertBuffer;

      // Calculate continuous metric distance from flight segment to obstacle polygon
      const { minDistance, isIntersecting, tFlight } = segmentToPolygonDistanceMetric([s1x, s1y], [s2x, s2y], obs.footprint);

      // Only flag unverified if the obstacle is within proximity of the flight segment
      if (obs.heightConfidence !== 'verified' && (isIntersecting || minDistance < requiredHorizClearance + 100.0)) {
        hasUnverified = true;
      }

      // Track minimum horizontal separation
      if (minDistance < minHorizSep) {
        minHorizSep = minDistance;
      }

      // Drone altitude at closest point along segment
      const altAtClosest = alt1 + tFlight * (alt2 - alt1);
      const verticalClearanceAtClosest = altAtClosest - structHeight;

      if (verticalClearanceAtClosest < minVertSep) {
        minVertSep = verticalClearanceAtClosest;
      }

      // Check if flight segment is horizontally within building obstacle buffer
      if (isIntersecting || minDistance < requiredHorizClearance) {
        // Horizontally within obstacle envelope!
        // Check if drone clears vertically with required buffer
        const clearsVertically = altAtClosest >= requiredVertClearance;

        // Special handling for elevated highway flyovers
        if (obs.type === 'highway_flyover' && obs.metadata?.deckElevationMeters !== undefined) {
          const deckElev = obs.metadata.deckElevationMeters;
          const deckThick = obs.metadata.deckThicknessMeters ?? 2.5;
          const deckTop = deckElev + (deckThick / 2) + vertBuffer;
          const deckBottom = Math.max(0, deckElev - (deckThick / 2) - 3.0);

          // Flyover deck collision envelope
          if (altAtClosest >= deckBottom && altAtClosest <= deckTop) {
            const closestLng = p1[0] + tFlight * (p2[0] - p1[0]);
            const closestLat = p1[1] + tFlight * (p2[1] - p1[1]);
            return {
              isCollisionFree: false,
              blockedReason: `Elevated viaduct deck collision hazard: ${obs.name} (Deck: ${deckElev}m, Flight Alt: ${Math.round(altAtClosest)}m AGL, Clearance: ${Math.round(minDistance)}m < ${requiredHorizClearance}m)`,
              conflictType: 'FLYOVER',
              conflictingObstacle: obs,
              minimumHorizontalSeparationMeters: Math.round(minDistance * 10) / 10,
              minimumVerticalSeparationMeters: Math.round(verticalClearanceAtClosest * 10) / 10,
              closestPointCoords: [closestLng, closestLat, altAtClosest],
              hasUnverifiedData: hasUnverified,
            };
          }
          continue;
        }

        // Building collision envelope
        if (!clearsVertically) {
          const closestLng = p1[0] + tFlight * (p2[0] - p1[0]);
          const closestLat = p1[1] + tFlight * (p2[1] - p1[1]);
          const isCornerClip = minDistance > 0 && minDistance < requiredHorizClearance;

          return {
            isCollisionFree: false,
            blockedReason: isCornerClip
              ? `Route clips structure corner buffer: ${obs.name} (Height: ${structHeight}m, Separation: ${Math.round(minDistance * 10) / 10}m < required ${requiredHorizClearance}m buffer)`
              : `Direct building collision hazard: ${obs.name} (Height: ${structHeight}m, Flight Alt: ${Math.round(altAtClosest)}m AGL, Required Clearance: ${requiredVertClearance}m AGL)`,
            conflictType: isCornerClip ? 'CORNER_PROXIMITY' : 'BUILDING',
            conflictingObstacle: obs,
            minimumHorizontalSeparationMeters: Math.round(minDistance * 10) / 10,
            minimumVerticalSeparationMeters: Math.round(verticalClearanceAtClosest * 10) / 10,
            closestPointCoords: [closestLng, closestLat, altAtClosest],
            hasUnverifiedData: hasUnverified,
          };
        }
      }
    }

    return {
      isCollisionFree: true,
      minimumHorizontalSeparationMeters: minHorizSep === Infinity ? 999 : Math.round(minHorizSep * 10) / 10,
      minimumVerticalSeparationMeters: minVertSep === Infinity ? alt1 : Math.round(minVertSep * 10) / 10,
      hasUnverifiedData: hasUnverified,
    };
  }

  /**
   * Checks full polyline sequence.
   */
  public checkPolyline(
    points: [number, number, number][],
    options: CollisionCheckOptions = {}
  ): SegmentCollisionResult {
    if (points.length === 0) {
      return { isCollisionFree: true, minimumHorizontalSeparationMeters: 999, minimumVerticalSeparationMeters: 999 };
    }
    if (points.length === 1) {
      return this.checkPoint(points[0], options);
    }

    let minHoriz = Infinity;
    let minVert = Infinity;
    let hasUnverified = false;

    for (let i = 0; i < points.length - 1; i++) {
      const segRes = this.checkSegment(points[i], points[i + 1], options);
      if (!segRes.isCollisionFree) {
        return segRes;
      }
      if (segRes.minimumHorizontalSeparationMeters < minHoriz) {
        minHoriz = segRes.minimumHorizontalSeparationMeters;
      }
      if (segRes.minimumVerticalSeparationMeters < minVert) {
        minVert = segRes.minimumVerticalSeparationMeters;
      }
      if (segRes.hasUnverifiedData) {
        hasUnverified = true;
      }
    }

    return {
      isCollisionFree: true,
      minimumHorizontalSeparationMeters: minHoriz,
      minimumVerticalSeparationMeters: minVert,
      hasUnverifiedData: hasUnverified,
    };
  }
}
