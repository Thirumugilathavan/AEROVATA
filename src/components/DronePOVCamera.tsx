import React, { useEffect, useRef, useState } from 'react';
import { 
  ArrowLeft, 
  Camera, 
  ZoomIn, 
  ZoomOut, 
  Sun, 
  Moon, 
  Flame, 
  Maximize2, 
  Compass, 
  Radio, 
  Crosshair, 
  Battery, 
  Navigation 
} from 'lucide-react';
import { Drone } from '../types/fleet';
import { getDistanceMeters, formatWaypointDistance } from '../services/telemetryEngine';

interface DronePOVCameraProps {
  drone: Drone;
  onExit: () => void;
}

export const DronePOVCamera: React.FC<DronePOVCameraProps> = ({ drone, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [visionMode, setVisionMode] = useState<'rgb' | 'flir' | 'nvg'>('rgb');
  const [isCrosshairLocked, setIsCrosshairLocked] = useState<boolean>(true);
  const [streamFailed, setStreamFailed] = useState<boolean>(false);
  const backendStreamUrl = `http://localhost:8000/api/v1/drones/${drone.id}/stream`;

  // Next waypoint target
  const targetIdx = drone.targetWaypointIndex !== undefined
    ? drone.targetWaypointIndex
    : (drone.currentWaypointIndex === 0 && drone.route.length > 1 ? 1 : drone.currentWaypointIndex);
  const nextWp = drone.route[targetIdx] || drone.route[drone.route.length - 1];
  const distToNextMeters = drone.distanceToNextWaypointMeters !== undefined
    ? drone.distanceToNextWaypointMeters
    : (nextWp ? Math.round(getDistanceMeters(drone.vitals.latitude, drone.vitals.longitude, nextWp.lat, nextWp.lng)) : 0);
  const formattedNextDist = formatWaypointDistance(distToNextMeters);

  // Real-time canvas animation for forward gimbal view
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let offset = 0;

    const render = () => {
      offset = (offset + (drone.vitals.groundSpeedKmh / 3600) * 120) % 80;

      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear background
      ctx.clearRect(0, 0, width, height);

      // Sky and ground split (Horizon based on pitch angle, banking based on heading variation)
      const horizonY = height * 0.45;

      // Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      if (visionMode === 'flir') {
        skyGrad.addColorStop(0, '#0a0d24');
        skyGrad.addColorStop(1, '#1e1a38');
      } else if (visionMode === 'nvg') {
        skyGrad.addColorStop(0, '#001a08');
        skyGrad.addColorStop(1, '#003310');
      } else {
        skyGrad.addColorStop(0, '#10223b');
        skyGrad.addColorStop(1, '#2c4b6e');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, horizonY);

      // Ground Gradient (Perspective flight plane)
      const groundGrad = ctx.createLinearGradient(0, horizonY, 0, height);
      if (visionMode === 'flir') {
        groundGrad.addColorStop(0, '#2d1847');
        groundGrad.addColorStop(0.5, '#4a154b');
        groundGrad.addColorStop(1, '#f97316'); // Heat map
      } else if (visionMode === 'nvg') {
        groundGrad.addColorStop(0, '#023012');
        groundGrad.addColorStop(1, '#056126');
      } else {
        groundGrad.addColorStop(0, '#1b321a'); // Dark lush foliage
        groundGrad.addColorStop(1, '#2d4a2a');
      }
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, horizonY, width, height - horizonY);

      // Perspective Grid Lines (Ground moving underneath)
      ctx.save();
      ctx.strokeStyle = visionMode === 'flir' ? 'rgba(249, 115, 22, 0.35)' : visionMode === 'nvg' ? 'rgba(34, 197, 94, 0.45)' : 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;

      // Vanishing point
      const vpX = width / 2;
      const vpY = horizonY;

      // Perspective radial rays
      for (let x = -width; x <= width * 2; x += 120) {
        ctx.beginPath();
        ctx.moveTo(vpX, vpY);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Moving transverse depth lines
      for (let y = horizonY + 15; y < height; y += (y - horizonY) * 0.45) {
        const adjustedY = y + (offset * ((y - horizonY) / height));
        if (adjustedY <= height) {
          ctx.beginPath();
          ctx.moveTo(0, adjustedY);
          ctx.lineTo(width, adjustedY);
          ctx.stroke();
        }
      }

      // Simulated 3D structures / buildings in the field of view
      const buildingColor = visionMode === 'flir' ? '#ffedd5' : visionMode === 'nvg' ? '#4ade80' : '#475569';
      ctx.fillStyle = buildingColor;

      // Central target building (Waypoint destination)
      const targetBldgX = width * 0.52 - 30;
      const targetBldgY = horizonY + 25;
      ctx.fillRect(targetBldgX, targetBldgY, 60, 45);

      // Distant tree cluster
      ctx.fillStyle = visionMode === 'flir' ? '#fbbf24' : visionMode === 'nvg' ? '#15803d' : '#1e3a1e';
      ctx.beginPath();
      ctx.arc(width * 0.35, horizonY + 35, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [drone.vitals.groundSpeedKmh, visionMode]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex flex-col select-none">
      {/* Live Video Stream or Simulated Canvas Fallback */}
      {!streamFailed ? (
        <img
          src={backendStreamUrl}
          alt={`Live Stream ${drone.callsign}`}
          onError={() => setStreamFailed(true)}
          className="w-full h-full object-cover select-none"
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease-out' }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full h-full object-cover"
        />
      )}

      {/* Vision Mode Filter Overlay */}
      {visionMode === 'flir' && (
        <div className="absolute inset-0 bg-amber-500/10 mix-blend-color pointer-events-none" />
      )}
      {visionMode === 'nvg' && (
        <div className="absolute inset-0 bg-emerald-500/15 mix-blend-color-dodge pointer-events-none" />
      )}

      {/* CRT Scanlines Overlay */}
      <div className="absolute inset-0 scanlines pointer-events-none" />

      {/* Top Bar: Return to Map & Sensor Identification */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          {/* Prominent Return Button per specs */}
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#0e1422]/90 hover:bg-cyan-900/60 text-white border border-cyan-400 rounded-md text-xs font-bold font-mono tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>RETURN TO 2D / 3D MAP</span>
          </button>

          {/* Sensor Feed Badge */}
          <div className="bg-[#0e1422]/90 border border-slate-700 px-3 py-1.5 rounded-md text-xs font-mono text-slate-300 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
            <span className="font-bold text-white uppercase">{drone.callsign}</span>
            <span className="text-slate-500">|</span>
            <span className="text-cyan-400 font-bold">SYNTHETIC BVLOS GIMBAL CAMERA</span>
          </div>
        </div>

        {/* Vision Mode & Camera Controls */}
        <div className="flex items-center gap-2 bg-[#0e1422]/90 border border-slate-700 p-1 rounded-md text-xs font-mono">
          <button
            onClick={() => setVisionMode('rgb')}
            className={`px-2.5 py-1 rounded transition-colors ${visionMode === 'rgb' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            title="Daylight Optical RGB"
          >
            RGB DAY
          </button>
          <button
            onClick={() => setVisionMode('flir')}
            className={`px-2.5 py-1 rounded transition-colors ${visionMode === 'flir' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            title="FLIR Thermal Infrared"
          >
            FLIR IR
          </button>
          <button
            onClick={() => setVisionMode('nvg')}
            className={`px-2.5 py-1 rounded transition-colors ${visionMode === 'nvg' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            title="Night Vision Phosphor"
          >
            NVG GREEN
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1"></div>

          {/* Zoom Buttons */}
          <div className="flex items-center gap-1">
            {[1, 2, 4].map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${zoom === z ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {z}X
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* HUD OVERLAY: Heading Compass Tape at Top */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none select-none">
        <div className="w-80 h-8 border-b-2 border-cyan-400/80 flex items-center justify-center relative overflow-hidden bg-black/40 backdrop-blur-sm px-4">
          {/* Compass marker */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-rose-500"></div>
          <div className="flex items-center gap-8 text-[11px] font-mono font-bold text-cyan-300">
            <span>{((drone.vitals.headingDegrees - 30 + 360) % 360).toString().padStart(3, '0')}°</span>
            <span className="text-white text-xs font-extrabold">{drone.vitals.headingDegrees.toString().padStart(3, '0')}°</span>
            <span>{((drone.vitals.headingDegrees + 30) % 360).toString().padStart(3, '0')}°</span>
          </div>
        </div>
        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-rose-500"></div>
      </div>

      {/* HUD OVERLAY: Airspeed Tape on Left */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2 pointer-events-none select-none">
        <div className="bg-black/60 border border-cyan-500/60 p-2 rounded text-right font-mono">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">AIRSPEED</div>
          <div className="text-xl font-extrabold text-white">
            {Math.round(drone.vitals.groundSpeedKmh)}
          </div>
          <div className="text-[9px] text-cyan-400">KM/H</div>
        </div>
        {/* Speed Ladder Gauge */}
        <div className="w-2 h-44 bg-slate-900 border border-slate-700 rounded-full overflow-hidden flex flex-col justify-end">
          <div
            className="w-full bg-cyan-400 transition-all duration-300"
            style={{ height: `${Math.min(100, (drone.vitals.groundSpeedKmh / 80) * 100)}%` }}
          />
        </div>
      </div>

      {/* HUD OVERLAY: Altitude Tape on Right */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2 pointer-events-none select-none">
        {/* Altitude Ladder Gauge */}
        <div className="w-2 h-44 bg-slate-900 border border-slate-700 rounded-full overflow-hidden flex flex-col justify-end">
          <div
            className="w-full bg-emerald-400 transition-all duration-300"
            style={{ height: `${Math.min(100, (drone.vitals.altitudeMeters / 150) * 100)}%` }}
          />
        </div>
        <div className="bg-black/60 border border-emerald-500/60 p-2 rounded text-left font-mono">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">ALTITUDE</div>
          <div className="text-xl font-extrabold text-white">
            {Math.round(drone.vitals.altitudeMeters)}
          </div>
          <div className="text-[9px] text-emerald-400">M AGL</div>
        </div>
      </div>

      {/* HUD OVERLAY: Center Reticle / Artificial Horizon & Waypoint Lock */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none select-none flex flex-col items-center">
        {/* Artificial Horizon Pitch Ladder */}
        <div className="w-48 h-px bg-cyan-400/80 mb-2 flex justify-between">
          <span className="text-[9px] font-mono text-cyan-400 -mt-2.5">- 10°</span>
          <span className="text-[9px] font-mono text-cyan-400 -mt-2.5">10° -</span>
        </div>

        {/* Center Crosshairs */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="w-full h-px bg-cyan-400/60"></div>
          <div className="absolute h-full w-px bg-cyan-400/60"></div>
          <div className="absolute w-10 h-10 border border-cyan-400/80 rounded-full"></div>
          <div className="absolute w-2 h-2 rounded-full bg-cyan-400"></div>

          {/* Waypoint Optical Target Box */}
          <div className="absolute -top-12 px-2 py-0.5 bg-emerald-950/80 border border-emerald-400 text-emerald-300 text-[10px] font-mono font-bold whitespace-nowrap rounded animate-pulse">
            WP LOCK: {nextWp.name.toUpperCase()} ({formattedNextDist})
          </div>
        </div>

        <div className="w-48 h-px bg-cyan-400/80 mt-2 flex justify-between">
          <span className="text-[9px] font-mono text-cyan-400 -mt-2.5">- 10°</span>
          <span className="text-[9px] font-mono text-cyan-400 -mt-2.5">10° -</span>
        </div>
      </div>

      {/* Bottom Telemetry Strip */}
      <div className="absolute bottom-4 left-6 right-6 z-20 flex items-center justify-between bg-black/75 backdrop-blur-md px-4 py-2 rounded-md border border-slate-700 text-xs font-mono text-slate-300 pointer-events-auto">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Battery className="w-4 h-4 text-emerald-400" />
            <span className="text-white font-bold">{Math.round(drone.vitals.batteryPercentage)}%</span>
            <span className="text-[10px] text-slate-400">({drone.vitals.estimatedFlightTimeMinutes} min rem)</span>
          </div>

          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>RSSI: {drone.vitals.signalStrengthDbm} dBm</span>
            <span className="text-emerald-400 font-bold">({drone.vitals.signalQualityPercent}%)</span>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Navigation className="w-4 h-4 text-amber-400" />
            <span>RTK FIX: {drone.vitals.satellites} SATS</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-slate-400">
            LAT: {drone.vitals.latitude.toFixed(6)} | LON: {drone.vitals.longitude.toFixed(6)}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase">
            SIMULATED SENSOR
          </span>
        </div>
      </div>
    </div>
  );
};
