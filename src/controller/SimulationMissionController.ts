/**
 * Standalone Simulation Mission Controller
 * AEROVATA by TASPORA - Drone Flight Simulation Engine
 * 
 * Implements checkpoint following, kinematic physics, automatic waypoint advancement,
 * dwell time loitering, battery drain modeling, and telemetry streaming.
 * For simulation and software demonstration only. Do not issue commands to physical aircraft.
 */

import type { Checkpoint, Mission, MissionState, MissionTelemetry } from '../types/mission';
import type { IMissionController } from './types';
import { MissionStateMachine } from './MissionStateMachine';
import { validateMission } from './validation';
import { getDistanceMeters, getBearingDegrees } from '../services/telemetryEngine';

export class SimulationMissionController implements IMissionController {
  private stateMachine: MissionStateMachine;
  private currentMission: Mission | null = null;
  private currentTelemetry: MissionTelemetry | null = null;
  private speedMultiplier: number = 1;
  private listeners: ((mission: Mission, telemetry: MissionTelemetry) => void)[] = [];
  private intervalId: any = null;
  private isDwellActive: boolean = false;
  private dwellRemainingSeconds: number = 0;

  constructor() {
    this.stateMachine = new MissionStateMachine('idle');
  }

  public loadMission(mission: Mission): { success: boolean; error?: string } {
    // Halt any running simulation loop before loading new mission
    this.stopInternalTicker();

    // Deep clone to prevent unintended mutations from caller
    const clonedMission: Mission = JSON.parse(JSON.stringify(mission));

    const validation = validateMission(clonedMission);
    if (!validation.valid) {
      this.stateMachine.forceError(validation.error || 'Invalid mission input data');
      clonedMission.status = 'error';
      clonedMission.errorMessage = validation.error;
      this.currentMission = clonedMission;
      this.currentTelemetry = this.createDefaultTelemetry(clonedMission, 'error');
      this.notifyListeners();
      return { success: false, error: validation.error };
    }

    // Calculate total route distance
    let totalDist = 0;
    for (let i = 0; i < clonedMission.checkpoints.length - 1; i++) {
      const a = clonedMission.checkpoints[i];
      const b = clonedMission.checkpoints[i + 1];
      totalDist += getDistanceMeters(a.lat, a.lng, b.lat, b.lng);
    }
    clonedMission.totalDistanceMeters = Math.round(totalDist);

    // Initialize checkpoint statuses
    clonedMission.checkpoints = clonedMission.checkpoints.map((cp, idx) => ({
      ...cp,
      status: idx === 0 ? 'reached' : idx === 1 ? 'active' : 'pending',
    }));
    clonedMission.currentCheckpointIndex = 1;
    clonedMission.elapsedTimeSeconds = 0;
    clonedMission.progressPercent = 0;
    clonedMission.status = 'idle';
    clonedMission.errorMessage = undefined;

    this.stateMachine.reset();
    this.currentMission = clonedMission;
    this.isDwellActive = false;
    this.dwellRemainingSeconds = 0;

    // Initial telemetry positioned at origin checkpoint 0
    const startCp = clonedMission.checkpoints[0];
    const nextCp = clonedMission.checkpoints[1];
    const initialHeading = Math.round(getBearingDegrees(startCp.lat, startCp.lng, nextCp.lat, nextCp.lng));

    this.currentTelemetry = {
      droneId: clonedMission.droneId,
      timestamp: Date.now(),
      lat: startCp.lat,
      lng: startCp.lng,
      altitudeMeters: startCp.altitudeMeters,
      headingDegrees: initialHeading,
      groundSpeedKmh: 0,
      verticalSpeedMs: 0,
      batteryPercentage: 98.5,
      batteryVoltage: 24.8,
      signalQualityPercent: 99,
      rtkFix: 'RTK_FIX',
      satellites: 20,
      currentCheckpointIndex: 1,
      distanceToNextCheckpointMeters: Math.round(getDistanceMeters(startCp.lat, startCp.lng, nextCp.lat, nextCp.lng)),
      missionStatus: 'idle',
      isDwellActive: false,
    };

    this.notifyListeners();
    return { success: true };
  }

  public start(): boolean {
    if (!this.currentMission) return false;

    if (this.stateMachine.getState() === 'paused') {
      return this.resume();
    }

    if (this.stateMachine.transition('running', 'Mission started')) {
      this.currentMission.status = 'running';
      if (this.currentTelemetry) {
        this.currentTelemetry.missionStatus = 'running';
      }
      this.startInternalTicker();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  public pause(): boolean {
    if (!this.currentMission) return false;

    if (this.stateMachine.transition('paused', 'Mission paused by operator')) {
      this.stopInternalTicker();
      this.currentMission.status = 'paused';
      if (this.currentTelemetry) {
        this.currentTelemetry.missionStatus = 'paused';
        this.currentTelemetry.groundSpeedKmh = 0;
        this.currentTelemetry.verticalSpeedMs = 0;
      }
      this.notifyListeners();
      return true;
    }
    return false;
  }

  public resume(): boolean {
    if (!this.currentMission) return false;

    if (this.stateMachine.transition('running', 'Mission resumed by operator')) {
      this.currentMission.status = 'running';
      if (this.currentTelemetry) {
        this.currentTelemetry.missionStatus = 'running';
      }
      this.startInternalTicker();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  public reset(): void {
    if (!this.currentMission) return;

    this.stopInternalTicker();
    this.stateMachine.reset();

    // Reset checkpoints
    this.currentMission.checkpoints = this.currentMission.checkpoints.map((cp, idx) => ({
      ...cp,
      status: idx === 0 ? 'reached' : idx === 1 ? 'active' : 'pending',
    }));

    this.currentMission.currentCheckpointIndex = 1;
    this.currentMission.elapsedTimeSeconds = 0;
    this.currentMission.progressPercent = 0;
    this.currentMission.status = 'idle';
    this.currentMission.errorMessage = undefined;
    this.currentMission.dwellRemainingSeconds = 0;

    this.isDwellActive = false;
    this.dwellRemainingSeconds = 0;

    const startCp = this.currentMission.checkpoints[0];
    const nextCp = this.currentMission.checkpoints[1];
    const initialHeading = Math.round(getBearingDegrees(startCp.lat, startCp.lng, nextCp.lat, nextCp.lng));

    this.currentTelemetry = {
      droneId: this.currentMission.droneId,
      timestamp: Date.now(),
      lat: startCp.lat,
      lng: startCp.lng,
      altitudeMeters: startCp.altitudeMeters,
      headingDegrees: initialHeading,
      groundSpeedKmh: 0,
      verticalSpeedMs: 0,
      batteryPercentage: 98.5,
      batteryVoltage: 24.8,
      signalQualityPercent: 99,
      rtkFix: 'RTK_FIX',
      satellites: 20,
      currentCheckpointIndex: 1,
      distanceToNextCheckpointMeters: Math.round(getDistanceMeters(startCp.lat, startCp.lng, nextCp.lat, nextCp.lng)),
      missionStatus: 'idle',
      isDwellActive: false,
    };

    this.notifyListeners();
  }

  public getState(): MissionState {
    return this.stateMachine.getState();
  }

  public getMission(): Mission | null {
    return this.currentMission;
  }

  public getTelemetry(): MissionTelemetry | null {
    return this.currentTelemetry;
  }

  public setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Math.max(0.25, Math.min(20, multiplier));
  }

  public getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  public injectFault(reason: string): void {
    this.stopInternalTicker();
    this.stateMachine.forceError(reason);
    if (this.currentMission) {
      this.currentMission.status = 'error';
      this.currentMission.errorMessage = reason;
    }
    if (this.currentTelemetry) {
      this.currentTelemetry.missionStatus = 'error';
      this.currentTelemetry.groundSpeedKmh = 0;
    }
    this.notifyListeners();
  }

  /**
   * Deterministic simulation step.
   * Can be invoked directly by unit tests or periodically by ticker.
   */
  public step(deltaSeconds: number): void {
    if (!this.currentMission || !this.currentTelemetry) return;
    if (this.stateMachine.getState() !== 'running') return;

    const checkpoints = this.currentMission.checkpoints;
    let targetIdx = this.currentMission.currentCheckpointIndex;

    if (targetIdx >= checkpoints.length) {
      // Reached final checkpoint
      this.finishMission();
      return;
    }

    const targetCp = checkpoints[targetIdx];
    this.currentMission.elapsedTimeSeconds += deltaSeconds;

    // 1. Handle Active Dwell / Loiter at current checkpoint
    if (this.isDwellActive) {
      this.dwellRemainingSeconds -= deltaSeconds;
      this.currentMission.dwellRemainingSeconds = Math.max(0, Math.ceil(this.dwellRemainingSeconds));
      this.currentTelemetry.isDwellActive = true;
      this.currentTelemetry.groundSpeedKmh = 0;
      this.currentTelemetry.verticalSpeedMs = 0;

      // Slight battery drain during hover
      this.currentTelemetry.batteryPercentage = Math.max(
        5,
        Math.round((this.currentTelemetry.batteryPercentage - 0.02 * deltaSeconds) * 10) / 10
      );

      if (this.dwellRemainingSeconds <= 0) {
        // Finished dwell!
        this.isDwellActive = false;
        this.currentMission.dwellRemainingSeconds = 0;
        this.currentTelemetry.isDwellActive = false;

        // Advance to next checkpoint
        this.advanceToNextCheckpoint();
      }

      this.updateProgress();
      this.notifyListeners();
      return;
    }

    // 2. Fly toward target checkpoint
    const currentLat = this.currentTelemetry.lat;
    const currentLng = this.currentTelemetry.lng;
    const currentAlt = this.currentTelemetry.altitudeMeters;

    const distanceToNext = getDistanceMeters(currentLat, currentLng, targetCp.lat, targetCp.lng);
    const speedKmh = targetCp.targetSpeedKmh;
    const speedMs = (speedKmh * 1000) / 3600;
    const stepMeters = speedMs * deltaSeconds;

    // Check if drone has arrived at the checkpoint (within arrival radius or traversed past it)
    const effectiveRadius = Math.max(targetCp.arrivalRadiusMeters, stepMeters * 1.1);

    if (distanceToNext <= effectiveRadius) {
      // Arrived at target checkpoint!
      this.currentTelemetry.lat = targetCp.lat;
      this.currentTelemetry.lng = targetCp.lng;
      this.currentTelemetry.altitudeMeters = targetCp.altitudeMeters;
      this.currentTelemetry.distanceToNextCheckpointMeters = 0;

      // Checkpoint reached
      targetCp.status = 'reached';

      if (targetCp.dwellTimeSeconds > 0) {
        // Enter dwell / loiter phase
        this.isDwellActive = true;
        this.dwellRemainingSeconds = targetCp.dwellTimeSeconds;
        this.currentMission.dwellRemainingSeconds = targetCp.dwellTimeSeconds;
        this.currentTelemetry.isDwellActive = true;
        this.currentTelemetry.groundSpeedKmh = 0;
      } else {
        // Immediate fly-through: advance to next checkpoint
        this.advanceToNextCheckpoint();
      }
    } else {
      // Interpolate position along leg
      const ratio = Math.min(1, stepMeters / distanceToNext);
      const newLat = currentLat + (targetCp.lat - currentLat) * ratio;
      const newLng = currentLng + (targetCp.lng - currentLng) * ratio;
      const newAlt = currentAlt + (targetCp.altitudeMeters - currentAlt) * ratio;

      const heading = Math.round(getBearingDegrees(currentLat, currentLng, targetCp.lat, targetCp.lng));
      const vertSpeed = (newAlt - currentAlt) / deltaSeconds;

      this.currentTelemetry.lat = newLat;
      this.currentTelemetry.lng = newLng;
      this.currentTelemetry.altitudeMeters = Math.round(newAlt * 10) / 10;
      this.currentTelemetry.headingDegrees = heading;
      this.currentTelemetry.groundSpeedKmh = speedKmh;
      this.currentTelemetry.verticalSpeedMs = Math.round(vertSpeed * 10) / 10;
      this.currentTelemetry.distanceToNextCheckpointMeters = Math.round(
        getDistanceMeters(newLat, newLng, targetCp.lat, targetCp.lng)
      );

      // Battery drain calculation
      const batDrain = 0.012 * deltaSeconds * (speedKmh / 40);
      this.currentTelemetry.batteryPercentage = Math.max(
        5,
        Math.round((this.currentTelemetry.batteryPercentage - batDrain) * 10) / 10
      );
      this.currentTelemetry.batteryVoltage = Math.round((21.0 + (this.currentTelemetry.batteryPercentage / 100) * 4.2) * 10) / 10;
    }

    this.currentTelemetry.timestamp = Date.now();
    this.updateProgress();
    this.notifyListeners();
  }

  private advanceToNextCheckpoint(): void {
    if (!this.currentMission) return;

    const nextIdx = this.currentMission.currentCheckpointIndex + 1;
    if (nextIdx < this.currentMission.checkpoints.length) {
      this.currentMission.currentCheckpointIndex = nextIdx;
      this.currentMission.checkpoints[nextIdx].status = 'active';
      if (this.currentTelemetry) {
        this.currentTelemetry.currentCheckpointIndex = nextIdx;
        const nextCp = this.currentMission.checkpoints[nextIdx];
        this.currentTelemetry.distanceToNextCheckpointMeters = Math.round(
          getDistanceMeters(this.currentTelemetry.lat, this.currentTelemetry.lng, nextCp.lat, nextCp.lng)
        );
      }
    } else {
      // Finished all checkpoints!
      this.finishMission();
    }
  }

  private finishMission(): void {
    if (!this.currentMission || !this.currentTelemetry) return;

    this.stopInternalTicker();
    this.stateMachine.transition('completed', 'All checkpoints reached successfully');
    this.currentMission.status = 'completed';
    this.currentMission.progressPercent = 100;
    this.currentMission.estimatedRemainingSeconds = 0;

    // Mark final checkpoint reached
    const finalCp = this.currentMission.checkpoints[this.currentMission.checkpoints.length - 1];
    if (finalCp) {
      finalCp.status = 'reached';
    }

    this.currentTelemetry.missionStatus = 'completed';
    this.currentTelemetry.groundSpeedKmh = 0;
    this.currentTelemetry.verticalSpeedMs = 0;
    this.currentTelemetry.distanceToNextCheckpointMeters = 0;
    this.notifyListeners();
  }

  private updateProgress(): void {
    if (!this.currentMission || !this.currentTelemetry) return;

    const checkpoints = this.currentMission.checkpoints;
    const curIdx = this.currentMission.currentCheckpointIndex;

    // Calculate completed distance
    let completedDist = 0;
    for (let i = 0; i < curIdx - 1; i++) {
      completedDist += getDistanceMeters(
        checkpoints[i].lat,
        checkpoints[i].lng,
        checkpoints[i + 1].lat,
        checkpoints[i + 1].lng
      );
    }

    // Add distance traversed along current leg
    if (curIdx > 0 && curIdx < checkpoints.length) {
      const prevCp = checkpoints[curIdx - 1];
      const legDist = getDistanceMeters(prevCp.lat, prevCp.lng, checkpoints[curIdx].lat, checkpoints[curIdx].lng);
      const remainingLeg = this.currentTelemetry.distanceToNextCheckpointMeters;
      completedDist += Math.max(0, legDist - remainingLeg);
    }

    const totalDist = this.currentMission.totalDistanceMeters || 1;
    this.currentMission.progressPercent = Math.min(100, Math.round((completedDist / totalDist) * 100));

    // Remaining time estimate
    const remainingMeters = Math.max(0, totalDist - completedDist);
    const avgSpeedMs = (45 * 1000) / 3600;
    this.currentMission.estimatedRemainingSeconds = Math.round(remainingMeters / avgSpeedMs);
  }

  public subscribe(listener: (mission: Mission, telemetry: MissionTelemetry) => void): () => void {
    this.listeners.push(listener);
    if (this.currentMission && this.currentTelemetry) {
      listener(this.currentMission, this.currentTelemetry);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    if (!this.currentMission || !this.currentTelemetry) return;
    for (const listener of this.listeners) {
      try {
        listener(this.currentMission, this.currentTelemetry);
      } catch (err) {
        console.error('Error in controller listener:', err);
      }
    }
  }

  private startInternalTicker(): void {
    this.stopInternalTicker();
    const tickHz = 10; // 10 updates per second for smooth rendering
    const intervalMs = 1000 / tickHz;

    this.intervalId = setInterval(() => {
      const deltaSec = (1 / tickHz) * this.speedMultiplier;
      this.step(deltaSec);
    }, intervalMs);
  }

  private stopInternalTicker(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private createDefaultTelemetry(mission: Mission, status: MissionState): MissionTelemetry {
    const cp = mission.checkpoints[0] || { lat: -37.8155, lng: 145.1220, altitudeMeters: 0 };
    return {
      droneId: mission.droneId,
      timestamp: Date.now(),
      lat: cp.lat,
      lng: cp.lng,
      altitudeMeters: cp.altitudeMeters,
      headingDegrees: 0,
      groundSpeedKmh: 0,
      verticalSpeedMs: 0,
      batteryPercentage: 98,
      batteryVoltage: 24.8,
      signalQualityPercent: 99,
      rtkFix: 'RTK_FIX',
      satellites: 20,
      currentCheckpointIndex: 0,
      distanceToNextCheckpointMeters: 0,
      missionStatus: status,
      isDwellActive: false,
    };
  }
}
