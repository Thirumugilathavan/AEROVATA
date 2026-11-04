import React from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Crosshair, 
  Navigation, 
  Battery, 
  Gauge, 
  Clock, 
  ChevronUp, 
  ChevronDown, 
  X, 
  Radio, 
  Zap, 
  Layers, 
  FileText, 
  ShieldAlert, 
  Eye,
  CheckCircle2,
  Compass
} from 'lucide-react';
import { Drone, DroneStatus, Waypoint } from '../types/fleet';

export interface BottomMissionBarProps {
  selectedDrone: Drone | null;
  drones: Drone[];
  isSimRunning: boolean;
  onToggleSim: () => void;
  simSpeed: number;
  onChangeSimSpeed: (speed: number) => void;
  onResetSim: () => void;
  onFocusDrone: () => void;
  autoFollow: boolean;
  onToggleAutoFollow: () => void;
  onSelectDrone: (id: string) => void;
  activeDrawer: 'none' | 'route' | 'checkpoints' | 'logs';
  onSetActiveDrawer: (drawer: 'none' | 'route' | 'checkpoints' | 'logs') => void;
  isFullyCollapsed: boolean;
  onToggleFullyCollapse: () => void;
  checkpointTelemetry?: any;
}

export const BottomMissionBar: React.FC<BottomMissionBarProps> = ({
  selectedDrone,
  drones,
  isSimRunning,
  onToggleSim,
  simSpeed,
  onChangeSimSpeed,
  onResetSim,
  onFocusDrone,
  autoFollow,
  onToggleAutoFollow,
  onSelectDrone,
  activeDrawer,
  onSetActiveDrawer,
  isFullyCollapsed,
  onToggleFullyCollapse,
  checkpointTelemetry,
}) => {
  // If user fully collapsed the bottom toolbar, show only a discreet floating restore pill
  if (isFullyCollapsed) {
    return (
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <button
          onClick={onToggleFullyCollapse}
          title="Restore Mission Toolbar"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0c121e]/90 hover:bg-[#141d30] border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold shadow-[0_4px_16px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all hover:scale-105"
        >
          <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
          <span>SHOW MISSION TOOLBAR</span>
          {selectedDrone && (
            <span className="text-[10px] text-slate-400">({selectedDrone.callsign})</span>
          )}
        </button>
      </div>
    );
  }

  const drone = selectedDrone || drones[0];
  const bat = drone ? Math.round(drone.vitals.batteryPercentage) : 100;
  const batColor = bat > 50 ? 'text-emerald-400' : bat > 25 ? 'text-amber-400' : 'text-rose-400';
  const alt = drone ? Math.round(drone.vitals.altitudeMeters) : 65;
  const speed = drone ? Math.round(drone.vitals.groundSpeedKmh) : 0;
  const nextWp = drone?.route && drone.currentWaypointIndex < drone.route.length - 1
    ? drone.route[drone.currentWaypointIndex + 1]
    : null;
  const nextWpName = drone?.nextWaypointName || (nextWp ? nextWp.name : 'Approaching Pad');
  const nextWpNum = drone ? (drone.currentWaypointIndex + 1).toString().padStart(2, '0') : '01';

  return (
    <div className="w-full bg-[#0a0e18]/95 border-t border-[#1e2a40] backdrop-blur-md select-none shrink-0 z-10 transition-all duration-300">
      {/* ─── COMPACT TOOLBAR (HEIGHT: ~46px) ─── */}
      <div className="h-[46px] px-3 flex items-center justify-between gap-3 text-xs font-mono">
        {/* Left Section: Selected Aircraft & Mission Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Active Aircraft Chip */}
          <div className="flex items-center gap-2 bg-[#121828] border border-cyan-500/40 px-2.5 py-1 rounded shadow-sm shrink-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-bold text-white tracking-wider">
              {drone ? drone.callsign : 'NO VEHICLE'}
            </span>
            <span className="text-[10px] text-cyan-300 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-800">
              {drone?.id || 'AV-01'}
            </span>
          </div>

          {/* Mission Destination & Status */}
          <div className="hidden md:flex items-center gap-1.5 bg-[#0e1422] border border-[#1e2c45] px-2.5 py-1 rounded truncate">
            <Navigation className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="text-slate-300 truncate max-w-[180px]" title={drone?.missionDestinationName || 'Mission Pad'}>
              {drone?.missionDestinationName || 'KMCH Helipad'}
            </span>
            <span className="text-slate-600">•</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              drone?.isRerouting ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {drone?.isRerouting ? 'A* REROUTED' : drone?.status === 'delivering' ? 'DELIVERING' : 'ON MISSION'}
            </span>
          </div>

          {/* Next Waypoint Target */}
          <div className="hidden lg:flex items-center gap-1.5 bg-[#0e1422] border border-[#1e2c45] px-2 py-1 rounded text-[11px] truncate">
            <span className="text-cyan-400 font-bold">WP-{nextWpNum}:</span>
            <span className="text-slate-300 truncate max-w-[160px]" title={nextWpName}>
              {nextWpName}
            </span>
          </div>
        </div>

        {/* Center Section: Core Flight Kinematics */}
        <div className="hidden sm:flex items-center gap-3 bg-[#0c1220] border border-[#1c273e] px-3 py-1 rounded-full text-slate-300 shrink-0">
          <div className="flex items-center gap-1.5">
            <Battery className={`w-3.5 h-3.5 ${batColor}`} />
            <span className={`font-bold ${batColor}`}>{bat}%</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold text-white">{speed} km/h</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[10px]">ALT:</span>
            <span className="font-bold text-cyan-300">{alt}m</span>
          </div>
          {drone?.vitals.rtbStatus && (
            <>
              <span className="text-slate-700">|</span>
              <span className={`text-[10px] font-bold ${
                drone.vitals.rtbStatus === 'SUFFICIENT' ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                RTB: {drone.vitals.rtbStatus}
              </span>
            </>
          )}
        </div>

        {/* Right Section: Controls & Expandable Drawers */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Play/Pause Simulation */}
          <button
            onClick={onToggleSim}
            title={isSimRunning ? 'Pause Simulation' : 'Resume Simulation'}
            className={`p-1.5 rounded border transition-colors ${
              isSimRunning
                ? 'bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/40'
                : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/40'
            }`}
          >
            {isSimRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {/* Sim Speed Selectors */}
          <div className="hidden xl:flex items-center bg-[#101626] border border-[#1f2b44] rounded p-0.5">
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => onChangeSimSpeed(spd)}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                  simSpeed === spd
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Reset Sim */}
          <button
            onClick={onResetSim}
            title="Reset Simulation to Initial Waypoints"
            className="p-1.5 rounded bg-[#101626] border border-[#1f2b44] text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Focus Drone */}
          <button
            onClick={onFocusDrone}
            title="Focus Camera on Selected Drone"
            className="px-2 py-1 rounded bg-[#101626] border border-cyan-500/30 text-cyan-300 hover:bg-cyan-950 hover:border-cyan-400 text-[11px] font-bold flex items-center gap-1 transition-all"
          >
            <Crosshair className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">FOCUS</span>
          </button>

          {/* Follow Drone Toggle */}
          <button
            onClick={onToggleAutoFollow}
            title="Continuously Track Drone (Follow Mode)"
            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${
              autoFollow
                ? 'bg-cyan-500 text-slate-950 border border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                : 'bg-[#101626] border border-[#1f2b44] text-slate-300 hover:text-cyan-300'
            }`}
          >
            <Navigation className="w-3 h-3" />
            <span className="hidden sm:inline">FOLLOW</span>
          </button>

          {/* Divider */}
          <div className="w-[1px] h-5 bg-[#1f2a40] mx-0.5" />

          {/* Expand Drawer Buttons */}
          <button
            onClick={() => onSetActiveDrawer(activeDrawer === 'route' ? 'none' : 'route')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              activeDrawer === 'route'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
            }`}
          >
            <Navigation className="w-3 h-3 text-cyan-400" />
            <span>Route HUD</span>
          </button>

          <button
            onClick={() => onSetActiveDrawer(activeDrawer === 'checkpoints' ? 'none' : 'checkpoints')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
              activeDrawer === 'checkpoints'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Checkpoints</span>
          </button>

          <button
            onClick={() => onSetActiveDrawer(activeDrawer === 'logs' ? 'none' : 'logs')}
            className={`hidden md:flex px-2.5 py-1 rounded text-[11px] font-bold items-center gap-1.5 transition-all ${
              activeDrawer === 'logs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Logs</span>
          </button>

          {/* Minimize / Collapse Button */}
          <button
            onClick={onToggleFullyCollapse}
            title="Minimize Toolbar (Map-First View)"
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
