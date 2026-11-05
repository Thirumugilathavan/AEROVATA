import React, { useMemo } from 'react';
import {
  X,
  Navigation,
  Battery,
  Zap,
  Package,
  Clock,
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  AlertTriangle,
  MapPin,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { Drone } from '../types/fleet';
import { formatWaypointDistance } from '../services/telemetryEngine';

interface DroneInfoPanelProps {
  drone: Drone;
  onClose: () => void;
  onPauseResume: (id: string) => void;
  onTriggerRTB: (id: string) => void;
  onMarkComplete: (id: string) => void;
  onTriggerReplan: (id: string) => void;
}

const DroneIcon = ({ color = 'currentColor', size = 28 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="16" cy="16" rx="5" ry="3.5" fill={color} fillOpacity="0.9" />
    <line x1="11" y1="16" x2="5" y2="11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <line x1="21" y1="16" x2="27" y2="11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <line x1="11" y1="16" x2="5" y2="21" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <line x1="21" y1="16" x2="27" y2="21" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <ellipse cx="5" cy="10.5" rx="3.5" ry="1.2" fill={color} fillOpacity="0.45" />
    <ellipse cx="27" cy="10.5" rx="3.5" ry="1.2" fill={color} fillOpacity="0.45" />
    <ellipse cx="5" cy="21.5" rx="3.5" ry="1.2" fill={color} fillOpacity="0.45" />
    <ellipse cx="27" cy="21.5" rx="3.5" ry="1.2" fill={color} fillOpacity="0.45" />
    <circle cx="16" cy="16" r="1.5" fill="white" fillOpacity="0.85" />
  </svg>
);

const getDroneColor = (status: string) => {
  switch (status) {
    case 'delivering': return '#00e5ff';
    case 'en_route_pickup': return '#3b82f6';
    case 'returning_to_base': return '#10b981';
    case 'charging': return '#f59e0b';
    case 'attention_required': return '#ef4444';
    default: return '#64748b';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'delivering': return 'In Transit';
    case 'en_route_pickup': return 'En Route to Pickup';
    case 'returning_to_base': return 'Returning to Base';
    case 'charging': return 'Charging';
    case 'attention_required': return 'Attention Required';
    case 'hovering': return 'Hovering';
    default: return 'Standby';
  }
};

const calcRouteProgress = (drone: Drone): number => {
  const total = drone.route.length;
  if (total === 0) return 0;
  const completed = drone.route.filter(w => w.status === 'completed').length;
  return Math.round((completed / total) * 100);
};

const calcDistKm = (drone: Drone): string => {
  const dest = drone.route.find(w => w.type === 'delivery' && w.status !== 'completed');
  if (!dest) {
    // Returning to base
    const base = drone.route.find(w => w.type === 'base' && w.status === 'upcoming');
    if (!base) return '--';
    const R = 6371;
    const dLat = (base.lat - drone.vitals.latitude) * Math.PI / 180;
    const dLon = (base.lng - drone.vitals.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
      Math.cos(drone.vitals.latitude * Math.PI / 180) *
      Math.cos(base.lat * Math.PI / 180) *
      Math.sin(dLon/2)**2;
    const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(2)}km`;
  }
  const R = 6371;
  const dLat = (dest.lat - drone.vitals.latitude) * Math.PI / 180;
  const dLon = (dest.lng - drone.vitals.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(drone.vitals.latitude * Math.PI / 180) *
    Math.cos(dest.lat * Math.PI / 180) *
    Math.sin(dLon/2)**2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(2)}km`;
};

const calcETA = (drone: Drone): string => {
  const activeWp = drone.route.find(w => w.status === 'active');
  if (activeWp?.etaMinutes != null) {
    const m = Math.max(0, Math.round(activeWp.etaMinutes));
    if (m === 0) return 'Arriving now';
    return `${m} min`;
  }
  if (drone.delivery?.estimatedArrivalTime) return drone.delivery.estimatedArrivalTime;
  return '--';
};

export const DroneInfoPanel: React.FC<DroneInfoPanelProps> = ({
  drone,
  onClose,
  onPauseResume,
  onTriggerRTB,
  onMarkComplete,
  onTriggerReplan,
}) => {
  const color = getDroneColor(drone.status);
  const bat = drone.vitals.batteryPercentage;
  const batColor = bat > 50 ? '#10b981' : bat > 25 ? '#f59e0b' : '#ef4444';
  const progress = calcRouteProgress(drone);
  const dist = calcDistKm(drone);
  const eta = calcETA(drone);
  const isWarning = drone.status === 'attention_required';
  const isReturning = drone.status === 'returning_to_base';

  const destWp = drone.route.find(w => w.type === 'delivery');
  const destLabel = drone.delivery?.destinationAddress || destWp?.name || 'Unknown';
  const destShort = destLabel.split(',')[0];

  const targetIdx = drone.targetWaypointIndex !== undefined
    ? drone.targetWaypointIndex
    : (drone.currentWaypointIndex === 0 && drone.route.length > 1 ? 1 : drone.currentWaypointIndex);
  const nextWp = drone.route[targetIdx] || drone.route[drone.route.length - 1];

  return (
    <div className="drone-info-panel" style={isWarning ? { borderColor: 'rgba(239,68,68,0.4)' } : {}}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b border-[#1a2235]"
        style={{ background: `linear-gradient(135deg, ${color}0d 0%, transparent 60%)` }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <DroneIcon color={color} size={30} />
            {isWarning && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-400 rounded-full status-dot-blink" />
            )}
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-none">{drone.callsign}</div>
            <div className="text-[10px] mt-0.5 font-mono" style={{ color }}>
              {getStatusLabel(drone.status)}
              {drone.isPaused && <span className="ml-1 text-amber-400">· PAUSED</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Model badge */}
          <span className="text-[9px] font-mono text-slate-500 bg-[#111622] px-2 py-0.5 rounded border border-[#1a2235] hidden sm:block">
            {drone.model.split(' ').slice(-2).join(' ')}
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 rounded transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Route Progress Bar */}
      <div className="px-4 py-2.5 border-b border-[#1a2235]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-400">Destination</span>
          </div>
          <span className="text-[10px] font-mono text-slate-300 truncate max-w-[170px]">{destShort}</span>
        </div>
        <div className="relative h-1.5 bg-[#1a2235] rounded-full overflow-hidden">
          <div
            className="route-progress-bar absolute left-0 top-0 h-full rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-slate-600 font-mono">Base</span>
          <span className="text-[9px] text-slate-500 font-mono">{progress}% complete</span>
          <span className="text-[9px] text-slate-600 font-mono">Dest</span>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3 divide-x divide-[#1a2235] border-b border-[#1a2235]">
        {/* Distance */}
        <div className="px-3 py-2.5 flex flex-col items-center">
          <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Distance</div>
          <div className="text-sm font-bold text-white font-mono">{dist}</div>
          <div className="text-[9px] text-slate-500">remaining</div>
        </div>

        {/* ETA */}
        <div className="px-3 py-2.5 flex flex-col items-center">
          <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">ETA</div>
          <div className="text-sm font-bold font-mono" style={{ color }}>{eta}</div>
          <div className="text-[9px] text-slate-500">est. arrival</div>
        </div>

        {/* Speed */}
        <div className="px-3 py-2.5 flex flex-col items-center">
          <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Speed</div>
          <div className="text-sm font-bold text-white font-mono">{Math.round(drone.vitals.groundSpeedKmh)}</div>
          <div className="text-[9px] text-slate-500">km/h</div>
        </div>
      </div>

      {/* Vitals */}
      <div className="px-4 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 border-b border-[#1a2235] text-[11px]">
        {/* Battery */}
        <div className="flex items-center justify-between">
          <span className="text-slate-500 flex items-center gap-1"><Battery className="w-3 h-3" /> Battery</span>
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-1 bg-[#1a2235] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${bat}%`, background: batColor }} />
            </div>
            <span className="font-mono" style={{ color: batColor }}>{Math.round(bat)}%</span>
          </div>
        </div>

        {/* Altitude */}
        <div className="flex items-center justify-between">
          <span className="text-slate-500 flex items-center gap-1"><Activity className="w-3 h-3" /> Alt</span>
          <span className="font-mono text-slate-200">{Math.round(drone.vitals.altitudeMeters)}m AGL</span>
        </div>

        {/* Heading */}
        <div className="flex items-center justify-between">
          <span className="text-slate-500 flex items-center gap-1"><Navigation className="w-3 h-3" /> Hdg</span>
          <span className="font-mono text-slate-200">{Math.round(drone.vitals.headingDegrees)}°</span>
        </div>

        {/* Signal */}
        <div className="flex items-center justify-between">
          <span className="text-slate-500 flex items-center gap-1"><Zap className="w-3 h-3" /> Signal</span>
          <span className="font-mono text-slate-200">{drone.vitals.signalQualityPercent}%</span>
        </div>

        {/* GPS */}
        <div className="flex items-center justify-between col-span-2">
          <span className="text-slate-500">GPS</span>
          <span className="font-mono text-[10px] text-emerald-400">{drone.vitals.gpsFix} · {drone.vitals.satellites} sats</span>
        </div>
      </div>

      {/* Next Waypoint */}
      {nextWp && (
        <div className="px-4 py-2 border-b border-[#1a2235] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-cyan-400 font-bold mr-1">WP-{String(targetIdx + 1).padStart(2, '0')}:</span>
              <span className="text-[10px] text-slate-200 truncate">{nextWp.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] font-mono font-bold text-white">
              {formatWaypointDistance(drone.distanceToNextWaypointMeters)}
            </span>
            <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-cyan-950 border border-cyan-700 text-cyan-300">
              {drone.nextWaypointStatus || 'APPROACHING'}
            </span>
          </div>
        </div>
      )}

      {/* Delivery Info */}
      {drone.delivery && (
        <div className="px-4 py-2 border-b border-[#1a2235] flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-slate-400 truncate block">{drone.delivery.packageDescription}</span>
          </div>
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0 ${
            drone.delivery.priority === 'URGENT' ? 'text-rose-400 border-rose-800 bg-rose-950/50' :
            drone.delivery.priority === 'HIGH' ? 'text-amber-400 border-amber-800 bg-amber-950/50' :
            'text-slate-400 border-slate-700 bg-slate-900/50'
          }`}>{drone.delivery.priority}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-4 py-2.5 flex items-center gap-2">
        {/* Pause / Resume */}
        <button
          onClick={() => onPauseResume(drone.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border border-[#1a2235] hover:border-slate-600 text-slate-300 hover:text-white hover:bg-white/5"
        >
          {drone.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          {drone.isPaused ? 'Resume' : 'Pause'}
        </button>

        {/* RTB */}
        {!isReturning && (
          <button
            onClick={() => onTriggerRTB(drone.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border border-[#1a2235] hover:border-amber-700 text-amber-400 hover:bg-amber-950/30"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RTB
          </button>
        )}

        {/* Replan (for attention_required) */}
        {isWarning && (
          <button
            onClick={() => onTriggerReplan(drone.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border border-cyan-800/50 text-cyan-400 hover:bg-cyan-950/30"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Replan
          </button>
        )}

        {/* Mark complete */}
        {drone.delivery?.status === 'In Progress' && drone.route.find(w => w.type === 'delivery' && w.status === 'active') && (
          <button
            onClick={() => onMarkComplete(drone.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border border-emerald-800/50 text-emerald-400 hover:bg-emerald-950/30"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Complete
          </button>
        )}
      </div>
    </div>
  );
};
