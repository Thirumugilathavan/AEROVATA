import React from 'react';
import { 
  Radio, 
  Clock, 
  Bell, 
  Settings, 
  ShieldCheck, 
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Compass,
  Layers,
  BarChart3,
  Plane,
  Camera,
  Code,
  Info
} from 'lucide-react';
import { AirspaceAlert } from '../types/fleet';

interface HeaderProps {
  activeTab: 'live' | 'camera' | 'fleet' | 'missions' | 'airspace' | 'analytics' | 'about';
  setActiveTab: (tab: 'live' | 'camera' | 'fleet' | 'missions' | 'airspace' | 'analytics' | 'about') => void;
  alerts: AirspaceAlert[];
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenSettings: () => void;
  onOpenReplay: () => void;
  onOpenApiContract?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  alerts,
  isMuted,
  setIsMuted,
  onOpenSettings,
  onOpenReplay,
  onOpenApiContract,
}) => {
  const [time, setTime] = React.useState<string>(() => new Date().toTimeString().split(' ')[0]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toTimeString().split(' ')[0]);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged).length;

  return (
    <header className="h-14 bg-[#0c101a] border-b border-[#1f2a40] px-4 flex items-center justify-between z-30 select-none shrink-0 shadow-lg">
      {/* Brand Identity */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('live')}>
          {/* Aerospace Geometric Logo */}
          <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400/40">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 19h20L12 2z" />
              <path d="M12 9v6" />
              <path d="M9 16h6" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="font-extrabold text-[15px] tracking-[0.2em] text-white">AEROVATA</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 uppercase tracking-wider">BVLOS</span>
            </div>
            <div className="text-[10px] font-medium tracking-wider text-slate-400 mt-0.5">
              by <span className="text-slate-200 font-semibold tracking-widest">TASPORA</span> • COMMAND CENTER
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
            onClick={() => {
              setActiveTab('camera');
              window.history.pushState({}, '', '/live-camera');
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === 'camera'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span>Live Camera</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
              HUD
            </span>
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
      <div className="flex items-center gap-3">
        {/* Mission Replay button */}
        <button
          onClick={onOpenReplay}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 bg-[#161d2d] hover:bg-[#1e273d] border border-[#2b3a58] rounded transition-colors"
          title="Open Historical Mission Replay Scrubber"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Mission Replay</span>
        </button>

        {/* API Contract Specification modal button */}
        <button
          onClick={onOpenApiContract}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 bg-[#161d2d] hover:bg-[#1e273d] border border-[#2b3a58] rounded transition-colors"
          title="View REST API Contract & Schemas"
        >
          <Code className="w-3.5 h-3.5 text-cyan-400" />
          <span>API Spec</span>
        </button>

        {/* Audio Mute toggle */}
        <button
          onClick={() => setIsMuted((prev) => !prev)}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded transition-colors"
          title={isMuted ? 'Unmute Audio Radar' : 'Mute Audio Radar'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
        </button>

        {/* Real-time Clock */}
        <div className="flex items-center gap-1.5 bg-[#131926] px-2.5 py-1 rounded border border-[#222f47] text-xs font-mono font-medium text-slate-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{time}</span>
          <span className="text-[10px] text-slate-500 font-sans">UTC+10</span>
        </div>

        {/* Live Simulation Status Indicator */}
        <div className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded text-xs font-medium text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="tracking-wide text-[11px] font-bold">CONNECTED</span>
          <span className="text-[9px] px-1 py-0.2 bg-emerald-900/60 text-emerald-300 rounded font-mono">SIM</span>
        </div>

        {/* Alerts Bell */}
        <div className="relative">
          <button 
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
            title="System Alerts"
          >
            <Bell className="w-4 h-4" />
            {unacknowledgedAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                {unacknowledgedAlerts}
              </span>
            )}
          </button>
        </div>

        {/* Operator Profile */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400">
            SV
          </div>
          <div className="hidden xl:block text-left text-[11px] leading-tight">
            <div className="text-slate-200 font-medium">Capt. S. Vance</div>
            <div className="text-[9px] text-slate-500 font-mono">DISPATCHER L3</div>
          </div>
        </div>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded transition-colors"
          title="System Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
