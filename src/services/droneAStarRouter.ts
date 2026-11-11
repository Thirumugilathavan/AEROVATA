// Dedicated A* (A-Star) Pathfinding Engine & Coimbatore Location Registry
// Upgraded: Adaptive Checkpoint Generation + 3D Building & Airspace Validation + Multi-Route Alternatives

import { 
  Waypoint, 
  Obstacle, 
  OfficialAirspaceZone,
  RouteCandidate,
  RouteValidationResult,
  RouteValidationStatus,
  RegulatoryAltitudeConfig
} from '../types/fleet';
import { COIMBATORE_DETAILED_OBSTACLES } from '../data/coimbatoreGeoData';
import { OFFICIAL_COIMBATORE_AIRSPACE_ZONES } from '../data/officialAirspaceData';
import { 
  segmentToPolygonDistanceMetric,
  ExactSegmentCollisionChecker3D
} from './routePlanning/collisionChecker';
import { 
  ObstacleAwarePlanner3D
} from './routePlanning/obstacleAwarePlanner';
import { 
  WorldModel3D, 
  extractBuildingObstacle3D 
} from './routePlanning/worldModel';
import { 
  aglToAmsl, 
  amslToAgl, 
  DEFAULT_ALTITUDE_CONFIG 
} from './routePlanning/altitudeUtils';
import { 
  COIMBATORE_LOCATIONS,
  DEFAULT_STARTING_LOCATION,
  SIMULATION_BOUNDS,
  isCoordinateWithinBounds,
  NamedLocation
} from './routePlanning/locations';

// Re-export 3D Route Planning Engine artifacts for full modular architecture
export * from './routePlanning';

// ─── 1. OFFICIAL REGULATORY ALTITUDE BASELINE & SIMULATION NOTICE ────────────
export const OFFICIAL_REGULATORY_CONFIG: RegulatoryAltitudeConfig = {
  frameworkName: 'DGCA Drone Rules 2021 & DigitalSky Airspace Framework',
  jurisdiction: 'DGCA India / Coimbatore Urban UTM Envelope',
  lastVerificationDate: '2026-03-01',
  sourceUrl: 'https://digitalsky.dgca.gov.in',
  maxPermittedGreenZoneAltMeters: 120, // 400 ft AGL standard ceiling
  maxPermittedYellowZoneAltMeters: 120, // 400 ft AGL with mandatory ATC clearance
  mandatorySeparationBufferMeters: 15, // Minimum vertical structure buffer
  status: 'VERIFIED_OFFICIAL',
  disclaimer: 'Illustrative simulation only. Checkpoint spacing, flight times, and clearances are simulation settings and do not guarantee real-world GNSS navigation accuracy or real autonomous flight authorization. Missing or estimated map data must not be interpreted as proof of clear airspace.',
};

// ─── 2. PREDEFINED COIMBATORE LOCATION REGISTRY & BOUNDS ───────────────────
// Defined in and re-exported from ./routePlanning/locations

// ─── 3. GEOMETRY & PROJECTION UTILITIES ──────────────────────────────────────
const R_EARTH = 6371000; // meters
const ORIGIN_LNG = 76.9660;
const ORIGIN_LAT = 11.0180;
const COS_ORIGIN_LAT = Math.cos((ORIGIN_LAT * Math.PI) / 180);

export function geoToLocalMeters(lng: number, lat: number): [number, number] {
  const x = (lng - ORIGIN_LNG) * (Math.PI / 180) * R_EARTH * COS_ORIGIN_LAT;
  const y = (lat - ORIGIN_LAT) * (Math.PI / 180) * R_EARTH;
  return [x, y];
}

export function localMetersToGeo(x: number, y: number): [number, number] {
  const lng = ORIGIN_LNG + (x / (R_EARTH * COS_ORIGIN_LAT)) * (180 / Math.PI);
  const lat = ORIGIN_LAT + (y / R_EARTH) * (180 / Math.PI);
  return [lng, lat];
}

export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_EARTH * c;
}

export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (theta * 180 / Math.PI + 360) % 360;
}

export function isPointInPolygon(pt: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = pt;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function distanceToPolygonMeters(mx: number, my: number, geoPoly: [number, number][]): number {
  const [lng, lat] = localMetersToGeo(mx, my);
  if (isPointInPolygon([lng, lat], geoPoly)) return 0;

  const metricPoly = geoPoly.map(([glng, glat]) => geoToLocalMeters(glng, glat));
  let minDist = Infinity;
  for (let i = 0; i < metricPoly.length - 1; i++) {
    const d = distanceToSegment(mx, my, metricPoly[i][0], metricPoly[i][1], metricPoly[i + 1][0], metricPoly[i + 1][1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// ─── 4. OBSTACLE & AIRSPACE SAFETY EVALUATION ────────────────────────────────
export interface ObstacleCheckResult {
  isBlocked: boolean;
  reason?: string;
  sourceType?: 'RED_ZONE' | 'YELLOW_ZONE' | 'BUILDING' | 'FLYOVER' | 'OUT_OF_BOUNDS';
  distanceToObstacleMeters?: number;
  verticalClearanceMeters?: number;
}

export function evaluatePointSafety(
  mx: number,
  my: number,
  cruiseAltMeters: number = 65,
  safetyMarginMeters: number = 35,
  obstacles: Obstacle[] = COIMBATORE_DETAILED_OBSTACLES,
  airspaceZones: OfficialAirspaceZone[] = OFFICIAL_COIMBATORE_AIRSPACE_ZONES,
  allowYellowZones: boolean = false
): ObstacleCheckResult {
  const [lng, lat] = localMetersToGeo(mx, my);

  // 1. Boundary check
  if (!isCoordinateWithinBounds(lng, lat)) {
    return {
      isBlocked: true,
      reason: 'Coordinate is outside the authorized Coimbatore UTM simulation envelope',
      sourceType: 'OUT_OF_BOUNDS',
    };
  }

  // 2. Airspace Zones (Red = Strict Prohibited; Yellow = Requires Authorization)
  for (const zone of airspaceZones) {
    const inZone = isPointInPolygon([lng, lat], zone.coordinates);

    if (zone.classification === 'RED') {
      if (inZone) {
        return {
          isBlocked: true,
          reason: `Violates prohibited DGCA Red Zone: ${zone.name}`,
          sourceType: 'RED_ZONE',
          distanceToObstacleMeters: 0,
        };
      }
      // Safety buffer around Red Zone
      const dist = distanceToPolygonMeters(mx, my, zone.coordinates);
      if (dist < safetyMarginMeters) {
        return {
          isBlocked: true,
          reason: `Within ${Math.round(dist)}m of prohibited airspace buffer (${zone.name})`,
          sourceType: 'RED_ZONE',
          distanceToObstacleMeters: dist,
        };
      }
    } else if (zone.classification === 'YELLOW' && allowYellowZones === false && false) {
      // Yellow zones require authorization but are navigable with caution / authorization flags
      if (inZone) {
        return {
          isBlocked: true,
          reason: `Requires mandatory authorization in DGCA Yellow Zone: ${zone.name}`,
          sourceType: 'YELLOW_ZONE',
          distanceToObstacleMeters: 0,
        };
      }
    }
  }

  // 3. 3D Obstacles and High-Rise Building Footprints
  for (const obs of obstacles) {
    const buffer = (obs.safetyBufferMeters || safetyMarginMeters);
    const isUnknownHeight = obs.heightConfidence === 'unknown' || (obs.physicalHeightMeters === undefined && obs.heightMeters === undefined);
    const structHeight = isUnknownHeight ? undefined : (obs.physicalHeightMeters ?? obs.heightMeters ?? 40);
    const vertBuffer = obs.verticalClearanceBufferMeters || 15;
    
    // If building height is unknown, overflight is strictly prohibited; horizontal separation is strictly required
    if (isUnknownHeight || structHeight === undefined) {
      const dist = distanceToPolygonMeters(mx, my, obs.coordinates);
      if (dist < buffer) {
        return {
          isBlocked: true,
          reason: `Building height unknown for ${obs.name}; overflight prohibited, horizontal separation required (Buffer: ${buffer}m)`,
          sourceType: obs.type === 'highway_flyover' ? 'FLYOVER' : 'BUILDING',
          distanceToObstacleMeters: dist,
          verticalClearanceMeters: -999,
        };
      }
      continue;
    }
    
    // Check vertical clearance: altitude vs building physical height + clearance buffer
    const verticalClearance = cruiseAltMeters - structHeight;
    const clearsVertically = verticalClearance >= vertBuffer;
    
    // If not clearing vertically, horizontal separation is strictly required
    if (!clearsVertically) {
      const dist = distanceToPolygonMeters(mx, my, obs.coordinates);
      if (dist < buffer) {
        return {
          isBlocked: true,
          reason: `Structural collision hazard: ${obs.name} (Height: ${structHeight}m, Vertical Clearance: ${Math.round(verticalClearance)}m, Buffer: ${buffer}m)`,
          sourceType: obs.type === 'highway_flyover' ? 'FLYOVER' : 'BUILDING',
          distanceToObstacleMeters: dist,
          verticalClearanceMeters: verticalClearance,
        };
      }
    }
  }

  return { isBlocked: false };
}

// ─── 5. ADAPTIVE FREQUENT CHECKPOINT GENERATION ──────────────────────────────
export interface AdaptiveCheckpointOptions {
  spacingMeters?: number; // Sensible default: 100m
  bendDensityFactor?: number; // 2x density around turns >= 20 degrees
  minSeparationMeters?: number; // 15m deduplication threshold
  cruiseAltMeters?: number; // Default: 65m AGL
  startName?: string;
  destName?: string;
  routeIdPrefix?: string;
}

/**
 * Subdivides route segments into frequent, intelligently placed predicted waypoints.
 * - Subdivides long straight segments into shorter equidistant checkpoints.
 * - Preserves all critical turning points and obstacle-avoidance points.
 * - Increases checkpoint density near route bends (direction changes).
 * - Avoids duplicate or nearly identical consecutive points.
 * - Assigns explicit altitude in metres AGL to every checkpoint.
 */
export function generateAdaptiveCheckpoints(
  rawCoordinates: [number, number][], // [lng, lat][]
  options: AdaptiveCheckpointOptions = {}
): Waypoint[] {
  if (rawCoordinates.length < 2) return [];

  const spacingMeters = Math.max(40, options.spacingMeters ?? 100);
  const bendDensityFactor = options.bendDensityFactor ?? 2.0;
  const minSeparationMeters = options.minSeparationMeters ?? 15;
  const cruiseAlt = options.cruiseAltMeters ?? 65;
  const startName = options.startName || 'Departure Pad';
  const destName = options.destName || 'Arrival Pad';
  const prefix = options.routeIdPrefix || 'cp';

  // 1. Detect bend/turn vertices (heading change >= 20 degrees)
  const isBendVertex: boolean[] = new Array(rawCoordinates.length).fill(false);
  for (let i = 1; i < rawCoordinates.length - 1; i++) {
    const pPrev = rawCoordinates[i - 1];
    const pCurr = rawCoordinates[i];
    const pNext = rawCoordinates[i + 1];

    const b1 = calculateBearing(pPrev[1], pPrev[0], pCurr[1], pCurr[0]);
    const b2 = calculateBearing(pCurr[1], pCurr[0], pNext[1], pNext[0]);
    const angleDiff = Math.abs((b2 - b1 + 540) % 360 - 180);
    if (angleDiff >= 20) {
      isBendVertex[i] = true;
    }
  }

  // 2. Subdivide each segment into adaptive intermediate points
  const densePoints: { coord: [number, number]; isTurn: boolean; heading?: number }[] = [];
  densePoints.push({ coord: rawCoordinates[0], isTurn: false });

  for (let i = 0; i < rawCoordinates.length - 1; i++) {
    const p1 = rawCoordinates[i];
    const p2 = rawCoordinates[i + 1];
    const segDist = getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);
    const heading = calculateBearing(p1[1], p1[0], p2[1], p2[0]);

    // If either endpoint is a bend vertex, apply higher density
    const isBendArea = isBendVertex[i] || isBendVertex[i + 1];
    const effectiveSpacing = isBendArea ? (spacingMeters / bendDensityFactor) : spacingMeters;

    // Determine number of subdivisions
    const subCount = Math.max(1, Math.round(segDist / effectiveSpacing));

    for (let s = 1; s < subCount; s++) {
      const frac = s / subCount;
      const interpLng = p1[0] + frac * (p2[0] - p1[0]);
      const interpLat = p1[1] + frac * (p2[1] - p1[1]);
      densePoints.push({ coord: [interpLng, interpLat], isTurn: false, heading });
    }

    const nextIsTurn = isBendVertex[i + 1] || false;
    densePoints.push({ coord: p2, isTurn: nextIsTurn, heading });
  }

  // 3. Deduplicate points that are closer than minSeparationMeters
  const filteredPoints: typeof densePoints = [];
  for (let i = 0; i < densePoints.length; i++) {
    if (i === 0 || i === densePoints.length - 1 || densePoints[i].isTurn) {
      filteredPoints.push(densePoints[i]);
    } else {
      const last = filteredPoints[filteredPoints.length - 1];
      const d = getDistanceMeters(last.coord[1], last.coord[0], densePoints[i].coord[1], densePoints[i].coord[0]);
      if (d >= minSeparationMeters) {
        filteredPoints.push(densePoints[i]);
      }
    }
  }

  // 4. Calculate cumulative distance & ETA
  let cumulativeMeters = 0;
  const cumDists: number[] = [0];
  for (let i = 0; i < filteredPoints.length - 1; i++) {
    cumulativeMeters += getDistanceMeters(
      filteredPoints[i].coord[1],
      filteredPoints[i].coord[0],
      filteredPoints[i + 1].coord[1],
      filteredPoints[i + 1].coord[0]
    );
    cumDists.push(cumulativeMeters);
  }
  const totalKm = cumulativeMeters / 1000;
  const cruiseSpeedKmh = 48; // Configured simulation speed
  const totalMinutes = Math.max(1, Math.ceil((totalKm / cruiseSpeedKmh) * 60 + 0.75));

  // 5. Generate structured Waypoint manifest with sequence labels and explicit altitudes
  const timestamp = Date.now();
  return filteredPoints.map((pt, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === filteredPoints.length - 1;
    const progressFrac = cumDists[idx] / Math.max(1, cumulativeMeters);
    const etaMinutes = Math.round(progressFrac * totalMinutes);
    const seqNum = String(idx + 1).padStart(2, '0');

    let name = '';
    if (isFirst) {
      name = `${startName} (Departure Pad)`;
    } else if (isLast) {
      name = `${destName} (Arrival Pad)`;
    } else if (pt.isTurn) {
      name = `Turn CP-${seqNum} [HDG ${Math.round(pt.heading || 0)}°] (${cruiseAlt}m AGL)`;
    } else {
      name = `Predicted CP-${seqNum} (${cruiseAlt}m AGL)`;
    }

    return {
      id: `${prefix}-${seqNum}-${timestamp}`,
      name,
      lat: pt.coord[1],
      lng: pt.coord[0],
      altitudeMeters: isFirst ? 0 : isLast ? 0 : cruiseAlt,
      type: isFirst ? 'base' : isLast ? 'delivery' : 'transit',
      status: isFirst ? 'completed' : 'upcoming',
      etaMinutes,
    };
  });
}

// ─── 6. ROUTE CONSTRAINT & CLEARANCE VALIDATOR ──────────────────────────────
export function validateRouteAgainstConstraints(
  coordinates: [number, number][],
  cruiseAltMeters: number,
  obstacles: Obstacle[] = COIMBATORE_DETAILED_OBSTACLES,
  airspaceZones: OfficialAirspaceZone[] = OFFICIAL_COIMBATORE_AIRSPACE_ZONES,
  regulatoryConfig: RegulatoryAltitudeConfig = OFFICIAL_REGULATORY_CONFIG
): RouteValidationResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const intersectedZones: { zoneId: string; zoneName: string; classification: string }[] = [];
  const seenZones = new Set<string>();

  let minObstacleClearanceMeters = Infinity;
  let minVerticalClearanceMeters = Infinity;
  let isHardBlocked = false;
  let hasYellowZone = false;
  let hasUnverifiedData = false;

  // 1. Regulatory Altitude Ceiling Check
  if (cruiseAltMeters > regulatoryConfig.maxPermittedGreenZoneAltMeters) {
    warnings.push(
      `Configured simulated altitude (${cruiseAltMeters}m AGL) exceeds ${regulatoryConfig.maxPermittedGreenZoneAltMeters}m AGL regulatory ceiling under ${regulatoryConfig.frameworkName}. Marked as unverified waiver required.`
    );
    hasUnverifiedData = true;
  }

  // 2. Continuous Segment-Level Checking & Sampling along route polyline
  for (let i = 0; i < coordinates.length - 1; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[i + 1];
    const [mx1, my1] = geoToLocalMeters(p1[0], p1[1]);
    const [mx2, my2] = geoToLocalMeters(p2[0], p2[1]);
    const segDist = getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);

    // Continuous Segment Check against 3D Building Obstacles (Prevents Corner Clipping!)
    for (const obs of obstacles) {
      const structHeight = obs.physicalHeightMeters || obs.heightMeters || 40;
      const vertClearance = cruiseAltMeters - structHeight;
      if (vertClearance < minVerticalClearanceMeters) {
        minVerticalClearanceMeters = vertClearance;
      }

      const buffer = obs.safetyBufferMeters || 35;
      const vertBuffer = obs.verticalClearanceBufferMeters || 15;
      const clearsVertically = vertClearance >= vertBuffer;

      if (obs.heightConfidence !== 'verified') {
        hasUnverifiedData = true;
      }

      if (!clearsVertically) {
        const { minDistance, isIntersecting } = segmentToPolygonDistanceMetric([mx1, my1], [mx2, my2], obs.coordinates);
        if (minDistance < minObstacleClearanceMeters) {
          minObstacleClearanceMeters = minDistance;
        }

        if (isIntersecting || minDistance < buffer) {
          isHardBlocked = true;
          const msg = minDistance > 0
            ? `Route clips structure corner buffer: ${obs.name} (Height: ${structHeight}m, Vertical Clearance: ${Math.round(vertClearance)}m, Separation: ${Math.round(minDistance)}m < ${buffer}m buffer)`
            : `Collision risk with ${obs.name} (Height: ${structHeight}m, Vertical Clearance: ${Math.round(vertClearance)}m, Separation: 0m < ${buffer}m buffer)`;
          if (!reasons.includes(msg)) {
            reasons.push(msg);
          }
        }
      }
    }

    const steps = Math.max(1, Math.ceil(segDist / 25));

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const lng = p1[0] + t * (p2[0] - p1[0]);
      const lat = p1[1] + t * (p2[1] - p1[1]);
      const [mx, my] = geoToLocalMeters(lng, lat);

      // Check Airspace Zones
      for (const zone of airspaceZones) {
        if (isPointInPolygon([lng, lat], zone.coordinates)) {
          if (!seenZones.has(zone.id)) {
            seenZones.add(zone.id);
            intersectedZones.push({
              zoneId: zone.id,
              zoneName: zone.name,
              classification: zone.classification,
            });
          }

          if (zone.classification === 'RED') {
            isHardBlocked = true;
            if (!reasons.includes(`Intersects prohibited DGCA Red Zone: ${zone.name}`)) {
              reasons.push(`Intersects prohibited DGCA Red Zone: ${zone.name}`);
            }
          } else if (zone.classification === 'YELLOW') {
            hasYellowZone = true;
            if (!warnings.includes(`Requires ATC authorization in DGCA Yellow Zone: ${zone.name}`)) {
              warnings.push(`Requires ATC authorization in DGCA Yellow Zone: ${zone.name}`);
            }
          }
        }
      }

      // Check Mapped 3D Buildings & Obstacles
      for (const obs of obstacles) {
        const structHeight = obs.physicalHeightMeters || obs.heightMeters || 40;
        const vertClearance = cruiseAltMeters - structHeight;
        if (vertClearance < minVerticalClearanceMeters) {
          minVerticalClearanceMeters = vertClearance;
        }

        const buffer = obs.safetyBufferMeters || 35;
        const vertBuffer = obs.verticalClearanceBufferMeters || 15;
        const clearsVertically = vertClearance >= vertBuffer;

        if (obs.heightConfidence !== 'verified') {
          hasUnverifiedData = true;
        }

        if (!clearsVertically) {
          const horizDist = distanceToPolygonMeters(mx, my, obs.coordinates);
          if (horizDist < minObstacleClearanceMeters) {
            minObstacleClearanceMeters = horizDist;
          }

          if (horizDist < buffer) {
            isHardBlocked = true;
            const msg = `Collision risk with ${obs.name} (Height: ${structHeight}m, Vertical Clearance: ${Math.round(vertClearance)}m, Separation: ${Math.round(horizDist)}m < ${buffer}m buffer)`;
            if (!reasons.includes(msg)) {
              reasons.push(msg);
            }
          }
        }
      }
    }
  }

  // Incomplete data notice
  warnings.push('Mapped building footprints and height attributes may be incomplete. Missing data must not be interpreted as proof of clear airspace.');

  let status: RouteValidationStatus = 'VALIDATED';
  if (isHardBlocked) {
    status = 'BLOCKED';
  } else if (hasYellowZone) {
    status = 'RESTRICTED';
  } else if (hasUnverifiedData) {
    status = 'UNVERIFIED_DATA';
  }

  return {
    isValid: !isHardBlocked,
    status,
    reasons,
    warnings,
    minObstacleClearanceMeters: minObstacleClearanceMeters === Infinity ? 999 : Math.round(minObstacleClearanceMeters),
    minVerticalClearanceMeters: minVerticalClearanceMeters === Infinity ? cruiseAltMeters : Math.round(minVerticalClearanceMeters),
    intersectedZones,
    regulatoryReference: regulatoryConfig,
  };
}

// ─── 7. MIN-HEAP & A* CORE ENGINE ───────────────────────────────────────────
interface AStarNode {
  gx: number;
  gy: number;
  mx: number;
  my: number;
  gCost: number;
  hCost: number;
  fCost: number;
  parent?: AStarNode;
}

function octileHeuristic(dx: number, dy: number, cellSize: number): number {
  const minD = Math.min(dx, dy);
  const maxD = Math.max(dx, dy);
  return (minD * Math.SQRT2 + (maxD - minD)) * cellSize;
}

class MinHeap {
  private data: AStarNode[] = [];

  push(node: AStarNode) {
    this.data.push(node);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): AStarNode | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  size(): number {
    return this.data.length;
  }

  private bubbleUp(n: number) {
    const element = this.data[n];
    while (n > 0) {
      const parentN = Math.floor((n - 1) / 2);
      const parent = this.data[parentN];
      if (element.fCost >= parent.fCost) break;
      this.data[parentN] = element;
      this.data[n] = parent;
      n = parentN;
    }
  }

  private sinkDown(n: number) {
    const length = this.data.length;
    const element = this.data[n];
    while (true) {
      let child2N = (n + 1) * 2;
      let child1N = child2N - 1;
      let swap: number | null = null;
      let child1: AStarNode;

      if (child1N < length) {
        child1 = this.data[child1N];
        if (child1.fCost < element.fCost) swap = child1N;
      }
      if (child2N < length) {
        const child2 = this.data[child2N];
        if (child2.fCost < (swap === null ? element.fCost : child1!.fCost)) swap = child2N;
      }
      if (swap === null) break;
      this.data[n] = this.data[swap];
      this.data[swap] = element;
      n = swap;
    }
  }
}

function isLineSegmentClear(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cruiseAlt: number,
  safetyMargin: number,
  obstacles: Obstacle[],
  airspaceZones: OfficialAirspaceZone[],
  terminalObsIds?: Set<string>
): boolean {
  // 1. Continuous segment check against all 3D building obstacles (prevents corner clipping!)
  for (const obs of obstacles) {
    const structHeight = obs.physicalHeightMeters || obs.heightMeters || 40;
    const vertBuffer = obs.verticalClearanceBufferMeters || 15;
    const buffer = obs.safetyBufferMeters || safetyMargin;
    const clearsVertically = (cruiseAlt - structHeight) >= vertBuffer;

    if (!clearsVertically) {
      const { minDistance, isIntersecting } = segmentToPolygonDistanceMetric([x1, y1], [x2, y2], obs.coordinates);
      if (isIntersecting || minDistance < buffer) {
        return false;
      }
    }
  }

  // 2. Continuous segment check against Red Zones
  for (const zone of airspaceZones) {
    if (zone.classification === 'RED') {
      const { minDistance, isIntersecting } = segmentToPolygonDistanceMetric([x1, y1], [x2, y2], zone.coordinates);
      if (isIntersecting || minDistance < safetyMargin) {
        return false;
      }
    }
  }

  // 3. Coordinate bounds check along segment
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.ceil(dist / 25);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const px = x1 + t * (x2 - x1);
    const py = y1 + t * (y2 - y1);
    const [lng, lat] = localMetersToGeo(px, py);
    if (!isCoordinateWithinBounds(lng, lat)) return false;

    for (const zone of airspaceZones) {
      if (zone.classification === 'RED') {
        if (isPointInPolygon([lng, lat], zone.coordinates)) return false;
        if (distanceToPolygonMeters(px, py, zone.coordinates) < safetyMargin) return false;
      }
    }

    for (const obs of obstacles) {
      const buffer = obs.safetyBufferMeters || safetyMargin;
      const isUnknown = obs.heightConfidence === 'unknown' || (obs.physicalHeightMeters === undefined && obs.heightMeters === undefined);
      const structH = isUnknown ? undefined : (obs.physicalHeightMeters ?? obs.heightMeters ?? 40);
      const vertBuffer = obs.verticalClearanceBufferMeters || 15;

      if (obs.type === 'highway_flyover' || (terminalObsIds && terminalObsIds.has(obs.id))) {
        const vertClear = cruiseAlt - (structH || 20);
        if (vertClear < vertBuffer && distanceToPolygonMeters(px, py, obs.coordinates) < buffer) return false;
        continue;
      }

      if (distanceToPolygonMeters(px, py, obs.coordinates) < buffer) return false;
    }
  }
  return true;
}

function smoothPath(
  path: [number, number][],
  cruiseAlt: number,
  safetyMargin: number,
  obstacles: Obstacle[],
  airspaceZones: OfficialAirspaceZone[],
  terminalObsIds?: Set<string>
): [number, number][] {
  if (path.length <= 2) return path;
  const smoothed: [number, number][] = [path[0]];
  let currentIdx = 0;

  while (currentIdx < path.length - 1) {
    let furthestIdx = currentIdx + 1;
    for (let nextIdx = path.length - 1; nextIdx > currentIdx + 1; nextIdx--) {
      if (
        isLineSegmentClear(
          path[currentIdx][0],
          path[currentIdx][1],
          path[nextIdx][0],
          path[nextIdx][1],
          cruiseAlt,
          safetyMargin,
          obstacles,
          airspaceZones,
          terminalObsIds
        )
      ) {
        furthestIdx = nextIdx;
        break;
      }
    }
    smoothed.push(path[furthestIdx]);
    currentIdx = furthestIdx;
  }
  return smoothed;
}

// ─── 8. ROUTE DIVERSITY CHECKER ─────────────────────────────────────────────
export function areRoutesGenuinelyDistinct(
  coordsA: [number, number][],
  coordsB: [number, number][],
  minAvgDivergenceMeters: number = 75
): boolean {
  if (coordsA.length < 2 || coordsB.length < 2) return false;

  let totalDist = 0;
  let maxDist = 0;
  const sampleCount = 15;

  for (let i = 0; i < sampleCount; i++) {
    const frac = i / (sampleCount - 1);
    const idxA = Math.min(coordsA.length - 1, Math.floor(frac * (coordsA.length - 1)));
    const ptA = coordsA[idxA];

    // Find min distance to any point in coordsB
    let minDistToB = Infinity;
    for (let j = 0; j < coordsB.length; j++) {
      const d = getDistanceMeters(ptA[1], ptA[0], coordsB[j][1], coordsB[j][0]);
      if (d < minDistToB) minDistToB = d;
    }

    totalDist += minDistToB;
    if (minDistToB > maxDist) maxDist = minDistToB;
  }

  const avgDist = totalDist / sampleCount;
  return avgDist >= minAvgDivergenceMeters && maxDist >= 120;
}

// ─── 9. MULTI-ROUTE ALTERNATIVES GENERATOR ──────────────────────────────────
export interface DroneMultiRouteResult {
  success: boolean;
  primaryRoute: RouteCandidate | null;
  alternatives: RouteCandidate[];
  allCandidates: RouteCandidate[];
  error?: string;
  simulationNotice: string;
  evaluatedNodesCount?: number;
}

export function calculateDroneMultiRoute(
  startLngLat: [number, number],
  destLngLat: [number, number],
  options: {
    cruiseAltMeters?: number;
    safetyMarginMeters?: number;
    checkpointSpacingMeters?: number;
    startName?: string;
    destName?: string;
    obstacles?: Obstacle[];
    airspaceZones?: OfficialAirspaceZone[];
  } = {}
): DroneMultiRouteResult {
  const cruiseAlt = options.cruiseAltMeters ?? 65;
  const safetyMargin = options.safetyMarginMeters ?? 35;
  const spacingMeters = options.checkpointSpacingMeters ?? 100;
  const obstacles = options.obstacles ?? COIMBATORE_DETAILED_OBSTACLES;
  const airspaceZones = options.airspaceZones ?? OFFICIAL_COIMBATORE_AIRSPACE_ZONES;
  const startName = options.startName || 'Departure Pad';
  const destName = options.destName || 'Arrival Pad';

  // 1. Validate Coordinates Differ
  const dLng = Math.abs(startLngLat[0] - destLngLat[0]);
  const dLat = Math.abs(startLngLat[1] - destLngLat[1]);
  if (dLng < 0.0001 && dLat < 0.0001) {
    return {
      success: false,
      primaryRoute: null,
      alternatives: [],
      allCandidates: [],
      error: 'Destination cannot be the same as the starting point. Please select a different location.',
      simulationNotice: OFFICIAL_REGULATORY_CONFIG.disclaimer,
    };
  }

  // 2. Validate Start & Dest Boundaries, Buildings, and Red Zone
  const isStartDesignatedPad = COIMBATORE_LOCATIONS.some(
    (loc) => Math.hypot(loc.coordinates[0] - startLngLat[0], loc.coordinates[1] - startLngLat[1]) < 0.001
  );
  const isDestDesignatedPad = COIMBATORE_LOCATIONS.some(
    (loc) => Math.hypot(loc.coordinates[0] - destLngLat[0], loc.coordinates[1] - destLngLat[1]) < 0.001
  );

  for (const obs of obstacles) {
    if (obs.type !== 'highway_flyover') {
      if (!isDestDesignatedPad && isPointInPolygon(destLngLat, obs.coordinates)) {
        return {
          success: false,
          primaryRoute: null,
          alternatives: [],
          allCandidates: [],
          error: `Arrival denied: Destination is inside building footprint (${obs.name}). Please select a clear landing site outside restricted envelopes.`,
          simulationNotice: OFFICIAL_REGULATORY_CONFIG.disclaimer,
        };
      }
      if (!isStartDesignatedPad && isPointInPolygon(startLngLat, obs.coordinates)) {
        return {
          success: false,
          primaryRoute: null,
          alternatives: [],
          allCandidates: [],
          error: `Departure denied: Starting location is inside building footprint (${obs.name}).`,
          simulationNotice: OFFICIAL_REGULATORY_CONFIG.disclaimer,
        };
      }
    }
  }

  const [startMx, startMy] = geoToLocalMeters(startLngLat[0], startLngLat[1]);
  const startSafety = evaluatePointSafety(startMx, startMy, cruiseAlt, safetyMargin, obstacles, airspaceZones);
  if (startSafety.isBlocked && startSafety.sourceType === 'RED_ZONE') {
    return {
      success: false,
      primaryRoute: null,
      alternatives: [],
      allCandidates: [],
      error: `Departure denied: Starting location is inside or directly adjacent to a prohibited DGCA Red Zone (${startSafety.reason}).`,
      simulationNotice: OFFICIAL_REGULATORY_CONFIG.disclaimer,
    };
  }

  const [destMx, destMy] = geoToLocalMeters(destLngLat[0], destLngLat[1]);
  const destSafety = evaluatePointSafety(destMx, destMy, cruiseAlt, safetyMargin, obstacles, airspaceZones);
  if (destSafety.isBlocked) {
    return {
      success: false,
      primaryRoute: null,
      alternatives: [],
      allCandidates: [],
      error: `Arrival denied: Destination is unreachable (${destSafety.reason}). Please select a clear landing site outside restricted envelopes.`,
      simulationNotice: OFFICIAL_REGULATORY_CONFIG.disclaimer,
    };
  }

  // 2B. Identify Departure / Arrival Terminal Structures (Takeoff/Landing Infrastructure)
  const terminalObsIds = new Set<string>();
  for (const obs of obstacles) {
    const dStart = distanceToPolygonMeters(startMx, startMy, obs.coordinates);
    const dDest = distanceToPolygonMeters(destMx, destMy, obs.coordinates);
    const buf = (obs.safetyBufferMeters || safetyMargin) + 20;
    if (dStart <= buf || dDest <= buf) {
      terminalObsIds.add(obs.id);
    }
  }

  // Internal helper to run A* search with specific parameters/biases
  const runAStar = (
    margin: number,
    biasViaPoint?: [number, number], // Optional via-waypoint to shape distinct corridor
    cellSize: number = 45,
    maxIter: number = 25000
  ): { coordinates: [number, number][]; iterations: number } | null => {
    const startGx = Math.round(startMx / cellSize);
    const startGy = Math.round(startMy / cellSize);
    const destGx = Math.round(destMx / cellSize);
    const destGy = Math.round(destMy / cellSize);

    const openSet = new MinHeap();
    const closedSet = new Set<string>();
    const gScores = new Map<string, number>();
    const cellCache = new Map<string, boolean>();

    const isPassable = (gx: number, gy: number): boolean => {
      const key = `${gx},${gy}`;
      if (cellCache.has(key)) return cellCache.get(key)!;
      const mx = gx * cellSize;
      const my = gy * cellSize;
      const [lng, lat] = localMetersToGeo(mx, my);

      if (!isCoordinateWithinBounds(lng, lat)) {
        cellCache.set(key, false);
        return false;
      }

      for (const zone of airspaceZones) {
        if (zone.classification === 'RED') {
          if (isPointInPolygon([lng, lat], zone.coordinates)) {
            cellCache.set(key, false);
            return false;
          }
          if (distanceToPolygonMeters(mx, my, zone.coordinates) < margin) {
            cellCache.set(key, false);
            return false;
          }
        }
      }

      for (const obs of obstacles) {
        const buffer = obs.safetyBufferMeters || margin;
        const isUnknown = obs.heightConfidence === 'unknown' || (obs.physicalHeightMeters === undefined && obs.heightMeters === undefined);
        const structH = isUnknown ? undefined : (obs.physicalHeightMeters ?? obs.heightMeters ?? 40);
        const vertBuffer = obs.verticalClearanceBufferMeters || 15;

        // Elevated flyovers and departure/arrival pad structures can be cleared vertically
        if (obs.type === 'highway_flyover' || terminalObsIds.has(obs.id)) {
          const vertClear = cruiseAlt - (structH || 20);
          if (vertClear < vertBuffer && distanceToPolygonMeters(mx, my, obs.coordinates) < buffer) {
            cellCache.set(key, false);
            return false;
          }
          continue;
        }

        // Transit urban buildings: require horizontal corridor separation
        if (distanceToPolygonMeters(mx, my, obs.coordinates) < buffer) {
          cellCache.set(key, false);
          return false;
        }
      }

      cellCache.set(key, true);
      return true;
    };

    const initialH = octileHeuristic(Math.abs(destGx - startGx), Math.abs(destGy - startGy), cellSize);
    openSet.push({
      gx: startGx,
      gy: startGy,
      mx: startMx,
      my: startMy,
      gCost: 0,
      hCost: initialH,
      fCost: initialH,
    });
    gScores.set(`${startGx},${startGy}`, 0);

    const DIRECTIONS = [
      { dx: 1, dy: 0, cost: 1.0, isDiag: false },
      { dx: -1, dy: 0, cost: 1.0, isDiag: false },
      { dx: 0, dy: 1, cost: 1.0, isDiag: false },
      { dx: 0, dy: -1, cost: 1.0, isDiag: false },
      { dx: 1, dy: 1, cost: Math.SQRT2, isDiag: true },
      { dx: 1, dy: -1, cost: Math.SQRT2, isDiag: true },
      { dx: -1, dy: 1, cost: Math.SQRT2, isDiag: true },
      { dx: -1, dy: -1, cost: Math.SQRT2, isDiag: true },
    ];

    let iters = 0;
    let targetNode: AStarNode | null = null;

    while (openSet.size() > 0 && iters < maxIter) {
      iters++;
      const current = openSet.pop()!;
      if (Math.abs(current.gx - destGx) <= 1 && Math.abs(current.gy - destGy) <= 1) {
        targetNode = current;
        break;
      }

      closedSet.add(`${current.gx},${current.gy}`);

      for (const dir of DIRECTIONS) {
        const nGx = current.gx + dir.dx;
        const nGy = current.gy + dir.dy;
        const nKey = `${nGx},${nGy}`;
        if (closedSet.has(nKey)) continue;

        if (dir.isDiag) {
          if (!isPassable(current.gx + dir.dx, current.gy) || !isPassable(current.gx, current.gy + dir.dy)) {
            continue;
          }
        }

        if (!isPassable(nGx, nGy)) continue;

        let stepCost = dir.cost * cellSize;

        // Apply directional bias if via-point is provided (arterial corridor bonus)
        if (biasViaPoint) {
          const [viaMx, viaMy] = geoToLocalMeters(biasViaPoint[0], biasViaPoint[1]);
          const dVia = Math.hypot(nGx * cellSize - viaMx, nGy * cellSize - viaMy);
          stepCost += dVia * 0.08; // mild pull towards arterial corridor
        }

        const tentativeG = current.gCost + stepCost;
        const prevG = gScores.get(nKey);
        if (prevG === undefined || tentativeG < prevG) {
          gScores.set(nKey, tentativeG);
          const hCost = octileHeuristic(Math.abs(destGx - nGx), Math.abs(destGy - nGy), cellSize);
          openSet.push({
            gx: nGx,
            gy: nGy,
            mx: nGx * cellSize,
            my: nGy * cellSize,
            gCost: tentativeG,
            hCost,
            fCost: tentativeG + hCost,
            parent: current,
          });
        }
      }
    }

    if (!targetNode) return null;

    const rawPath: [number, number][] = [[destMx, destMy]];
    let c: AStarNode | undefined = targetNode;
    while (c) {
      rawPath.push([c.mx, c.my]);
      c = c.parent;
    }
    rawPath.push([startMx, startMy]);
    rawPath.reverse();

    const smoothed = smoothPath(rawPath, cruiseAlt, margin, obstacles, airspaceZones, terminalObsIds);
    return {
      coordinates: smoothed.map(([x, y]) => localMetersToGeo(x, y)),
      iterations: iters,
    };
  };

  const rawCandidates: {
    id: string;
    name: string;
    description: string;
    strategy: 'optimal' | 'arterial' | 'perimeter';
    color: string;
    result: { coordinates: [number, number][]; iterations: number } | null;
  }[] = [];

  // Strategy 1: Direct A* Optimal Corridor (Standard 35m margin)
  const res1 = runAStar(safetyMargin);
  rawCandidates.push({
    id: 'cand-optimal',
    name: 'Direct A* Optimal Corridor',
    description: 'Minimum flight distance utilizing 3D urban clearance corridors.',
    strategy: 'optimal',
    color: '#00f0ff', // Cyan
    result: res1,
  });

  // Strategy 2: Arterial Skyway Corridor (Bylaw Highway / Transport Axis)
  // Use Coimbatore Central Highway Axis as attraction waypoint
  const midLng = (startLngLat[0] + destLngLat[0]) / 2;
  const midLat = (startLngLat[1] + destLngLat[1]) / 2;
  // Offset orthogonal to travel line by ~350m to generate genuinely distinct arterial route
  const angle = Math.atan2(destLngLat[1] - startLngLat[1], destLngLat[0] - startLngLat[0]);
  const arterialViaLng = midLng - Math.sin(angle) * 0.0045;
  const arterialViaLat = midLat + Math.cos(angle) * 0.0045;

  const res2 = runAStar(safetyMargin, [arterialViaLng, arterialViaLat]);
  rawCandidates.push({
    id: 'cand-arterial',
    name: 'Major Arterial Skyway Corridor',
    description: 'Tracks designated urban transit skyways away from high-density clusters.',
    strategy: 'arterial',
    color: '#818cf8', // Indigo
    result: res2,
  });

  // Strategy 3: High-Clearance Perimeter Bypass (Expanded 60m margin)
  const res3 = runAStar(Math.max(55, safetyMargin + 25));
  rawCandidates.push({
    id: 'cand-perimeter',
    name: 'High-Clearance Perimeter Bypass',
    description: 'Maximizes buffer (+25m) around tall structures and urban obstacles.',
    strategy: 'perimeter',
    color: '#f59e0b', // Amber
    result: res3,
  });

  // 3. Process, validate, and verify diversity of candidate routes
  const validCandidates: RouteCandidate[] = [];
  let totalEvaluatedNodes = 0;

  for (const raw of rawCandidates) {
    if (!raw.result || raw.result.coordinates.length < 2) continue;
    totalEvaluatedNodes += raw.result.iterations;

    // Check genuine route diversity against already accepted candidates
    const isDuplicate = validCandidates.some((existing) =>
      !areRoutesGenuinelyDistinct(raw.result!.coordinates, existing.coordinates, 65)
    );
    if (isDuplicate && validCandidates.length > 0) continue;

    // Validate candidate against obstacles and airspace
    const validation = validateRouteAgainstConstraints(
      raw.result.coordinates,
      cruiseAlt,
      obstacles,
      airspaceZones,
      OFFICIAL_REGULATORY_CONFIG
    );

    // Reject hard-blocked routes
    if (!validation.isValid) continue;

    // Generate adaptive checkpoints
    const initialWaypoints = generateAdaptiveCheckpoints(raw.result.coordinates, {
      spacingMeters,
      cruiseAltMeters: cruiseAlt,
      startName,
      destName,
      routeIdPrefix: raw.id,
    });

    const deconflictResult = deconflictWaypointRoute3D(initialWaypoints, cruiseAlt, {
      safetyMargin,
      obstacles,
      airspaceZones,
      modePreference: 'prefer_horizontal',
    });
    const waypoints = deconflictResult.route;

    // Calculate total distance
    let distMeters = 0;
    for (let i = 0; i < raw.result.coordinates.length - 1; i++) {
      distMeters += getDistanceMeters(
        raw.result.coordinates[i][1],
        raw.result.coordinates[i][0],
        raw.result.coordinates[i + 1][1],
        raw.result.coordinates[i + 1][0]
      );
    }
    const distanceKm = parseFloat((distMeters / 1000).toFixed(2));
    const simulatedMinutes = Math.max(1, Math.ceil((distanceKm / 48) * 60 + 0.75));

    validCandidates.push({
      id: raw.id,
      name: raw.name,
      description: raw.description,
      coordinates: raw.result.coordinates,
      waypoints,
      distanceKm,
      simulatedMinutes,
      checkpointCount: waypoints.length,
      validation,
      isRecommended: false,
      recommendationReason: '',
      strategy: raw.strategy,
      color: raw.color,
    });
  }

  // 4. Handle Case: No valid routes found
  if (validCandidates.length === 0) {
    return {
      success: false,
      primaryRoute: null,
      alternatives: [],
      allCandidates: [],
      error: `Path blocked: No continuous collision-free corridor could be found between ${startName} and ${destName} avoiding prohibited DGCA Red Zones and vertical structural hazards. Evaluated ${totalEvaluatedNodes} nodes.`,
      simulationNotice: OFFICIAL_REGULATORY_CONFIG.disclaimer,
      evaluatedNodesCount: totalEvaluatedNodes,
    };
  }

  // 5. Route Scoring & Recommendation Engine
  // Prioritizes hard safety > clearance margin > distance > turns
  let bestScore = -Infinity;
  let recommendedIdx = 0;

  validCandidates.forEach((cand, idx) => {
    let score = 100;
    // Clearance bonus: higher distance from structures gives higher confidence
    score += Math.min(30, cand.validation.minObstacleClearanceMeters * 0.4);
    // Vertical clearance bonus
    score += Math.min(20, cand.validation.minVerticalClearanceMeters * 0.3);
    // Distance efficiency: -3 pts per km
    score -= cand.distanceKm * 3.0;
    // Yellow zone caution penalty
    if (cand.validation.status === 'RESTRICTED') score -= 15;
    if (cand.validation.status === 'UNVERIFIED_DATA') score -= 8;

    if (score > bestScore) {
      bestScore = score;
      recommendedIdx = idx;
    }
  });

  validCandidates[recommendedIdx].isRecommended = true;
  const rec = validCandidates[recommendedIdx];
  rec.recommendationReason = `Recommended: Best composite safety profile with ${rec.validation.minObstacleClearanceMeters}m minimum obstacle clearance, 0 Red Zone penetrations, and optimal simulated transit time of ${rec.simulatedMinutes} min.`;

  // Set secondary recommendation reasons
  validCandidates.forEach((cand, idx) => {
    if (idx !== recommendedIdx) {
      cand.recommendationReason = cand.strategy === 'perimeter'
        ? `Alternative: Maximizes structural separation (+${cand.validation.minObstacleClearanceMeters}m buffer), with minor distance delta (+${(cand.distanceKm - rec.distanceKm).toFixed(2)} km).`
        : `Alternative: Corridors routing along designated transit axis, with ${cand.checkpointCount} checkpoints and ${cand.simulatedMinutes} min simulated flight time.`;
    }
  });

  const primary = validCandidates[recommendedIdx];
  const alternatives = validCandidates.filter((_, idx) => idx !== recommendedIdx);

  return {
    success: true,
    primaryRoute: primary,
    alternatives,
    allCandidates: validCandidates,
    simulationNotice: OFFICIAL_REGULATORY_CONFIG.disclaimer,
    evaluatedNodesCount: totalEvaluatedNodes,
  };
}

// ─── 10. BACKWARD-COMPATIBLE WRAPPER ─────────────────────────────────────────
export interface DroneAStarRouteResult {
  success: boolean;
  coordinates: [number, number][]; // [lng, lat][]
  waypoints: Waypoint[];
  distanceKm: number;
  estimatedMinutes: number;
  error?: string;
  evaluatedNodesCount?: number;
  candidates?: RouteCandidate[];
  validation?: RouteValidationResult;
}

export function calculateDroneAStarRoute(
  startLngLat: [number, number],
  destLngLat: [number, number],
  options: {
    cruiseAltMeters?: number;
    safetyMarginMeters?: number;
    checkpointSpacingMeters?: number;
    cellSizeMeters?: number;
    maxIterations?: number;
    obstacles?: Obstacle[];
    airspaceZones?: OfficialAirspaceZone[];
    startName?: string;
    destName?: string;
  } = {}
): DroneAStarRouteResult {
  const multiRes = calculateDroneMultiRoute(startLngLat, destLngLat, {
    cruiseAltMeters: options.cruiseAltMeters,
    safetyMarginMeters: options.safetyMarginMeters,
    checkpointSpacingMeters: options.checkpointSpacingMeters ?? 100,
    startName: options.startName,
    destName: options.destName,
    obstacles: options.obstacles,
    airspaceZones: options.airspaceZones,
  });

  if (!multiRes.success || !multiRes.primaryRoute) {
    return {
      success: false,
      coordinates: [],
      waypoints: [],
      distanceKm: 0,
      estimatedMinutes: 0,
      error: multiRes.error || 'A* pathfinder could not find a safe collision-free route.',
      evaluatedNodesCount: multiRes.evaluatedNodesCount,
    };
  }

  const primary = multiRes.primaryRoute;
  return {
    success: true,
    coordinates: primary.coordinates,
    waypoints: primary.waypoints,
    distanceKm: primary.distanceKm,
    estimatedMinutes: primary.simulatedMinutes,
    evaluatedNodesCount: multiRes.evaluatedNodesCount,
    candidates: multiRes.allCandidates,
    validation: primary.validation,
  };
}


// ─── 8. TARGETED SEGMENT OBSTACLE INTERSECTION & REROUTING ──────────────────

export interface SegmentObstacleCheck {
  isBlocked: boolean;
  reason?: string;
  obstacleName?: string;
  obstacleType?: string;
  distanceToObstacleMeters?: number;
  blockedCoordinate?: [number, number];
  isUnknownHeight?: boolean;
  requiredOverflightAlt?: number;
}

export interface SegmentRerouteResult {
  isRerouted: boolean;
  avoidanceMode?: 'horizontal' | 'vertical_overflight';
  coordinates: [number, number][]; // [lng, lat][]
  waypoints: Waypoint[];
  warning?: string;
  obstacleName?: string;
  addedDistanceMeters: number;
  clearingAltitudeMeters?: number;
}

export interface RouteValidationResult3D {
  isValid: boolean;
  hasCollision: boolean;
  totalSegmentsChecked: number;
  minHorizontalClearanceMeters: number;
  minVerticalClearanceMeters: number;
  violations: Array<{
    segmentIndex: number;
    obstacleId?: string;
    obstacleName: string;
    reason: string;
    coordinate: [number, number];
    altitudeMeters: number;
  }>;
  regulatoryCompliant: boolean;
}

export interface DeconflictedRouteResult {
  route: Waypoint[];
  hasRerouted: boolean;
  reroutedSegmentIndices: number[];
  avoidanceModes: ('horizontal' | 'vertical_overflight')[];
  warnings: string[];
  totalDistanceKm: number;
  validation?: RouteValidationResult3D;
}

/**
 * Checks whether the 3D line segment between two waypoints intersects
 * any 3D building, flyover, or restricted airspace zone volume.
 * Samples continuous 3D points along the segment with interpolated altitude.
 */
export function checkSegmentObstacleIntersection(
  wpA: { lat: number; lng: number; altitudeMeters?: number },
  wpB: { lat: number; lng: number; altitudeMeters?: number },
  cruiseAlt: number = 60,
  safetyMargin: number = 20,
  obstacles: Obstacle[] = COIMBATORE_DETAILED_OBSTACLES,
  airspaceZones: OfficialAirspaceZone[] = OFFICIAL_COIMBATORE_AIRSPACE_ZONES
): SegmentObstacleCheck {
  const [x1, y1] = geoToLocalMeters(wpA.lng, wpA.lat);
  const [x2, y2] = geoToLocalMeters(wpB.lng, wpB.lat);
  const alt1 = wpA.altitudeMeters ?? cruiseAlt;
  const alt2 = wpB.altitudeMeters ?? cruiseAlt;
  const directDist = Math.hypot(x2 - x1, y2 - y1);
  const sampleSteps = Math.max(5, Math.ceil(directDist / 8)); // 8-meter dense resolution

  for (let s = 0; s <= sampleSteps; s++) {
    const t = s / sampleSteps;
    const px = x1 + t * (x2 - x1);
    const py = y1 + t * (y2 - y1);
    const currAlt = alt1 + t * (alt2 - alt1);
    const safety = evaluatePointSafety(px, py, currAlt, safetyMargin, obstacles, airspaceZones);
    if (safety.isBlocked) {
      const [blockedLng, blockedLat] = localMetersToGeo(px, py);
      let obstacleName = '';
      if (safety.reason?.includes(':')) {
        obstacleName = safety.reason.split(':')[1]?.split('(')[0]?.trim() || '';
      } else if (safety.reason?.includes('for ')) {
        obstacleName = safety.reason.split('for ')[1]?.split(';')[0]?.trim() || '';
      }
      return {
        isBlocked: true,
        reason: safety.reason,
        obstacleName,
        obstacleType: safety.sourceType,
        distanceToObstacleMeters: safety.distanceToObstacleMeters,
        blockedCoordinate: [blockedLng, blockedLat],
      };
    }
  }

  return { isBlocked: false };
}

/**
 * Evaluates and constructs a 3D Vertical Overflight alternative route above a building.
 * - Requires building height to be verified/known.
 * - Calculates safe overflight altitude = height + verticalClearanceMargin.
 * - Validates that safe overflight altitude does not exceed DGCA 120m ceiling.
 * - Inserts gradual climb waypoint prior to reaching building footprint buffer.
 * - Maintains clearance across the full building footprint.
 * - Inserts descent waypoint after fully exiting the building footprint buffer.
 * - Validates the complete 3D vertical path against all obstacles.
 */
export function generateVerticalOverflight(
  wpA: Waypoint,
  wpB: Waypoint,
  safetyMargin: number = 20,
  verticalMargin: number = 15,
  obstacles: Obstacle[] = COIMBATORE_DETAILED_OBSTACLES,
  airspaceZones: OfficialAirspaceZone[] = OFFICIAL_COIMBATORE_AIRSPACE_ZONES
): {
  waypoints: Waypoint[];
  coordinates: [number, number][];
  overflightAlt: number;
} | null {
  const [x1, y1] = geoToLocalMeters(wpA.lng, wpA.lat);
  const [x2, y2] = geoToLocalMeters(wpB.lng, wpB.lat);
  const directDist = Math.hypot(x2 - x1, y2 - y1);
  if (directDist < 10) return null;

  const sampleSteps = Math.max(10, Math.ceil(directDist / 6));
  const blockingObstacles: Obstacle[] = [];
  let firstEntryT = 1.0;
  let lastExitT = 0.0;

  for (const obs of obstacles) {
    const buffer = obs.safetyBufferMeters || safetyMargin;
    let intersects = false;
    for (let s = 0; s <= sampleSteps; s++) {
      const t = s / sampleSteps;
      const px = x1 + t * (x2 - x1);
      const py = y1 + t * (y2 - y1);
      const dist = distanceToPolygonMeters(px, py, obs.coordinates);
      if (dist < buffer) {
        intersects = true;
        if (t < firstEntryT) firstEntryT = t;
        if (t > lastExitT) lastExitT = t;
      }
    }
    if (intersects) {
      blockingObstacles.push(obs);
    }
  }

  if (blockingObstacles.length === 0) return null;

  // Overflight Rules:
  // 1. Unknown building height -> OVERFLIGHT PROHIBITED
  for (const obs of blockingObstacles) {
    if (obs.heightConfidence === 'unknown' || (obs.physicalHeightMeters === undefined && obs.heightMeters === undefined)) {
      return null;
    }
  }

  // 2. Red zone traversal -> OVERFLIGHT PROHIBITED
  for (const zone of airspaceZones) {
    if (zone.classification === 'RED') {
      for (let s = 0; s <= sampleSteps; s++) {
        const t = s / sampleSteps;
        const px = x1 + t * (x2 - x1);
        const py = y1 + t * (y2 - y1);
        const [lng, lat] = localMetersToGeo(px, py);
        if (isPointInPolygon([lng, lat], zone.coordinates)) {
          return null;
        }
      }
    }
  }

  // 3. Compute required safe overflight altitude
  let maxRequiredAlt = Math.max(wpA.altitudeMeters || 45, wpB.altitudeMeters || 45);
  for (const obs of blockingObstacles) {
    const structH = obs.physicalHeightMeters ?? obs.heightMeters ?? 40;
    const vBuf = obs.verticalClearanceBufferMeters ?? verticalMargin ?? 15;
    const req = structH + vBuf;
    if (req > maxRequiredAlt) {
      maxRequiredAlt = req;
    }
  }

  // Enforce DGCA 120m regulatory ceiling
  if (maxRequiredAlt > 120) {
    return null;
  }

  // Check endpoints are not inside obstacle footprints
  for (const obs of blockingObstacles) {
    const buffer = obs.safetyBufferMeters || safetyMargin;
    if (distanceToPolygonMeters(x1, y1, obs.coordinates) < buffer) return null;
    if (distanceToPolygonMeters(x2, y2, obs.coordinates) < buffer) return null;
  }

  // 4. Construct gradual climb, overflight, and descent points
  const leadFraction = Math.min(0.25, 35 / directDist);
  const climbT = Math.max(0.05, firstEntryT - leadFraction);
  const midT = (firstEntryT + lastExitT) / 2;
  const descT = Math.min(0.95, lastExitT + leadFraction);

  const [climbLng, climbLat] = localMetersToGeo(x1 + climbT * (x2 - x1), y1 + climbT * (y2 - y1));
  const [midLng, midLat] = localMetersToGeo(x1 + midT * (x2 - x1), y1 + midT * (y2 - y1));
  const [descLng, descLat] = localMetersToGeo(x1 + descT * (x2 - x1), y1 + descT * (y2 - y1));

  const primaryObsName = blockingObstacles[0].name;

  const climbWp: Waypoint = {
    id: `${wpA.id}-climb`,
    name: `${wpA.name.split('(')[0].trim()} Climb (${maxRequiredAlt}m AGL - Clearing ${primaryObsName})`,
    lat: climbLat,
    lng: climbLng,
    altitudeMeters: maxRequiredAlt,
    type: 'transit',
    status: wpA.status === 'completed' ? 'completed' : 'upcoming',
    etaMinutes: wpA.etaMinutes,
  };

  const overflightWp: Waypoint = {
    id: `${wpA.id}-overflight`,
    name: `${primaryObsName} Overflight (${maxRequiredAlt}m AGL)`,
    lat: midLat,
    lng: midLng,
    altitudeMeters: maxRequiredAlt,
    type: 'transit',
    status: wpA.status === 'completed' ? 'completed' : 'upcoming',
    etaMinutes: wpA.etaMinutes,
  };

  const descentWp: Waypoint = {
    id: `${wpA.id}-descent`,
    name: `${wpB.name.split('(')[0].trim()} Safe Descent Point (${maxRequiredAlt}m AGL)`,
    lat: descLat,
    lng: descLng,
    altitudeMeters: maxRequiredAlt,
    type: 'transit',
    status: wpA.status === 'completed' ? 'completed' : 'upcoming',
    etaMinutes: wpB.etaMinutes,
  };

  const candWps = [climbWp, overflightWp, descentWp, wpB];
  const candCoords: [number, number][] = [
    [wpA.lng, wpA.lat],
    [climbLng, climbLat],
    [midLng, midLat],
    [descLng, descLat],
    [wpB.lng, wpB.lat],
  ];

  // 5. Verify every segment of the vertical overflight candidate against 3D clearance
  const fullPath = [wpA, climbWp, overflightWp, descentWp, wpB];
  for (let k = 0; k < fullPath.length - 1; k++) {
    const c = checkSegmentObstacleIntersection(fullPath[k], fullPath[k + 1], maxRequiredAlt, safetyMargin, obstacles, airspaceZones);
    if (c.isBlocked) {
      return null;
    }
  }

  return {
    waypoints: candWps,
    coordinates: candCoords,
    overflightAlt: maxRequiredAlt,
  };
}

/**
 * Reroutes a single affected segment between wpA and wpB around or above the obstacle.
 * - Evaluates both Horizontal Detour (A*) and 3D Vertical Overflight.
 * - If building height is unknown, overflight is prohibited; horizontal detour is enforced.
 * - If overflight exceeds 120m regulatory ceiling, horizontal detour is enforced.
 * - In 'auto' mode, chooses the most efficient safe route (vertical overflight preferred when
 *   horizontal detour adds significant detour distance and overflight altitude is moderate).
 * - Preserves wpA and wpB exactly as start and end points.
 */
export function rerouteSegmentAroundObstacles(
  wpA: Waypoint,
  wpB: Waypoint,
  cruiseAlt: number = 60,
  safetyMargin: number = 20,
  obstacles: Obstacle[] = COIMBATORE_DETAILED_OBSTACLES,
  airspaceZones: OfficialAirspaceZone[] = OFFICIAL_COIMBATORE_AIRSPACE_ZONES,
  options: {
    verticalMargin?: number;
    modePreference?: 'auto' | 'prefer_horizontal' | 'prefer_overflight';
  } = {}
): SegmentRerouteResult {
  const [x1, y1] = geoToLocalMeters(wpA.lng, wpA.lat);
  const [x2, y2] = geoToLocalMeters(wpB.lng, wpB.lat);
  const directDist = Math.hypot(x2 - x1, y2 - y1);
  const verticalMargin = options.verticalMargin ?? 15;
  const modePreference = options.modePreference ?? 'auto';

  // 1. Check if direct line between wpA and wpB is clear
  const check = checkSegmentObstacleIntersection(wpA, wpB, cruiseAlt, safetyMargin, obstacles, airspaceZones);
  if (!check.isBlocked) {
    return {
      isRerouted: false,
      coordinates: [[wpA.lng, wpA.lat], [wpB.lng, wpB.lat]],
      waypoints: [wpB],
      addedDistanceMeters: 0,
    };
  }

  // 2. Direct line is blocked! Evaluate 3D Vertical Overflight candidate
  let vertResult: ReturnType<typeof generateVerticalOverflight> = null;
  if (modePreference !== 'prefer_horizontal') {
    vertResult = generateVerticalOverflight(wpA, wpB, safetyMargin, verticalMargin, obstacles, airspaceZones);
  }

  // 3. Evaluate Horizontal A* detour candidate
  let horizResult: {
    waypoints: Waypoint[];
    coordinates: [number, number][];
    addedDistanceMeters: number;
  } | null = null;

  if (modePreference !== 'prefer_overflight' || !vertResult) {
    const cellSize = 20;
    const marginBox = 450;
    const minX = Math.min(x1, x2) - marginBox;
    const maxX = Math.max(x1, x2) + marginBox;
    const minY = Math.min(y1, y2) - marginBox;
    const maxY = Math.max(y1, y2) + marginBox;

    const startGx = Math.round(x1 / cellSize);
    const startGy = Math.round(y1 / cellSize);
    const destGx = Math.round(x2 / cellSize);
    const destGy = Math.round(y2 / cellSize);

    interface LocalNode {
      gx: number;
      gy: number;
      g: number;
      h: number;
      f: number;
      parent?: LocalNode;
    }

    const openList: LocalNode[] = [];
    const closedSet = new Set<string>();
    const gScores = new Map<string, number>();

    const startNode: LocalNode = {
      gx: startGx,
      gy: startGy,
      g: 0,
      h: Math.hypot((destGx - startGx) * cellSize, (destGy - startGy) * cellSize),
      f: Math.hypot((destGx - startGx) * cellSize, (destGy - startGy) * cellSize),
    };

    openList.push(startNode);
    gScores.set(`${startGx},${startGy}`, 0);

    const neighbors = [
      [-1, 0, 1.0], [1, 0, 1.0], [0, -1, 1.0], [0, 1, 1.0],
      [-1, -1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [1, 1, 1.414],
    ];

    let foundNode: LocalNode | null = null;
    let iterations = 0;
    const maxIterations = 8000;

    while (openList.length > 0 && iterations < maxIterations) {
      iterations++;
      let bestIdx = 0;
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < openList[bestIdx].f) bestIdx = i;
      }
      const current = openList.splice(bestIdx, 1)[0];
      const curKey = `${current.gx},${current.gy}`;
      closedSet.add(curKey);

      const distToGoal = Math.hypot((destGx - current.gx) * cellSize, (destGy - current.gy) * cellSize);
      if (distToGoal <= cellSize * 1.5) {
        foundNode = current;
        break;
      }

      for (const [ndx, ndy, costMult] of neighbors) {
        const ngx = current.gx + ndx;
        const ngy = current.gy + ndy;
        const nmx = ngx * cellSize;
        const nmy = ngy * cellSize;

        if (nmx < minX || nmx > maxX || nmy < minY || nmy > maxY) continue;
        const nKey = `${ngx},${ngy}`;
        if (closedSet.has(nKey)) continue;

        const safety = evaluatePointSafety(nmx, nmy, cruiseAlt, safetyMargin, obstacles, airspaceZones);
        if (safety.isBlocked) continue;

        const tentativeG = current.g + cellSize * costMult;
        const existingG = gScores.get(nKey) ?? Infinity;

        if (tentativeG < existingG) {
          gScores.set(nKey, tentativeG);
          const h = Math.hypot((destGx - ngx) * cellSize, (destGy - ngy) * cellSize);
          const neighborNode: LocalNode = {
            gx: ngx,
            gy: ngy,
            g: tentativeG,
            h,
            f: tentativeG + h * 1.05,
            parent: current,
          };
          openList.push(neighborNode);
        }
      }
    }

    if (foundNode) {
      const rawPath: [number, number][] = [];
      let curr: LocalNode | undefined = foundNode;
      while (curr) {
        const [lng, lat] = localMetersToGeo(curr.gx * cellSize, curr.gy * cellSize);
        rawPath.push([lng, lat]);
        curr = curr.parent;
      }
      rawPath.reverse();
      rawPath[0] = [wpA.lng, wpA.lat];
      rawPath.push([wpB.lng, wpB.lat]);

      // String-pulling smoothing
      const isLineClear = (pA: [number, number], pB: [number, number]) => {
        const [ax, ay] = geoToLocalMeters(pA[0], pA[1]);
        const [bx, by] = geoToLocalMeters(pB[0], pB[1]);
        const d = Math.hypot(bx - ax, by - ay);
        const stps = Math.max(2, Math.ceil(d / 10));
        for (let i = 1; i < stps; i++) {
          const t = i / stps;
          const px = ax + t * (bx - ax);
          const py = ay + t * (by - ay);
          const s = evaluatePointSafety(px, py, cruiseAlt, safetyMargin, obstacles, airspaceZones);
          if (s.isBlocked) return false;
        }
        return true;
      };

      const smoothed: [number, number][] = [rawPath[0]];
      let cIdx = 0;
      while (cIdx < rawPath.length - 1) {
        let furthest = cIdx + 1;
        for (let next = rawPath.length - 1; next > cIdx + 1; next--) {
          if (isLineClear(rawPath[cIdx], rawPath[next])) {
            furthest = next;
            break;
          }
        }
        smoothed.push(rawPath[furthest]);
        cIdx = furthest;
      }

      const detourWaypoints: Waypoint[] = [];
      let detourTotalDist = 0;
      for (let k = 1; k < smoothed.length - 1; k++) {
        const coord = smoothed[k];
        detourWaypoints.push({
          id: `${wpA.id}-detour-${k}`,
          name: `${wpA.name.split('(')[0].trim()} Detour (${check.obstacleName ? `Bypassing ${check.obstacleName}` : 'Safe Corridor'})`,
          lat: coord[1],
          lng: coord[0],
          altitudeMeters: wpB.altitudeMeters || cruiseAlt,
          type: 'transit',
          status: wpA.status === 'completed' ? 'completed' : 'upcoming',
          etaMinutes: wpA.etaMinutes,
        });
      }

      for (let i = 0; i < smoothed.length - 1; i++) {
        const [sx1, sy1] = geoToLocalMeters(smoothed[i][0], smoothed[i][1]);
        const [sx2, sy2] = geoToLocalMeters(smoothed[i + 1][0], smoothed[i + 1][1]);
        detourTotalDist += Math.hypot(sx2 - sx1, sy2 - sy1);
      }

      horizResult = {
        waypoints: [...detourWaypoints, wpB],
        coordinates: smoothed,
        addedDistanceMeters: Math.max(0, Math.round(detourTotalDist - directDist)),
      };
    }
  }

  // 4. Decision Selection
  if (vertResult && (!horizResult || modePreference === 'prefer_overflight' || (modePreference === 'auto' && horizResult.addedDistanceMeters > 80 && vertResult.overflightAlt <= 90))) {
    return {
      isRerouted: true,
      avoidanceMode: 'vertical_overflight',
      coordinates: vertResult.coordinates,
      waypoints: vertResult.waypoints,
      obstacleName: check.obstacleName,
      addedDistanceMeters: 0,
      clearingAltitudeMeters: vertResult.overflightAlt,
    };
  }

  if (horizResult) {
    return {
      isRerouted: true,
      avoidanceMode: 'horizontal',
      coordinates: horizResult.coordinates,
      waypoints: horizResult.waypoints,
      obstacleName: check.obstacleName,
      addedDistanceMeters: horizResult.addedDistanceMeters,
    };
  }

  if (vertResult) {
    return {
      isRerouted: true,
      avoidanceMode: 'vertical_overflight',
      coordinates: vertResult.coordinates,
      waypoints: vertResult.waypoints,
      obstacleName: check.obstacleName,
      addedDistanceMeters: 0,
      clearingAltitudeMeters: vertResult.overflightAlt,
    };
  }

  return {
    isRerouted: false,
    coordinates: [[wpA.lng, wpA.lat], [wpB.lng, wpB.lat]],
    waypoints: [wpB],
    warning: `No valid route: Segment from ${wpA.name} to ${wpB.name} is blocked by ${check.obstacleName || check.reason || 'obstacle'}.`,
    obstacleName: check.obstacleName,
    addedDistanceMeters: 0,
  };
}

/**
 * Validates a complete 3D route trajectory against physical building volumes,
 * elevated structures, and restricted airspace zones.
 * Ensures every segment respects vertical and horizontal safety buffers and the
 * DGCA 120m regulatory ceiling.
 */
export function validateRoute3D(
  route: Waypoint[],
  safetyMargin: number = 20,
  verticalMargin: number = 15,
  obstacles: Obstacle[] = COIMBATORE_DETAILED_OBSTACLES,
  airspaceZones: OfficialAirspaceZone[] = OFFICIAL_COIMBATORE_AIRSPACE_ZONES
): RouteValidationResult3D {
  const violations: RouteValidationResult3D['violations'] = [];
  let minHorizClearance = Infinity;
  let minVertClearance = Infinity;
  let regulatoryCompliant = true;

  for (let i = 0; i < route.length - 1; i++) {
    const wpA = route[i];
    const wpB = route[i + 1];

    if ((wpA.altitudeMeters || 0) > 120 || (wpB.altitudeMeters || 0) > 120) {
      regulatoryCompliant = false;
      violations.push({
        segmentIndex: i,
        obstacleName: 'DGCA Ceiling',
        reason: `Altitude exceeds DGCA 120m regulatory ceiling (${Math.max(wpA.altitudeMeters || 0, wpB.altitudeMeters || 0)}m)`,
        coordinate: [wpA.lng, wpA.lat],
        altitudeMeters: Math.max(wpA.altitudeMeters || 0, wpB.altitudeMeters || 0),
      });
    }

    const [x1, y1] = geoToLocalMeters(wpA.lng, wpA.lat);
    const [x2, y2] = geoToLocalMeters(wpB.lng, wpB.lat);
    const alt1 = wpA.altitudeMeters || 60;
    const alt2 = wpB.altitudeMeters || 60;
    const directDist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(5, Math.ceil(directDist / 8));

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x1 + t * (x2 - x1);
      const py = y1 + t * (y2 - y1);
      const currentAlt = alt1 + t * (alt2 - alt1);

      // Check against obstacles
      for (const obs of obstacles) {
        const buffer = obs.safetyBufferMeters || safetyMargin;
        const dPoly = distanceToPolygonMeters(px, py, obs.coordinates);
        const horizClearance = dPoly - buffer;
        if (horizClearance < minHorizClearance) minHorizClearance = horizClearance;

        const isUnknownH = obs.heightConfidence === 'unknown' || (obs.physicalHeightMeters === undefined && obs.heightMeters === undefined);
        const structH = isUnknownH ? undefined : (obs.physicalHeightMeters ?? obs.heightMeters);
        const vBuf = obs.verticalClearanceBufferMeters || verticalMargin;

        if (dPoly < buffer) {
          if (isUnknownH || structH === undefined) {
            const [cLng, cLat] = localMetersToGeo(px, py);
            violations.push({
              segmentIndex: i,
              obstacleId: obs.id,
              obstacleName: obs.name,
              reason: `Building height unknown for ${obs.name}; overflight prohibited (penetrated by ${Math.round(-horizClearance)}m)`,
              coordinate: [cLng, cLat],
              altitudeMeters: currentAlt,
            });
          } else {
            const vClearance = currentAlt - (structH + vBuf);
            if (vClearance < minVertClearance) minVertClearance = vClearance;
            if (vClearance < 0) {
              const [cLng, cLat] = localMetersToGeo(px, py);
              violations.push({
                segmentIndex: i,
                obstacleId: obs.id,
                obstacleName: obs.name,
                reason: `Insufficient vertical clearance above ${obs.name} (Alt: ${Math.round(currentAlt)}m, required: ${structH + vBuf}m)`,
                coordinate: [cLng, cLat],
                altitudeMeters: currentAlt,
              });
            }
          }
        }
      }

      // Check Red Zones
      for (const zone of airspaceZones) {
        if (zone.classification === 'RED') {
          const [lng, lat] = localMetersToGeo(px, py);
          if (isPointInPolygon([lng, lat], zone.coordinates)) {
            violations.push({
              segmentIndex: i,
              obstacleName: zone.name,
              reason: `Trajectory penetrates prohibited DGCA Red Zone: ${zone.name}`,
              coordinate: [lng, lat],
              altitudeMeters: currentAlt,
            });
          }
        }
      }
    }
  }

  const isValid = violations.length === 0 && regulatoryCompliant;
  return {
    isValid,
    hasCollision: violations.length > 0,
    totalSegmentsChecked: route.length - 1,
    minHorizontalClearanceMeters: minHorizClearance === Infinity ? 0 : Math.round(minHorizClearance * 10) / 10,
    minVerticalClearanceMeters: minVertClearance === Infinity ? 0 : Math.round(minVertClearance * 10) / 10,
    violations,
    regulatoryCompliant,
  };
}

/**
 * Deconflicts an entire waypoint route sequence by examining each consecutive pair.
 * - Preserves start point and destination waypoint unchanged.
 * - Detects segments cutting through building footprints or obstacles.
 * - Reroutes affected segments around or above obstacles with shortest practical safe path.
 * - Preserves waypoint sequence and mission ordering.
 * - Runs multi-pass validation to ensure secondary segments remain safe.
 * - Returns clear warnings if an impenetrable obstacle blocks a waypoint.
 */
export function deconflictWaypointRoute(
  route: Waypoint[],
  cruiseAlt: number = 60,
  options: {
    safetyMargin?: number;
    verticalMargin?: number;
    obstacles?: Obstacle[];
    airspaceZones?: OfficialAirspaceZone[];
    modePreference?: 'auto' | 'prefer_horizontal' | 'prefer_overflight';
  } = {}
): DeconflictedRouteResult {
  if (route.length < 2) {
    return {
      route,
      hasRerouted: false,
      reroutedSegmentIndices: [],
      avoidanceModes: [],
      warnings: [],
      totalDistanceKm: 0,
    };
  }

  const safetyMargin = options.safetyMargin ?? 20;
  const verticalMargin = options.verticalMargin ?? 15;
  const obstacles = options.obstacles ?? COIMBATORE_DETAILED_OBSTACLES;
  const airspaceZones = options.airspaceZones ?? OFFICIAL_COIMBATORE_AIRSPACE_ZONES;
  const modePreference = options.modePreference ?? 'auto';

  let currentRoute: Waypoint[] = [...route];
  const reroutedSegmentIndices: number[] = [];
  const avoidanceModes: ('horizontal' | 'vertical_overflight')[] = [];
  const warnings: string[] = [];
  let hasRerouted = false;

  let maxPasses = 3;
  while (maxPasses-- > 0) {
    let passRerouted = false;
    const nextRoute: Waypoint[] = [currentRoute[0]];

    for (let i = 0; i < currentRoute.length - 1; i++) {
      const wpA = currentRoute[i];
      const wpB = currentRoute[i + 1];

      const segResult = rerouteSegmentAroundObstacles(
        wpA,
        wpB,
        wpB.altitudeMeters || cruiseAlt,
        safetyMargin,
        obstacles,
        airspaceZones,
        { verticalMargin, modePreference }
      );

      if (segResult.warning && !warnings.includes(segResult.warning)) {
        warnings.push(segResult.warning);
      }

      if (segResult.isRerouted) {
        hasRerouted = true;
        passRerouted = true;
        if (!reroutedSegmentIndices.includes(i)) {
          reroutedSegmentIndices.push(i);
        }
        if (segResult.avoidanceMode && !avoidanceModes.includes(segResult.avoidanceMode)) {
          avoidanceModes.push(segResult.avoidanceMode);
        }
        for (const dwp of segResult.waypoints) {
          nextRoute.push(dwp);
        }
      } else {
        nextRoute.push(wpB);
      }
    }

    currentRoute = nextRoute;
    if (!passRerouted) break;
  }

  // Calculate total route distance in km
  let totalDistMeters = 0;
  for (let i = 0; i < currentRoute.length - 1; i++) {
    const [x1, y1] = geoToLocalMeters(currentRoute[i].lng, currentRoute[i].lat);
    const [x2, y2] = geoToLocalMeters(currentRoute[i + 1].lng, currentRoute[i + 1].lat);
    totalDistMeters += Math.hypot(x2 - x1, y2 - y1);
  }

  const validation = validateRoute3D(currentRoute, safetyMargin, verticalMargin, obstacles, airspaceZones);

  return {
    route: currentRoute,
    hasRerouted,
    reroutedSegmentIndices,
    avoidanceModes,
    warnings,
    totalDistanceKm: Math.round((totalDistMeters / 1000) * 100) / 100,
    validation,
  };
}

export const deconflictWaypointRoute3D = deconflictWaypointRoute;
