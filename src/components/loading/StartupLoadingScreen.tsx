import React, { useEffect, useState } from 'react';
import { MapReadinessStatus } from '../../types/loading';
import { AlertTriangle, RotateCcw, ShieldCheck } from 'lucide-react';

interface StartupLoadingScreenProps {
  status: MapReadinessStatus;
  onRetry?: () => void;
}

export const StartupLoadingScreen: React.FC<StartupLoadingScreenProps> = ({ status, onRetry }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isUnmounted, setIsUnmounted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check user preference for reduced motion
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  // When readiness condition is met, initiate smooth fade-out
  useEffect(() => {
    if (status.isReady && !isFadingOut) {
      // Hold 100% ready state briefly so the user sees completion
      const timer = setTimeout(() => {
        setIsFadingOut(true);
      }, 400);

      // Remove from DOM after fade out transition completes
      const unmountTimer = setTimeout(() => {
        setIsUnmounted(true);
      }, 1100);

      return () => {
        clearTimeout(timer);
        clearTimeout(unmountTimer);
      };
    }
  }, [status.isReady, isFadingOut]);

  if (isUnmounted) return null;

  const isError = status.phase === 'error';
  const displayProgress = isError ? 100 : Math.min(100, Math.max(8, Math.round(status.progress)));

  return (
    <div
      role="region"
      aria-label="Application Startup Loading Screen"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070a12] select-none font-sans transition-opacity duration-700 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background radial atmosphere */}
      <div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/20 via-[#070a12]/80 to-[#070a12]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center max-w-md px-6 text-center">
        {/* ─── ANIMATED APP LOGO ─── */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Subtle Outer Radar Ring */}
          {!prefersReducedMotion && (
            <>
              <div
                className="absolute w-28 h-28 sm:w-32 sm:h-32 rounded-full border border-cyan-500/20 animate-ping opacity-20 pointer-events-none"
                style={{ animationDuration: '3.2s' }}
                aria-hidden="true"
              />
              <div
                className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-cyan-400/25 animate-pulse pointer-events-none"
                aria-hidden="true"
              />
            </>
          )}

          {/* Central Emblem Box with Gradient & Shadow */}
          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-cyan-500 via-[#0c1a2e] to-blue-800 p-0.5 shadow-[0_0_35px_rgba(0,240,255,0.35)] border border-cyan-400/60 flex items-center justify-center transition-transform ${
              prefersReducedMotion ? '' : 'hover:scale-105'
            }`}
          >
            <div className="w-full h-full rounded-[14px] bg-[#090e1a]/90 flex items-center justify-center">
              {/* Actual Aerovata Delta-Wing Apex SVG */}
              <svg
                viewBox="0 0 24 24"
                className={`w-9 h-9 sm:w-11 sm:h-11 text-cyan-300 filter drop-shadow-[0_0_10px_rgba(0,240,255,0.6)] ${
                  prefersReducedMotion ? '' : 'animate-pulse'
                }`}
                style={{ animationDuration: '2s' }}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2L2 19h20L12 2z" />
                <path d="M12 9v6" />
                <path d="M9 16h6" />
              </svg>
            </div>
          </div>
        </div>

        {/* ─── BRAND HEADER ─── */}
        <div className="mb-6 space-y-1">
          <div className="flex items-center justify-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-[0.24em] text-white uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              AEROVATA
            </h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-500/60 font-mono tracking-wider">
              UTM
            </span>
          </div>
          <p className="text-[11px] font-mono tracking-widest text-slate-400 uppercase">
            Autonomous Drone Command Center • BVLOS
          </p>
          <div className="text-[10px] font-mono text-slate-500">
            by <span className="text-slate-300 font-bold">TASPORA</span> • COIMBATORE SECTOR
          </div>
        </div>

        {/* ─── DYNAMIC PROGRESS & LIFECYCLE FEEDBACK ─── */}
        {!isError ? (
          <div className="w-full max-w-xs space-y-3 font-mono" aria-live="polite">
            {/* Progress Bar Container */}
            <div className="w-full h-1.5 bg-[#0f172a] rounded-full overflow-hidden border border-[#1e293b] p-[1px] relative shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-blue-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(6,182,212,0.8)]"
                style={{ width: `${displayProgress}%` }}
                role="progressbar"
                aria-valuenow={displayProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>

            {/* Status Message and Numeric Percentage */}
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="text-cyan-300/90 font-medium tracking-wide truncate max-w-[220px]">
                {status.message || 'Initializing flight environment...'}
              </span>
              <span className="text-cyan-400 font-bold font-mono shrink-0 ml-2">
                {displayProgress}%
              </span>
            </div>

            {/* Micro readiness stage pills */}
            <div className="flex items-center justify-center gap-1.5 pt-1 text-[9px] text-slate-500">
              <span className={`px-1.5 py-0.5 rounded border transition-colors ${
                status.progress >= 25 ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-600'
              }`}>
                BASEMAP
              </span>
              <span className="text-slate-700">•</span>
              <span className={`px-1.5 py-0.5 rounded border transition-colors ${
                status.progress >= 60 ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-600'
              }`}>
                3D TERRAIN
              </span>
              <span className="text-slate-700">•</span>
              <span className={`px-1.5 py-0.5 rounded border transition-colors ${
                status.progress >= 85 ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-600'
              }`}>
                DGCA ZONES
              </span>
            </div>
          </div>
        ) : (
          /* ─── ERROR & RETRY VIEW ─── */
          <div className="w-full max-w-sm p-4 bg-rose-950/80 border border-rose-600/70 rounded-lg text-left shadow-2xl font-mono space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Map Initialization Failure</span>
            </div>
            <p className="text-[11px] text-rose-200/90 leading-relaxed">
              {status.error || 'The WebGL map rendering engine encountered an initialization timeout or hardware context error.'}
            </p>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="px-3.5 py-1.5 bg-rose-900 hover:bg-rose-800 text-white border border-rose-500 text-xs font-bold rounded flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Initialization</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom regulatory & build tag */}
      <div className="absolute bottom-4 z-10 flex items-center gap-2 text-[10px] font-mono text-slate-600">
        <ShieldCheck className="w-3 h-3 text-slate-500" />
        <span>DGCA Drone Rules 2021 Compliant • Build 2026.11</span>
      </div>
    </div>
  );
};
