/**
 * Genuine PX4 SITL & Gazebo Autopilot API Adapter
 * AEROVATA by TASPORA - Hardware-in-the-Loop & SITL Integration Layer
 * 
 * Communicates with the Unified FastAPI Backend over WebSocket & REST.
 * Strictly adheres to Requirement:
 * "Clearly distinguish genuine PX4/Gazebo telemetry from mock data.
 *  If the simulator is disconnected, show a disconnected status rather than pretending the drone is flying."
 */

import type { IMissionApiAdapter } from '../api/types';
import type { Checkpoint, Mission, MissionState, MissionTelemetry, CameraFeedMetadata } from '../../types/mission';
import { defaultCoordinateAdapter } from './coordinateTransform';

export type Px4ConnectionState =
  | 'NOT_CONFIGURED'
  | 'STARTING_SIMULATOR'
  | 'WAITING_FOR_GAZEBO'
  | 'WAITING_FOR_PX4'
  | 'WAITING_FOR_MAVLINK_HEARTBEAT'
  | 'CONNECTED'
  | 'TELEMETRY_STALE'
  | 'DISCONNECTED'
  | 'CONNECTION_ERROR';

export interface Px4AutopilotStatus {
  connected: boolean;
  gatewayState: Px4ConnectionState;
  gatewayReason: string;
  telemetryStatus: 'LIVE' | 'STALE' | 'UNAVAILABLE';
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
    baseUrl?: string,
    wsUrl?: string
  ) {
    this.baseUrl = (baseUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) || 'http://localhost:8000').replace(/\/+$/, '');
    this.wsUrl = wsUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) || 'ws://localhost:8000/api/v1/ws/telemetry';
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

  public async fetchBackendHealth(): Promise<any> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Backend offline
    }
    return null;
  }

  private connectWebSocket(): void {
    if (typeof window === 'undefined') return;

    try {
      if (this.socket) {
        try {
          this.socket.close();
        } catch {}
      }

      this.socket = new WebSocket(this.wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.notifyConnectionState(this.latestStatus?.connected ?? false);
      };

      this.socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const isPx4Alive = Boolean(raw.connected);

          this.latestStatus = {
            connected: isPx4Alive,
            gatewayState: (raw.gatewayState as Px4ConnectionState) || (isPx4Alive ? 'CONNECTED' : 'WAITING_FOR_MAVLINK_HEARTBEAT'),
            gatewayReason: raw.gatewayReason || (isPx4Alive ? 'Live MAVLink heartbeats active' : 'Awaiting MAVLink UDP:14550 heartbeat'),
            telemetryStatus: raw.telemetryStatus || (isPx4Alive ? 'LIVE' : 'UNAVAILABLE'),
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
              droneId: raw.droneId || 'AV-01',
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
        if (this.latestStatus) {
          this.latestStatus.connected = false;
          this.latestStatus.gatewayState = 'DISCONNECTED';
          this.latestStatus.gatewayReason = 'WebSocket to backend gateway closed. Reconnecting...';
        }
        this.notifyConnectionState(false);
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnected = false;
        this.latestTelemetry = null;
        if (this.latestStatus) {
          this.latestStatus.connected = false;
          this.latestStatus.gatewayState = 'DISCONNECTED';
          this.latestStatus.gatewayReason = 'Cannot reach backend at ' + this.wsUrl;
        }
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
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/missions/${encodeURIComponent(missionId)}/checkpoints`);
      if (res.ok) {
        const data = await res.json();
        return data.checkpoints || [];
      }
    } catch {}
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
      droneId: 'AV-01',
      droneCallsign: 'PX4-x500 (AV-01)',
      status: state,
      checkpoints: this.activeMission?.checkpoints || [],
      currentCheckpointIndex: this.latestStatus?.currentWaypoint || 0,
      totalDistanceMeters: this.activeMission?.totalDistanceMeters || 0,
      elapsedTimeSeconds: 0,
      estimatedRemainingSeconds: 0,
      progressPercent: 0,
      errorMessage: isAlive ? undefined : (this.latestStatus?.gatewayReason || 'PX4 SITL is DISCONNECTED. Awaiting MAVLink UDP:14550 heartbeat.'),
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
      connectionStatus: this.isAutopilotConnected() ? 'CONNECTED' : 'DISCONNECTED',
      streamUrl: `${this.baseUrl}/api/v1/drones/${droneId}/stream`,
      resolution: '1920x1080',
      fps: 30,
      latencyMs: 12,
      codec: 'H.264 / Synthetic Attitude Matrix',
      isSimulated: true,
      disclaimer: this.isAutopilotConnected() ? 'LIVE SYNTHETIC ATTITUDE OVERLAY' : 'DISCONNECTED: Awaiting PX4 Autopilot stream.',
    };
  }

  public async startSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/missions/${encodeURIComponent(missionId)}/start`, { method: 'POST' });
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
      const res = await fetch(`${this.baseUrl}/api/v1/missions/${encodeURIComponent(missionId)}/pause`, { method: 'POST' });
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
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/missions/${encodeURIComponent(missionId)}/resume`, { method: 'POST' });
      const data = await res.json();
      return {
        success: data.success,
        state: data.state || 'running',
        message: data.message || 'PX4 resumed',
      };
    } catch (err: any) {
      return { success: false, state: 'error', message: err.message };
    }
  }

  public async resetSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/missions/${encodeURIComponent(missionId)}/reset`, { method: 'POST' });
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

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mission),
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
