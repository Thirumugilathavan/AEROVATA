/**
 * Controller Interfaces and State Types
 * AEROVATA by TASPORA - Standalone Mission Controller
 * 
 * Defines the contract for mission simulation controllers,
 * state machine transitions, and telemetry broadcasting.
 * For simulation and software demonstration only.
 */

import type { Checkpoint, Mission, MissionState, MissionTelemetry } from '../types/mission.ts';

export interface IMissionController {
  /** Loads and validates a mission definition */
  loadMission(mission: Mission): { success: boolean; error?: string };
  /** Starts the mission execution from idle or resumes if paused */
  start(): boolean;
  /** Pauses the running mission */
  pause(): boolean;
  /** Resumes execution from paused state */
  resume(): boolean;
  /** Resets mission back to initial state and rewinds drone to checkpoint 1 */
  reset(): void;
  /** Returns the current mission state */
  getState(): MissionState;
  /** Returns the full synchronized mission data model */
  getMission(): Mission | null;
  /** Returns real-time flight telemetry */
  getTelemetry(): MissionTelemetry | null;
  /** Sets the simulation speed multiplier (1x, 2x, 5x, 10x) */
  setSpeedMultiplier(multiplier: number): void;
  /** Gets current speed multiplier */
  getSpeedMultiplier(): number;
  /** Subscribes a listener to controller tick updates (returns unsubscribe function) */
  subscribe(listener: (mission: Mission, telemetry: MissionTelemetry) => void): () => void;
  /** Forces an error state for testing failure handling */
  injectFault(reason: string): void;
  /** Manual stepping for deterministic unit tests (advances simulation by deltaSeconds) */
  step(deltaSeconds: number): void;
}

export interface StateTransitionEvent {
  from: MissionState;
  to: MissionState;
  reason?: string;
  timestamp: number;
}
