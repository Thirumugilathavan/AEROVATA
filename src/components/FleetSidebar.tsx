import React from 'react';
import { 
  Plane, 
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
  Crosshair
} from 'lucide-react';
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
}) => {
  // Counters
  const totalCount = drones.length;
  const activeCount = drones.filter((d) => ['delivering', 'en_route_pickup', 'returning_to_base'].includes(d.status)).length;
  const chargingCount = drones.filter((d) => d.status === 'charging').length;
  const attentionCount = drones.filter((d) => d.status === 'attention_required' || d.vitals.batteryPercentage < 30 || d.inSimulationConflict).length;

  // Filtered drones
  const filteredDrones = drones.filter((drone) => {
    const matchesSearch = 
      drone.callsign.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drone.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drone.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (drone.delivery?.destinationAddress || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'all') return true;
    if (filter === 'active') return ['delivering', 'en_route_pickup', 'returning_to_base'].includes(drone.status);
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

  const getStatusBadge = (status: DroneStatus, inConflict?: boolean) => {
    if (inConflict) {
      return { text: 'Obstacle Warning', color: 'bg-rose-950/80 text-rose-300 border-rose-800' };
    }
    switch (status) {
      case 'delivering':
        return { text: 'Delivering', color: 'bg-cyan-950/80 text-cyan-300 border-cyan-800' };
      case 'en_route_pickup':
        return { text: 'En Route', color: 'bg-blue-950/80 text-blue-300 border-blue-800' };
      case 'returning_to_base':
        return { text: 'Returning', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800' };
      case 'charging':
        return { text: 'Charging', color: 'bg-amber-950/80 text-amber-300 border-amber-800' };
      case 'attention_required':
        return { text: 'Attention', color: 'bg-rose-950/80 text-rose-300 border-rose-800' };
      default:
        return { text: 'Standby', color: 'bg-slate-900 text-slate-400 border-slate-700' };
    }
  };

  return (
    <div className="h-full flex relative select-none">
      {/* ─── 1. COMPACT VERTICAL ICON TOOLBAR (WIDTH: ~56px) ─── */}
      <aside className="w-14 h-full bg-[#090d16] border-r border-[#1a2438] flex flex-col items-center py-2.5 justify-between shrink-0 z-30">
        {/* Top Radio Icon */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => onToggleExpand && onToggleExpand(!isExpanded)}
            title={isExpanded ? 'Collapse Fleet Panel' : 'Expand Fleet Panel'}
            className="p-2 rounded-lg bg-[#111726] border border-[#212f4c] text-cyan-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-all"
          >
            <Radio className="w-4 h-4 animate-pulse" />
          </button>
          <span className="text-[9px] font-mono text-slate-500 font-bold uppercase mt-0.5">FLEET</span>
        </div>

        {/* Vertical Drone Selector Stack */}
        <div className="flex flex-col items-center gap-2.5 my-auto w-full px-1.5">
          {drones.map((drone, idx) => {
            const isSelected = drone.id === selectedDroneId;
            const hasConflict = obstacleConflicts.some((c) => c.droneId === drone.id);
            const dotClass = getStatusDot(drone, hasConflict);
            const callsignShort = drone.id.replace('AV-', '') || `0${idx + 1}`;

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

                {/* Drone Icon */}
                <Plane className={`w-4 h-4 mb-0.5 ${isSelected ? 'text-cyan-300' : 'text-slate-400'}`} />

                {/* Short ID Badge */}
                <span className="text-[10px] font-mono font-bold leading-none tracking-tight">
                  {callsignShort}
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

      {/* ─── 2. EXPANDABLE AIRCRAFT DRAWER (WIDTH: ~340px) ─── */}
      {isExpanded && (
        <aside className="w-80 md:w-88 h-full bg-[#0c101a]/95 backdrop-blur-md border-r border-[#1f2a40] flex flex-col select-none overflow-hidden z-20 shadow-2xl animate-in slide-in-from-left duration-200">
          {/* Top Header */}
          <div className="p-3 border-b border-[#1f2a40] bg-[#101522] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <h2 className="text-xs font-bold font-mono tracking-wider text-slate-100 uppercase">
                  FLEET DIRECTORY ({activeCount}/{totalCount})
                </h2>
              </div>
              <button
                onClick={() => onToggleExpand && onToggleExpand(false)}
                title="Collapse Aircraft Panel"
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* KPI Mini Summary */}
            <div className="grid grid-cols-4 gap-1.5 mb-2.5">
              <div className="bg-[#141b2b] p-1.5 rounded border border-[#212d46] text-center">
                <div className="text-[9px] font-mono uppercase text-slate-400">Total</div>
                <div className="text-xs font-bold text-white font-mono">{totalCount}</div>
              </div>
              <div className="bg-[#141b2b] p-1.5 rounded border border-cyan-900/40 text-center">
                <div className="text-[9px] font-mono uppercase text-cyan-400">Active</div>
                <div className="text-xs font-bold text-cyan-300 font-mono">{activeCount}</div>
              </div>
              <div className="bg-[#141b2b] p-1.5 rounded border border-amber-900/40 text-center">
                <div className="text-[9px] font-mono uppercase text-amber-400">Charge</div>
                <div className="text-xs font-bold text-amber-300 font-mono">{chargingCount}</div>
              </div>
              <div className={`p-1.5 rounded border text-center ${attentionCount > 0 ? 'bg-rose-950/40 border-rose-800' : 'bg-[#141b2b] border-[#212d46]'}`}>
                <div className={`text-[9px] font-mono uppercase ${attentionCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>Alert</div>
                <div className={`text-xs font-bold font-mono ${attentionCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>{attentionCount}</div>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search callsign, ID or destination..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#141b2b] border border-[#243352] rounded pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {/* Filter Pills */}
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
          </div>

          {/* Detailed Drone Cards List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-2 min-h-0">
            {filteredDrones.map((drone) => {
              const isSelected = drone.id === selectedDroneId;
              const activeConflict = obstacleConflicts.find((c) => c.droneId === drone.id);
              const batColor = getBatteryColor(drone.vitals.batteryPercentage);

              return (
                <div
                  key={drone.id}
                  onClick={() => onSelectDrone(drone.id)}
                  className={`p-2.5 rounded-lg cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-[#151f33] border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50'
                      : 'bg-[#121724] border-[#1e2a42] hover:bg-[#161d2e] hover:border-slate-700'
                  }`}
                >
                  {/* Header: Callsign & Altitude */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded shrink-0 ${isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-300'}`}>
                        <Plane className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold font-mono tracking-wider text-white">
                          {drone.callsign}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({drone.id})</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold font-mono text-cyan-300">
                        {Math.round(drone.vitals.altitudeMeters)}m AGL
                      </span>
                    </div>
                  </div>

                  {/* Battery Bar */}
                  <div className="flex items-center justify-between text-[11px] mb-1.5 font-mono">
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
                  <div className="text-[10px] font-mono text-slate-300 mb-1.5 bg-[#0b0f19] px-2 py-0.5 rounded border border-[#1b253b] flex items-center justify-between">
                    <span>Lat: {drone.vitals.latitude.toFixed(5)}°</span>
                    <span>Lon: {drone.vitals.longitude.toFixed(5)}°</span>
                  </div>

                  {/* Mission Target & Next WP */}
                  <div className="text-[10px] font-mono mb-1.5 px-2 py-1.5 rounded bg-[#0b101c] border border-cyan-900/40">
                    <div className="flex items-center justify-between text-slate-300 mb-1">
                      <div className="flex items-center gap-1 truncate">
                        <Navigation className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="font-bold text-cyan-200 truncate" title={drone.missionDestinationName || 'Destination Pad'}>
                          {drone.missionDestinationName || 'CMCH Helipad'}
                        </span>
                      </div>
                      {drone.distanceRemainingKm !== undefined && (
                        <span className="text-slate-300 font-bold shrink-0 ml-1 text-[9px]">
                          Tot: {drone.distanceRemainingKm.toFixed(1)} km
                        </span>
                      )}
                    </div>

                    {/* Next Waypoint Name & Target Index */}
                    <div className="flex items-center justify-between text-cyan-300 pt-1 border-t border-[#1b253b]">
                      <span className="truncate max-w-[130px]" title={drone.nextWaypointName || 'Approaching Corridor'}>
                        Next: {drone.nextWaypointName || 'Approaching Corridor'}
                      </span>
                      <span className="text-cyan-400 font-bold shrink-0 ml-1">
                        WP-{(drone.targetWaypointIndex !== undefined ? drone.targetWaypointIndex + 1 : (drone.currentWaypointIndex === 0 && drone.route && drone.route.length > 1 ? 2 : drone.currentWaypointIndex + 1)).toString().padStart(2, '0')}
                      </span>
                    </div>

                    {/* Distance to Next WP Countdown & Status Badge */}
                    <div className="flex items-center justify-between pt-1 mt-0.5 text-[9px]">
                      <span className="text-slate-400">Target Dist:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-white font-bold font-mono">
                          {formatWaypointDistance(drone.distanceToNextWaypointMeters)}
                        </span>
                        {(() => {
                          const badge = getWaypointStatusBadge(drone.nextWaypointStatus);
                          return (
                            <span className={`px-1 py-0.2 rounded text-[8px] font-extrabold border ${badge.badgeClass}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Airspace status pill */}
                  <div className="flex items-center justify-between text-[10px] font-mono px-2 py-0.5 rounded bg-[#0a0e18] border border-[#182236]">
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        drone.airspaceStatus === 'PROHIBITED' ? 'bg-rose-500 animate-ping' :
                        drone.airspaceStatus === 'PERMISSION_REQUIRED' ? 'bg-amber-400' :
                        'bg-emerald-400'
                      }`} />
                      <span className={`font-bold ${
                        drone.airspaceStatus === 'PROHIBITED' ? 'text-rose-400' :
                        drone.airspaceStatus === 'PERMISSION_REQUIRED' ? 'text-amber-400' :
                        'text-emerald-400'
                      }`}>
                        {drone.isRerouting ? 'A* REROUTED' : (drone.currentAirspaceZone?.classification || 'GREEN') + ' ZONE'}
                      </span>
                    </div>
                    <span className="text-slate-400">
                      {Math.round(drone.vitals.groundSpeedKmh)} km/h
                    </span>
                  </div>

                  {/* Obstacle warning */}
                  {activeConflict && (
                    <div className="mt-1.5 px-2 py-0.5 rounded bg-rose-950/80 border border-rose-700 text-[10px] font-mono font-bold text-rose-300 flex items-center gap-1 animate-pulse">
                      <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                      <span className="truncate">{activeConflict.obstacleName} ({activeConflict.horizontalDistanceMeters}m)</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      )}
    </div>
  );
};
