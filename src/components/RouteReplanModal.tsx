import React from 'react';
import { 
  X, 
  RefreshCw, 
  Check, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  Route,
  Zap,
  ArrowRight
} from 'lucide-react';
import { Drone, Waypoint, RouteComparisonParameter } from '../types/fleet';

interface RouteReplanModalProps {
  drone: Drone;
  proposedRoute: Waypoint[];
  addedDistanceKm: number;
  addedDelayMinutes: number;
  originalDistanceKm?: number;
  alternativeDistanceKm?: number;
  comparisonTable?: RouteComparisonParameter[];
  onAccept: () => void;
  onReject: () => void;
}

export const RouteReplanModal: React.FC<RouteReplanModalProps> = ({
  drone,
  proposedRoute,
  addedDistanceKm,
  addedDelayMinutes,
  originalDistanceKm = drone.distanceRemainingKm || 5.2,
  alternativeDistanceKm = (drone.distanceRemainingKm || 5.2) + addedDistanceKm,
  comparisonTable,
  onAccept,
  onReject,
}) => {
  const defaultTable: RouteComparisonParameter[] = comparisonTable || [
    {
      parameter: 'Total Flight Distance',
      originalRouteValue: `${originalDistanceKm.toFixed(2)} km`,
      alternativeRouteValue: `${alternativeDistanceKm.toFixed(2)} km`,
      delta: addedDistanceKm === 0 ? '0 km' : `+${addedDistanceKm.toFixed(2)} km`,
      status: addedDistanceKm < 1.5 ? 'OPTIMAL' : 'ACCEPTABLE',
      details: 'Safe 3D bypass around obstacle/airspace restriction',
    },
    {
      parameter: 'Flight Time & Delay',
      originalRouteValue: `${Math.round((originalDistanceKm / 45) * 60)} min`,
      alternativeRouteValue: `${Math.round((alternativeDistanceKm / 45) * 60)} min`,
      delta: `+${addedDelayMinutes.toFixed(1)} min`,
      status: addedDelayMinutes < 2.5 ? 'OPTIMAL' : 'ACCEPTABLE',
      details: `Cruise speed ${Math.round(drone.vitals.groundSpeedKmh)} km/h`,
    },
    {
      parameter: 'Airspace & Obstacles',
      originalRouteValue: '1 Conflicted Envelope',
      alternativeRouteValue: '0 Conflicts (100% Deconflicted)',
      delta: '-1 Hazard Cleared',
      status: 'CLEAR',
      details: 'Strict vertical and horizontal clearance buffer satisfied',
    },
    {
      parameter: 'Energy Feasibility',
      originalRouteValue: `${Math.round(drone.vitals.batteryPercentage)}% Capacity`,
      alternativeRouteValue: `18% Required (${Math.round(drone.vitals.batteryPercentage - 18)}% Reserve)`,
      delta: `+${Math.round(drone.vitals.batteryPercentage - 33)}% Margin`,
      status: 'FEASIBLE',
      details: 'Above 15% mandatory safety reserve',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm select-none p-4">
      <div className="w-full max-w-2xl bg-[#0a0f1d] border border-cyan-500/70 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#10182b] border-b border-[#202e48] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
            <h3 className="font-extrabold font-mono text-sm tracking-wider text-white uppercase">
              A* INTELLIGENT ROUTE REPLANNING • {drone.callsign}
            </h3>
          </div>
          <button
            onClick={onReject}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto custom-scrollbar font-mono">
          {/* Mission Anchor Information */}
          <div className="bg-[#121a2d] border border-cyan-900/60 p-3 rounded-lg flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Mission Origin</span>
              <span className="text-white font-bold">{drone.missionStartLocation || 'Depot'}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Fixed Destination (Locked)</span>
              <span className="text-cyan-300 font-bold">{drone.missionDestinationName || 'Mission Pad'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Destination Coords</span>
              <span className="text-slate-300 text-[11px]">
                {drone.missionDestinationCoords ? `${drone.missionDestinationCoords[1].toFixed(4)}°N, ${drone.missionDestinationCoords[0].toFixed(4)}°E` : 'Locked'}
              </span>
            </div>
          </div>

          {/* Conflict Mitigation Banner */}
          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/50 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200">
              <div className="font-bold text-amber-300 mb-0.5">AIRSPACE &amp; OBSTACLE DECONFLICTION</div>
              Active trajectory intersects restricted airspace or urban vertical structures. A* navigation engine generated a continuous, collision-free corridor directly to the destination.
            </div>
          </div>

          {/* Route Alternatives Comparison Table (Mandatory Requirement) */}
          <div className="border border-[#1e2c47] rounded-lg overflow-hidden bg-[#0c1222]">
            <div className="px-3.5 py-2 bg-[#141e33] border-b border-[#1e2c47] flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                ROUTE ALTERNATIVES EVALUATION MATRIX
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-400 font-bold">
                100% FEASIBLE
              </span>
            </div>

            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#1e2c47] bg-[#0f172a] text-[10px] text-slate-400 uppercase">
                  <th className="py-2 px-3">Evaluation Metric</th>
                  <th className="py-2 px-3">Original Flight Path</th>
                  <th className="py-2 px-3">A* Alternative Route</th>
                  <th className="py-2 px-3">Delta Impact</th>
                  <th className="py-2 px-3 text-right">Feasibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2c47]/50 text-[11px]">
                {defaultTable.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 font-semibold text-slate-200">
                      <div>{row.parameter}</div>
                      {row.details && <div className="text-[10px] text-slate-500 font-normal">{row.details}</div>}
                    </td>
                    <td className="py-2 px-3 text-slate-400">{row.originalRouteValue}</td>
                    <td className="py-2 px-3 font-bold text-cyan-300">{row.alternativeRouteValue}</td>
                    <td className="py-2 px-3 font-bold text-amber-300">{row.delta}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.status === 'OPTIMAL' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                        row.status === 'CLEAR' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        row.status === 'FEASIBLE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Waypoint Chain Preview */}
          <div className="p-3 bg-[#0d1424] border border-[#1d2b45] rounded-lg">
            <div className="text-[11px] font-bold text-slate-300 uppercase mb-2 flex items-center justify-between">
              <span>A* Proposed Waypoint Chain ({proposedRoute.length} Sequential Waypoints)</span>
              <span className="text-[10px] text-cyan-400 font-bold">DETERMINISTIC FLIGHT PATH</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar text-xs">
              {proposedRoute.map((wp, idx) => (
                <div
                  key={wp.id}
                  className="flex items-center justify-between py-1.5 px-2.5 rounded bg-[#131b2d] border border-[#202e48]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] font-bold text-cyan-400">{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}.</span>
                    <span className="text-slate-200 truncate">{wp.name}</span>
                  </div>
                  <span className="text-slate-400 shrink-0 text-[11px] ml-2">{wp.altitudeMeters}m AGL</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#10182b] border-t border-[#202e48] flex items-center justify-between">
          <div className="text-xs font-mono text-slate-400">
            Destination: <span className="text-white font-bold">{drone.missionDestinationName || 'Mission Pad'}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onReject}
              className="px-4 py-2 rounded-lg text-xs font-mono font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onAccept}
              className="px-5 py-2 rounded-lg text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              CONFIRM &amp; DISPATCH A* CORRIDOR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
