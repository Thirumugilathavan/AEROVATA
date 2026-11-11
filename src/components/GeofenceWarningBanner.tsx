import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, X, Check, ShieldCheck } from 'lucide-react';
import { Drone, OfficialAirspaceZone, ObstacleConflict } from '../types/fleet';
import { getDistanceMeters } from '../services/telemetryEngine';

export interface GeofenceWarningBannerProps {
  selectedDrone: Drone | null;
  officialAirspaceZones: OfficialAirspaceZone[];
  obstacleConflicts?: ObstacleConflict[];
}

export const GeofenceWarningBanner: React.FC<GeofenceWarningBannerProps> = ({
  selectedDrone,
  officialAirspaceZones,
  obstacleConflicts = [],
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [acknowledgedZoneId, setAcknowledgedZoneId] = useState<string | null>(null);

  if (isDismissed || !selectedDrone) {
    return null;
  }

  const droneLat = selectedDrone.vitals.latitude;
  const droneLng = selectedDrone.vitals.longitude;

  // Find if drone is near or inside any restricted Red or Yellow airspace zone
  let activeWarningZone: OfficialAirspaceZone | null = null;
  let minDistanceMeters = Infinity;
  let isInside = false;

  for (const zone of officialAirspaceZones) {
    if (zone.classification !== 'RED' && zone.classification !== 'YELLOW') continue;
    if (acknowledgedZoneId === zone.id) continue;

    // Check distance from drone to polygon vertices
    for (const pt of zone.coordinates) {
      const d = getDistanceMeters(droneLat, droneLng, pt[1], pt[0]);
      if (d < minDistanceMeters) {
        minDistanceMeters = Math.round(d);
        if (d < 450) { // Within proximity threshold
          activeWarningZone = zone;
        }
      }
    }

    // Check if drone status is prohibited
    if (selectedDrone.airspaceStatus === 'PROHIBITED' && zone.classification === 'RED') {
      isInside = true;
      activeWarningZone = zone;
      break;
    }
  }

  // Also check if selected drone has an active obstacle conflict
  const activeConflict = obstacleConflicts.find((c) => c.droneId === selectedDrone.id);

  if (!activeWarningZone && !activeConflict) {
    return null;
  }

  const isRed = isInside || activeWarningZone?.classification === 'RED' || activeConflict?.severity === 'critical';
  const bannerTitle = isInside
    ? 'CRITICAL RESTRICTED AIRSPACE VIOLATION'
    : activeWarningZone
    ? `AIRSPACE PROXIMITY ADVISORY: ${activeWarningZone.classification} ZONE`
    : `PHYSICAL OBSTACLE COLLISION WARNING`;

  const bannerDetail = isInside
    ? `${activeWarningZone?.name || 'Prohibited Airspace'} · IMMEDIATE OPERATOR INTERVENTION REQUIRED`
    : activeWarningZone
    ? `${activeWarningZone.name} · ${minDistanceMeters}m to restricted perimeter`
    : `${activeConflict?.obstacleName} · ${activeConflict?.horizontalDistanceMeters}m separation`;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto max-w-xl w-full px-4 animate-in slide-in-from-top-3 duration-200 select-none font-mono">
      <div className={`p-2.5 rounded-lg border backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3 ${
        isRed
          ? 'bg-rose-950/95 border-rose-500/80 text-rose-100 shadow-[0_0_24px_rgba(239,68,68,0.4)] ring-1 ring-rose-500/50'
          : 'bg-amber-950/95 border-amber-500/80 text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.4)] ring-1 ring-amber-500/50'
      }`}>
        {/* Left: Icon & Description */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-1.5 rounded-md shrink-0 ${isRed ? 'bg-rose-900 border border-rose-700 animate-pulse' : 'bg-amber-900 border border-amber-700'}`}>
            {isRed ? (
              <ShieldAlert className="w-4 h-4 text-rose-300" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-300" />
            )}
          </div>
          <div className="truncate">
            <div className={`text-[11px] font-extrabold uppercase tracking-wide truncate ${isRed ? 'text-rose-200' : 'text-amber-200'}`}>
              {bannerTitle}
            </div>
            <div className={`text-[10px] truncate ${isRed ? 'text-rose-300/90' : 'text-amber-300/90'}`}>
              {bannerDetail}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              if (activeWarningZone) setAcknowledgedZoneId(activeWarningZone.id);
              setIsDismissed(true);
            }}
            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors flex items-center gap-1 ${
              isRed 
                ? 'bg-rose-900/80 hover:bg-rose-800 text-rose-100 border border-rose-600'
                : 'bg-amber-900/80 hover:bg-amber-800 text-amber-100 border border-amber-600'
            }`}
            title="Acknowledge restricted airspace notice"
          >
            <Check className="w-3 h-3" />
            <span>Acknowledge</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded text-slate-400 hover:text-white transition-colors"
            title="Dismiss banner"
            aria-label="Dismiss warning"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
