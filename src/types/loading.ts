/**
 * Aerovata Loading & Readiness Types
 */

export type MapReadinessPhase =
  | 'initializing'
  | 'style_loading'
  | 'layers_ready'
  | 'tiles_loading'
  | 'ready'
  | 'error';

export interface MapReadinessStatus {
  phase: MapReadinessPhase;
  progress: number; // 0 to 100
  message: string;
  error?: string;
  isReady: boolean;
}

export interface ActiveOperation {
  id: string;
  label: string;
  scope: 'global' | 'map' | 'action';
  progress?: number;
  cancellable?: boolean;
  onCancel?: () => void;
  startedAt: number;
}
