/**
 * Mission API Adapter Interface
 * AEROVATA by TASPORA
 * 
 * Formal API contract decoupling UI components from backend implementation.
 */

import type { Checkpoint, Mission, MissionState, MissionTelemetry, CameraFeedMetadata } from '../../types/mission.ts';

export interface IMissionApiAdapter {
  /** Gets or sets the backend base URL (e.g. "http://localhost:8000/api/v1") */
  getBaseUrl(): string;
  setBaseUrl(url: string): void;

  /** Retrieves all ordered checkpoints for a specified mission */
  getCheckpoints(missionId: string): Promise<Checkpoint[]>;

  /** Retrieves full current mission status and progression */
  getMissionStatus(missionId: string): Promise<Mission>;

  /** Retrieves real-time drone telemetry */
  getDroneTelemetry(droneId: string): Promise<MissionTelemetry>;

  /** Retrieves camera connection and sensor feed metadata */
  getCameraMetadata(droneId: string): Promise<CameraFeedMetadata>;

  /** Starts or resumes mission execution */
  startSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }>;

  /** Pauses running mission execution */
  pauseSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }>;

  /** Resumes paused mission */
  resumeSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }>;

  /** Resets mission back to initial state */
  resetSimulation(missionId: string): Promise<{ success: boolean; state: MissionState; message?: string }>;

  /** Submits a custom mission plan to the backend */
  submitMission(mission: Mission): Promise<{ success: boolean; missionId: string; error?: string }>;
}
