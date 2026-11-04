import React from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Info, 
  Radio, 
  Check, 
  Radar,
  Building2,
  Navigation,
  ArrowUpRight,
  Clock,
  Compass
} from 'lucide-react';
import { AirspaceAlert, AirspaceConflict, ObstacleConflict } from '../types/fleet';

interface RightSidebarProps {
  alerts: AirspaceAlert[];
  conflicts: AirspaceConflict[];
  obstacleConflicts?: ObstacleConflict[];
  onAcknowledgeAll: () => void;
  onAcknowledgeAlert: (id: string) => void;
  onSelectDrone: (id: string) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  alerts,
  conflicts,
  obstacleConflicts = [],
  onAcknowledgeAll,
  onAcknowledgeAlert,
  onSelectDrone,
}) => {
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length + obstacleConflicts.length;

  return (
    <aside className="w-full h-full bg-[#0c101a] border-l border-[#1f2a40] flex flex-col select-none overflow-hidden min-w-0">
      {/* ─── 1. OPERATIONAL ALERTS HEADER ─── */}
      <div className="p-3.5 border-b border-[#1f2a40] bg-[#101522] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
          <h2 className="text-sm font-bold font-mono tracking-wider text-slate-100 uppercase">
            OPERATIONAL ALERTS ({unacknowledgedCount})
          </h2>
        </div>

        {unacknowledgedCount > 0 && (
          <button 
            onClick={onAcknowledgeAll}
            className="px-2.5 py-1 rounded text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 hover:bg-cyan-900/60 hover:text-cyan-300 transition-colors"
          >
            Acknowledge All
          </button>
        )}
      </div>

      {/* ─── 2. ACTIVE ALERTS & 3D OBSTACLE HAZARDS LIST (INDEPENDENT SCROLL) ─── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 min-h-0">
        {/* Active 3D Obstacle Conflicts (Top Priority) */}
        {obstacleConflicts.map((obs) => (
          <div
            key={obs.id}
            onClick={() => onSelectDrone(obs.droneId)}
            className="p-3 rounded-lg border border-rose-500 bg-rose-950/40 cursor-pointer hover:border-rose-400 transition-all shadow-[0_0_15px_rgba(239,68,68,0.25)] ring-1 ring-rose-500/40"
          >
            {/* Header: Severity & Target Callsign */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-900/80 text-rose-200 border border-rose-600">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-300" />
                {obs.severity === 'critical' ? 'CRITICAL COLLISION RISK' : 'OBSTACLE PROXIMITY'}
              </span>

              <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                {obs.droneCallsign}
              </span>
            </div>

            {/* Structure Name (Full multi-line title, never truncated) */}
            <div className="text-sm font-bold text-white leading-snug break-words mb-1.5">
              {obs.obstacleName}
            </div>

            {/* Clearance & Proximity Metrics (Prominent 18-20px values) */}
            <div className="grid grid-cols-2 gap-2 my-2 p-2 rounded bg-black/40 border border-rose-900/50 font-mono">
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Horizontal Dist</div>
                <div className="text-base font-bold text-white">
                  {obs.horizontalDistanceMeters}m
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Vertical Clearance</div>
                <div className={`text-base font-bold ${obs.verticalClearanceMeters < 15 ? 'text-rose-400' : 'text-amber-400'}`}>
                  {obs.verticalClearanceMeters > 0 ? `+${obs.verticalClearanceMeters}m` : `${obs.verticalClearanceMeters}m`}
                </div>
              </div>
            </div>

            {/* Action Guidance */}
            <div className="text-xs text-rose-200 leading-relaxed font-sans bg-rose-900/30 p-2 rounded border border-rose-700/50 mb-2">
              <span className="font-semibold text-rose-300 font-mono uppercase text-[11px] block mb-0.5">Recommended Action:</span>
              {obs.suggestedAction}
            </div>

            {/* Footer Metadata */}
            <div className="flex items-center justify-between pt-1 border-t border-rose-900/40 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {obs.timestamp}
              </span>
              <span className="text-rose-300 text-[10px] uppercase font-bold">
                EST. IMPACT: {obs.estimatedTimeToImpactSec}s
              </span>
            </div>
          </div>
        ))}

        {/* Airspace Operational Alerts */}
        {alerts.map((alert) => {
          let icon = <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />;
          let borderStyle = 'border-blue-900/70 bg-[#0e172a]';
          let badgeColor = 'bg-blue-950/80 text-blue-300 border-blue-800';

          if (alert.severity === 'critical') {
            icon = <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />;
            borderStyle = 'border-rose-900/70 bg-[#1f1015]';
            badgeColor = 'bg-rose-950/80 text-rose-300 border-rose-800';
          } else if (alert.severity === 'warning') {
            icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
            borderStyle = 'border-amber-900/70 bg-[#1c180e]';
            badgeColor = 'bg-amber-950/80 text-amber-300 border-amber-800';
          }

          return (
            <div
              key={alert.id}
              onClick={() => alert.droneId && onSelectDrone(alert.droneId)}
              className={`p-3 rounded-lg border ${borderStyle} transition-all cursor-pointer hover:border-slate-500 ${
                alert.acknowledged ? 'opacity-60 bg-slate-900/30 border-slate-800' : 'shadow-md'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {icon}
                <div className="flex-1 min-w-0">
                  {/* Top Bar: Severity Badge + Drone ID + Timestamp */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${badgeColor}`}>
                      {alert.severity}
                    </span>

                    <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {alert.timestamp}
                    </span>
                  </div>

                  {/* Full Alert Title (Never truncated, wraps naturally) */}
                  <div className="text-sm font-semibold text-slate-100 leading-snug break-words mb-1">
                    {alert.title}
                  </div>

                  {/* Alert Description (Comfortable 13px font size and line height) */}
                  <p className="text-[13px] text-slate-300 leading-relaxed font-sans mb-2 break-words">
                    {alert.description}
                  </p>

                  {/* Bottom: Target Drone Chip & Acknowledge Action */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    {alert.droneId ? (
                      <span className="text-xs font-mono text-cyan-400 font-semibold">
                        TARGET: {alert.droneId}
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-slate-500">
                        AIRSPACE WIDE
                      </span>
                    )}

                    {!alert.acknowledged && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAcknowledgeAlert(alert.id);
                        }}
                        className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 text-slate-200 border border-slate-700 hover:border-cyan-700 transition-colors flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 text-cyan-400" />
                        <span>ACKNOWLEDGE</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {alerts.length === 0 && obstacleConflicts.length === 0 && (
          <div className="p-6 text-center text-slate-400 text-sm font-mono bg-[#101522] rounded-lg border border-[#1f2a40]">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <div>All airspace corridors clear.</div>
            <div className="text-xs text-slate-500 mt-1">Zero active conflicts detected across Coimbatore UTM sectors.</div>
          </div>
        )}
      </div>

      {/* ─── 3. AIRSPACE SEPARATION RADAR MONITOR ─── */}
      <div className="p-3 bg-[#0e1320] border-t border-[#1f2a40] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
            <Radar className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>Airspace Separation Radar</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 font-bold">
            AUTO-SCAN ACTIVE
          </span>
        </div>

        {conflicts.length > 0 ? (
          <div className="bg-rose-950/40 border border-rose-600/70 p-2.5 rounded text-xs font-mono text-rose-200">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>SEPARATION VIOLATION</span>
            </div>
            {conflicts.map((c) => (
              <div key={c.id} className="mt-1 text-[11px] text-slate-300">
                Between <span className="text-white font-bold">{c.droneAId}</span> &amp; <span className="text-white font-bold">{c.droneBId}</span>: <span className="text-rose-400 font-bold">{Math.round(c.distanceMeters)}m</span> (Min: {c.minSeparationMeters || 250}m)
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#121828] border border-[#1f2a40] p-2.5 rounded text-xs font-mono text-slate-300 flex items-center justify-between">
            <span className="text-slate-400">Drone-to-Drone Separation:</span>
            <span className="text-emerald-400 font-bold">&gt; 250m Normal</span>
          </div>
        )}
      </div>

      {/* ─── 4. COIMBATORE SECTOR MISSION TRACKERS ─── */}
      <div className="p-3 bg-[#0c101a] border-t border-[#1f2a40] shrink-0">
        <div className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-cyan-400" />
          <span>Active Mission Tracking</span>
        </div>

        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex items-center justify-between p-1.5 rounded bg-[#101626] border border-[#1b263d]">
            <span className="text-slate-300">DRONE 01 (Blood Bank)</span>
            <span className="text-cyan-400 font-bold">KMCH Trauma Helipad</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-[#101626] border border-[#1b263d]">
            <span className="text-slate-300">DRONE 02 (Patho Lab)</span>
            <span className="text-indigo-400 font-bold">Ganapathy Clinic</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-[#101626] border border-[#1b263d]">
            <span className="text-slate-300">DRONE 03 (Tech Cargo)</span>
            <span className="text-amber-400 font-bold">TIDEL Park IT SEZ</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-[#101626] border border-[#1b263d]">
            <span className="text-slate-300">DRONE 04 (UTM Patrol)</span>
            <span className="text-emerald-400 font-bold">Singanallur Corridor</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
