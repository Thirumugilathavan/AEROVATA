/**
 * PX4 SITL & Gazebo Autopilot Status Banner
 * AEROVATA by TASPORA
 * 
 * Prominently visualizes genuine autopilot connection status.
 * Fulfills Requirement 5:
 * "Clearly distinguish genuine PX4/Gazebo telemetry from mock data.
 *  If the simulator is disconnected, show a disconnected status rather than pretending the drone is flying."
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
  ChevronUp
} from 'lucide-react';
import { apiService, ApiMode } from '../services/api/index.ts';
import type { Px4AutopilotStatus } from '../services/px4/Px4SitlAdapter.ts';

interface Px4SitlStatusBannerProps {
  onOpenSetupGuide?: () => void;
}

export const Px4SitlStatusBanner: React.FC<Px4SitlStatusBannerProps> = ({ onOpenSetupGuide }) => {
  const px4Adapter = apiService.getPx4Adapter();
  const [apiMode, setApiMode] = useState<ApiMode>(() => apiService.getMode());
  const [isPx4Connected, setIsPx4Connected] = useState<boolean>(() => px4Adapter.isAutopilotConnected());
  const [px4Status, setPx4Status] = useState<Px4AutopilotStatus | null>(() => px4Adapter.getAutopilotStatus());
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(false);

  useEffect(() => {
    const unsub = px4Adapter.onConnectionChange((connected, status) => {
      setIsPx4Connected(connected);
      setPx4Status(status ? { ...status } : null);
    });
    return () => unsub();
  }, [px4Adapter]);

  const handleToggleMode = (newMode: ApiMode) => {
    setApiMode(newMode);
    apiService.setMode(newMode);
  };

  return (
    <div className="w-full bg-[#0a0f1d] border-b border-[#1b273d] text-xs font-sans px-4 py-2 select-none z-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Mode Switcher & Hardware Label */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span className="font-extrabold text-white tracking-wider text-xs">SIMULATION ENGINE:</span>
          </div>

          <div className="flex items-center bg-[#131b2c] p-0.5 rounded border border-[#23334f] text-[11px] font-bold">
            <button
              onClick={() => handleToggleMode('mock')}
              className={`px-2.5 py-1 rounded transition-all ${
                apiMode === 'mock'
                  ? 'bg-cyan-500 text-black shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mock Simulation
            </button>
            <button
              onClick={() => handleToggleMode('px4')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1.5 ${
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

        {/* Center: Genuine Autopilot Connection Badge */}
        {apiMode === 'px4' ? (
          <div className="flex items-center gap-2">
            {isPx4Connected ? (
              <div className="px-3 py-1 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] font-bold flex items-center gap-2 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>PX4 AUTOPILOT (SITL): CONNECTED</span>
                <span className="text-slate-400">|</span>
                <span className="text-cyan-300">{px4Status?.vehicle || 'x500 Quadrotor'}</span>
                <span className="text-slate-400">|</span>
                <span className="text-amber-300">{px4Status?.flightMode || 'AUTO.MISSION'}</span>
                <span className="text-slate-400">|</span>
                <span className={px4Status?.armed ? 'text-emerald-400 font-extrabold' : 'text-slate-400'}>
                  {px4Status?.armed ? 'ARMED' : 'DISARMED'}
                </span>
              </div>
            ) : (
              <div className="px-3 py-1 rounded bg-rose-500/15 border border-rose-500/40 text-rose-300 font-mono text-[11px] font-bold flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>PX4 SITL: DISCONNECTED (Awaiting MAVLink UDP:14550)</span>
                <span className="text-slate-400 font-sans font-normal text-[10px]">
                  — Telemetry withheld to prevent fake simulation display
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-[11px] font-mono text-cyan-400/90 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>Standalone Browser Kinematics Simulation Active</span>
          </div>
        )}

        {/* Right: Setup Guide Launcher & Diagnostic Details Toggle */}
        <div className="flex items-center gap-2">
          {onOpenSetupGuide && (
            <button
              onClick={onOpenSetupGuide}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 bg-[#151e30] hover:bg-[#1d2942] border border-[#263757] rounded flex items-center gap-1.5 transition-colors"
            >
              <Terminal className="w-3 h-3 text-cyan-400" />
              <span>PX4 / Gazebo Setup</span>
            </button>
          )}

          {apiMode === 'px4' && (
            <button
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800/60"
              title="Toggle Telemetry Diagnostics"
            >
              {isDetailsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Diagnostics Drawer */}
      {apiMode === 'px4' && isDetailsExpanded && (
        <div className="mt-2 pt-2 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono text-slate-300">
          <div>
            <span className="text-slate-500">AUTOPILOT: </span>
            <span className="text-white font-bold">{px4Status?.autopilot || 'PX4 SITL'}</span>
          </div>
          <div>
            <span className="text-slate-500">HEARTBEAT AGE: </span>
            <span className="text-cyan-300">{px4Status?.heartbeatAgeSec !== null ? `${px4Status?.heartbeatAgeSec}s` : 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-500">TARGET WAYPOINT: </span>
            <span className="text-amber-300 font-bold">#{px4Status?.currentWaypoint || 0}</span>
          </div>
          <div>
            <span className="text-slate-500">MAVLINK PROTOCOL: </span>
            <span className="text-emerald-300">v2.0 (UDP:14550)</span>
          </div>
        </div>
      )}
    </div>
  );
};
