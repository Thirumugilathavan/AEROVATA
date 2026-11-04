/**
 * Live Camera Screen (/live-camera)
 * AEROVATA by TASPORA - Autonomous Drone Delivery Command Center
 * 
 * Full-screen aerospace camera feed with dynamic HUD overlay,
 * connection status management, checkpoint tracking, and
 * strictly labeled demo-video fallback simulation.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Video, 
  VideoOff, 
  Radio, 
  Play, 
  Pause, 
  RotateCcw, 
  Compass, 
  Gauge, 
  Crosshair, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Settings2, 
  Maximize2, 
  Minimize2,
  ExternalLink,
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import type { Mission, MissionTelemetry, CameraConnectionStatus } from '../types/mission.ts';
import { apiService } from '../services/api/index.ts';

interface LiveCameraScreenProps {
  onBackToMap?: () => void;
}

export const LiveCameraScreen: React.FC<LiveCameraScreenProps> = ({ onBackToMap }) => {
  const controller = apiService.getController();
  const [mission, setMission] = useState<Mission | null>(() => controller.getMission());
  const [telemetry, setTelemetry] = useState<MissionTelemetry | null>(() => controller.getTelemetry());

  // Camera connection status
  const [feedMode, setFeedMode] = useState<CameraConnectionStatus>('FALLBACK_SIMULATION');
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Synthetic camera animation canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Subscribe to controller telemetry ticks
  useEffect(() => {
    const unsubscribe = controller.subscribe((updatedMission, updatedTelemetry) => {
      setMission({ ...updatedMission });
      setTelemetry({ ...updatedTelemetry });
    });
    return () => unsubscribe();
  }, [controller]);

  // Synthetic HUD Gimbal Camera Canvas Renderer (Terrain & Flight Motion)
  useEffect(() => {
    if (feedMode !== 'FALLBACK_SIMULATION') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const render = () => {
      time += 0.02;
      const width = canvas.width;
      const height = canvas.height;

      // Pitch and roll simulated from drone telemetry
      const heading = telemetry ? telemetry.headingDegrees : 45;
      const speed = telemetry ? telemetry.groundSpeedKmh : 0;
      const alt = telemetry ? telemetry.altitudeMeters : 80;
      const pitchOffset = Math.sin(time * 0.8) * 12 + (telemetry?.verticalSpeedMs || 0) * 4;
      const rollAngle = Math.sin(time * 0.5) * 0.03 * (speed > 5 ? 1 : 0.1);

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#040b17');
      skyGrad.addColorStop(0.5, '#0a192f');
      skyGrad.addColorStop(1, '#020611');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Horizon Center
      ctx.translate(width / 2, height / 2 + pitchOffset);
      ctx.rotate(rollAngle);

      // Ground Plane (Synthetic Elevation Grid)
      ctx.fillStyle = '#061324';
      ctx.fillRect(-width, 0, width * 2, height);

      // Grid Perspective Lines
      ctx.strokeStyle = '#00f0ff18';
      ctx.lineWidth = 1.2;
      const gridSpacing = 40;
      const groundOffset = (time * speed * 2) % gridSpacing;

      for (let y = 0; y < height / 2; y += 15) {
        const perspectiveY = Math.pow(y / (height / 2), 2) * (height / 2) + groundOffset;
        ctx.beginPath();
        ctx.moveTo(-width, perspectiveY);
        ctx.lineTo(width, perspectiveY);
        ctx.stroke();
      }

      for (let x = -width; x < width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x * 0.1, 0);
        ctx.lineTo(x * 1.8, height / 2);
        ctx.stroke();
      }

      // Artificial Horizon Line
      ctx.strokeStyle = '#00f0ff88';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-width * 0.35, 0);
      ctx.lineTo(-60, 0);
      ctx.moveTo(60, 0);
      ctx.lineTo(width * 0.35, 0);
      ctx.stroke();

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [feedMode, telemetry]);

  const activeCheckpoint = mission && mission.checkpoints[mission.currentCheckpointIndex];
  const completedCount = mission ? mission.checkpoints.filter((c) => c.status === 'reached').length : 0;
  const totalCount = mission ? mission.checkpoints.length : 0;

  const handleStartResume = () => {
    if (!mission) return;
    if (mission.status === 'running') {
      controller.pause();
    } else {
      controller.start();
    }
  };

  const handleReset = () => {
    controller.reset();
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#070a12] text-slate-100 overflow-hidden select-none font-sans relative">
      {/* Top Banner & Screen Controls */}
      <div className="h-12 bg-[#0c101a] border-b border-[#1f2a40] px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          {onBackToMap && (
            <button
              onClick={onBackToMap}
              className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-cyan-400 bg-[#141b2b] hover:bg-[#1a2338] border border-[#233350] rounded flex items-center gap-1.5 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Tactical Map</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-cyan-400" />
            <span className="font-extrabold text-sm tracking-wider text-white">LIVE PAYLOAD & GIMBAL CAMERA HUD</span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
              {telemetry?.droneId || 'AV-01'}
            </span>
          </div>
        </div>

        {/* Center: MANDATORY SENSOR DISCLAIMER */}
        <div className="flex items-center gap-2">
          {feedMode === 'FALLBACK_SIMULATION' && (
            <div className="px-3 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="tracking-wide uppercase">DEMO VIDEO FALLBACK / SYNTHETIC SIMULATION — NOT LIVE FOOTAGE</span>
            </div>
          )}

          {feedMode === 'CONNECTED' && (
            <div className="px-3 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>EXTERNAL STREAM CONNECTED (1080p60)</span>
            </div>
          )}

          {feedMode === 'DISCONNECTED' && (
            <div className="px-3 py-1 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5">
              <VideoOff className="w-3.5 h-3.5 text-rose-400" />
              <span>CAMERA SENSOR OFFLINE / DISCONNECTED</span>
            </div>
          )}
        </div>

        {/* Right Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-[#141b2b] hover:bg-[#1e273d] border border-[#233350] rounded flex items-center gap-1.5 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Feed Source</span>
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div className="flex-1 relative w-full h-full min-h-0 bg-black flex items-center justify-center overflow-hidden">
        {/* State 1: Demo Video Fallback Canvas */}
        {feedMode === 'FALLBACK_SIMULATION' && (
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            className="w-full h-full object-cover"
          />
        )}

        {/* State 2: External Live Stream Video */}
        {feedMode === 'CONNECTED' && (
          <div className="w-full h-full flex items-center justify-center bg-slate-950">
            {streamUrl ? (
              <video
                src={streamUrl}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-6 bg-slate-900/90 rounded-lg border border-slate-700 max-w-md">
                <Video className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
                <h4 className="text-base font-bold text-white mb-1">External Stream Configured</h4>
                <p className="text-xs text-slate-400 mb-4">Awaiting RTSP/HLS stream URL or WebRTC gateway endpoint.</p>
                <button
                  onClick={() => setIsConfigOpen(true)}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
                >
                  Configure URL
                </button>
              </div>
            )}
          </div>
        )}

        {/* State 3: Disconnected Static Screen */}
        {feedMode === 'DISCONNECTED' && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#05070d] text-center p-6">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-400">
              <VideoOff className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-wider mb-1">NO OPTICAL SENSOR SIGNAL</h3>
            <p className="text-xs text-slate-400 max-w-md mb-6 font-mono">
              The forward gimbal camera link to {telemetry?.droneId || 'AV-01'} is inactive or disconnected. Switch to Synthetic Demo Fallback or verify MAVLink video pipeline.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setFeedMode('FALLBACK_SIMULATION')}
                className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                Switch to Demo Fallback
              </button>
              <button
                onClick={() => setFeedMode('CONNECTED')}
                className="px-4 py-2 rounded bg-[#162032] hover:bg-[#1e2a42] text-slate-200 border border-[#2b3a58] text-xs font-semibold transition-all"
              >
                Try External Stream
              </button>
            </div>
          </div>
        )}

        {/* AEROSPACE FLIGHT HUD OVERLAY (Rendered over active video) */}
        {feedMode !== 'DISCONNECTED' && (
          <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-10 font-mono">
            {/* Top HUD: Heading Tape & Optical Zoom */}
            <div className="flex items-start justify-between">
              {/* Left Vitals Box */}
              <div className="bg-[#0b101c]/80 backdrop-blur-md border border-cyan-500/30 rounded p-3 text-xs min-w-[200px]">
                <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold mb-1">Aircraft Telemetry</div>
                <div className="flex justify-between py-0.5 border-b border-slate-800">
                  <span className="text-slate-400">ALTITUDE:</span>
                  <span className="text-cyan-300 font-bold">{Math.round(telemetry?.altitudeMeters || 0)} m AGL</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800">
                  <span className="text-slate-400">GROUND SPEED:</span>
                  <span className="text-emerald-400 font-bold">{Math.round(telemetry?.groundSpeedKmh || 0)} km/h</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800">
                  <span className="text-slate-400">BATTERY:</span>
                  <span className="text-amber-300 font-bold">{telemetry?.batteryPercentage || 0}% ({telemetry?.batteryVoltage || 0}V)</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">GPS FIX:</span>
                  <span className="text-cyan-400 font-bold">{telemetry?.rtkFix || 'RTK_FIX'} ({telemetry?.satellites || 18} sats)</span>
                </div>
              </div>

              {/* Center: Heading Compass Indicator */}
              <div className="bg-[#0b101c]/85 backdrop-blur-md border border-cyan-500/40 rounded px-5 py-2 text-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">HEADING TAPE</div>
                <div className="text-xl font-extrabold text-cyan-300 tracking-wider">
                  {Math.round(telemetry?.headingDegrees || 0).toString().padStart(3, '0')}°
                </div>
                <div className="text-[10px] text-emerald-400 font-bold tracking-widest">
                  {getCompassOctant(telemetry?.headingDegrees || 0)}
                </div>
              </div>

              {/* Right: Active Checkpoint Mission Target */}
              <div className="bg-[#0b101c]/80 backdrop-blur-md border border-cyan-500/30 rounded p-3 text-xs min-w-[240px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">Active Checkpoint</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                    #{activeCheckpoint?.sequence || 1} / {totalCount}
                  </span>
                </div>
                <div className="font-bold text-sm text-white truncate mb-1">
                  {activeCheckpoint?.name || 'Awaiting Mission Checkpoints'}
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800 text-[11px]">
                  <span className="text-slate-400">ACTION:</span>
                  <span className="text-amber-300 font-bold uppercase">{activeCheckpoint?.action || 'transit'}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800 text-[11px]">
                  <span className="text-slate-400">RANGE TO TARGET:</span>
                  <span className="text-emerald-400 font-bold">{telemetry?.distanceToNextCheckpointMeters || 0} m</span>
                </div>
                {telemetry?.isDwellActive && (
                  <div className="mt-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold text-center border border-amber-500/40 animate-pulse">
                    HOLDING DWELL: {mission?.dwellRemainingSeconds || 0}s
                  </div>
                )}
              </div>
            </div>

            {/* Center Crosshair Reticle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-28 h-28 border border-cyan-500/30 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                <div className="absolute top-0 w-0.5 h-3 bg-cyan-400" />
                <div className="absolute bottom-0 w-0.5 h-3 bg-cyan-400" />
                <div className="absolute left-0 w-3 h-0.5 bg-cyan-400" />
                <div className="absolute right-0 w-3 h-0.5 bg-cyan-400" />
                <div className="absolute -top-5 text-[9px] text-cyan-400/80 font-mono tracking-widest">OPTICAL LOCK</div>
              </div>
            </div>

            {/* Bottom HUD: Progress Bar & Mission Controllers */}
            <div className="flex items-end justify-between">
              {/* Mission State Badge */}
              <div className="bg-[#0b101c]/80 backdrop-blur-md border border-cyan-500/30 rounded p-2.5 text-xs flex items-center gap-3">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest">Mission ID</div>
                  <div className="font-bold text-white text-xs">{mission?.id || 'MSN-TAS-01'}</div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest">Status</div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase ${
                    mission?.status === 'running' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                    mission?.status === 'paused' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                    mission?.status === 'completed' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
                    mission?.status === 'error' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {mission?.status || 'IDLE'}
                  </span>
                </div>
              </div>

              {/* Center Checkpoint Progress Track */}
              <div className="bg-[#0b101c]/85 backdrop-blur-md border border-cyan-500/40 rounded px-5 py-2 text-center min-w-[320px]">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-semibold">
                  <span>CHECKPOINT ROUTE PROGRESS</span>
                  <span className="text-cyan-300 font-bold">{mission?.progressPercent || 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${mission?.progressPercent || 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                  <span>Completed: {completedCount} / {totalCount}</span>
                  <span>Est. Remaining: {mission?.estimatedRemainingSeconds || 0}s</span>
                </div>
              </div>

              {/* Simulation Mini Flight Controls (Pointer events enabled) */}
              <div className="bg-[#0b101c]/90 backdrop-blur-md border border-cyan-500/40 rounded p-2 flex items-center gap-2 pointer-events-auto shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                <button
                  onClick={handleStartResume}
                  className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                    mission?.status === 'running'
                      ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  }`}
                >
                  {mission?.status === 'running' ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-black" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-black" />
                      <span>{mission?.status === 'paused' ? 'Resume' : 'Start'}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleReset}
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Reset to Checkpoint 1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Feed Configuration Drawer */}
      {isConfigOpen && (
        <div className="absolute top-12 right-0 bottom-0 w-80 bg-[#0d1322] border-l border-[#22314d] p-4 z-30 shadow-2xl flex flex-col justify-between font-sans">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-cyan-400" />
                <span>Camera Stream Source</span>
              </h4>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Select Feed Mode</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-2 rounded bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-cyan-500/50">
                    <input
                      type="radio"
                      name="feedMode"
                      value="FALLBACK_SIMULATION"
                      checked={feedMode === 'FALLBACK_SIMULATION'}
                      onChange={() => setFeedMode('FALLBACK_SIMULATION')}
                      className="mt-1 accent-cyan-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-amber-300">Demo Video Fallback (Simulation)</div>
                      <div className="text-[11px] text-slate-400">Deterministic forward-looking terrain & flight dynamics. Clearly labeled non-live feed.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-cyan-500/50">
                    <input
                      type="radio"
                      name="feedMode"
                      value="CONNECTED"
                      checked={feedMode === 'CONNECTED'}
                      onChange={() => setFeedMode('CONNECTED')}
                      className="mt-1 accent-cyan-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-emerald-300">External Live Stream URL</div>
                      <div className="text-[11px] text-slate-400">Stream HLS (.m3u8), RTSP-over-WebSocket, or HTTP MJPEG feed.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-cyan-500/50">
                    <input
                      type="radio"
                      name="feedMode"
                      value="DISCONNECTED"
                      checked={feedMode === 'DISCONNECTED'}
                      onChange={() => setFeedMode('DISCONNECTED')}
                      className="mt-1 accent-cyan-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-rose-300">Simulate Disconnected State</div>
                      <div className="text-[11px] text-slate-400">Verifies UI behavior when camera hardware link is severed.</div>
                    </div>
                  </label>
                </div>
              </div>

              {feedMode === 'CONNECTED' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Stream URL</label>
                  <input
                    type="text"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="https://.../stream.m3u8 or mp4"
                    className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <div className="text-[10px] text-slate-500 mt-1">Supports test MP4 or HLS media stream endpoints.</div>
                </div>
              )}

              <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">Active Sensor Pipeline:</div>
                <div>Sensor: Sony IMX477 1/2.3" CMOS</div>
                <div>Gimbal: 3-Axis Brushless RTK Stabilized</div>
                <div>FOV: 84° Wide Horizontal</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800">
            <button
              onClick={() => setIsConfigOpen(false)}
              className="w-full py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
            >
              Apply & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function getCompassOctant(deg: number): string {
  const normalized = (deg % 360 + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'N (000°)';
  if (normalized < 67.5) return 'NE (045°)';
  if (normalized < 112.5) return 'E (090°)';
  if (normalized < 157.5) return 'SE (135°)';
  if (normalized < 202.5) return 'S (180°)';
  if (normalized < 247.5) return 'SW (225°)';
  if (normalized < 292.5) return 'W (270°)';
  return 'NW (315°)';
}
