/**
 * PX4 SITL & Gazebo Autopilot Multi-Subsystem Status Banner
 * AEROVATA by TASPORA
 * 
 * Fulfills Priority 1.G:
 * Distinctly displays:
 * - GAZEBO: RUNNING / STOPPED / STANDALONE
 * - PX4 SITL: CONNECTED / DISCONNECTED / WAITING
 * - MAVLINK GATEWAY: LISTENING / ERROR
 * - MAVLINK HEARTBEAT: RECEIVED / TIMEOUT / AWAITING
 * - BACKEND API: CONNECTED / DISCONNECTED
 * - TELEMETRY: LIVE / STALE / UNAVAILABLE
 */

import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Radio, 
  AlertTriangle, 
  CheckCircle2, 
  Terminal, 
  Layers, 
  ExternalLink,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Server,
  Activity,
  Box,
  Flame
} from 'lucide-react';
import { apiService, ApiMode } from '../services/api/index';
import type { Px4AutopilotStatus } from '../services/px4/Px4SitlAdapter';

interface Px4SitlStatusBannerProps {
  onOpenSetupGuide?: () => void;
}

export const Px4SitlStatusBanner: React.FC<Px4SitlStatusBannerProps> = ({ onOpenSetupGuide }) => {
  const px4Adapter = apiService.getPx4Adapter();
  const [apiMode, setApiMode] = useState<ApiMode>(() => apiService.getMode());
  const [isPx4Connected, setIsPx4Connected] = useState<boolean>(() => px4Adapter.isAutopilotConnected());
  const [px4Status, setPx4Status] = useState<Px4AutopilotStatus | null>(() => px4Adapter.getAutopilotStatus());
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(false);
  const [backendHealth, setBackendHealth] = useState<any>(null);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [isTogglingHarness, setIsTogglingHarness] = useState<boolean>(false);

  const fetchHealth = async () => {
    const health = await px4Adapter.fetchBackendHealth();
    if (health) {
      setBackendHealth(health);
      setIsBackendOnline(true);
    } else {
      setIsBackendOnline(false);
      setBackendHealth(null);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 2500);

    const unsub = px4Adapter.onConnectionChange((connected, status) => {
      setIsPx4Connected(connected);
      setPx4Status(status ? { ...status } : null);
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [px4Adapter]);

  const handleToggleMode = (newMode: ApiMode) => {
    setApiMode(newMode);
    apiService.setMode(newMode);
    // Sync with backend
    fetch(`${px4Adapter.getBaseUrl()}/api/v1/simulation/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode }),
    }).catch(() => {});
  };

  const handleToggleTestHarness = async () => {
    setIsTogglingHarness(true);
    try {
      const res = await fetch(`${px4Adapter.getBaseUrl()}/api/v1/simulation/harness/toggle`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchHealth();
      }
    } catch (e) {
      console.error('Failed to toggle test harness:', e);
    } finally {
      setIsTogglingHarness(false);
    }
  };

  // Determine Subsystem States for Priority 1.G
  const backendState = isBackendOnline ? 'CONNECTED' : 'DISCONNECTED';
  const gatewayState = backendHealth?.px4_gateway_status || (isBackendOnline ? 'LISTENING' : 'OFFLINE');
  const gazeboState = backendHealth?.gazebo_status || (isPx4Connected ? 'RUNNING' : 'STANDALONE');
  const px4State = isPx4Connected ? 'CONNECTED' : (px4Status?.gatewayState === 'WAITING_FOR_MAVLINK_HEARTBEAT' ? 'WAITING' : 'DISCONNECTED');
  const heartbeatState = isPx4Connected ? 'RECEIVED' : (px4Status?.heartbeatAgeSec !== null ? 'TIMEOUT' : 'AWAITING');
  const telemetryState = px4Status?.telemetryStatus || (isPx4Connected ? 'LIVE' : 'UNAVAILABLE');

  return (
    <div className="w-full bg-[#0a0f1d] border-b border-[#1b273d] text-xs font-sans px-3 py-1.5 select-none z-20">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Engine Mode Toggle */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-extrabold text-white tracking-wider text-[11px]">ENGINE:</span>
          </div>

          <div className="flex items-center bg-[#131b2c] p-0.5 rounded border border-[#23334f] text-[10px] font-bold">
            <button
              onClick={() => handleToggleMode('mock')}
              className={`px-2 py-0.5 rounded transition-all ${
                apiMode === 'mock'
                  ? 'bg-cyan-500 text-black shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mock Simulation
            </button>
            <button
              onClick={() => handleToggleMode('px4')}
              className={`px-2 py-0.5 rounded transition-all flex items-center gap-1.5 ${
                apiMode === 'px4'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isPx4Connected ? 'bg-emerald-300 animate-pulse' : 'bg-rose-400'}`} />
              <span>PX4 SITL + Gazebo</span>
            </button>
          </div>
        </div>

        {/* Center: Priority 1.G Live Subsystems Multi-Indicator */}
        {apiMode === 'px4' ? (
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
            {/* 1. BACKEND API */}
            <div className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
              backendState === 'CONNECTED'
                ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                : 'bg-rose-950/60 border-rose-600 text-rose-300'
            }`}>
              <Server className="w-3 h-3" />
              <span>API: {backendState}</span>
            </div>

            {/* 2. MAVLINK GATEWAY */}
            <div className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
              gatewayState === 'LISTENING'
                ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}>
              <Radio className="w-3 h-3" />
              <span>GATEWAY: {gatewayState} (UDP:14550)</span>
            </div>

            {/* 3. GAZEBO */}
            <div className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
              gazeboState === 'RUNNING'
                ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}>
              <Box className="w-3 h-3" />
              <span>GAZEBO: {gazeboState}</span>
            </div>

            {/* 4. PX4 SITL */}
            <div className={`px-2 py-0.5 rounded border flex items-center gap-1 font-bold ${
              px4State === 'CONNECTED'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : px4State === 'WAITING'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-rose-500/20 border-rose-500 text-rose-300'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${px4State === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : px4State === 'WAITING' ? 'bg-amber-400' : 'bg-rose-400'}`} />
              <span>PX4 SITL: {px4State}</span>
            </div>

            {/* 5. HEARTBEAT */}
            <div className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
              heartbeatState === 'RECEIVED'
                ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}>
              <Activity className="w-3 h-3" />
              <span>HEARTBEAT: {heartbeatState}</span>
            </div>

            {/* 6. TELEMETRY */}
            <div className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
              telemetryState === 'LIVE'
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 font-extrabold shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                : telemetryState === 'STALE'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-rose-950/60 border-rose-700 text-rose-300'
            }`}>
              <span>TELEMETRY: {telemetryState}</span>
            </div>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-cyan-400/90 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>Standalone Browser Kinematics Simulation Active</span>
          </div>
        )}

        {/* Right: Setup Guide Launcher & Diagnostic Details Toggle */}
        <div className="flex items-center gap-1.5">
          {apiMode === 'px4' && isBackendOnline && (
            <button
              onClick={handleToggleTestHarness}
              disabled={isTogglingHarness}
              className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border transition-colors flex items-center gap-1 ${
                backendHealth?.test_harness_active
                  ? 'bg-amber-950/80 border-amber-500 text-amber-300 hover:bg-amber-900'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="Transmits simulated real MAVLink v2.0 packets on UDP:14550 along Coimbatore corridor"
            >
              <Flame className="w-3 h-3 text-amber-400" />
              <span>{backendHealth?.test_harness_active ? 'Harness ON (UDP:14550)' : 'Test Harness'}</span>
            </button>
          )}

          {onOpenSetupGuide && (
            <button
              onClick={onOpenSetupGuide}
              className="px-2 py-0.5 text-[10px] font-semibold text-slate-300 bg-[#151e30] hover:bg-[#1d2942] border border-[#263757] rounded flex items-center gap-1 transition-colors"
            >
              <Terminal className="w-3 h-3 text-cyan-400" />
              <span>PX4 Setup</span>
            </button>
          )}

          {apiMode === 'px4' && (
            <button
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800/60"
              title="Toggle Detailed Reason & Diagnostics"
            >
              {isDetailsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Diagnostics Drawer with Reason String */}
      {apiMode === 'px4' && isDetailsExpanded && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 space-y-1.5 text-[10px] font-mono text-slate-300">
          <div className="flex items-center gap-2 bg-slate-950/70 p-1.5 rounded border border-slate-800">
            <span className="text-cyan-400 font-bold">STATUS DETAIL:</span>
            <span className="text-slate-200">
              {backendHealth?.connection_reason || px4Status?.gatewayReason || (isBackendOnline ? 'Backend online. Listening on UDP:14550.' : 'Backend service offline at http://localhost:8000. Launch backend gateway script.')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-slate-500">AUTOPILOT: </span>
              <span className="text-white font-bold">{px4Status?.autopilot || 'PX4 SITL'}</span>
            </div>
            <div>
              <span className="text-slate-500">HEARTBEAT AGE: </span>
              <span className="text-cyan-300">
                {px4Status?.heartbeatAgeSec !== null && px4Status?.heartbeatAgeSec !== undefined
                  ? `${px4Status.heartbeatAgeSec}s`
                  : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">FLIGHT MODE: </span>
              <span className="text-amber-300 font-bold">{px4Status?.flightMode || 'DISCONNECTED'}</span>
            </div>
            <div>
              <span className="text-slate-500">TARGET WAYPOINT: </span>
              <span className="text-emerald-300 font-bold">#{px4Status?.currentWaypoint || 0}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
