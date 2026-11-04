import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Clock, 
  Bell, 
  Settings, 
  SlidersHorizontal,
  Compass,
  Layers,
  BarChart3,
  Plane,
  Info,
  Video,
  Code,
  Cpu
} from 'lucide-react';
import { AirspaceAlert, NotificationItem } from '../types/fleet';

interface HeaderProps {
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
}) => {
  const [time, setTime] = useState<string>(() => new Date().toLocaleTimeString('en-IN', { hour12: false }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const criticalCount = notifications.filter((n) => n.severity === 'critical' && !n.acknowledged).length;

  return (
    <header className="h-14 bg-[#0c101a] border-b border-[#1f2a40] px-3.5 flex items-center justify-between z-30 select-none shrink-0 shadow-lg relative">
      {/* Brand Identity */}
      <div className="flex items-center gap-4 lg:gap-6">
        <div 
          className="flex items-center gap-2.5 cursor-pointer group" 
          onClick={() => setActiveTab('live')}
          title="Return to Live Operations"
        >
          {/* Aerospace Geometric Logo */}
          <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400/40 shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 19h20L12 2z" />
              <path d="M12 9v6" />
              <path d="M9 16h6" />
            </svg>
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2 leading-none">
              <span className="font-black text-xl tracking-[0.2em] text-white">AEROVATA</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/80 uppercase tracking-wider font-mono">BVLOS</span>
            </div>
            <div className="text-xs font-medium tracking-wider text-slate-400 mt-1 truncate">
              by <span className="text-slate-100 font-bold tracking-widest">TASPORA</span> • COIMBATORE COMMAND CENTER
            </div>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-[#121724] p-1 rounded-md border border-[#1f2c44]">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === 'live'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            Live Operations
          </button>

          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === 'fleet'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Plane className="w-3.5 h-3.5" />
            Fleet
          </button>

          <button
            onClick={() => setActiveTab('missions')}
            className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === 'missions'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Missions
          </button>

          <button
            onClick={() => setActiveTab('airspace')}
            className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === 'airspace'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Airspace
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </button>

          <button
            onClick={() => setActiveTab('camera')}
            className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === 'camera'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
            title="Full-Screen Aerospace Gimbal Camera Feed (/live-camera)"
          >
            <Video className="w-3.5 h-3.5 text-cyan-400" />
            Live Camera
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === 'about'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            About
          </button>
        </nav>
      </div>

      {/* Right Controls & Telemetry Status */}
      <div className="flex items-center gap-2">
        {/* API Contract Modal Button */}
        {onOpenApiContract && (
          <button
            onClick={onOpenApiContract}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 rounded transition-colors"
            title="Inspect REST API & Telemetry Contract"
          >
            <Code className="w-3.5 h-3.5 text-cyan-400" />
            <span>API</span>
          </button>
        )}

        {/* PX4 Setup Modal Button */}
        {onOpenPx4Setup && (
          <button
            onClick={onOpenPx4Setup}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold text-blue-300 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800/60 rounded transition-colors"
            title="PX4 SITL & Gazebo Autopilot Integration Guide"
          >
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>PX4 SITL</span>
          </button>
        )}

        {/* Mission Replay button */}
        <button
          onClick={onOpenReplay}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 bg-[#161d2d] hover:bg-[#1e273d] border border-[#2b3a58] rounded transition-colors"
          title="Open Historical Mission Replay Scrubber"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Mission Replay</span>
        </button>

        {/* Real-time Clock (IST Coimbatore Time) */}
        <div className="flex items-center gap-1.5 bg-[#131926] px-2.5 py-1 rounded border border-[#222f47] text-xs font-mono font-medium text-slate-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{time}</span>
          <span className="text-[10px] text-slate-500 font-sans">IST (UTC+5:30)</span>
        </div>

        {/* Live Simulation Status Indicator */}
        <div className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded text-xs font-medium text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="tracking-wide text-[11px] font-bold font-mono">LIVE UTM</span>
          <span className="text-[9px] px-1 py-0.2 bg-emerald-900/60 text-emerald-300 rounded font-mono">3D SIM</span>
        </div>

        {/* Functional Notification Bell (Req 3) */}
        <div className="relative">
          <button 
            onClick={() => setIsNotificationPanelOpen((prev) => !prev)}
            className={`p-2 rounded-md transition-all relative ${
              isNotificationPanelOpen
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Operational Notifications & Alerts"
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
        </div>

        {/* Operator Profile */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400 font-mono">
            TN
          </div>
          <div className="hidden xl:block text-left text-[11px] leading-tight">
            <div className="text-slate-200 font-medium">Cmdr. K. Selvam</div>
            <div className="text-[9px] text-slate-500 font-mono">CBE DISPATCH L3</div>
          </div>
        </div>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-md transition-colors"
          title="System Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
