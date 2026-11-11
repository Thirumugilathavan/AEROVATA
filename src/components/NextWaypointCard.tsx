import React, { useState } from 'react';
import { Navigation, Clock, Mountain, ArrowUpRight, ChevronRight, X, Eye, EyeOff } from 'lucide-react';
import { Drone } from '../types/fleet';
import { formatWaypointDistance, getWaypointStatusBadge, getDistanceMeters } from '../services/telemetryEngine';

export interface NextWaypointCardProps {
  selectedDrone: Drone | null;
  onSelectWaypoint?: (wpId: string) => void;
}

export const NextWaypointCard: React.FC<NextWaypointCardProps> = ({
  selectedDrone,
  onSelectWaypoint,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!selectedDrone || !selectedDrone.route || selectedDrone.route.length === 0 || isDismissed) {
    return null;
  }

  const drone = selectedDrone;
  const targetIdx = drone.targetWaypointIndex !== undefined
    ? drone.targetWaypointIndex
    : (drone.currentWaypointIndex === 0 && drone.route.length > 1 ? 1 : drone.currentWaypointIndex);
  
  const targetWp = drone.route[targetIdx] || drone.route[drone.route.length - 1];
  if (!targetWp) return null;

  const wpSeq = String(targetIdx + 1).padStart(2, '0');
  const wpName = targetWp.name || `Waypoint ${wpSeq}`;
  const wpAlt = Math.round(targetWp.altitudeMeters || 65);

  const distMeters = drone.distanceToNextWaypointMeters !== undefined
    ? drone.distanceToNextWaypointMeters
    : Math.round(getDistanceMeters(drone.vitals.latitude, drone.vitals.longitude, targetWp.lat, targetWp.lng));

  const distStr = formatWaypointDistance(distMeters);
  const statusBadge = getWaypointStatusBadge(drone.nextWaypointStatus);

  // ETA calculation in seconds based on ground speed (default 45 km/h = 12.5 m/s)
  const speedMs = Math.max(2, (drone.vitals.groundSpeedKmh || 45) / 3.6);
  const etaSeconds = Math.max(1, Math.round(distMeters / speedMs));
  const etaMinutes = Math.floor(etaSeconds / 60);
  const etaRemSeconds = etaSeconds % 60;
  const etaStr = `${etaMinutes}:${etaRemSeconds.toString().padStart(2, '0')}`;

  return (
    <div className="bg-[#0b111e]/95 backdrop-blur-md border border-[#1f2d48] rounded-lg p-2.5 shadow-2xl z-20 text-xs font-mono pointer-events-auto min-w-[240px] max-w-[280px] animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#1b263b] mb-2">
        <div className="flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-white text-[11px] uppercase tracking-wider">
            NEXT WAYPOINT
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${statusBadge.badgeClass}`}>
            {statusBadge.label}
          </span>
          <button
            onClick={() => setIsDismissed(true)}
            className="text-slate-500 hover:text-slate-300 p-0.5 rounded"
            title="Dismiss card"
            aria-label="Dismiss next waypoint card"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Waypoint Identity */}
      <div 
        className="cursor-pointer group mb-2"
        onClick={() => onSelectWaypoint && targetWp.id && onSelectWaypoint(targetWp.id)}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-cyan-400 font-extrabold text-[12px]">WP-{wpSeq}:</span>
          <span className="text-slate-100 font-bold truncate group-hover:text-cyan-300 transition-colors" title={wpName}>
            {wpName}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-1.5 bg-[#070c17] p-1.5 rounded border border-[#172238]">
        <div>
          <div className="text-[9px] text-slate-400 font-bold">DISTANCE</div>
          <div className="text-[12px] font-extrabold text-white">{distStr}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-400 font-bold">ETA</div>
          <div className="text-[12px] font-extrabold text-cyan-300">{etaStr}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-400 font-bold">ALTITUDE</div>
          <div className="text-[12px] font-extrabold text-slate-200">{wpAlt}m</div>
        </div>
      </div>
    </div>
  );
};
