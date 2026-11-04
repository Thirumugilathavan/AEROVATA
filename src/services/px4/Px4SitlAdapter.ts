/**
 * Genuine PX4 SITL & Gazebo Autopilot API Adapter
 * AEROVATA by TASPORA - Hardware-in-the-Loop & SITL Integration Layer
 * 
 * Communicates with the PX4 Gateway over WebSocket & REST.
 * Strictly adheres to Requirement 5:
 * "Clearly distinguish genuine PX4/Gazebo telemetry from mock data.
 *  If the simulator is disconnected, show a disconnected status rather than pretending the drone is flying."
 */

import type { IMissionApiAdapter } from '../api/types.ts';
import type { Checkpoint, Mission, MissionState, MissionTelemetry, CameraFeedMetadata } from '../../types/mission.ts';
import { defaultCoordinateAdapter } from './coordinateTransform.ts';

export interface Px4AutopilotStatus {
  connected: boolean;
  armed: boolean;
  flightMode: string;
  autopilot: string;
  vehicle: string;
  systemId: number;
  heartbeatAgeSec: number | null;
  missionState: MissionState;
  currentWaypoint: number;
}

export class Px4SitlAdapter implements IMissionApiAdapter {
  private baseUrl: string;
  private wsUrl: string;
  private socket: WebSocket | null = null;
  private isConnected: boolean = false;
  private latestStatus: Px4AutopilotStatus | null = null;
  private latestTelemetry: MissionTelemetry | null = null;
  private activeMission: Mission | null = null;
  private telemetryListeners: ((telemetry: MissionTelemetry) => void)[] = [];
  private connectionListeners: ((connected: boolean, status: Px4AutopilotStatus | null) => void)[] = [];
  private reconnectTimer: any = null;

  constructor(
    baseUrl: string = 'http://127.0.0.1:8080',
    wsUrl: string = 'ws://127.0.0.1:8080/ws/telemetry'
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.wsUrl = wsUrl;
    this.connectWebSocket();
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public isAutopilotConnected(): boolean {
    return this.isConnected && (this.latestStatus?.connected ?? false);
  }

  public getAutopilotStatus(): Px4AutopilotStatus | null {
    return this.latestStatus;
  }

  private connectWebSocket(): void {
    if (typeof window === 'undefined') return;

    try {
      this.socket = new WebSocket(this.wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.notifyConnectionState(true);
      };

      this.socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const isPx4Alive = Boolean(raw.connected);

          this.latestStatus = {
            connected: isPx4Alive,
            armed: Boolean(raw.armed),
            flightMode: raw.flightMode || 'UNKNOWN',
            autopilot: raw.autopilot || 'PX4 Autopilot (SITL)',
            vehicle: raw.vehicle || 'x500 Quadrotor',
            systemId: raw.systemId || 1,
            heartbeatAgeSec: raw.heartbeatAgeSec ?? null,
            missionState: (raw.missionStatus as MissionState) || 'idle',
            currentWaypoint: raw.currentCheckpointIndex || 0,
          };

          if (isPx4Alive) {
            this.latestTelemetry = {
              droneId: raw.droneId || 'AV-PX4-SITL',
              timestamp: raw.timestamp || Date.now(),
              lat: raw.lat,
              lng: raw.lng,
              altitudeMeters: raw.altitudeMeters,
              headingDegrees: raw.headingDegrees,
              groundSpeedKmh: raw.groundSpeedKmh,
              verticalSpeedMs: raw.verticalSpeedMs,
              batteryPercentage: raw.batteryPercentage,
              batteryVoltage: raw.batteryVoltage,
              signalQualityPercent: raw.signalQualityPercent,
              rtkFix: raw.rtkFix,
              satellites: raw.satellites,
              currentCheckpointIndex: raw.currentCheckpointIndex,
              distanceToNextCheckpointMeters: 0,
              missionStatus: (raw.missionStatus as MissionState) || 'running',
              isDwellActive: Boolean(raw.isDwellActive),
            };

            this.dispatchTelemetry(this.latestTelemetry);
          } else {
            // Disconnected: report genuine disconnected status
            this.latestTelemetry = null;
          }

          this.notifyConnectionState(isPx4Alive);
        } catch (e) {
          console.error('Error parsing PX4 telemetry message:', e);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.latestTelemetry = null;
        this.notifyConnectionState(false);
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnected = false;
        this.latestTelemetry = null;
        this.notifyConnectionState(false);
      };
    } catch {
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, 2500);
  }

  public onTelemetry(listener: (telemetry: MissionTelemetry) => void): () => void {
    this.telemetryListeners.push(listener);
    return () => {
      this.telemetryListeners = this.telemetryListeners.filter((l) => l !== listener);
    };
  }

  public onConnectionChange(listener: (connected: boolean, status: Px4AutopilotStatus | null) => void): () => void {
    this.connectionListeners.push(listener);
    listener(this.isAutopilotConnected(), this.latestStatus);
    return () => {
      this.connectionListeners = this.connectionListeners.filter((l) => l !== listener);
    };
  }

  private dispatchTelemetry(telemetry: MissionTelemetry): void {
    for (const listener of this.telemetryListeners) {
      try {
        listener(telemetry);
      } catch (err) {
        console.error('Error in PX4 telemetry subscriber:', err);
      }
    }
  }

  private notifyConnectionState(connected: boolean): void {
    for (const listener of this.connectionListeners) {
      try {
        listener(connected, this.latestStatus);
      } catch (err) {
        console.error('Error in PX4 connection subscriber:', err);
      }
    }
  }

  public async getCheckpoints(missionId: string): Promise<Checkpoint[]> {
    if (this.activeMission && this.activeMission.id === missionId) {
      return this.activeMission.checkpoints;
    }
    return [];
  }

  public async getMissionStatus(missionId: string): Promise<Mission> {
    const isAlive = this.isAutopilotConnected();
    const state: MissionState = !isAlive
      ? 'error'
      : (this.latestStatus?.missionState as MissionState) || 'idle';

    return {
      id: missionId,
      title: 'PX4 SITL & Gazebo Autopilot Mission',
      description: 'Genuine PX4 Autopilot executing MAVLink mission in modern Gazebo.',
      priority: 'HIGH',
      droneId: 'AV-PX4-SITL',
      droneCallsign: 'PX4-x500',
      status: state,
      checkpoints: this.activeMission?.checkpoints || [],
      currentCheckpointIndex: this.latestStatus?.currentWaypoint || 0,
      totalDistanceMeters: this.activeMission?.totalDistanceMeters || 0,
      elapsedTimeSeconds: 0,
      estimatedRemainingSeconds: 0,
      progressPercent: 0,
      errorMessage: isAlive ? undefined : 'PX4 SITL is DISCONNECTED. Awaiting autopilot MAVLink UDP:14550 heartbeat.',
    };
  }

  public async getDroneTelemetry(droneId: string): Promise<MissionTelemetry> {
    if (!this.isAutopilotConnected() || !this.latestTelemetry) {
      throw new Error('PX4 Autopilot SITL is DISCONNECTED. No genuine telemetry stream available.');
    }
    return this.latestTelemetry;
  }

  public async getCameraMetadata(droneId: string): Promise<CameraFeedMetadata> {
    return {
      droneId,
      connectionStatus: 'DISCONNECTED',
      streamUrl: undefined,
      resolution: 'N/A',
      fps: 0,
      latencyMs: 0,
      codec: 'N/A (Optical sensor not active on base x500)',
      isSimulated: true,
      disclaimer: 'DISCONNECTED: Gazebo gz_x500 base model does not publish an optical video stream (Camera IMU only).',
    };
  }

  public async startSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    if (!this.isAutopilotConnected()) {
      return {
        success: false,
        state: 'error',
        message: 'Cannot start: PX4 Autopilot SITL is DISCONNECTED. Verify Gazebo and PX4 are running.',
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/px4/arm_and_start`, { method: 'POST' });
      const data = await res.json();
      return {
        success: data.success,
        state: data.state || 'running',
        message: data.message || 'PX4 armed and commanded AUTO.MISSION',
      };
    } catch (err: any) {
      return { success: false, state: 'error', message: err.message };
    }
  }

  public async pauseSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/px4/pause`, { method: 'POST' });
      const data = await res.json();
      return {
        success: data.success,
        state: data.state || 'paused',
        message: data.message || 'PX4 commanded AUTO.LOITER (Hold)',
      };
    } catch (err: any) {
      return { success: false, state: 'error', message: err.message };
    }
  }

  public async resumeSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    return this.startSimulation(missionId);
  }

  public async resetSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/px4/rtl`, { method: 'POST' });
      const data = await res.json();
      return {
        success: true,
        state: 'idle',
        message: data.message || 'PX4 commanded Return-to-Launch',
      };
    } catch (err: any) {
      return { success: false, state: 'error', message: err.message };
    }
  }

  public async submitMission(mission: Mission): Promise<{ success: boolean; missionId: string; error?: string }> {
    this.activeMission = mission;

    if (!this.isAutopilotConnected()) {
      return {
        success: false,
        missionId: mission.id,
        error: 'PX4 Autopilot SITL is DISCONNECTED. Connect PX4 SITL to UDP:14550 before uploading missions.',
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/px4/mission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoints: mission.checkpoints }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, missionId: mission.id, error: data.detail || data.error };
      }
      return { success: true, missionId: mission.id };
    } catch (err: any) {
      return { success: false, missionId: mission.id, error: err.message };
    }
  }
}
