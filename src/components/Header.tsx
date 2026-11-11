import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  Clock, 
  Bell, 
  Settings, 
  SlidersHorizontal,
  Compass,
  Layers,
  BarChart3,
  Info,
  Video,
  Code,
  Cpu,
  MoreHorizontal,
  Wrench,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { QuadcopterIcon } from './icons/QuadcopterIcon';
import { AirspaceAlert, NotificationItem } from '../types/fleet';
import { DESIGN_TOKENS } from '../styles/designTokens';

export interface HeaderProps {
  activeTab: 'live' | 'fleet' | 'missions' | 'airspace' | 'analytics' | 'camera' | 'about';
  setActiveTab: (tab: 'live' | 'fleet' | 'missions' | 'airspace' | 'analytics' | 'camera' | 'about') => void;
  alerts: AirspaceAlert[];
  notifications: NotificationItem[];
  isNotificationPanelOpen: boolean;
  setIsNotificationPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenSettings: () => void;
  onOpenReplay: () => void;
  onOpenApiContract?: () => void;
  onOpenPx4Setup?: () => void;
  engineMode?: 'mock' | 'http' | 'px4';
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  alerts,
  notifications,
  isNotificationPanelOpen,
  setIsNotificationPanelOpen,
  onOpenSettings,
  onOpenReplay,
  onOpenApiContract,
  onOpenPx4Setup,
  engineMode = 'mock',
}) => {
  const [time, setTime] = useState<string>(() => new Date().toLocaleTimeString('en-IN', { hour12: false }));
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [showAlertPreview, setShowAlertPreview] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const alertPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setIsOverflowOpen(false);
      }
      if (alertPreviewRef.current && !alertPreviewRef.current.contains(e.target as Node)) {
        setShowAlertPreview(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const criticalCount = notifications.filter((n) => n.severity === 'critical' && !n.acknowledged).length;
  const activeAlertsCount = alerts.filter((a) => !a.acknowledged).length;

  const isSimulation = engineMode === 'mock' || engineMode === 'px4';

  const navItems = [
    { id: 'live', label: 'Live Operations', icon: Radio },
    { id: 'fleet', label: 'Fleet', icon: QuadcopterIcon },
    { id: 'missions', label: 'Missions', icon: Compass },
    { id: 'airspace', label: 'Airspace', icon: Layers },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'camera', label: 'Live Camera', icon: Video, title: 'Full-Screen Aerospace Gimbal Camera Feed (/live-camera)' },
  ] as const;

  return (
    <header className="h-14 bg-[#090d17] border-b border-[#1c2940] px-3.5 flex items-center justify-between z-30 select-none shrink-0 shadow-xl relative font-sans">
      {/* ─── LEFT: BRAND & PRIMARY NAVIGATION ─── */}
      <div className="flex items-center gap-4 lg:gap-6 min-w-0">
        {/* Brand Logo */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer group shrink-0" 
          onClick={() => setActiveTab('live')}
          title="Return to Live Operations"
        >
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-[0_0_16px_rgba(0,240,255,0.4)] border border-cyan-400/50 shrink-0 transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 19h20L12 2z" />
              <path d="M12 9v6" />
              <path d="M9 16h6" />
            </svg>
          </div>
          <div className="hidden sm:block truncate">
            <div className="flex items-center gap-2 leading-none">
              <span className="font-black text-xl tracking-[0.2em] text-white">AEROVATA</span>
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 uppercase tracking-wider font-mono">
                UTM
              </span>
            </div>
            <div className="text-[11px] font-medium tracking-wider text-slate-400 mt-1 truncate">
              by <span className="text-slate-200 font-bold tracking-widest">TASPORA</span> • COIMBATORE
            </div>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-[#0f1524] p-1 rounded-lg border border-[#1e2a42]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                aria-label={item.label}
                className={`relative px-3 py-1.5 rounded-md text-[12px] font-semibold tracking-wide transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  isActive
                    ? 'bg-cyan-500/25 text-cyan-200 font-bold border border-cyan-400/60 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-cyan-400 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ─── CENTER-RIGHT: SEPARATE MODE / TOOLS GROUP ─── */}
      <div className="hidden 2xl:flex items-center gap-1 bg-[#0c1220] p-1 rounded-lg border border-[#1b273d]">
        <span className="text-[10px] text-slate-500 font-mono font-bold px-2 uppercase tracking-wider">
          TOOLS:
        </span>

        {/* PX4 SITL Gateway Button */}
        {onOpenPx4Setup && (
          <button
            onClick={onOpenPx4Setup}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold rounded transition-colors ${
              engineMode === 'px4'
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/60 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                : 'text-blue-300 bg-blue-950/50 hover:bg-blue-900/50 border border-blue-800/50'
            }`}
            title="PX4 SITL & Gazebo Autopilot Integration Guide"
            aria-label="PX4 SITL Integration"
          >
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>PX4 SITL</span>
          </button>
        )}

        {/* Mission Replay Scrubber */}
        <button
          onClick={onOpenReplay}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-300 bg-[#141b2c] hover:bg-[#1a233a] border border-[#23314d] rounded transition-colors"
          title="Open Historical Mission Replay Scrubber"
          aria-label="Open Mission Replay"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Replay</span>
        </button>

        {/* PX4 Setup Guide */}
        {onOpenPx4Setup && (
          <button
            onClick={onOpenPx4Setup}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded transition-colors"
            title="PX4 & Autopilot Setup Wizard"
            aria-label="PX4 Setup Wizard"
          >
            <Wrench className="w-3.5 h-3.5 text-slate-400" />
            <span>Setup</span>
          </button>
        )}
      </div>

      {/* ─── RIGHT: STATUS, SIMULATION BADGE, ALERTS & OVERFLOW ─── */}
      <div className="flex items-center gap-2">
        {/* Real-time Clock */}
        <div className="hidden lg:flex items-center gap-1.5 bg-[#0f1626] px-2.5 py-1 rounded-md border border-[#1e2a42] text-[12px] font-mono font-semibold text-slate-200">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{time}</span>
          <span className="text-[10px] text-slate-500 font-sans">IST</span>
        </div>

        {/* ─── CLARIFY SIMULATION VS LIVE BADGE (Requirement 4) ─── */}
        {isSimulation ? (
          <div className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/80 px-2.5 py-1 rounded-md shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-bold font-mono tracking-wider text-amber-300 uppercase">
              SIMULATION
            </span>
            <span className="text-[10px] px-1 py-0.2 bg-amber-900/80 text-amber-200 rounded font-mono font-bold">
              {engineMode === 'px4' ? 'PX4 SITL' : 'MOCK'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-500/80 px-2.5 py-1 rounded-md shadow-[0_0_12px_rgba(16,185,129,0.25)]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold font-mono tracking-wider text-emerald-300 uppercase">
              LIVE FLIGHTS
            </span>
            <span className="text-[10px] px-1 py-0.2 bg-emerald-900/80 text-emerald-200 rounded font-mono font-bold">
              ACTIVE
            </span>
          </div>
        )}

        {/* Interactive Alerts Badge with Preview (Requirement 7) */}
        <div className="relative" ref={alertPreviewRef}>
          <button 
            onClick={() => setIsNotificationPanelOpen((prev) => !prev)}
            onMouseEnter={() => setShowAlertPreview(true)}
            aria-label={`Operational Alerts (${unreadNotifications} unread)`}
            className={`p-2 rounded-md transition-all relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              isNotificationPanelOpen || showAlertPreview
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent'
            }`}
            title="Operational Notifications & Alerts (Click to toggle panel)"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications > 0 && (
              <span className={`absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full text-white text-[10px] font-bold font-mono flex items-center justify-center ${
                criticalCount > 0 ? 'bg-rose-500 animate-bounce' : 'bg-cyan-500'
              }`}>
                {unreadNotifications}
              </span>
            )}
          </button>

          {/* Alerts Hover / Click Preview Card */}
          {showAlertPreview && !isNotificationPanelOpen && (
            <div 
              className="absolute right-0 top-full mt-2 w-80 bg-[#0c1220]/98 backdrop-blur-xl border border-cyan-500/60 rounded-lg p-3 shadow-2xl z-40 text-xs font-mono animate-in fade-in slide-in-from-top-1 duration-150"
              onMouseLeave={() => setShowAlertPreview(false)}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1f2a40]">
                <div className="flex items-center gap-1.5 text-slate-100 font-bold text-[12px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>ACTIVE ALERTS &amp; EVENTS</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {unreadNotifications} NEW
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                {notifications.slice(0, 3).map((notif) => (
                  <div 
                    key={notif.id}
                    className="p-2 rounded bg-[#101726] border border-[#1d2940] hover:border-cyan-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className={`font-bold uppercase ${
                        notif.severity === 'critical' ? 'text-rose-400' :
                        notif.severity === 'warning' ? 'text-amber-400' : 'text-cyan-400'
                      }`}>
                        {notif.severity}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        {new Date(notif.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-200 line-clamp-2 leading-tight">
                      {notif.description || notif.title}
                    </p>
                  </div>
                ))}

                {notifications.length === 0 && (
                  <div className="py-4 text-center text-slate-400 text-[11px]">
                    No active warnings or airspace conflicts.
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setShowAlertPreview(false);
                  setIsNotificationPanelOpen(true);
                }}
                className="mt-2 w-full py-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
              >
                <span>Open Operations Drawer</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ─── OVERFLOW "..." MENU (Requirement 3: Move About & API here) ─── */}
        <div className="relative" ref={overflowRef}>
          <button
            onClick={() => setIsOverflowOpen(!isOverflowOpen)}
            aria-label="More Options & System Specification"
            className={`p-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              isOverflowOpen ? 'bg-slate-800 text-cyan-300' : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
            title="More Options (About, API Contract)"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isOverflowOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-[#0c1220]/98 backdrop-blur-xl border border-[#233350] rounded-lg p-1.5 shadow-2xl z-40 text-xs font-mono animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-2.5 py-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider border-b border-[#1c2940] mb-1">
                System Options
              </div>

              {onOpenApiContract && (
                <button
                  onClick={() => {
                    setIsOverflowOpen(false);
                    onOpenApiContract();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-slate-200 hover:text-cyan-300 hover:bg-cyan-950/40 flex items-center gap-2 transition-colors"
                >
                  <Code className="w-3.5 h-3.5 text-cyan-400" />
                  <span>REST API Specification</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsOverflowOpen(false);
                  setActiveTab('about');
                }}
                className="w-full text-left px-2.5 py-1.5 rounded text-slate-200 hover:text-cyan-300 hover:bg-cyan-950/40 flex items-center gap-2 transition-colors"
              >
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span>About Aerovata UTM</span>
              </button>

              <button
                onClick={() => {
                  setIsOverflowOpen(false);
                  onOpenSettings();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded text-slate-200 hover:text-cyan-300 hover:bg-cyan-950/40 flex items-center gap-2 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-cyan-400" />
                <span>System Settings</span>
              </button>
            </div>
          )}
        </div>

        {/* Operator Profile */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400 font-mono shadow-sm">
            TN
          </div>
          <div className="hidden xl:block text-left text-[11px] leading-tight">
            <div className="text-slate-200 font-medium">Cmdr. K. Selvam</div>
            <div className="text-[10px] text-slate-500 font-mono">CBE DISPATCH L3</div>
          </div>
        </div>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          aria-label="System Settings"
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/70 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          title="System Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
