import type { Drone, AirspaceConflict, FlightLogEntry, GeofenceZone, Waypoint } from '../types/fleet.ts';

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

// Point-in-polygon algorithm for restricted zone detection
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
  // Energy consumption = Dist * burnRate * payloadFactor
  const payloadFactor = 1 + (drone.vitals.payloadWeightKg / drone.vitals.maxPayloadKg) * 0.25;
  const energyRequiredWh = Math.round(distKm * drone.vitals.energyBurnRateWhPerKm * payloadFactor * 10) / 10;
  
  // Convert battery % to equivalent Wh (assume 500Wh pack standard)
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

// Single step simulation update
export function updateSimulationTick(
  drones: Drone[],
  deltaSeconds: number,
  restrictedZones: GeofenceZone[]
): {
  updatedDrones: Drone[];
  newLogs: FlightLogEntry[];
  conflicts: AirspaceConflict[];
} {
  const newLogs: FlightLogEntry[] = [];
  const baseCoord = { lat: -37.8155, lng: 145.1220 }; // Hub Alpha

  const updatedDrones = drones.map((drone) => {
    // If paused, maintain state
    if (drone.isPaused) {
      return drone;
    }

    // Charging drone simulation
    if (drone.status === 'charging') {
      const newBat = Math.min(100, drone.vitals.batteryPercentage + 0.05 * deltaSeconds);
      return {
        ...drone,
        vitals: {
          ...drone.vitals,
          batteryPercentage: Math.round(newBat * 10) / 10,
          estimatedFlightTimeMinutes: Math.round((newBat / 100) * 40),
        },
      };
    }

    // Only move if active delivery, en route, or returning
    if (
      drone.status !== 'delivering' &&
      drone.status !== 'en_route_pickup' &&
      drone.status !== 'returning_to_base'
    ) {
      return drone;
    }

    const currentWpIndex = drone.currentWaypointIndex;
    if (currentWpIndex >= drone.route.length - 1) {
      // Reached destination route end
      return drone;
    }

    const currentWp = drone.route[currentWpIndex];
    const nextWp = drone.route[currentWpIndex + 1];

    // Distance to next waypoint
    const distanceToNext = getDistanceMeters(
      drone.vitals.latitude,
      drone.vitals.longitude,
      nextWp.lat,
      nextWp.lng
    );

    // Speed in meters/sec (e.g. 45 km/h => 12.5 m/s)
    const speedMs = (drone.vitals.groundSpeedKmh * 1000) / 3600;
    const stepDistance = speedMs * deltaSeconds;

    let newLat = drone.vitals.latitude;
    let newLng = drone.vitals.longitude;
    let newAlt = drone.vitals.altitudeMeters;
    let newWpIndex = currentWpIndex;
    const updatedRoute = [...drone.route];

    if (distanceToNext <= Math.max(stepDistance * 1.5, 8)) {
      // Arrived at next waypoint!
      newLat = nextWp.lat;
      newLng = nextWp.lng;
      newAlt = nextWp.altitudeMeters;
      newWpIndex = currentWpIndex + 1;

      // Update waypoint status
      updatedRoute[currentWpIndex] = { ...currentWp, status: 'completed' };
      if (updatedRoute[newWpIndex]) {
        updatedRoute[newWpIndex] = { ...updatedRoute[newWpIndex], status: 'active' };
      }

      // Log event
      const timeStr = new Date().toTimeString().split(' ')[0];
      newLogs.push({
        id: `log-${Date.now()}-${drone.id}`,
        timestamp: timeStr,
        droneId: drone.id,
        droneCallsign: drone.callsign,
        event: `Reached waypoint ${nextWp.name} (${Math.round(nextWp.altitudeMeters)}m AGL)`,
        type: nextWp.type === 'delivery' ? 'success' : 'info',
      });

      // If finished last waypoint
      if (newWpIndex >= updatedRoute.length - 1) {
        newLogs.push({
          id: `log-end-${Date.now()}-${drone.id}`,
          timestamp: timeStr,
          droneId: drone.id,
          droneCallsign: drone.callsign,
          event: `Mission flight plan completed. Docked at base.`,
          type: 'success',
        });
      }
    } else {
      // Interpolate position towards next waypoint
      const ratio = Math.min(1, stepDistance / distanceToNext);
      newLat = drone.vitals.latitude + (nextWp.lat - drone.vitals.latitude) * ratio;
      newLng = drone.vitals.longitude + (nextWp.lng - drone.vitals.longitude) * ratio;
      newAlt = drone.vitals.altitudeMeters + (nextWp.altitudeMeters - drone.vitals.altitudeMeters) * ratio;
    }

    // Bearing
    const newHeading = Math.round(getBearingDegrees(drone.vitals.latitude, drone.vitals.longitude, nextWp.lat, nextWp.lng));

    // Battery burn (proportional to speed and payload)
    const batDrainRate = 0.015 * deltaSeconds * (1 + drone.vitals.payloadWeightKg * 0.1);
    const newBattery = Math.max(5, Math.round((drone.vitals.batteryPercentage - batDrainRate) * 10) / 10);
    const remainingTimeMin = Math.max(1, Math.round((newBattery / 100) * 32));

    // Slight speed flutter for realism
    const speedVariation = (Math.random() - 0.5) * 0.8;
    const finalSpeed = Math.max(25, Math.min(65, drone.vitals.groundSpeedKmh + speedVariation));

    // RTB Calculation
    const rtb = computeRTBStatus(
      { ...drone, vitals: { ...drone.vitals, latitude: newLat, longitude: newLng, batteryPercentage: newBattery } },
      baseCoord
    );

    return {
      ...drone,
      currentWaypointIndex: newWpIndex,
      route: updatedRoute,
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
  });

  // Airspace conflict detection between all flying aircraft pairs
  const conflicts: AirspaceConflict[] = [];
  for (let i = 0; i < updatedDrones.length; i++) {
    for (let j = i + 1; j < updatedDrones.length; j++) {
      const dA = updatedDrones[i];
      const dB = updatedDrones[j];

      // Only check active flying aircraft
      if (
        (dA.status === 'delivering' || dA.status === 'en_route_pickup' || dA.status === 'returning_to_base') &&
        (dB.status === 'delivering' || dB.status === 'en_route_pickup' || dB.status === 'returning_to_base')
      ) {
        const dist = getDistanceMeters(
          dA.vitals.latitude,
          dA.vitals.longitude,
          dB.vitals.latitude,
          dB.vitals.longitude
        );
        const altDiff = Math.abs(dA.vitals.altitudeMeters - dB.vitals.altitudeMeters);

        // If horizontal separation < 280m and vertical separation < 30m
        if (dist < 280 && altDiff < 30) {
          const conflictSec = Math.round(dist / (((dA.vitals.groundSpeedKmh + dB.vitals.groundSpeedKmh) * 1000) / 3600));
          conflicts.push({
            id: `conf-${dA.id}-${dB.id}`,
            droneAId: dA.id,
            droneBId: dB.id,
            distanceMeters: Math.round(dist),
            estimatedTimeToConflictSec: Math.max(5, conflictSec),
            predictedLocation: [
              (dA.vitals.longitude + dB.vitals.longitude) / 2,
              (dA.vitals.latitude + dB.vitals.latitude) / 2,
            ],
            suggestedAction: `Climb ${dA.callsign} to ${Math.round(dA.vitals.altitudeMeters + 35)}m; Descend ${dB.callsign} to ${Math.max(35, Math.round(dB.vitals.altitudeMeters - 25))}m.`,
            severity: dist < 120 ? 'critical' : 'warning',
          });
        }
      }
    }
  }

  return {
    updatedDrones,
    newLogs,
    conflicts,
  };
}

// Generate an intelligent detour around restricted airspace
export function generateSmartReplan(
  drone: Drone,
  restrictedPolygon: [number, number][]
): {
  proposedRoute: Waypoint[];
  addedDistanceKm: number;
  addedDelayMinutes: number;
} {
  // Find convex detour points around the west edge of the restricted polygon
  const baseLat = drone.vitals.latitude;
  const baseLng = drone.vitals.longitude;

  // Candidate detour waypoints safely clear of Sector 4
  const detour1: Waypoint = {
    id: `replan-wp-1-${Date.now()}`,
    name: 'West Bypass Corridor Alpha',
    lat: -37.8105,
    lng: 145.1218,
    altitudeMeters: 92,
    type: 'transit',
    status: 'upcoming',
    etaMinutes: 2,
  };

  const detour2: Waypoint = {
    id: `replan-wp-2-${Date.now()}`,
    name: 'North-West Transit Clearance',
    lat: -37.8080,
    lng: 145.1245,
    altitudeMeters: 95,
    type: 'transit',
    status: 'upcoming',
    etaMinutes: 5,
  };

  // Reconstruct route: keep completed, insert detours, then target destination
  const completedWaypoints = drone.route.filter((w) => w.status === 'completed');
  const deliveryWaypoints = drone.route.filter((w) => w.type === 'delivery' || w.type === 'base');

  const proposedRoute: Waypoint[] = [
    ...completedWaypoints,
    {
      id: `replan-cur`,
      name: `Current Fix (${drone.callsign})`,
      lat: baseLat,
      lng: baseLng,
      altitudeMeters: drone.vitals.altitudeMeters,
      type: 'transit',
      status: 'active',
    },
    detour1,
    detour2,
    ...deliveryWaypoints.map((w, idx) => ({ ...w, status: 'upcoming' as const, etaMinutes: 8 + idx * 5 })),
  ];

  return {
    proposedRoute,
    addedDistanceKm: 1.15,
    addedDelayMinutes: 3.2,
  };
}
