import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  Package, 
  Route, 
  Sliders, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Eye, 
  Battery, 
  ShieldCheck, 
  Radio, 
  Gauge, 
  Clock, 
  Crosshair, 
  Zap,
  ShieldAlert,
  Building2,
  Navigation,
  Shield,
  Compass,
  ArrowRight
} from 'lucide-react';
import { Drone, Waypoint, ObstacleConflict } from '../types/fleet';
import { formatWaypointDistance, getWaypointStatusBadge, getDistanceMeters } from '../services/telemetryEngine';

interface DroneDetailPanelProps {
  drone: Drone;
  onClose: () => void;
  onPauseResume: (droneId: string) => void;
  onTriggerReplan: (droneId: string) => void;
  onTriggerRTB: (droneId: string) => void;
  onMarkComplete: (droneId: string) => void;
  onSwitchToPOV: () => void;
  onSelectWaypoint: (wpId: string) => void;
  selectedWaypointId: string | null;
  activeConflict?: ObstacleConflict | null;
}

export const DroneDetailPanel: React.FC<DroneDetailPanelProps> = ({
  drone,
  onClose,
  onPauseResume,
  onTriggerReplan,
  onTriggerRTB,
  onMarkComplete,
  onSwitchToPOV,
  onSelectWaypoint,
  selectedWaypointId,
  activeConflict,
}) => {
  const [activeTab, setActiveTab] = useState<'vitals' | 'obstacles' | 'airspace' | 'delivery' | 'waypoints' | 'controls'>('waypoints');

  useEffect(() => {
    if (selectedWaypointId) {
      setActiveTab('waypoints');
    }
  }, [selectedWaypointId]);

  const getRtbBadge = (status: string) => {
    switch (status) {
      case 'SUFFICIENT':
        return { text: 'SUFFICIENT RESERVE', color: 'bg-emerald-950/80 text-emerald-400 border-emerald-800' };
      case 'LOW_RESERVE':
        return { text: 'LOW RESERVE MARGIN', color: 'bg-amber-950/80 text-amber-400 border-amber-800' };
      case 'RTB_RECOMMENDED':
        return { text: 'RTB RECOMMENDED', color: 'bg-rose-950/80 text-rose-400 border-rose-800 animate-pulse' };
      default:
        return { text: 'CALCULATING', color: 'bg-slate-900 text-slate-400 border-slate-700' };
    }
  };

  const rtbBadge = getRtbBadge(drone.vitals.rtbStatus);

  return (
    <div className="h-72 bg-[#0c101a] border-t border-cyan-500/40 flex flex-col select-none shrink-0 overflow-hidden shadow-2xl relative z-20">
      {/* Top Header of Detail Panel */}
      <div className="h-11 px-4 bg-[#111726] border-b border-[#1f2a40] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden mr-2">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <span className={`w-3 h-3 rounded-full ${activeConflict ? 'bg-rose-500 animate-ping' : 'bg-cyan-400 animate-pulse'}`}></span>
            <span className="font-extrabold font-mono text-base tracking-wider text-white">
              {drone.callsign}
            </span>
            <span className="text-xs font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
              {drone.model}
            </span>
          </div>

          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 min-w-0">
            <button
              onClick={() => setActiveTab('vitals')}
              className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'vitals'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              A. Vitals
            </button>

            <button
              onClick={() => setActiveTab('obstacles')}
              className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'obstacles'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : activeConflict
                  ? 'text-rose-300 bg-rose-950/40 border border-rose-800 animate-pulse'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              B. 3D Obstacles
              {activeConflict && (
                <span className="w-2 h-2 rounded-full bg-rose-400 ml-0.5 animate-ping"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('airspace')}
              className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'airspace'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : drone.airspaceStatus === 'PROHIBITED'
                  ? 'text-rose-300 bg-rose-950/40 border border-rose-800 animate-pulse'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              C. Airspace
              {drone.isRerouting && (
                <span className="px-1 py-0.2 rounded bg-cyan-900 text-cyan-300 text-[9px] uppercase font-bold">A*</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('delivery')}
              className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'delivery'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              D. Delivery
            </button>

            <button
              onClick={() => setActiveTab('waypoints')}
              className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'waypoints'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Navigation className="w-3.5 h-3.5 text-cyan-400" />
              E. Route HUD
            </button>

            <button
              onClick={() => setActiveTab('controls')}
              className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'controls'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              F. Controls
            </button>
          </div>
        </div>

        {/* Right close & quick actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onSwitchToPOV}
            className="flex items-center gap-1.5 px-3 py-1 bg-cyan-950 text-cyan-300 border border-cyan-700/60 rounded text-xs font-mono font-bold hover:bg-cyan-900/60 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>POV COCKPIT</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            title="Minimize Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 p-3.5 overflow-y-auto custom-scrollbar">
        {/* SECTION A: DRONE VITALS */}
        {activeTab === 'vitals' && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 h-full">
            {/* 1. Battery & Smart RTB Prediction */}
            <div className="md:col-span-2 bg-[#121828] border border-[#202e48] p-3 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-slate-300 font-bold uppercase flex items-center gap-1.5">
                  <Battery className="w-4 h-4 text-emerald-400" /> Power &amp; RTB Reserve
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold border rounded ${rtbBadge.color}`}>
                  {rtbBadge.text}
                </span>
              </div>

              <div className="flex items-baseline gap-2.5 my-1">
                <span className="text-3xl font-mono font-extrabold text-white">
                  {Math.round(drone.vitals.batteryPercentage)}%
                </span>
                <span className="text-xs font-mono text-slate-300">
                  {drone.vitals.batteryVoltage}V • {drone.vitals.estimatedFlightTimeMinutes}m remaining
                </span>
              </div>

              {/* Reserve calculation bar */}
              <div className="mt-2 text-xs font-mono space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Energy to CMCH Master Hub</span>
                  <span className="text-white font-bold">{drone.vitals.energyRequiredToTargetWh} Wh</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                  <div className="bg-cyan-500 h-full" style={{ width: `${Math.min(100, (drone.vitals.energyRequiredToTargetWh / 150) * 100)}%` }}></div>
                  <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, drone.vitals.energyReserveMarginPercent)}%` }}></div>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Burn: {drone.vitals.energyBurnRateWhPerKm} Wh/km</span>
                  <span>Reserve Margin: {drone.vitals.energyReserveMarginPercent}%</span>
                </div>
              </div>
            </div>

            {/* 2. Kinematics (Altitude, Speed, Heading) */}
            <div className="bg-[#121828] border border-[#202e48] p-3 rounded-lg flex flex-col justify-between">
              <div className="text-xs font-mono text-slate-300 font-bold uppercase flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-cyan-400" /> Kinematics
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Altitude:</span>
                  <span className="text-white font-bold text-sm">{Math.round(drone.vitals.altitudeMeters)}m AGL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ground Speed:</span>
                  <span className="text-cyan-300 font-bold text-sm">{Math.round(drone.vitals.groundSpeedKmh)} km/h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Heading:</span>
                  <span className="text-white font-bold">{drone.vitals.headingDegrees}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">V. Speed:</span>
                  <span className="text-slate-300">{drone.vitals.verticalSpeedMs} m/s</span>
                </div>
              </div>
            </div>

            {/* 3. Navigation & GPS Quality */}
            <div className="bg-[#121828] border border-[#202e48] p-3 rounded-lg flex flex-col justify-between">
              <div className="text-xs font-mono text-slate-300 font-bold uppercase flex items-center gap-1.5">
                <Crosshair className="w-4 h-4 text-emerald-400" /> GPS Navigation
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Fix Quality:</span>
                  <span className="text-emerald-400 font-bold">{drone.vitals.gpsFix}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Satellites:</span>
                  <span className="text-white font-bold">{drone.vitals.satellites} Sats (RTK)</span>
                </div>
                <div className="text-[11px] text-slate-300 truncate pt-1">
                  Lat {drone.vitals.latitude.toFixed(5)}°<br/>Lon {drone.vitals.longitude.toFixed(5)}°
                </div>
              </div>
            </div>

            {/* 4. RF Telemetry Link */}
            <div className="bg-[#121828] border border-[#202e48] p-3 rounded-lg flex flex-col justify-between">
              <div className="text-xs font-mono text-slate-300 font-bold uppercase flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-cyan-400" /> RF Telemetry
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Signal RSSI:</span>
                  <span className="text-white font-bold">{drone.vitals.signalStrengthDbm} dBm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Link Quality:</span>
                  <span className="text-cyan-400 font-bold">{drone.vitals.signalQualityPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Carrier:</span>
                  <span className="text-slate-300">5.8 GHz BVLOS</span>
                </div>
              </div>
            </div>

            {/* 5. Motors & Health */}
            <div className="bg-[#121828] border border-[#202e48] p-3 rounded-lg flex flex-col justify-between">
              <div className="text-xs font-mono text-slate-300 font-bold uppercase flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" /> Motors &amp; Health
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Motor Health:</span>
                  <span className="text-emerald-400 font-bold">{drone.vitals.motorHealthPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Core Temp:</span>
                  <span className="text-amber-300 font-bold">{drone.vitals.motorTempsCelsius[0]}°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payload:</span>
                  <span className="text-white font-bold">{drone.vitals.payloadWeightKg} / {drone.vitals.maxPayloadKg} kg</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION B: 3D OBSTACLE AWARENESS */}
        {activeTab === 'obstacles' && (
          <div className="h-full">
            {activeConflict ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full">
                <div className="p-3 bg-rose-950/40 border border-rose-500 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-rose-300 font-mono text-xs font-bold uppercase mb-1">
                      <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
                      Active 3D Collision Risk
                    </div>
                    <div className="text-base font-bold text-white mb-2 leading-snug">
                      {activeConflict.obstacleName}
                    </div>
                    <div className="text-xs text-rose-200 leading-relaxed">
                      {activeConflict.suggestedAction}
                    </div>
                  </div>
                  <div className="mt-2 text-xs font-mono text-rose-300 pt-2 border-t border-rose-800">
                    Confidence: <span className="font-bold uppercase text-white">{activeConflict.heightConfidence}</span>
                  </div>
                </div>

                <div className="p-3 bg-[#121828] border border-[#202e48] rounded-lg flex flex-col justify-between font-mono">
                  <div className="text-xs text-slate-400 uppercase font-bold">3D Proximity Geometry</div>
                  <div className="space-y-2 my-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 text-xs">Horizontal Distance:</span>
                      <span className="text-2xl font-bold text-white">{activeConflict.horizontalDistanceMeters}m</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 text-xs">Vertical Clearance:</span>
                      <span className={`text-2xl font-bold ${activeConflict.verticalClearanceMeters < 15 ? 'text-rose-400' : 'text-amber-400'}`}>
                        {activeConflict.verticalClearanceMeters > 0 ? `+${activeConflict.verticalClearanceMeters}m` : `${activeConflict.verticalClearanceMeters}m`}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Structure Height: <span className="text-white font-bold">{activeConflict.obstacleHeightMeters}m AGL</span>
                  </div>
                </div>

                <div className="p-3 bg-[#121828] border border-[#202e48] rounded-lg flex flex-col justify-between">
                  <div className="text-xs text-slate-400 uppercase font-bold font-mono">Autonomous Avoidance</div>
                  <div className="text-xs text-slate-300 leading-relaxed my-2">
                    Predictive trajectory analysis calculated an impact horizon of <span className="text-rose-400 font-bold font-mono">{activeConflict.estimatedTimeToImpactSec} seconds</span> along current vector.
                  </div>
                  <button
                    onClick={() => onTriggerReplan(drone.id)}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded font-mono text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    EXECUTE EMERGENCY DETOUR (REPLAN)
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-6 bg-[#121828] border border-[#202e48] rounded-lg text-center">
                <div>
                  <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <div className="text-sm font-bold text-white font-mono">Airspace Corridor Clear (Zero Conflicts)</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Aircraft altitude is maintaining verified clearance above all mapped Coimbatore buildings and elevated flyovers.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION C: AIRSPACE & ATC CLEARANCE */}
        {activeTab === 'airspace' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full">
            {/* 1. Zone Classification */}
            <div className={`p-3 rounded-lg border flex flex-col justify-between ${
              drone.airspaceStatus === 'PROHIBITED' ? 'bg-rose-950/40 border-rose-600 text-rose-200' :
              drone.airspaceStatus === 'PERMISSION_REQUIRED' ? 'bg-amber-950/40 border-amber-600 text-amber-200' :
              'bg-[#121828] border-[#202e48] text-slate-200'
            }`}>
              <div>
                <div className="text-xs font-mono uppercase font-bold flex items-center justify-between mb-1">
                  <span>Current Airspace Classification</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                    drone.airspaceStatus === 'PROHIBITED' ? 'bg-rose-900 text-rose-200 border-rose-700' :
                    drone.airspaceStatus === 'PERMISSION_REQUIRED' ? 'bg-amber-900 text-amber-200 border-amber-700' :
                    'bg-emerald-900 text-emerald-200 border-emerald-700'
                  }`}>
                    {drone.airspaceStatus || 'PERMITTED'}
                  </span>
                </div>
                <div className="text-sm font-bold text-white mb-1">
                  {drone.currentAirspaceZone?.name || 'Coimbatore Open Corridor (Green Zone)'}
                </div>
                <div className="text-xs text-slate-300">
                  Authority: {drone.currentAirspaceZone?.permissionAuthority || drone.currentAirspaceZone?.sourceAuthority || 'DGCA / Digital Sky India'}
                </div>
              </div>
              <div className="text-xs font-mono pt-2 border-t border-slate-700/60 flex justify-between">
                <span>Vertical Limits:</span>
                <span className="font-bold text-white">
                  {drone.currentAirspaceZone?.lowerAltitudeLimitMeters ?? drone.currentAirspaceZone?.lowerLimitMeters ?? 0}m - {drone.currentAirspaceZone?.upperAltitudeLimitMeters ?? drone.currentAirspaceZone?.upperLimitMeters ?? 120}m AGL
                </span>
              </div>
            </div>

            {/* 2. ATC Authorization & Permits */}
            <div className="p-3 bg-[#121828] border border-[#202e48] rounded-lg flex flex-col justify-between font-mono">
              <div>
                <div className="text-xs text-slate-400 uppercase font-bold mb-1">ATC Authorization &amp; Tokens</div>
                {drone.atcPermissions && drone.atcPermissions.length > 0 ? (
                  drone.atcPermissions.map((p) => (
                    <div key={p.permitId || p.permitCode} className="bg-[#0b0f19] p-2 rounded border border-cyan-900/50 text-xs space-y-1">
                      <div className="flex justify-between text-cyan-300 font-bold">
                        <span>{p.permitId || p.permitCode}</span>
                        <span className="text-emerald-400">ACTIVE</span>
                      </div>
                      <div className="text-[11px] text-slate-300">{p.purpose || 'Official Airspace Permit'}</div>
                      <div className="text-[10px] text-slate-400">Auth: {p.authority || p.issuedBy} • Max {p.maxAltitudeMeters ?? p.allowedMaxAltitudeMeters}m AGL</div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 leading-relaxed">
                    No active ATC permits assigned. Standard civilian UAS Green zone limits apply (max 400ft / 120m AGL).
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
                <span>Nearest Restricted Zone:</span>
                <span className="text-amber-400 font-bold">
                  {drone.distanceToNearestRestrictedZoneMeters ? `${drone.distanceToNearestRestrictedZoneMeters}m` : 'Clear (>5km)'}
                </span>
              </div>
            </div>

            {/* 3. A* Autonomous Reroute Engine Status */}
            <div className="p-3 bg-[#121828] border border-[#202e48] rounded-lg flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono text-slate-400 uppercase font-bold mb-1">A* 3D Rerouting Status</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${drone.isRerouting ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'}`} />
                  <span className="text-sm font-bold text-white font-mono">
                    {drone.isRerouting ? 'A* REROUTE ACTIVE' : 'CORRIDOR NOMINAL'}
                  </span>
                </div>
                {drone.rerouteReason && (
                  <p className="text-xs text-cyan-300 font-mono leading-relaxed bg-[#0b0f19] p-2 rounded border border-cyan-950">
                    {drone.rerouteReason}
                  </p>
                )}
              </div>
              <button
                onClick={() => onTriggerReplan(drone.id)}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded font-mono text-xs font-bold transition-colors flex items-center justify-center gap-2 mt-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                EXECUTE A* INTELLIGENT DETOUR
              </button>
            </div>
          </div>
        )}

        {/* SECTION D: DELIVERY MANIFEST */}
        {activeTab === 'delivery' && (
          <div className="h-full">
            {drone.delivery ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full">
                <div className="bg-[#121828] border border-[#202e48] p-3 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-mono text-slate-400 uppercase font-bold mb-1">Package Payload</div>
                    <div className="text-sm font-bold text-white">{drone.delivery.packageDescription}</div>
                    <div className="text-xs text-cyan-300 font-mono mt-1">
                      ID: {drone.delivery.packageId} • Weight: {drone.delivery.packageWeightKg} kg
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 pt-2 border-t border-slate-800">
                    Priority: <span className="text-rose-400 font-bold uppercase font-mono">{drone.delivery.priority}</span>
                  </div>
                </div>

                <div className="bg-[#121828] border border-[#202e48] p-3 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-mono text-slate-400 uppercase font-bold mb-1">Recipient Destination</div>
                    <div className="text-sm font-bold text-white">{drone.delivery.recipientName}</div>
                    <div className="text-xs text-slate-300 mt-1">{drone.delivery.destinationAddress}</div>
                  </div>
                  <div className="text-xs text-slate-400 pt-2 border-t border-slate-800 font-mono">
                    Phone: {drone.delivery.recipientPhone}
                  </div>
                </div>

                <div className="bg-[#121828] border border-[#202e48] p-3 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-mono text-slate-400 uppercase font-bold mb-1">Delivery Actions</div>
                    <div className="text-xs text-slate-300 mb-2">
                      Estimated Arrival: <span className="text-cyan-300 font-bold font-mono">{drone.delivery.estimatedArrivalTime}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onMarkComplete(drone.id)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-mono text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    CONFIRM PACKAGE DROP &amp; VERIFY PIN
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 text-slate-500 font-mono text-xs">No active delivery package loaded.</div>
            )}
          </div>
        )}

        {/* SECTION E: ROUTE INTELLIGENCE & DETERMINISTIC NAVIGATION */}
        {activeTab === 'waypoints' && (
          <div className="flex flex-col gap-3 h-full">
            {/* Top Bar: Origin -> Destination Banner with Status & Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 shrink-0 bg-[#111726] p-2.5 rounded-lg border border-[#202e48]">
              {/* Origin -> Destination */}
              <div className="md:col-span-2 flex items-center justify-between gap-2 font-mono text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 shrink-0">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Assigned Mission Corridor</div>
                    <div className="flex items-center gap-1.5 text-white font-bold truncate">
                      <span className="text-cyan-300 truncate" title={drone.missionStartLocation || drone.missionOriginName || 'Peelamedu Depot'}>
                        {drone.missionStartLocation || drone.missionOriginName || 'Peelamedu Depot'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-emerald-300 truncate" title={drone.missionDestinationName || drone.delivery?.destinationAddress || 'CMCH Hub'}>
                        {drone.missionDestinationName || drone.delivery?.destinationAddress || 'CMCH Hub'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onTriggerReplan(drone.id)}
                  className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/80 rounded font-mono text-[11px] font-bold text-cyan-300 hover:text-white transition-all flex items-center gap-1.5 shrink-0"
                  title="Preview safe 3D A* detour and alternatives matrix"
                >
                  <RefreshCw className="w-3 h-3 text-cyan-400" />
                  <span>A* DETOUR</span>
                </button>
              </div>

              {/* Status Badge & Bearing */}
              <div className="flex items-center justify-between md:justify-around bg-[#0a0e18] px-3 py-1.5 rounded border border-[#1b273d] text-xs font-mono">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Route Status</div>
                  <div className={`font-bold uppercase ${
                    drone.routeStatus === 'MISSION_COMPLETED' ? 'text-emerald-400' :
                    drone.routeStatus === 'A_STAR_REROUTED' ? 'text-cyan-300' :
                    'text-cyan-400'
                  }`}>
                    {drone.routeStatus || (drone.isRerouting ? 'A* REROUTED' : 'ON_COURSE')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase">Heading</div>
                  <div className="font-bold text-white flex items-center gap-1">
                    <Compass className="w-3 h-3 text-cyan-400 inline" />
                    {Math.round(drone.vitals.headingDegrees ?? drone.targetHeadingDegrees ?? 0)}°
                  </div>
                </div>
              </div>

              {/* Distance Remaining, Status & ETA */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0a0e18] px-3 py-2 rounded border border-[#1b273d] text-xs font-mono">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Dist to Next WP</div>
                  <div className="font-bold text-cyan-300">
                    {formatWaypointDistance(drone.distanceToNextWaypointMeters)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Target Status</div>
                  {(() => {
                    const badge = getWaypointStatusBadge(drone.nextWaypointStatus);
                    return (
                      <div className={`font-bold ${badge.colorClass}`}>
                        {badge.label}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Total Route Left</div>
                  <div className="font-bold text-slate-200">
                    {drone.distanceRemainingKm !== undefined ? `${drone.distanceRemainingKm.toFixed(2)} km` : `${(drone.route.length * 0.8).toFixed(1)} km`}
                  </div>
                </div>
                <div className="text-right sm:text-left">
                  <div className="text-[10px] text-slate-400 uppercase">Est. ETA</div>
                  <div className="font-bold text-emerald-400">
                    {drone.etaSecondsRemaining !== undefined ? `${Math.ceil(drone.etaSecondsRemaining / 60)} min` : `${drone.vitals.estimatedFlightTimeMinutes} min`}
                  </div>
                </div>
              </div>
            </div>

            {/* Waypoints Sequence Timeline */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar min-h-0">
              <div className="flex gap-2.5 h-full items-stretch py-0.5">
                {drone.route.map((wp, idx) => {
                  const targetIdx = drone.targetWaypointIndex !== undefined
                    ? drone.targetWaypointIndex
                    : (drone.currentWaypointIndex === 0 && drone.route.length > 1 ? 1 : drone.currentWaypointIndex);
                  const isSelected = wp.id === selectedWaypointId;
                  const isCurrent = idx === targetIdx;
                  const isDone = wp.status === 'completed' || idx < targetIdx;
                  const isDest = idx === drone.route.length - 1 || wp.type === 'delivery';
                  const wpNum = String(idx + 1).padStart(2, '0');

                  const wpDist = isCurrent && drone.distanceToNextWaypointMeters !== undefined
                    ? drone.distanceToNextWaypointMeters
                    : Math.round(getDistanceMeters(drone.vitals.latitude, drone.vitals.longitude, wp.lat, wp.lng));
                  const formattedWpDist = formatWaypointDistance(wpDist);

                  let cardStyle = 'border-slate-800 bg-[#0e1422] text-slate-400';
                  if (isSelected) {
                    cardStyle = 'border-cyan-400 bg-cyan-950/70 text-white ring-2 ring-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.4)]';
                  } else if (isCurrent) {
                    cardStyle = drone.nextWaypointStatus === 'NEAR_WAYPOINT'
                      ? 'border-amber-400/90 bg-amber-950/40 text-amber-100 ring-1 ring-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                      : 'border-cyan-400/90 bg-cyan-950/40 text-cyan-100 ring-1 ring-cyan-400/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]';
                  } else if (isDone) {
                    cardStyle = 'border-emerald-800/80 bg-emerald-950/20 text-emerald-300';
                  }

                  return (
                    <div
                      key={wp.id}
                      onClick={() => onSelectWaypoint(wp.id)}
                      className={`w-52 p-2.5 rounded-lg border ${cardStyle} cursor-pointer hover:border-cyan-400 hover:bg-[#131d2e] transition-all flex flex-col justify-between shrink-0 select-none`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono font-bold">
                        <span className="flex items-center gap-1.5">
                          {isDone ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : isCurrent ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping inline-block shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          )}
                          <span className="font-extrabold text-white">WP-{wpNum}</span>
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded uppercase font-bold ${
                          isDone ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                          isCurrent ? (drone.nextWaypointStatus === 'NEAR_WAYPOINT' ? 'bg-amber-900 text-amber-300 border border-amber-500 animate-pulse' : 'bg-cyan-900 text-cyan-300 border border-cyan-500 animate-pulse') :
                          isDest ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {isCurrent ? (drone.nextWaypointStatus === 'WAYPOINT_REACHED' ? 'REACHED' : `TARGET (${formattedWpDist})`) : isDone ? 'PASSED' : isDest ? 'DEST PAD' : wp.type}
                        </span>
                      </div>

                      <div className="my-1.5">
                        <div className="text-xs font-bold text-white truncate" title={wp.name}>
                          {wp.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center justify-between">
                          <span>{wp.lat.toFixed(4)}°N, {wp.lng.toFixed(4)}°E</span>
                          <span className="text-cyan-300 font-bold">{formattedWpDist}</span>
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">CORRIDOR:</span>
                        <span className="text-cyan-300 font-bold">{wp.altitudeMeters}m AGL</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SECTION E: CONTROLS */}
        {activeTab === 'controls' && (
          <div className="flex items-center gap-3 h-full">
            <button
              onClick={() => onPauseResume(drone.id)}
              className="flex-1 py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-slate-600"
            >
              {drone.isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
              <span>{drone.isPaused ? 'RESUME MISSION CORRIDOR' : 'HOLD AUTO-HOVER (PAUSE)'}</span>
            </button>

            <button
              onClick={() => onTriggerReplan(drone.id)}
              className="flex-1 py-3 px-4 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 font-mono text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-cyan-700"
            >
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <span>DYNAMIC DETOUR REPLAN</span>
            </button>

            <button
              onClick={() => onTriggerRTB(drone.id)}
              className="flex-1 py-3 px-4 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 font-mono text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-rose-700"
            >
              <RotateCcw className="w-4 h-4 text-rose-400" />
              <span>ABORT &amp; RETURN TO BASE (RTB)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
