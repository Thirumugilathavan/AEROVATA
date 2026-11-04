/**
 * PX4 SITL & Modern Gazebo Setup Guide Modal
 * AEROVATA by TASPORA
 * 
 * Step-by-step instructions for setting up and running PX4 Autopilot SITL
 * with modern Gazebo (Garden/Harmonic) on Windows via WSL2 / Ubuntu 22.04 LTS.
 */

import React, { useState } from 'react';
import { 
  Terminal, 
  Copy, 
  Check, 
  ExternalLink, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  Play 
} from 'lucide-react';

interface Px4SetupModalProps {
  onClose: () => void;
}

export const Px4SetupModal: React.FC<Px4SetupModalProps> = ({ onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const codeBlocks = [
    // Step 1: Install WSL2 Ubuntu 22.04
    `wsl --install -d Ubuntu-22.04`,
    // Step 2: Clone PX4-Autopilot in WSL2
    `git clone https://github.com/PX4/PX4-Autopilot.git --recursive\ncd PX4-Autopilot\nbash ./Tools/setup/ubuntu.sh\n# Log out and log back in to apply group changes`,
    // Step 3: Run PX4 SITL with modern Gazebo
    `# In Ubuntu/WSL2:\ncd PX4-Autopilot\nmake px4_sitl gz_x500`,
    // Step 4: Run TASPORA MAVLink Gateway on Windows
    `# In Windows PowerShell (inside TASPORA repository):\npython simulation-gateway/px4_gateway.py\n\n# Or with automated verification test harness:\npython simulation-gateway/px4_gateway.py --test-harness`,
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-[#0b101c] border border-cyan-500/30 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-14 bg-[#0e1627] border-b border-[#1f2d47] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white tracking-wide">PX4 AUTOPILOT SITL & GAZEBO SETUP GUIDE</h3>
              <div className="text-[11px] text-slate-400">Windows 11 + WSL2 Ubuntu 22.04 LTS Development Environment</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 text-xs font-semibold"
          >
            ✕ Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* OS Environment Check Alert */}
          <div className="p-3.5 rounded-lg bg-[#141b2e] border border-cyan-500/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-xs mb-1">Host Environment Analysis</div>
              <div className="text-[11px] text-slate-400 leading-relaxed">
                PX4 SITL with modern Gazebo requires a native Linux environment for its real-time ODE/Bullet physics solvers and Gazebo Transport plugins. On Windows 11, WSL2 (Ubuntu 22.04 LTS) is the official recommended environment. MAVLink telemetry streams effortlessly across the local WSL2 virtual network interface to Windows on UDP:14550.
              </div>
            </div>
          </div>

          {/* STEP 1 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center text-xs">1</span>
                <span>Install WSL2 & Ubuntu 22.04 LTS (Windows PowerShell as Admin)</span>
              </h4>
              <button
                onClick={() => handleCopy(codeBlocks[0], 0)}
                className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 text-[11px]"
              >
                {copiedIndex === 0 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedIndex === 0 ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-3 bg-black/60 rounded border border-slate-800 font-mono text-cyan-300 text-[11px]">
              {codeBlocks[0]}
            </pre>
          </div>

          {/* STEP 2 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center text-xs">2</span>
                <span>Clone PX4-Autopilot & Run Ubuntu Setup Script (Inside WSL2)</span>
              </h4>
              <button
                onClick={() => handleCopy(codeBlocks[1], 1)}
                className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 text-[11px]"
              >
                {copiedIndex === 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedIndex === 1 ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-3 bg-black/60 rounded border border-slate-800 font-mono text-cyan-300 text-[11px]">
              {codeBlocks[1]}
            </pre>
          </div>

          {/* STEP 3 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center text-xs">3</span>
                <span>Launch PX4 SITL with modern Gazebo (x500 Quadrotor)</span>
              </h4>
              <button
                onClick={() => handleCopy(codeBlocks[2], 2)}
                className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 text-[11px]"
              >
                {copiedIndex === 2 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedIndex === 2 ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-3 bg-black/60 rounded border border-slate-800 font-mono text-cyan-300 text-[11px]">
              {codeBlocks[2]}
            </pre>
            <div className="text-[11px] text-slate-400">
              PX4 will compile, start the autopilot daemon, open Gazebo with the x500 quadrotor model, and begin broadcasting MAVLink packets on UDP:14550.
            </div>
          </div>

          {/* STEP 4 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center text-xs">4</span>
                <span>Start TASPORA MAVLink Gateway (On Windows Host)</span>
              </h4>
              <button
                onClick={() => handleCopy(codeBlocks[3], 3)}
                className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 text-[11px]"
              >
                {copiedIndex === 3 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedIndex === 3 ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-3 bg-black/60 rounded border border-slate-800 font-mono text-cyan-300 text-[11px]">
              {codeBlocks[3]}
            </pre>
            <div className="text-[11px] text-slate-400">
              The gateway connects to PX4 over UDP:14550, translates MAVLink telemetry, and streams it live to TASPORA via WebSocket at <span className="font-mono text-white">ws://127.0.0.1:8080/ws/telemetry</span>.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 bg-[#0a0f1b] border-t border-[#1b263b] px-6 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-400">
            For documentation, visit <a href="https://docs.px4.io/main/en/sim_gazebo_gz/" target="_blank" rel="noreferrer" className="text-cyan-400 underline">PX4 Gazebo Simulation Docs</a>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
