/**
 * 3D Building-Aware Drone Waypoint Planning Engine - Types & Interfaces
 * AEROVATA by TASPORA - UTM Autonomous Airspace Command
 * 
 * Defines the shared 3D world model, collision checking interfaces,
 * altitude reference systems, path planner contracts, and validation types.
 */

import { 
  Waypoint, 
  Obstacle, 
  ObstacleType, 
  OfficialAirspaceZone, 
  RouteCandidate,
  RouteValidationResult,
  RouteValidationStatus,
  RegulatoryAltitudeConfig
} from '../../types/fleet';

// ─── 1. ALTITUDE REFERENCES & LIMITS ─────────────────────────────────────────

export type AltitudeReference = 'AGL' | 'AMSL';

export interface AltitudeLimitsConfig {
  frameworkName: string;
  minFlightAltitudeMeters: number;      // e.g. 20m AGL (minimum safe urban flight)
  maxPermittedCeilingMeters: number;    // e.g. 120m AGL (DGCA 400ft ceiling)
  defaultCruiseAltitudeMeters: number;  // e.g. 60m - 65m AGL
  defaultHorizontalBufferMeters: number;// e.g. 25m - 35m
  defaultVerticalBufferMeters: number;  // e.g. 15m
  droneRadiusMeters: number;            // e.g. 1.5m
  maxClimbRateMs: number;               // e.g. 4.0 m/s
  maxDescentRateMs: number;             // e.g. 2.5 m/s
  cruiseSpeedKmh: number;               // e.g. 48.0 km/h
}

// ─── 2. SHARED 3D WORLD MODEL & OBSTACLES ────────────────────────────────────

export interface BuildingObstacle3D {
  id: string;
  name: string;
  type: ObstacleType;
  footprint: [number, number][];        // [lng, lat][] closed polygon ring
  center: [number, number];            // [lng, lat]
  heightAboveGroundMeters: number;      // Physical height AGL (m)
  groundElevationMeters: number;        // Ground base elevation AMSL (m)
  roofElevationMeters: number;          // Roof top elevation AMSL (ground + height)
  horizontalSafetyBufferMeters: number; // Configurable horizontal buffer (m)
  verticalClearanceBufferMeters: number;// Configurable vertical buffer (m)
  heightConfidence: 'verified' | 'estimated' | 'unknown';
  heightSource?: string;
  isValid: boolean;
  metadata?: {
    levels?: number;
    deckElevationMeters?: number;
    deckThicknessMeters?: number;
    isGroundLevelRoad?: boolean;
    rawObstacle?: Obstacle;
  };
}

export interface IWorldModel3D {
  getBuildingObstacles(): BuildingObstacle3D[];
  getAirspaceZones(): OfficialAirspaceZone[];
  getRegionalElevation(lat: number, lng: number): number;
  getRegulatoryConfig(): RegulatoryAltitudeConfig;
  findObstaclesInBBox(
    minLng: number, 
    minLat: number, 
    maxLng: number, 
    maxLat: number
  ): BuildingObstacle3D[];
  findObstacleAtPoint(lng: number, lat: number): BuildingObstacle3D | null;
}

// ─── 3. SEGMENT-LEVEL COLLISION CHECKING ─────────────────────────────────────

export interface CollisionCheckOptions {
  droneRadiusMeters?: number;
  horizontalBufferMeters?: number;
  verticalBufferMeters?: number;
  altitudeReference?: AltitudeReference;
  allowYellowZones?: boolean;
  checkTerrainFloor?: boolean;
  stepResolutionMeters?: number;
}

export type CollisionConflictType = 
  | 'BUILDING' 
  | 'FLYOVER' 
  | 'RED_ZONE' 
  | 'YELLOW_ZONE' 
  | 'CEILING_EXCEEDED' 
  | 'BELOW_MIN_ALTITUDE' 
  | 'CORNER_PROXIMITY'
  | 'OUT_OF_BOUNDS';

export interface SegmentCollisionResult {
  isCollisionFree: boolean;
  blockedReason?: string;
  conflictType?: CollisionConflictType;
  conflictingObstacle?: BuildingObstacle3D;
  conflictingZone?: OfficialAirspaceZone;
  minimumHorizontalSeparationMeters: number;
  minimumVerticalSeparationMeters: number;
  closestPointCoords?: [number, number, number]; // [lng, lat, alt]
  hasUnverifiedData?: boolean;
}

export interface ISegmentCollisionChecker {
  checkPoint(
    point: [number, number, number], // [lng, lat, alt]
    options?: CollisionCheckOptions
  ): SegmentCollisionResult;

  checkSegment(
    p1: [number, number, number], // [lng, lat, alt]
    p2: [number, number, number], // [lng, lat, alt]
    options?: CollisionCheckOptions
  ): SegmentCollisionResult;

  checkPolyline(
    points: [number, number, number][],
    options?: CollisionCheckOptions
  ): SegmentCollisionResult;
}

// ─── 4. PATH PLANNING ────────────────────────────────────────────────────────

export interface PathPlanningRequest {
  start: [number, number, number];      // [lng, lat, alt] (alt in m AGL)
  destination: [number, number, number];// [lng, lat, alt] (alt in m AGL)
  startName?: string;
  destName?: string;
  cruiseAltitudeMeters?: number;
  minAltitudeMeters?: number;
  maxAltitudeMeters?: number;
  droneRadiusMeters?: number;
  safetyMarginMeters?: number;
  checkpointSpacingMeters?: number;
  allowYellowZones?: boolean;
  preferHorizontalDetour?: boolean;     // Default: true (prioritize lateral bypass over climb)
  customObstacles?: Obstacle[];
  customAirspaceZones?: OfficialAirspaceZone[];
}

export interface PathPlanningResponse {
  success: boolean;
  primaryPath: [number, number, number][]; // [lng, lat, alt][]
  waypoints: Waypoint[];
  distanceKm: number;
  estimatedMinutes: number;
  error?: string;
  unverifiedDataWarning?: string;
  candidates?: RouteCandidate[];
  validation: RouteValidationResult;
  detourCount: number;
  altitudeAdjusted: boolean;
  evaluatedNodesCount?: number;
}

export interface IPathPlanner {
  planRoute(request: PathPlanningRequest): PathPlanningResponse;
}

// ─── 5. ROUTE SMOOTHING & SIMPLIFICATION ─────────────────────────────────────

export interface SimplificationOptions {
  maxDistanceBetweenCheckpoints?: number;
  minTurnAngleDegrees?: number;
  toleranceMeters?: number;
  droneRadiusMeters?: number;
}

export interface IRouteSimplifier {
  simplify(
    path: [number, number, number][],
    collisionChecker: ISegmentCollisionChecker,
    options?: SimplificationOptions
  ): [number, number, number][];
}

// ─── 6. ROUTE VALIDATION ─────────────────────────────────────────────────────

export interface IRouteValidator {
  validateRoute(
    waypoints: Waypoint[] | [number, number, number][],
    options?: CollisionCheckOptions
  ): RouteValidationResult;
}
