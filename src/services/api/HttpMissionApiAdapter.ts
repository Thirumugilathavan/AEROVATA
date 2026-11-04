/**
 * HTTP REST Mission API Adapter
 * AEROVATA by TASPORA
 * 
 * Production adapter communicating with the live backend over HTTP/REST.
 * Configurable base URL. Adheres strictly to the AEROVATA API contract.
 */

import type { IMissionApiAdapter } from './types';
import type { Checkpoint, Mission, MissionState, MissionTelemetry, CameraFeedMetadata } from '../../types/mission';

export class HttpMissionApiAdapter implements IMissionApiAdapter {
  private baseUrl: string;
  private timeoutMs: number = 8000;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://localhost:8000/api/v1';
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public async getCheckpoints(missionId: string): Promise<Checkpoint[]> {
    const res = await this.fetchJson<{ checkpoints: Checkpoint[] }>(`/missions/${encodeURIComponent(missionId)}/checkpoints`);
    return res.checkpoints;
  }

  public async getMissionStatus(missionId: string): Promise<Mission> {
    return this.fetchJson<Mission>(`/missions/${encodeURIComponent(missionId)}/status`);
  }

  public async getDroneTelemetry(droneId: string): Promise<MissionTelemetry> {
    return this.fetchJson<MissionTelemetry>(`/drones/${encodeURIComponent(droneId)}/telemetry`);
  }

  public async getCameraMetadata(droneId: string): Promise<CameraFeedMetadata> {
    return this.fetchJson<CameraFeedMetadata>(`/drones/${encodeURIComponent(droneId)}/camera`);
  }

  public async startSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    return this.fetchJson<{ success: boolean; state: MissionState; message?: string }>(`/simulation/start`, {
      method: 'POST',
      body: JSON.stringify({ missionId }),
    });
  }

  public async pauseSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    return this.fetchJson<{ success: boolean; state: MissionState; message?: string }>(`/simulation/pause`, {
      method: 'POST',
      body: JSON.stringify({ missionId }),
    });
  }

  public async resumeSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    return this.fetchJson<{ success: boolean; state: MissionState; message?: string }>(`/simulation/resume`, {
      method: 'POST',
      body: JSON.stringify({ missionId }),
    });
  }

  public async resetSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }> {
    return this.fetchJson<{ success: boolean; state: MissionState; message?: string }>(`/simulation/reset`, {
      method: 'POST',
      body: JSON.stringify({ missionId }),
    });
  }

  public async submitMission(mission: Mission): Promise<{ success: boolean; missionId: string; error?: string }> {
    return this.fetchJson<{ success: boolean; missionId: string; error?: string }>(`/missions`, {
      method: 'POST',
      body: JSON.stringify(mission),
    });
  }

  private async fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(options.headers || {}),
        },
      });

      if (!response.ok) {
        let errDetail = response.statusText;
        try {
          const errJson = await response.json();
          errDetail = errJson.detail || errJson.message || response.statusText;
        } catch {
          // ignore
        }
        throw new Error(`API HTTP ${response.status}: ${errDetail}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}
