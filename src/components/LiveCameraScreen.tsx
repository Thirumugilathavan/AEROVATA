/**
 * Live Camera Screen (/live-camera)
 * AEROVATA by TASPORA - Autonomous Drone Delivery Command Center
 * 
 * Synchronized multi-drone FPV camera interface supporting:
 * 1. Synchronized drone selection (DRONE 01, DRONE 02, DRONE 03, DRONE 04).
 * 2. Real-time backend MJPEG video stream (http://localhost:8000/api/v1/drones/{droneId}/stream).
 * 3. Gazebo SITL / External WebRTC / RTSP stream adapter.
 * 4. High-fidelity Tactical 3D FPV gimbal viewport with RGB, FLIR Thermal IR, and NVG modes.
 * 5. Complete aerospace HUD with pitch ladder, heading tape, speed/altitude tapes, and waypoint target lock.
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
  ArrowLeft,
  Navigation,
  Sun,
  Moon,
  Flame,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { QuadcopterIcon } from './icons/QuadcopterIcon';
import type { Mission, MissionTelemetry, CameraConnectionStatus } from '../types/mission';
import type { Drone } from '../types/fleet';
import { INITIAL_DRONES } from '../data/mockFleet';
import { apiService } from '../services/api/index';
import { getDistanceMeters, formatWaypointDistance } from '../services/telemetryEngine';
import { calculateBearing } from '../services/droneAStarRouter';

interface LiveCameraScreenProps {
  onBackToMap?: () => void;
  drones?: Drone[];
  selectedDroneId?: string | null;
  onSelectDrone?: (id: string) => void;
  onPauseResume?: (droneId: string) => void;
  onTriggerRTB?: (droneId: string) => void;
}

type StreamMode = 'LIVE_BACKEND' | 'GAZEBO_EXTERNAL' | 'TACTICAL_3D_FPV' | 'DISCONNECTED';

export const LiveCameraScreen: React.FC<LiveCameraScreenProps> = ({ 
  onBackToMap,
  drones = [],
  selectedDroneId = 'AV-01',
  onSelectDrone,
  onPauseResume,
  onTriggerRTB,
}) => {
  const controller = apiService.getController();
  const [mission, setMission] = useState<Mission | null>(() => controller.getMission());
  const [telemetry, setTelemetry] = useState<MissionTelemetry | null>(() => controller.getTelemetry());

  // Selected drone state with fallback to initial fleet
  const [internalDroneId, setInternalDroneId] = useState<string>(selectedDroneId || 'AV-01');
  const effectiveDroneId = selectedDroneId || internalDroneId;
  const effectiveDrones = (drones && drones.length > 0) ? drones : INITIAL_DRONES;
  const activeDrone = effectiveDrones.find((d) => d.id === effectiveDroneId) || effectiveDrones[0] || null;

  const handleSelectDrone = (id: string) => {
    setInternalDroneId(id);
    if (onSelectDrone) onSelectDrone(id);
  };

  // Camera stream feed mode
  const [feedMode, setFeedMode] = useState<StreamMode>('LIVE_BACKEND');
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [backendStreamFailed, setBackendStreamFailed] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [visionMode, setVisionMode] = useState<'rgb' | 'flir' | 'nvg'>('rgb');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Dynamic canvas animation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Reset stream error on drone change
  useEffect(() => {
    setBackendStreamFailed(false);
  }, [selectedDroneId]);

  // Subscribe to controller telemetry ticks
  useEffect(() => {
    const unsubscribe = controller.subscribe((updatedMission, updatedTelemetry) => {
      setMission({ ...updatedMission });
      setTelemetry({ ...updatedTelemetry });
    });
    return () => unsubscribe();
  }, [controller]);

  // Derive vitals from active drone or fallback telemetry
  const heading = activeDrone?.vitals.headingDegrees ?? telemetry?.headingDegrees ?? 246;
  const speed = activeDrone?.vitals.groundSpeedKmh ?? telemetry?.groundSpeedKmh ?? 48.5;
  const altitude = activeDrone?.vitals.altitudeMeters ?? telemetry?.altitudeMeters ?? 65;
  const battery = activeDrone?.vitals.batteryPercentage ?? telemetry?.batteryPercentage ?? 92;
  const batteryVoltage = activeDrone?.vitals.batteryVoltage ?? telemetry?.batteryVoltage ?? 24.8;
  const gpsFix = activeDrone?.vitals.gpsFix ?? telemetry?.rtkFix ?? 'RTK_FIX';
  const satellites = activeDrone?.vitals.satellites ?? telemetry?.satellites ?? 22;

  // Next waypoint calculation
  const targetIdx = activeDrone?.targetWaypointIndex !== undefined
    ? activeDrone.targetWaypointIndex
    : (activeDrone ? (activeDrone.currentWaypointIndex === 0 && activeDrone.route && activeDrone.route.length > 1 ? 1 : activeDrone.currentWaypointIndex) : 1);
  const nextWaypoint = activeDrone?.route?.[targetIdx] || (activeDrone?.route && activeDrone.route[activeDrone.route.length - 1]);
  const distToNextWp = activeDrone?.distanceToNextWaypointMeters !== undefined
    ? activeDrone.distanceToNextWaypointMeters
    : (activeDrone && nextWaypoint
        ? Math.round(getDistanceMeters(activeDrone.vitals.latitude, activeDrone.vitals.longitude, nextWaypoint.lat, nextWaypoint.lng))
        : 340);
  const formattedNextDist = formatWaypointDistance(distToNextWp);

  // ─── High-Fidelity Physics-Synchronized 3D Gimbal Viewport ───
  const cameraPhysicsRef = useRef({
    smoothHeading: heading,
    smoothPitch: 0,
    smoothRoll: 0,
    smoothAltitude: altitude,
    smoothSpeed: speed,
    worldDistanceMeters: 0,
    prevHeading: heading,
    lastTime: performance.now(),
    prevDroneId: selectedDroneId,
  });

  // Keep physics ref updated when drone switches or route changes
  useEffect(() => {
    const phys = cameraPhysicsRef.current;
    if (phys.prevDroneId !== selectedDroneId) {
      phys.prevDroneId = selectedDroneId;
      phys.prevHeading = heading;
    }
  }, [selectedDroneId, heading]);

  useEffect(() => {
    if (feedMode !== 'TACTICAL_3D_FPV' && (!backendStreamFailed || feedMode !== 'LIVE_BACKEND')) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const phys = cameraPhysicsRef.current;
    phys.lastTime = performance.now();

    // Urban landmarks along corridor (dynamic parallax buildings)
    const URBAN_CORRIDOR_LANDMARKS = [
      { id: 'b1', x: -140, zBase: 0, w: 55, h: 42, color: '#1e293b', accent: '#00f0ff', name: 'PSG Robotics Wing' },
      { id: 'b2', x: 135, zBase: 75, w: 75, h: 58, color: '#0f172a', accent: '#38bdf8', name: 'TIDEL Park IT SEZ' },
      { id: 'b3', x: -160, zBase: 160, w: 68, h: 46, color: '#1e293b', accent: '#3b82f6', name: 'Peelamedu Tech Core' },
      { id: 'b4', x: 140, zBase: 240, w: 70, h: 52, color: '#0f172a', accent: '#10b981', name: 'KMCH Speciality Helipad' },
      { id: 'b5', x: -130, zBase: 310, w: 60, h: 38, color: '#1e293b', accent: '#00f0ff', name: 'Nava India Hub' },
    ];

    const render = () => {
      const now = performance.now();
      const dt = Math.max(0.005, Math.min(0.05, (now - phys.lastTime) / 1000));
      phys.lastTime = now;

      // 1. Heading interpolation (shortest angular path)
      let dHeading = (heading - phys.smoothHeading) % 360;
      if (dHeading > 180) dHeading -= 360;
      if (dHeading < -180) dHeading += 360;
      phys.smoothHeading = (phys.smoothHeading + dHeading * Math.min(1, dt * 5.0) + 360) % 360;

      // Turning angular velocity (degrees/sec)
      const turnRate = dHeading / Math.max(0.01, dt);

      // 2. Aerodynamic banking (roll angle into turns)
      const targetRoll = Math.max(-12, Math.min(12, -turnRate * 0.32 * Math.min(1, Math.max(0.1, speed / 15))));
      phys.smoothRoll += (targetRoll - phys.smoothRoll) * Math.min(1, dt * 6.5);

      // 3. Pitch dynamics (nose tilt based on cruise speed & vertical speed)
      const climbRate = activeDrone?.vitals.verticalSpeedMs || 0;
      const targetPitch = Math.max(-7, Math.min(7, (speed / 60) * 3.0 - climbRate * 2.2));
      phys.smoothPitch += (targetPitch - phys.smoothPitch) * Math.min(1, dt * 5.5);

      // 4. Altitude & Speed smoothing
      phys.smoothAltitude += (altitude - phys.smoothAltitude) * Math.min(1, dt * 4.5);
      phys.smoothSpeed += (speed - phys.smoothSpeed) * Math.min(1, dt * 5.5);

      // 5. Continuous metric distance accumulation
      phys.worldDistanceMeters += (phys.smoothSpeed / 3.6) * dt;

      const width = canvas.width;
      const height = canvas.height;

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // Camera focal length & horizon placement
      const focalLength = 320 * zoomLevel;
      const horizonY = height * (0.42 + (Math.max(20, Math.min(120, phys.smoothAltitude)) / 120) * 0.06) + phys.smoothPitch * 3.5;
      const rollRad = phys.smoothRoll * (Math.PI / 180);

      // ─── 1. SKY GRADIENT ───
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

      // ─── 2. GROUND GRADIENT ───
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

      // ─── 3. PERSPECTIVE AIR CORRIDOR & GROUND RUNWAY ───
      ctx.save();
      ctx.translate(width / 2, horizonY);
      ctx.rotate(rollRad);

      const corridorWidthTop = 45 * zoomLevel;
      const corridorWidthBottom = 460 * zoomLevel;

      // Flight corridor surface
      ctx.fillStyle = visionMode === 'flir' ? '#331d47' : visionMode === 'nvg' ? '#062913' : '#141d2c';
      ctx.beginPath();
      ctx.moveTo(-corridorWidthTop, 0);
      ctx.lineTo(corridorWidthTop, 0);
      ctx.lineTo(corridorWidthBottom, height - horizonY);
      ctx.lineTo(-corridorWidthBottom, height - horizonY);
      ctx.closePath();
      ctx.fill();

      // Border guidelines
      ctx.strokeStyle = visionMode === 'flir' ? '#f59e0b' : visionMode === 'nvg' ? '#22c55e' : '#00f0ffaa';
      ctx.lineWidth = 2 * zoomLevel;
      ctx.stroke();

      // Perspective ground grid depth lines (continuous speed-synchronized)
      const gridIntervalMeters = 30;
      const distOffset = phys.worldDistanceMeters % gridIntervalMeters;
      ctx.strokeStyle = visionMode === 'flir' ? 'rgba(245,158,11,0.2)' : visionMode === 'nvg' ? 'rgba(34,197,94,0.25)' : 'rgba(0,240,255,0.2)';
      ctx.lineWidth = 1;

      for (let z = 15; z < 320; z += gridIntervalMeters) {
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

      // Moving center road dashes
      ctx.fillStyle = visionMode === 'flir' ? '#fed7aa' : visionMode === 'nvg' ? '#86efac' : '#ffffff';
      const dashInterval = 25;
      const dashOffset = phys.worldDistanceMeters % dashInterval;
      for (let z = 12; z < 300; z += dashInterval) {
        const dZ = z - dashOffset;
        if (dZ > 6) {
          const depthY = (focalLength * 12) / dZ;
          if (depthY < height - horizonY) {
            const dW = Math.max(3, (depthY / 28) * zoomLevel);
            const dH = Math.max(6, (depthY / 18) * zoomLevel);
            ctx.fillRect(-dW / 2, depthY, dW, dH);
          }
        }
      }

      // ─── 4. PARALLAX 3D URBAN BUILDINGS ON CORRIDOR FLANKS ───
      const corridorLoop = 380;
      for (const bldg of URBAN_CORRIDOR_LANDMARKS) {
        let relZ = ((bldg.zBase - phys.worldDistanceMeters) % corridorLoop + corridorLoop) % corridorLoop;
        if (relZ > 12) {
          const scale = focalLength / relZ;
          const bldgScreenX = bldg.x * scale;
          const bldgBottomY = (focalLength * 12) / relZ;
          const bldgW = bldg.w * scale * zoomLevel;
          const bldgH = bldg.h * scale * zoomLevel;
          const bldgTopY = bldgBottomY - bldgH;

          // Building facade
          ctx.fillStyle = visionMode === 'flir' ? '#ffedd5' : visionMode === 'nvg' ? '#86efac' : bldg.color;
          ctx.strokeStyle = visionMode === 'flir' ? '#f97316' : visionMode === 'nvg' ? '#22c55e' : bldg.accent;
          ctx.lineWidth = 1.2;
          ctx.fillRect(bldgScreenX - bldgW / 2, bldgTopY, bldgW, bldgH);
          ctx.strokeRect(bldgScreenX - bldgW / 2, bldgTopY, bldgW, bldgH);

          // Windows grid
          const winColor = visionMode === 'flir' ? '#fbbf24' : visionMode === 'nvg' ? '#4ade80' : `${bldg.accent}88`;
          ctx.fillStyle = winColor;
          const stepY = Math.max(4, bldgH / 6);
          const stepX = Math.max(4, bldgW / 4);
          for (let wy = bldgTopY + stepY; wy < bldgBottomY - 4; wy += stepY) {
            for (let wx = bldgScreenX - bldgW / 2 + stepX / 2; wx < bldgScreenX + bldgW / 2 - 2; wx += stepX) {
              ctx.fillRect(wx, wy, Math.max(2, stepX * 0.45), Math.max(2, stepY * 0.45));
            }
          }

          // Rooftop hazard beacon (red pulsing)
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(bldgScreenX, bldgTopY - 2, Math.max(2, 4 * scale), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore(); // restore roll/translate

      // ─── 5. SYNCHRONIZED WAYPOINT TARGET LOCK RETICLE IN 3D VIEWPORT ───
      if (nextWaypoint && activeDrone) {
        const wpBearing = calculateBearing(
          activeDrone.vitals.latitude,
          activeDrone.vitals.longitude,
          nextWaypoint.lat,
          nextWaypoint.lng
        );
        let relAngle = (wpBearing - phys.smoothHeading) % 360;
        if (relAngle > 180) relAngle -= 360;
        if (relAngle < -180) relAngle += 360;

        if (Math.abs(relAngle) < 38) {
          const wpX = (width / 2) + Math.tan(relAngle * Math.PI / 180) * (width * 0.85) * zoomLevel;
          const wpY = horizonY - 26;

          ctx.save();
          ctx.translate(wpX, wpY);

          // Diamond lock reticle
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(0, -14);
          ctx.lineTo(14, 0);
          ctx.lineTo(0, 14);
          ctx.lineTo(-14, 0);
          ctx.closePath();
          ctx.stroke();

          // Target Info Box
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
          ctx.fillText(`WP-${targetIdx + 1} ${nextWaypoint.name.substring(0, 14)}`, 0, -42);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`RNG: ${formattedNextDist} • ALT: ${nextWaypoint.altitudeMeters}m`, 0, -28);

          ctx.restore();
        }
      }

      // ─── 6. CLEAR SIMULATED SENSOR WATERMARK / BADGES ───
      // Top-Left Simulated Badge
      ctx.fillStyle = 'rgba(10, 16, 28, 0.82)';
      ctx.strokeStyle = '#38bdf844';
      ctx.lineWidth = 1;
      ctx.fillRect(16, 16, 310, 28);
      ctx.strokeRect(16, 16, 310, 28);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('[SIMULATED 3D SENSOR VIEW — PHYSICS SYNCHRONIZED]', 24, 33);

      // Top-Right Simulated Disclaimer
      ctx.fillStyle = 'rgba(10, 16, 28, 0.82)';
      ctx.strokeStyle = '#f59e0b44';
      ctx.lineWidth = 1;
      ctx.fillRect(width - 326, 16, 310, 28);
      ctx.strokeRect(width - 326, 16, 310, 28);
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('[SYNTHETIC GIMBAL FEED • NOT REAL CAMERA FOOTAGE]', width - 318, 33);

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [feedMode, backendStreamFailed, speed, heading, altitude, visionMode, zoomLevel, activeDrone, nextWaypoint, targetIdx, formattedNextDist]);

  const activeDroneCallsign = activeDrone?.callsign || 'DRONE 01';
  const backendStreamUrl = `http://localhost:8000/api/v1/drones/${activeDrone?.id || 'AV-01'}/stream`;

  return (
    <div className="w-full h-full flex flex-col bg-[#070a12] text-slate-100 overflow-hidden select-none font-sans relative">
      {/* ─── 1. TOP HEADER & MULTI-DRONE SELECTION SWITCHER ─── */}
      <div className="h-14 bg-[#0c101a] border-b border-[#1f2a40] px-4 flex items-center justify-between shrink-0 z-20 gap-3">
        {/* Left: Back to Tactical Map & Camera Title */}
        <div className="flex items-center gap-3 shrink-0">
          {onBackToMap && (
            <button
              onClick={onBackToMap}
              className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-cyan-400 bg-[#141b2b] hover:bg-[#1a2338] border border-[#233350] rounded flex items-center gap-1.5 transition-all shadow-sm"
              title="Return to 2D/3D Tactical Map"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Tactical Map</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-cyan-400" />
            <span className="font-extrabold text-sm tracking-wider text-white hidden sm:inline">
              LIVE DRONE FPV CAMERA
            </span>
          </div>
        </div>

        {/* Center: SYNCHRONIZED MULTI-DRONE SELECTION BAR */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-2xl px-1 scrollbar-none">
          {effectiveDrones.map((d) => {
            const isSelected = d.id === (activeDrone?.id || effectiveDroneId);
            const bat = Math.round(d.vitals.batteryPercentage);
            return (
              <button
                key={d.id}
                onClick={() => handleSelectDrone(d.id)}
                className={`px-3 py-1 rounded text-xs font-mono font-bold flex items-center gap-2 transition-all shrink-0 border ${
                  isSelected
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400/50'
                    : 'bg-[#121826] border-[#1e2a3e] text-slate-400 hover:text-slate-200 hover:bg-[#182032]'
                }`}
                title={`Switch camera to ${d.callsign} (${d.model})`}
              >
                <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
                <span>{d.callsign.includes('DRONE') ? d.callsign : d.id}</span>
                <span className={`text-[10px] ${bat > 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {bat}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Camera Source & Vision Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Vision Mode Buttons */}
          <div className="hidden md:flex items-center bg-[#101726] p-0.5 rounded border border-[#202e48] text-xs font-mono">
            <button
              onClick={() => setVisionMode('rgb')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                visionMode === 'rgb' ? 'bg-cyan-500/30 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Optical RGB daylight sensor"
            >
              <Sun className="w-3 h-3 text-cyan-400" />
              <span>RGB</span>
            </button>
            <button
              onClick={() => setVisionMode('flir')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                visionMode === 'flir' ? 'bg-orange-500/30 text-orange-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="FLIR Thermal Infrared Heat Map"
            >
              <Flame className="w-3 h-3 text-orange-400" />
              <span>FLIR</span>
            </button>
            <button
              onClick={() => setVisionMode('nvg')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                visionMode === 'nvg' ? 'bg-emerald-500/30 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Night Vision Goggle Amplification"
            >
              <Moon className="w-3 h-3 text-emerald-400" />
              <span>NVG</span>
            </button>
          </div>

          {/* Zoom Buttons */}
          <div className="hidden lg:flex items-center bg-[#101726] p-0.5 rounded border border-[#202e48] text-xs font-mono">
            <button
              onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
              className="px-1.5 py-0.5 text-slate-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="px-1.5 text-cyan-300 font-bold">{zoomLevel.toFixed(1)}x</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(4, z + 0.5))}
              className="px-1.5 py-0.5 text-slate-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-[#141b2b] hover:bg-[#1e273d] border border-[#233350] rounded flex items-center gap-1.5 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Stream Settings</span>
          </button>
        </div>
      </div>

      {/* ─── 2. MAIN VIDEO VIEWPORT ─── */}
      <div className="flex-1 relative w-full h-full min-h-0 bg-black flex items-center justify-center overflow-hidden">
        {/* Mode 1: Live MJPEG Backend Video Stream from FastAPI */}
        {feedMode === 'LIVE_BACKEND' && !backendStreamFailed && (
          <img
            key={`${activeDrone?.id || 'AV-01'}-${selectedDroneId}`}
            src={backendStreamUrl}
            alt={`Live FPV Camera Feed for ${activeDroneCallsign}`}
            onError={() => {
              console.warn('[LiveCamera] Backend stream offline, falling back to Tactical 3D FPV Canvas');
              setBackendStreamFailed(true);
            }}
            className="w-full h-full object-cover select-none"
            style={{
              filter: visionMode === 'flir'
                ? 'hue-rotate(280deg) saturate(2.5) contrast(1.4)'
                : visionMode === 'nvg'
                ? 'hue-rotate(90deg) saturate(3) contrast(1.5) brightness(1.1)'
                : 'none',
              transform: `scale(${zoomLevel})`,
              transition: 'transform 0.2s ease-out'
            }}
          />
        )}

        {/* Mode 2: Tactical 3D FPV Canvas (Active or Fallback) */}
        {(feedMode === 'TACTICAL_3D_FPV' || (feedMode === 'LIVE_BACKEND' && backendStreamFailed)) && (
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            className="w-full h-full object-cover"
          />
        )}

        {/* Mode 3: External Live Stream Video (WebRTC / RTSP / HLS) */}
        {feedMode === 'GAZEBO_EXTERNAL' && (
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
                <h4 className="text-base font-bold text-white mb-1">Gazebo / External WebRTC Stream</h4>
                <p className="text-xs text-slate-400 mb-4">
                  Enter Gazebo SITL GStreamer WebRTC stream endpoint or onboard RTSP camera URL.
                </p>
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

        {/* Mode 4: Disconnected Static Screen */}
        {feedMode === 'DISCONNECTED' && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#05070d] text-center p-6">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-400">
              <VideoOff className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-wider mb-1">NO OPTICAL SENSOR SIGNAL</h3>
            <p className="text-xs text-slate-400 max-w-md mb-6 font-mono">
              The forward optical gimbal camera link to {activeDroneCallsign} is currently offline. Switch to Backend Stream or Tactical FPV Simulation.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setFeedMode('LIVE_BACKEND'); setBackendStreamFailed(false); }}
                className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                Reconnect Backend Stream
              </button>
              <button
                onClick={() => setFeedMode('TACTICAL_3D_FPV')}
                className="px-4 py-2 rounded bg-[#162032] hover:bg-[#1e2a42] text-slate-200 border border-[#2b3a58] text-xs font-semibold transition-all"
              >
                Tactical 3D Simulation
              </button>
            </div>
          </div>
        )}

        {/* ─── 3. AEROSPACE FLIGHT HUD OVERLAY ─── */}
        {feedMode !== 'DISCONNECTED' && (
          <div className="absolute inset-0 pointer-events-none p-5 flex flex-col justify-between z-10 font-mono select-none">
            {/* Top HUD: Status Pills, Aircraft Telemetry & Target Waypoint */}
            <div className="flex items-start justify-between gap-3">
              {/* Left Vitals Box */}
              <div className="bg-[#0b101c]/85 backdrop-blur-md border border-cyan-500/30 rounded p-3 text-xs min-w-[210px] shadow-lg">
                <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-cyan-900/40">
                  <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1.5">
                    <QuadcopterIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{activeDroneCallsign}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {activeDrone?.model || 'Hexacopter'}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 text-[11px]">
                  <span className="text-slate-400">ALTITUDE:</span>
                  <span className="text-cyan-300 font-bold">{Math.round(altitude)} m AGL</span>
                </div>
                <div className="flex justify-between py-0.5 text-[11px]">
                  <span className="text-slate-400">AIRSPEED:</span>
                  <span className="text-emerald-400 font-bold">{Math.round(speed)} km/h</span>
                </div>
                <div className="flex justify-between py-0.5 text-[11px]">
                  <span className="text-slate-400">BATTERY:</span>
                  <span className="text-amber-300 font-bold">{Math.round(battery)}% ({batteryVoltage.toFixed(1)}V)</span>
                </div>
                <div className="flex justify-between py-0.5 text-[11px]">
                  <span className="text-slate-400">GPS LINK:</span>
                  <span className="text-cyan-400 font-bold">{gpsFix} ({satellites} SAT)</span>
                </div>
              </div>

              {/* Center: Live Compass Ribbon & Heading Indicator */}
              <div className="bg-[#0b101c]/90 backdrop-blur-md border border-cyan-500/40 rounded px-6 py-2 text-center shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center justify-center gap-1">
                  <Compass className="w-3 h-3 text-cyan-400" />
                  <span>HEADING COMPASS</span>
                </div>
                <div className="text-2xl font-black text-cyan-300 tracking-wider">
                  {Math.round(heading).toString().padStart(3, '0')}°
                </div>
                <div className="text-[10px] text-emerald-400 font-bold tracking-widest">
                  {getCompassOctant(heading)}
                </div>
              </div>

              {/* Right: Active Locked Target & Next Waypoint Box */}
              <div className="bg-[#0b101c]/85 backdrop-blur-md border border-cyan-500/30 rounded p-3 text-xs min-w-[240px] shadow-lg">
                <div className="flex items-center justify-between mb-1 pb-1 border-b border-cyan-900/40">
                  <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
                    <Crosshair className="w-3 h-3 text-cyan-400" />
                    <span>LOCKED TARGET</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    WP-{String(targetIdx + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="font-bold text-xs text-white truncate mb-1" title={nextWaypoint?.name || 'Assigned Waypoint'}>
                  {nextWaypoint?.name || activeDrone?.missionDestinationName || 'En-Route Sky Corridor'}
                </div>
                <div className="flex justify-between py-0.5 text-[11px]">
                  <span className="text-slate-400">CORRIDOR ALT:</span>
                  <span className="text-cyan-300 font-bold">{nextWaypoint?.altitudeMeters || 65} m</span>
                </div>
                <div className="flex justify-between py-0.5 text-[11px]">
                  <span className="text-slate-400">RANGE TO TARGET:</span>
                  <span className="text-emerald-400 font-bold">{formattedNextDist}</span>
                </div>
                <div className="flex justify-between py-0.5 text-[11px]">
                  <span className="text-slate-400">TARGET STATUS:</span>
                  <span className="text-cyan-300 font-bold uppercase">{activeDrone?.nextWaypointStatus || 'APPROACHING'}</span>
                </div>
              </div>
            </div>

            {/* Center Aerospace Pitch Ladder & Optical Crosshair Reticle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-36 h-36 border border-cyan-500/30 rounded-full flex items-center justify-center">
                {/* Center dot */}
                <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#00f0ff]" />
                {/* Crosshair lines */}
                <div className="absolute top-0 w-0.5 h-4 bg-cyan-400" />
                <div className="absolute bottom-0 w-0.5 h-4 bg-cyan-400" />
                <div className="absolute left-0 w-4 h-0.5 bg-cyan-400" />
                <div className="absolute right-0 w-4 h-0.5 bg-cyan-400" />

                {/* Corner bracket reticles */}
                <div className="absolute -top-3 -left-3 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
                <div className="absolute -top-3 -right-3 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
                <div className="absolute -bottom-3 -left-3 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
                <div className="absolute -bottom-3 -right-3 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

                <div className="absolute -top-6 text-[9px] text-cyan-300/90 font-mono tracking-widest font-bold">
                  GIMBAL LOCK: 0° PITCH
                </div>
              </div>
            </div>

            {/* Bottom HUD: Coordinates, Battery & Emergency Flight Controls */}
            <div className="flex items-end justify-between gap-3">
              {/* Mission Corridor Bar */}
              <div className="bg-[#0b101c]/85 backdrop-blur-md border border-cyan-500/30 rounded p-2.5 text-xs flex items-center gap-3 shadow-lg">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">FLIGHT CORRIDOR</div>
                  <div className="font-bold text-white text-xs truncate max-w-xs">
                    {activeDrone?.missionStartLocation || 'Origin Hub'} → {activeDrone?.missionDestinationName || 'CMCH Hub'}
                  </div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">STATUS</div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {activeDrone?.routeStatus || 'ACTIVE NAV'}
                  </span>
                </div>
              </div>

              {/* Feed Status Indicator */}
              <div className="bg-[#0b101c]/90 backdrop-blur-md border border-cyan-500/40 rounded px-4 py-1.5 text-center text-xs shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
                    {feedMode === 'LIVE_BACKEND' && !backendStreamFailed
                      ? `LIVE STREAM: http://localhost:8000/api/v1/drones/${activeDrone?.id || 'AV-01'}/stream`
                      : feedMode === 'GAZEBO_EXTERNAL'
                      ? 'GAZEBO SITL CAMERA LINK'
                      : 'TACTICAL 3D FPV SIMULATION (EO/IR GIMBAL)'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  1080p60 • 3-Axis Stabilized Gimbal • Lat: {activeDrone?.vitals.latitude.toFixed(5)}°, Lon: {activeDrone?.vitals.longitude.toFixed(5)}°
                </div>
              </div>

              {/* Quick Flight Controls */}
              <div className="bg-[#0b101c]/90 backdrop-blur-md border border-cyan-500/40 rounded p-2 flex items-center gap-2 pointer-events-auto shadow-lg">
                <button
                  onClick={() => onPauseResume && activeDrone && onPauseResume(activeDrone.id)}
                  className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                    activeDrone?.isPaused
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                      : 'bg-amber-500 hover:bg-amber-400 text-black'
                  }`}
                  title={activeDrone?.isPaused ? 'Resume Mission along Corridor' : 'Hold Position (Auto-Hover)'}
                >
                  {activeDrone?.isPaused ? <Play className="w-3.5 h-3.5 fill-black" /> : <Pause className="w-3.5 h-3.5 fill-black" />}
                  <span>{activeDrone?.isPaused ? 'RESUME' : 'HOVER'}</span>
                </button>

                <button
                  onClick={() => onTriggerRTB && activeDrone && onTriggerRTB(activeDrone.id)}
                  className="px-2.5 py-1.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700 text-xs font-bold flex items-center gap-1 transition-colors"
                  title="Command Return To Base immediately"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>RTB</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── 4. SLIDE-OVER STREAM CONFIGURATION DRAWER ─── */}
      {isConfigOpen && (
        <div className="absolute top-14 right-0 bottom-0 w-84 bg-[#0d1322] border-l border-[#22314d] p-4 z-30 shadow-2xl flex flex-col justify-between font-sans">
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
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Select Feed Pipeline</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-2 rounded bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-cyan-500/50">
                    <input
                      type="radio"
                      name="feedMode"
                      value="LIVE_BACKEND"
                      checked={feedMode === 'LIVE_BACKEND'}
                      onChange={() => { setFeedMode('LIVE_BACKEND'); setBackendStreamFailed(false); }}
                      className="mt-1 accent-cyan-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-cyan-300">FastAPI Live MJPEG Stream (Port 8000)</div>
                      <div className="text-[11px] text-slate-400">
                        Direct 20 FPS video generated from drone trajectory, horizon tilt, and 3D landmarks.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-cyan-500/50">
                    <input
                      type="radio"
                      name="feedMode"
                      value="TACTICAL_3D_FPV"
                      checked={feedMode === 'TACTICAL_3D_FPV'}
                      onChange={() => setFeedMode('TACTICAL_3D_FPV')}
                      className="mt-1 accent-cyan-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-amber-300">Tactical 3D Gimbal Viewport (Canvas)</div>
                      <div className="text-[11px] text-slate-400">
                        Interactive client-side gimbal simulation with RGB, FLIR, and NVG modes.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-cyan-500/50">
                    <input
                      type="radio"
                      name="feedMode"
                      value="GAZEBO_EXTERNAL"
                      checked={feedMode === 'GAZEBO_EXTERNAL'}
                      onChange={() => setFeedMode('GAZEBO_EXTERNAL')}
                      className="mt-1 accent-cyan-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-emerald-300">Gazebo SITL / External WebRTC Stream</div>
                      <div className="text-[11px] text-slate-400">
                        Stream H.264 WebRTC or RTSP stream from Gazebo camera plugin or real onboard drone.
                      </div>
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

              {feedMode === 'GAZEBO_EXTERNAL' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">External Stream URL</label>
                  <input
                    type="text"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="https://.../stream.m3u8 or rtsp://"
                    className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <div className="text-[10px] text-slate-500 mt-1">Supports test MP4 or HLS media stream endpoints.</div>
                </div>
              )}

              <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">Active Sensor Pipeline:</div>
                <div>Target Drone: <span className="text-cyan-300 font-bold">{activeDroneCallsign}</span></div>
                <div>Sensor: Sony IMX477 1/2.3" 4K CMOS</div>
                <div>Gimbal: 3-Axis Brushless RTK Stabilized</div>
                <div>Stream Port: http://localhost:8000/api/v1/drones/{activeDrone?.id || 'AV-01'}/stream</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800">
            <button
              onClick={() => setIsConfigOpen(false)}
              className="w-full py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors"
            >
              Apply &amp; Close
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