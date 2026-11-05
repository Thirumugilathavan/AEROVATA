import React, { useState } from 'react';
import {
  LayoutDashboard,
  Route,
  PackageCheck,
  Bell,
  BarChart3,
  Settings,
  Layers,
  ChevronRight,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { QuadcopterIcon } from './icons/QuadcopterIcon';
import { Drone, AirspaceAlert } from '../types/fleet';

interface SlimSidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  drones: Drone[];
  alerts: AirspaceAlert[];
  selectedDroneId: string | null;
  onSelectDrone: (id: string) => void;
  onOpenSettings: () => void;
}

const DroneIcon = ({ className = '', color = 'currentColor' }: { className?: string; color?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Drone body */}
    <ellipse cx="16" cy="16" rx="5" ry="3.5" fill={color} fillOpacity="0.9" />
    {/* Arms */}
    <line x1="11" y1="16" x2="5" y2="11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <line x1="21" y1="16" x2="27" y2="11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <line x1="11" y1="16" x2="5" y2="21" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <line x1="21" y1="16" x2="27" y2="21" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    {/* Rotors */}
    <ellipse cx="5" cy="10.5" rx="3.5" ry="1.2" fill={color} fillOpacity="0.5" />
    <ellipse cx="27" cy="10.5" rx="3.5" ry="1.2" fill={color} fillOpacity="0.5" />
    <ellipse cx="5" cy="21.5" rx="3.5" ry="1.2" fill={color} fillOpacity="0.5" />
    <ellipse cx="27" cy="21.5" rx="3.5" ry="1.2" fill={color} fillOpacity="0.5" />
    {/* Center dot */}
    <circle cx="16" cy="16" r="1.5" fill="white" fillOpacity="0.9" />
    {/* Downward camera */}
    <rect x="14.5" y="18.5" width="3" height="2" rx="0.5" fill={color} fillOpacity="0.6" />
  </svg>
);

const getDroneStatusColor = (status: string) => {
  switch (status) {
    case 'delivering': return '#00e5ff';
    case 'en_route_pickup': return '#3b82f6';
    case 'returning_to_base': return '#10b981';
    case 'charging': return '#f59e0b';
    case 'attention_required': return '#ef4444';
    case 'hovering': return '#a78bfa';
    default: return '#475569';
  }
};

const getDroneStatusLabel = (status: string) => {
  switch (status) {
    case 'delivering': return 'In Transit';
    case 'en_route_pickup': return 'En Route';
    case 'returning_to_base': return 'Returning';
    case 'charging': return 'Charging';
    case 'attention_required': return 'Attention';
    case 'hovering': return 'Hovering';
    default: return 'Standby';
  }
};

const NAV_ITEMS = [
  { id: 'live', icon: LayoutDashboard, label: 'Live Ops', desc: 'Real-time fleet operations' },
  { id: 'fleet', icon: QuadcopterIcon, label: 'Fleet', desc: 'Drone registry & specs' },
  { id: 'missions', icon: PackageCheck, label: 'Missions', desc: 'Delivery manifests' },
  { id: 'airspace', icon: Layers, label: 'Airspace', desc: 'UTM & geofence zones' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics', desc: 'Performance metrics' },
];

export const SlimSidebar: React.FC<SlimSidebarProps> = ({
  activeTab,
  setActiveTab,
  drones,
  alerts,
  selectedDroneId,
  onSelectDrone,
  onOpenSettings,
}) => {
  const [showFleetPanel, setShowFleetPanel] = useState(false);
  const unreadAlerts = alerts.filter(a => !a.acknowledged).length;

  const activeDrones = drones.filter(d =>
    ['delivering', 'en_route_pickup', 'returning_to_base', 'hovering', 'attention_required'].includes(d.status)
  );

  return (
    <aside className="slim-sidebar h-full py-3 relative">
      {/* LOGO */}
      <div className="flex items-center justify-center w-full mb-4 pb-3 border-b border-[#1a2235]">
        <div className="relative">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center shadow-[0_0_14px_rgba(0,229,255,0.4)]">
            <DroneIcon className="w-5 h-5" color="white" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#07090f]" />
        </div>
      </div>

      {/* NAV ITEMS */}
      <nav className="flex flex-col items-center gap-1 px-2 flex-1 w-full">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div key={item.id} className="sidebar-item relative w-full">
              <button
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-center rounded-lg transition-all duration-200 h-10 group ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-400 shadow-[inset_0_0_0_1px_rgba(0,229,255,0.25)]'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                }`}
                title={item.label}
              >
                <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-cyan-400' : ''}`} />
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-cyan-400 rounded-r-full" />
                )}
              </button>

              {/* Hover Tooltip */}
              <div className="sidebar-tooltip">
                <div className="text-xs font-semibold text-white mb-0.5">{item.label}</div>
                <div className="text-[11px] text-slate-400">{item.desc}</div>
              </div>
            </div>
          );
        })}

        {/* DRONE FLEET QUICK ACCESS */}
        <div className="sidebar-item relative w-full mt-2">
          <div className="w-full px-1.5 border-t border-[#1a2235] pt-2 mb-1">
            <div className="text-[9px] text-slate-600 text-center font-mono uppercase tracking-widest">Fleet</div>
          </div>
        </div>

        {drones.slice(0, 6).map((drone, idx) => {
          const color = getDroneStatusColor(drone.status);
          const isSelected = drone.id === selectedDroneId;
          const bat = drone.vitals.batteryPercentage;
          return (
            <div key={drone.id} className="sidebar-item relative w-full">
              <button
                onClick={() => onSelectDrone(drone.id)}
                className={`w-full flex items-center justify-center rounded-lg transition-all duration-200 h-9 group relative ${
                  isSelected
                    ? 'bg-white/8 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
                    : 'hover:bg-white/5'
                }`}
                title={drone.callsign}
              >
                <div className="relative">
                  <DroneIcon className="w-5 h-5" color={color} />
                  {/* Battery micro-indicator */}
                  <div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all"
                    style={{
                      width: '14px',
                      background: bat > 50 ? '#10b981' : bat > 25 ? '#f59e0b' : '#ef4444',
                      opacity: bat / 100,
                    }}
                  />
                  {/* Status blink for attention */}
                  {drone.status === 'attention_required' && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-400 rounded-full status-dot-blink" />
                  )}
                  {isSelected && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-400 rounded-full" />
                  )}
                </div>
              </button>

              {/* Hover Tooltip for each drone */}
              <div className="sidebar-tooltip" style={{ minWidth: '220px' }}>
                <div className="flex items-center gap-2 mb-2">
                  <DroneIcon className="w-7 h-7" color={color} />
                  <div>
                    <div className="text-xs font-semibold text-white">{drone.callsign}</div>
                    <div className="text-[10px] font-mono" style={{ color }}>{getDroneStatusLabel(drone.status)}</div>
                  </div>
                </div>
                <div className="space-y-1 text-[11px] border-t border-[#1a2235] pt-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Battery</span>
                    <span className={bat > 50 ? 'text-emerald-400' : bat > 25 ? 'text-amber-400' : 'text-rose-400'}>
                      {Math.round(bat)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Altitude</span>
                    <span className="text-slate-200 font-mono">{Math.round(drone.vitals.altitudeMeters)}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Speed</span>
                    <span className="text-slate-200 font-mono">{Math.round(drone.vitals.groundSpeedKmh)} km/h</span>
                  </div>
                  {drone.delivery && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Dest</span>
                      <span className="text-cyan-300 text-right max-w-[120px] truncate">{drone.delivery.destinationAddress.split(',')[0]}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onSelectDrone(drone.id)}
                  className="mt-2 w-full text-[10px] text-center text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/15 rounded py-1 transition-colors flex items-center justify-center gap-1 pointer-events-auto"
                >
                  Track <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </nav>

      {/* BOTTOM: ALERTS + SETTINGS */}
      <div className="mt-auto flex flex-col items-center gap-1 px-2 pt-3 border-t border-[#1a2235]">
        {/* Alerts bell */}
        <div className="sidebar-item relative w-full">
          <button
            className="w-full flex items-center justify-center rounded-lg h-10 text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all relative"
            title="Alerts"
          >
            <Bell className="w-5 h-5" />
            {unreadAlerts > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadAlerts}
              </span>
            )}
          </button>
          <div className="sidebar-tooltip">
            <div className="text-xs font-semibold text-white mb-0.5">Alerts</div>
            <div className="text-[11px] text-slate-400">{unreadAlerts} unacknowledged</div>
          </div>
        </div>

        {/* Settings */}
        <div className="sidebar-item relative w-full">
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center justify-center rounded-lg h-10 text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <div className="sidebar-tooltip">
            <div className="text-xs font-semibold text-white mb-0.5">Settings</div>
            <div className="text-[11px] text-slate-400">System configuration</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
