import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Mountain, Navigation, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { Drone, Obstacle } from '../types/fleet';
import { DESIGN_TOKENS } from '../styles/designTokens';

export interface AltitudeProfileStripProps {
  selectedDrone: Drone | null;
  obstacles: Obstacle[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const AltitudeProfileStrip: React.FC<AltitudeProfileStripProps> = ({
  selectedDrone,
  obstacles,
  isExpanded: controlledExpanded,
  onToggleExpand: controlledToggle,
}) => {
  const [internalExpanded, setInternalExpanded] = useState<boolean>(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggle = controlledToggle || (() => setInternalExpanded(!internalExpanded));

  if (!selectedDrone || !selectedDrone.route || selectedDrone.route.length < 2) {
    return null;
  }

  const drone = selectedDrone;
  const route = drone.route;
  const currentAlt = Math.round(drone.vitals.altitudeMeters);
  const targetIdx = drone.targetWaypointIndex ?? drone.currentWaypointIndex;
  const totalWaypoints = route.length;
  const progressRatio = totalWaypoints > 1 
    ? Math.max(0, Math.min(1, drone.currentWaypointIndex / (totalWaypoints - 1)))
    : 0;

  // Total route distance
  const totalDistKm = drone.distanceRemainingKm !== undefined
    ? Math.max(1, drone.distanceRemainingKm + 0.5)
    : 6.2;

  // Ground elevation baseline (Coimbatore: 411m MSL)
  const groundElevation = 411;
  const maxCeilingMeters = 120; // DGCA ceiling
  const profileMaxMeters = 135;

  // Sample corridor obstacles
  const corridorObstacles = obstacles.slice(0, 5).map((obs, idx) => {
    const fraction = (idx + 1) / 6;
    const height = obs.physicalHeightMeters ?? obs.heightMeters ?? 35;
    return {
      name: obs.name,
      fraction,
      height,
    };
  });

  // SVG dimensions
  const svgWidth = 640;
  const svgHeight = 72;
  const paddingX = 36;
  const paddingY = 12;
  const graphWidth = svgWidth - paddingX * 2;
  const graphHeight = svgHeight - paddingY * 2;

  // Coordinate mapping functions
  const xForFrac = (f: number) => paddingX + f * graphWidth;
  const yForAlt = (alt: number) => paddingY + graphHeight - (alt / profileMaxMeters) * graphHeight;

  // Ceiling line Y
  const ceilingY = yForAlt(maxCeilingMeters);

  // Planned cruise altitude path
  const plannedPathPoints = route.map((wp, idx) => {
    const f = idx / (route.length - 1);
    const alt = wp.altitudeMeters || 65;
    return `${xForFrac(f)},${yForAlt(alt)}`;
  }).join(' ');

  // Current drone position
  const droneX = xForFrac(progressRatio);
  const droneY = yForAlt(currentAlt);

  return (
    <div className="w-full flex flex-col items-center select-none pointer-events-auto">
      {/* ─── DOCKED EXPAND/COLLAPSE PILL ─── */}
      <button
        onClick={toggle}
        aria-label="Toggle Route Altitude Profile Strip"
        className="flex items-center gap-2 px-3 py-1 rounded-t-lg bg-[#0c1220]/95 hover:bg-[#131d32] border-t border-x border-[#1e2a42] text-[11px] font-mono font-bold text-cyan-300 shadow-lg backdrop-blur-md transition-all hover:text-white"
        title="Toggle vertical corridor profile (terrain, obstacles, 120m ceiling)"
      >
        <Mountain className="w-3.5 h-3.5 text-cyan-400" />
        <span>ALTITUDE PROFILE</span>
        <span className="text-[10px] text-slate-400 font-normal">
          ({currentAlt}m AGL / {groundElevation + currentAlt}m AMSL)
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        )}
      </button>

      {/* ─── EXPANDED PROFILE STRIP ─── */}
      {isExpanded && (
        <div className="w-full bg-[#090d18]/95 backdrop-blur-md border-t border-[#1e2a42] px-4 py-2 flex flex-col items-center shadow-2xl animate-in slide-in-from-bottom-2 duration-150">
          <div className="w-full max-w-4xl flex items-center justify-between text-[11px] font-mono text-slate-400 pb-1 border-b border-[#182338]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-bold text-slate-200 uppercase tracking-wide">
                Flight Corridor Elevation Cross-Section: {drone.callsign}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-amber-400 text-[10px]">
                <span className="w-3 h-[1px] bg-amber-400 inline-block border-t border-dashed border-amber-400" />
                <span>120m DGCA CEILING</span>
              </span>
              <span className="flex items-center gap-1 text-cyan-400 text-[10px]">
                <span className="w-3 h-1 bg-cyan-400 inline-block rounded-full" />
                <span>PLANNED CRUISE</span>
              </span>
              <span className="text-slate-500 text-[10px]">
                DATUM: 411m AMSL
              </span>
            </div>
          </div>

          {/* SVG Altitude Profile Graph */}
          <div className="w-full max-w-4xl h-[76px] relative mt-1">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible">
              <defs>
                {/* Terrain Gradient */}
                <linearGradient id="terrainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e293b" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
                </linearGradient>

                {/* Corridor Flight Envelope Glow */}
                <linearGradient id="flightEnvelope" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.02" />
                </linearGradient>

                {/* Obstacle Gradient */}
                <linearGradient id="obstacleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#334155" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#1e293b" stopOpacity="0.95" />
                </linearGradient>
              </defs>

              {/* 1. Ground Baseline (0m AGL / 411m AMSL) */}
              <line
                x1={paddingX}
                y1={yForAlt(0)}
                x2={svgWidth - paddingX}
                y2={yForAlt(0)}
                stroke="#334155"
                strokeWidth="1.5"
              />

              {/* 2. Statutory 120m Ceiling Guideline */}
              <line
                x1={paddingX}
                y1={ceilingY}
                x2={svgWidth - paddingX}
                y2={ceilingY}
                stroke="#f59e0b"
                strokeWidth="1.2"
                strokeDasharray="4 3"
                opacity="0.85"
              />
              <text
                x={svgWidth - paddingX + 4}
                y={ceilingY + 3}
                fill="#f59e0b"
                fontSize="8"
                fontFamily="monospace"
                fontWeight="bold"
              >
                120m
              </text>

              {/* 3. Building Obstacles Along Corridor */}
              {corridorObstacles.map((obs, i) => {
                const obsX = xForFrac(obs.fraction);
                const obsW = 22;
                const obsTopY = yForAlt(obs.height);
                const obsBottomY = yForAlt(0);
                const obsH = Math.max(4, obsBottomY - obsTopY);

                return (
                  <g key={i}>
                    <rect
                      x={obsX - obsW / 2}
                      y={obsTopY}
                      width={obsW}
                      height={obsH}
                      fill="url(#obstacleGrad)"
                      stroke="#475569"
                      strokeWidth="1"
                      rx="2"
                    />
                    <text
                      x={obsX}
                      y={obsTopY - 3}
                      fill="#94a3b8"
                      fontSize="7"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {obs.height}m
                    </text>
                  </g>
                );
              })}

              {/* 4. Planned Flight Path Line & Area */}
              <polygon
                points={`${paddingX},${yForAlt(0)} ${plannedPathPoints} ${svgWidth - paddingX},${yForAlt(0)}`}
                fill="url(#flightEnvelope)"
              />
              <polyline
                points={plannedPathPoints}
                fill="none"
                stroke="#00f0ff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* 5. Checkpoint dots along planned route */}
              {route.map((wp, idx) => {
                const f = idx / (route.length - 1);
                const alt = wp.altitudeMeters || 65;
                const isPassed = idx < (drone.currentWaypointIndex || 0);

                return (
                  <circle
                    key={idx}
                    cx={xForFrac(f)}
                    cy={yForAlt(alt)}
                    r="2.5"
                    fill={isPassed ? '#34d399' : '#00f0ff'}
                    stroke="#020617"
                    strokeWidth="1"
                  />
                );
              })}

              {/* 6. Active Drone Marker on Profile */}
              <g transform={`translate(${droneX}, ${droneY})`}>
                {/* Vertical Altitude Tether down to ground */}
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2={yForAlt(0) - droneY}
                  stroke="#00f0ff"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.8"
                />

                {/* Ground anchor circle */}
                <circle
                  cx="0"
                  cy={yForAlt(0) - droneY}
                  r="2"
                  fill="#00f0ff"
                  opacity="0.9"
                />

                {/* Pulsing Beacon Halo */}
                <circle
                  cx="0"
                  cy="0"
                  r="9"
                  fill="none"
                  stroke="#00f0ff"
                  strokeWidth="1.5"
                  opacity="0.6"
                  className="animate-ping"
                />

                {/* Drone Symbol */}
                <circle
                  cx="0"
                  cy="0"
                  r="5"
                  fill="#00f0ff"
                  stroke="#020617"
                  strokeWidth="1.5"
                />

                {/* Altitude Floating Tag */}
                <rect
                  x="-20"
                  y="-18"
                  width="40"
                  height="12"
                  fill="#080d1a"
                  stroke="#00f0ff"
                  strokeWidth="1"
                  rx="2"
                />
                <text
                  x="0"
                  y="-9"
                  fill="#00f0ff"
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {currentAlt}m
                </text>
              </g>

              {/* Axis Labels */}
              <text x={paddingX} y={yForAlt(0) + 10} fill="#64748b" fontSize="8" fontFamily="monospace">
                DEP (0 km)
              </text>
              <text x={svgWidth - paddingX} y={yForAlt(0) + 10} fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="end">
                ARR ({totalDistKm.toFixed(1)} km)
              </text>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
