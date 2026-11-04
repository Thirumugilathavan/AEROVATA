import React, { useState } from 'react';
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
  Compass,
  X,
  Shield,
  Layers,
  Activity,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Server
} from 'lucide-react';
import { AirspaceAlert, AirspaceConflict, ObstacleConflict, OfficialAirspaceZone } from '../types/fleet';

interface RightSidebarProps {
  alerts: AirspaceAlert[];
  conflicts: AirspaceConflict[];
  obstacleConflicts?: ObstacleConflict[];
  onAcknowledgeAll: () => void;
  onAcknowledgeAlert: (id: string) => void;
  onSelectDrone: (id: string) => void;
  officialAirspaceZones?: OfficialAirspaceZone[];
  isExpanded?: boolean;
  onToggleExpand?: (expanded: boolean) => void;
  activeTab?: 'alerts' | 'airspace' | 'radar' | 'missions' | 'system';
  onChangeTab?: (tab: 'alerts' | 'airspace' | 'radar' | 'missions' | 'system') => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  alerts,
  conflicts,
  obstacleConflicts = [],
  onAcknowledgeAll,
  onAcknowledgeAlert,
  onSelectDrone,
  officialAirspaceZones = [],
  isExpanded = false,
  onToggleExpand,
  activeTab: controlledTab,
  onChangeTab,
}) => {
  const [internalTab, setInternalTab] = useState<'alerts' | 'airspace' | 'radar' | 'missions' | 'system'>('alerts');
  const currentTab = controlledTab || internalTab;

  const handleTabClick = (tab: 'alerts' | 'airspace' | 'radar' | 'missions' | 'system') => {
    if (onChangeTab) onChangeTab(tab);
    else setInternalTab(tab);

    if (onToggleExpand) {
      if (!isExpanded) {
        onToggleExpand(true);
      } else if (currentTab === tab) {
        onToggleExpand(false);
      }
    }
  };

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length + obstacleConflicts.length;

  return (
    <div className="h-full flex relative select-none">
      {/* ─── 1. EXPANDABLE RIGHT DRAWER (WIDTH: ~340px) ─── */}
      {isExpanded && (
        <aside className="w-80 md:w-88 h-full bg-[#0c101a]/95 backdrop-blur-md border-l border-[#1f2a40] flex flex-col select-none overflow-hidden z-20 shadow-2xl animate-in slide-in-from-right duration-200">
          {/* Drawer Top Header */}
          <div className="p-3 border-b border-[#1f2a40] bg-[#101522] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {currentTab === 'alerts' && <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />}
              {currentTab === 'airspace' && <Shield className="w-4 h-4 text-cyan-400" />}
              {currentTab === 'radar' && <Radar className="w-4 h-4 text-cyan-400 animate-spin" />}
              {currentTab === 'missions' && <Navigation className="w-4 h-4 text-cyan-400" />}
              {currentTab === 'system' && <Activity className="w-4 h-4 text-emerald-400" />}
              
              <h2 className="text-xs font-bold font-mono tracking-wider text-slate-100 uppercase">
                {currentTab === 'alerts' && `OPERATIONAL ALERTS (${unacknowledgedCount})`}
                {currentTab === 'airspace' && 'DGCA AIRSPACE ZONES'}
                {currentTab === 'radar' && 'AIRSPACE SEPARATION RADAR'}
                {currentTab === 'missions' && 'MISSION CORRIDOR TRACKING'}
                {currentTab === 'system' && 'SYSTEM & SITL STATUS'}
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              {currentTab === 'alerts' && unacknowledgedCount > 0 && (
                <button 
                  onClick={onAcknowledgeAll}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 hover:bg-cyan-900/60 transition-colors"
                >
                  Ack All
                </button>
              )}
              <button
                onClick={() => onToggleExpand && onToggleExpand(false)}
                title="Collapse Panel"
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drawer Body by Tab */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 min-h-0">
            {/* TAB 1: OPERATIONAL ALERTS & OBSTACLE HAZARDS */}
            {currentTab === 'alerts' && (
              <>
                {/* 3D Obstacle Conflicts */}
                {obstacleConflicts.map((obs) => (
                  <div
                    key={obs.id}
                    onClick={() => onSelectDrone(obs.droneId)}
                    className="p-2.5 rounded-lg border border-rose-500 bg-rose-950/40 cursor-pointer hover:border-rose-400 transition-all shadow-[0_0_12px_rgba(239,68,68,0.25)] ring-1 ring-rose-500/40"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-rose-900/80 text-rose-200 border border-rose-600">
                        <ShieldAlert className="w-3 h-3 text-rose-300" />
                        {obs.severity === 'critical' ? 'CRITICAL COLLISION' : 'PROXIMITY'}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800">
                        {obs.droneCallsign}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-white leading-snug mb-1">
                      {obs.obstacleName}
                    </div>

                    <div className="text-[11px] text-slate-300 mb-1.5">
                      Horizontal: <span className="font-bold text-rose-400">{obs.horizontalDistanceMeters}m</span> | Clearance: <span className="font-bold text-amber-300">{obs.verticalClearanceMeters}m</span>
                    </div>

                    <div className="text-[10px] text-cyan-300 font-mono bg-[#0b101c] p-1.5 rounded border border-cyan-900/40">
                      Action: {obs.suggestedAction}
                    </div>
                  </div>
                ))}

                {/* Alerts List */}
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-2.5 rounded-lg border transition-all ${
                      alert.acknowledged
                        ? 'bg-[#101524]/60 border-slate-800 opacity-60'
                        : alert.severity === 'critical'
                        ? 'bg-rose-950/30 border-rose-700/80'
                        : alert.severity === 'warning'
                        ? 'bg-amber-950/30 border-amber-700/80'
                        : 'bg-cyan-950/30 border-cyan-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                        alert.severity === 'critical' ? 'bg-rose-900 text-rose-200' :
                        alert.severity === 'warning' ? 'bg-amber-900 text-amber-200' :
                        'bg-cyan-900 text-cyan-200'
                      }`}>
                        {alert.severity}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{alert.timestamp}</span>
                    </div>

                    <div className="text-xs font-bold text-white mb-1">{alert.title}</div>
                    <p className="text-[11px] text-slate-300 leading-relaxed mb-2">{alert.description}</p>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                      <span className="text-[10px] font-mono text-cyan-400">
                        {alert.droneId ? `TARGET: ${alert.droneId}` : 'AIRSPACE WIDE'}
                      </span>

                      {!alert.acknowledged && (
                        <button
                          onClick={() => onAcknowledgeAlert(alert.id)}
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3 h-3 text-cyan-400" />
                          <span>ACK</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {alerts.length === 0 && obstacleConflicts.length === 0 && (
                  <div className="p-5 text-center text-slate-400 text-xs font-mono bg-[#101522] rounded-lg border border-[#1f2a40]">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                    <div>All airspace corridors clear.</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Zero active conflicts detected across Coimbatore UTM sectors.</div>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: DGCA AIRSPACE ZONES */}
            {currentTab === 'airspace' && (
              <div className="space-y-2">
                <div className="text-[11px] font-mono text-slate-400 mb-2 p-2 bg-[#101626] rounded border border-[#1f2c45]">
                  Official DGCA Digital Sky Airspace rules for Coimbatore UTM Sector.
                </div>

                {officialAirspaceZones.map((zone) => (
                  <div
                    key={zone.id}
                    className="p-2.5 rounded-lg bg-[#111728] border border-[#202e48] text-xs font-mono"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          zone.classification === 'RED' ? 'bg-rose-500 shadow-[0_0_8px_#ef4444]' :
                          zone.classification === 'YELLOW' ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' :
                          'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                        }`} />
                        <span className="font-bold text-white">{zone.name}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        zone.classification === 'RED' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        zone.classification === 'YELLOW' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {zone.classification} ZONE
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300 mb-1">
                      Alt Limits: <span className="text-cyan-300 font-bold">{zone.lowerAltitudeLimitMeters}m – {zone.upperAltitudeLimitMeters}m {zone.altitudeReference}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Authority: {zone.permissionAuthority || 'DGCA / Central Govt'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: AIRSPACE SEPARATION RADAR */}
            {currentTab === 'radar' && (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between p-2 bg-[#111728] rounded border border-[#1f2c45]">
                  <span className="text-slate-400">Auto-Scan Separation Radar:</span>
                  <span className="text-emerald-400 font-bold text-[10px] bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                    ACTIVE
                  </span>
                </div>

                {conflicts.length > 0 ? (
                  <div className="bg-rose-950/40 border border-rose-600/70 p-2.5 rounded text-rose-200">
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <span>SEPARATION VIOLATION</span>
                    </div>
                    {conflicts.map((c) => (
                      <div key={c.id} className="mt-1 text-[11px] text-slate-300">
                        Between <span className="text-white font-bold">{c.droneAId}</span> &amp; <span className="text-white font-bold">{c.droneBId}</span>: <span className="text-rose-400 font-bold">{Math.round(c.distanceMeters)}m</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#121828] border border-[#1f2a40] p-3 rounded text-slate-300 text-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                    <div>All Drones &gt; 250m Separation</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Airspace buffer standards maintained.</div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: MISSION TRACKING */}
            {currentTab === 'missions' && (
              <div className="space-y-2 font-mono text-xs">
                <div className="p-2 rounded bg-[#101626] border border-[#1b263d] flex items-center justify-between">
                  <span className="text-slate-300">DRONE 01 (Blood Bank)</span>
                  <span className="text-cyan-400 font-bold">KMCH Trauma Helipad</span>
                </div>
                <div className="p-2 rounded bg-[#101626] border border-[#1b263d] flex items-center justify-between">
                  <span className="text-slate-300">DRONE 02 (Patho Lab)</span>
                  <span className="text-indigo-400 font-bold">Ganapathy Clinic</span>
                </div>
                <div className="p-2 rounded bg-[#101626] border border-[#1b263d] flex items-center justify-between">
                  <span className="text-slate-300">DRONE 03 (Tech Cargo)</span>
                  <span className="text-amber-400 font-bold">TIDEL Park IT SEZ</span>
                </div>
                <div className="p-2 rounded bg-[#101626] border border-[#1b263d] flex items-center justify-between">
                  <span className="text-slate-300">DRONE 04 (UTM Patrol)</span>
                  <span className="text-emerald-400 font-bold">Singanallur Corridor</span>
                </div>
              </div>
            )}

            {/* TAB 5: SYSTEM & SITL STATUS */}
            {currentTab === 'system' && (
              <div className="space-y-2.5 font-mono text-xs">
                <div className="p-2.5 rounded bg-[#101626] border border-[#1b263d]">
                  <div className="text-slate-400 text-[10px] uppercase">MAVLink UDP Gateway</div>
                  <div className="text-cyan-300 font-bold text-sm mt-0.5">udpin:0.0.0.0:14550</div>
                  <div className="text-[10px] text-emerald-400 mt-1">Status: LISTENING</div>
                </div>

                <div className="p-2.5 rounded bg-[#101626] border border-[#1b263d]">
                  <div className="text-slate-400 text-[10px] uppercase">Unified FastAPI Backend</div>
                  <div className="text-cyan-300 font-bold text-sm mt-0.5">http://localhost:8000</div>
                  <div className="text-[10px] text-emerald-400 mt-1">REST API: CONNECTED</div>
                </div>

                <div className="p-2.5 rounded bg-[#101626] border border-[#1b263d]">
                  <div className="text-slate-400 text-[10px] uppercase">Simulation Engine</div>
                  <div className="text-white font-bold text-sm mt-0.5">A* 3D Deconfliction + Telemetry</div>
                  <div className="text-[10px] text-cyan-300 mt-1">Deterministic Pathfinding Active</div>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ─── 2. COMPACT VERTICAL ICON TOOLBAR (WIDTH: ~56px) ─── */}
      <aside className="w-14 h-full bg-[#090d16] border-l border-[#1a2438] flex flex-col items-center py-2.5 justify-between shrink-0 z-30">
        {/* Top Operational Alerts Button */}
        <div className="flex flex-col items-center gap-1 w-full px-1.5">
          <button
            onClick={() => handleTabClick('alerts')}
            title={`Operational Alerts (${unacknowledgedCount})`}
            className={`relative group w-11 h-11 rounded-lg flex items-center justify-center transition-all ${
              isExpanded && currentTab === 'alerts'
                ? 'bg-[#181d2c] border-2 border-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.4)] text-rose-300'
                : 'bg-[#101524] border border-[#1d2942] hover:bg-[#151c30] text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className={`w-5 h-5 ${unacknowledgedCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
            
            {/* Notification Badge */}
            {unacknowledgedCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-mono font-extrabold w-4 h-4 rounded-full flex items-center justify-center border border-[#090d16] shadow">
                {unacknowledgedCount}
              </span>
            )}
          </button>
          <span className="text-[9px] font-mono text-slate-500 font-bold uppercase">ALERTS</span>
        </div>

        {/* Middle Tool Selector Stack */}
        <div className="flex flex-col items-center gap-2.5 my-auto w-full px-1.5">
          {/* Airspace Zones Button */}
          <button
            onClick={() => handleTabClick('airspace')}
            title="DGCA Airspace Zones Inspector"
            className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center transition-all ${
              isExpanded && currentTab === 'airspace'
                ? 'bg-[#142036] border-2 border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)] text-cyan-300'
                : 'bg-[#101524] border border-[#1d2942] hover:bg-[#151c30] text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 text-cyan-400 mb-0.5" />
            <span className="text-[8px] font-mono font-bold">AIR</span>
          </button>

          {/* Separation Radar Button */}
          <button
            onClick={() => handleTabClick('radar')}
            title="Drone-to-Drone Separation Radar"
            className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center transition-all ${
              isExpanded && currentTab === 'radar'
                ? 'bg-[#142036] border-2 border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)] text-cyan-300'
                : 'bg-[#101524] border border-[#1d2942] hover:bg-[#151c30] text-slate-400 hover:text-white'
            }`}
          >
            <Radar className="w-4 h-4 text-cyan-400 mb-0.5" />
            <span className="text-[8px] font-mono font-bold">RADAR</span>
          </button>

          {/* Active Mission Tracking Button */}
          <button
            onClick={() => handleTabClick('missions')}
            title="Active Mission Tracking"
            className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center transition-all ${
              isExpanded && currentTab === 'missions'
                ? 'bg-[#142036] border-2 border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)] text-cyan-300'
                : 'bg-[#101524] border border-[#1d2942] hover:bg-[#151c30] text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4 text-cyan-400 mb-0.5" />
            <span className="text-[8px] font-mono font-bold">MSN</span>
          </button>

          {/* System Diagnostics Button */}
          <button
            onClick={() => handleTabClick('system')}
            title="PX4 SITL & System Health"
            className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center transition-all ${
              isExpanded && currentTab === 'system'
                ? 'bg-[#142036] border-2 border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)] text-cyan-300'
                : 'bg-[#101524] border border-[#1d2942] hover:bg-[#151c30] text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400 mb-0.5" />
            <span className="text-[8px] font-mono font-bold">SYS</span>
          </button>
        </div>

        {/* Bottom Expand Toggle Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => onToggleExpand && onToggleExpand(!isExpanded)}
            title={isExpanded ? 'Collapse Right Panel' : 'Expand Tools Drawer'}
            className="p-1.5 rounded bg-[#101524] border border-[#1d2942] text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-all"
          >
            <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </aside>
    </div>
  );
};
