/**
 * Mission State Machine
 * AEROVATA by TASPORA - Standalone Mission Controller
 * 
 * Formal deterministic state machine with strict transition guards.
 * Prevents invalid operational states.
 */

import type { MissionState } from '../types/mission.ts';
import type { StateTransitionEvent } from './types.ts';

export class MissionStateMachine {
  private currentState: MissionState = 'idle';
  private transitionHistory: StateTransitionEvent[] = [];
  private listeners: ((event: StateTransitionEvent) => void)[] = [];

  constructor(initialState: MissionState = 'idle') {
    this.currentState = initialState;
  }

  public getState(): MissionState {
    return this.currentState;
  }

  public canTransition(targetState: MissionState): boolean {
    if (this.currentState === targetState) {
      return false;
    }

    switch (this.currentState) {
      case 'idle':
        return targetState === 'running' || targetState === 'error';
      case 'running':
        return targetState === 'paused' || targetState === 'completed' || targetState === 'aborted' || targetState === 'error' || targetState === 'idle';
      case 'paused':
        return targetState === 'running' || targetState === 'aborted' || targetState === 'error' || targetState === 'idle';
      case 'completed':
        return targetState === 'idle';
      case 'aborted':
        return targetState === 'idle';
      case 'error':
        // Must reset to idle before restarting
        return targetState === 'idle';
      default:
        return false;
    }
  }

  public transition(targetState: MissionState, reason?: string): boolean {
    if (!this.canTransition(targetState)) {
      return false;
    }

    const event: StateTransitionEvent = {
      from: this.currentState,
      to: targetState,
      reason,
      timestamp: Date.now(),
    };

    this.currentState = targetState;
    this.transitionHistory.push(event);

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in state machine listener:', err);
      }
    }

    return true;
  }

  public forceError(reason: string): void {
    const event: StateTransitionEvent = {
      from: this.currentState,
      to: 'error',
      reason,
      timestamp: Date.now(),
    };
    this.currentState = 'error';
    this.transitionHistory.push(event);
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  public reset(): void {
    const event: StateTransitionEvent = {
      from: this.currentState,
      to: 'idle',
      reason: 'Controller reset commanded',
      timestamp: Date.now(),
    };
    this.currentState = 'idle';
    this.transitionHistory.push(event);
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  public onTransition(listener: (event: StateTransitionEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getHistory(): readonly StateTransitionEvent[] {
    return this.transitionHistory;
  }
}
