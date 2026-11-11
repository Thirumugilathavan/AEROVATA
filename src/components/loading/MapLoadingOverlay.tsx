import React from 'react';
import { ActiveOperation } from '../../types/loading';
import { LoadingSpinner } from './LoadingSpinner';
import { X } from 'lucide-react';

interface MapLoadingOverlayProps {
  operation: ActiveOperation | null;
  onCancel?: (id: string) => void;
}

export const MapLoadingOverlay: React.FC<MapLoadingOverlayProps> = ({ operation, onCancel }) => {
  if (!operation) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto max-w-md w-auto animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="bg-[#0b1220]/95 backdrop-blur-md border border-cyan-500/60 px-3.5 py-2 rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.6)] flex items-center gap-3 text-xs font-mono select-none">
        <LoadingSpinner size="sm" color="text-cyan-400" />
        <div className="flex-1 min-w-0 pr-1">
          <div className="text-[11px] font-bold text-white flex items-center gap-2">
            <span className="truncate">{operation.label}</span>
            {operation.progress !== undefined && (
              <span className="text-[10px] text-cyan-300 font-mono">
                {Math.round(operation.progress)}%
              </span>
            )}
          </div>
          {operation.progress !== undefined && (
            <div className="w-full h-1 bg-[#162238] rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-cyan-400 transition-all duration-200"
                style={{ width: `${operation.progress}%` }}
              />
            </div>
          )}
        </div>

        {operation.cancellable && (
          <button
            type="button"
            onClick={() => onCancel && onCancel(operation.id)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title="Cancel operation"
            aria-label="Cancel operation"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
