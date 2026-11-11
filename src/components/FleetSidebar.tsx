import React, { useState } from 'react';
import { 
  Battery, 
  Search, 
  AlertTriangle, 
  Radio, 
  Compass,
  ShieldAlert, 
  ShieldCheck, 
  Zap, 
  Navigation,
  X,
  SlidersHorizontal,
  ChevronRight,
  Crosshair,
  Plus,
  Trash2,
  Route as RouteIcon,
  MapPin
} from 'lucide-react';
import { QuadcopterIcon } from './icons/QuadcopterIcon';
import { Drone, DroneStatus, ObstacleConflict } from '../types/fleet';
import { formatWaypointDistance, getWaypointStatusBadge } from '../services/telemetryEngine';

interface FleetSidebarProps {
  drones: Drone[];
  selectedDroneId: string | null;
  onSelectDrone: (id: string) => void;
  filter: string;
  setFilter: (filter: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeAlertsCount: number;
  obstacleConflicts?: ObstacleConflict[];
  isExpanded?: boolean;
  onToggleExpand?: (expanded: boolean) => void;
  onOpenAddDrone?: () => void;
  onRemoveDrone?: (id: string) => void;
}

export const FleetSidebar: React.FC<FleetSidebarProps> = ({
  drones,
  selectedDroneId,
  onSelectDrone,
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  activeAlertsCount,
  obstacleConflicts = [],
  isExpanded = false,
  onToggleExpand,
  onOpenAddDrone,
  onRemoveDrone,
}) => {
  // Removal confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Counters
  const totalCount = drones.length;
  const activeCount = drones.filter((d) => ['delivering', 'en_route_pickup', 'returning_to_base', 'active'].includes(d.status)).length;
  const chargingCount = drones.filter((d) => d.status === 'charging').length;
  const attentionCount = drones.filter((d) => d.status === 'attention_required' || d.vitals.batteryPercentage < 30 || d.inSimulationConflict).length;

  // Filtered drones
  const filteredDrones = drones.filter((drone) => {
    const matchesSearch = 
      drone.callsign.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drone.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drone.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (drone.missionDestinationName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (drone.delivery?.destinationAddress || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'all') return true;
    if (filter === 'active') return ['delivering', 'en_route_pickup', 'returning_to_base', 'active'].includes(drone.status);
    if (filter === 'delivering') return drone.status === 'delivering';
    if (filter === 'charging') return drone.status === 'charging';
    if (filter === 'attention') return drone.status === 'attention_required' || drone.vitals.batteryPercentage < 30 || drone.inSimulationConflict;
    return true;
  });

  const getBatteryColor = (percent: number) => {
    if (percent > 55) return 'text-emerald-400 bg-emerald-500';
    if (percent > 30) return 'text-amber-400 bg-amber-500';
    return 'text-rose-400 bg-rose-500';
  };

  const getStatusDot = (drone: Drone, hasConflict?: boolean) => {
    if (hasConflict || drone.airspaceStatus === 'PROHIBITED') return 'bg-rose-500 shadow-[0_0_8px_#ef4444] animate-pulse';
    if (drone.isRerouting || drone.airspaceStatus === 'PERMISSION_REQUIRED') return 'bg-amber-400 shadow-[0_0_8px_#f59e0b]';
    if (['delivering', 'en_route_pickup', 'active'].includes(drone.status)) return 'bg-emerald-400 shadow-[0_0_8px_#10b981]';
    if (drone.status === 'charging') return 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]';
    return 'bg-slate-500';
  };

  const droneBeingDeleted = drones.find((d) => d.id === confirmDeleteId);

  return (
    <div className="h-full flex relative select-none font-sans">
      {/* ─── 1. COMPACT VERTICAL ICON TOOLBAR (WIDTH: ~56px) ─── */}
      <aside className="w-14 h-full bg-[#090d16] border-r border-[#1a2438] flex flex-col items-center py-2.5 justify-between shrink-0 z-30">
        {/* Top: Fleet Expand & Add Button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onToggleExpand && onToggleExpand(!isExpanded)}
            title={isExpanded ? 'Collapse Fleet Panel' : 'Expand Fleet Panel'}
            className="p-2 rounded-lg bg-[#111726] border border-[#212f4c] text-cyan-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-all"
          >
            <Radio className="w-4 h-4 animate-pulse" />
          </button>
          <span className="text-[11px] font-mono text-slate-300 font-bold uppercase tracking-wider">FLEET</span>

          {/* Quick Add Drone Icon Button */}
          {onOpenAddDrone && (
            <button
              onClick={onOpenAddDrone}
              title="Add Drone to Fleet (+)"
              className="p-2 rounded-lg bg-cyan-950/70 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 transition-all shadow-[0_0_10px_rgba(0,240,255,0.2)] mt-1"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Middle: Vertical Drone Selector Stack */}
        <div className="flex flex-col items-center gap-2.5 my-auto w-full px-1.5 overflow-y-auto custom-scrollbar max-h-[60vh]">
          {drones.map((drone, idx) => {
            const isSelected = drone.id === selectedDroneId;
            const hasConflict = obstacleConflicts.some((c) => c.droneId === drone.id);
            const dotClass = getStatusDot(drone, hasConflict);
            const shortId = drone.id.replace('DRONE-', '').replace('AV-', '') || `0${idx + 1}`;

            return (
              <button
                key={drone.id}
                onClick={() => {
                  onSelectDrone(drone.id);
                  if (onToggleExpand && !isExpanded) {
                    onToggleExpand(true);
                  }
                }}
                title={`${drone.callsign} (${drone.model}) - Click to Inspect`}
                className={`relative group w-11 h-12 rounded-lg flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-[#142036] border-2 border-cyan-400 shadow-[0_0_14px_rgba(0,240,255,0.4)] text-cyan-300'
                    : 'bg-[#101524] border border-[#1d2942] hover:bg-[#151c30] text-slate-400 hover:text-white'
                }`}
              >
                {/* Status Dot */}
                <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${dotClass}`} />

                {/* Quadcopter Icon */}
                <QuadcopterIcon size={16} className={`mb-0.5 ${isSelected ? 'text-cyan-300' : 'text-slate-400'}`} />

                {/* Short ID Badge */}
                <span className="text-[10px] font-mono font-bold leading-none tracking-tight">
                  {shortId}
                </span>

                {/* Mini Battery bar under button */}
                <div className="w-8 h-1 bg-slate-800 rounded-full overflow-hidden mt-1 border border-slate-700/60">
                  <div
                    className={`h-full ${drone.vitals.batteryPercentage > 50 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                    style={{ width: `${Math.min(100, drone.vitals.batteryPercentage)}%` }}
                  />
                </div>

                {/* Tooltip on Hover */}
                <div className="absolute left-14 bg-[#0d1322] border border-cyan-500/40 text-white text-[11px] font-mono px-2.5 py-1.5 rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  <div className="font-bold text-cyan-300">{drone.callsign}</div>
                  <div className="text-[10px] text-slate-400">
                    Alt: {Math.round(drone.vitals.altitudeMeters)}m • {Math.round(drone.vitals.batteryPercentage)}% Bat
                  </div>
                  <div className="text-[10px] text-emerald-400">
                    {drone.missionDestinationName || 'Mission Pad'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Expand Toggle Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => onToggleExpand && onToggleExpand(!isExpanded)}
            title={isExpanded ? 'Collapse Panel' : 'Expand Full Aircraft Details'}
            className="p-1.5 rounded bg-[#101524] border border-[#1d2942] text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-all"
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
          <span className="text-[10px] font-mono text-cyan-400 font-bold">{totalCount}</span>
        </div>
      </aside>

      {/* ─── 2. EXPANDABLE FLEET DRAWER (WIDTH: ~340px) ─── */}
      {isExpanded && (
        <aside className="w-80 md:w-92 h-full bg-[#0c101a]/95 backdrop-blur-md border-r border-[#1f2a40] flex flex-col select-none overflow-hidden z-20 shadow-2xl animate-in slide-in-from-left duration-200">
          {/* Top Header */}
          <div className="p-3 border-b border-[#1f2a40] bg-[#101522] shrink-0 font-mono">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <h2 className="text-xs font-bold font-mono tracking-wider text-slate-100 uppercase">
                  FLEET DIRECTORY ({activeCount}/{totalCount})
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                {onOpenAddDrone && (
                  <button
                    onClick={onOpenAddDrone}
                    className="px-2 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow-[0_0_10px_rgba(0,240,255,0.3)] transition-all cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Drone</span>
                  </button>
                )}
                <button
                  onClick={() => onToggleExpand && onToggleExpand(false)}
                  title="Collapse Aircraft Panel"
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* KPI Mini Summary */}
            <div className="grid grid-cols-4 gap-1.5 mb-2.5">
              <div className="bg-[#141b2b] p-1.5 rounded border border-[#212d46] text-center">
                <div className="text-[9px] uppercase text-slate-400">Total</div>
                <div className="text-xs font-bold text-white font-mono">{totalCount}</div>
              </div>
              <div className="bg-[#141b2b] p-1.5 rounded border border-cyan-900/40 text-center">
                <div className="text-[9px] uppercase text-cyan-400">Active</div>
                <div className="text-xs font-bold text-cyan-300 font-mono">{activeCount}</div>
              </div>
              <div className="bg-[#141b2b] p-1.5 rounded border border-amber-900/40 text-center">
                <div className="text-[9px] uppercase text-amber-400">Charge</div>
                <div className="text-xs font-bold text-amber-300 font-mono">{chargingCount}</div>
              </div>
              <div className={`p-1.5 rounded border text-center ${attentionCount > 0 ? 'bg-rose-950/40 border-rose-800' : 'bg-[#141b2b] border-[#212d46]'}`}>
                <div className={`text-[9px] uppercase ${attentionCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>Alert</div>
                <div className={`text-xs font-bold font-mono ${attentionCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>{attentionCount}</div>
              </div>
            </div>

            {/* Search Input (Shown only if fleet not empty) */}
            {drones.length > 0 && (
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search callsign, ID, or corridor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#141b2b] border border-[#243352] rounded pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            )}

            {/* Filter Pills */}
            {drones.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] font-mono scrollbar-none">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'active', label: 'Active' },
                  { id: 'delivering', label: 'Delivering' },
                  { id: 'charging', label: 'Charging' },
                  { id: 'attention', label: 'Alert' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFilter(item.id)}
                    className={`px-2 py-0.5 rounded font-medium whitespace-nowrap transition-colors ${
                      filter === item.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                        : 'text-slate-400 hover:text-slate-200 bg-[#141a29]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ─── EMPTY STATE: ZERO DRONES IN FLEET ─── */}
          {drones.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none font-mono">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_25px_rgba(0,240,255,0.15)] mb-4">
                <QuadcopterIcon size={36} className="animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
                No Drones in Fleet
              </h3>
              <p className="text-xs text-slate-400 max-w-[240px] mb-6 leading-relaxed">
                Your fleet currently has 0 active aircraft. Add a drone to configure departure, destination, and compute autonomous A* navigation corridors.
              </p>
              {onOpenAddDrone && (
                <button
                  onClick={onOpenAddDrone}
                  className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Drone to Fleet</span>
                </button>
              )}
            </div>
          ) : (
            /* Detailed Drone Cards List */
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-2 min-h-0 font-mono">
              {filteredDrones.map((drone) => {
                const isSelected = drone.id === selectedDroneId;
                const activeConflict = obstacleConflicts.find((c) => c.droneId === drone.id);
                const batColor = getBatteryColor(drone.vitals.batteryPercentage);

                return (
                  <div
                    key={drone.id}
                    onClick={() => onSelectDrone(drone.id)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-all border relative group ${
                      isSelected
                        ? 'bg-[#151f33] border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50'
                        : 'bg-[#121724] border-[#1e2a42] hover:bg-[#161d2e] hover:border-slate-700'
                    }`}
                  >
                    {/* Header: Quadcopter Icon, Callsign, Altitude & Remove Action */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded shrink-0 ${isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-300'}`}>
                          <QuadcopterIcon size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold tracking-wider text-white flex items-center gap-1.5">
                            <span>{drone.callsign}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({drone.id})</span>
                          </div>
                          <div className="text-[9px] text-cyan-400/80 truncate max-w-[130px]">
                            {drone.model}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-cyan-300">
                          {Math.round(drone.vitals.altitudeMeters)}m AGL
                        </span>
                        {/* Remove Drone Button */}
                        {onRemoveDrone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(drone.id);
                            }}
                            title={`Remove ${drone.callsign} from Fleet`}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Battery Bar */}
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <div className="flex items-center gap-1.5 text-slate-400 flex-1 mr-2">
                        <span className="text-[10px] shrink-0">Battery</span>
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                          <div
                            className={`h-full ${batColor.split(' ')[1]}`}
                            style={{ width: `${Math.min(100, drone.vitals.batteryPercentage)}%` }}
                          />
                        </div>
                      </div>
                      <span className={`text-[11px] font-bold shrink-0 ${batColor.split(' ')[0]}`}>
                        {Math.round(drone.vitals.batteryPercentage)}%
                      </span>
                    </div>

                    {/* Lat/Lon Readout */}
                    <div className="text-[10px] text-slate-300 mb-1.5 bg-[#0b0f19] px-2 py-0.5 rounded border border-[#1b253b] flex items-center justify-between">
                      <span>Lat: {drone.vitals.latitude.toFixed(5)}°</span>
                      <span>Lon: {drone.vitals.longitude.toFixed(5)}°</span>
                    </div>

                    {/* Route Corridor Info */}
                    <div className="text-[10px] mb-1.5 px-2 py-1 rounded bg-[#0b101c] border border-cyan-900/40">
                      <div className="flex items-center justify-between text-slate-300 mb-0.5">
                        <div className="flex items-center gap-1 truncate">
                          <Navigation className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="font-bold text-cyan-200 truncate" title={drone.missionDestinationName || 'Destination Pad'}>
                            {drone.missionDestinationName || 'Mission Pad'}
                          </span>
                        </div>
                        {drone.distanceRemainingKm !== undefined && (
                          <span className="text-cyan-300 font-bold shrink-0 ml-1">
                            {drone.distanceRemainingKm.toFixed(1)} km
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-cyan-300 pt-0.5 border-t border-[#1b253b]">
                        <span className="truncate" title={drone.nextWaypointName || 'Approaching Corridor'}>
                          Next: {drone.nextWaypointName || 'Approaching Corridor'}
                        </span>
                        <span className="text-cyan-400 font-bold shrink-0 ml-1">
                          WP-{(drone.currentWaypointIndex + 1).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>

                    {/* Operational Status Pill */}
                    <div className="flex items-center justify-between text-[10px] px-2 py-0.5 rounded bg-[#0a0e18] border border-[#182236]">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          drone.status === 'delivering' || drone.status === 'en_route_pickup' || drone.status === 'active' ? 'bg-emerald-400 animate-pulse' :
                          drone.status === 'hovering' ? 'bg-amber-400' :
                          'bg-cyan-400'
                        }`} />
                        <span className="font-bold text-white uppercase text-[9px]">
                          {drone.statusLabel || drone.status}
                        </span>
                      </div>
                      <span className="text-cyan-400 font-bold text-[9px] bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                        A* ROUTE
                      </span>
                    </div>

                    {/* Obstacle warning */}
                    {activeConflict && (
                      <div className="mt-1.5 px-2 py-0.5 rounded bg-rose-950/80 border border-rose-700 text-[10px] font-bold text-rose-300 flex items-center gap-1 animate-pulse">
                        <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                        <span className="truncate">{activeConflict.obstacleName} ({activeConflict.horizontalDistanceMeters}m)</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      )}

      {/* ─── 3. CONFIRM REMOVE DRONE MODAL ─── */}
      {confirmDeleteId && droneBeingDeleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono select-none animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0e1422] border border-[#233350] rounded-xl p-5 shadow-2xl">
            <div className="flex items-center gap-3 mb-3 text-rose-400">
              <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-700/60">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase">Remove Drone from Fleet</h3>
                <p className="text-[11px] text-slate-400">Confirmation Required</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Are you sure you want to remove <strong className="text-cyan-300">{droneBeingDeleted.callsign} ({droneBeingDeleted.id})</strong>?
              This action will abort its flight corridor, remove its map markers, clear telemetry, and delete its assigned mission.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1c2940]">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 rounded-lg bg-[#151c2c] hover:bg-[#1b253b] text-slate-300 text-xs font-bold border border-[#233148] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onRemoveDrone) {
                    onRemoveDrone(droneBeingDeleted.id);
                  }
                  setConfirmDeleteId(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
