import React from 'react';
import { 
  FileText, 
  Battery, 
  ArrowRight, 
  CheckCircle2, 
  Radio, 
  Plane
} from 'lucide-react';
import { Drone, FlightLogEntry } from '../types/fleet';

interface BottomOverviewPanelProps {
  drones: Drone[];
  flightLogs: FlightLogEntry[];
  onSelectDrone: (id: string) => void;
}

export const BottomOverviewPanel: React.FC<BottomOverviewPanelProps> = ({
  drones,
  flightLogs,
  onSelectDrone,
}) => {
  return (
    <div className="h-44 bg-[#0a0e17] border-t border-[#1f2a40] grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[#1f2a40] select-none shrink-0 overflow-hidden">
      {/* 1. FLIGHT LOG (Live) */}
      <div className="md:col-span-5 p-3 flex flex-col h-full overflow-hidden bg-[#0c101a]">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-xs font-bold font-mono tracking-wider text-slate-100 uppercase">
              FLIGHT LOG (Live Coimbatore Feed)
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">STREAMING</span>
        </div>

        {/* Scrollable event list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1 font-mono text-xs">
          {flightLogs.slice(0, 10).map((log) => {
            let tagColor = 'text-cyan-400';
            if (log.type === 'critical') tagColor = 'text-rose-400 font-bold';
            else if (log.type === 'warning') tagColor = 'text-amber-400 font-bold';
            else if (log.type === 'success') tagColor = 'text-emerald-400';

            return (
              <div
                key={log.id}
                onClick={() => onSelectDrone(log.droneId)}
                className="flex items-start gap-2 py-0.5 px-2 rounded hover:bg-slate-800/60 cursor-pointer transition-colors leading-tight"
              >
                <span className="text-slate-500 shrink-0 text-xs font-mono">{log.timestamp}</span>
                <span className={`shrink-0 font-bold text-xs ${tagColor}`}>
                  {log.droneCallsign}
                </span>
                <span className="text-slate-300 truncate text-xs">
                  {log.event}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. BATTERY STATUS */}
      <div className="md:col-span-4 p-3 flex flex-col h-full overflow-hidden bg-[#0c101a]">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-1.5 text-slate-100">
            <Battery className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold font-mono tracking-wider uppercase">
              FLEET BATTERY CELLS
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 font-bold">4 UNITS ONLINE</span>
        </div>

        {/* Grid of Battery Gauges */}
        <div className="grid grid-cols-4 gap-2.5 flex-1 items-center">
          {drones.slice(0, 4).map((drone) => {
            const bat = Math.round(drone.vitals.batteryPercentage);
            let barBg = 'bg-emerald-500';
            let textColor = 'text-emerald-400';

            if (bat < 30) {
              barBg = 'bg-rose-500';
              textColor = 'text-rose-400';
            } else if (bat < 55) {
              barBg = 'bg-amber-500';
              textColor = 'text-amber-400';
            }

            return (
              <div
                key={drone.id}
                onClick={() => onSelectDrone(drone.id)}
                className="bg-[#121827] border border-[#1f2c45] p-2.5 rounded-lg flex flex-col justify-between h-full cursor-pointer hover:border-cyan-500 transition-all"
              >
                <div className="text-xs font-mono font-bold text-slate-300 truncate">
                  {drone.callsign}
                </div>

                <div className={`text-xl font-extrabold font-mono ${textColor}`}>
                  {bat}%
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className={`h-full ${barBg}`} style={{ width: `${bat}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. MISSION HANDOFFS */}
      <div className="md:col-span-3 p-3 flex flex-col h-full overflow-hidden bg-[#0c101a]">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-1.5 text-slate-100">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold font-mono tracking-wider uppercase">
              CORRIDOR HANDOFFS
            </span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 font-bold">SYNCHRONIZED</span>
        </div>

        {/* Handoff Pipeline Progression nodes */}
        <div className="flex-1 flex items-center justify-between px-2">
          {/* Node 1: Drone 01 */}
          <div 
            onClick={() => onSelectDrone('AV-01')}
            className="flex flex-col items-center cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-300 text-sm font-mono font-bold group-hover:scale-105 transition-transform shadow-[0_0_10px_rgba(6,182,212,0.4)]">
              ✈
            </div>
            <div className="text-xs font-bold font-mono text-slate-200 mt-1">DRONE 01</div>
            <div className="text-[10px] font-mono text-cyan-400">KMCH Leg</div>
          </div>

          <div className="flex-1 h-0.5 border-b-2 border-dashed border-cyan-500/50 mx-2 relative">
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400 absolute right-0 -top-2" />
          </div>

          {/* Node 2: Drone 02 */}
          <div 
            onClick={() => onSelectDrone('AV-02')}
            className="flex flex-col items-center cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-indigo-950 border border-indigo-400 flex items-center justify-center text-indigo-300 text-sm font-mono font-bold group-hover:scale-105 transition-transform shadow-[0_0_10px_rgba(129,140,248,0.4)]">
              ⟳
            </div>
            <div className="text-xs font-bold font-mono text-slate-200 mt-1">DRONE 02</div>
            <div className="text-[10px] font-mono text-indigo-400">Ganapathy</div>
          </div>

          <div className="flex-1 h-0.5 border-b-2 border-dashed border-slate-600 mx-2 relative">
            <ArrowRight className="w-3.5 h-3.5 text-slate-500 absolute right-0 -top-2" />
          </div>

          {/* Node 3: Drone 03 */}
          <div 
            onClick={() => onSelectDrone('AV-03')}
            className="flex flex-col items-center cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-amber-950/60 border border-amber-500 flex items-center justify-center text-amber-300 text-sm font-mono font-bold group-hover:scale-105 transition-transform shadow-[0_0_10px_rgba(245,158,11,0.4)]">
              🎯
            </div>
            <div className="text-xs font-bold font-mono text-slate-200 mt-1">DRONE 03</div>
            <div className="text-[10px] font-mono text-amber-400">TIDEL Park</div>
          </div>
        </div>
      </div>
    </div>
  );
};
