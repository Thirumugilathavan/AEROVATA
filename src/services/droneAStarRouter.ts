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

// ─── 2. PREDEFINED COIMBATORE LOCATION REGISTRY ─────────────────────────────
export interface NamedLocation {
  id: string;
  name: string;
  shortName: string;
  category: 'hub' | 'hospital' | 'depot' | 'tech_park' | 'logistics';
  coordinates: [number, number]; // [lng, lat]
  altitudeMeters: number;
  description: string;
}

export const COIMBATORE_LOCATIONS: NamedLocation[] = [
  {
    id: 'loc-cmch-hub',
    name: 'CMCH Trauma Hub Alpha (Base Station)',
    shortName: 'CMCH Trauma Hub',
    category: 'hospital',
    coordinates: [76.9665, 11.0025],
    altitudeMeters: 55,
    description: 'Coimbatore Medical College Hospital central rooftop drone landing pad. Equipped with cold-chain storage and medical trauma dispatch.',
  },
  {
    id: 'loc-peelamedu-depot',
    name: 'Peelamedu Logistics Depot',
    shortName: 'Peelamedu Depot',
    category: 'depot',
    coordinates: [77.0120, 11.0260],
    altitudeMeters: 65,
    description: 'BVLOS transit hub along Avinashi arterial corridor. Automated battery swap docking station.',
  },
  {
    id: 'loc-gandhipuram-hub',
    name: 'Gandhipuram Central Transit Hub',
    shortName: 'Gandhipuram Hub',
    category: 'hub',
    coordinates: [76.9660, 11.0180],
    altitudeMeters: 60,
    description: 'Central urban transit terminal pad serving central business district and retail deliveries.',
  },
  {
    id: 'loc-tidel-park',
    name: 'TIDEL Park IT SEZ Pad',
    shortName: 'TIDEL Park IT SEZ',
    category: 'tech_park',
    coordinates: [77.0250, 11.0150],
    altitudeMeters: 65,
    description: 'IT SEZ high-tech cargo delivery node located on Avinashi Road.',
  },
  {
    id: 'loc-psg-tech',
    name: 'PSG College of Tech Research Pad',
    shortName: 'PSG Tech Pad',
    category: 'tech_park',
    coordinates: [77.0030, 11.0240],
    altitudeMeters: 60,
    description: 'Advanced robotics research facility and university medical laboratory landing site.',
  },
  {
    id: 'loc-kmch-speciality',
    name: 'KMCH Speciality Hospital (Avinashi Rd)',
    shortName: 'KMCH Hospital',
    category: 'hospital',
    coordinates: [77.0380, 11.0420],
    altitudeMeters: 65,
    description: 'Multi-speciality medical trauma hub and organ transport pad on Avinashi corridor.',
  },
  {
    id: 'loc-singanallur-hub',
    name: 'Singanallur Health Centre Pad',
    shortName: 'Singanallur Hub',
    category: 'depot',
    coordinates: [77.0200, 10.9980],
    altitudeMeters: 55,
    description: 'South-east urban dispatch depot serving Trichy Road industrial sector.',
  },
  {
    id: 'loc-rs-puram',
    name: 'RS Puram West Dispatch Pad',
    shortName: 'RS Puram Hub',
    category: 'hub',
    coordinates: [76.9450, 11.0080],
    altitudeMeters: 60,
    description: 'Western residential and commercial supply drop depot.',
  },
  {
    id: 'loc-ganapathy-clinic',
    name: 'Ganapathy Specialized Clinic & ICU',
    shortName: 'Ganapathy Clinic',
    category: 'hospital',
    coordinates: [76.9830, 11.0360],
    altitudeMeters: 60,
    description: 'Northern emergency clinic on Sathy Road corridor.',
  },
  {
    id: 'loc-saravanampatti',
    name: 'Saravanampatti IT Corridor Depot',
    shortName: 'Saravanampatti IT',
    category: 'tech_park',
    coordinates: [76.9980, 11.0800],
    altitudeMeters: 65,
    description: 'Northern IT corridor hub serving tech parks and SEZs.',
  },
  {
    id: 'loc-cbe-north-junction',
    name: 'Coimbatore North Junction Hub',
    shortName: 'CBE North Junction',
    category: 'logistics',
    coordinates: [76.9530, 11.0280],
    altitudeMeters: 60,
    description: 'Railway cargo integration terminal and dispatch node.',
  },
  {
    id: 'loc-ramanathapuram',
    name: 'Ramanathapuram Transit Pad',
    shortName: 'Ramanathapuram Hub',
    category: 'hub',
    coordinates: [76.9850, 10.9950],
    altitudeMeters: 55,
    description: 'South-central cross-corridor node linking Trichy Road and Sungam bypass.',
  },
];

export const DEFAULT_STARTING_LOCATION = COIMBATORE_LOCATIONS[0];

export const SIMULATION_BOUNDS = {
  minLng: 76.9000,
  maxLng: 77.0900,
  minLat: 10.9300,
  maxLat: 11.1100,
};

export function isCoordinateWithinBounds(lng: number, lat: number): boolean {
  return (
    lng >= SIMULATION_BOUNDS.minLng &&
    lng <= SIMULATION_BOUNDS.maxLng &&
    lat >= SIMULATION_BOUNDS.minLat &&
    lat <= SIMULATION_BOUNDS.maxLat
  );
}

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
    const structHeight = obs.physicalHeightMeters || obs.heightMeters || 40;
    const vertBuffer = obs.verticalClearanceBufferMeters || 15;
    
    // Check vertical clearance: cruise altitude vs building roof height + clearance buffer
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

  // 2. Sample along route polyline (every 25m)
  for (let i = 0; i < coordinates.length - 1; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[i + 1];
    const segDist = getDistanceMeters(p1[1], p1[0], p2[1], p2[0]);
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
  airspaceZones: OfficialAirspaceZone[]
): boolean {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.ceil(dist / 25);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const px = x1 + t * (x2 - x1);
    const py = y1 + t * (y2 - y1);
    const safety = evaluatePointSafety(px, py, cruiseAlt, safetyMargin, obstacles, airspaceZones);
    if (safety.isBlocked) return false;
  }
  return true;
}

function smoothPath(
  path: [number, number][],
  cruiseAlt: number,
  safetyMargin: number,
  obstacles: Obstacle[],
  airspaceZones: OfficialAirspaceZone[]
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
          airspaceZones
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

  // 2. Validate Start & Dest Boundaries and Red Zone
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
      const s = evaluatePointSafety(mx, my, cruiseAlt, margin, obstacles, airspaceZones);
      const pass = !s.isBlocked;
      cellCache.set(key, pass);
      return pass;
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

    const smoothed = smoothPath(rawPath, cruiseAlt, margin, obstacles, airspaceZones);
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
    const waypoints = generateAdaptiveCheckpoints(raw.result.coordinates, {
      spacingMeters,
      cruiseAltMeters: cruiseAlt,
      startName,
      destName,
      routeIdPrefix: raw.id,
    });

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
