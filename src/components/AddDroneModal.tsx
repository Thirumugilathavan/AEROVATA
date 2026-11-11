import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Navigation, 
  Compass, 
  CheckCircle2, 
  AlertTriangle, 
  Route as RouteIcon, 
  MousePointerClick,
  Sliders,
  ShieldCheck,
  Layers, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { QuadcopterIcon } from './icons/QuadcopterIcon';
import { LoadingSpinner } from './loading/LoadingSpinner';
import { Drone, DroneStatus, Waypoint, RouteCandidate } from '../types/fleet';
import { COIMBATORE_DETAILED_OBSTACLES } from '../data/coimbatoreGeoData';
import { getBearingDegrees } from '../services/telemetryEngine';
import { 
  COIMBATORE_LOCATIONS, 
  DEFAULT_STARTING_LOCATION, 
  calculateDroneAStarRoute, 
  calculateDroneMultiRoute,
  DroneAStarRouteResult,
  DroneMultiRouteResult,
  OFFICIAL_REGULATORY_CONFIG,
  isCoordinateWithinBounds 
} from '../services/droneAStarRouter';

interface AddDroneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDrone: (newDrone: Drone) => void;
  existingDrones: Drone[];
  mapPickedCoords: [number, number] | null;
  onStartMapPickMode: () => void;
  isMapPickingActive: boolean;
}

const DRONE_MODELS = [
  { id: 'SkyHauler-Q4', name: 'Aerovata SkyHauler Q4 Quadcopter', maxPayloadKg: 4.5, enduranceMin: 42 },
  { id: 'MediDrop-Pro', name: 'MediDrop Autonomous Medical Quadcopter', maxPayloadKg: 3.0, enduranceMin: 48 },
  { id: 'AirPatrol-X4', name: 'AirPatrol X4 UTM Surveillance Quadcopter', maxPayloadKg: 2.5, enduranceMin: 55 },
  { id: 'HeavyLift-Q8', name: 'SkyCarrier Q4 Heavy Cargo Drone', maxPayloadKg: 7.0, enduranceMin: 35 },
];

export const AddDroneModal: React.FC<AddDroneModalProps> = ({
  isOpen,
  onClose,
  onAddDrone,
  existingDrones,
  mapPickedCoords,
  onStartMapPickMode,
  isMapPickingActive,
}) => {
  // Generate next unique ID & Name (DRONE-001, DRONE-002, ...)
  const nextNumber = existingDrones.length + 1;
  const defaultId = `DRONE-${nextNumber.toString().padStart(3, '0')}`;
  const defaultCallsign = `DRONE ${nextNumber.toString().padStart(2, '0')}`;

  const [droneId, setDroneId] = useState(defaultId);
  const [callsign, setCallsign] = useState(defaultCallsign);
  const [selectedModel, setSelectedModel] = useState(DRONE_MODELS[0].name);
  const [startLocId, setStartLocId] = useState(DEFAULT_STARTING_LOCATION.id);
  const [destMode, setDestMode] = useState<'preset' | 'map'>('preset');
  const [presetDestId, setPresetDestId] = useState(COIMBATORE_LOCATIONS[1].id); // Peelamedu Depot
  const [customDestCoords, setCustomDestCoords] = useState<[number, number] | null>(null);
  const [customDestName, setCustomDestName] = useState('Custom Map Destination');
  const [initialStatus, setInitialStatus] = useState<'READY' | 'IDLE'>('READY');
  const [cruiseAltitude, setCruiseAltitude] = useState<number>(65); // metres AGL
  const [checkpointSpacing, setCheckpointSpacing] = useState<number>(100); // metres
  const [multiRouteResult, setMultiRouteResult] = useState<DroneMultiRouteResult | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('cand-optimal');

  // Route calculation state
  const [routeResult, setRouteResult] = useState<DroneAStarRouteResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync auto-generated names when existing drones count changes
  useEffect(() => {
    if (isOpen) {
      const num = existingDrones.length + 1;
      setDroneId(`DRONE-${num.toString().padStart(3, '0')}`);
      setCallsign(`DRONE ${num.toString().padStart(2, '0')}`);
    }
  }, [isOpen, existingDrones.length]);

  // When user clicks on map in pick mode, update custom coordinates
  useEffect(() => {
    if (mapPickedCoords) {
      setCustomDestCoords(mapPickedCoords);
      setCustomDestName(`Map Point [${mapPickedCoords[0].toFixed(4)}°, ${mapPickedCoords[1].toFixed(4)}°]`);
      setDestMode('map');
    }
  }, [mapPickedCoords]);

  // Selected start location details
  const startLoc = COIMBATORE_LOCATIONS.find((l) => l.id === startLocId) || DEFAULT_STARTING_LOCATION;

  // Selected destination coordinates and name
  const destCoords: [number, number] = destMode === 'preset'
    ? (COIMBATORE_LOCATIONS.find((l) => l.id === presetDestId)?.coordinates || COIMBATORE_LOCATIONS[1].coordinates)
    : (customDestCoords || [77.0120, 11.0260]);

  const destName: string = destMode === 'preset'
    ? (COIMBATORE_LOCATIONS.find((l) => l.id === presetDestId)?.name || 'Peelamedu Depot')
    : customDestName;

  // Calculate Multi-Candidate A* Routes with Adaptive Checkpoints
  const computeRoute = () => {
    setIsCalculating(true);
    // Yield to let React paint the calculating state before synchronous A* calculations run
    setTimeout(() => {
      try {
        const dynamicObs = typeof window !== 'undefined' && (window as any).__getDynamicBuildingObstacles
          ? (window as any).__getDynamicBuildingObstacles()
          : [];
        const combinedObs = dynamicObs.length > 0 ? [...COIMBATORE_DETAILED_OBSTACLES, ...dynamicObs] : undefined;

        const multi = calculateDroneMultiRoute(startLoc.coordinates, destCoords, {
          startName: startLoc.name,
          destName,
          cruiseAltMeters: cruiseAltitude,
          safetyMarginMeters: 35,
          checkpointSpacingMeters: checkpointSpacing,
          obstacles: combinedObs,
        });
        setMultiRouteResult(multi);

        if (multi.success && multi.primaryRoute) {
          // Find selected candidate or fallback to primary
          const chosen = multi.allCandidates.find((c: RouteCandidate) => c.id === selectedCandidateId) || multi.primaryRoute;
          setSelectedCandidateId(chosen.id);

          setRouteResult({
            success: true,
            coordinates: chosen.coordinates,
            waypoints: chosen.waypoints,
            distanceKm: chosen.distanceKm,
            estimatedMinutes: chosen.simulatedMinutes,
            candidates: multi.allCandidates,
            validation: chosen.validation,
          });
        } else {
          setRouteResult({
            success: false,
            coordinates: [],
            waypoints: [],
            distanceKm: 0,
            estimatedMinutes: 0,
            error: multi.error || 'A* pathfinding could not find a safe collision-free corridor.',
          });
        }
      } catch (err: any) {
        setRouteResult({
          success: false,
          coordinates: [],
          waypoints: [],
          distanceKm: 0,
          estimatedMinutes: 0,
          error: err?.message || 'A* pathfinding encountered an unexpected computation error.',
        });
      } finally {
        setIsCalculating(false);
      }
    }, 25);
  };

  // Recompute route automatically whenever locations change
  useEffect(() => {
    if (isOpen) {
      computeRoute();
    }
  }, [isOpen, startLocId, destMode, presetDestId, customDestCoords, cruiseAltitude, checkpointSpacing]);

  // Update active candidate route when user clicks on an alternative
  useEffect(() => {
    if (multiRouteResult && multiRouteResult.success && multiRouteResult.allCandidates.length > 0) {
      const chosen = multiRouteResult.allCandidates.find((c: RouteCandidate) => c.id === selectedCandidateId) || multiRouteResult.primaryRoute;
      if (chosen) {
        setRouteResult({
          success: true,
          coordinates: chosen.coordinates,
          waypoints: chosen.waypoints,
          distanceKm: chosen.distanceKm,
          estimatedMinutes: chosen.simulatedMinutes,
          candidates: multiRouteResult.allCandidates,
          validation: chosen.validation,
        });
      }
    }
  }, [selectedCandidateId, multiRouteResult]);

  if (!isOpen) return null;

  // Form submission handler
  const handleConfirmAdd = () => {
    if (isSubmitting || isCalculating) return;
    if (!routeResult || !routeResult.success || routeResult.waypoints.length < 2) return;

    setIsSubmitting(true);
    try {

    const modelObj = DRONE_MODELS.find((m) => m.name === selectedModel) || DRONE_MODELS[0];
    const initialDroneStatus: DroneStatus = initialStatus === 'READY' ? 'active' : 'standby';
    const statusLabel = initialStatus === 'READY' ? 'Ready for Autonomous Transit' : 'Idle / Standby';

    const newDrone: Drone = {
      id: droneId.trim() || defaultId,
      callsign: callsign.trim() || defaultCallsign,
      model: selectedModel,
      serialNumber: `TAS-QD-${Math.floor(1000 + Math.random() * 9000)}-TN`,
      status: initialDroneStatus,
      statusLabel,
      currentWaypointIndex: 0,
      targetWaypointIndex: 1,
      flightHours: 0.0,
      lastMaintenance: new Date().toISOString().split('T')[0],
      isPaused: false,
      missionStartLocation: startLoc.name,
      missionStartCoords: startLoc.coordinates,
      missionDestinationName: destName,
      missionDestinationCoords: destCoords,
      routeVersion: 1,
      routeStatus: 'ON_COURSE',
      distanceRemainingKm: routeResult.distanceKm,
      etaSecondsRemaining: routeResult.estimatedMinutes * 60,
      nextWaypointName: routeResult.waypoints[1]?.name || destName,
      flightTrail: [startLoc.coordinates],
      completedRouteWaypoints: [],
      blockedRouteWaypoints: [],
      route: routeResult.waypoints.map((wp, idx) => ({
        ...wp,
        status: idx === 0 ? 'completed' : idx === 1 ? 'active' : 'upcoming',
      })),
      routeCandidates: multiRouteResult?.allCandidates || (routeResult.candidates || []),
      selectedCandidateId: selectedCandidateId,
      checkpointSpacingMeters: checkpointSpacing,
      configuredCruiseAltitudeMeters: cruiseAltitude,
      routeValidationStatus: routeResult.validation?.status || 'VALIDATED',
      routeValidationDetails: routeResult.validation,
      vitals: {
        batteryPercentage: 100,
        batteryVoltage: 25.2,
        estimatedFlightTimeMinutes: modelObj.enduranceMin,
        altitudeMeters: initialStatus === 'READY' ? cruiseAltitude : 0,
        groundSpeedKmh: initialStatus === 'READY' ? 48.0 : 0,
        verticalSpeedMs: 0,
        headingDegrees: Math.round(
          getBearingDegrees(
            startLoc.coordinates[1],
            startLoc.coordinates[0],
            routeResult.waypoints[1]?.lat || destCoords[1],
            routeResult.waypoints[1]?.lng || destCoords[0]
          )
        ),
        latitude: startLoc.coordinates[1],
        longitude: startLoc.coordinates[0],
        gpsFix: 'RTK_FIX',
        satellites: 24,
        signalStrengthDbm: -54,
        signalQualityPercent: 99,
        payloadWeightKg: 1.2,
        maxPayloadKg: modelObj.maxPayloadKg,
        motorHealthPercent: 100,
        motorTempsCelsius: [32, 33, 32, 33],
        energyBurnRateWhPerKm: 14.5,
        energyRequiredToTargetWh: routeResult.distanceKm * 14.5,
        energyReserveMarginPercent: 82,
        rtbStatus: 'SUFFICIENT',
      },
      delivery: {
        missionId: `MSN-${droneId}-${Date.now().toString().slice(-4)}`,
        packageId: `PKG-MED-${Math.floor(1000 + Math.random() * 9000)}`,
        packageDescription: 'STAT Medical Diagnostic Specimen & Cold-Chain Payload',
        packageWeightKg: 1.2,
        priority: 'HIGH',
        pickupLocation: startLoc.name,
        destinationAddress: destName,
        recipientName: 'Duty Medical Officer / Receiving Hub',
        recipientPhone: '+91 94420 12345',
        recipientConfirmed: true,
        dispatchTime: new Date().toTimeString().split(' ')[0],
        estimatedArrivalTime: new Date(Date.now() + routeResult.estimatedMinutes * 60000).toTimeString().split(' ')[0],
        etaConfidencePercent: 98,
        etaConfidenceReason: 'Calculated via 8-Directional A* Obstacle Clearance Corridor',
        status: 'In Progress',
      },
    };

      onAddDrone(newDrone);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto font-sans select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0c121e] border border-[#223352] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#1c2942] bg-[#111928] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
              <QuadcopterIcon size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide font-mono flex items-center gap-2">
                <span>ADD DRONE TO FLEET</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 uppercase font-sans">
                  A* Autonomous Navigation
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Configure airframe specifications, departure pad, and destination corridor.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 font-mono text-xs custom-scrollbar">
          {/* Section 1: Drone Identity & Airframe Model */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Drone ID
              </label>
              <input
                type="text"
                value={droneId}
                onChange={(e) => setDroneId(e.target.value)}
                placeholder="e.g. DRONE-001"
                className="w-full bg-[#131b2c] border border-[#223250] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Callsign
              </label>
              <input
                type="text"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="e.g. DRONE 01"
                className="w-full bg-[#131b2c] border border-[#223250] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Initial Operational Status
              </label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as 'READY' | 'IDLE')}
                className="w-full bg-[#131b2c] border border-[#223250] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="READY">READY (Ready to Fly)</option>
                <option value="IDLE">IDLE (Standby on Pad)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
              Quadcopter Airframe Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-[#131b2c] border border-[#223250] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              {DRONE_MODELS.map((model) => (
                <option key={model.id} value={model.name}>
                  {model.name} — Payload: {model.maxPayloadKg}kg, Max Endurance: {model.enduranceMin}m
                </option>
              ))}
            </select>
          </div>

          {/* Section 2: Starting Location Selection */}
          <div className="p-3.5 rounded-lg bg-[#101726] border border-[#1e2a42]">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                1. Departure Starting Point
              </span>
            </div>
            <select
              value={startLocId}
              onChange={(e) => setStartLocId(e.target.value)}
              className="w-full bg-[#141d30] border border-[#253554] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-400 cursor-pointer"
            >
              {COIMBATORE_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} [{loc.coordinates[0].toFixed(4)}°, {loc.coordinates[1].toFixed(4)}°]
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
              <span>{startLoc.description}</span>
              <span className="text-emerald-400 font-bold shrink-0 ml-2">Base Elevation: {startLoc.altitudeMeters}m</span>
            </p>
          </div>

          {/* Section 3: Destination Selection (Preset or Interactive Map Click) */}
          <div className="p-3.5 rounded-lg bg-[#101726] border border-[#1e2a42]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                  2. Destination Selection
                </span>
              </div>
              {/* Mode Toggle: Preset vs Pick on Map */}
              <div className="flex items-center gap-1 bg-[#141c2c] p-0.5 rounded-lg border border-[#243452]">
                <button
                  type="button"
                  onClick={() => setDestMode('preset')}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                    destMode === 'preset'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Preset Dropdown
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDestMode('map');
                    onStartMapPickMode();
                  }}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
                    destMode === 'map'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MousePointerClick className="w-3 h-3 text-cyan-400" />
                  <span>Pick on 3D Map</span>
                </button>
              </div>
            </div>

            {destMode === 'preset' ? (
              <div>
                <select
                  value={presetDestId}
                  onChange={(e) => setPresetDestId(e.target.value)}
                  className="w-full bg-[#141d30] border border-[#253554] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  {COIMBATORE_LOCATIONS.filter((l) => l.id !== startLocId).map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} [{loc.coordinates[0].toFixed(4)}°, {loc.coordinates[1].toFixed(4)}°]
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Pre-cleared landing pad with high-precision RTK beacon and optical landing fiducial.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-[#141d30] border border-[#253554] rounded-lg p-2.5">
                  <div>
                    <div className="text-white font-bold">{customDestName}</div>
                    <div className="text-[10px] text-cyan-400 mt-0.5">
                      {customDestCoords
                        ? `Captured Coordinates: ${customDestCoords[0].toFixed(5)}° E, ${customDestCoords[1].toFixed(5)}° N`
                        : 'No map point clicked yet. Click on the 3D map to drop destination pin.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onStartMapPickMode}
                    className="px-3 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-600 text-cyan-300 font-bold text-[10px] flex items-center gap-1 transition-colors"
                  >
                    <MousePointerClick className="w-3.5 h-3.5" />
                    <span>{isMapPickingActive ? 'Clicking Map...' : 'Click to Pick Location'}</span>
                  </button>
                </div>
                {isMapPickingActive && (
                  <div className="p-2 rounded bg-amber-950/60 border border-amber-700/60 text-amber-300 text-[10px] flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Interactive Map Picking is active. Click anywhere within the Coimbatore simulation map to set destination.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3B: Altitude & Checkpoint Spacing Controls */}
          <div className="p-3.5 rounded-lg bg-[#0d1422] border border-[#1f2d48] space-y-2">
            <div className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Simulated Flight Altitude &amp; Waypoint Density Configuration</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="bg-[#141d30] border border-[#253554] rounded-lg p-2.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold mb-1.5">
                  <span className="text-slate-300">Flight Cruise Altitude</span>
                  <span className="text-cyan-400 font-extrabold">{cruiseAltitude} m AGL</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="120"
                  step="5"
                  value={cruiseAltitude}
                  onChange={(e) => setCruiseAltitude(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                  <span>Min: 40m AGL</span>
                  <span>DGCA Cap: 120m AGL (400ft)</span>
                </div>
              </div>

              <div className="bg-[#141d30] border border-[#253554] rounded-lg p-2.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold mb-1.5">
                  <span className="text-slate-300">Checkpoint Spacing</span>
                  <span className="text-emerald-400 font-extrabold">{checkpointSpacing} m</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="180"
                  step="10"
                  value={checkpointSpacing}
                  onChange={(e) => setCheckpointSpacing(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                  <span>Dense (60m)</span>
                  <span>Standard: 100m</span>
                  <span>Wide (180m)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: A* Multi-Route Alternatives & Verification */}
          <div className="p-4 rounded-lg bg-[#0d1422] border border-[#1f2d48]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1b263d]">
              <div className="flex items-center gap-2">
                <RouteIcon className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                  4. A* Multiple Route Candidates &amp; Clearance Preview
                </span>
              </div>
              <button
                type="button"
                onClick={computeRoute}
                disabled={isCalculating || isSubmitting}
                className="px-2.5 py-1 rounded bg-[#152033] hover:bg-[#1b2840] border border-cyan-500/40 text-cyan-300 text-[10px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isCalculating ? (
                  <>
                    <LoadingSpinner size="xs" color="text-cyan-400" />
                    <span>Computing Alternatives...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Recalculate Routes</span>
                  </>
                )}
              </button>
            </div>

            {isCalculating ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2.5 bg-[#090e18] border border-cyan-500/20 rounded-lg">
                <LoadingSpinner size="md" color="text-cyan-400" />
                <div className="text-xs font-mono text-cyan-300 font-bold tracking-wide">
                  Calculating 3D Obstacle Clearance Corridors...
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Evaluating DGCA airspace, building envelopes, and multi-candidate paths
                </div>
              </div>
            ) : multiRouteResult && multiRouteResult.success && multiRouteResult.allCandidates.length > 0 ? (
              <div className="space-y-3">
                <div className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">
                  Select Flight Corridor Strategy ({multiRouteResult.allCandidates.length} Valid Options Calculated)
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {multiRouteResult.allCandidates.map((cand: RouteCandidate) => {
                    const isSelected = cand.id === selectedCandidateId;
                    return (
                      <div
                        key={cand.id}
                        onClick={() => setSelectedCandidateId(cand.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#14233c] border-cyan-400 ring-2 ring-cyan-400/40 shadow-lg'
                            : 'bg-[#101828] border-[#1e2a40] hover:border-slate-500 hover:bg-[#131d30]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5 truncate">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cand.color }} />
                              <span className="truncate">{cand.name}</span>
                            </span>
                            {cand.isRecommended && (
                              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/60 shrink-0">
                                RECOMMENDED
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight mb-2">
                            {cand.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-800 text-[11px] font-mono grid grid-cols-3 gap-1 text-center">
                          <div className="bg-[#0b101c] p-1 rounded">
                            <div className="text-[8px] text-slate-500 uppercase">Distance</div>
                            <div className="font-bold text-white">{cand.distanceKm} km</div>
                          </div>
                          <div className="bg-[#0b101c] p-1 rounded">
                            <div className="text-[8px] text-slate-500 uppercase">Sim. Time</div>
                            <div className="font-bold text-cyan-300">~{cand.simulatedMinutes}m</div>
                          </div>
                          <div className="bg-[#0b101c] p-1 rounded">
                            <div className="text-[8px] text-slate-500 uppercase">Waypoints</div>
                            <div className="font-bold text-emerald-400">{cand.checkpointCount}</div>
                          </div>
                        </div>

                        <div className="mt-2 text-[9.5px] font-mono text-slate-300 flex items-center justify-between">
                          <span className="text-slate-400">Min Separation:</span>
                          <span className="font-bold text-emerald-400">+{cand.validation.minObstacleClearanceMeters}m</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recommendation explanation note */}
                <div className="p-2.5 rounded bg-[#0d1627] border border-cyan-900/60 text-xs font-mono text-cyan-200">
                  <span className="font-bold text-cyan-400 mr-1.5">SELECTION REASON:</span>
                  {multiRouteResult.allCandidates.find(c => c.id === selectedCandidateId)?.recommendationReason || multiRouteResult.primaryRoute?.recommendationReason}
                </div>

                {/* Simulation and Regulatory Disclaimer */}
                <div className="p-2.5 rounded bg-[#090e18] border border-slate-800 text-[10px] text-slate-400 font-mono space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Regulatory Framework: {OFFICIAL_REGULATORY_CONFIG.frameworkName} (Verified {OFFICIAL_REGULATORY_CONFIG.lastVerificationDate})</span>
                  </div>
                  <p className="text-slate-500 text-[9.5px] leading-relaxed">
                    Checkpoint spacing and simulated flight times are planning simulation settings. Mapped 3D building data and flight clearances do not constitute real-world autonomous flight authorization.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px] space-y-1">
                <div className="flex items-center gap-2 font-bold text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Route Generation Conflict</span>
                </div>
                <p className="text-[10px] text-rose-300 pl-6">
                  {routeResult?.error || 'Unable to calculate collision-free path. Ensure destination is outside restricted airspace and obstacles.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#1c2942] bg-[#111928] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#151c2c] hover:bg-[#1b253b] border border-[#243350] text-slate-300 font-mono font-bold text-xs transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmAdd}
            disabled={!routeResult || !routeResult.success || isCalculating || isSubmitting}
            className={`px-5 py-2 rounded-lg font-mono font-bold text-xs flex items-center gap-2 transition-all ${
              routeResult && routeResult.success && !isCalculating && !isSubmitting
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(0,240,255,0.4)] cursor-pointer'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="xs" color="text-slate-950" />
                <span>Deploying Aircraft...</span>
              </>
            ) : isCalculating ? (
              <>
                <LoadingSpinner size="xs" color="text-slate-400" />
                <span>Calculating Route...</span>
              </>
            ) : (
              <>
                <QuadcopterIcon size={16} />
                <span>+ Add Drone to Fleet</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
