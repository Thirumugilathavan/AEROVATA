import React from 'react';
import { 
  Battery, 
  Gauge, 
  Clock, 
  ChevronUp, 
  ChevronDown, 
  Radio, 
  Zap, 
  Layers, 
  FileText, 
  ShieldAlert, 
  Compass,
  ArrowUpRight,
  Navigation,
  Signal
} from 'lucide-react';
import { Drone, DroneStatus, Waypoint } from '../types/fleet';
import { formatWaypointDistance, getWaypointStatusBadge, getDistanceMeters } from '../services/telemetryEngine';
import { 
  getBatteryStatusColor, 
  getRtbStatusColor, 
  getGpsFixFormatting 
} from '../styles/designTokens';

export interface BottomMissionBarProps {
  selectedDrone: Drone | null;
  drones: Drone[];
  activeDrawer: 'none' | 'route' | 'checkpoints' | 'logs';
  onSetActiveDrawer: (drawer: 'none' | 'route' | 'checkpoints' | 'logs') => void;
  isFullyCollapsed: boolean;
  onToggleFullyCollapse: () => void;
  checkpointTelemetry?: any;
  onSelectDrone?: (id: string) => void;
  // Deprecated simulation control props maintained for backward interface compatibility
  isSimRunning?: boolean;
  onToggleSim?: () => void;
  simSpeed?: number;
  onChangeSimSpeed?: (speed: number) => void;
  onResetSim?: () => void;
  onFocusDrone?: () => void;
  autoFollow?: boolean;
  onToggleAutoFollow?: () => void;
}

export const BottomMissionBar: React.FC<BottomMissionBarProps> = ({
  selectedDrone,
  drones,
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
          title="Restore Mission Telemetry Toolbar"
          aria-label="Restore Mission Telemetry Toolbar"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0c121e]/95 hover:bg-[#141d30] border border-cyan-500/50 text-cyan-300 text-xs font-mono font-bold shadow-[0_4px_16px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all hover:scale-105"
        >
          <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
          <span>SHOW TELEMETRY BAR</span>
          {selectedDrone && (
            <span className="text-[11px] text-slate-400">({selectedDrone.callsign})</span>
          )}
        </button>
      </div>
    );
  }

  const drone = selectedDrone || drones[0];
  const bat = drone ? Math.round(drone.vitals.batteryPercentage) : 100;
  const batInfo = getBatteryStatusColor(bat);
  const alt = drone ? Math.round(drone.vitals.altitudeMeters) : 65;
  const speed = drone ? Math.round(drone.vitals.groundSpeedKmh) : 0;
  const vSpeed = drone?.vitals.verticalSpeedMs || 0;
  const heading = drone ? Math.round(drone.vitals.headingDegrees) : 0;
  const gpsInfo = getGpsFixFormatting(drone?.vitals.gpsFix, drone?.vitals.satellites);
  const rtbInfo = getRtbStatusColor(drone?.vitals.rtbStatus);

  // Target Waypoint Calculations
  const targetIdx = drone?.targetWaypointIndex !== undefined
    ? drone.targetWaypointIndex
    : (drone ? (drone.currentWaypointIndex === 0 && drone.route && drone.route.length > 1 ? 1 : drone.currentWaypointIndex) : 1);
  const nextWp = drone?.route?.[targetIdx] || (drone?.route && drone.route[drone.route.length - 1]);
  const nextWpName = drone?.nextWaypointName || (nextWp ? nextWp.name : 'Arrival Hub');
  const nextWpNum = String(targetIdx + 1).padStart(2, '0');

  const distToNextMeters = drone?.distanceToNextWaypointMeters !== undefined
    ? drone.distanceToNextWaypointMeters
    : (drone && nextWp ? Math.round(getDistanceMeters(drone.vitals.latitude, drone.vitals.longitude, nextWp.lat, nextWp.lng)) : 0);
  const distStr = formatWaypointDistance(distToNextMeters);
  const statusBadge = getWaypointStatusBadge(drone?.nextWaypointStatus);

  // Next WP ETA
  const speedMs = Math.max(2, (drone?.vitals.groundSpeedKmh || 45) / 3.6);
  const etaSeconds = Math.max(1, Math.round(distToNextMeters / speedMs));
  const etaMinutes = Math.floor(etaSeconds / 60);
  const etaRemSeconds = etaSeconds % 60;
  const etaStr = `${etaMinutes}:${etaRemSeconds.toString().padStart(2, '0')}`;

  // Total Mission ETA
  const remKm = drone?.distanceRemainingKm !== undefined ? drone.distanceRemainingKm : 4.5;
  const totalEtaMinutes = Math.max(1, Math.ceil((remKm / Math.max(20, drone?.vitals.groundSpeedKmh || 45)) * 60));

  return (
    <div className="w-full bg-[#080d18]/95 border-t border-[#1c2940] backdrop-blur-md select-none shrink-0 z-10 transition-all duration-300 font-sans">
      {/* ─── TELEMETRY BAR (HEIGHT: ~48px) ─── */}
      <div className="h-12 px-3 flex items-center justify-between gap-3 text-xs font-mono">
        {/* ─── LEFT: ACTIVE VEHICLE & NEXT WAYPOINT (Clean formatting) ─── */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Active Aircraft Chip */}
          <div className="flex items-center gap-2 bg-[#101726] border border-cyan-500/50 px-2.5 py-1 rounded-md shadow-sm shrink-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-extrabold text-white tracking-wider text-[12px]">
              {drone ? drone.callsign : 'NO VEHICLE'}
            </span>
            <span className="text-[10px] text-cyan-300 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-800 font-bold">
              {drone?.id || 'AV-01'}
            </span>
          </div>

          {/* Clean "Next Waypoint" field (Requirement 5) */}
          <div className="hidden md:flex items-center gap-2 bg-[#0c1220] border border-[#1e2c45] px-2.5 py-1 rounded-md text-[11px] truncate shadow-sm">
            <span className="text-slate-400 font-bold">Next:</span>
            <span className="text-cyan-300 font-extrabold">WP-{nextWpNum}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-100 font-bold truncate max-w-[130px]" title={nextWpName}>
              {nextWpName}
            </span>
            <span className="text-slate-500">·</span>
            <span className="font-extrabold text-white">{distStr}</span>
            <span className="text-slate-500">·</span>
            <span className="text-cyan-400 font-bold">ETA {etaStr}</span>
            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${statusBadge.badgeClass}`}>
              {statusBadge.label}
            </span>
          </div>
        </div>

        {/* ─── CENTER: PROMINENT CRITICAL KINEMATICS & THRESHOLD COLORING (Req 5) ─── */}
        <div className="flex items-center gap-3 bg-[#0a0f1d] border border-[#1b273d] px-3.5 py-1 rounded-full text-slate-300 shrink-0 shadow-inner">
          {/* 1. Battery with Threshold Coloring */}
          <div className="flex items-center gap-1.5" title={`Battery: ${bat}% · ${batInfo.level.toUpperCase()}`}>
            <Battery className={`w-4 h-4 ${batInfo.textClass}`} />
            <span className={`text-[13px] font-black ${batInfo.textClass}`}>
              {bat}%
            </span>
          </div>

          <span className="text-slate-700">|</span>

          {/* 2. Ground Speed */}
          <div className="flex items-center gap-1.5" title="Ground Speed (Kmh)">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span className="text-[13px] font-black text-white">
              {speed} <span className="text-[10px] text-slate-400 font-normal">km/h</span>
            </span>
          </div>

          <span className="text-slate-700">|</span>

          {/* 3. Altitude AGL */}
          <div className="flex items-center gap-1.5" title="Altitude Above Ground Level">
            <span className="text-slate-400 text-[10px] font-bold">ALT:</span>
            <span className="text-[13px] font-black text-cyan-300">
              {alt}m
            </span>
          </div>

          {/* 4. Vertical Speed (Requirement 5) */}
          <div className="hidden lg:flex items-center gap-1" title="Vertical Climb / Descent Rate">
            <span className="text-slate-500 text-[10px] font-bold">V/S:</span>
            <span className={`text-[11px] font-bold ${vSpeed > 0.2 ? 'text-emerald-400' : vSpeed < -0.2 ? 'text-amber-400' : 'text-slate-300'}`}>
              {vSpeed > 0 ? '+' : ''}{vSpeed.toFixed(1)}m/s
            </span>
          </div>

          <span className="text-slate-700 hidden lg:inline">|</span>

          {/* 5. Heading (Requirement 5) */}
          <div className="hidden lg:flex items-center gap-1" title="Aircraft Heading Degrees">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-bold text-slate-200">
              {heading.toString().padStart(3, '0')}°
            </span>
          </div>

          {/* 6. Remaining Distance & Total Mission ETA */}
          {drone?.distanceRemainingKm !== undefined && (
            <>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1" title="Distance Remaining to Final Arrival Hub">
                <span className="text-slate-400 text-[10px] font-bold">REM:</span>
                <span className="text-[13px] font-black text-slate-100">
                  {remKm.toFixed(1)}km
                </span>
                <span className="text-cyan-400 text-[10px] font-bold ml-0.5">
                  (~{totalEtaMinutes}m)
                </span>
              </div>
            </>
          )}

          {/* 7. RTB Status with Threshold Coloring (Requirement 5) */}
          {drone?.vitals.rtbStatus && (
            <>
              <span className="text-slate-700 hidden sm:inline">|</span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${rtbInfo.badgeClass}`}>
                RTB: {rtbInfo.label}
              </span>
            </>
          )}

          {/* 8. GPS / Satellites Link Quality (Requirement 5) */}
          <div className="hidden xl:flex items-center gap-1 text-[10px] font-bold border-l border-slate-800 pl-2">
            <Signal className={`w-3.5 h-3.5 ${gpsInfo.textClass}`} />
            <span className={gpsInfo.textClass}>{gpsInfo.label}</span>
          </div>
        </div>

        {/* ─── RIGHT: DRAWER SHORTCUTS (Route HUD, Checkpoints, Logs) ─── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Route HUD Drawer Toggle */}
          <button
            onClick={() => onSetActiveDrawer(activeDrawer === 'route' ? 'none' : 'route')}
            aria-label="Toggle Route Intelligence HUD Drawer"
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              activeDrawer === 'route'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
            }`}
            title="Inspect Selected Drone Route & Autonomous Vitals"
          >
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
            <span>Route HUD</span>
          </button>

          {/* Checkpoints Drawer Toggle */}
          <button
            onClick={() => onSetActiveDrawer(activeDrawer === 'checkpoints' ? 'none' : 'checkpoints')}
            aria-label="Toggle Checkpoint Mission Controller Drawer"
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              activeDrawer === 'checkpoints'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
            }`}
            title="Open Autonomous Waypoint Sequencer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Checkpoints</span>
          </button>

          {/* Flight Logs Drawer Toggle */}
          <button
            onClick={() => onSetActiveDrawer(activeDrawer === 'logs' ? 'none' : 'logs')}
            aria-label="Toggle UTM Flight Logs Drawer"
            className={`hidden md:flex px-2.5 py-1 rounded-md text-[11px] font-bold items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              activeDrawer === 'logs'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
            }`}
            title="View Live UTM Flight Logs & Battery Cells"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Logs</span>
          </button>

          {/* Minimize / Collapse Button */}
          <button
            onClick={onToggleFullyCollapse}
            aria-label="Minimize Telemetry Toolbar"
            title="Minimize Toolbar (Full Map Experience)"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
