/**
 * Mock Mission API Adapter
 * AEROVATA by TASPORA
 * 
 * In-memory development adapter mirroring the backend REST API contract.
 * Backed by the standalone SimulationMissionController.
 */

import type { IMissionApiAdapter } from './types';
import type { Checkpoint, Mission, MissionState, MissionTelemetry, CameraFeedMetadata } from '../../types/mission';
import { SimulationMissionController } from '../../controller/SimulationMissionController';
import { ALL_PRESET_MISSIONS, MISSION_COIMBATORE_CMCH } from './missionPresets';

export class MockMissionApiAdapter implements IMissionApiAdapter {
  private baseUrl: string = '/api/v1 (Mock In-Memory)';
  private controller: SimulationMissionController;
  private currentMission: Mission;
  private cameraStatus: 'CONNECTED' | 'STANDBY' | 'DISCONNECTED' | 'FALLBACK_SIMULATION' = 'FALLBACK_SIMULATION';

  constructor(controller?: SimulationMissionController) {
    this.controller = controller || new SimulationMissionController();
    this.currentMission = JSON.parse(JSON.stringify(MISSION_COIMBATORE_CMCH));
    this.controller.loadMission(this.currentMission);
  }

  public getController(): SimulationMissionController {
    return this.controller;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  public async getCheckpoints(missionId: string): Promise<Checkpoint[]> {
    await this.simulateLatency();
    const mission = this.findMission(missionId);
    return JSON.parse(JSON.stringify(mission.checkpoints));
  }

  public async getMissionStatus(missionId: string): Promise<Mission> {
    await this.simulateLatency();
    const active = this.controller.getMission();
    if (active && active.id === missionId) {
      return JSON.parse(JSON.stringify(active));
    }
    return JSON.parse(JSON.stringify(this.findMission(missionId)));
  }

  public async getDroneTelemetry(droneId: string): Promise<MissionTelemetry> {
    await this.simulateLatency(30);
    const telemetry = this.controller.getTelemetry();
    if (telemetry && telemetry.droneId === droneId) {
      return JSON.parse(JSON.stringify(telemetry));
    }
    // Default fallback
    return {
      droneId,
      timestamp: Date.now(),
      lat: 11.0260,
      lng: 77.0120,
      altitudeMeters: 65,
      headingDegrees: 245,
      groundSpeedKmh: 45,
      verticalSpeedMs: 0.0,
      batteryPercentage: 92,
      batteryVoltage: 24.4,
      signalQualityPercent: 98,
      rtkFix: 'RTK_FIX',
      satellites: 20,
      currentCheckpointIndex: 1,
      distanceToNextCheckpointMeters: 560,
      missionStatus: 'idle',
      isDwellActive: false,
    };
  }

  public async getCameraMetadata(droneId: string): Promise<CameraFeedMetadata> {
    await this.simulateLatency();
    return {
      droneId,
      connectionStatus: this.cameraStatus,
      streamUrl: this.cameraStatus === 'CONNECTED' ? 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' : undefined,
      resolution: '1920x1080',
      fps: 60,
      latencyMs: 85,
      codec: 'H.264 / AVC High@L4.2',
      isSimulated: this.cameraStatus === 'FALLBACK_SIMULATION',
      disclaimer: 'DEMO VIDEO FALLBACK / SYNTHETIC SENSOR SIMULATION - NOT LIVE FOOTAGE',
    };
  }

  public setCameraStatus(status: 'CONNECTED' | 'STANDBY' | 'DISCONNECTED' | 'FALLBACK_SIMULATION'): void {
    this.cameraStatus = status;
  }

  public async startSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    await this.simulateLatency();
    const mission = this.findMission(missionId);
    if (!this.controller.getMission() || this.controller.getMission()?.id !== missionId) {
      this.controller.loadMission(mission);
    }
    const success = this.controller.start();
    return {
      success,
      state: this.controller.getState(),
      message: success ? 'Simulation started successfully' : 'Unable to start simulation from current state',
    };
  }

  public async pauseSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    await this.simulateLatency();
    const success = this.controller.pause();
    return {
      success,
      state: this.controller.getState(),
      message: success ? 'Simulation paused' : 'Unable to pause simulation',
    };
  }

  public async resumeSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    await this.simulateLatency();
    const success = this.controller.resume();
    return {
      success,
      state: this.controller.getState(),
      message: success ? 'Simulation resumed' : 'Unable to resume simulation',
    };
  }

  public async resetSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    await this.simulateLatency();
    this.controller.reset();
    return {
      success: true,
      state: 'idle',
      message: 'Simulation reset to origin',
    };
  }

  public async submitMission(mission: Mission): Promise<{ success: boolean; missionId: string; error?: string }> {
    await this.simulateLatency();
    const result = this.controller.loadMission(mission);
    return {
      success: result.success,
      missionId: mission.id,
      error: result.error,
    };
  }

  private findMission(id: string): Mission {
    const found = ALL_PRESET_MISSIONS.find((m) => m.id === id);
    if (found) {
      return JSON.parse(JSON.stringify(found));
    }
    return JSON.parse(JSON.stringify(MISSION_COIMBATORE_CMCH));
  }

  private simulateLatency(ms: number = 80): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
