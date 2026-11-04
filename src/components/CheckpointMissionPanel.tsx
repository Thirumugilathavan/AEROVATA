/**
 * Checkpoint Mission Showcase Panel
 * AEROVATA by TASPORA - Autonomous Drone Delivery Command Center
 * 
 * Interactive standalone controller panel displaying:
 * - Ordered checkpoint sequence with statuses (pending, active, reached, error)
 * - Mission state controls (Start, Pause, Resume, Reset)
 * - Simulation speed multiplier (1x, 2x, 5x)
 * - Backend API adapter configuration (Mock vs Live REST)
 * - Invalid mission input error demonstration
 */

import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  AlertOctagon, 
  Gauge, 
  Server, 
  Layers, 
  ChevronRight, 
  ShieldCheck, 
  Sparkles,
  Sliders,
  ExternalLink,
  Code
} from 'lucide-react';
import type { Mission, MissionTelemetry, Checkpoint } from '../types/mission';
import { apiService, ALL_PRESET_MISSIONS, ApiMode } from '../services/api/index';

interface CheckpointMissionPanelProps {
  onOpenApiContract?: () => void;
  onOpenPx4Setup?: () => void;
  onSelectCheckpointOnMap?: (checkpoint: Checkpoint) => void;
}

export const CheckpointMissionPanel: React.FC<CheckpointMissionPanelProps> = ({
  onOpenApiContract,
  onOpenPx4Setup,
  onSelectCheckpointOnMap,
}) => {
  const controller = apiService.getController();
  const [mission, setMission] = useState<Mission | null>(() => controller.getMission());
  const [telemetry, setTelemetry] = useState<MissionTelemetry | null>(() => controller.getTelemetry());
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(() => controller.getSpeedMultiplier());
  const [apiMode, setApiMode] = useState<ApiMode>(() => apiService.getMode());
  const [baseUrl, setBaseUrl] = useState<string>(() => apiService.getBaseUrl());
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState<boolean>(false);

  // Subscribe to controller or PX4 simulation updates
  useEffect(() => {
    if (apiMode === 'px4') {
      const px4 = apiService.getPx4Adapter();
      const unsubTel = px4.onTelemetry((t) => {
        setTelemetry({ ...t });
      });
      const unsubConn = px4.onConnectionChange((connected, status) => {
        px4.getMissionStatus('px4-current').then((m) => {
          setMission({ ...m });
        });
      });
      return () => {
        unsubTel();
        unsubConn();
      };
    } else {
      const unsubscribe = controller.subscribe((updatedMission, updatedTelemetry) => {
        setMission({ ...updatedMission });
        setTelemetry({ ...updatedTelemetry });
      });
      return () => unsubscribe();
    }
  }, [controller, apiMode]);

  const handleStartResume = async () => {
    if (apiMode === 'px4') {
      const px4 = apiService.getPx4Adapter();
      if (!px4.isAutopilotConnected()) return;
      const st = px4.getAutopilotStatus();
      if (st?.flightMode === 'AUTO.MISSION') {
        await px4.pauseSimulation('px4-current');
      } else {
        await px4.startSimulation('px4-current');
      }
      const updated = await px4.getMissionStatus('px4-current');
      setMission({ ...updated });
      return;
    }

    if (!mission) return;
    if (mission.status === 'running') {
      controller.pause();
    } else {
      controller.start();
    }
  };

  const handleReset = async () => {
    if (apiMode === 'px4') {
      const px4 = apiService.getPx4Adapter();
      await px4.resetSimulation('px4-current');
      const updated = await px4.getMissionStatus('px4-current');
      setMission({ ...updated });
      return;
    }
    controller.reset();
  };

  const handleSpeedChange = (mult: number) => {
    setSpeedMultiplier(mult);
    controller.setSpeedMultiplier(mult);
  };

  const handleSelectPreset = async (presetId: string) => {
    const preset = ALL_PRESET_MISSIONS.find((p) => p.id === presetId);
    if (preset) {
      if (apiMode === 'px4') {
        const px4 = apiService.getPx4Adapter();
        await px4.submitMission(preset);
        setMission({ ...preset });
      } else {
        controller.loadMission(preset);
      }
    }
  };

  const handleApplyApiSettings = async () => {
    apiService.setMode(apiMode);
    apiService.setBaseUrl(baseUrl);
    setIsApiSettingsOpen(false);

    if (apiMode === 'px4') {
      const px4 = apiService.getPx4Adapter();
      if (controller.getMission()) {
        await px4.submitMission(controller.getMission()!);
      }
      const st = await px4.getMissionStatus('px4-current');
      setMission({ ...st });
    }
  };

  const completedCount = mission ? mission.checkpoints.filter((c) => c.status === 'reached').length : 0;
  const totalCount = mission ? mission.checkpoints.length : 0;
  const isError = mission?.status === 'error';

  return (
    <div className="flex flex-col h-full bg-[#0c101a] border-t border-[#1e2a40] text-slate-200 select-none font-sans overflow-hidden">
      {/* Top Controller Header Bar */}
      <div className="h-14 bg-[#101626] border-b border-[#1f2b42] px-4 flex items-center justify-between shrink-0">
        {/* Left: Mission ID, Preset Picker, & Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-extrabold text-xs tracking-wider text-white">CHECKPOINT MISSION SHOWCASE</span>
          </div>

          <div className="h-5 w-px bg-slate-700" />

          {/* Mission Preset Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium">Mission:</span>
            <select
              value={mission?.id || 'MSN-TAS-01'}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="bg-[#161f33] border border-[#263757] rounded px-2.5 py-1 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              {ALL_PRESET_MISSIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}: {p.title.slice(0, 42)}... {p.id === 'MSN-TAS-ERR' ? '⚠️ [FAUL TEST]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* State Badge */}
          <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider ${
            mission?.status === 'running' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.2)]' :
            mission?.status === 'paused' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' :
            mission?.status === 'completed' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50' :
            mission?.status === 'error' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse' :
            'bg-slate-800 text-slate-300 border border-slate-700'
          }`}>
            {mission?.status || 'IDLE'}
          </span>
        </div>

        {/* Center: Mission Progress Bar */}
        <div className="hidden lg:flex items-center gap-3 min-w-[260px] max-w-sm flex-1 mx-4">
          <div className="flex-1">
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-slate-400 font-sans">Progress ({completedCount}/{totalCount} checkpoints)</span>
              <span className="text-cyan-300 font-bold">{mission?.progressPercent || 0}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
              <div
                className={`h-full transition-all duration-300 ${
                  isError ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                }`}
                style={{ width: `${mission?.progressPercent || 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Primary Simulation Playback Controls */}
        <div className="flex items-center gap-2">
          {/* Speed Multiplier */}
          <div className="flex items-center bg-[#151c2e] border border-[#243350] rounded p-0.5 text-xs font-mono">
            {[1, 2, 5].map((m) => (
              <button
                key={m}
                onClick={() => handleSpeedChange(m)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  speedMultiplier === m
                    ? 'bg-cyan-500 text-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m}x
              </button>
            ))}
          </div>

          {/* Start / Pause Button */}
          <button
            onClick={handleStartResume}
            disabled={isError}
            className={`px-3.5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isError
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : mission?.status === 'running'
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]'
            }`}
          >
            {mission?.status === 'running' ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-black" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>{mission?.status === 'paused' ? 'Resume' : 'Start'}</span>
              </>
            )}
          </button>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="px-2.5 py-1.5 rounded bg-[#162035] hover:bg-[#1f2b45] text-slate-200 border border-[#2b3a58] text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Reset Mission to Checkpoint 1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {/* API Settings Dropdown Toggle */}
          <button
            onClick={() => setIsApiSettingsOpen(!isApiSettingsOpen)}
            className="px-2.5 py-1.5 rounded bg-[#162035] hover:bg-[#1f2b45] text-slate-200 border border-[#2b3a58] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Configure Backend API / Mock Mode"
          >
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline font-mono text-[11px]">{apiMode === 'mock' ? 'MOCK' : 'REST'}</span>
          </button>

          {/* API Contract Modal Launcher */}
          {onOpenApiContract && (
            <button
              onClick={onOpenApiContract}
              className="px-2.5 py-1.5 rounded bg-[#162035] hover:bg-[#1f2b45] text-slate-200 border border-[#2b3a58] text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="View Formal API Contract & Endpoints"
            >
              <Code className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">API Spec</span>
            </button>
          )}
        </div>
      </div>

      {/* ERROR BANNER (Displayed when invalid mission data or fault injected) */}
      {isError && (
        <div className="bg-rose-950/80 border-b border-rose-500/50 px-4 py-2.5 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-white uppercase tracking-wider">MISSION REJECTED / CONTROLLER ERROR STATE: </span>
              <span>{mission?.errorMessage || 'Input validation failed. Mission halted to ensure safe operations.'}</span>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
          >
            Reset Controller
          </button>
        </div>
      )}

      {/* API Configuration Drawer */}
      {isApiSettingsOpen && (
        <div className="bg-[#12192b] border-b border-[#223352] p-4 text-xs">
          <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-bold text-white text-sm flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Backend API Adapter Configuration</span>
              </div>
              <div className="text-slate-400 text-[11px]">
                Switch between Mock In-Memory development and the live external REST API endpoint.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded border border-slate-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="apiMode"
                    value="mock"
                    checked={apiMode === 'mock'}
                    onChange={() => setApiMode('mock')}
                    className="accent-cyan-400"
                  />
                  <span className="font-bold text-cyan-300">Mock Adapter</span>
                </label>
                <div className="h-4 w-px bg-slate-700 mx-1" />
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="apiMode"
                    value="http"
                    checked={apiMode === 'http'}
                    onChange={() => setApiMode('http')}
                    className="accent-cyan-400"
                  />
                  <span className="font-bold text-emerald-300">Live REST API</span>
                </label>
                <div className="h-4 w-px bg-slate-700 mx-1" />
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="apiMode"
                    value="px4"
                    checked={apiMode === 'px4'}
                    onChange={() => setApiMode('px4')}
                    className="accent-cyan-400"
                  />
                  <span className="font-bold text-blue-400">PX4 SITL (Gazebo)</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:8000/api/v1"
                  className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs w-56 focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={handleApplyApiSettings}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkpoints Sequence Strip */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 flex items-center gap-3 min-h-[105px]">
        {mission?.checkpoints.map((cp, idx) => {
          const isActive = cp.status === 'active';
          const isReached = cp.status === 'reached';
          const isPending = cp.status === 'pending';

          return (
            <React.Fragment key={cp.id}>
              {idx > 0 && (
                <div className="flex items-center text-slate-600 shrink-0">
                  <div className={`w-6 h-0.5 ${isReached ? 'bg-emerald-500/80' : isActive ? 'bg-cyan-500/60' : 'bg-slate-700'}`} />
                  <ChevronRight className="w-4 h-4 -ml-1 text-slate-500" />
                </div>
              )}

              <div
                onClick={() => onSelectCheckpointOnMap && onSelectCheckpointOnMap(cp)}
                className={`flex flex-col p-2.5 rounded-lg border min-w-[210px] max-w-[230px] shrink-0 cursor-pointer transition-all ${
                  isActive
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50'
                    : isReached
                    ? 'bg-emerald-950/20 border-emerald-500/40 opacity-90'
                    : 'bg-[#121929] border-[#1e2a42] hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                      isActive ? 'bg-cyan-400 text-black animate-pulse' :
                      isReached ? 'bg-emerald-500 text-black' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {isReached ? '✓' : cp.sequence}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{cp.id}</span>
                  </div>

                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50' :
                    isReached ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                    'bg-slate-800/80 text-slate-400'
                  }`}>
                    {cp.status}
                  </span>
                </div>

                <div className="font-bold text-xs text-white truncate mb-1">
                  {cp.name}
                </div>

                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-300 pt-1 border-t border-slate-800/80">
                  <div>
                    <span className="text-slate-500">ALT: </span>
                    <span className="font-semibold text-cyan-300">{cp.altitudeMeters}m</span>
                  </div>
                  <div>
                    <span className="text-slate-500">SPD: </span>
                    <span className="font-semibold text-emerald-300">{cp.targetSpeedKmh}km/h</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-between text-[9px] text-slate-400 mt-0.5">
                    <span>ACTION: <strong className="text-amber-300 uppercase">{cp.action}</strong></span>
                    {cp.dwellTimeSeconds > 0 && (
                      <span className="text-amber-400 font-bold">DWELL: {cp.dwellTimeSeconds}s</span>
                    )}
                  </div>
                </div>

                {isActive && telemetry?.isDwellActive && (
                  <div className="mt-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold text-center border border-amber-500/40 animate-pulse">
                    HOLDING DWELL: {mission?.dwellRemainingSeconds || 0}s
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
