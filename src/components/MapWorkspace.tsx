import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// Ensure MapLibre Web Worker loads correctly in Vite development and production
maplibregl.setWorkerUrl(mapWorkerUrl);

import { 
  Layers, 
  Compass, 
  Plus, 
  Minus, 
  Box, 
  Map as MapIcon, 
  LocateFixed, 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw,
  Navigation, 
  ShieldAlert, 
  ShieldCheck,
  AlertTriangle,
  Info,
  X,
  ChevronUp,
  ChevronDown,
  Sliders,
  ExternalLink,
  Shield,
  Crosshair,
  Target,
  MapPin
} from 'lucide-react';
import { 
  Drone, 
  GeofenceZone, 
  Waypoint, 
  Obstacle, 
  ObstacleConflict,
  OfficialAirspaceZone,
  AirspaceClassification
} from '../types/fleet';
import type { Mission, MissionTelemetry, Checkpoint } from '../types/mission';
import { AIRSPACE_CENTER } from '../data/mockFleet';
import { COIMBATORE_DETAILED_OBSTACLES } from '../data/coimbatoreGeoData';
import { OFFICIAL_COIMBATORE_AIRSPACE_ZONES } from '../data/officialAirspaceData';
import { getDistanceMeters, formatWaypointDistance } from '../services/telemetryEngine';
import { 
  globalAirspaceManager, 
  ALL_METRO_SECTORS, 
  COIMBATORE_METRO_SECTOR, 
  CHENNAI_METRO_SECTOR, 
  BENGALURU_METRO_SECTOR,
  DELHI_METRO_SECTOR,
  MUMBAI_METRO_SECTOR,
  MetroSector, 
  AirspaceQueryResult, 
  AirspaceViewport 
} from '../services/airspace';
import { NextWaypointCard } from './NextWaypointCard';
import { GeofenceWarningBanner } from './GeofenceWarningBanner';
import { AltitudeProfileStrip } from './AltitudeProfileStrip';
import { DESIGN_TOKENS } from '../styles/designTokens';
import { MapReadinessStatus } from '../types/loading';
import { useLoading } from '../context/LoadingContext';
import { MapLoadingOverlay } from './loading/MapLoadingOverlay';

interface MapWorkspaceProps {
  drones: Drone[];
  selectedDroneId: string | null;
  onSelectDrone: (id: string) => void;
  geofences: GeofenceZone[];
  officialAirspaceZones?: OfficialAirspaceZone[];
  obstacles: Obstacle[];
  obstacleConflicts: ObstacleConflict[];
  viewMode: '2d' | '3d' | 'pov';
  setViewMode: (mode: '2d' | '3d' | 'pov') => void;
  proposedRoute: Waypoint[] | null;
  selectedWaypointId: string | null;
  onSelectWaypoint: (wpId: string) => void;
  isSimRunning: boolean;
  onToggleSim: () => void;
  simSpeed: number;
  onChangeSimSpeed: (speed: number) => void;
  onResetSim: () => void;
  onImportAirspaceData?: (importedZones: OfficialAirspaceZone[]) => void;
  onAirspaceQueryResult?: (result: AirspaceQueryResult) => void;
  checkpointMission?: Mission | null;
  checkpointTelemetry?: MissionTelemetry | null;
  onSelectCheckpoint?: (checkpoint: Checkpoint) => void;
  isMapPickingDestination?: boolean;
  onMapPickDestination?: (coords: [number, number]) => void;
  tempDestinationCoords?: [number, number] | null;
  isSimulationMode?: boolean;
  onMapReadinessChange?: (status: MapReadinessStatus) => void;
}

const DRONE_THEME_COLORS: Record<string, string> = {
  'AV-01': '#00f0ff', // Cyan - Medical Blood & Cold-Chain
  'AV-02': '#818cf8', // Indigo - STAT Pathology Lab
  'AV-03': '#f59e0b', // Amber - Tech Cargo Heavy-Lift
  'AV-04': '#10b981', // Emerald - UTM Airspace Patrol
};

const DRONE_COLOR_PALETTE = [
  '#00f0ff', // Cyan
  '#818cf8', // Indigo
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#38bdf8', // Sky
  '#a855f7', // Purple
  '#14b8a6', // Teal
];

// High-Fidelity 3D Drone Model Generator (Hexacopter, Quadcopter, Octocopter, Patrol Scout)
const buildMarkerHtml = (
  drone: Drone, 
  isSelected: boolean, 
  activeConflict: ObstacleConflict | null,
  customColor?: string
): string => {
  const baseColor = customColor || DRONE_THEME_COLORS[drone.id] || '#00f0ff';
  const heading = drone.vitals.headingDegrees;
  const bat = Math.round(drone.vitals.batteryPercentage);
  const alt = Math.round(drone.vitals.altitudeMeters);
  const speed = Math.round(drone.vitals.groundSpeedKmh);
  const batColor = bat > 50 ? '#34d399' : bat > 25 ? '#fbbf24' : '#f87171';
  const hasThreat = activeConflict !== null || drone.airspaceStatus === 'PROHIBITED' || drone.airspaceStatus === 'PERMISSION_REQUIRED';
  const threatColor = (activeConflict?.severity === 'critical' || drone.airspaceStatus === 'PROHIBITED') ? '#ef4444' : '#f59e0b';

  // Physical flight angles
  const pitch = Math.min(22, Math.max(3, (speed / 50) * 16));
  const bankAngle = drone.targetHeadingDegrees !== undefined 
    ? ((drone.targetHeadingDegrees - heading + 540) % 360 - 180) * 0.45 
    : 0;
  const roll = Math.max(-20, Math.min(20, bankAngle));

  const shadowBlur = Math.min(22, Math.max(4, alt / 3.5));
  const shadowScale = Math.max(0.55, Math.min(1.3, 1 - alt / 240));

  const displayCallsign = drone.callsign.includes('DRONE') 
    ? drone.callsign 
    : (drone.id === 'AV-01' ? 'DRONE 01' : drone.id === 'AV-02' ? 'DRONE 02' : drone.id === 'AV-03' ? 'DRONE 03' : 'DRONE 04');

  const statusLabel = drone.isRerouting ? 'A* REROUTED' :
                      drone.status === 'hovering' ? 'HOVER HOLD' :
                      drone.status === 'delivering' ? 'DELIVERING' :
                      drone.status === 'en_route_pickup' ? 'EN ROUTE' :
                      drone.status === 'returning_to_base' ? 'RETURNING' :
                      drone.status === 'charging' ? 'CHARGING' : 'ACTIVE';

  // Model-specific 3D SVG Geometry
  const isHexacopter = drone.id === 'AV-01' || drone.model.toLowerCase().includes('hex');
  const isOctocopter = drone.id === 'AV-03' || drone.model.toLowerCase().includes('octo') || drone.model.toLowerCase().includes('titan');
  const isScout = drone.id === 'AV-04' || drone.model.toLowerCase().includes('patrol') || drone.model.toLowerCase().includes('scout');

  return `
    <div style="
      position: relative;
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      cursor: pointer;
      user-select: none;
    ">
      <!-- 1. CALLSIGN BILLBOARD BADGE (POSITIONED CLEANLY ABOVE DRONE) -->
      <div style="
        position: absolute;
        bottom: calc(100% + 4px);
        left: 50%;
        transform: translateX(-50%);
        pointer-events: none;
        z-index: 10;
        white-space: nowrap;
        display: flex;
        flex-direction: column;
        align-items: center;
      ">
        <div style="
          background: rgba(8, 12, 22, 0.94);
          border: ${isSelected ? '2px solid #00f0ff' : hasThreat ? `1.5px solid ${threatColor}` : '1px solid #22324d'};
          border-radius: 4px;
          padding: 2.5px 7px;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.85), ${isSelected ? '0 0 16px rgba(0,240,255,0.7)' : 'none'};
          backdrop-filter: blur(8px);
          white-space: nowrap;
        ">
          ${isSelected ? `<span style="background: #00f0ff; color: #020611; font-size: 8px; font-weight: 900; padding: 1px 4px; border-radius: 2px;">SELECTED</span>` : ''}
          <div style="
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: ${hasThreat ? threatColor : baseColor};
            box-shadow: 0 0 6px ${hasThreat ? threatColor : baseColor};
            animation: ${hasThreat ? 'pulse 1s infinite' : 'none'};
          "></div>
          <span style="
            color: #ffffff;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.05em;
          ">
            ${displayCallsign}
          </span>
          <span style="color: #64748b; font-size: 10px;">•</span>
          <span style="
            color: ${drone.isRerouting ? '#38bdf8' : hasThreat ? threatColor : '#94a3b8'};
            font-family: ui-monospace, monospace;
            font-size: 10px;
            font-weight: 700;
          ">
            ${statusLabel}
          </span>
        </div>
      </div>

      <!-- 2. PHYSICAL 3D AIRCRAFT MODEL (80x80 WITH ROTATING PROPELLERS & PITCH/ROLL) -->
      <div style="
        position: relative;
        width: 80px;
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: scale(${isSelected ? 1.22 : 1});
        transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
      ">
        <!-- Selection Halo Ring -->
        ${isSelected ? `
          <div class="aerovata-beacon-ring" style="
            position: absolute;
            width: 96px;
            height: 96px;
            border-radius: 50%;
            border: 2px solid #00f0ff;
            background: radial-gradient(circle, rgba(0, 240, 255, 0.25) 0%, rgba(0, 240, 255, 0.05) 60%, transparent 80%);
            box-shadow: 0 0 24px #00f0ff, inset 0 0 16px rgba(0, 240, 255, 0.5);
            pointer-events: none;
            z-index: 1;
          "></div>
        ` : ''}

        <!-- Altitude Ground Projection Shadow -->
        <div style="
          position: absolute;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 75%);
          filter: blur(${shadowBlur}px);
          transform: scale(${shadowScale}) translateY(${Math.min(20, alt / 3.8)}px);
          pointer-events: none;
          z-index: 0;
        "></div>

        <!-- Threat Warning Orbit -->
        ${hasThreat ? `
          <div style="
            position: absolute;
            width: 84px;
            height: 84px;
            border-radius: 50%;
            border: 1.5px dashed ${threatColor};
            animation: spin 5s linear infinite;
            opacity: 0.9;
            pointer-events: none;
            z-index: 1;
          "></div>
        ` : ''}

        <!-- 3D Drone Body with Dynamic Pitch/Roll and Rotors -->
        <div style="
          width: 78px;
          height: 78px;
          perspective: 750px;
          transform-style: preserve-3d;
          position: relative;
          z-index: 2;
        ">
          <svg width="78" height="78" viewBox="0 0 78 78" fill="none" style="
            transform: rotateX(${pitch}deg) rotateZ(${heading}deg) rotateY(${roll}deg);
            transition: transform 0.25s ease-out;
            filter: drop-shadow(0 6px 12px rgba(0,0,0,0.85));
            overflow: visible;
          ">
            <defs>
              <linearGradient id="armGrad-${drone.id}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#475569" />
                <stop offset="50%" stop-color="#1e293b" />
                <stop offset="100%" stop-color="#334155" />
              </linearGradient>
              <linearGradient id="fuselageGrad-${drone.id}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#1e293b" />
                <stop offset="50%" stop-color="#0f172a" />
                <stop offset="100%" stop-color="#090d16" />
              </linearGradient>
              <radialGradient id="rotorBlurGrad-${drone.id}" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="${baseColor}" stop-opacity="0.35" />
                <stop offset="70%" stop-color="${baseColor}" stop-opacity="0.12" />
                <stop offset="100%" stop-color="${baseColor}" stop-opacity="0" />
              </radialGradient>
            </defs>

            ${isHexacopter ? `
              <!-- HEXACOPTER 6-BOOM RADIAL CONFIGURATION (AV-01 SkyHauler X-6 Pro) -->
              <!-- 6 Carbon Tubular Arms -->
              <line x1="39" y1="39" x2="39" y2="12" stroke="url(#armGrad-${drone.id})" stroke-width="3.8" stroke-linecap="round"/>
              <line x1="39" y1="39" x2="63" y2="25" stroke="url(#armGrad-${drone.id})" stroke-width="3.8" stroke-linecap="round"/>
              <line x1="39" y1="39" x2="63" y2="53" stroke="url(#armGrad-${drone.id})" stroke-width="3.8" stroke-linecap="round"/>
              <line x1="39" y1="39" x2="39" y2="66" stroke="url(#armGrad-${drone.id})" stroke-width="3.8" stroke-linecap="round"/>
              <line x1="39" y1="39" x2="15" y2="53" stroke="url(#armGrad-${drone.id})" stroke-width="3.8" stroke-linecap="round"/>
              <line x1="39" y1="39" x2="15" y2="25" stroke="url(#armGrad-${drone.id})" stroke-width="3.8" stroke-linecap="round"/>

              <!-- 6 Spinning Rotor Discs -->
              <g class="aerovata-rotor-spin" style="transform-origin: 39px 12px;"><circle cx="39" cy="12" r="10" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="29" y1="12" x2="49" y2="12" stroke="#e2e8f0" stroke-width="1.8" stroke-linecap="round"/></g>
              <g class="aerovata-rotor-spin-rev" style="transform-origin: 63px 25px;"><circle cx="63" cy="25" r="10" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="53" y1="25" x2="73" y2="25" stroke="#e2e8f0" stroke-width="1.8" stroke-linecap="round"/></g>
              <g class="aerovata-rotor-spin" style="transform-origin: 63px 53px;"><circle cx="63" cy="53" r="10" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="53" y1="53" x2="73" y2="53" stroke="#e2e8f0" stroke-width="1.8" stroke-linecap="round"/></g>
              <g class="aerovata-rotor-spin-rev" style="transform-origin: 39px 66px;"><circle cx="39" cy="66" r="10" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="29" y1="66" x2="49" y2="66" stroke="#e2e8f0" stroke-width="1.8" stroke-linecap="round"/></g>
              <g class="aerovata-rotor-spin" style="transform-origin: 15px 53px;"><circle cx="15" cy="53" r="10" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="5" y1="53" x2="25" y2="53" stroke="#e2e8f0" stroke-width="1.8" stroke-linecap="round"/></g>
              <g class="aerovata-rotor-spin-rev" style="transform-origin: 15px 25px;"><circle cx="15" cy="25" r="10" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="5" y1="25" x2="25" y2="25" stroke="#e2e8f0" stroke-width="1.8" stroke-linecap="round"/></g>

              <!-- 6 Motor Bells -->
              <circle cx="39" cy="12" r="4.2" fill="#0f172a" stroke="#94a3b8" stroke-width="1.2"/>
              <circle cx="63" cy="25" r="4.2" fill="#0f172a" stroke="#94a3b8" stroke-width="1.2"/>
              <circle cx="63" cy="53" r="4.2" fill="#0f172a" stroke="#94a3b8" stroke-width="1.2"/>
              <circle cx="39" cy="66" r="4.2" fill="#0f172a" stroke="#94a3b8" stroke-width="1.2"/>
              <circle cx="15" cy="53" r="4.2" fill="#0f172a" stroke="#94a3b8" stroke-width="1.2"/>
              <circle cx="15" cy="25" r="4.2" fill="#0f172a" stroke="#94a3b8" stroke-width="1.2"/>

              <!-- Central Hexagonal Carbon Fuselage -->
              <polygon points="39,26 49,32 49,46 39,52 29,46 29,32" fill="url(#fuselageGrad-${drone.id})" stroke="${baseColor}" stroke-width="1.8"/>
              <rect x="34" y="34" width="10" height="10" rx="2" fill="#020617" stroke="#38bdf8" stroke-width="1"/>
              <!-- Red Cross Medical Emblem on Cargo Pod -->
              <rect x="36.5" y="38" width="5" height="2" fill="#ef4444"/>
              <rect x="38" y="36.5" width="2" height="5" fill="#ef4444"/>
            ` : isOctocopter ? `
              <!-- OCTOCOPTER 8-ARM HEAVY LIFTER CONFIGURATION (AV-03 TitanCargo) -->
              <line x1="39" y1="39" x2="39" y2="10" stroke="url(#armGrad-${drone.id})" stroke-width="4.2" stroke-linecap="round"/>
              <line x1="39" y1="39" x2="60" y2="18" stroke="url(#armGrad-${drone.id})" stroke-width="4.2" stroke-linecap="round"/>
              <line x1="39" y1="39" x2="68" y2="39" stroke="url(#armGrad-${drone.id})" stroke-width="4.2" stroke-linecap="round"/>
              <line x1="39" y1="39" x2="60" y2="60" stroke="url(#armGrad-${drone.id})" stroke-width="4.2" stroke-linecap="round"/>
              <line x1="39" y1="39" x2="39" y2="68" stroke="url(#armGrad-${drone.id})" stroke-width="4.2" stroke-linecap="round"/>
              <line x1="39" y1="39" x2="18" y2="60" stroke="url(#armGrad-${drone.id})" stroke-width="4.2" stroke-linecap="round"/>
              <line x1="39" y1="39" x2="10" y2="39" stroke="url(#armGrad-${drone.id})" stroke-width="4.2" stroke-linecap="round"/>
              <line x1="39" y1="39" x2="18" y2="18" stroke="url(#armGrad-${drone.id})" stroke-width="4.2" stroke-linecap="round"/>

              <!-- 8 Spinning Rotors with Amber Tips -->
              <g class="aerovata-rotor-spin" style="transform-origin: 39px 10px;"><circle cx="39" cy="10" r="9" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="30" y1="10" x2="48" y2="10" stroke="#f59e0b" stroke-width="1.8"/></g>
              <g class="aerovata-rotor-spin-rev" style="transform-origin: 60px 18px;"><circle cx="60" cy="18" r="9" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="51" y1="18" x2="69" y2="18" stroke="#f59e0b" stroke-width="1.8"/></g>
              <g class="aerovata-rotor-spin" style="transform-origin: 68px 39px;"><circle cx="68" cy="39" r="9" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="59" y1="39" x2="77" y2="39" stroke="#f59e0b" stroke-width="1.8"/></g>
              <g class="aerovata-rotor-spin-rev" style="transform-origin: 60px 60px;"><circle cx="60" cy="60" r="9" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="51" y1="60" x2="69" y2="60" stroke="#f59e0b" stroke-width="1.8"/></g>
              <g class="aerovata-rotor-spin" style="transform-origin: 39px 68px;"><circle cx="39" cy="68" r="9" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="30" y1="68" x2="48" y2="68" stroke="#f59e0b" stroke-width="1.8"/></g>
              <g class="aerovata-rotor-spin-rev" style="transform-origin: 18px 60px;"><circle cx="18" cy="60" r="9" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="9" y1="60" x2="27" y2="60" stroke="#f59e0b" stroke-width="1.8"/></g>
              <g class="aerovata-rotor-spin" style="transform-origin: 10px 39px;"><circle cx="10" cy="39" r="9" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="1" y1="39" x2="19" y2="39" stroke="#f59e0b" stroke-width="1.8"/></g>
              <g class="aerovata-rotor-spin-rev" style="transform-origin: 18px 18px;"><circle cx="18" cy="18" r="9" fill="url(#rotorBlurGrad-${drone.id})"/><line x1="9" y1="18" x2="27" y2="18" stroke="#f59e0b" stroke-width="1.8"/></g>

              <!-- Central Heavy Ruggedized Body -->
              <rect x="29" y="29" width="20" height="20" rx="4" fill="url(#fuselageGrad-${drone.id})" stroke="#f59e0b" stroke-width="2"/>
              <rect x="33" y="33" width="12" height="12" rx="2" fill="#0f172a" stroke="#cbd5e1" stroke-width="1"/>
            ` : `
              <!-- HIGH-SPEED QUADCOPTER CONFIGURATION (AV-02 MediCourier / AV-04 AeroScout) -->
              <!-- 4 Swept Carbon Booms in X-Frame -->
              <line x1="18" y1="18" x2="60" y2="60" stroke="url(#armGrad-${drone.id})" stroke-width="4.5" stroke-linecap="round"/>
              <line x1="60" y1="18" x2="18" y2="60" stroke="url(#armGrad-${drone.id})" stroke-width="4.5" stroke-linecap="round"/>

              <!-- 4 High-Speed Spinning Propellers with Motion Blur -->
              <g class="aerovata-rotor-spin" style="transform-origin: 18px 18px;">
                <circle cx="18" cy="18" r="12" fill="url(#rotorBlurGrad-${drone.id})"/>
                <line x1="6" y1="18" x2="30" y2="18" stroke="#f1f5f9" stroke-width="2" stroke-linecap="round"/>
              </g>
              <g class="aerovata-rotor-spin-rev" style="transform-origin: 60px 18px;">
                <circle cx="60" cy="18" r="12" fill="url(#rotorBlurGrad-${drone.id})"/>
                <line x1="48" y1="18" x2="72" y2="18" stroke="#f1f5f9" stroke-width="2" stroke-linecap="round"/>
              </g>
              <g class="aerovata-rotor-spin" style="transform-origin: 60px 60px;">
                <circle cx="60" cy="60" r="12" fill="url(#rotorBlurGrad-${drone.id})"/>
                <line x1="48" y1="60" x2="72" y2="60" stroke="#f1f5f9" stroke-width="2" stroke-linecap="round"/>
              </g>
              <g class="aerovata-rotor-spin-rev" style="transform-origin: 18px 60px;">
                <circle cx="18" cy="60" r="12" fill="url(#rotorBlurGrad-${drone.id})"/>
                <line x1="6" y1="60" x2="30" y2="60" stroke="#f1f5f9" stroke-width="2" stroke-linecap="round"/>
              </g>

              <!-- 4 Anodized Brushless Motor Bells -->
              <circle cx="18" cy="18" r="4.8" fill="#0f172a" stroke="#cbd5e1" stroke-width="1.5"/>
              <circle cx="60" cy="18" r="4.8" fill="#0f172a" stroke="#cbd5e1" stroke-width="1.5"/>
              <circle cx="60" cy="60" r="4.8" fill="#0f172a" stroke="#cbd5e1" stroke-width="1.5"/>
              <circle cx="18" cy="60" r="4.8" fill="#0f172a" stroke="#cbd5e1" stroke-width="1.5"/>

              <!-- Central Aerodynamic Carbon Canopy & Avionics -->
              <rect x="28" y="27" width="22" height="24" rx="6" fill="url(#fuselageGrad-${drone.id})" stroke="${baseColor}" stroke-width="1.8"/>
              <!-- Nose Direction Arrow / Cockpit Windscreen -->
              <polygon points="39,22 32,30 46,30" fill="${baseColor}"/>
              <rect x="32" y="32" width="14" height="12" rx="3" fill="#0b111e" stroke="#38bdf8" stroke-width="1"/>
              <!-- Central Gimbal / Payload Sensor Dome -->
              <circle cx="39" cy="38" r="3.5" fill="${hasThreat ? threatColor : baseColor}"/>
            `}

            <!-- FAA Navigation Lighting (Strobes) -->
            <!-- Red Port (Left) Strobe -->
            <circle cx="14" cy="39" r="2.2" fill="#ef4444" class="aerovata-strobe"/>
            <!-- Green Starboard (Right) Strobe -->
            <circle cx="64" cy="39" r="2.2" fill="#10b981" class="aerovata-strobe"/>
            <!-- White Anti-Collision Tail Beacon -->
            <circle cx="39" cy="68" r="2" fill="#ffffff" class="aerovata-strobe"/>
            <!-- Forward Dual Searchlight Beams -->
            <polygon points="36,24 28,6 50,6 42,24" fill="url(#rotorBlurGrad-${drone.id})" opacity="0.4"/>
            <circle cx="37" cy="24" r="1.5" fill="#ffffff"/>
            <circle cx="41" cy="24" r="1.5" fill="#ffffff"/>
          </svg>
        </div>
      </div>

      <!-- 3. TELEMETRY CAPSULE STRIP UNDERNEATH DRONE -->
      <div style="
        position: absolute;
        top: calc(100% + 4px);
        left: 50%;
        transform: translateX(-50%);
        pointer-events: none;
        z-index: 10;
        white-space: nowrap;
      ">
        <div style="
          background: rgba(10, 15, 26, 0.94);
          border: 1px solid ${hasThreat ? threatColor : '#25344f'};
          border-radius: 4px;
          padding: 2px 7px;
          display: flex;
          align-items: center;
          gap: 6px;
          backdrop-filter: blur(8px);
          box-shadow: 0 2px 6px rgba(0,0,0,0.7);
        ">
          <span style="color: #94a3b8; font-size: 10px; font-family: ui-monospace, monospace; font-weight: 600;">
            ALT: ${alt}m
          </span>
          <div style="width: 1px; height: 8px; background: #23334d;"></div>
          <span style="color: ${baseColor}; font-size: 10px; font-family: ui-monospace, monospace; font-weight: 600;">
            ${speed} km/h
          </span>
          <div style="width: 1px; height: 8px; background: #23334d;"></div>
          <span style="color: ${batColor}; font-size: 10px; font-weight: 700; font-family: ui-monospace, monospace;">
            ${bat}%
          </span>
        </div>
      </div>

      <!-- 4. ACTIVE THREAT BANNER -->
      ${hasThreat ? `
        <div style="
          position: absolute;
          top: calc(100% + 28px);
          left: 50%;
          transform: translateX(-50%);
          pointer-events: none;
          z-index: 10;
          white-space: nowrap;
        ">
          <div style="
            background: rgba(220, 38, 38, 0.95);
            color: #ffffff;
            font-family: ui-monospace, monospace;
            font-size: 9px;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 3px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            border: 1px solid #f87171;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.85);
          ">
            ${drone.isRerouting ? 'A* REROUTE ACTIVE' : activeConflict ? `COLLISION RISK: ${activeConflict.obstacleName.substring(0, 14)} (${activeConflict.horizontalDistanceMeters}m)` : `${drone.airspaceStatus}: AIRSPACE HAZARD`}
          </div>
        </div>
      ` : ''}
    </div>
  `;
};

export const MapWorkspace: React.FC<MapWorkspaceProps> = ({
  drones,
  selectedDroneId,
  onSelectDrone,
  geofences,
  officialAirspaceZones,
  obstacles,
  obstacleConflicts,
  viewMode,
  setViewMode,
  proposedRoute,
  selectedWaypointId,
  onSelectWaypoint,
  isSimRunning,
  onToggleSim,
  simSpeed,
  onChangeSimSpeed,
  onResetSim,
  onImportAirspaceData,
  onAirspaceQueryResult,
  checkpointMission,
  checkpointTelemetry,
  onSelectCheckpoint,
  isMapPickingDestination = false,
  onMapPickDestination,
  tempDestinationCoords,
  isSimulationMode = true,
  onMapReadinessChange,
}) => {
  const { startOperation, finishOperation, isBusy, activeMapOperation, cancelOperation } = useLoading();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const waypointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const destinationMarkersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const checkpointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const tempDestMarkerRef = useRef<maplibregl.Marker | null>(null);
  const simDroneMarkerRef = useRef<maplibregl.Marker | null>(null);
  const prevSelectedDroneIdRef = useRef<string | null>(null);

  // 12-Layer System Controls
  const [layerSatellite, setLayerSatellite] = useState(true);
  const [layer3DBuildings, setLayer3DBuildings] = useState(true);
  const [layerGroundRoads, setLayerGroundRoads] = useState(true);
  const [layerMajorRoads, setLayerMajorRoads] = useState(true);
  const [layerElevatedHighways, setLayerElevatedHighways] = useState(true);
  const [layerFlyovers, setLayerFlyovers] = useState(true);
  const [layerAirspaceZones, setLayerAirspaceZones] = useState(true);
  const [layerObstacles, setLayerObstacles] = useState(true);
  const [layerPlannedRoutes, setLayerPlannedRoutes] = useState(true);
  const [layerWaypoints, setLayerWaypoints] = useState(true);
  const [layerDestinations, setLayerDestinations] = useState(true);
  const [layerCollisionWarnings, setLayerCollisionWarnings] = useState(true);

  const [mapStyle, setMapStyle] = useState<'satellite' | 'dark'>('satellite');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [autoFollow, setAutoFollow] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);

  // Advanced Camera state (Requirement 5)
  const [currentPitch, setCurrentPitch] = useState(62);
  const [currentBearing, setCurrentBearing] = useState(-25);
  const [showCameraToolbar, setShowCameraToolbar] = useState(false);

  // Airspace Zone Inspection & Legend state (Requirement 1 & 2 - Collapsed chip by default per Req 6)
  const [selectedAirspaceZone, setSelectedAirspaceZone] = useState<OfficialAirspaceZone | null>(null);
  const [showAirspaceLegend, setShowAirspaceLegend] = useState(false);

  // Dynamic Nationwide Airspace state
  const [airspaceQueryResult, setAirspaceQueryResult] = useState<AirspaceQueryResult | null>(null);
  const [currentCenter, setCurrentCenter] = useState<[number, number]>([76.9780, 11.0160]);
  const [activeSectorId, setActiveSectorId] = useState<string>('coimbatore');

// Query dynamic OSM vector building features to supplement static obstacles
const getDynamicBuildingObstacles = (map: maplibregl.Map | null): Obstacle[] => {
  if (!map) return [];
  try {
    const features = map.queryRenderedFeatures({ layers: ['osm-buildings-3d'] });
    if (!features || features.length === 0) return [];
    const dynamicObs: Obstacle[] = [];
    const seen = new Set<string>();

    for (const f of features) {
      const id = String(f.id || `osm-${Math.random()}`);
      if (seen.has(id)) continue;
      seen.add(id);

      const height = Number(f.properties?.render_height) || 14.0;
      let coords: [number, number][] = [];
      if (f.geometry.type === 'Polygon') {
        coords = f.geometry.coordinates[0] as [number, number][];
      } else if (f.geometry.type === 'MultiPolygon') {
        coords = f.geometry.coordinates[0]?.[0] as [number, number][];
      }
      if (coords && coords.length >= 3) {
        const sumLng = coords.reduce((acc, c) => acc + c[0], 0);
        const sumLat = coords.reduce((acc, c) => acc + c[1], 0);
        const center: [number, number] = [sumLng / coords.length, sumLat / coords.length];

        dynamicObs.push({
          id: `osm-${id}`,
          name: `3D Urban Structure (${Math.round(height)}m AGL)`,
          type: 'building',
          heightMeters: height,
          physicalHeightMeters: height,
          visualHeightMeters: height,
          deckElevationMeters: height,
          verticalClearanceBufferMeters: 15.0,
          baseElevationMeters: 411.0,
          roofElevationMeters: 411.0 + height,
          center,
          coordinates: coords,
          heightConfidence: f.properties?.render_height ? 'verified' : 'estimated',
          heightSource: 'OpenFreeMap 3D Vector Building Tiles',
          color: '#71717a',
          safetyBufferMeters: 20.0,
          description: `Extruded urban building structure from vector tiles (${Math.round(height)}m AGL)`
        });
      }
    }
    return dynamicObs;
  } catch {
    return [];
  }
};

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // OpenFreeMap vector tile & style endpoints
    const OFM_ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> Data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

    const initialStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        'openfreemap': {
          type: 'vector',
          url: 'https://tiles.openfreemap.org/planet',
          tiles: [
            'https://tiles.openfreemap.org/planet/20261101_080013_pt/{z}/{x}/{y}.pbf'
          ],
          minzoom: 0,
          maxzoom: 14,
          attribution: OFM_ATTRIBUTION,
        },
        'openfreemap-buildings': {
          type: 'vector',
          url: 'https://tiles.openfreemap.org/planet',
          tiles: [
            'https://tiles.openfreemap.org/planet/20261101_080013_pt/{z}/{x}/{y}.pbf'
          ],
          minzoom: 0,
          maxzoom: 14,
          attribution: OFM_ATTRIBUTION,
        },
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: {
            'background-color': '#080b12',
          },
        },
        {
          id: 'satellite-tiles',
          type: 'raster',
          source: 'esri-satellite',
          paint: {
            'raster-opacity': mapStyle === 'satellite' ? 0.78 : 0.0,
            'raster-contrast': 0.18,
            'raster-brightness-min': 0.06,
          },
        },
      ],
    };

    // Full interactive camera capabilities (Requirement 5)
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: initialStyle,
      center: [76.9780, 11.0160], // Core urban corridor (Gandhipuram - Avinashi Rd)
      zoom: 14.8, // Set initial zoom so 3D buildings are immediately visible
      pitch: viewMode === '3d' ? 62 : 0,
      bearing: viewMode === '3d' ? -25 : 0,
      maxPitch: 78,
      dragRotate: true,
      touchZoomRotate: true,
      touchPitch: true,
      pitchWithRotate: true,
      dragPan: true,
      scrollZoom: true,
      doubleClickZoom: true,
      keyboard: true,
      attributionControl: false,
    });

    // ResizeObserver for reliable rendering across all layout resizes
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    const updateAirspaceForViewport = () => {
      const bounds = map.getBounds();
      const center = map.getCenter();
      const zoom = map.getZoom();
      setCurrentCenter([center.lng, center.lat]);

      const vp: AirspaceViewport = {
        minLng: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLng: bounds.getEast(),
        maxLat: bounds.getNorth(),
        center: [center.lng, center.lat],
        zoom,
      };

      globalAirspaceManager.queryAirspace(vp, (result) => {
        setAirspaceQueryResult(result);
        if (result.sectorId) {
          setActiveSectorId(result.sectorId);
        } else if (result.coverageStatus === 'UNVERIFIED_COVERAGE') {
          setActiveSectorId('unverified');
        }

        const src = map.getSource('official-airspace-source') as maplibregl.GeoJSONSource;
        if (src) {
          const features = result.zones.map((z) => ({
            type: 'Feature' as const,
            id: z.id,
            properties: {
              id: z.id,
              name: z.name,
              classification: z.classification,
              lowerLimit: z.lowerAltitudeLimitMeters,
              upperLimit: z.upperAltitudeLimitMeters,
              altitudeRef: z.altitudeReference,
              terrainElev: z.terrainElevationMeters,
              permissionRequired: z.permissionRequired,
              authority: z.permissionAuthority,
              source: z.authoritativeSource,
              status: z.status,
              description: z.description,
            },
            geometry: {
              type: 'Polygon' as const,
              coordinates: [z.coordinates],
            },
          }));
          src.setData({ type: 'FeatureCollection', features });
        }

        if (onAirspaceQueryResult) {
          onAirspaceQueryResult(result);
        }
      });
    };

    // Notify startup screen: Phase 1 - initializing
    onMapReadinessChange?.({
      phase: 'initializing',
      progress: 20,
      message: 'Initializing flight environment...',
      isReady: false,
    });

    let hasLoadedLayers = false;
    let hasMarkedReady = false;
    let idleFallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let moveRaf: number | null = null;
    let pitchRaf: number | null = null;
    let bearingRaf: number | null = null;

    const markMapReady = () => {
      if (hasMarkedReady) return;
      hasMarkedReady = true;
      if (idleFallbackTimer) {
        clearTimeout(idleFallbackTimer);
        idleFallbackTimer = null;
      }
      onMapReadinessChange?.({
        phase: 'ready',
        progress: 100,
        message: 'Command Center Ready',
        isReady: true,
      });
    };

    map.on('style.load', () => {
      onMapReadinessChange?.({
        phase: 'style_loading',
        progress: 40,
        message: 'Loading base cartography & terrain elevation...',
        isReady: false,
      });
    });

    map.on('load', () => {
      (window as any).__map = map;
      initMapLayers(map);
      hasLoadedLayers = true;
      
      try {
        map.setLight({
          anchor: 'viewport',
          color: '#ffffff',
          intensity: 0.65,
          position: [1.2, 215, 45],
        });
      } catch {}

      setIsMapLoaded(true);
      updateAirspaceForViewport();

      onMapReadinessChange?.({
        phase: 'layers_ready',
        progress: 70,
        message: 'Synthesizing 3D urban buildings & airspace zones...',
        isReady: false,
      });

      onMapReadinessChange?.({
        phase: 'tiles_loading',
        progress: 88,
        message: 'Rendering spatial terrain & visible tiles...',
        isReady: false,
      });

      // Wait for MapLibre idle event when visible tiles & layers finish rendering
      map.once('idle', markMapReady);

      // Safe fallback timer: ensures user is never trapped by slow/throttled tile servers
      idleFallbackTimer = setTimeout(markMapReady, 4500);
    });

    map.on('error', (e) => {
      if (!isMapLoaded && (e.error?.message?.includes('WebGL') || e.error?.message?.includes('context lost'))) {
        onMapReadinessChange?.({
          phase: 'error',
          progress: 100,
          message: 'WebGL Hardware Initialization Error',
          error: e.error?.message || 'WebGL context failure occurred during map initialization.',
          isReady: false,
        });
      }
    });

    // Throttled map interaction events using requestAnimationFrame to eliminate redundant React renders
    map.on('move', () => {
      if (moveRaf !== null) return;
      moveRaf = requestAnimationFrame(() => {
        const center = map.getCenter();
        setCurrentCenter([center.lng, center.lat]);
        moveRaf = null;
      });
    });

    map.on('moveend', () => {
      updateAirspaceForViewport();
    });

    map.on('pitch', () => {
      if (pitchRaf !== null) return;
      pitchRaf = requestAnimationFrame(() => {
        const p = Math.round(map.getPitch());
        setCurrentPitch((prev) => (prev !== p ? p : prev));
        pitchRaf = null;
      });
    });

    map.on('rotate', () => {
      if (bearingRaf !== null) return;
      bearingRaf = requestAnimationFrame(() => {
        const b = Math.round(map.getBearing());
        setCurrentBearing((prev) => (prev !== b ? b : prev));
        bearingRaf = null;
      });
    });

    map.on('dragstart', () => {
      setAutoFollow(false);
    });

    mapRef.current = map;
    (window as any).__mapInstance = map;
    (window as any).__getDynamicBuildingObstacles = () => getDynamicBuildingObstacles(mapRef.current);

    return () => {
      if (idleFallbackTimer) clearTimeout(idleFallbackTimer);
      if (moveRaf) cancelAnimationFrame(moveRaf);
      if (pitchRaf) cancelAnimationFrame(pitchRaf);
      if (bearingRaf) cancelAnimationFrame(bearingRaf);
      resizeObserver.disconnect();
      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};
      waypointMarkersRef.current.forEach((m) => m.remove());
      waypointMarkersRef.current = [];
      Object.values(destinationMarkersRef.current).forEach((m) => m.remove());
      destinationMarkersRef.current = {};
      checkpointMarkersRef.current.forEach((m) => m.remove());
      checkpointMarkersRef.current = [];
      if (simDroneMarkerRef.current) {
        simDroneMarkerRef.current.remove();
        simDroneMarkerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      (window as any).__mapInstance = null;
      (window as any).__getDynamicBuildingObstacles = null;
      setIsMapLoaded(false);
    };
  }, []);

  // Handle map style toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;
    if (map.getLayer('satellite-tiles')) {
      map.setPaintProperty('satellite-tiles', 'raster-opacity', mapStyle === 'satellite' ? 0.78 : 0.0);
      map.setPaintProperty('satellite-tiles', 'raster-contrast', mapStyle === 'satellite' ? 0.18 : -0.2);
    }
  }, [mapStyle, isMapLoaded]);

  // Handle 2D / 3D camera toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (viewMode === '2d') {
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
    } else if (viewMode === '3d') {
      map.easeTo({ pitch: 62, bearing: -25, duration: 800 });
    }
  }, [viewMode]);

  const handleSetMapStyle = (newStyle: 'satellite' | 'dark') => {
    if (newStyle === mapStyle) return;
    startOperation('map-style', `Applying ${newStyle === 'satellite' ? 'Satellite 3D' : 'OpenFreeMap 3D'} imagery...`, 'map');
    setMapStyle(newStyle);
    setTimeout(() => {
      finishOperation('map-style');
    }, 450);
  };

  // Handler: Locate / Focus Selected Drone on Demand
  const handleFocusSelectedDrone = () => {
    const map = mapRef.current;
    if (!map || !selectedDroneId) return;
    const drone = drones.find((d) => d.id === selectedDroneId);
    if (drone) {
      map.flyTo({
        center: [drone.vitals.longitude, drone.vitals.latitude],
        zoom: 15.4,
        pitch: viewMode === '3d' ? 62 : 0,
        bearing: viewMode === '3d' ? -25 : 0,
        duration: 900,
        essential: true,
      });
    }
  };

  // Smoothly locate & fly camera towards selected drone when selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedDroneId || !isMapLoaded) return;

    if (prevSelectedDroneIdRef.current !== selectedDroneId) {
      prevSelectedDroneIdRef.current = selectedDroneId;
      const drone = drones.find((d) => d.id === selectedDroneId);
      if (drone) {
        map.flyTo({
          center: [drone.vitals.longitude, drone.vitals.latitude],
          zoom: 15.2,
          pitch: viewMode === '3d' ? 62 : 0,
          bearing: viewMode === '3d' ? -25 : 0,
          duration: 1000,
          essential: true,
        });
      }
    }
  }, [selectedDroneId, drones, isMapLoaded, viewMode]);

  // Continuous tracking when autoFollow is active
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedDroneId || !autoFollow || !isMapLoaded) return;
    const drone = drones.find((d) => d.id === selectedDroneId);
    if (drone) {
      map.easeTo({
        center: [drone.vitals.longitude, drone.vitals.latitude],
        duration: 350,
      });
    }
  }, [drones, selectedDroneId, autoFollow, isMapLoaded]);

  // Initialize all vector layers
  const initMapLayers = (map: maplibregl.Map) => {
    // ─── 1. Official DGCA Digital Sky Airspace Source & Layers (Req 1 & 2) ───
    const activeZones = officialAirspaceZones !== undefined 
      ? officialAirspaceZones 
      : (airspaceQueryResult ? airspaceQueryResult.zones : OFFICIAL_COIMBATORE_AIRSPACE_ZONES);
    const zoneFeatures = activeZones.map((z) => ({
      type: 'Feature' as const,
      id: z.id,
      properties: {
        id: z.id,
        name: z.name,
        classification: z.classification,
        lowerLimit: z.lowerAltitudeLimitMeters,
        upperLimit: z.upperAltitudeLimitMeters,
        altitudeRef: z.altitudeReference,
        terrainElev: z.terrainElevationMeters,
        permissionRequired: z.permissionRequired,
        authority: z.permissionAuthority,
        source: z.authoritativeSource,
        status: z.status,
        description: z.description,
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [z.coordinates],
      },
    }));

    if (!map.getSource('official-airspace-source')) {
      map.addSource('official-airspace-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: zoneFeatures,
        },
      });

      // Airspace Translucent Fill (Red #EF4444, Yellow #FACC15, Green #22C55E, Unknown #94A3B8)
      map.addLayer({
        id: 'airspace-zones-fill',
        type: 'fill',
        source: 'official-airspace-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'classification'],
            'RED', '#EF4444',
            'YELLOW', '#FACC15',
            'GREEN', '#22C55E',
            '#94A3B8'
          ],
          'fill-opacity': [
            'match',
            ['get', 'classification'],
            'RED', 0.20,
            'YELLOW', 0.16,
            'GREEN', 0.12,
            0.14
          ],
        },
      });

      // Airspace Boundary Outline
      map.addLayer({
        id: 'airspace-zones-outline',
        type: 'line',
        source: 'official-airspace-source',
        paint: {
          'line-color': [
            'match',
            ['get', 'classification'],
            'RED', '#DC2626',
            'YELLOW', '#EAB308',
            'GREEN', '#16A34A',
            '#64748B'
          ],
          'line-width': [
            'match',
            ['get', 'classification'],
            'RED', 2.6,
            'YELLOW', 2.4,
            'GREEN', 2.0,
            1.8
          ],
          'line-dasharray': [
            'case',
            ['==', ['get', 'classification'], 'YELLOW'], ['literal', [4, 2]],
            ['==', ['get', 'classification'], 'UNKNOWN'], ['literal', [4, 3]],
            ['literal', [1, 0]]
          ],
        },
      });

      // Airspace Zone Text Labels inside zones (Requirement 6: text label inside zone)
      map.addLayer({
        id: 'airspace-zones-labels',
        type: 'symbol',
        source: 'official-airspace-source',
        layout: {
          'text-field': [
            'concat',
            ['get', 'classification'], ' ZONE · ',
            ['case',
              ['==', ['get', 'classification'], 'RED'], 'NO-FLY',
              ['==', ['get', 'classification'], 'YELLOW'], 'ATC AUTH REQ',
              ['==', ['get', 'classification'], 'GREEN'], 'PERMITTED <400FT',
              'ADVISORY'
            ]
          ],
          'text-size': 11,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': [
            'match',
            ['get', 'classification'],
            'RED', '#fca5a5',
            'YELLOW', '#fef08a',
            'GREEN', '#86efac',
            '#cbd5e1'
          ],
          'text-halo-color': '#020617',
          'text-halo-width': 2.0,
        },
      });

      // Click to inspect zone (registered on ground fill)
      map.on('click', 'airspace-zones-fill', (e) => {
        if (e.features && e.features[0]) {
          const feat = e.features[0];
          const matched = activeZones.find((z) => z.id === feat.properties.id);
          if (matched) {
            setSelectedAirspaceZone(matched);
          }
        }
      });

      map.on('mouseenter', 'airspace-zones-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'airspace-zones-fill', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // ─── 2. Road Network Styling Hierarchy (OpenFreeMap Vector) ───
    const vectorSourceId = map.getSource('openfreemap') ? 'openfreemap' : 'openfreemap-buildings';
    if (!map.getLayer('roads-local') && map.getSource(vectorSourceId)) {
      try {
        // Local Roads: Muted slate grey #64748B
        map.addLayer({
          id: 'roads-local',
          type: 'line',
          source: vectorSourceId,
          'source-layer': 'transportation',
          filter: ['in', 'class', 'minor', 'service', 'street'],
          paint: {
            'line-color': '#64748B',
            'line-width': 1.2,
            'line-opacity': 0.70,
          },
        });

        // Secondary Roads: Medium blue-grey #94A3B8
        map.addLayer({
          id: 'roads-secondary',
          type: 'line',
          source: vectorSourceId,
          'source-layer': 'transportation',
          filter: ['in', 'class', 'secondary', 'tertiary'],
          paint: {
            'line-color': '#94A3B8',
            'line-width': 1.8,
            'line-opacity': 0.82,
          },
        });

        // Major Arterial Roads: Desaturated light grey-blue #CBD5E1
        map.addLayer({
          id: 'roads-primary',
          type: 'line',
          source: vectorSourceId,
          'source-layer': 'transportation',
          filter: ['==', 'class', 'primary'],
          paint: {
            'line-color': '#CBD5E1',
            'line-width': 2.4,
            'line-opacity': 0.88,
          },
        });

        // Highways Casing: Dark separation outline
        map.addLayer({
          id: 'roads-highway-casing',
          type: 'line',
          source: vectorSourceId,
          'source-layer': 'transportation',
          filter: ['in', 'class', 'motorway', 'trunk'],
          paint: {
            'line-color': '#0f172a',
            'line-width': 4.2,
          },
        });

        // National & State Highways: Soft steel blue #7DD3FC
        map.addLayer({
          id: 'roads-highway',
          type: 'line',
          source: vectorSourceId,
          'source-layer': 'transportation',
          filter: ['in', 'class', 'motorway', 'trunk'],
          paint: {
            'line-color': '#7DD3FC',
            'line-width': 3.0,
            'line-opacity': 0.95,
          },
        });
      } catch (err) {
        console.warn('Road network initialization deferred:', err);
      }
    }

    // ─── 3. OpenFreeMap 3D Real Extruded Buildings (Actual Building Footprints Only) ───
    // Requirement:
    // - Only actual individual buildings are extruded; minzoom 14.0 ensures generalized low-zoom blocks are omitted.
    // - Feature filter excludes non-building shapes and hide_3d tags.
    // - Realistic heights: clamped between 3.2m (1 floor) and 150.0m (urban high-rise limit).
    // - Modest default height 6.4m (~2 storeys) for verified building footprints without explicit height tags.
    try {
      if (!map.getLayer('osm-buildings-3d') && map.getSource(vectorSourceId)) {
        map.addLayer({
          id: 'osm-buildings-3d',
          type: 'fill-extrusion',
          source: vectorSourceId,
          'source-layer': 'building',
          minzoom: 14.0,
          filter: [
            'all',
            ['!=', ['get', 'hide_3d'], true],
            ['any',
              ['has', 'render_height'],
              ['has', 'height'],
              ['has', 'levels'],
              ['has', 'building:levels'],
              ['==', ['get', 'building'], 'yes'],
              ['has', 'building']
            ]
          ],
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['min', 120, ['coalesce', ['get', 'render_height'], ['get', 'height'], 6.4]],
              0, '#27272a',
              6, '#3f3f46',
              15, '#52525b',
              35, '#71717a',
              60, '#a1a1aa',
              100, '#d4d4d8'
            ],
            // Use actual mapped heights from OpenFreeMap vector tiles (render_height in meters).
            // Checked against render_height, height, and levels (3.2m/floor), clamped to realistic urban limits [3.2m - 150m].
            'fill-extrusion-height': [
              'min',
              150.0,
              [
                'max',
                3.2,
                [
                  'case',
                  ['has', 'render_height'],
                  ['to-number', ['get', 'render_height'], 6.4],
                  ['has', 'height'],
                  ['to-number', ['get', 'height'], 6.4],
                  ['has', 'levels'],
                  ['*', ['to-number', ['get', 'levels'], 2], 3.2],
                  ['has', 'building:levels'],
                  ['*', ['to-number', ['get', 'building:levels'], 2], 3.2],
                  6.4
                ]
              ]
            ],
            // Base altitude offset for rooftop and multi-level structures (must be non-negative)
            'fill-extrusion-base': [
              'case',
              ['has', 'render_min_height'],
              ['max', 0, ['to-number', ['get', 'render_min_height'], 0]],
              ['has', 'min_height'],
              ['max', 0, ['to-number', ['get', 'min_height'], 0]],
              0
            ],
            'fill-extrusion-opacity': 0.85,
          },
        });
      }
    } catch (err) {
      console.warn('Vector building tile layer initialisation deferred:', err);
    }

    // ─── 4. Coimbatore Verified 3D Landmarks & Elevated Flyovers ───
    const combinedObstacles = [...COIMBATORE_DETAILED_OBSTACLES, ...obstacles.filter(o => !COIMBATORE_DETAILED_OBSTACLES.some(c => c.id === o.id))];

    if (!map.getSource('coimbatore-obstacles')) {
      const obstacleFeatures = combinedObstacles.map((obs) => ({
        type: 'Feature' as const,
        id: obs.id,
        properties: {
          id: obs.id,
          name: obs.name,
          type: obs.type,
          height: obs.physicalHeightMeters ?? obs.heightMeters,
          visual_height: obs.physicalHeightMeters ?? obs.heightMeters,
          physical_height: obs.physicalHeightMeters ?? obs.heightMeters,
          deck_elevation: obs.deckElevationMeters ?? obs.heightMeters,
          deck_thickness: obs.deckThicknessMeters ?? 3.5,
          min_height: 0,
          color: obs.color || (obs.type === 'highway_flyover' ? '#7DD3FC' : '#0284c7'),
          confidence: obs.heightConfidence,
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [obs.coordinates],
        },
      }));

      map.addSource('coimbatore-obstacles', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: obstacleFeatures,
        },
      });

      // 4A. Elevated Highway Viaduct Corridor Casing (2D ground overlay, not 3D extrusion)
      map.addLayer({
        id: '3d-highways-piers',
        type: 'line',
        source: 'coimbatore-obstacles',
        filter: ['==', ['get', 'type'], 'highway_flyover'],
        paint: {
          'line-color': '#0f172a',
          'line-width': 4.5,
          'line-opacity': 0.75,
        },
      });

      // 4B. Elevated Highway Viaduct Corridor Deck Ribbon (2D ground overlay)
      map.addLayer({
        id: '3d-highways-deck',
        type: 'line',
        source: 'coimbatore-obstacles',
        filter: ['==', ['get', 'type'], 'highway_flyover'],
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'conflict'], false], '#ef4444',
            '#64748b'
          ],
          'line-width': 2.8,
          'line-opacity': 0.92,
        },
      });

      // 4C. Prominent 3D Buildings Extrusion (Verified Physical Heights, Capped Realistically, Modern Grey Palette)
      map.addLayer({
        id: '3d-obstacles-extrusion',
        type: 'fill-extrusion',
        source: 'coimbatore-obstacles',
        filter: ['!=', ['get', 'type'], 'highway_flyover'],
        paint: {
          'fill-extrusion-color': [
            'case',
            ['boolean', ['feature-state', 'conflict'], false], '#ef4444',
            ['interpolate',
              ['linear'],
              ['coalesce', ['get', 'physical_height'], ['get', 'height'], 24.0],
              6, '#3f3f46',
              15, '#52525b',
              35, '#71717a',
              60, '#a1a1aa',
              100, '#d4d4d8'
            ]
          ],
          'fill-extrusion-height': [
            'min',
            80.0,
            ['max', 6.0, ['coalesce', ['get', 'physical_height'], ['get', 'height'], 24.0]]
          ],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.90,
        },
      });

      // 2D Footprint outline layer
      map.addLayer({
        id: 'obstacles-2d-outline',
        type: 'line',
        source: 'coimbatore-obstacles',
        paint: {
          'line-color': '#52525b',
          'line-width': 1.5,
        },
      });
    }

    // ─── 5. Flight Routes Source & Layers (A* Rerouted Paths) ─────
    if (!map.getSource('flight-routes')) {
      map.addSource('flight-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Original route (Faded dashed line for comparison after A* reroute)
      map.addLayer({
        id: 'flight-routes-original',
        type: 'line',
        source: 'flight-routes',
        filter: ['==', ['get', 'type'], 'original'],
        paint: {
          'line-color': '#94a3b8',
          'line-width': 2.0,
          'line-dasharray': [2, 2],
          'line-opacity': 0.50,
        },
      });

      // Alternative Candidate Routes (Requirement 4)
      map.addLayer({
        id: 'flight-routes-alternative',
        type: 'line',
        source: 'flight-routes',
        filter: ['==', ['get', 'type'], 'alternative'],
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#818cf8'],
          'line-width': 2.4,
          'line-dasharray': [3, 2],
          'line-opacity': 0.70,
        },
      });

      // Upcoming planned route
      map.addLayer({
        id: 'flight-routes-planned',
        type: 'line',
        source: 'flight-routes',
        filter: ['==', ['get', 'type'], 'planned'],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['coalesce', ['get', 'lineWidth'], 2.4],
          'line-dasharray': [3, 2],
          'line-opacity': ['coalesce', ['get', 'lineOpacity'], 0.85],
        },
      });

      // Active completed trail
      map.addLayer({
        id: 'flight-routes-trail',
        type: 'line',
        source: 'flight-routes',
        filter: ['==', ['get', 'type'], 'trail'],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['coalesce', ['get', 'lineWidth'], 3.5],
          'line-opacity': ['coalesce', ['get', 'lineOpacity'], 0.95],
        },
      });

      // 3D Aerial Flight Corridor Ribbon (True 3D Altitude Visualization above 3D Buildings)
      map.addLayer({
        id: 'flight-routes-3d-corridor',
        type: 'fill-extrusion',
        source: 'flight-routes',
        filter: ['==', ['get', 'is3d'], true],
        paint: {
          'fill-extrusion-color': ['coalesce', ['get', 'color'], '#00f0ff'],
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 67.0],
          'fill-extrusion-base': ['coalesce', ['get', 'base'], 64.0],
          'fill-extrusion-opacity': 0.92,
        },
      });
    }

    // Ensure 3D aerial flight corridor layer exists even if source pre-existed
    if (!map.getLayer('flight-routes-3d-corridor') && map.getSource('flight-routes')) {
      map.addLayer({
        id: 'flight-routes-3d-corridor',
        type: 'fill-extrusion',
        source: 'flight-routes',
        filter: ['==', ['get', 'is3d'], true],
        paint: {
          'fill-extrusion-color': ['coalesce', ['get', 'color'], '#00f0ff'],
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 67.0],
          'fill-extrusion-base': ['coalesce', ['get', 'base'], 64.0],
          'fill-extrusion-opacity': 0.92,
        },
      });
    }

    // ─── 6. Proposed Route Candidate Layer ────────────────────────
    if (!map.getSource('proposed-route')) {
      map.addSource('proposed-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'proposed-route-line',
        type: 'line',
        source: 'proposed-route',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 3.5,
          'line-dasharray': [2, 1.5],
        },
      });
    }

    // Checkpoint Mission Corridor (Standalone Controller & PX4 SITL)
    if (!map.getSource('checkpoint-corridor')) {
      map.addSource('checkpoint-corridor', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'checkpoint-corridor-glow',
        type: 'line',
        source: 'checkpoint-corridor',
        paint: {
          'line-color': '#00f0ff',
          'line-width': 8,
          'line-opacity': 0.35,
          'line-blur': 4,
        },
      });
      map.addLayer({
        id: 'checkpoint-corridor-line',
        type: 'line',
        source: 'checkpoint-corridor',
        filter: ['!=', ['get', 'is3d'], true],
        paint: {
          'line-color': '#00f0ff',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
          'line-opacity': 0.95,
        },
      });
      map.addLayer({
        id: 'checkpoint-corridor-3d',
        type: 'fill-extrusion',
        source: 'checkpoint-corridor',
        filter: ['==', ['get', 'is3d'], true],
        paint: {
          'fill-extrusion-color': '#00f0ff',
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 67.0],
          'fill-extrusion-base': ['coalesce', ['get', 'base'], 64.0],
          'fill-extrusion-opacity': 0.92,
        },
      });
    }

    if (!map.getLayer('checkpoint-corridor-3d') && map.getSource('checkpoint-corridor')) {
      map.addLayer({
        id: 'checkpoint-corridor-3d',
        type: 'fill-extrusion',
        source: 'checkpoint-corridor',
        filter: ['==', ['get', 'is3d'], true],
        paint: {
          'fill-extrusion-color': '#00f0ff',
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 67.0],
          'fill-extrusion-base': ['coalesce', ['get', 'base'], 64.0],
          'fill-extrusion-opacity': 0.92,
        },
      });
    }
  };

  // Sync Airspace Source if zones change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;
    const src = map.getSource('official-airspace-source') as maplibregl.GeoJSONSource;
    if (!src) return;

    const activeZones = officialAirspaceZones !== undefined 
      ? officialAirspaceZones 
      : (airspaceQueryResult ? airspaceQueryResult.zones : OFFICIAL_COIMBATORE_AIRSPACE_ZONES);
    const features = activeZones.map((z) => ({
      type: 'Feature' as const,
      id: z.id,
      properties: {
        id: z.id,
        name: z.name,
        classification: z.classification,
        lowerLimit: z.lowerAltitudeLimitMeters,
        upperLimit: z.upperAltitudeLimitMeters,
        altitudeRef: z.altitudeReference,
        terrainElev: z.terrainElevationMeters,
        permissionRequired: z.permissionRequired,
        authority: z.permissionAuthority,
        source: z.authoritativeSource,
        status: z.status,
        description: z.description,
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [z.coordinates],
      },
    }));

    src.setData({ type: 'FeatureCollection', features });
  }, [officialAirspaceZones, isMapLoaded]);

  // Update Flight Routes GeoJSON dynamically as drones move
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const source = map.getSource('flight-routes') as maplibregl.GeoJSONSource;
    if (!source) return;

    const features: any[] = [];

    drones.forEach((drone, idx) => {
      const isSelected = drone.id === selectedDroneId;
      const themeColor = DRONE_THEME_COLORS[drone.id] || DRONE_COLOR_PALETTE[idx % DRONE_COLOR_PALETTE.length];
      const color = isSelected ? '#00f0ff' : themeColor;
      const lineWidth = isSelected ? 5.5 : 2.0;
      const lineOpacity = isSelected ? 1.0 : 0.35;
      const targetIdx = drone.targetWaypointIndex !== undefined
        ? drone.targetWaypointIndex
        : (drone.currentWaypointIndex === 0 && drone.route.length > 1 ? 1 : drone.currentWaypointIndex);

      // 1. Original route (faded if rerouted, 2D view only)
      if (viewMode !== '3d' && drone.originalRoute && drone.originalRoute.length >= 2) {
        features.push({
          type: 'Feature',
          properties: { color: '#94a3b8', type: 'original', lineWidth: 1.8, lineOpacity: 0.35 },
          geometry: {
            type: 'LineString',
            coordinates: drone.originalRoute.map((wp) => [wp.lng, wp.lat]),
          },
        });
      }

      // 2. Active 2D route (Only in 2D mode! In 3D view mode, no ground line is rendered under/through buildings)
      if (viewMode !== '3d' && drone.route.length >= 2) {
        features.push({
          type: 'Feature',
          properties: {
            color,
            type: 'planned',
            lineWidth: isSelected ? 5.5 : 2.0,
            lineOpacity,
            isSelected,
          },
          geometry: {
            type: 'LineString',
            coordinates: drone.route.map((wp) => [wp.lng, wp.lat]),
          },
        });
      }

      // 2B. True 3D Flight Corridor Ribbon Extrusions (Rendered at exact waypoint altitude in 3D WebGL space)
      if (drone.route.length >= 2) {
        for (let s = 0; s < drone.route.length - 1; s++) {
          const wpA = drone.route[s];
          const wpB = drone.route[s + 1];
          const altA = wpA.altitudeMeters || 65;
          const altB = wpB.altitudeMeters || 65;
          const avgAlt = (altA + altB) / 2;

          const dx = (wpB.lng - wpA.lng) * Math.cos((wpA.lat * Math.PI) / 180);
          const dy = wpB.lat - wpA.lat;
          const len = Math.hypot(dx, dy);
          if (len > 0.000001) {
            const halfWidthDeg = 0.000045; // ~4.5 meters half-width aerial ribbon (9m wide beam)
            const nx = (-dy / len) * halfWidthDeg;
            const ny = (dx / len) * halfWidthDeg;

            const polyCoords = [
              [wpA.lng + nx, wpA.lat + ny],
              [wpB.lng + nx, wpB.lat + ny],
              [wpB.lng - nx, wpB.lat - ny],
              [wpA.lng - nx, wpA.lat - ny],
              [wpA.lng + nx, wpA.lat + ny],
            ];

            features.push({
              type: 'Feature',
              properties: {
                type: 'corridor-3d',
                is3d: true,
                color,
                base: Math.max(0, avgAlt - 1.5),
                height: avgAlt + 1.8,
              },
              geometry: {
                type: 'Polygon',
                coordinates: [polyCoords],
              },
            });
          }
        }

        // 3D Waypoint Markings Directly In The Line & Vertipad Beacons
        drone.route.forEach((wp, wpIdx) => {
          const wpAlt = wp.altitudeMeters || 65;
          const isTakeoff = wpIdx === 0;
          const isLanding = wpIdx === drone.route.length - 1;
          const isCurrentTarget = wpIdx === targetIdx;

          // 1. Vertical Pylon Anchor Column (Ground to Altitude) - ONLY at Takeoff & Landing Pads!
          // NEVER at intermediate cruise waypoints to ensure flight corridors cleanly float above buildings without piercing roofs or interiors!
          if (isTakeoff || isLanding) {
            const pylonRadius = 0.000018; // ~2m radius pad beacon
            features.push({
              type: 'Feature',
              properties: {
                type: 'pylon-3d',
                is3d: true,
                color: isLanding ? '#f43f5e' : (isSelected ? '#00f0ff' : color),
                base: 0,
                height: Math.max(1, wpAlt - 0.5),
              },
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [wp.lng - pylonRadius, wp.lat - pylonRadius],
                  [wp.lng + pylonRadius, wp.lat - pylonRadius],
                  [wp.lng + pylonRadius, wp.lat + pylonRadius],
                  [wp.lng - pylonRadius, wp.lat + pylonRadius],
                  [wp.lng - pylonRadius, wp.lat - pylonRadius],
                ]],
              },
            });
          }

          // 2. 3D Waypoint Marking Collar / Gate Embedded Directly In The Line
          const prevWp = drone.route[Math.max(0, wpIdx - 1)];
          const nextWp = drone.route[Math.min(drone.route.length - 1, wpIdx + 1)];
          const dirX = (nextWp.lng - prevWp.lng) * Math.cos((wp.lat * Math.PI) / 180);
          const dirY = nextWp.lat - prevWp.lat;
          const dirLen = Math.hypot(dirX, dirY) || 1;
          const tx = dirX / dirLen;
          const ty = dirY / dirLen;
          const nx = -ty; // Perpendicular normal
          const ny = tx;

          const gateHalfWidthDeg = isCurrentTarget ? 0.000065 : 0.000050; // ~5.5-7m across ribbon
          const gateThicknessDeg = isCurrentTarget ? 0.000020 : 0.000014; // ~1.5-2m along ribbon
          const cosLat = Math.cos((wp.lat * Math.PI) / 180);

          const gP1 = [wp.lng + (nx * gateHalfWidthDeg + tx * gateThicknessDeg) / cosLat, wp.lat + (ny * gateHalfWidthDeg + ty * gateThicknessDeg)];
          const gP2 = [wp.lng + (-nx * gateHalfWidthDeg + tx * gateThicknessDeg) / cosLat, wp.lat + (-ny * gateHalfWidthDeg + ty * gateThicknessDeg)];
          const gP3 = [wp.lng + (-nx * gateHalfWidthDeg - tx * gateThicknessDeg) / cosLat, wp.lat + (-ny * gateHalfWidthDeg - ty * gateThicknessDeg)];
          const gP4 = [wp.lng + (nx * gateHalfWidthDeg - tx * gateThicknessDeg) / cosLat, wp.lat + (ny * gateHalfWidthDeg - ty * gateThicknessDeg)];

          const gateColor = isLanding ? '#f43f5e' : isCurrentTarget ? '#ffffff' : (wpIdx < targetIdx ? '#10b981' : '#38bdf8');
          const gateBase = Math.max(0, wpAlt - (isCurrentTarget ? 1.0 : 0.5));
          const gateHeight = wpAlt + (isCurrentTarget ? 2.8 : 1.8);

          features.push({
            type: 'Feature',
            properties: {
              type: 'waypoint-3d-gate',
              is3d: true,
              color: gateColor,
              base: gateBase,
              height: gateHeight,
            },
            geometry: {
              type: 'Polygon',
              coordinates: [[gP1, gP2, gP3, gP4, gP1]],
            },
          });
        });

        // 3. True 3D Drone Craft Geometry Directly On The 3D Line (Drone follows the 3D line in WebGL space)
        const dAlt = drone.vitals.altitudeMeters || 65;
        const dR = 0.000028; // ~3m radius drone airframe
        const dLng = drone.vitals.longitude;
        const dLat = drone.vitals.latitude;
        features.push({
          type: 'Feature',
          properties: {
            type: 'drone-3d-craft',
            is3d: true,
            color: isSelected ? '#ffffff' : '#00f0ff',
            base: Math.max(0, dAlt - 0.5),
            height: dAlt + 2.5,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [dLng, dLat + dR],
              [dLng + dR * 0.866, dLat + dR * 0.5],
              [dLng + dR * 0.866, dLat - dR * 0.5],
              [dLng, dLat - dR],
              [dLng - dR * 0.866, dLat - dR * 0.5],
              [dLng - dR * 0.866, dLat + dR * 0.5],
              [dLng, dLat + dR],
            ]],
          },
        });
      }

      // 2C. Alternative candidate routes (2D mode only)
      if (viewMode !== '3d' && isSelected && drone.routeCandidates && drone.routeCandidates.length > 1) {
        drone.routeCandidates.forEach((cand) => {
          if (cand.id !== drone.selectedCandidateId && cand.waypoints.length >= 2) {
            features.push({
              type: 'Feature',
              properties: {
                color: cand.color || '#818cf8',
                type: 'alternative',
                candidateId: cand.id,
                candidateName: cand.name,
              },
              geometry: {
                type: 'LineString',
                coordinates: cand.waypoints.map((wp) => [wp.lng, wp.lat]),
              },
            });
          }
        });
      }

      // 3. Traveled flight trail (2D mode only to prevent cutting through 3D buildings)
      if (viewMode !== '3d' && drone.flightTrail && drone.flightTrail.length >= 2) {
        features.push({
          type: 'Feature',
          properties: { color, type: 'trail', lineWidth: lineWidth * 0.85, lineOpacity: lineOpacity * 0.9 },
          geometry: {
            type: 'LineString',
            coordinates: drone.flightTrail,
          },
        });
      }
    });

    source.setData({
      type: 'FeatureCollection',
      features,
    });
    // Fade obstacles within 40m of active route (Requirement 1: fade buildings near route)
    const activeDrone = drones.find((d) => d.id === selectedDroneId) || drones[0];
    if (activeDrone && activeDrone.route && activeDrone.route.length >= 2) {
      const allObstacles = [
        ...COIMBATORE_DETAILED_OBSTACLES,
        ...obstacles.filter((o) => !COIMBATORE_DETAILED_OBSTACLES.some((c) => c.id === o.id)),
      ];
      allObstacles.forEach((obs: Obstacle) => {
        let isNear = false;
        for (const wp of activeDrone.route) {
          const d = getDistanceMeters(wp.lat, wp.lng, obs.center[1], obs.center[0]);
          if (d < 50) {
            isNear = true;
            break;
          }
        }
        try {
          map.setFeatureState(
            { source: 'coimbatore-obstacles', id: obs.id },
            { nearRoute: isNear }
          );
        } catch (_) {}
      });
    }
  }, [drones, selectedDroneId, isMapLoaded, obstacles, viewMode]);

  // Update Proposed Replan Route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const source = map.getSource('proposed-route') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (proposedRoute && proposedRoute.length >= 2) {
      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: proposedRoute.map((wp) => [wp.lng, wp.lat]),
            },
          },
        ],
      });
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [proposedRoute, isMapLoaded]);

  // Update Drone Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    // Clean up markers for removed drones
    const currentDroneIds = new Set(drones.map((d) => d.id));
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentDroneIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    drones.forEach((drone, idx) => {
      const isSelected = drone.id === selectedDroneId;
      const activeConflict = obstacleConflicts.find((c) => c.droneId === drone.id) || null;
      const themeColor = DRONE_THEME_COLORS[drone.id] || DRONE_COLOR_PALETTE[idx % DRONE_COLOR_PALETTE.length];

      let marker = markersRef.current[drone.id];

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'drone-marker-container';
        el.style.width = '80px';
        el.style.height = '80px';
        el.style.position = 'absolute';
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'pointer';
        el.innerHTML = buildMarkerHtml(drone, isSelected, activeConflict, themeColor);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectDrone(drone.id);
        });

        let dronePixelRise = 0;
        if (viewMode === '3d') {
          const pitchDeg = map.getPitch();
          if (pitchDeg > 5) {
            const pitchRad = (pitchDeg * Math.PI) / 180;
            const zoom = map.getZoom();
            const metersPerPixel = (156543.03392 * Math.cos((drone.vitals.latitude * Math.PI) / 180)) / Math.pow(2, zoom);
            const alt = drone.vitals.altitudeMeters || 65;
            dronePixelRise = Math.round((alt / Math.max(0.1, metersPerPixel)) * Math.sin(pitchRad));
            dronePixelRise = Math.min(180, Math.max(0, dronePixelRise));
          }
        }

        marker = new maplibregl.Marker({
          element: el,
          anchor: 'center',
          offset: [0, -dronePixelRise],
          pitchAlignment: 'viewport',
          rotationAlignment: 'viewport',
        })
          .setLngLat([drone.vitals.longitude, drone.vitals.latitude])
          .addTo(map);

        markersRef.current[drone.id] = marker;
      } else {
        const markerElement = marker.getElement();
        let dronePixelRise = 0;
        if (viewMode === '3d') {
          const pitchDeg = map.getPitch();
          if (pitchDeg > 5) {
            const pitchRad = (pitchDeg * Math.PI) / 180;
            const zoom = map.getZoom();
            const metersPerPixel = (156543.03392 * Math.cos((drone.vitals.latitude * Math.PI) / 180)) / Math.pow(2, zoom);
            const alt = drone.vitals.altitudeMeters || 65;
            dronePixelRise = Math.round((alt / Math.max(0.1, metersPerPixel)) * Math.sin(pitchRad));
            dronePixelRise = Math.min(180, Math.max(0, dronePixelRise));
          }
        }
        marker.setOffset([0, -dronePixelRise]);
        marker.setLngLat([drone.vitals.longitude, drone.vitals.latitude]);
        markerElement.innerHTML = buildMarkerHtml(drone, isSelected, activeConflict, themeColor);
      }
    });
  }, [drones, selectedDroneId, obstacleConflicts, isMapLoaded, onSelectDrone, viewMode]);

  // 12-Layer Dynamic Visibility Synchronization
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    // 1. Satellite
    if (map.getLayer('satellite-tiles')) {
      map.setLayoutProperty('satellite-tiles', 'visibility', layerSatellite ? 'visible' : 'none');
    }
    // 2. 3D Buildings
    ['3d-obstacles-extrusion', 'osm-buildings-3d'].forEach((l) => {
      if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', layer3DBuildings ? 'visible' : 'none');
    });
    // 3. Ground Roads
    ['roads-local', 'roads-secondary'].forEach((l) => {
      if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', layerGroundRoads ? 'visible' : 'none');
    });
    // 4. Major Roads
    if (map.getLayer('roads-primary')) {
      map.setLayoutProperty('roads-primary', 'visibility', layerMajorRoads ? 'visible' : 'none');
    }
    // 5. Elevated Highways
    ['roads-highway-casing', 'roads-highway'].forEach((l) => {
      if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', layerElevatedHighways ? 'visible' : 'none');
    });
    // 6. Flyovers
    ['3d-highways-piers', '3d-highways-deck'].forEach((l) => {
      if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', layerFlyovers ? 'visible' : 'none');
    });
    // 7. Airspace Zones
    ['airspace-zones-fill', 'airspace-zones-outline'].forEach((l) => {
      if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', layerAirspaceZones ? 'visible' : 'none');
    });
    // 8. Obstacles 2D
    if (map.getLayer('obstacles-2d-outline')) {
      map.setLayoutProperty('obstacles-2d-outline', 'visibility', layerObstacles ? 'visible' : 'none');
    }
    // 9. Planned Routes & Corridors
    if (map.getLayer('flight-routes-planned')) {
      map.setLayoutProperty(
        'flight-routes-planned',
        'visibility',
        layerPlannedRoutes && viewMode !== '3d' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('flight-routes-original')) {
      map.setLayoutProperty(
        'flight-routes-original',
        'visibility',
        layerPlannedRoutes && viewMode !== '3d' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('flight-routes-alternative')) {
      map.setLayoutProperty(
        'flight-routes-alternative',
        'visibility',
        layerPlannedRoutes && viewMode !== '3d' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('flight-routes-trail')) {
      map.setLayoutProperty(
        'flight-routes-trail',
        'visibility',
        layerPlannedRoutes && viewMode !== '3d' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('proposed-route-line')) {
      map.setLayoutProperty(
        'proposed-route-line',
        'visibility',
        viewMode !== '3d' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('flight-routes-3d-corridor')) {
      map.setLayoutProperty(
        'flight-routes-3d-corridor',
        'visibility',
        layerPlannedRoutes && viewMode === '3d' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('checkpoint-corridor-3d')) {
      map.setLayoutProperty(
        'checkpoint-corridor-3d',
        'visibility',
        viewMode === '3d' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('checkpoint-corridor-line')) {
      map.setLayoutProperty(
        'checkpoint-corridor-line',
        'visibility',
        viewMode !== '3d' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('checkpoint-corridor-glow')) {
      map.setLayoutProperty(
        'checkpoint-corridor-glow',
        'visibility',
        viewMode !== '3d' ? 'visible' : 'none'
      );
    }
  }, [
    isMapLoaded,
    viewMode,
    layerSatellite,
    layer3DBuildings,
    layerGroundRoads,
    layerMajorRoads,
    layerElevatedHighways,
    layerFlyovers,
    layerAirspaceZones,
    layerObstacles,
    layerPlannedRoutes,
  ]);

  // Render Waypoint Markers with Directional Chevrons
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || !layerWaypoints) {
      waypointMarkersRef.current.forEach((m) => m.remove());
      waypointMarkersRef.current = [];
      return;
    }

    waypointMarkersRef.current.forEach((m) => m.remove());
    waypointMarkersRef.current = [];

    const selectedDrone = drones.find((d) => d.id === selectedDroneId) || drones[0];
    if (!selectedDrone) return;

    const targetIdx = selectedDrone.targetWaypointIndex !== undefined
      ? selectedDrone.targetWaypointIndex
      : (selectedDrone.currentWaypointIndex === 0 && selectedDrone.route.length > 1 ? 1 : selectedDrone.currentWaypointIndex);

    selectedDrone.route.forEach((wp, idx) => {
      const isSelected = wp.id === selectedWaypointId;
      const wpNumber = String(idx + 1).padStart(2, '0');
      const isCurrentLeg = idx === targetIdx;
      const isReached = wp.status === 'completed' || idx < targetIdx;
      const isDestination = idx === selectedDrone.route.length - 1 || wp.type === 'delivery';

      // In 3D view mode: waypoints are marked in 3D directly in the aerial corridor ribbon!
      // Remove separate point markers that clutter the map below the line; reserve HTML cards only for inspected/destination waypoints.
      if (viewMode === '3d' && !isSelected && !isDestination) {
        return;
      }

      const distToWp = isCurrentLeg && selectedDrone.distanceToNextWaypointMeters !== undefined
        ? selectedDrone.distanceToNextWaypointMeters
        : Math.round(
            getDistanceMeters(selectedDrone.vitals.latitude, selectedDrone.vitals.longitude, wp.lat, wp.lng)
          );
      const formattedDist = formatWaypointDistance(distToWp);
      const wpNavStatus = selectedDrone.nextWaypointStatus || (distToWp <= 20 ? 'WAYPOINT_REACHED' : distToWp <= 150 ? 'NEAR_WAYPOINT' : 'APPROACHING');

      const el = document.createElement('div');
      el.className = 'waypoint-marker';
      el.style.cursor = 'pointer';
      el.style.userSelect = 'none';

      let statusBadge = '';
      let borderStyle = '1.5px solid #00f0ff';
      let bgStyle = 'rgba(10, 16, 28, 0.94)';
      let pulseRing = '';

      if (isReached && !isSelected) {
        // Sleek Minimalist PASSED Checkpoint Point (declutter-reduction)
        el.innerHTML = `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            width: 14px;
            height: 14px;
          " title="${wp.name} [PASSED] • Alt: ${wp.altitudeMeters}m AGL • Coords: ${wp.lat.toFixed(4)}°N, ${wp.lng.toFixed(4)}°E">
            <div style="
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: #10b981;
              border: 1px solid #022c1b;
              box-shadow: 0 0 4px rgba(16, 185, 129, 0.7);
            "></div>
          </div>
        `;
      } else if (!isCurrentLeg && !isDestination && !isSelected) {
        // Sleek Tactical Checkpoint Point (Small Point Design for Decluttered Flight View)
        el.innerHTML = `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            width: 16px;
            height: 16px;
            transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          " title="WP-${wpNumber} • ${wp.name} • Alt: ${wp.altitudeMeters}m AGL • Coords: ${wp.lat.toFixed(4)}°N, ${wp.lng.toFixed(4)}°E">
            <div style="
              width: 7px;
              height: 7px;
              border-radius: 50%;
              background: #00f0ff;
              border: 1.5px solid #021a24;
              box-shadow: 0 0 6px rgba(0, 240, 255, 0.9);
              transition: transform 0.15s ease, box-shadow 0.15s ease;
            "></div>
          </div>
        `;
      } else if (isDestination && !isSelected) {
        // Sleek Destination Pad Point
        el.innerHTML = `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            width: 20px;
            height: 20px;
          " title="DESTINATION PAD: ${wp.name} • Alt: ${wp.altitudeMeters}m AGL (${formattedDist})">
            <div style="
              position: absolute;
              width: 18px;
              height: 18px;
              border-radius: 50%;
              border: 1.5px solid #f43f5e;
              background: rgba(244, 63, 94, 0.2);
              animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
              pointer-events: none;
            "></div>
            <div style="
              width: 9px;
              height: 9px;
              border-radius: 50%;
              background: #f43f5e;
              border: 1.5px solid #ffffff;
              box-shadow: 0 0 8px #f43f5e;
            "></div>
          </div>
        `;
      } else {
        if (isReached) {
          borderStyle = '1.5px solid #10b981';
          bgStyle = 'rgba(6, 28, 18, 0.92)';
          statusBadge = `<span style="background: #10b981; color: #021a10; font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 2px;">✓ PASSED</span>`;
        } else if (isCurrentLeg) {
          if (wpNavStatus === 'WAYPOINT_REACHED' || distToWp <= 20) {
            borderStyle = '2px solid #10b981';
            bgStyle = 'rgba(6, 32, 20, 0.96)';
            statusBadge = `<span style="background: #10b981; color: #021a10; font-size: 9px; font-weight: 900; padding: 1.5px 5px; border-radius: 2px; animation: pulse 0.8s infinite;">✓ WAYPOINT REACHED</span>`;
            pulseRing = `
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                width: 76px;
                height: 76px;
                margin-top: -38px;
                margin-left: -38px;
                border-radius: 50%;
                border: 2px solid #10b981;
                background: rgba(16, 185, 129, 0.2);
                box-shadow: 0 0 18px #10b981;
                animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;
                pointer-events: none;
                z-index: 0;
              "></div>
            `;
          } else if (wpNavStatus === 'NEAR_WAYPOINT' || distToWp <= 150) {
            borderStyle = '2px solid #f59e0b';
            bgStyle = 'rgba(35, 20, 4, 0.96)';
            statusBadge = `<span style="background: #f59e0b; color: #1a0f00; font-size: 9px; font-weight: 900; padding: 1.5px 5px; border-radius: 2px; animation: pulse 0.7s infinite;">⚡ NEAR TARGET (${formattedDist})</span>`;
            pulseRing = `
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                width: 74px;
                height: 74px;
                margin-top: -37px;
                margin-left: -37px;
                border-radius: 50%;
                border: 2px solid #f59e0b;
                background: rgba(245, 158, 11, 0.2);
                box-shadow: 0 0 16px #f59e0b;
                animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;
                pointer-events: none;
                z-index: 0;
              "></div>
            `;
          } else {
            borderStyle = '2px solid #00f0ff';
            bgStyle = 'rgba(8, 28, 45, 0.96)';
            statusBadge = `<span style="background: #00f0ff; color: #020611; font-size: 9px; font-weight: 900; padding: 1.5px 5px; border-radius: 2px; animation: pulse 1s infinite;">▶ NEXT TARGET (${formattedDist})</span>`;
            pulseRing = `
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                width: 72px;
                height: 72px;
                margin-top: -36px;
                margin-left: -36px;
                border-radius: 50%;
                border: 2px solid #00f0ff;
                background: rgba(0, 240, 255, 0.15);
                box-shadow: 0 0 16px #00f0ff;
                animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
                pointer-events: none;
                z-index: 0;
              "></div>
            `;
          }
        } else if (isDestination) {
          borderStyle = '2px solid #f43f5e';
          bgStyle = 'rgba(38, 10, 22, 0.94)';
          statusBadge = `<span style="background: #f43f5e; color: #ffffff; font-size: 9px; font-weight: 800; padding: 1px 4px; border-radius: 2px;">DEST PAD (${formattedDist})</span>`;
        }

        el.innerHTML = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            ${pulseRing}
            <div style="
              position: relative;
              z-index: 2;
              display: flex;
              flex-direction: column;
              background: ${bgStyle};
              border: ${borderStyle};
              padding: 3px 7px;
              border-radius: 5px;
              box-shadow: 0 4px 14px rgba(0,0,0,0.85), ${isSelected ? '0 0 16px #00f0ff' : isCurrentLeg ? '0 0 14px rgba(0,240,255,0.5)' : 'none'};
              min-width: 110px;
              max-width: 190px;
              backdrop-filter: blur(8px);
              transition: all 0.2s ease;
            ">
              <!-- Header: WP Number & Status -->
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px;">
                <span style="
                  color: ${isReached ? '#34d399' : isCurrentLeg ? '#00f0ff' : '#38bdf8'};
                  font-family: ui-monospace, SFMono-Regular, monospace;
                  font-size: 10px;
                  font-weight: 900;
                ">
                  WP-${wpNumber}
                </span>
                ${statusBadge}
              </div>

              <!-- Body: Waypoint Label / Name -->
              <div style="
                color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 10px;
                font-weight: 700;
                margin-top: 2px;
                line-height: 1.25;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              " title="${wp.name}">
                ${wp.name}
              </div>

              <!-- Footer: Altitude clearance & type -->
              <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-top: 2px;
                padding-top: 2px;
                font-family: ui-monospace, monospace;
                font-size: 9px;
                color: #94a3b8;
              ">
                <span style="color: #38bdf8; font-weight: 700;">Alt: ${wp.altitudeMeters}m AGL</span>
                <span style="text-transform: uppercase; font-size: 8px;">${wp.type}</span>
              </div>
            </div>
          </div>
        `;
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectWaypoint(wp.id);
      });

      let pixelRise = 0;
      if (viewMode === '3d') {
        const pitchDeg = map.getPitch();
        if (pitchDeg > 5) {
          const pitchRad = (pitchDeg * Math.PI) / 180;
          const zoom = map.getZoom();
          const metersPerPixel = (156543.03392 * Math.cos((wp.lat * Math.PI) / 180)) / Math.pow(2, zoom);
          const alt = wp.altitudeMeters || 65;
          pixelRise = Math.round((alt / Math.max(0.1, metersPerPixel)) * Math.sin(pitchRad));
          pixelRise = Math.min(180, Math.max(0, pixelRise));
        }
      }

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
        offset: [0, -pixelRise],
      })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map);

      waypointMarkersRef.current.push(marker);
    });
  }, [drones, selectedDroneId, selectedWaypointId, layerWaypoints, isMapLoaded, onSelectWaypoint, viewMode]);

  // Dynamic update of waypoint marker vertical offsets during 3D camera tilt/zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || viewMode !== '3d') return;

    const handleCameraMove = () => {
      const pitchDeg = map.getPitch();
      const pitchRad = (pitchDeg * Math.PI) / 180;
      const zoom = map.getZoom();
      const selectedDrone = drones.find((d) => d.id === selectedDroneId);
      if (!selectedDrone || !selectedDrone.route) return;

      selectedDrone.route.forEach((wp, idx) => {
        const marker = waypointMarkersRef.current[idx];
        if (marker) {
          const metersPerPixel = (156543.03392 * Math.cos((wp.lat * Math.PI) / 180)) / Math.pow(2, zoom);
          const alt = wp.altitudeMeters || 65;
          const pixelRise = pitchDeg > 5
            ? Math.min(180, Math.max(0, Math.round((alt / Math.max(0.1, metersPerPixel)) * Math.sin(pitchRad))))
            : 0;
          marker.setOffset([0, -pixelRise]);
        }
      });
    };

    map.on('pitch', handleCameraMove);
    map.on('zoom', handleCameraMove);
    return () => {
      map.off('pitch', handleCameraMove);
      map.off('zoom', handleCameraMove);
    };
  }, [drones, selectedDroneId, isMapLoaded, viewMode]);

  // Render Destination Markers & Landings
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || !layerDestinations) {
      Object.values(destinationMarkersRef.current).forEach((m) => m.remove());
      destinationMarkersRef.current = {};
      checkpointMarkersRef.current.forEach((m) => m.remove());
      checkpointMarkersRef.current = [];
      if (simDroneMarkerRef.current) {
        simDroneMarkerRef.current.remove();
        simDroneMarkerRef.current = null;
      }
      return;
    }

    // Clean up destination markers for removed drones
    const currentDroneIds = new Set(drones.map((d) => d.id));
    Object.keys(destinationMarkersRef.current).forEach((id) => {
      if (!currentDroneIds.has(id)) {
        destinationMarkersRef.current[id].remove();
        delete destinationMarkersRef.current[id];
      }
    });

    drones.forEach((drone, idx) => {
      const destCoords = drone.missionDestinationCoords || (
        drone.route.find((w) => w.type === 'delivery')?.lng ? [
          drone.route.find((w) => w.type === 'delivery')!.lng,
          drone.route.find((w) => w.type === 'delivery')!.lat
        ] : null
      );
      if (!destCoords) return;

      let marker = destinationMarkersRef.current[drone.id];
      const isSelected = drone.id === selectedDroneId;
      const color = isSelected ? '#00f0ff' : (DRONE_THEME_COLORS[drone.id] || DRONE_COLOR_PALETTE[idx % DRONE_COLOR_PALETTE.length]);
      const destName = drone.missionDestinationName || 'Mission Pad';
      const dist = drone.distanceRemainingKm !== undefined ? `${drone.distanceRemainingKm} km` : '';
      const eta = drone.etaSecondsRemaining !== undefined ? `${Math.ceil(drone.etaSecondsRemaining / 60)}m` : '';

      const markerHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; pointer-events: auto; cursor: pointer; position: relative;">
          ${isSelected ? `
            <div style="
              position: absolute;
              bottom: 0;
              width: 50px;
              height: 50px;
              border-radius: 50%;
              border: 2px solid #00f0ff;
              background: rgba(0, 240, 255, 0.2);
              animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
              pointer-events: none;
            "></div>
          ` : ''}
          <div style="
            background: rgba(10, 16, 28, 0.96);
            border: ${isSelected ? '2px solid #00f0ff' : `1.5px solid ${color}`};
            border-radius: 4px;
            padding: 3px 9px;
            color: #ffffff;
            font-family: ui-monospace, monospace;
            font-size: 10px;
            font-weight: 800;
            white-space: nowrap;
            box-shadow: ${isSelected ? '0 0 20px #00f0ff, 0 4px 14px rgba(0,0,0,0.9)' : `0 0 14px ${color}80, 0 4px 12px rgba(0,0,0,0.8)`};
            display: flex;
            align-items: center;
            gap: 6px;
            z-index: 2;
          ">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${color}; box-shadow: 0 0 8px ${color};"></span>
            <span style="color: ${color}; font-weight: 900;">${drone.callsign} DESTINATION</span>
            ${isSelected ? `<span style="background: #00f0ff; color: #020611; font-size: 8px; font-weight: 900; padding: 1px 4px; border-radius: 2px;">ACTIVE TARGET</span>` : ''}
          </div>

          <div style="
            margin-top: 2px;
            background: rgba(15, 23, 42, 0.94);
            border: 1px solid ${isSelected ? '#00f0ff88' : '#334155'};
            border-radius: 3px;
            padding: 2px 7px;
            color: #e2e8f0;
            font-family: ui-monospace, monospace;
            font-size: 9px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.6);
            z-index: 2;
          ">
            ${destName} ${dist ? `• <span style="color: #38bdf8; font-weight: 700;">${dist}</span>` : ''} ${eta ? `(${eta})` : ''}
          </div>

          <div style="
            width: 14px;
            height: 14px;
            margin-top: 3px;
            background: ${color};
            clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
            box-shadow: 0 0 10px ${color};
            z-index: 2;
          "></div>
          <div style="width: 2px; height: 6px; background: ${color}; z-index: 2;"></div>
          <div style="width: 6px; height: 6px; border-radius: 50%; background: ${color}; box-shadow: 0 0 6px ${color}; z-index: 2;"></div>
        </div>
      `;

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'destination-marker-container';
        el.innerHTML = markerHtml;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectDrone(drone.id);
        });

        marker = new maplibregl.Marker({
          element: el,
          anchor: 'bottom',
        })
          .setLngLat([destCoords[0], destCoords[1]])
          .addTo(map);

        destinationMarkersRef.current[drone.id] = marker;
      } else {
        marker.getElement().innerHTML = markerHtml;
        marker.setLngLat([destCoords[0], destCoords[1]]);
      }
    });
  }, [drones, selectedDroneId, layerDestinations, isMapLoaded, onSelectDrone]);

  // Interactive Map-Click Destination Picking Handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    if (!isMapPickingDestination) {
      map.getCanvas().style.cursor = '';
      return;
    }

    map.getCanvas().style.cursor = 'crosshair';

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (!isMapPickingDestination || !onMapPickDestination) return;
      const { lng, lat } = e.lngLat;
      onMapPickDestination([lng, lat]);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
      map.getCanvas().style.cursor = '';
    };
  }, [isMapPickingDestination, isMapLoaded, onMapPickDestination]);

  // Temporary Destination Preview Marker (when picking or configured)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    if (!tempDestinationCoords) {
      if (tempDestMarkerRef.current) {
        tempDestMarkerRef.current.remove();
        tempDestMarkerRef.current = null;
      }
      return;
    }

    if (!tempDestMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'temp-destination-pin';
      el.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; pointer-events: none; position: relative;">
          <div style="
            position: absolute;
            bottom: 0;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: 2px solid #00f0ff;
            background: rgba(0, 240, 255, 0.25);
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <div style="
            background: rgba(12, 18, 30, 0.96);
            border: 2px solid #00f0ff;
            border-radius: 4px;
            padding: 3px 8px;
            color: #00f0ff;
            font-family: ui-monospace, monospace;
            font-size: 10px;
            font-weight: 800;
            box-shadow: 0 4px 14px rgba(0,0,0,0.8), 0 0 12px rgba(0,240,255,0.6);
            white-space: nowrap;
            margin-bottom: 3px;
          ">
            📍 PICKED DESTINATION
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#00f0ff" stroke="#000000" stroke-width="1.5">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5" fill="#000000"/>
          </svg>
        </div>
      `;
      tempDestMarkerRef.current = new maplibregl.Marker({
        element: el,
        anchor: 'bottom',
      })
        .setLngLat([tempDestinationCoords[0], tempDestinationCoords[1]])
        .addTo(map);
    } else {
      tempDestMarkerRef.current.setLngLat([tempDestinationCoords[0], tempDestinationCoords[1]]);
    }
  }, [tempDestinationCoords, isMapLoaded]);

  // === RENDER CHECKPOINT MISSION CORRIDOR & CHECKPOINT MARKERS ===
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    checkpointMarkersRef.current.forEach((m) => m.remove());
    checkpointMarkersRef.current = [];

    const source = map.getSource('checkpoint-corridor') as maplibregl.GeoJSONSource;

    if (checkpointMission && checkpointMission.checkpoints.length > 0) {
      if (source) {
        const features: any[] = [];
        if (viewMode !== '3d') {
          features.push({
            type: 'Feature',
            properties: { is3d: false },
            geometry: {
              type: 'LineString',
              coordinates: checkpointMission.checkpoints.map((cp) => [cp.lng, cp.lat]),
            },
          });
        } else {
          // True 3D aerial corridor for checkpoints above buildings
          for (let s = 0; s < checkpointMission.checkpoints.length - 1; s++) {
            const cpA = checkpointMission.checkpoints[s];
            const cpB = checkpointMission.checkpoints[s + 1];
            const altA = cpA.altitudeMeters || 65;
            const altB = cpB.altitudeMeters || 65;
            const avgAlt = (altA + altB) / 2;

            const dx = (cpB.lng - cpA.lng) * Math.cos((cpA.lat * Math.PI) / 180);
            const dy = cpB.lat - cpA.lat;
            const len = Math.hypot(dx, dy);
            if (len > 0.000001) {
              const halfWidthDeg = 0.000045;
              const nx = (-dy / len) * halfWidthDeg;
              const ny = (dx / len) * halfWidthDeg;

              features.push({
                type: 'Feature',
                properties: {
                  is3d: true,
                  color: '#00f0ff',
                  base: Math.max(0, avgAlt - 1.5),
                  height: avgAlt + 1.8,
                },
                geometry: {
                  type: 'Polygon',
                  coordinates: [[
                    [cpA.lng + nx, cpA.lat + ny],
                    [cpB.lng + nx, cpB.lat + ny],
                    [cpB.lng - nx, cpB.lat - ny],
                    [cpA.lng - nx, cpA.lat - ny],
                    [cpA.lng + nx, cpA.lat + ny],
                  ]],
                },
              });
            }
          }

          // Pylons and nodes for checkpoints (Zero ground pylons at cruise checkpoints above buildings)
          checkpointMission.checkpoints.forEach((cp, cpIdx) => {
            const cpAlt = cp.altitudeMeters || 65;
            const isTakeoff = cpIdx === 0;
            const isLanding = cpIdx === checkpointMission.checkpoints.length - 1;
            const isActive = cp.status === 'active';

            // Vertical anchor column ONLY at takeoff and landing pads
            if (isTakeoff || isLanding) {
              const pylonR = 0.000018;
              features.push({
                type: 'Feature',
                properties: { is3d: true, color: isLanding ? '#f43f5e' : '#00f0ff', base: 0, height: Math.max(1, cpAlt - 0.5) },
                geometry: {
                  type: 'Polygon',
                  coordinates: [[
                    [cp.lng - pylonR, cp.lat - pylonR],
                    [cp.lng + pylonR, cp.lat - pylonR],
                    [cp.lng + pylonR, cp.lat + pylonR],
                    [cp.lng - pylonR, cp.lat + pylonR],
                    [cp.lng - pylonR, cp.lat - pylonR],
                  ]],
                },
              });
            }

            // 3D Transverse Checkpoint Marking Gate in the 3D Line
            const prevCp = checkpointMission.checkpoints[Math.max(0, cpIdx - 1)];
            const nextCp = checkpointMission.checkpoints[Math.min(checkpointMission.checkpoints.length - 1, cpIdx + 1)];
            const dirX = (nextCp.lng - prevCp.lng) * Math.cos((cp.lat * Math.PI) / 180);
            const dirY = nextCp.lat - prevCp.lat;
            const dirLen = Math.hypot(dirX, dirY) || 1;
            const tx = dirX / dirLen;
            const ty = dirY / dirLen;
            const nx = -ty;
            const ny = tx;

            const gateHalfWidthDeg = isActive ? 0.000065 : 0.000050;
            const gateThicknessDeg = isActive ? 0.000020 : 0.000014;
            const cosLat = Math.cos((cp.lat * Math.PI) / 180);

            const gP1 = [cp.lng + (nx * gateHalfWidthDeg + tx * gateThicknessDeg) / cosLat, cp.lat + (ny * gateHalfWidthDeg + ty * gateThicknessDeg)];
            const gP2 = [cp.lng + (-nx * gateHalfWidthDeg + tx * gateThicknessDeg) / cosLat, cp.lat + (-ny * gateHalfWidthDeg + ty * gateThicknessDeg)];
            const gP3 = [cp.lng + (-nx * gateHalfWidthDeg - tx * gateThicknessDeg) / cosLat, cp.lat + (-ny * gateHalfWidthDeg - ty * gateThicknessDeg)];
            const gP4 = [cp.lng + (nx * gateHalfWidthDeg - tx * gateThicknessDeg) / cosLat, cp.lat + (ny * gateHalfWidthDeg - ty * gateThicknessDeg)];

            const gateColor = isLanding ? '#f43f5e' : isActive ? '#ffffff' : (cp.status === 'reached' ? '#10b981' : '#38bdf8');
            features.push({
              type: 'Feature',
              properties: {
                is3d: true,
                color: gateColor,
                base: Math.max(0, cpAlt - (isActive ? 1.0 : 0.5)),
                height: cpAlt + (isActive ? 2.8 : 1.8),
              },
              geometry: {
                type: 'Polygon',
                coordinates: [[gP1, gP2, gP3, gP4, gP1]],
              },
            });
          });
        }

        source.setData({
          type: 'FeatureCollection',
          features,
        } as any);
      }

      checkpointMission.checkpoints.forEach((cp) => {
        const isActive = cp.status === 'active';
        const isReached = cp.status === 'reached';
        const isError = checkpointMission.status === 'error';

        // In 3D view mode: waypoints are marked in 3D directly in the line; remove separate point markers
        if (viewMode === '3d' && !isActive) {
          return;
        }

        const el = document.createElement('div');
        el.className = 'checkpoint-marker';
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onSelectCheckpoint) onSelectCheckpoint(cp);
        });

        const badgeColor = isError ? '#f43f5e' : isActive ? '#00f0ff' : isReached ? '#10b981' : '#64748b';
        const bgBadge = isError ? '#881337' : isActive ? 'rgba(6,182,212,0.3)' : isReached ? 'rgba(16,185,129,0.3)' : 'rgba(30,41,59,0.9)';

        if (!isActive) {
          // Sleek tactical checkpoint point (small point design)
          el.innerHTML = `
            <div style="
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              width: 14px;
              height: 14px;
            " title="#${cp.sequence} • ${cp.name} • Alt: ${cp.altitudeMeters}m AGL">
              <div style="
                width: ${isReached ? '6px' : '7px'};
                height: ${isReached ? '6px' : '7px'};
                border-radius: 50%;
                background: ${badgeColor};
                border: 1.5px solid #021a24;
                box-shadow: 0 0 5px ${badgeColor};
                transition: transform 0.15s ease;
              "></div>
            </div>
          `;
        } else {
          el.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 0 6px ${badgeColor}66);">
              <div style="
                position: absolute;
                width: 38px;
                height: 38px;
                border-radius: 50%;
                background: rgba(0,240,255,0.2);
                border: 1.5px solid #00f0ff;
                animation: radar-pulse 2s cubic-bezier(0.2, 0.7, 0.3, 1) infinite;
                pointer-events: none;
              "></div>
              <div style="
                width: 26px;
                height: 26px;
                border-radius: 50%;
                background: ${bgBadge};
                border: 2px solid ${badgeColor};
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                font-size: 11px;
                font-weight: 800;
                font-family: ui-monospace, monospace;
                transition: all 0.25s ease;
                box-shadow: 0 0 12px ${badgeColor};
              ">
                ${isReached ? '✓' : cp.sequence}
              </div>
              <div style="
                background: rgba(10,14,24,0.92);
                border: 1px solid ${badgeColor};
                border-radius: 4px;
                padding: 2px 6px;
                font-size: 9px;
                font-family: monospace;
                color: #e2e8f0;
                margin-top: 3px;
                white-space: nowrap;
                backdrop-filter: blur(6px);
                display: flex;
                gap: 4px;
              ">
                <span style="font-weight: 700; color: ${badgeColor};">#${cp.sequence}</span>
                <span>${cp.name.split(' ').slice(0, 2).join(' ')}</span>
                <span style="color: #38bdf8;">${cp.altitudeMeters}m</span>
              </div>
            </div>
          `;
        }

        let cpPixelRise = 0;
        if (viewMode === '3d') {
          const pitchDeg = map.getPitch();
          if (pitchDeg > 5) {
            const pitchRad = (pitchDeg * Math.PI) / 180;
            const zoom = map.getZoom();
            const metersPerPixel = (156543.03392 * Math.cos((cp.lat * Math.PI) / 180)) / Math.pow(2, zoom);
            const alt = cp.altitudeMeters || 65;
            cpPixelRise = Math.round((alt / Math.max(0.1, metersPerPixel)) * Math.sin(pitchRad));
            cpPixelRise = Math.min(180, Math.max(0, cpPixelRise));
          }
        }

        const marker = new maplibregl.Marker({ element: el, anchor: 'center', offset: [0, -cpPixelRise] })
          .setLngLat([cp.lng, cp.lat])
          .addTo(map);

        checkpointMarkersRef.current.push(marker);
      });
    } else {
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] } as any);
      }
    }
  }, [checkpointMission, isMapLoaded, onSelectCheckpoint, viewMode]);

  // === RENDER / ANIMATE SIMULATION DRONE MARKER (CHECKPOINT CONTROLLER / PX4) ===
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    if (!checkpointTelemetry || !checkpointMission || checkpointTelemetry.connected === false) {
      if (simDroneMarkerRef.current) {
        simDroneMarkerRef.current.remove();
        simDroneMarkerRef.current = null;
      }
      return;
    }

    const heading = checkpointTelemetry.headingDegrees;
    const isPaused = checkpointMission.status === 'paused';
    const isError = checkpointMission.status === 'error';
    const droneColor = isError ? '#f43f5e' : isPaused ? '#fbbf24' : '#00f0ff';

    let simPixelRise = 0;
    if (viewMode === '3d') {
      const pitchDeg = map.getPitch();
      if (pitchDeg > 5) {
        const pitchRad = (pitchDeg * Math.PI) / 180;
        const zoom = map.getZoom();
        const metersPerPixel = (156543.03392 * Math.cos((checkpointTelemetry.lat * Math.PI) / 180)) / Math.pow(2, zoom);
        const alt = checkpointTelemetry.altitudeMeters || 65;
        simPixelRise = Math.round((alt / Math.max(0.1, metersPerPixel)) * Math.sin(pitchRad));
        simPixelRise = Math.min(180, Math.max(0, simPixelRise));
      }
    }

    if (!simDroneMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cursor = 'pointer';
      simDroneMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center', offset: [0, -simPixelRise] })
        .setLngLat([checkpointTelemetry.lng, checkpointTelemetry.lat])
        .addTo(map);
    } else {
      simDroneMarkerRef.current.setOffset([0, -simPixelRise]);
      simDroneMarkerRef.current.setLngLat([checkpointTelemetry.lng, checkpointTelemetry.lat]);
    }

    const markerEl = simDroneMarkerRef.current.getElement();
    markerEl.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; pointer-events: none;">
        <div style="
          position: absolute;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: ${droneColor}22;
          border: 1.5px solid ${droneColor};
          animation: radar-pulse 1.8s cubic-bezier(0.2, 0.7, 0.3, 1) infinite;
        "></div>
        <div style="
          transform: rotate(${heading}deg);
          transition: transform 0.25s linear;
          filter: drop-shadow(0 0 8px ${droneColor});
          z-index: 2;
        ">
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
            <line x1="16" y1="16" x2="6" y2="6" stroke="${droneColor}" stroke-width="2.2" stroke-linecap="round"/>
            <line x1="16" y1="16" x2="26" y2="6" stroke="${droneColor}" stroke-width="2.2" stroke-linecap="round"/>
            <line x1="16" y1="16" x2="6" y2="26" stroke="${droneColor}" stroke-width="2.2" stroke-linecap="round"/>
            <line x1="16" y1="16" x2="26" y2="26" stroke="${droneColor}" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="6" cy="6" r="3.5" fill="${droneColor}" fill-opacity="0.8"/>
            <circle cx="26" cy="6" r="3.5" fill="${droneColor}" fill-opacity="0.8"/>
            <circle cx="6" cy="26" r="3.5" fill="${droneColor}" fill-opacity="0.8"/>
            <circle cx="26" cy="26" r="3.5" fill="${droneColor}" fill-opacity="0.8"/>
            <ellipse cx="16" cy="16" rx="5" ry="4" fill="${droneColor}"/>
            <circle cx="16" cy="16" r="2" fill="#ffffff"/>
            <polygon points="16,4 18,9 14,9" fill="${droneColor}"/>
          </svg>
        </div>
        <div style="
          background: rgba(8,12,20,0.95);
          border: 1px solid ${droneColor};
          border-radius: 4px;
          padding: 2px 7px;
          font-family: monospace;
          font-size: 10px;
          color: #fff;
          margin-top: 4px;
          white-space: nowrap;
          box-shadow: 0 0 10px rgba(0,0,0,0.7);
          display: flex;
          gap: 5px;
          align-items: center;
          z-index: 3;
        ">
          <span style="font-weight: 800; color: ${droneColor};">${checkpointMission.droneCallsign}</span>
          <span>${Math.round(checkpointTelemetry.altitudeMeters)}m</span>
          <span>${Math.round(checkpointTelemetry.groundSpeedKmh)}km/h</span>
          ${checkpointTelemetry.isDwellActive ? '<span style="color: #fbbf24; font-weight: bold;">[DWELL]</span>' : ''}
        </div>
      </div>
    `;
  }, [checkpointTelemetry, checkpointMission, isMapLoaded, viewMode]);

  // Camera Action Handlers (Requirement 5)
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleRotateCW = () => {
    if (!mapRef.current) return;
    mapRef.current.setBearing(mapRef.current.getBearing() + 30);
  };
  const handleRotateCCW = () => {
    if (!mapRef.current) return;
    mapRef.current.setBearing(mapRef.current.getBearing() - 30);
  };
  const handleTiltUp = () => {
    if (!mapRef.current) return;
    mapRef.current.setPitch(Math.min(75, (mapRef.current.getPitch() || 0) + 10));
  };
  const handleTiltDown = () => {
    if (!mapRef.current) return;
    mapRef.current.setPitch(Math.max(0, (mapRef.current.getPitch() || 0) - 10));
  };
  const handleResetNorth = () => mapRef.current?.resetNorthPitch({ duration: 500 });
  const handleCenterAirspace = () => {
    mapRef.current?.flyTo({
      center: [76.9780, 11.0160],
      zoom: 13.8,
      pitch: viewMode === '3d' ? 62 : 0,
      bearing: viewMode === '3d' ? -25 : 0,
      duration: 1000,
    });
  };
  const handleJumpToCity = (sector: MetroSector | 'unverified') => {
    const map = mapRef.current;
    if (!map || isBusy('sector-jump')) return;
    setAutoFollow(false);

    const isUnverified = sector === 'unverified';
    const sectorName = isUnverified ? 'Central Unmapped Region' : `${sector.name} (${sector.shortCode})`;

    startOperation(
      'sector-jump',
      `Switching to ${sectorName}...`,
      'map',
      true,
      () => map.stop()
    );

    const onFlyComplete = () => {
      finishOperation('sector-jump');
    };

    if (isUnverified) {
      map.flyTo({
        center: [78.5500, 21.0500],
        zoom: 12.0,
        pitch: 45,
        bearing: -15,
        duration: 1800,
        essential: true,
      });
      setActiveSectorId('unverified');
      map.once('moveend', onFlyComplete);
      return;
    }

    map.flyTo({
      center: sector.center,
      zoom: sector.defaultZoom,
      pitch: viewMode === '3d' ? 58 : 0,
      bearing: viewMode === '3d' ? -20 : 0,
      duration: 1800,
      essential: true,
    });
    setActiveSectorId(sector.id);
    map.once('moveend', onFlyComplete);
  };
  const handleNadir2D = () => {
    setViewMode('2d');
    mapRef.current?.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  };
  const handlePerspective3D = () => {
    setViewMode('3d');
    mapRef.current?.easeTo({ pitch: 62, bearing: -25, duration: 600 });
  };

  return (
    <div className={`relative w-full h-full overflow-hidden select-none bg-[#080b12] ${
      isSimulationMode 
        ? 'ring-2 ring-inset ring-amber-500/40 shadow-[inset_0_0_24px_rgba(245,158,11,0.06)]' 
        : ''
    }`}>
      {/* MapLibre WebGL Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* ─── TOP CENTER: GEOFENCE & RESTRICTED AIRSPACE WARNING BANNER (Requirement 6) ─── */}
      <GeofenceWarningBanner
        selectedDrone={drones.find((d) => d.id === selectedDroneId) || drones[0] || null}
        officialAirspaceZones={officialAirspaceZones || OFFICIAL_COIMBATORE_AIRSPACE_ZONES}
        obstacleConflicts={obstacleConflicts}
      />

      {/* ─── LOCALIZED MAP ACTION LOADING OVERLAY ─── */}
      <MapLoadingOverlay operation={activeMapOperation} onCancel={cancelOperation} />

      {/* ─── TOP LEFT: AIRSPACE IDENTIFIER & DATA FRESHNESS ─── */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="bg-[#0b101d]/90 backdrop-blur-md border border-[#1f2a40] px-3 py-1.5 rounded-md flex items-center gap-2.5 shadow-lg">
            <div className={`w-2.5 h-2.5 rounded-full ${
              airspaceQueryResult?.coverageStatus === 'UNVERIFIED_COVERAGE' 
                ? 'bg-amber-400 animate-ping' 
                : airspaceQueryResult?.coverageStatus === 'MAPPLS_LIVE'
                ? 'bg-emerald-400 animate-pulse'
                : 'bg-cyan-400 animate-pulse'
            }`}></div>
            <div>
              <div className="text-xs font-mono font-bold text-white tracking-wider uppercase flex items-center gap-1.5">
                <span>{airspaceQueryResult?.sectorName || 'DGCA UTM AIRSPACE'}</span>
                {airspaceQueryResult?.coverageStatus === 'UNVERIFIED_COVERAGE' ? (
                  <span className="text-[10px] text-amber-300 font-semibold px-1 py-0.2 bg-amber-950/80 border border-amber-700 rounded">
                    UNVERIFIED
                  </span>
                ) : airspaceQueryResult?.coverageStatus === 'MAPPLS_LIVE' ? (
                  <span className="text-[10px] text-emerald-300 font-semibold px-1 py-0.2 bg-emerald-950/80 border border-emerald-700 rounded">
                    MAPPLS LIVE
                  </span>
                ) : (
                  <span className="text-[10px] text-cyan-300 font-normal px-1 py-0.2 bg-cyan-950/80 border border-cyan-800 rounded">
                    DGCA STATUTORY
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-cyan-400/90">
                {currentCenter[1].toFixed(4)}° N, {currentCenter[0].toFixed(4)}° E • {
                  airspaceQueryResult?.coverageStatus === 'UNVERIFIED_COVERAGE'
                    ? 'UNMAPPED / ADVISORY RESTRICTED'
                    : (airspaceQueryResult?.zones?.length || 0) + ' ACTIVE ZONES'
                }
              </div>
            </div>
          </div>
        </div>

        {/* Following Drone active status pill */}
        {autoFollow && selectedDroneId && (
          <div className="pointer-events-auto">
            <button
              onClick={() => setAutoFollow(false)}
              className="bg-cyan-950/90 border border-cyan-400 px-2.5 py-1 rounded text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.5)] hover:bg-rose-950/90 hover:border-rose-400 hover:text-rose-300 transition-colors"
              title="Click to Exit Follow Mode & freely pan map"
            >
              <Navigation className="w-3.5 h-3.5 animate-spin" />
              <span>FOLLOWING {selectedDroneId} • CLICK TO EXIT</span>
            </button>
          </div>
        )}

        {/* Next Waypoint Card (Requirement 8) */}
        <div className="pointer-events-auto">
          <NextWaypointCard
            selectedDrone={drones.find((d) => d.id === selectedDroneId) || drones[0] || null}
            onSelectWaypoint={onSelectWaypoint}
          />
        </div>

        {/* ─── UNVERIFIED COVERAGE WARNING BANNER ─── */}
        {airspaceQueryResult?.coverageStatus === 'UNVERIFIED_COVERAGE' && (
          <div className="pointer-events-auto max-w-lg bg-amber-950/95 backdrop-blur-md border border-amber-500/80 rounded-md p-2.5 shadow-2xl text-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <div className="text-[11px] font-bold text-amber-300 flex items-center justify-between">
                  <span>UNVERIFIED AIRSPACE COVERAGE</span>
                  <span className="text-[9px] bg-amber-900/80 px-1 py-0.2 rounded border border-amber-600/70 text-amber-200">
                    STATUTORY ADVISORY
                  </span>
                </div>
                <p className="text-[10px] text-amber-200/90 leading-tight mt-1">
                  Authoritative DGCA DigitalSky data not available for this visible area. Operations outside verified sectors require prior DigitalSky filing. Do not assume unrestricted green airspace.
                </p>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] text-amber-400 font-semibold">Jump to Verified Hub:</span>
                  <button
                    onClick={() => handleJumpToCity(COIMBATORE_METRO_SECTOR)}
                    className="px-1.5 py-0.5 bg-amber-900/80 hover:bg-amber-800 text-[9px] text-amber-100 font-bold rounded border border-amber-600/60"
                  >
                    CJB
                  </button>
                  <button
                    onClick={() => handleJumpToCity(CHENNAI_METRO_SECTOR)}
                    className="px-1.5 py-0.5 bg-amber-900/80 hover:bg-amber-800 text-[9px] text-amber-100 font-bold rounded border border-amber-600/60"
                  >
                    MAA
                  </button>
                  <button
                    onClick={() => handleJumpToCity(BENGALURU_METRO_SECTOR)}
                    className="px-1.5 py-0.5 bg-amber-900/80 hover:bg-amber-800 text-[9px] text-amber-100 font-bold rounded border border-amber-600/60"
                  >
                    BLR
                  </button>
                  <button
                    onClick={() => handleJumpToCity(DELHI_METRO_SECTOR)}
                    className="px-1.5 py-0.5 bg-amber-900/80 hover:bg-amber-800 text-[9px] text-amber-100 font-bold rounded border border-amber-600/60"
                  >
                    DEL
                  </button>
                  <button
                    onClick={() => handleJumpToCity(MUMBAI_METRO_SECTOR)}
                    className="px-1.5 py-0.5 bg-amber-900/80 hover:bg-amber-800 text-[9px] text-amber-100 font-bold rounded border border-amber-600/60"
                  >
                    BOM
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── TOP RIGHT: COMPACT PROFESSIONAL MAP DOCK (Priority 3) ─── */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5 pointer-events-none select-none">
        {/* Quick-Jump Nationwide Sector Bar */}
        <div className="bg-[#0b101d]/90 backdrop-blur-md border border-[#1f2a40] p-1 rounded-md flex items-center gap-1 shadow-xl pointer-events-auto">
          <span className="text-[10px] text-slate-400 font-bold px-1.5 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-cyan-400" />
            <span>SECTOR:</span>
          </span>
          {ALL_METRO_SECTORS.map((sector) => (
            <button
              key={sector.id}
              onClick={() => handleJumpToCity(sector)}
              disabled={isBusy('sector-jump')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                isBusy('sector-jump') ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                activeSectorId === sector.id
                  ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
              title={`Fly camera to ${sector.name} (${sector.primaryAirportIcao})`}
            >
              {sector.shortCode}
            </button>
          ))}
          <div className="w-[1px] h-3.5 bg-[#1f2a40] mx-0.5" />
          <button
            onClick={() => handleJumpToCity('unverified')}
            disabled={isBusy('sector-jump')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
              isBusy('sector-jump') ? 'opacity-50 cursor-not-allowed' : ''
            } ${
              activeSectorId === 'unverified'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-950/50'
            }`}
            title="Fly camera to Unmapped Area (Demonstrates UNVERIFIED_COVERAGE handling)"
          >
            UNMAPPED
          </button>
        </div>
        {/* Compact Dock Strip */}
        <div className="bg-[#0b101d]/90 backdrop-blur-md border border-[#1f2a40] p-1 rounded-md flex items-center gap-1 shadow-xl pointer-events-auto">
          {/* 2D / 3D Toggle */}
          <div className="flex items-center bg-[#070b14] p-0.5 rounded border border-[#1b263b]">
            <button
              onClick={handleNadir2D}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all flex items-center gap-1 ${
                viewMode === '2d'
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Top-down Nadir 2D View (0° pitch)"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>2D</span>
            </button>

            <button
              onClick={handlePerspective3D}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all flex items-center gap-1 ${
                viewMode === '3d'
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="3D Elevated Urban Structures (62° pitch)"
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D</span>
            </button>
          </div>

          <div className="w-[1px] h-4 bg-[#1f2a40] mx-0.5" />

          {/* Zoom In */}
          <button
            onClick={handleZoomIn}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors"
            title="Zoom In (+)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Out */}
          <button
            onClick={handleZoomOut}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors"
            title="Zoom Out (-)"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-[#1f2a40] mx-0.5" />

          {/* Rotating Compass Widget (HDG readout, resets North on click - Requirement 2) */}
          <button
            onClick={handleResetNorth}
            className="relative w-8 h-8 flex flex-col items-center justify-center rounded bg-[#070b14] border border-[#1b263b] text-cyan-300 hover:text-white hover:border-cyan-400 transition-all group"
            title={`Heading: ${currentBearing >= 0 ? Math.round(currentBearing) : Math.round(360 + currentBearing)}° • Click to Reset North`}
            aria-label="Compass - Reset North"
          >
            <div 
              className="w-4 h-4 flex items-center justify-center transition-transform duration-200"
              style={{ transform: `rotate(${-currentBearing}deg)` }}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
                <polygon points="12,2 16,12 12,9 8,12" fill="#ef4444" />
                <polygon points="12,22 16,12 12,9 8,12" fill="#94a3b8" />
              </svg>
            </div>
            <span className="text-[8px] font-mono font-bold leading-none text-slate-400 group-hover:text-cyan-300">
              {currentBearing >= 0 ? Math.round(currentBearing) : Math.round(360 + currentBearing)}°
            </span>
          </button>

          {/* Recenter Coimbatore */}
          <button
            onClick={handleCenterAirspace}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors"
            title="Recenter Coimbatore Airspace Corridor"
          >
            <LocateFixed className="w-3.5 h-3.5" />
          </button>

          {/* Focus Selected Drone */}
          <button
            onClick={handleFocusSelectedDrone}
            className="w-6 h-6 flex items-center justify-center rounded text-cyan-400 hover:text-white hover:bg-cyan-500/30 transition-colors"
            title="Focus & Center Camera on Selected Drone"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>

          {/* Follow Drone Toggle */}
          <button
            onClick={() => setAutoFollow(!autoFollow)}
            className={`w-6 h-6 flex items-center justify-center rounded transition-all ${
              autoFollow
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
            title={autoFollow ? 'Following Selected Drone (Click to Disengage)' : 'Follow Selected Drone'}
          >
            <Navigation className={`w-3.5 h-3.5 ${autoFollow ? 'animate-pulse text-cyan-300' : ''}`} />
          </button>

          <div className="w-[1px] h-4 bg-[#1f2a40] mx-0.5" />

          {/* Mini-Map Toggle (Requirement 8) */}
          <button
            onClick={() => setShowMiniMap(!showMiniMap)}
            className={`w-6 h-6 flex items-center justify-center rounded transition-all ${
              showMiniMap
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
            title="Toggle Situational Overview Mini-Map"
            aria-label="Toggle Mini-Map"
          >
            <MapIcon className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-[#1f2a40] mx-0.5" />

          {/* Expand Advanced Camera Orientation */}
          <button
            onClick={() => setShowCameraToolbar(!showCameraToolbar)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-colors ${
              showCameraToolbar
                ? 'bg-cyan-950/80 border border-cyan-600 text-cyan-300'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
            title="Toggle Tilt and Rotation Controls"
          >
            <Sliders className="w-3 h-3 text-cyan-400" />
            <span>{currentPitch}°</span>
            {showCameraToolbar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <div className="w-[1px] h-4 bg-[#1f2a40] mx-0.5" />

          {/* 12-Layer Controls Toggle */}
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className={`w-6 h-6 flex items-center justify-center rounded transition-all ${
              showLayerMenu
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
            title="12-Layer Airspace Controls"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Expandable Secondary Orientation Tray (Priority 3.A) */}
        {showCameraToolbar && (
          <div className="bg-[#0b101d]/95 backdrop-blur-md border border-[#1f2a40] rounded-md p-2.5 shadow-2xl z-20 space-y-2 text-xs font-mono w-56 pointer-events-auto">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pb-1 border-b border-[#1f2a40] flex items-center justify-between">
              <span>Camera Orientation</span>
              <span className="text-cyan-400 font-bold">{currentPitch}° / {currentBearing}°</span>
            </div>

            {/* Tilt Up / Down & Rotate CW / CCW Buttons */}
            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={handleTiltUp}
                className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 hover:bg-slate-800 flex items-center justify-center"
                title="Tilt Up (+10°)"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleTiltDown}
                className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 hover:bg-slate-800 flex items-center justify-center"
                title="Tilt Down (-10°)"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRotateCCW}
                className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 hover:bg-slate-800 flex items-center justify-center"
                title="Rotate Counter-Clockwise (-30°)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRotateCW}
                className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 hover:bg-slate-800 flex items-center justify-center"
                title="Rotate Clockwise (+30°)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pitch Range Slider */}
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>Tilt Angle (Pitch)</span>
                <span className="text-cyan-300 font-bold">{currentPitch}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="75"
                value={currentPitch}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setCurrentPitch(val);
                  mapRef.current?.setPitch(val);
                }}
                className="w-full accent-cyan-400 cursor-pointer h-1 bg-slate-800 rounded"
              />
            </div>

            {/* Quick Angle Presets */}
            <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-800">
              <button
                onClick={handleNadir2D}
                className="py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px] font-bold"
              >
                Nadir (0°)
              </button>
              <button
                onClick={handlePerspective3D}
                className="py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 hover:bg-cyan-900/80 text-[10px] font-bold"
              >
                3D Urban (62°)
              </button>
            </div>
          </div>
        )}

        {showLayerMenu && (
            <div className="absolute right-0 top-10 w-72 max-h-[82vh] overflow-y-auto custom-scrollbar bg-[#0a0f1d]/98 backdrop-blur-xl border border-cyan-500/60 rounded-lg p-3 shadow-2xl z-30 space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#1f2a40]">
                <div className="text-[11px] text-cyan-300 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>12-LAYER COMMAND CONTROLS</span>
                </div>
                <button onClick={() => setShowLayerMenu(false)} className="text-slate-400 hover:text-white p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Group A: Basemap & Ground Infrastructure */}
              <div className="space-y-1.5">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">A. Ground &amp; Basemap</div>
                
                <label className="flex items-center justify-between text-slate-200 cursor-pointer hover:bg-slate-800/40 px-1.5 py-1 rounded">
                  <span>1. Satellite / Aerial Tiles</span>
                  <input type="checkbox" checked={layerSatellite} onChange={(e) => setLayerSatellite(e.target.checked)} className="rounded border-slate-700 text-cyan-500 focus:ring-0" />
                </label>

                <label className="flex items-center justify-between text-slate-200 cursor-pointer hover:bg-slate-800/40 px-1.5 py-1 rounded">
                  <span>2. Ground-Level Roads</span>
                  <input type="checkbox" checked={layerGroundRoads} onChange={(e) => setLayerGroundRoads(e.target.checked)} className="rounded border-slate-700 text-cyan-500 focus:ring-0" />
                </label>

                <label className="flex items-center justify-between text-slate-200 cursor-pointer hover:bg-slate-800/40 px-1.5 py-1 rounded">
                  <span>3. Major Arterial Roads</span>
                  <input type="checkbox" checked={layerMajorRoads} onChange={(e) => setLayerMajorRoads(e.target.checked)} className="rounded border-slate-700 text-cyan-500 focus:ring-0" />
                </label>
              </div>

              {/* Group B: 3D Urban Architecture */}
              <div className="space-y-1.5 pt-1.5 border-t border-[#1f2a40]">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">B. 3D Urban Architecture</div>

                <label className="flex items-center justify-between text-slate-200 cursor-pointer hover:bg-slate-800/40 px-1.5 py-1 rounded">
                  <span>4. 3D City Buildings (Extruded)</span>
                  <input type="checkbox" checked={layer3DBuildings} onChange={(e) => setLayer3DBuildings(e.target.checked)} className="rounded border-slate-700 text-cyan-500 focus:ring-0" />
                </label>

                <label className="flex items-center justify-between text-slate-200 cursor-pointer hover:bg-slate-800/40 px-1.5 py-1 rounded">
                  <span>5. Elevated Highways (Corridors)</span>
                  <input type="checkbox" checked={layerElevatedHighways} onChange={(e) => setLayerElevatedHighways(e.target.checked)} className="rounded border-slate-700 text-cyan-500 focus:ring-0" />
                </label>

                <label className="flex items-center justify-between text-slate-200 cursor-pointer hover:bg-slate-800/40 px-1.5 py-1 rounded">
                  <span>6. Flyovers &amp; Concrete Viaducts</span>
                  <input type="checkbox" checked={layerFlyovers} onChange={(e) => setLayerFlyovers(e.target.checked)} className="rounded border-slate-700 text-cyan-500 focus:ring-0" />
                </label>

                <label className="flex items-center justify-between text-slate-200 cursor-pointer hover:bg-slate-800/40 px-1.5 py-1 rounded">
                  <span>7. Physical Obstacles &amp; Buffers</span>
                  <input type="checkbox" checked={layerObstacles} onChange={(e) => setLayerObstacles(e.target.checked)} className="rounded border-slate-700 text-cyan-500 focus:ring-0" />
                </label>
              </div>

              {/* Group C: Airspace Restrictions & Safety */}
              <div className="space-y-1.5 pt-1.5 border-t border-[#1f2a40]">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">C. Airspace Zones &amp; Safety</div>

                <label className="flex items-center justify-between text-slate-200 cursor-pointer hover:bg-slate-800/40 px-1.5 py-1 rounded">
                  <span>8. Airspace Zones (Red/Yellow/Green)</span>
                  <input type="checkbox" checked={layerAirspaceZones} onChange={(e) => setLayerAirspaceZones(e.target.checked)} className="rounded border-slate-700 text-cyan-500 focus:ring-0" />
                </label>

                <label className="flex items-center justify-between text-slate-200 cursor-pointer hover:bg-slate-800/40 px-1.5 py-1 rounded">
                  <span>9. Collision Warning Highlights</span>
                  <input type="checkbox" checked={layerCollisionWarnings} onChange={(e) => setLayerCollisionWarnings(e.target.checked)} className="rounded border-slate-700 text-cyan-500 focus:ring-0" />
                </label>
              </div>

              {/* Group D: Corridors, Waypoints & Targets */}
              <div className="space-y-1.5 pt-1.5 border-t border-[#1f2a40]">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">D. Flight Routing &amp; Destinations</div>

                <label className="flex items-center justify-between text-slate-200 cursor-pointer hover:bg-slate-800/40 px-1.5 py-1 rounded">
                  <span>10. Planned Routes (Active A*)</span>
                  <input type="checkbox" checked={layerPlannedRoutes} onChange={(e) => setLayerPlannedRoutes(e.target.checked)} className="rounded border-slate-700 text-cyan-500 focus:ring-0" />
                </label>

                <label className="flex items-center justify-between text-slate-200 cursor-pointer hover:bg-slate-800/40 px-1.5 py-1 rounded">
                  <span>11. Waypoints &amp; Chevrons</span>
                  <input type="checkbox" checked={layerWaypoints} onChange={(e) => setLayerWaypoints(e.target.checked)} className="rounded border-slate-700 text-cyan-500 focus:ring-0" />
                </label>

                <label className="flex items-center justify-between text-slate-200 cursor-pointer hover:bg-slate-800/40 px-1.5 py-1 rounded">
                  <span>12. Destination Markers &amp; Pads</span>
                  <input type="checkbox" checked={layerDestinations} onChange={(e) => setLayerDestinations(e.target.checked)} className="rounded border-slate-700 text-cyan-500 focus:ring-0" />
                </label>
              </div>

              {/* Basemap Style Option */}
              <div className="pt-2 border-t border-[#1f2a40] flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Basemap Theme:</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleSetMapStyle('dark')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      mapStyle === 'dark' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title="OpenFreeMap 3D Vector Basemap with Citywide Extrusions"
                  >
                    OpenFreeMap 3D
                  </button>
                  <button
                    onClick={() => handleSetMapStyle('satellite')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      mapStyle === 'satellite' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title="High-Resolution Satellite Imagery with 3D Buildings Overlay"
                  >
                    Satellite 3D
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* ─── BOTTOM LEFT: OFFICIAL AIRSPACE LEGEND (Requirement 6 - Collapsed chip by default) ─── */}
      {!showAirspaceLegend ? (
        <button
          onClick={() => setShowAirspaceLegend(true)}
          className="absolute bottom-4 left-3 z-10 bg-[#090e1a]/95 backdrop-blur-md border border-[#1f2a40] px-2.5 py-1.5 rounded-md text-xs font-mono text-cyan-300 flex items-center gap-2 shadow-lg hover:bg-slate-800/90 hover:border-cyan-500/50 transition-all pointer-events-auto"
          title="Click to expand DigitalSky Airspace Legend"
          aria-label="Expand Airspace Legend"
        >
          <Shield className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-[11px] text-white">AIRSPACE</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-bold">
            VERIFIED ACTIVE
          </span>
          <ChevronUp className="w-3 h-3 text-slate-400" />
        </button>
      ) : (
        <div className="absolute bottom-4 left-3 z-10 bg-[#090e1a]/95 backdrop-blur-md border border-[#1f2a40] p-2.5 rounded-lg shadow-2xl max-w-xs text-xs font-mono space-y-1.5 pointer-events-auto">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#1f2a40]">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-extrabold text-[11px] text-white tracking-wider uppercase">
                DIGITAL SKY AIRSPACE
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-400 font-bold">
                VERIFIED ACTIVE
              </span>
              <button
                onClick={() => setShowAirspaceLegend(false)}
                className="text-slate-500 hover:text-white p-0.5"
                title="Collapse Legend"
                aria-label="Collapse Legend"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1 text-[11px]">
            <div 
              onClick={() => setSelectedAirspaceZone(OFFICIAL_COIMBATORE_AIRSPACE_ZONES[0])}
              className="flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 p-1 rounded transition-colors"
            >
              <div className="w-3.5 h-3.5 rounded bg-[#EF4444]/40 border-2 border-[#EF4444] shrink-0"></div>
              <div>
                <span className="font-bold text-red-400">RED ZONE</span>
                <span className="text-slate-400 text-[10px]"> — No-fly without central auth</span>
              </div>
            </div>

            <div 
              onClick={() => setSelectedAirspaceZone(OFFICIAL_COIMBATORE_AIRSPACE_ZONES[2])}
              className="flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 p-1 rounded transition-colors"
            >
              <div className="w-3.5 h-3.5 rounded bg-[#FACC15]/40 border-2 border-[#FACC15] shrink-0"></div>
              <div>
                <span className="font-bold text-yellow-400">YELLOW ZONE</span>
                <span className="text-slate-400 text-[10px]"> — ATC permission required</span>
              </div>
            </div>

            <div 
              onClick={() => setSelectedAirspaceZone(OFFICIAL_COIMBATORE_AIRSPACE_ZONES[3])}
              className="flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 p-1 rounded transition-colors"
            >
              <div className="w-3.5 h-3.5 rounded bg-[#22C55E]/40 border-2 border-[#22C55E] shrink-0"></div>
              <div>
                <span className="font-bold text-emerald-400">GREEN ZONE</span>
                <span className="text-slate-400 text-[10px]"> — Permitted up to 400ft AGL</span>
              </div>
            </div>

            <div 
              onClick={() => setSelectedAirspaceZone(OFFICIAL_COIMBATORE_AIRSPACE_ZONES[4])}
              className="flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 p-1 rounded transition-colors"
            >
              <div className="w-3.5 h-3.5 rounded bg-[#94A3B8]/30 border-2 border-dashed border-[#94A3B8] shrink-0"></div>
              <div>
                <span className="font-bold text-slate-300">UNKNOWN</span>
                <span className="text-slate-400 text-[10px]"> — Unverified / Stale (Hold)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ZONE INSPECTION MODAL / PANEL (Req 2.B) ─── */}
      {selectedAirspaceZone && (
        <div className="absolute top-16 left-3 z-20 bg-[#0b101e]/98 backdrop-blur-xl border border-cyan-500/60 p-4 rounded-lg shadow-2xl max-w-sm text-xs font-mono space-y-3">
          <div className="flex items-start justify-between pb-2 border-b border-[#21304d]">
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  selectedAirspaceZone.classification === 'RED' ? 'bg-red-950/80 border border-red-500 text-red-300' :
                  selectedAirspaceZone.classification === 'YELLOW' ? 'bg-yellow-950/80 border border-yellow-500 text-yellow-300' :
                  selectedAirspaceZone.classification === 'GREEN' ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300' :
                  'bg-slate-800 border border-slate-600 text-slate-300'
                }`}>
                  {selectedAirspaceZone.classification} ZONE
                </span>
                <span className="text-[10px] text-cyan-400 font-bold">
                  {selectedAirspaceZone.status}
                </span>
              </div>
              <h3 className="font-extrabold text-sm text-white mt-1 leading-snug">
                {selectedAirspaceZone.name}
              </h3>
            </div>
            <button
              onClick={() => setSelectedAirspaceZone(null)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-slate-300 text-[11px] leading-relaxed">
            {selectedAirspaceZone.description}
          </p>

          <div className="grid grid-cols-2 gap-2 bg-[#060a12] p-2.5 rounded border border-[#1b273d]">
            <div>
              <div className="text-[10px] text-slate-400">Lower Altitude</div>
              <div className="text-xs font-bold text-white">
                {selectedAirspaceZone.lowerAltitudeLimitMeters}m {selectedAirspaceZone.altitudeReference}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Upper Altitude</div>
              <div className="text-xs font-bold text-white">
                {selectedAirspaceZone.upperAltitudeLimitMeters}m {selectedAirspaceZone.altitudeReference}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Terrain Base</div>
              <div className="text-xs font-bold text-cyan-300">
                {selectedAirspaceZone.terrainElevationMeters}m AMSL
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Permission Req.</div>
              <div className={`text-xs font-bold ${selectedAirspaceZone.permissionRequired ? 'text-amber-400' : 'text-emerald-400'}`}>
                {selectedAirspaceZone.permissionRequired ? 'YES (MANDATORY)' : 'NO (FREE OPERATING)'}
              </div>
            </div>
          </div>

          <div className="space-y-1 text-[10px] text-slate-400 pt-1 border-t border-[#1b273d]">
            <div><span className="text-slate-300 font-bold">Authority:</span> {selectedAirspaceZone.permissionAuthority}</div>
            <div><span className="text-slate-300 font-bold">Source:</span> {selectedAirspaceZone.authoritativeSource}</div>
            <div><span className="text-slate-300 font-bold">Verified:</span> {new Date(selectedAirspaceZone.lastVerifiedTimestamp).toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* ─── BOTTOM CENTER: SIMULATION CONTROLS BAR ─── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-[#0a0f1d]/95 backdrop-blur-md border border-[#1f2a40] px-3 py-1.5 rounded-full shadow-2xl">
        <button
          onClick={onToggleSim}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold transition-all ${
            isSimRunning
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30'
          }`}
        >
          {isSimRunning ? (
            <>
              <Pause className="w-3.5 h-3.5 text-amber-400" />
              <span>PAUSE SIM</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>RESUME SIM</span>
            </>
          )}
        </button>

        <div className="h-4 w-[1px] bg-[#1f2a40]"></div>

        <div className="flex items-center gap-1 text-xs font-mono">
          {[1, 2, 5].map((spd) => (
            <button
              key={spd}
              onClick={() => onChangeSimSpeed(spd)}
              className={`px-2 py-0.5 rounded-full transition-colors ${
                simSpeed === spd
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white bg-slate-800/60'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        <div className="h-4 w-[1px] bg-[#1f2a40]"></div>

        <button
          onClick={onResetSim}
          className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          title="Reset Simulation State"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-[#1f2a40]"></div>

        <button
          onClick={handleFocusSelectedDrone}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono text-cyan-300 hover:text-white hover:bg-cyan-500/20 transition-colors"
          title="Smoothly fly camera to selected aircraft"
        >
          <Crosshair className="w-3 h-3 text-cyan-400" />
          <span>FOCUS</span>
        </button>

        <div className="h-4 w-[1px] bg-[#1f2a40]"></div>

        <button
          onClick={() => setAutoFollow(!autoFollow)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono transition-colors ${
            autoFollow
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Smoothly follow selected aircraft"
        >
          <Navigation className={`w-3 h-3 ${autoFollow ? 'text-cyan-400' : 'text-slate-500'}`} />
          <span>FOLLOW</span>
        </button>
      </div>

      {/* ─── MINI-MAP SITUATIONAL OVERVIEW (Requirement 8) ─── */}
      {showMiniMap && (
        <div className="absolute bottom-10 right-3 z-20 w-52 h-44 bg-[#090e1a]/95 backdrop-blur-md border border-cyan-500/50 rounded-lg p-2.5 shadow-2xl flex flex-col font-mono text-xs pointer-events-auto">
          <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-[#1f2a40] text-[10px]">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300">
              <MapIcon className="w-3 h-3 text-cyan-400" />
              <span>MINI-MAP RADAR</span>
            </div>
            <button 
              onClick={() => setShowMiniMap(false)} 
              className="text-slate-400 hover:text-white p-0.5"
              aria-label="Close Mini-Map"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="relative flex-1 bg-[#060a12] rounded border border-[#1b273d] overflow-hidden flex items-center justify-center">
            {/* Concentric radar rings */}
            <div className="absolute w-32 h-32 rounded-full border border-cyan-500/20 pointer-events-none" />
            <div className="absolute w-20 h-20 rounded-full border border-cyan-500/30 pointer-events-none" />
            <div className="absolute w-8 h-8 rounded-full border border-cyan-500/40 pointer-events-none" />
            {/* Center crosshair */}
            <div className="absolute w-full h-[1px] bg-cyan-500/20 pointer-events-none" />
            <div className="absolute h-full w-[1px] bg-cyan-500/20 pointer-events-none" />
            
            {/* Drones relative representation */}
            {drones.map((d) => {
              const isSelected = d.id === selectedDroneId;
              const activeDrone = drones.find((dr) => dr.id === selectedDroneId) || drones[0];
              const relX = ((d.vitals.longitude - (activeDrone ? activeDrone.vitals.longitude : AIRSPACE_CENTER[0])) * 1200) + 95;
              const relY = (- (d.vitals.latitude - (activeDrone ? activeDrone.vitals.latitude : AIRSPACE_CENTER[1])) * 1200) + 65;
              const clampedX = Math.max(10, Math.min(180, relX));
              const clampedY = Math.max(10, Math.min(120, relY));

              return (
                <div
                  key={d.id}
                  onClick={() => onSelectDrone(d.id)}
                  style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform duration-300 ${
                    isSelected ? 'scale-125 z-10' : 'scale-90 hover:scale-110'
                  }`}
                  title={`${d.callsign} (${d.id}) - Alt: ${Math.round(d.vitals.altitudeMeters)}m`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full ring-2 ring-slate-950"
                    style={{ backgroundColor: isSelected ? '#00f0ff' : '#94a3b8' }}
                  />
                  {isSelected && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-cyan-300 bg-slate-950/80 px-1 rounded whitespace-nowrap">
                      {d.id}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="absolute bottom-1 right-1 text-[8px] text-slate-500 font-mono">
              RANGE 5km
            </div>
          </div>
        </div>
      )}

      {/* ─── BOTTOM RIGHT: OPENFREEMAP & OPENSTREETMAP ATTRIBUTION (Requirement 4) ─── */}
      <div className="absolute bottom-2 right-2 z-10 bg-[#080b12]/80 backdrop-blur-sm border border-[#1f2a40]/60 px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 select-none pointer-events-auto flex items-center gap-1.5">
        <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
          OpenFreeMap
        </a>
        <span className="text-slate-600">|</span>
        <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer" className="hover:underline">
          &copy; OpenMapTiles
        </a>
        <span className="text-slate-600">|</span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">
          Data &copy; OpenStreetMap
        </a>
      </div>
    </div>
  );
};
