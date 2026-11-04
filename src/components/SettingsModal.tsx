import React from 'react';
import { X, Settings, ShieldCheck, Map, Building2 } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  simulationSpeed: number;
  setSimulationSpeed: (speed: number) => void;
  safetyReservePercent: number;
  setSafetyReservePercent: (reserve: number) => void;
  separationDistanceMeters: number;
  setSeparationDistanceMeters: (dist: number) => void;
  obstacleWarningRadiusMeters?: number;
  setObstacleWarningRadiusMeters?: (radius: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  simulationSpeed,
  setSimulationSpeed,
  safetyReservePercent,
  setSafetyReservePercent,
  separationDistanceMeters,
  setSeparationDistanceMeters,
  obstacleWarningRadiusMeters = 40,
  setObstacleWarningRadiusMeters,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm select-none p-4 font-mono">
      <div className="w-full max-w-md bg-[#0e1422] border border-[#2b3c5e] rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-[#131c2e] border-b border-[#223352] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm tracking-wider text-white uppercase">
              COMMAND CENTER CONFIGURATION
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Simulation Rate */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-slate-300 font-bold">
              <span>Simulation Clock Multiplier</span>
              <span className="text-cyan-400 font-bold">{simulationSpeed}X</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setSimulationSpeed(s)}
                  className={`py-1.5 rounded font-bold border transition-colors ${
                    simulationSpeed === s
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                      : 'bg-[#141b2b] text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  {s}X Normal
                </button>
              ))}
            </div>
          </div>

          {/* Safety Reserve Margin */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-slate-300 font-bold">
              <span>Smart RTB Safety Battery Reserve</span>
              <span className="text-emerald-400 font-bold">{safetyReservePercent}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="35"
              value={safetyReservePercent}
              onChange={(e) => setSafetyReservePercent(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>10% (Fast Turnaround)</span>
              <span>20% (Standard DGCA/CASA)</span>
              <span>35% (Conservative)</span>
            </div>
          </div>

          {/* Separation Threshold */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-slate-300 font-bold">
              <span>Airspace Separation Warning Radius</span>
              <span className="text-amber-400 font-bold">{separationDistanceMeters}m</span>
            </div>
            <input
              type="range"
              min="150"
              max="500"
              step="25"
              value={separationDistanceMeters}
              onChange={(e) => setSeparationDistanceMeters(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>150 m</span>
              <span>250 m (UTM Standard)</span>
              <span>500 m</span>
            </div>
          </div>

          {/* 3D Obstacle Buffer Setting */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-slate-300 font-bold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              3D Building & Viaduct Safety Buffer
            </span>
            <span className="px-2.5 py-1 rounded bg-[#141b2b] text-cyan-300 border border-slate-700 font-bold text-xs">
              {obstacleWarningRadiusMeters}m Clearance
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#131c2e] border-t border-[#223352] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded text-xs transition-colors"
          >
            CONFIRM & CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
