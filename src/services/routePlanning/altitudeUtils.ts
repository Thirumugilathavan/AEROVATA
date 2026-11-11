/**
 * Altitude References and Elevation Utilities
 * AEROVATA by TASPORA - UTM Autonomous Airspace Command
 * 
 * Provides rigorous conversion between Altitude Above Ground Level (AGL)
 * and Altitude Above Mean Sea Level (AMSL), taking ground terrain elevation
 * into account. Enforces DGCA 2021 regulatory ceilings (120m AGL).
 */

import { AltitudeLimitsConfig, AltitudeReference } from './types';

export const DEFAULT_ALTITUDE_CONFIG: AltitudeLimitsConfig = {
  frameworkName: 'DGCA Drone Rules 2021 & DigitalSky UTM Framework',
  minFlightAltitudeMeters: 20,       // 20m AGL minimum safe cruise altitude
  maxPermittedCeilingMeters: 120,    // 120m AGL (400 ft) statutory ceiling
  defaultCruiseAltitudeMeters: 65,   // 65m AGL nominal urban transit altitude
  defaultHorizontalBufferMeters: 25, // 25m horizontal structure buffer
  defaultVerticalBufferMeters: 15,   // 15m vertical clearance buffer above rooftop
  droneRadiusMeters: 1.5,            // 1.5m drone physical boundary envelope
  maxClimbRateMs: 4.0,               // 4.0 m/s maximum safe climb rate
  maxDescentRateMs: 2.5,             // 2.5 m/s maximum safe descent rate
  cruiseSpeedKmh: 48.0,              // 48.0 km/h simulation cruise speed (13.33 m/s)
};

/**
 * Standard ground elevation AMSL across Coimbatore urban corridor (metres).
 * Average MSL datum for Coimbatore plain: ~411m.
 */
export const DEFAULT_REGIONAL_GROUND_ELEVATION_METERS = 411.0;

/**
 * Converts Altitude Above Ground Level (AGL) to Altitude Above Mean Sea Level (AMSL).
 * AMSL = AGL + groundElevation
 */
export function aglToAmsl(
  aglMeters: number, 
  groundElevationMeters: number = DEFAULT_REGIONAL_GROUND_ELEVATION_METERS
): number {
  if (!Number.isFinite(aglMeters)) return NaN;
  const ground = Number.isFinite(groundElevationMeters) 
    ? groundElevationMeters 
    : DEFAULT_REGIONAL_GROUND_ELEVATION_METERS;
  return Math.round((aglMeters + ground) * 100) / 100;
}

/**
 * Converts Altitude Above Mean Sea Level (AMSL) to Altitude Above Ground Level (AGL).
 * AGL = AMSL - groundElevation
 */
export function amslToAgl(
  amslMeters: number, 
  groundElevationMeters: number = DEFAULT_REGIONAL_GROUND_ELEVATION_METERS
): number {
  if (!Number.isFinite(amslMeters)) return NaN;
  const ground = Number.isFinite(groundElevationMeters) 
    ? groundElevationMeters 
    : DEFAULT_REGIONAL_GROUND_ELEVATION_METERS;
  return Math.round((amslMeters - ground) * 100) / 100;
}

/**
 * Normalizes an altitude value to AGL given its reference.
 */
export function normalizeToAgl(
  altitudeMeters: number,
  reference: AltitudeReference,
  groundElevationMeters: number = DEFAULT_REGIONAL_GROUND_ELEVATION_METERS
): number {
  if (reference === 'AMSL') {
    return amslToAgl(altitudeMeters, groundElevationMeters);
  }
  return altitudeMeters;
}

/**
 * Validates that an altitude is within permitted operational and regulatory limits.
 * Rejects non-finite values, negative altitudes, and altitudes exceeding the 120m AGL ceiling.
 */
export function validateAltitudeWithinLimits(
  altitudeMeters: number,
  reference: AltitudeReference = 'AGL',
  groundElevationMeters: number = DEFAULT_REGIONAL_GROUND_ELEVATION_METERS,
  config: AltitudeLimitsConfig = DEFAULT_ALTITUDE_CONFIG
): { valid: boolean; aglMeters: number; amslMeters: number; reason?: string } {
  if (!Number.isFinite(altitudeMeters)) {
    return {
      valid: false,
      aglMeters: NaN,
      amslMeters: NaN,
      reason: 'Altitude value is not a finite number',
    };
  }

  const agl = normalizeToAgl(altitudeMeters, reference, groundElevationMeters);
  const amsl = aglToAmsl(agl, groundElevationMeters);

  if (agl < 0) {
    return {
      valid: false,
      aglMeters: agl,
      amslMeters: amsl,
      reason: `Negative altitude (${agl}m AGL) is below ground level`,
    };
  }

  if (agl > config.maxPermittedCeilingMeters) {
    return {
      valid: false,
      aglMeters: agl,
      amslMeters: amsl,
      reason: `Altitude ${agl}m AGL exceeds statutory ${config.maxPermittedCeilingMeters}m AGL regulatory ceiling under ${config.frameworkName}`,
    };
  }

  return {
    valid: true,
    aglMeters: agl,
    amslMeters: amsl,
  };
}
