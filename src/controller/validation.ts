/**
 * Mission Data Validation Module
 * AEROVATA by TASPORA - Standalone Mission Controller
 * 
 * Validates mission structure, coordinates, sequences, and tolerances.
 * Rejects invalid routes and triggers controller error states.
 */

import type { Checkpoint, Mission } from '../types/mission';
import { getDistanceMeters } from '../services/telemetryEngine';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  field?: string;
  checkpointIndex?: number;
}

export function validateMission(mission: Mission | null | undefined): ValidationResult {
  if (!mission) {
    return { valid: false, error: 'Mission payload is null or undefined' };
  }

  if (!mission.id || typeof mission.id !== 'string' || mission.id.trim() === '') {
    return { valid: false, error: 'Mission must have a non-empty unique identifier', field: 'id' };
  }

  if (!mission.droneId || typeof mission.droneId !== 'string' || mission.droneId.trim() === '') {
    return { valid: false, error: 'Mission must specify an assigned droneId', field: 'droneId' };
  }

  if (!Array.isArray(mission.checkpoints)) {
    return { valid: false, error: 'Mission checkpoints must be an array', field: 'checkpoints' };
  }

  if (mission.checkpoints.length < 2) {
    return {
      valid: false,
      error: `Invalid checkpoint count (${mission.checkpoints.length}). A flight mission requires at least 2 checkpoints (origin and destination).`,
      field: 'checkpoints',
    };
  }

  for (let i = 0; i < mission.checkpoints.length; i++) {
    const cp = mission.checkpoints[i];
    const cpNum = i + 1;

    if (!cp.id || typeof cp.id !== 'string') {
      return { valid: false, error: `Checkpoint #${cpNum} missing valid ID`, field: 'id', checkpointIndex: i };
    }

    if (typeof cp.lat !== 'number' || isNaN(cp.lat) || cp.lat < -90 || cp.lat > 90) {
      return {
        valid: false,
        error: `Checkpoint #${cpNum} (${cp.name || cp.id}) has invalid latitude: ${cp.lat}. Must be between -90 and 90.`,
        field: 'lat',
        checkpointIndex: i,
      };
    }

    if (typeof cp.lng !== 'number' || isNaN(cp.lng) || cp.lng < -180 || cp.lng > 180) {
      return {
        valid: false,
        error: `Checkpoint #${cpNum} (${cp.name || cp.id}) has invalid longitude: ${cp.lng}. Must be between -180 and 180.`,
        field: 'lng',
        checkpointIndex: i,
      };
    }

    if (typeof cp.altitudeMeters !== 'number' || isNaN(cp.altitudeMeters) || cp.altitudeMeters < 0) {
      return {
        valid: false,
        error: `Checkpoint #${cpNum} (${cp.name || cp.id}) has invalid altitude: ${cp.altitudeMeters}m. Altitude cannot be negative.`,
        field: 'altitudeMeters',
        checkpointIndex: i,
      };
    }

    if (typeof cp.targetSpeedKmh !== 'number' || isNaN(cp.targetSpeedKmh) || cp.targetSpeedKmh <= 0 || cp.targetSpeedKmh > 200) {
      return {
        valid: false,
        error: `Checkpoint #${cpNum} (${cp.name || cp.id}) has invalid targetSpeedKmh: ${cp.targetSpeedKmh}. Must be between 1 and 200 km/h.`,
        field: 'targetSpeedKmh',
        checkpointIndex: i,
      };
    }

    if (typeof cp.arrivalRadiusMeters !== 'number' || isNaN(cp.arrivalRadiusMeters) || cp.arrivalRadiusMeters <= 0) {
      return {
        valid: false,
        error: `Checkpoint #${cpNum} (${cp.name || cp.id}) has invalid arrivalRadiusMeters: ${cp.arrivalRadiusMeters}. Must be greater than 0.`,
        field: 'arrivalRadiusMeters',
        checkpointIndex: i,
      };
    }

    if (typeof cp.dwellTimeSeconds !== 'number' || isNaN(cp.dwellTimeSeconds) || cp.dwellTimeSeconds < 0) {
      return {
        valid: false,
        error: `Checkpoint #${cpNum} (${cp.name || cp.id}) has invalid dwellTimeSeconds: ${cp.dwellTimeSeconds}. Cannot be negative.`,
        field: 'dwellTimeSeconds',
        checkpointIndex: i,
      };
    }
  }

  // Ensure consecutive checkpoints are not duplicate coordinates (< 1 meter)
  for (let i = 0; i < mission.checkpoints.length - 1; i++) {
    const a = mission.checkpoints[i];
    const b = mission.checkpoints[i + 1];
    const dist = getDistanceMeters(a.lat, a.lng, b.lat, b.lng);
    if (dist < 1.0) {
      return {
        valid: false,
        error: `Checkpoint #${i + 1} and #${i + 2} have identical coordinates (separation: ${dist.toFixed(2)}m). Consecutive checkpoints must have non-zero separation.`,
        checkpointIndex: i + 1,
      };
    }
  }

  return { valid: true };
}
