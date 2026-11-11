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
import { calculateBearing } from '../services/droneAStarRouter';

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

  // ─── Real-time Physics-Synchronized Gimbal Camera Animation ───
  const cameraPhysicsRef = useRef({
    smoothHeading: drone.vitals.headingDegrees || 0,
    smoothPitch: 0,
    smoothRoll: 0,
    smoothAltitude: drone.vitals.altitudeMeters || 60,
    smoothSpeed: drone.vitals.groundSpeedKmh || 0,
    worldDistanceMeters: 0,
    prevHeading: drone.vitals.headingDegrees || 0,
    lastTime: performance.now(),
    prevDroneId: drone.id,
  });

  useEffect(() => {
    const phys = cameraPhysicsRef.current;
    if (phys.prevDroneId !== drone.id) {
      phys.prevDroneId = drone.id;
      phys.prevHeading = drone.vitals.headingDegrees || 0;
    }
  }, [drone.id, drone.vitals.headingDegrees]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const phys = cameraPhysicsRef.current;
    phys.lastTime = performance.now();

    const URBAN_CORRIDOR_LANDMARKS = [
      { id: 'b1', x: -130, zBase: 0, w: 55, h: 42, color: '#1e293b', accent: '#00f0ff' },
      { id: 'b2', x: 140, zBase: 80, w: 75, h: 58, color: '#0f172a', accent: '#38bdf8' },
      { id: 'b3', x: -150, zBase: 160, w: 68, h: 46, color: '#1e293b', accent: '#3b82f6' },
      { id: 'b4', x: 135, zBase: 240, w: 70, h: 52, color: '#0f172a', accent: '#10b981' },
      { id: 'b5', x: -125, zBase: 320, w: 60, h: 38, color: '#1e293b', accent: '#00f0ff' },
    ];

    const render = () => {
      const now = performance.now();
      const dt = Math.max(0.005, Math.min(0.05, (now - phys.lastTime) / 1000));
      phys.lastTime = now;

      const targetHeading = drone.vitals.headingDegrees || 0;
      const targetSpeed = drone.vitals.groundSpeedKmh || 0;
      const targetAlt = drone.vitals.altitudeMeters || 60;
      const climbRate = drone.vitals.verticalSpeedMs || 0;

      // 1. Heading interpolation (shortest angular path)
      let dHeading = (targetHeading - phys.smoothHeading) % 360;
      if (dHeading > 180) dHeading -= 360;
      if (dHeading < -180) dHeading += 360;
      phys.smoothHeading = (phys.smoothHeading + dHeading * Math.min(1, dt * 5.0) + 360) % 360;

      // Turn rate & banking
      const turnRate = dHeading / Math.max(0.01, dt);
      const targetRoll = Math.max(-12, Math.min(12, -turnRate * 0.32 * Math.min(1, Math.max(0.1, targetSpeed / 15))));
      phys.smoothRoll += (targetRoll - phys.smoothRoll) * Math.min(1, dt * 6.5);

      // Pitch dynamics
      const targetPitch = Math.max(-7, Math.min(7, (targetSpeed / 60) * 3.0 - climbRate * 2.2));
      phys.smoothPitch += (targetPitch - phys.smoothPitch) * Math.min(1, dt * 5.5);

      // Smoothing
      phys.smoothAltitude += (targetAlt - phys.smoothAltitude) * Math.min(1, dt * 4.5);
      phys.smoothSpeed += (targetSpeed - phys.smoothSpeed) * Math.min(1, dt * 5.5);
      phys.worldDistanceMeters += (phys.smoothSpeed / 3.6) * dt;

      const width = canvas.width;
      const height = canvas.height;

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      const focalLength = 320 * zoom;
      const horizonY = height * (0.42 + (Math.max(20, Math.min(120, phys.smoothAltitude)) / 120) * 0.06) + phys.smoothPitch * 3.5;
      const rollRad = phys.smoothRoll * (Math.PI / 180);

      // Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      if (visionMode === 'flir') {
        skyGrad.addColorStop(0, '#070a1a');
        skyGrad.addColorStop(1, '#1b1430');
      } else if (visionMode === 'nvg') {
        skyGrad.addColorStop(0, '#001406');
        skyGrad.addColorStop(1, '#00290c');
      } else {
        skyGrad.addColorStop(0, '#050c18');
        skyGrad.addColorStop(1, '#14233c');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, horizonY);

      // Ground Gradient
      const groundGrad = ctx.createLinearGradient(0, horizonY, 0, height);
      if (visionMode === 'flir') {
        groundGrad.addColorStop(0, '#261238');
        groundGrad.addColorStop(0.5, '#421444');
        groundGrad.addColorStop(1, '#ea580c');
      } else if (visionMode === 'nvg') {
        groundGrad.addColorStop(0, '#02240e');
        groundGrad.addColorStop(1, '#044d1e');
      } else {
        groundGrad.addColorStop(0, '#0a121c');
        groundGrad.addColorStop(1, '#121b28');
      }
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, horizonY, width, height - horizonY);

      // Perspective Air Corridor
      ctx.save();
      ctx.translate(width / 2, horizonY);
      ctx.rotate(rollRad);

      const corridorWidthTop = 45 * zoom;
      const corridorWidthBottom = 460 * zoom;

      ctx.fillStyle = visionMode === 'flir' ? '#331d47' : visionMode === 'nvg' ? '#062913' : '#141d2c';
      ctx.beginPath();
      ctx.moveTo(-corridorWidthTop, 0);
      ctx.lineTo(corridorWidthTop, 0);
      ctx.lineTo(corridorWidthBottom, height - horizonY);
      ctx.lineTo(-corridorWidthBottom, height - horizonY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = visionMode === 'flir' ? '#f59e0b' : visionMode === 'nvg' ? '#22c55e' : '#00f0ffaa';
      ctx.lineWidth = 2 * zoom;
      ctx.stroke();

      // Ground depth lines
      const gridInterval = 30;
      const distOffset = phys.worldDistanceMeters % gridInterval;
      ctx.strokeStyle = visionMode === 'flir' ? 'rgba(245,158,11,0.2)' : visionMode === 'nvg' ? 'rgba(34,197,94,0.25)' : 'rgba(0,240,255,0.2)';
      ctx.lineWidth = 1;
      for (let z = 15; z < 320; z += gridInterval) {
        const lineZ = z - distOffset;
        if (lineZ > 8) {
          const depthY = (focalLength * 12) / lineZ;
          if (depthY < height - horizonY) {
            const spanX = corridorWidthTop + (depthY / (height - horizonY)) * (corridorWidthBottom - corridorWidthTop);
            ctx.beginPath();
            ctx.moveTo(-spanX, depthY);
            ctx.lineTo(spanX, depthY);
            ctx.stroke();
          }
        }
      }

      // Center dashes
      ctx.fillStyle = visionMode === 'flir' ? '#fed7aa' : visionMode === 'nvg' ? '#86efac' : '#ffffff';
      const dashInterval = 25;
      const dashOffset = phys.worldDistanceMeters % dashInterval;
      for (let z = 12; z < 300; z += dashInterval) {
        const dZ = z - dashOffset;
        if (dZ > 6) {
          const depthY = (focalLength * 12) / dZ;
          if (depthY < height - horizonY) {
            const dW = Math.max(3, (depthY / 28) * zoom);
            const dH = Math.max(6, (depthY / 18) * zoom);
            ctx.fillRect(-dW / 2, depthY, dW, dH);
          }
        }
      }

      // Parallax 3D Urban Buildings
      const loopLen = 380;
      for (const b of URBAN_CORRIDOR_LANDMARKS) {
        const relZ = ((b.zBase - phys.worldDistanceMeters) % loopLen + loopLen) % loopLen;
        if (relZ > 12) {
          const scale = focalLength / relZ;
          const bldgScreenX = b.x * scale;
          const bldgBottomY = (focalLength * 12) / relZ;
          const bldgW = b.w * scale * zoom;
          const bldgH = b.h * scale * zoom;
          const bldgTopY = bldgBottomY - bldgH;

          ctx.fillStyle = visionMode === 'flir' ? '#ffedd5' : visionMode === 'nvg' ? '#86efac' : b.color;
          ctx.strokeStyle = visionMode === 'flir' ? '#f97316' : visionMode === 'nvg' ? '#22c55e' : b.accent;
          ctx.lineWidth = 1.2;
          ctx.fillRect(bldgScreenX - bldgW / 2, bldgTopY, bldgW, bldgH);
          ctx.strokeRect(bldgScreenX - bldgW / 2, bldgTopY, bldgW, bldgH);

          // Rooftop hazard beacon
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(bldgScreenX, bldgTopY - 2, Math.max(2, 4 * scale), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // Active Waypoint Reticle
      if (nextWp) {
        const wpBearing = calculateBearing(drone.vitals.latitude, drone.vitals.longitude, nextWp.lat, nextWp.lng);
        let relAngle = (wpBearing - phys.smoothHeading) % 360;
        if (relAngle > 180) relAngle -= 360;
        if (relAngle < -180) relAngle += 360;

        if (Math.abs(relAngle) < 38) {
          const wpX = (width / 2) + Math.tan(relAngle * Math.PI / 180) * (width * 0.85) * zoom;
          const wpY = horizonY - 26;

          ctx.save();
          ctx.translate(wpX, wpY);

          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(0, -14);
          ctx.lineTo(14, 0);
          ctx.lineTo(0, 14);
          ctx.lineTo(-14, 0);
          ctx.closePath();
          ctx.stroke();

          ctx.fillStyle = 'rgba(8, 20, 36, 0.88)';
          ctx.strokeStyle = '#00f0ff88';
          ctx.lineWidth = 1;
          const boxW = 148;
          const boxH = 34;
          ctx.fillRect(-boxW / 2, -54, boxW, boxH);
          ctx.strokeRect(-boxW / 2, -54, boxW, boxH);

          ctx.fillStyle = '#00f0ff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`WP-${targetIdx + 1} ${nextWp.name.substring(0, 14)}`, 0, -42);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`RNG: ${formattedNextDist} • ALT: ${nextWp.altitudeMeters}m`, 0, -28);

          ctx.restore();
        }
      }

      // Clear Simulated Sensor Badges
      ctx.fillStyle = 'rgba(10, 16, 28, 0.82)';
      ctx.strokeStyle = '#38bdf844';
      ctx.lineWidth = 1;
      ctx.fillRect(16, 16, 280, 26);
      ctx.strokeRect(16, 16, 280, 26);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('[SIMULATED 3D SENSOR VIEW — POV GIMBAL]', 24, 32);

      ctx.fillStyle = 'rgba(10, 16, 28, 0.82)';
      ctx.strokeStyle = '#f59e0b44';
      ctx.lineWidth = 1;
      ctx.fillRect(width - 296, 16, 280, 26);
      ctx.strokeRect(width - 296, 16, 280, 26);
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('[SYNTHETIC GIMBAL FEED • NOT REAL FOOTAGE]', width - 288, 32);

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [drone.id, drone.vitals.groundSpeedKmh, drone.vitals.headingDegrees, drone.vitals.altitudeMeters, drone.vitals.verticalSpeedMs, visionMode, zoom, nextWp, targetIdx, formattedNextDist]);

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
