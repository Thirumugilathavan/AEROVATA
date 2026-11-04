/**
 * Typed Checkpoint and Mission Data Models
 * AEROVATA by TASPORA - Autonomous Drone Delivery Command Center
 * 
 * Strict contract defining checkpoint missions, simulation telemetry,
 * and camera feed connection metadata.
 */

export type CheckpointAction = 
  | 'takeoff'
  | 'transit'
  | 'hover_inspect'
  | 'drop_payload'
  | 'scan_area'
  | 'land';

export type CheckpointStatus = 
  | 'pending'
  | 'active'
  | 'reached'
  | 'skipped';

export interface Checkpoint {
  /** Unique checkpoint identifier */
  id: string;
  /** 1-based sequential order of this checkpoint in the mission */
  sequence: number;
  /** Human-readable waypoint / checkpoint name */
  name: string;
  /** Geographic latitude in decimal degrees (-90 to 90) */
  lat: number;
  /** Geographic longitude in decimal degrees (-180 to 180) */
  lng: number;
  /** Commanded flight altitude in meters above ground level (AGL) */
  altitudeMeters: number;
  /** Commanded cruising airspeed in km/h towards this checkpoint */
  targetSpeedKmh: number;
  /** Acceptance cylinder radius in meters (drone considered arrived when within this radius) */
  arrivalRadiusMeters: number;
  /** Dwell or loiter duration at checkpoint in seconds before continuing (0 for fly-through) */
  dwellTimeSeconds: number;
  /** Commanded aircraft action upon arrival */
  action: CheckpointAction;
  /** Execution status of this checkpoint */
  status: CheckpointStatus;
  /** Estimated time of arrival in seconds from mission start */
  etaSeconds?: number;
  /** Optional operational notes or payload instructions */
  notes?: string;
}

export type MissionState = 
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'aborted'
  | 'error';

export interface Mission {
  /** Unique mission ID (e.g. MSN-TAS-2026-04) */
  id: string;
  /** Mission title */
  title: string;
  /** Operational description */
  description: string;
  /** Operational priority */
  priority: 'URGENT' | 'HIGH' | 'STANDARD' | 'ROUTINE';
  /** Assigned drone hardware ID */
  droneId: string;
  /** Aircraft radio callsign */
  droneCallsign: string;
  /** Current state of the mission */
  status: MissionState;
  /** Ordered sequence of checkpoints (minimum 2 for a valid route) */
  checkpoints: Checkpoint[];
  /** Index of currently active target checkpoint (0 to checkpoints.length - 1) */
  currentCheckpointIndex: number;
  /** Total calculated route distance in meters */
  totalDistanceMeters: number;
  /** Elapsed mission runtime in seconds */
  elapsedTimeSeconds: number;
  /** Estimated remaining flight time in seconds */
  estimatedRemainingSeconds: number;
  /** Overall route progress in percent (0 - 100) */
  progressPercent: number;
  /** Human-readable explanation if mission is in error state */
  errorMessage?: string;
  /** Remaining dwell time if aircraft is currently holding at a checkpoint */
  dwellRemainingSeconds?: number;
}

export interface MissionTelemetry {
  /** Target drone identifier */
  droneId: string;
  /** Timestamp in Unix milliseconds */
  timestamp: number;
  /** Real-time latitude */
  lat: number;
  /** Real-time longitude */
  lng: number;
  /** Current altitude in meters AGL */
  altitudeMeters: number;
  /** Current aircraft heading in degrees (0 - 359) */
  headingDegrees: number;
  /** Current ground speed in km/h */
  groundSpeedKmh: number;
  /** Current vertical speed in m/s (+ climbs, - descends) */
  verticalSpeedMs: number;
  /** State of charge percentage (0 - 100) */
  batteryPercentage: number;
  /** Battery pack voltage */
  batteryVoltage: number;
  /** Communication link RSSI quality percentage (0 - 100) */
  signalQualityPercent: number;
  /** RTK GPS positioning status */
  rtkFix: 'RTK_FIX' | '3D_FIX' | 'DGPS' | 'SEARCHING';
  /** Satellites locked */
  satellites: number;
  /** Index of target checkpoint */
  currentCheckpointIndex: number;
  /** Remaining distance to active checkpoint in meters */
  distanceToNextCheckpointMeters: number;
  /** Synchronized mission execution state */
  missionStatus: MissionState;
  /** Flag indicating if aircraft is currently holding dwell at a checkpoint */
  isDwellActive: boolean;
  /** Whether telemetry link / SITL simulator is connected */
  connected?: boolean;
}

export type CameraConnectionStatus = 
  | 'CONNECTED'
  | 'STANDBY'
  | 'DISCONNECTED'
  | 'FALLBACK_SIMULATION';

export interface CameraFeedMetadata {
  droneId: string;
  connectionStatus: CameraConnectionStatus;
  /** Live stream URL (RTSP / HLS / WebRTC / HTTP MJPEG) */
  streamUrl?: string;
  /** Sensor resolution string (e.g. "1920x1080") */
  resolution: string;
  /** Sensor framerate (e.g. 60) */
  fps: number;
  /** End-to-end glass-to-glass latency in milliseconds */
  latencyMs: number;
  /** Video codec */
  codec: string;
  /** Boolean flag: true if feed is synthetic/simulated */
  isSimulated: boolean;
  /** Mandatory disclaimer when isSimulated is true */
  disclaimer: string;
}
