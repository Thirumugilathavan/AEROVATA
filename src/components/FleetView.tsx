import React, { useState } from 'react';
import { 
  Battery, 
  Wrench, 
  Clock, 
  ShieldCheck, 
  Search, 
  Filter, 
  ExternalLink,
  Zap,
  Radio,
  Plus,
  Trash2
} from 'lucide-react';
import { QuadcopterIcon } from './icons/QuadcopterIcon';
import { Drone } from '../types/fleet';

interface FleetViewProps {
  drones: Drone[];
  onSelectDroneAndSwitchToLive: (id: string) => void;
  onOpenAddDrone?: () => void;
  onRemoveDrone?: (id: string) => void;
}

export const FleetView: React.FC<FleetViewProps> = ({
  drones,
  onSelectDroneAndSwitchToLive,
  onOpenAddDrone,
  onRemoveDrone,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = drones.filter(
    (d) =>
      d.callsign.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const droneBeingDeleted = drones.find((d) => d.id === confirmDeleteId);

  return (
    <div className="flex-1 bg-[#090d15] p-6 overflow-y-auto select-none font-mono">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#1f2b45] gap-4">
        <div>
          <div className="flex items-center gap-2">
            <QuadcopterIcon size={22} className="text-cyan-400" />
            <h1 className="text-xl font-extrabold text-white tracking-wider">AIRCRAFT FLEET REGISTRY</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Aerovata by Taspora Commercial BVLOS Multirotor Fleet • {drones.length} Registered Airframe{drones.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Controls: Search & Add Drone */}
        <div className="flex items-center gap-3">
          {drones.length > 0 && (
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter by ID, model, serial..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#121828] border border-[#21304d] rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {onOpenAddDrone && (
            <button
              onClick={onOpenAddDrone}
              className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Drone to Fleet</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {drones.length === 0 ? (
        <div className="mt-12 bg-[#0f1422] border border-[#1f2a40] rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_30px_rgba(0,240,255,0.2)] mb-4">
            <QuadcopterIcon size={36} className="animate-pulse" />
          </div>
          <h2 className="text-base font-bold text-white tracking-wider mb-2">
            NO DRONES IN FLEET
          </h2>
          <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
            Your delivery fleet is currently empty. Add your first autonomous quadcopter to configure departure pads, destination targets, and calculate collision-free A* flight corridors.
          </p>
          {onOpenAddDrone && (
            <button
              onClick={onOpenAddDrone}
              className="px-6 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Drone to Fleet</span>
            </button>
          )}
        </div>
      ) : (
        /* Fleet Table */
        <div className="mt-6 bg-[#0f1422] border border-[#1f2a40] rounded-lg overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#141b2e] border-b border-[#202d47] text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Aircraft Callsign</th>
                <th className="py-3 px-4">Model & Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Battery SoC</th>
                <th className="py-3 px-4">Flight Hours</th>
                <th className="py-3 px-4">Motor Health</th>
                <th className="py-3 px-4">Last Inspection</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b253b] text-slate-300">
              {filtered.map((drone) => (
                <tr key={drone.id} className="hover:bg-[#151c2f] transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 font-bold">
                        <QuadcopterIcon size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs">{drone.callsign}</div>
                        <div className="text-[10px] text-slate-500">{drone.serialNumber}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-200">{drone.model}</div>
                    <div className="text-[10px] text-slate-500">Max Payload: {drone.vitals.maxPayloadKg} kg</div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                      drone.status === 'delivering' ? 'bg-cyan-950 text-cyan-400 border-cyan-800' :
                      drone.status === 'charging' ? 'bg-amber-950 text-amber-400 border-amber-800' :
                      drone.status === 'attention_required' ? 'bg-rose-950 text-rose-400 border-rose-800' :
                      'bg-slate-900 text-slate-400 border-slate-700'
                    }`}>
                      {drone.statusLabel}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white w-8">{Math.round(drone.vitals.batteryPercentage)}%</span>
                      <div className="w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${drone.vitals.batteryPercentage > 50 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${drone.vitals.batteryPercentage}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-slate-300">
                    {drone.flightHours} hrs
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="text-emerald-400 font-bold">{drone.vitals.motorHealthPercent}%</span>
                  </td>

                  <td className="py-3.5 px-4 text-slate-400">
                    {drone.lastMaintenance}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onSelectDroneAndSwitchToLive(drone.id)}
                        className="px-3 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Track Live</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>

                      {onRemoveDrone && (
                        <button
                          onClick={() => setConfirmDeleteId(drone.id)}
                          title={`Remove ${drone.callsign} from Fleet`}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal for Removal */}
      {confirmDeleteId && droneBeingDeleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150">
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
              This will abort its mission, remove its map marker, delete its flight path, and clear all active simulation state.
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
