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
  Navigation
} from 'lucide-react';
import { Drone, DroneStatus, ObstacleConflict } from '../types/fleet';

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
    <aside className="w-full h-full bg-[#0c101a] border-r border-[#1f2a40] flex flex-col select-none overflow-hidden min-w-0">
      {/* Top Header */}
      <div className="p-3.5 border-b border-[#1f2a40] bg-[#101522] shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <h2 className="text-sm font-bold font-mono tracking-wider text-slate-100 uppercase">
              ACTIVE AIRCRAFT ({activeCount})
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400 font-semibold">FLEET: {totalCount} UNITS</span>
        </div>

        {/* Fleet KPI mini counters */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-[#141b2b] p-2 rounded border border-[#212d46] text-center">
            <div className="text-[10px] font-mono uppercase text-slate-400 leading-tight">Total</div>
            <div className="text-sm font-bold text-white font-mono mt-0.5">{totalCount}</div>
          </div>
          <div className="bg-[#141b2b] p-2 rounded border border-cyan-900/40 text-center">
            <div className="text-[10px] font-mono uppercase text-cyan-400 leading-tight">Active</div>
            <div className="text-sm font-bold text-cyan-300 font-mono mt-0.5">{activeCount}</div>
          </div>
          <div className="bg-[#141b2b] p-2 rounded border border-amber-900/40 text-center">
            <div className="text-[10px] font-mono uppercase text-amber-400 leading-tight">Charge</div>
            <div className="text-sm font-bold text-amber-300 font-mono mt-0.5">{chargingCount}</div>
          </div>
          <div className={`p-2 rounded border text-center ${attentionCount > 0 ? 'bg-rose-950/40 border-rose-800/70' : 'bg-[#141b2b] border-[#212d46]'}`}>
            <div className={`text-[10px] font-mono uppercase leading-tight ${attentionCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>Alert</div>
            <div className={`text-sm font-bold font-mono mt-0.5 ${attentionCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>{attentionCount}</div>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-2.5">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search callsign, ID or destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141b2b] border border-[#243352] rounded pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs font-mono scrollbar-none">
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
              className={`px-2.5 py-1 rounded font-medium whitespace-nowrap transition-colors ${
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

      {/* Drone List Cards with Smooth Internal Scroll */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5 min-h-0">
        {filteredDrones.map((drone) => {
          const isSelected = drone.id === selectedDroneId;
          const activeConflict = obstacleConflicts.find((c) => c.droneId === drone.id);
          const statusBadge = getStatusBadge(drone.status, !!activeConflict);
          const batColor = getBatteryColor(drone.vitals.batteryPercentage);

          return (
            <div
              key={drone.id}
              onClick={() => onSelectDrone(drone.id)}
              className={`p-3 rounded-lg cursor-pointer transition-all border ${
                isSelected
                  ? 'bg-[#151f33] border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50'
                  : 'bg-[#121724] border-[#1e2a42] hover:bg-[#161d2e] hover:border-slate-700'
              }`}
            >
              {/* Header: Drone Callsign & Altitude */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded shrink-0 ${isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-300'}`}>
                    <Plane className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold font-mono tracking-wider text-white">
                      {drone.callsign}
                    </span>
                    <span className="text-xs text-slate-400 ml-2 font-mono">({drone.id})</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-bold font-mono text-cyan-300">
                    {Math.round(drone.vitals.altitudeMeters)}m AGL
                  </span>
                </div>
              </div>

              {/* Battery Bar & Percentage */}
              <div className="flex items-center justify-between text-xs mb-2 font-mono">
                <div className="flex items-center gap-2 text-slate-400 flex-1 mr-3">
                  <span className="text-xs shrink-0">Battery</span>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className={`h-full transition-all duration-500 ${batColor.split(' ')[1]}`}
                      style={{ width: `${Math.min(100, drone.vitals.batteryPercentage)}%` }}
                    />
                  </div>
                </div>
                <span className={`text-xs font-bold shrink-0 ${batColor.split(' ')[0]}`}>
                  {Math.round(drone.vitals.batteryPercentage)}%
                </span>
              </div>

              {/* Lat/Lon Coordinates Readout */}
              <div className="text-xs font-mono text-slate-300 mb-1.5 bg-[#0b0f19] px-2.5 py-1 rounded border border-[#1b253b] flex items-center justify-between">
                <span>Lat: {drone.vitals.latitude.toFixed(5)}°</span>
                <span>Lon: {drone.vitals.longitude.toFixed(5)}°</span>
              </div>

              {/* Mission Route & Destination Target */}
              <div className="text-[11px] font-mono mb-2 px-2.5 py-1.5 rounded bg-[#0b101c] border border-cyan-900/40">
                <div className="flex items-center justify-between text-slate-400 mb-0.5">
                  <div className="flex items-center gap-1.5 truncate text-slate-200">
                    <Navigation className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="font-bold text-cyan-200 truncate" title={drone.missionDestinationName || drone.delivery?.destinationAddress || 'Assigned Pad'}>
                      {drone.missionDestinationName || drone.delivery?.destinationAddress || 'Destination Pad'}
                    </span>
                  </div>
                  {drone.distanceRemainingKm !== undefined && (
                    <span className="text-cyan-300 font-bold shrink-0 ml-1">
                      {drone.distanceRemainingKm.toFixed(1)} km
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="truncate" title={drone.missionStartLocation || drone.missionOriginName}>
                    From: {drone.missionStartLocation || drone.missionOriginName || 'Origin Depot'}
                  </span>
                  <span className="text-slate-300 font-mono">
                    {drone.etaSecondsRemaining !== undefined
                      ? `${Math.max(0, Math.ceil(drone.etaSecondsRemaining / 60))}m ETA`
                      : `${drone.vitals.estimatedFlightTimeMinutes}m rem`}
                  </span>
                </div>
              </div>

              {/* Airspace Zone & Proximity indicator */}
              <div className="flex items-center justify-between text-[11px] font-mono mb-2 px-2 py-1 rounded bg-[#0a0e18] border border-[#182236]">
                <div className="flex items-center gap-1.5 truncate">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    drone.airspaceStatus === 'PROHIBITED' ? 'bg-rose-500 animate-ping' :
                    drone.airspaceStatus === 'PERMISSION_REQUIRED' ? 'bg-amber-400 animate-pulse' :
                    'bg-emerald-400'
                  }`} />
                  <span className={`font-bold truncate ${
                    drone.airspaceStatus === 'PROHIBITED' ? 'text-rose-400' :
                    drone.airspaceStatus === 'PERMISSION_REQUIRED' ? 'text-amber-400' :
                    'text-emerald-400'
                  }`}>
                    {drone.isRerouting ? 'A* REROUTED' : 
                     (drone.currentAirspaceZone?.classification === 'YELLOW' && drone.airspaceStatus === 'PERMITTED')
                      ? 'YELLOW (ATC OK)'
                      : (drone.currentAirspaceZone?.classification || 'GREEN') + ' ZONE'}
                  </span>
                </div>
                {drone.distanceToNearestRestrictedZoneMeters !== undefined && drone.distanceToNearestRestrictedZoneMeters < 6000 && (
                  <span className="text-[10px] text-slate-400 shrink-0 ml-1" title={drone.nearestRestrictedZoneName}>
                    {drone.distanceToNearestRestrictedZoneMeters}m to {drone.nearestRestrictedZoneName?.includes('Airport') ? 'Red Zone' : 'Restricted'}
                  </span>
                )}
              </div>

              {/* Obstacle Threat Warning Chip if Conflict Active */}
              {activeConflict && (
                <div className="mb-2 px-2.5 py-1 rounded bg-rose-950/80 border border-rose-700 text-xs font-mono font-bold text-rose-300 flex items-center gap-1.5 animate-pulse">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">{activeConflict.obstacleName} ({activeConflict.horizontalDistanceMeters}m)</span>
                </div>
              )}

              {/* Footer: Status badge, flight time & speed */}
              <div className="flex items-center justify-between pt-1.5 border-t border-[#1a253d] text-xs">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider font-mono ${statusBadge.color}`}>
                  {statusBadge.text}
                </span>

                <div className="flex items-center gap-2 text-slate-400 font-mono">
                  <span title="Ground Speed">{Math.round(drone.vitals.groundSpeedKmh)} km/h</span>
                  <span>•</span>
                  <span title="Est Flight Time">{drone.vitals.estimatedFlightTimeMinutes}m rem</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
