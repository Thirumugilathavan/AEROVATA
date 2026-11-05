import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Zap, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Battery
} from 'lucide-react';
import { QuadcopterIcon } from './icons/QuadcopterIcon';

export const AnalyticsView: React.FC = () => {
  return (
    <div className="flex-1 bg-[#090d15] p-6 overflow-y-auto select-none font-mono">
      {/* Top Banner */}
      <div className="pb-6 border-b border-[#1f2b45] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-extrabold text-white tracking-wider">FLEET EFFICIENCY & ENERGY ANALYTICS</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Aerovata Operational Telemetry, Turnaround Metrics, and Battery Performance
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#101626] border border-[#1f2c45] p-4 rounded-lg">
          <div className="text-xs text-slate-400 uppercase font-bold flex items-center justify-between">
            <span>Fleet Utilization</span>
            <QuadcopterIcon className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">83.3%</div>
          <div className="text-[10px] text-emerald-400 mt-1">5 of 6 Airframes Active / In Mission</div>
        </div>

        <div className="bg-[#101626] border border-[#1f2c45] p-4 rounded-lg">
          <div className="text-xs text-slate-400 uppercase font-bold flex items-center justify-between">
            <span>Deliveries Today</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-2">48 Drops</div>
          <div className="text-[10px] text-slate-400 mt-1">98.4% On-Time Delivery Rate</div>
        </div>

        <div className="bg-[#101626] border border-[#1f2c45] p-4 rounded-lg">
          <div className="text-xs text-slate-400 uppercase font-bold flex items-center justify-between">
            <span>Avg Delivery Duration</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-300 mt-2">14.2 min</div>
          <div className="text-[10px] text-slate-400 mt-1">3.4 min Faster than Ground Courier</div>
        </div>

        <div className="bg-[#101626] border border-[#1f2c45] p-4 rounded-lg">
          <div className="text-xs text-slate-400 uppercase font-bold flex items-center justify-between">
            <span>Energy Efficiency</span>
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-purple-300 mt-2">16.8 Wh/km</div>
          <div className="text-[10px] text-emerald-400 mt-1">-8.2% vs Baseline SkyHauler Model</div>
        </div>
      </div>

      {/* Analytics Charts & Details */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Dispatch Throughput */}
        <div className="bg-[#101626] border border-[#1f2c45] p-5 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Hourly Mission Dispatch Volume (Today)
            </h2>
            <span className="text-xs text-slate-500">PEAK: 20:00</span>
          </div>

          {/* Simple Simulated Bar Chart */}
          <div className="h-44 flex items-end justify-between gap-3 pt-6 border-b border-slate-800 pb-2">
            {[
              { hour: '14:00', count: 4, height: '35%' },
              { hour: '15:00', count: 6, height: '50%' },
              { hour: '16:00', count: 5, height: '42%' },
              { hour: '17:00', count: 8, height: '68%' },
              { hour: '18:00', count: 11, height: '90%' },
              { hour: '19:00', count: 9, height: '75%' },
              { hour: '20:00', count: 12, height: '100%' },
            ].map((bar) => (
              <div key={bar.hour} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {bar.count}
                </div>
                <div
                  className="w-full bg-cyan-500/80 hover:bg-cyan-400 rounded-t transition-all group-hover:shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                  style={{ height: bar.height }}
                />
                <span className="text-[10px] text-slate-400">{bar.hour}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400">
            Automated dispatch cadence maintains maximum 12 concurrent BVLOS corridor slots in current airspace sector.
          </p>
        </div>

        {/* Battery Health & Lifecycle */}
        <div className="bg-[#101626] border border-[#1f2c45] p-5 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              LiPo Battery Health & Turnaround Status
            </h2>
            <span className="text-xs text-emerald-400 font-bold">OPTIMAL</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-[#131b2e] p-3 rounded border border-slate-800 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Average Turnaround Time:</span>
                <span className="text-white font-bold">6.8 min (Dock swap & pre-flight)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Rapid DC Charging Bay 1:</span>
                <span className="text-amber-400 font-bold">Active (DRONE 06 at 94%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mean Cell Degradation:</span>
                <span className="text-emerald-400 font-bold">1.2% over 350 cycles</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Thermal Rejection Margin:</span>
                <span className="text-slate-300 font-bold">18°C below warning threshold</span>
              </div>
            </div>

            <div className="p-3 bg-[#0d121f] rounded border border-slate-800 text-slate-400 text-[11px] leading-relaxed">
              * Smart energy modeling dynamically calculates battery return-to-base limits with a 20% certified safety reserve margin under all wind conditions.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
