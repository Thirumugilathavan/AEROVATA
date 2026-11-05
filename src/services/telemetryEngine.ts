import { 
  Drone, 
  AirspaceConflict, 
  FlightLogEntry, 
  GeofenceZone, 
  Waypoint, 
  Obstacle, 
  ObstacleConflict,
  NotificationItem,
  AirspaceAlert,
  OfficialAirspaceZone,
  ReplanResult,
  NextWaypointStatus
} from '../types/fleet';
import { 
  OFFICIAL_COIMBATORE_AIRSPACE_ZONES, 
  evaluatePointAirspace, 
  isPointInZone, 
  isAltitudeInZoneLimits 
} from '../data/officialAirspaceData';
import { calculateAStarReroute, isSegment3DTraversable, geoToMetric } from './aStarPathfinder';

// Helper: Haversine distance in meters
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Calculate bearing from coord1 to coord2 in degrees (0-360)
export function getBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

// Format waypoint distance: < 1000m -> meters (e.g. 850m, 340m), >= 1000m -> km (e.g. 1.45 km)
export function formatWaypointDistance(meters?: number | null): string {
  if (meters === undefined || meters === null || isNaN(meters)) return '--';
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

// Waypoint status styling badge helper
export function getWaypointStatusBadge(status?: NextWaypointStatus): {
  label: string;
  colorClass: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (status) {
    case 'WAYPOINT_REACHED':
      return {
        label: 'WAYPOINT REACHED',
        colorClass: 'text-emerald-400',
        badgeClass: 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300',
        dotClass: 'bg-emerald-400',
      };
    case 'NEAR_WAYPOINT':
      return {
        label: 'NEAR WAYPOINT',
        colorClass: 'text-amber-400',
        badgeClass: 'bg-amber-950/80 border-amber-500/60 text-amber-300',
        dotClass: 'bg-amber-400 animate-ping',
      };
    case 'WAYPOINT_BLOCKED':
      return {
        label: 'WAYPOINT BLOCKED',
        colorClass: 'text-rose-400',
        badgeClass: 'bg-rose-950/80 border-rose-500/60 text-rose-300',
        dotClass: 'bg-rose-400 animate-ping',
      };
    case 'TELEMETRY_UNAVAILABLE':
      return {
        label: 'TELEMETRY UNAVAILABLE',
        colorClass: 'text-slate-400',
        badgeClass: 'bg-slate-900 border-slate-700 text-slate-400',
        dotClass: 'bg-slate-500',
      };
    case 'APPROACHING':
    default:
      return {
        label: 'APPROACHING',
        colorClass: 'text-cyan-400',
        badgeClass: 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300',
        dotClass: 'bg-cyan-400 animate-pulse',
      };
  }
}

// Point-in-polygon algorithm
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point; // [lng, lat]
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Minimum distance from a point to a line segment in meters
export function getDistanceToSegmentMeters(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return getDistanceMeters(py, px, y1, x1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return getDistanceMeters(py, px, projY, projX);
}

// Distance from point to polygon boundary or polyline in meters
export function getDistanceToPolygonMeters(
  point: [number, number],
  polygon: [number, number][]
): number {
  if (isPointInPolygon(point, polygon)) {
    return 0; // Inside footprint
  }
  let minDist = Infinity;
  for (let i = 0; i < polygon.length - 1; i++) {
    const p1 = polygon[i];
    const p2 = polygon[i + 1];
    const dist = getDistanceToSegmentMeters(point[0], point[1], p1[0], p1[1], p2[0], p2[1]);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

// Smart Return-To-Base prediction
export function computeRTBStatus(drone: Drone, baseCoord: { lat: number; lng: number }): {
  rtbStatus: 'SUFFICIENT' | 'LOW_RESERVE' | 'RTB_RECOMMENDED';
  energyReserveMarginPercent: number;
  energyRequiredWh: number;
  returnDistanceKm: number;
} {
  const distMeters = getDistanceMeters(
    drone.vitals.latitude,
    drone.vitals.longitude,
    baseCoord.lat,
    baseCoord.lng
  );
  const distKm = distMeters / 1000;
  const payloadFactor = 1 + (drone.vitals.payloadWeightKg / drone.vitals.maxPayloadKg) * 0.25;
  const energyRequiredWh = Math.round(distKm * drone.vitals.energyBurnRateWhPerKm * payloadFactor * 10) / 10;
  
  const totalBatteryCapacityWh = 500;
  const availableBatteryWh = (drone.vitals.batteryPercentage / 100) * totalBatteryCapacityWh;
  const reserveWh = availableBatteryWh - energyRequiredWh;
  const reserveMarginPercent = Math.max(0, Math.round((reserveWh / totalBatteryCapacityWh) * 100));

  let rtbStatus: 'SUFFICIENT' | 'LOW_RESERVE' | 'RTB_RECOMMENDED' = 'SUFFICIENT';
  if (reserveMarginPercent < 12 || drone.vitals.batteryPercentage < 25) {
    rtbStatus = 'RTB_RECOMMENDED';
  } else if (reserveMarginPercent < 22 || drone.vitals.batteryPercentage < 40) {
    rtbStatus = 'LOW_RESERVE';
  }

  return {
    rtbStatus,
    energyReserveMarginPercent: reserveMarginPercent,
    energyRequiredWh,
    returnDistanceKm: Math.round(distKm * 10) / 10,
  };
}

// 3D Building & Highway Obstacle Collision Detection Engine
export function evaluate3DObstacleCollision(
  drone: Drone,
  obstacles: Obstacle[],
  predictionHorizonsSec = [5, 10, 20]
): ObstacleConflict | null {
  const droneLat = drone.vitals.latitude;
  const droneLng = drone.vitals.longitude;
  const droneAlt = drone.vitals.altitudeMeters;
  const speedMs = (drone.vitals.groundSpeedKmh * 1000) / 3600;
  const headingRad = (drone.vitals.headingDegrees * Math.PI) / 180;

  // Velocity components (approx degrees per sec)
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((droneLat * Math.PI) / 180);
  const vLng = (Math.sin(headingRad) * speedMs) / metersPerDegLng;
  const vLat = (Math.cos(headingRad) * speedMs) / metersPerDegLat;

  let mostCriticalConflict: ObstacleConflict | null = null;
  let minThreatRank = Infinity;

  for (const obs of obstacles) {
    const currentDist = getDistanceToPolygonMeters([droneLng, droneLat], obs.coordinates);
    const physicalHeight = obs.physicalHeightMeters ?? obs.heightMeters;
    const verticalClearance = droneAlt - physicalHeight;

    // Check multiple projected future time horizons
    let projectedMinDist = currentDist;
    let timeToClosestSec = 0;

    for (const t of predictionHorizonsSec) {
      const projLng = droneLng + vLng * t;
      const projLat = droneLat + vLat * t;
      const projDist = getDistanceToPolygonMeters([projLng, projLat], obs.coordinates);
      if (projDist < projectedMinDist) {
        projectedMinDist = projDist;
        timeToClosestSec = t;
      }
    }

    const effectiveDist = Math.min(currentDist, projectedMinDist);
    const buffer = obs.safetyBufferMeters || 25;
    const vertBuffer = obs.verticalClearanceBufferMeters || 15;

    // Handle highway flyover deck elevation vs buildings
    if (obs.type === 'highway_flyover') {
      const deckElev = obs.deckElevationMeters ?? physicalHeight;
      const deckThick = obs.deckThicknessMeters ?? 3.0;
      const deckTop = deckElev + (deckThick / 2) + vertBuffer;
      const deckBottom = Math.max(0, deckElev - (deckThick / 2) - 3);

      if (effectiveDist < buffer + 20) {
        if (droneAlt >= deckBottom && droneAlt <= deckTop) {
          // Inside viaduct collision slice
          const severity: 'critical' | 'warning' = effectiveDist < buffer ? 'critical' : 'warning';
          const rank = severity === 'critical' ? 1 : 2;
          if (rank < minThreatRank) {
            minThreatRank = rank;
            mostCriticalConflict = {
              id: `obs-conf-${drone.id}-${obs.id}`,
              droneId: drone.id,
              droneCallsign: drone.callsign,
              obstacleId: obs.id,
              obstacleName: obs.name,
              obstacleType: obs.type,
              severity,
              horizontalDistanceMeters: Math.round(effectiveDist),
              verticalClearanceMeters: Math.round((droneAlt - deckElev) * 10) / 10,
              droneAltitudeMeters: droneAlt,
              obstacleHeightMeters: deckElev,
              estimatedTimeToImpactSec: timeToClosestSec > 0 ? timeToClosestSec : Math.max(3, Math.round(effectiveDist / Math.max(10, speedMs))),
              predictedLocation: [obs.center[0], obs.center[1]],
              suggestedAction: `Climb to ${Math.round(deckTop + 15)}m AGL to overfly viaduct safely`,
              timestamp: new Date().toTimeString().split(' ')[0],
              heightConfidence: obs.heightConfidence,
            };
          }
        }
      }
    } else {
      // 3D Buildings & Hospital complexes
      const bldgTop = physicalHeight + vertBuffer;
      if (effectiveDist < buffer + 25) {
        if (droneAlt <= bldgTop) {
          const severity: 'critical' | 'warning' = effectiveDist < buffer ? 'critical' : 'warning';
          const rank = severity === 'critical' ? 1 : 2;
          if (rank < minThreatRank) {
            minThreatRank = rank;
            mostCriticalConflict = {
              id: `obs-conf-${drone.id}-${obs.id}`,
              droneId: drone.id,
              droneCallsign: drone.callsign,
              obstacleId: obs.id,
              obstacleName: obs.name,
              obstacleType: obs.type,
              severity,
              horizontalDistanceMeters: Math.round(effectiveDist),
              verticalClearanceMeters: Math.round(verticalClearance * 10) / 10,
              droneAltitudeMeters: droneAlt,
              obstacleHeightMeters: physicalHeight,
              estimatedTimeToImpactSec: timeToClosestSec > 0 ? timeToClosestSec : Math.max(3, Math.round(effectiveDist / Math.max(10, speedMs))),
              predictedLocation: [obs.center[0], obs.center[1]],
              suggestedAction: `Climb to ${Math.round(bldgTop + 15)}m AGL or detour around structure`,
              timestamp: new Date().toTimeString().split(' ')[0],
              heightConfidence: obs.heightConfidence,
            };
          }
        }
      }
    }
  }

  return mostCriticalConflict;
}

// Master Simulation Tick Update
export function updateSimulationTick(
  drones: Drone[],
  deltaSeconds: number,
  restrictedZones: GeofenceZone[],
  obstacles: Obstacle[] = [],
  officialAirspaceZones: OfficialAirspaceZone[] = OFFICIAL_COIMBATORE_AIRSPACE_ZONES,
  px4ControlledDroneIds?: Set<string>
): {
  updatedDrones: Drone[];
  newLogs: FlightLogEntry[];
  conflicts: AirspaceConflict[];
  obstacleConflicts: ObstacleConflict[];
  newNotifications: NotificationItem[];
} {
  const newLogs: FlightLogEntry[] = [];
  const obstacleConflicts: ObstacleConflict[] = [];
  const newNotifications: NotificationItem[] = [];
  const baseCoord = { lat: 11.0025, lng: 76.9665 }; // CMCH Coimbatore Master Hub

  const updatedDrones: Drone[] = drones.map((drone): Drone => {
    // If vehicle is actively driven by genuine PX4 SITL MAVLink telemetry, preserve state
    if (px4ControlledDroneIds && px4ControlledDroneIds.has(drone.id)) {
      return drone;
    }

    // If paused, maintain state
    if (drone.isPaused) {
      return drone;
    }

    // Standby / Idle drone holding on departure pad
    if (drone.status === 'standby') {
      return drone;
    }

    // Charging drone simulation
    if (drone.status === 'charging') {
      const newBat = Math.min(100, drone.vitals.batteryPercentage + 0.1 * deltaSeconds);
      return {
        ...drone,
        vitals: {
          ...drone.vitals,
          batteryPercentage: Math.round(newBat * 10) / 10,
          estimatedFlightTimeMinutes: Math.round((newBat / 100) * 35),
        },
      };
    }

    // If mission is already completed and docked at destination, maintain stabilized hover hold
    if (drone.routeStatus === 'MISSION_COMPLETED' || drone.status === 'hovering') {
      const destCoords = drone.missionDestinationCoords || [drone.vitals.longitude, drone.vitals.latitude];
      return {
        ...drone,
        status: 'hovering',
        statusLabel: `MISSION COMPLETED - DOCKED AT ${drone.missionDestinationName || 'DESTINATION'}`,
        distanceRemainingKm: 0,
        etaSecondsRemaining: 0,
        vitals: {
          ...drone.vitals,
          latitude: destCoords[1],
          longitude: destCoords[0],
          altitudeMeters: Math.max(30, drone.vitals.altitudeMeters),
          groundSpeedKmh: 0,
          verticalSpeedMs: 0,
        },
      };
    }

    // ─── Sequential Waypoint Progression Controller ──────────────
    let updatedRoute = [...drone.route];
    if (updatedRoute.length === 0) {
      return drone;
    }

    // Determine target waypoint index (1-based from origin depot, or explicit targetWaypointIndex)
    let targetIndex = drone.targetWaypointIndex !== undefined
      ? drone.targetWaypointIndex
      : (drone.currentWaypointIndex === 0 && updatedRoute.length > 1 ? 1 : drone.currentWaypointIndex);
    
    // Clamp targetIndex within valid route boundaries
    targetIndex = Math.max(0, Math.min(updatedRoute.length - 1, targetIndex));
    let targetWp = updatedRoute[targetIndex];

    // Check if drone has arrived at final destination
    if (targetIndex >= updatedRoute.length - 1 && getDistanceMeters(drone.vitals.latitude, drone.vitals.longitude, targetWp.lat, targetWp.lng) <= 15) {
      // Mission is complete! Hold position at destination - DO NOT LOOP BACKWARDS!
      const finalDestName = drone.missionDestinationName || updatedRoute[updatedRoute.length - 1]?.name || 'Destination Pad';
      const timeStr = new Date().toTimeString().split(' ')[0];

      newLogs.push({
        id: `log-complete-${Date.now()}-${drone.id}`,
        timestamp: timeStr,
        droneId: drone.id,
        droneCallsign: drone.callsign,
        event: `MISSION COMPLETED: ${drone.callsign} has arrived and stabilized at destination (${finalDestName}). Auto-dock hold active.`,
        type: 'success',
      });

        newNotifications.push({
          id: `notif-complete-${Date.now()}-${drone.id}`,
          title: `Mission Completed: ${drone.callsign}`,
          description: `Aircraft ${drone.callsign} successfully completed its delivery to ${finalDestName}. Optical tether released. Stabilized hover hold active.`,
          timestamp: timeStr,
          severity: 'success',
          category: 'mission',
          droneId: drone.id,
          droneCallsign: drone.callsign,
          read: false,
          acknowledged: false,
        });

      // Mark all waypoints as completed
      updatedRoute = updatedRoute.map((wp) => ({ ...wp, status: 'completed' as const }));

      return {
        ...drone,
        status: 'hovering',
        statusLabel: `MISSION COMPLETED - DOCKED AT ${finalDestName}`,
        routeStatus: 'MISSION_COMPLETED',
        route: updatedRoute,
        distanceRemainingKm: 0,
        totalRouteDistanceKm: 0,
        distanceToNextWaypointMeters: 0,
        nextWaypointStatus: 'WAYPOINT_REACHED',
        etaSecondsRemaining: 0,
        currentWaypointIndex: updatedRoute.length - 1,
        targetWaypointIndex: updatedRoute.length - 1,
        vitals: {
          ...drone.vitals,
          latitude: targetWp.lat,
          longitude: targetWp.lng,
          groundSpeedKmh: 0,
          verticalSpeedMs: 0,
        },
      };
    }

    // Distance from drone's current position to target waypoint (geodesic Haversine)
    const distanceToTarget = getDistanceMeters(
      drone.vitals.latitude,
      drone.vitals.longitude,
      targetWp.lat,
      targetWp.lng
    );

    const currentSpeedKmh = drone.vitals.groundSpeedKmh > 5 ? drone.vitals.groundSpeedKmh : 48.0;
    const speedMs = (currentSpeedKmh * 1000) / 3600;
    const stepDistance = speedMs * deltaSeconds;
    // Configurable tolerance radius: 18m or 1.5 * stepDistance
    const arrivalRadius = Math.max(stepDistance * 1.5, 18);

    let newLat = drone.vitals.latitude;
    let newLng = drone.vitals.longitude;
    let newAlt = drone.vitals.altitudeMeters;
    let liveDistToTarget = distanceToTarget;
    let wpStatus: NextWaypointStatus = 'APPROACHING';

    if (distanceToTarget <= arrivalRadius) {
      // ── Target Waypoint Reached ──
      newLat = targetWp.lat;
      newLng = targetWp.lng;
      newAlt = targetWp.altitudeMeters;

      // Mark reached waypoint completed and ensure prior waypoints are completed
      for (let i = 0; i <= targetIndex; i++) {
        updatedRoute[i] = { ...updatedRoute[i], status: 'completed' };
      }

      const reachedWpName = targetWp.name;
      const timeStr = new Date().toTimeString().split(' ')[0];

      if (targetIndex >= updatedRoute.length - 1) {
        // Reached the final destination pad!
        wpStatus = 'WAYPOINT_REACHED';
        liveDistToTarget = 0;
        newLogs.push({
          id: `log-complete-${Date.now()}-${drone.id}`,
          timestamp: timeStr,
          droneId: drone.id,
          droneCallsign: drone.callsign,
          event: `MISSION COMPLETED: ${drone.callsign} has arrived at destination (${reachedWpName}). Dock hold active.`,
          type: 'success',
        });
      } else {
        // Advance to next pending waypoint in sequence!
        targetIndex = targetIndex + 1;
        targetWp = updatedRoute[targetIndex];
        updatedRoute[targetIndex] = { ...updatedRoute[targetIndex], status: 'active' };

        // Calculate distance from reached fix to the newly selected next target waypoint
        liveDistToTarget = Math.round(getDistanceMeters(newLat, newLng, targetWp.lat, targetWp.lng));
        wpStatus = liveDistToTarget <= 150 ? 'NEAR_WAYPOINT' : 'APPROACHING';

        newLogs.push({
          id: `log-wp-${Date.now()}-${drone.id}`,
          timestamp: timeStr,
          droneId: drone.id,
          droneCallsign: drone.callsign,
          event: `Waypoint reached: ${reachedWpName}. Next active waypoint: ${targetWp.name} (${formatWaypointDistance(liveDistToTarget)}).`,
          type: targetWp.type === 'delivery' ? 'success' : 'info',
        });
      }
    } else {
      // ── Approaching Target Waypoint: Smooth linear interpolation ──
      const ratio = Math.min(1, stepDistance / distanceToTarget);
      newLat = drone.vitals.latitude + (targetWp.lat - drone.vitals.latitude) * ratio;
      newLng = drone.vitals.longitude + (targetWp.lng - drone.vitals.longitude) * ratio;
      newAlt = drone.vitals.altitudeMeters + (targetWp.altitudeMeters - drone.vitals.altitudeMeters) * ratio;

      // Recalculate remaining distance to active waypoint from fresh position (strictly decreasing!)
      liveDistToTarget = Math.round(getDistanceMeters(newLat, newLng, targetWp.lat, targetWp.lng));
      if (liveDistToTarget <= 25) {
        wpStatus = 'WAYPOINT_REACHED';
      } else if (liveDistToTarget <= 150) {
        wpStatus = 'NEAR_WAYPOINT';
      } else {
        wpStatus = 'APPROACHING';
      }
    }

    // Smooth heading calculation toward currently active target waypoint
    const targetHeading = Math.round(getBearingDegrees(newLat, newLng, targetWp.lat, targetWp.lng));
    let newHeading = drone.vitals.headingDegrees;
    let headingDiff = ((targetHeading - newHeading + 540) % 360) - 180;
    newHeading = Math.round((newHeading + headingDiff * 0.35 + 360) % 360);

    // Calculate total remaining distance across ALL remaining route segments to final destination
    let remainingDistMeters = liveDistToTarget;
    for (let k = targetIndex + 1; k < updatedRoute.length; k++) {
      remainingDistMeters += getDistanceMeters(
        updatedRoute[k - 1].lat,
        updatedRoute[k - 1].lng,
        updatedRoute[k].lat,
        updatedRoute[k].lng
      );
    }
    const distanceRemainingKm = Math.round((remainingDistMeters / 1000) * 100) / 100;
    const etaSecondsRemaining = Math.round(remainingDistMeters / Math.max(5, speedMs));

    // Battery burn
    const batDrainRate = 0.012 * deltaSeconds * (1 + drone.vitals.payloadWeightKg * 0.1);
    const newBattery = Math.max(8, Math.round((drone.vitals.batteryPercentage - batDrainRate) * 10) / 10);
    const remainingTimeMin = Math.max(1, Math.round((newBattery / 100) * 35));

    // Realistic ground speed variation
    const speedVariation = (Math.random() - 0.5) * 0.4;
    const finalSpeed = Math.max(35, Math.min(60, drone.vitals.groundSpeedKmh + speedVariation));

    // RTB prediction
    const rtb = computeRTBStatus(
      { ...drone, vitals: { ...drone.vitals, latitude: newLat, longitude: newLng, batteryPercentage: newBattery } },
      baseCoord
    );

    // Append to flight trail history (keep last 40 points)
    const currentTrail = drone.flightTrail || [];
    const updatedTrail: [number, number][] = [
      ...currentTrail.slice(-39),
      [newLng, newLat]
    ];

    // ─── Official Airspace Zone Analysis ─────────────────────────
    const currentZone = evaluatePointAirspace(newLng, newLat, newAlt, 'AGL', officialAirspaceZones);

    let minRestrictedDist = Infinity;
    let nearestZoneName = 'None';
    for (const z of officialAirspaceZones) {
      if (z.classification === 'RED' || z.classification === 'YELLOW') {
        const d = getDistanceToPolygonMeters([newLng, newLat], z.coordinates);
        if (d < minRestrictedDist) {
          minRestrictedDist = Math.round(d);
          nearestZoneName = z.name;
        }
      }
    }

    let airspaceStatus: 'PERMITTED' | 'PERMISSION_REQUIRED' | 'PROHIBITED' | 'UNCERTAIN' = 'PERMITTED';
    if (currentZone) {
      if (currentZone.classification === 'RED') {
        airspaceStatus = 'PROHIBITED';
      } else if (currentZone.classification === 'YELLOW') {
        const hasPermit = drone.atcPermissions?.some((p) => p.zoneId === currentZone.id) ||
                          currentZone.authorizedDrones?.includes(drone.id);
        airspaceStatus = hasPermit ? 'PERMITTED' : 'PERMISSION_REQUIRED';
      } else if (currentZone.classification === 'UNKNOWN') {
        airspaceStatus = 'UNCERTAIN';
      } else {
        airspaceStatus = 'PERMITTED';
      }
    }

    let updatedDrone: Drone = {
      ...drone,
      currentWaypointIndex: targetIndex,
      targetWaypointIndex: targetIndex,
      distanceToNextWaypointMeters: liveDistToTarget,
      nextWaypointStatus: wpStatus,
      nextWaypointName: targetWp.name,
      route: updatedRoute,
      flightTrail: updatedTrail,
      currentAirspaceZone: currentZone,
      airspaceStatus,
      distanceToNearestRestrictedZoneMeters: minRestrictedDist === Infinity ? 0 : minRestrictedDist,
      nearestRestrictedZoneName: nearestZoneName,
      distanceRemainingKm,
      totalRouteDistanceKm: distanceRemainingKm,
      etaSecondsRemaining,
      vitals: {
        ...drone.vitals,
        latitude: newLat,
        longitude: newLng,
        altitudeMeters: Math.round(newAlt * 10) / 10,
        headingDegrees: newHeading,
        groundSpeedKmh: Math.round(finalSpeed * 10) / 10,
        batteryPercentage: newBattery,
        estimatedFlightTimeMinutes: remainingTimeMin,
        energyRequiredToTargetWh: rtb.energyRequiredWh,
        energyReserveMarginPercent: rtb.energyReserveMarginPercent,
        rtbStatus: rtb.rtbStatus,
      },
    };

    // ─── 3D Obstacle Collision Check ────────────────────────────
    let obstacleConflict: ObstacleConflict | null = null;
    if (obstacles.length > 0) {
      obstacleConflict = evaluate3DObstacleCollision(updatedDrone, obstacles);
      if (obstacleConflict) {
        obstacleConflicts.push(obstacleConflict);
        updatedDrone.activeObstacleConflictId = obstacleConflict.obstacleId;
        updatedDrone.inSimulationConflict = true;

        if (obstacleConflict.severity === 'critical') {
          const timeStr = new Date().toTimeString().split(' ')[0];
          newNotifications.push({
            id: `notif-obs-${drone.id}-${Date.now()}`,
            title: `CRITICAL 3D CONFLICT: ${obstacleConflict.obstacleName}`,
            description: `${drone.callsign} flight vector conflict. Distance: ${obstacleConflict.horizontalDistanceMeters}m | Vertical Clearance: ${obstacleConflict.verticalClearanceMeters}m. ${obstacleConflict.suggestedAction}`,
            timestamp: timeStr,
            severity: 'critical',
            category: obstacleConflict.obstacleType === 'highway_flyover' ? 'highway' : 'building',
            droneId: drone.id,
            droneCallsign: drone.callsign,
            read: false,
            acknowledged: false,
            obstacleId: obstacleConflict.obstacleId,
            actionRequired: obstacleConflict.suggestedAction,
          });
        }
      } else {
        updatedDrone.activeObstacleConflictId = null;
        updatedDrone.inSimulationConflict = false;
      }
    }

    // ─── Predictive Segment Check & Autonomous A* Rerouting ──────
    let conflictDetected = false;
    let conflictReason = '';

    if (obstacleConflict && obstacleConflict.severity === 'critical') {
      conflictDetected = true;
      conflictReason = `3D collision hazard with ${obstacleConflict.obstacleName}`;
    }

    if (airspaceStatus === 'PROHIBITED') {
      conflictDetected = true;
      conflictReason = `Prohibited Red Zone penetration: ${currentZone?.name}`;
    } else if (airspaceStatus === 'PERMISSION_REQUIRED') {
      conflictDetected = true;
      conflictReason = `Yellow Zone authorization missing: ${currentZone?.name}`;
    }

    // Predictive continuous segment check along the active upcoming route
    if (!conflictDetected && targetWp) {
      const p1Metric = geoToMetric(newLng, newLat, newAlt);
      const p2Metric = geoToMetric(targetWp.lng, targetWp.lat, targetWp.altitudeMeters || 65);
      const segCheck = isSegment3DTraversable(p1Metric, p2Metric, updatedDrone, obstacles, officialAirspaceZones, drones, 25);
      if (!segCheck.traversable) {
        conflictDetected = true;
        conflictReason = segCheck.blockedReason || 'Upcoming segment obstructed';
      }
    }

    // A* Intelligent Reroute with Hysteresis (8 seconds cooldown)
    const lastRerouteTime = drone.lastRerouteTimestamp || 0;
    const cooldownPassed = Date.now() - lastRerouteTime > 8000;

    if (conflictDetected && cooldownPassed && !drone.isPaused) {
      const replan = calculateAStarReroute(
        updatedDrone,
        obstacles,
        officialAirspaceZones,
        drones,
        conflictReason
      );

      if (replan.success && replan.proposedRoute.length > 1) {
        if (!updatedDrone.originalRoute || updatedDrone.originalRoute.length === 0) {
          updatedDrone.originalRoute = [...drone.route];
        }
        // Store past completed waypoints
        const completed = updatedRoute.slice(0, targetIndex).filter((w) => w.status === 'completed');
        updatedDrone.completedRouteWaypoints = completed;
        updatedDrone.route = replan.proposedRoute;
        updatedDrone.currentWaypointIndex = 1;
        updatedDrone.targetWaypointIndex = 1;
        updatedDrone.isRerouting = true;
        updatedDrone.routeStatus = 'A_STAR_REROUTED';
        updatedDrone.rerouteReason = conflictReason;
        updatedDrone.lastRerouteTimestamp = Date.now();
        updatedDrone.routeVersion = (updatedDrone.routeVersion || 1) + 1;
        if (replan.candidates) {
          updatedDrone.routeCandidates = replan.candidates;
        }

        if (updatedDrone.route.length > 1) {
          updatedDrone.route[0].status = 'completed';
          updatedDrone.route[1].status = 'active';
          const detourTarget = updatedDrone.route[1];
          updatedDrone.nextWaypointName = detourTarget.name;
          const distToDetour = Math.round(getDistanceMeters(newLat, newLng, detourTarget.lat, detourTarget.lng));
          updatedDrone.distanceToNextWaypointMeters = distToDetour;
          updatedDrone.nextWaypointStatus = distToDetour <= 150 ? 'NEAR_WAYPOINT' : 'APPROACHING';
        }

        const timeStr = new Date().toTimeString().split(' ')[0];
        newLogs.push({
          id: `log-astar-${Date.now()}-${drone.id}`,
          timestamp: timeStr,
          droneId: drone.id,
          droneCallsign: drone.callsign,
          event: `A* Autonomous Reroute: ${conflictReason}. Continuous safe corridor established (+${replan.addedDistanceKm} km, ${replan.proposedRoute.length} checkpoints).`,
          type: 'warning',
        });

        newNotifications.push({
          id: `notif-astar-${Date.now()}-${drone.id}`,
          title: `A* DECONFLICTION REROUTE: ${drone.callsign}`,
          description: `${conflictReason}. Continuous safe corridor established. Destination locked: ${drone.missionDestinationName || 'Mission Pad'}. New Distance: ${replan.alternativeDistanceKm}km (+${replan.addedDistanceKm}km, +${replan.addedDelayMinutes}m).`,
          timestamp: timeStr,
          severity: 'warning',
          category: 'restricted',
          droneId: drone.id,
          droneCallsign: drone.callsign,
          read: false,
          acknowledged: false,
          actionRequired: 'A* Safe Corridor Active',
        });
      } else if (!replan.success) {
        // Hard safety constraint: If route becomes invalid and no alternative is available, pause simulation!
        updatedDrone.isPaused = true;
        updatedDrone.routeStatus = 'NO_SAFE_ROUTE';
        updatedDrone.status = 'hovering';
        updatedDrone.statusLabel = 'HOLD: NO SAFE CORRIDOR TO DESTINATION';
        const timeStr = new Date().toTimeString().split(' ')[0];
        newLogs.push({
          id: `log-blocked-${Date.now()}-${drone.id}`,
          timestamp: timeStr,
          droneId: drone.id,
          droneCallsign: drone.callsign,
          event: `EMERGENCY HOLD: ${replan.reason}. Simulation paused for flight safety.`,
          type: 'critical',
        });
        newNotifications.push({
          id: `notif-blocked-${Date.now()}-${drone.id}`,
          title: `SIMULATION PAUSED: ${drone.callsign}`,
          description: `No valid corridor can be found to destination avoiding restricted airspace. Aircraft entered hover hold.`,
          timestamp: timeStr,
          severity: 'critical',
          category: 'restricted',
          droneId: drone.id,
          droneCallsign: drone.callsign,
          read: false,
          acknowledged: false,
          actionRequired: 'Manual Destination Reassignment Required',
        });
      }
    }

    return updatedDrone;
  });

  // ─── Drone-to-Drone Separation Radar Conflicts ─────────────────
  const conflicts: AirspaceConflict[] = [];
  for (let i = 0; i < updatedDrones.length; i++) {
    for (let j = i + 1; j < updatedDrones.length; j++) {
      const dA = updatedDrones[i];
      const dB = updatedDrones[j];

      const dist = getDistanceMeters(
        dA.vitals.latitude,
        dA.vitals.longitude,
        dB.vitals.latitude,
        dB.vitals.longitude
      );
      const altDiff = Math.abs(dA.vitals.altitudeMeters - dB.vitals.altitudeMeters);

      // Trajectory conflict threshold: < 220m horizontal and < 25m vertical
      if (dist < 220 && altDiff < 25) {
        const speedSum = dA.vitals.groundSpeedKmh + dB.vitals.groundSpeedKmh;
        const conflictSec = Math.round(dist / Math.max(1, (speedSum * 1000) / 3600));
        
        conflicts.push({
          id: `conf-${dA.id}-${dB.id}`,
          droneAId: dA.id,
          droneBId: dB.id,
          distanceMeters: Math.round(dist),
          estimatedTimeToConflictSec: Math.max(4, conflictSec),
          predictedLocation: [
            (dA.vitals.longitude + dB.vitals.longitude) / 2,
            (dA.vitals.latitude + dB.vitals.latitude) / 2,
          ],
          suggestedAction: `Climb ${dA.callsign} to ${Math.round(dA.vitals.altitudeMeters + 30)}m; Descend ${dB.callsign} to ${Math.max(35, Math.round(dB.vitals.altitudeMeters - 20))}m.`,
          severity: dist < 100 ? 'critical' : 'warning',
        });
      }
    }
  }

  return {
    updatedDrones,
    newLogs,
    conflicts,
    obstacleConflicts,
    newNotifications,
  };
}

// Generate an A* intelligent detour around restricted airspace in Coimbatore
export function generateSmartReplan(
  drone: Drone,
  obstacles: Obstacle[] = [],
  officialZones: OfficialAirspaceZone[] = OFFICIAL_COIMBATORE_AIRSPACE_ZONES,
  allDrones: Drone[] = []
): ReplanResult {
  return calculateAStarReroute(
    drone,
    obstacles,
    officialZones,
    allDrones,
    'Manual Operator Replan Request'
  );
}
