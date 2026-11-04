export type DroneStatus = 
  | 'delivering'
  | 'en_route_pickup'
  | 'returning_to_base'
  | 'charging'
  | 'attention_required'
  | 'standby'
  | 'hovering';

export type MissionPriority = 'URGENT' | 'HIGH' | 'STANDARD' | 'ROUTINE';

export type AirspaceClassification = 'RED' | 'YELLOW' | 'GREEN' | 'UNKNOWN';
export type AltitudeReference = 'AGL' | 'AMSL';

export interface OfficialAirspaceZone {
  id: string;
  name: string;
  classification: AirspaceClassification;
  sourceTerminology?: string; // Preserves source terms like "AMBER" or "RESTRICTED_RED"
  originalSourceTerm?: string;
  coordinates: [number, number][]; // [lng, lat] exterior ring polygon
  lowerAltitudeLimitMeters: number;
  upperAltitudeLimitMeters: number;
  lowerLimitMeters?: number;
  upperLimitMeters?: number;
  altitudeReference: AltitudeReference;
  terrainElevationMeters: number; // Ground elevation AMSL for AGL <-> AMSL conversion
  permissionRequired: boolean;
  permissionAuthority: string; // e.g. "DGCA / Central Govt" | "AAI Coimbatore ATC (VOCB)"
  sourceAuthority?: string;
  authoritativeSource: string; // "DGCA Digital Sky / AAI Airspace Map"
  authorizedDrones?: string[]; // IDs of drones with authorized ATC permits
  effectiveDate: string;
  expiryDate: string;
  lastVerifiedTimestamp: string;
  dataRetrievalTimestamp?: string;
  dataStatus?: 'VERIFIED_ACTIVE' | 'DATA_STALE' | 'DATA_UNAVAILABLE' | 'UNCERTAIN';
  status: 'VERIFIED_ACTIVE' | 'DATA_STALE' | 'DATA_UNAVAILABLE' | 'UNCERTAIN';
  description: string;
  atcContactFrequency?: string;
}

export interface ATCPermit {
  zoneId: string;
  permitCode: string;
  permitId?: string;
  issuedBy: string;
  authority?: string;
  validUntil: string;
  allowedMaxAltitudeMeters: number;
  maxAltitudeMeters?: number;
  purpose?: string;
  issueDate?: string;
  active?: boolean;
}

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  altitudeMeters: number;
  type: 'base' | 'pickup' | 'transit' | 'delivery' | 'handoff';
  status: 'completed' | 'active' | 'upcoming';
  etaMinutes?: number;
}

export interface DroneVitals {
  batteryPercentage: number;
  batteryVoltage: number;
  estimatedFlightTimeMinutes: number;
  altitudeMeters: number;
  groundSpeedKmh: number;
  verticalSpeedMs: number;
  headingDegrees: number;
  latitude: number;
  longitude: number;
  gpsFix: 'RTK_FIX' | '3D_FIX' | 'DGPS' | 'SEARCHING';
  satellites: number;
  signalStrengthDbm: number;
  signalQualityPercent: number;
  payloadWeightKg: number;
  maxPayloadKg: number;
  motorHealthPercent: number;
  motorTempsCelsius: number[];
  energyBurnRateWhPerKm: number;
  energyRequiredToTargetWh: number;
  energyReserveMarginPercent: number;
  rtbStatus: 'SUFFICIENT' | 'LOW_RESERVE' | 'RTB_RECOMMENDED';
}

export interface DeliveryDetails {
  missionId: string;
  packageId: string;
  packageDescription: string;
  packageWeightKg: number;
  priority: MissionPriority;
  pickupLocation: string;
  destinationAddress: string;
  recipientName: string;
  recipientPhone: string;
  recipientConfirmed: boolean;
  dispatchTime: string;
  estimatedArrivalTime: string;
  etaConfidencePercent: number;
  etaConfidenceReason: string;
  status: 'In Progress' | 'Dispatched' | 'Delivered' | 'On Hold' | 'Rerouted';
}

export interface Drone {
  id: string;
  callsign: string;
  model: string;
  serialNumber: string;
  status: DroneStatus;
  statusLabel: string;
  currentWaypointIndex: number;
  route: Waypoint[];
  originalRoute?: Waypoint[]; // Used during replanning
  proposedRoute?: Waypoint[]; // Alternative route candidate
  completedRouteWaypoints?: Waypoint[]; // Historic completed flight segments
  blockedRouteWaypoints?: Waypoint[]; // Segments identified as conflicting
  vitals: DroneVitals;
  delivery?: DeliveryDetails;
  flightHours: number;
  lastMaintenance: string;
  isPaused: boolean;
  inSimulationConflict?: boolean;
  activeObstacleConflictId?: string | null;
  flightTrail?: [number, number][]; // [lng, lat] history
  atcPermissions?: ATCPermit[];
  currentAirspaceZone?: OfficialAirspaceZone | null;
  airspaceStatus?: 'PERMITTED' | 'PERMISSION_REQUIRED' | 'PROHIBITED' | 'UNCERTAIN';
  distanceToNearestRestrictedZoneMeters?: number;
  nearestRestrictedZoneName?: string;
  isRerouting?: boolean;
  rerouteReason?: string;
  lastRerouteTimestamp?: number;
  // Mission & Navigation Intelligence fields (Deterministic navigation)
  missionStartLocation?: string;
  missionStartCoords?: [number, number];
  missionDestinationName?: string;
  missionDestinationCoords?: [number, number];
  routeVersion?: number;
  routeStatus?: 'FOLLOWING_SAFE_ROUTE' | 'A_STAR_REROUTED' | 'SAFE_HOLD' | 'MISSION_COMPLETED' | 'NO_SAFE_ROUTE';
  distanceRemainingKm?: number;
  etaSecondsRemaining?: number;
  nextWaypointName?: string;
  targetHeadingDegrees?: number;
}

export interface RouteComparisonParameter {
  name: string;
  originalValue: string | number;
  alternativeValue: string | number;
  delta?: string | number;
  status: 'OPTIMAL' | 'EQUAL' | 'SUBOPTIMAL' | 'REJECTED';
  explanation: string;
}

export interface ReplanResult {
  success: boolean;
  proposedRoute: Waypoint[];
  originalDistanceKm: number;
  alternativeDistanceKm: number;
  addedDistanceKm: number;
  addedDelayMinutes: number;
  status: 'REPLANNED_VERIFIED' | 'NO_SAFE_ROUTE' | 'PERMISSION_REQUIRED';
  reason: string;
  conflictType: 'RED_ZONE' | 'YELLOW_ZONE' | 'OBSTACLE_COLLISION' | 'SEPARATION';
  affectedObstacleOrZone?: string;
  evaluatedNodesCount: number;
  pathClearanceMarginMeters: number;
  comparisonTable?: RouteComparisonParameter[];
  flightFeasibility: {
    batteryRequiredPercent: number;
    sufficientReserve: boolean;
  };
}

export type ObstacleType = 'building' | 'highway_flyover' | 'bridge' | 'cell_tower' | 'pylon' | 'infrastructure' | 'hospital';
export type HeightConfidence = 'verified' | 'estimated' | 'unknown';

export interface Obstacle {
  id: string;
  name: string;
  type: ObstacleType;
  coordinates: [number, number][]; // [lng, lat] polygon or polyline
  center: [number, number]; // [lng, lat]
  heightMeters: number;
  physicalHeightMeters?: number; // True physical structure height
  visualHeightMeters?: number; // Visual map extrusion height (rendering only)
  verticalClearanceBufferMeters?: number; // Minimum vertical buffer above roof/deck
  deckElevationMeters?: number; // Deck height for elevated highways
  deckThicknessMeters?: number; // Thickness of the highway deck
  pierLocations?: [number, number][]; // Specific pier coordinates
  pierSpacingMeters?: number; // Distance between structural support piers
  isGroundLevelRoad?: boolean; // True if ground road, false if elevated
  baseElevationMeters?: number;
  roofElevationMeters?: number; // baseElevation + height
  heightConfidence: HeightConfidence;
  heightSource?: string; // e.g. "OSM Verified", "NHAI Engineering Plan", "Satellite Estimation"
  safetyBufferMeters: number;
  description: string;
  color?: string;
}

export interface ObstacleConflict {
  id: string;
  droneId: string;
  droneCallsign: string;
  obstacleId: string;
  obstacleName: string;
  obstacleType: ObstacleType;
  severity: 'critical' | 'warning' | 'info';
  horizontalDistanceMeters: number;
  verticalClearanceMeters: number; // positive = above obstacle top, negative = below obstacle top
  droneAltitudeMeters: number;
  obstacleHeightMeters: number;
  estimatedTimeToImpactSec: number;
  predictedLocation: [number, number];
  suggestedAction: string;
  timestamp: string;
  heightConfidence: HeightConfidence;
}

export interface AirspaceAlert {
  id: string;
  type: 'restricted_zone' | 'geofence' | 'separation_conflict' | 'low_battery' | 'weather_gust' | 'obstacle_collision' | 'highway_hazard';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  droneId?: string;
  timestamp: string;
  acknowledged: boolean;
  actionRequired?: string;
  obstacleId?: string;
}

export interface AirspaceConflict {
  id: string;
  droneAId: string;
  droneBId: string;
  distanceMeters: number;
  minSeparationMeters?: number;
  estimatedTimeToConflictSec: number;
  predictedLocation: [number, number];
  suggestedAction: string;
  severity: 'critical' | 'warning';
}

export interface FlightLogEntry {
  id: string;
  timestamp: string;
  droneId: string;
  droneCallsign: string;
  event: string;
  type: 'info' | 'success' | 'warning' | 'critical';
}

export interface GeofenceZone {
  id: string;
  name: string;
  type: 'boundary' | 'caution' | 'restricted';
  coordinates: [number, number][]; // [lng, lat]
  minAltitudeMeters: number;
  maxAltitudeMeters: number;
  description: string;
}

export type NotificationCategory = 
  | 'battery' 
  | 'building' 
  | 'highway' 
  | 'restricted' 
  | 'separation' 
  | 'gps' 
  | 'telemetry' 
  | 'mission';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  category: NotificationCategory;
  droneId?: string;
  droneCallsign?: string;
  read: boolean;
  acknowledged: boolean;
  actionRequired?: string;
  obstacleId?: string;
  metrics?: {
    horizontalDistance?: number;
    verticalClearance?: number;
    obstacleName?: string;
    batteryLevel?: number;
  };
}
