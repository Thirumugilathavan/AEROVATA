import React, { useState, useEffect } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  Clock, 
  SlidersHorizontal,
  Compass,
  Battery
} from 'lucide-react';
import { QuadcopterIcon } from './icons/QuadcopterIcon';
import { Drone } from '../types/fleet';

interface MissionReplayModalProps {
  drone: Drone;
  onClose: () => void;
}

export const MissionReplayModal: React.FC<MissionReplayModalProps> = ({ drone, onClose }) => {
  const [progress, setProgress] = useState<number>(45); // 0 to 100%
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setIsPlaying(false);
          return 100;
        }
        return Math.min(100, prev + 1 * playbackSpeed);
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // Compute interpolated replay telemetry based on progress
  const replayAlt = Math.round(20 + Math.sin((progress / 100) * Math.PI) * 75);
  const replaySpeed = Math.round(30 + Math.sin((progress / 100) * Math.PI) * 22);
  const replayBattery = Math.round(98 - (progress / 100) * 45);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm select-none p-4">
      <div className="w-full max-w-xl bg-[#0e1422] border border-[#2b3c5e] rounded-lg shadow-2xl overflow-hidden flex flex-col font-mono">
        {/* Header */}
        <div className="px-4 py-3 bg-[#131c2e] border-b border-[#223352] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-sm tracking-wider text-white uppercase">
              MISSION FLIGHT REPLAY • {drone.callsign} ({drone.delivery?.missionId})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Replay Screen */}
        <div className="p-5 space-y-4">
          {/* Simulated Replay Canvas Display */}
          <div className="w-full h-44 bg-[#090d15] rounded-md border border-[#1f2c45] relative flex flex-col justify-between p-4 overflow-hidden">
            <div className="flex justify-between items-start text-xs text-slate-400">
              <span className="text-cyan-400 font-bold">REPLAY TIME: 20:38:15 + {Math.round((progress / 100) * 18)}m</span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px]">
                {isPlaying ? 'PLAYING' : 'PAUSED'}
              </span>
            </div>

            {/* Drone position representation along trajectory curve */}
            <div className="relative w-full h-12 flex items-center">
              <div className="absolute w-full h-1 bg-slate-800 rounded"></div>
              <div 
                className="absolute h-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded"
                style={{ width: `${progress}%` }}
              ></div>
              <div 
                className="absolute w-6 h-6 -ml-3 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_12px_rgba(6,182,212,0.8)] flex items-center justify-center transition-all duration-75"
                style={{ left: `${progress}%` }}
              >
                <QuadcopterIcon className="w-3.5 h-3.5 text-slate-950" />
              </div>
            </div>

            {/* Replay Telemetry Readout */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-[#121929] p-1.5 rounded border border-[#21304d]">
                <div className="text-[10px] text-slate-500">ALTITUDE</div>
                <div className="text-sm font-bold text-white">{replayAlt} m</div>
              </div>
              <div className="bg-[#121929] p-1.5 rounded border border-[#21304d]">
                <div className="text-[10px] text-slate-500">AIRSPEED</div>
                <div className="text-sm font-bold text-cyan-300">{replaySpeed} km/h</div>
              </div>
              <div className="bg-[#121929] p-1.5 rounded border border-[#21304d]">
                <div className="text-[10px] text-slate-500">BATTERY</div>
                <div className="text-sm font-bold text-emerald-400">{replayBattery}%</div>
              </div>
            </div>
          </div>

          {/* Timeline Scrubber */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>0% (Launch)</span>
              <span className="text-cyan-400 font-bold">{Math.round(progress)}% Progress</span>
              <span>100% (Landing)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setProgress(0)}
                className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Rewind to Start"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsPlaying((prev) => !prev)}
                className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5 transition-colors shadow-lg"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY REPLAY'}</span>
              </button>
            </div>

            {/* Playback Speed Multipliers */}
            <div className="flex items-center gap-1 bg-[#121929] p-1 rounded border border-slate-700 text-xs">
              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2.5 py-1 rounded font-bold transition-colors ${playbackSpeed === spd ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                >
                  {spd}X
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
