import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Header } from './components/Header';
import { FleetSidebar } from './components/FleetSidebar';
import { MapWorkspace } from './components/MapWorkspace';
import { DronePOVCamera } from './components/DronePOVCamera';
import { BottomOverviewPanel } from './components/BottomOverviewPanel';
import { DroneDetailPanel } from './components/DroneDetailPanel';
import { RightSidebar } from './components/RightSidebar';
import { RouteReplanModal } from './components/RouteReplanModal';
import { MissionReplayModal } from './components/MissionReplayModal';
import { FleetView } from './components/FleetView';
import { MissionsView } from './components/MissionsView';
import { AirspaceView } from './components/AirspaceView';
import { AnalyticsView } from './components/AnalyticsView';
import { AboutModal } from './components/AboutModal';
import { SettingsModal } from './components/SettingsModal';
import { LiveCameraScreen } from './components/LiveCameraScreen';
import { CheckpointMissionPanel } from './components/CheckpointMissionPanel';
import { ApiContractModal } from './components/ApiContractModal';
import { Px4SitlStatusBanner } from './components/Px4SitlStatusBanner';
import { Px4SetupModal } from './components/Px4SetupModal';
import { apiService } from './services/api/index';
import type { Mission, MissionTelemetry } from './types/mission';
import { 
  INITIAL_DRONES, 
  INITIAL_GEOFENCES, 
  INITIAL_ALERTS, 
  INITIAL_FLIGHT_LOGS 
} from './data/mockFleet';
import { 
  Drone, 
  GeofenceZone, 
  AirspaceAlert, 
  FlightLogEntry, 
  AirspaceConflict,
  Waypoint 
} from './types/fleet';
import { 
  updateSimulationTick, 
  generateSmartReplan 
} from './services/telemetryEngine';

export function App() {
  // Navigation tab
  // Dedicated route detection for /live-camera
  const [activeTab, setActiveTab] = useState<'live' | 'camera' | 'fleet' | 'missions' | 'airspace' | 'analytics' | 'about'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/live-camera' || window.location.hash === '#/live-camera') {
        return 'camera';
      }
    }
    return 'live';
  });

  // Standalone Checkpoint Simulation Controller
  const missionController = apiService.getController();
  const [checkpointMission, setCheckpointMission] = useState<Mission | null>(() => missionController.getMission());
  const [checkpointTelemetry, setCheckpointTelemetry] = useState<MissionTelemetry | null>(() => missionController.getTelemetry());
  const [bottomTabMode, setBottomTabMode] = useState<'checkpoint' | 'detail' | 'logs'>('checkpoint');
  const [isApiContractOpen, setIsApiContractOpen] = useState<boolean>(false);
  const [isPx4SetupOpen, setIsPx4SetupOpen] = useState<boolean>(false);

  // Core state
  const [drones, setDrones] = useState<Drone[]>(INITIAL_DRONES);
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>('AV-01');
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [geofences, setGeofences] = useState<GeofenceZone[]>(INITIAL_GEOFENCES);
  const [alerts, setAlerts] = useState<AirspaceAlert[]>(INITIAL_ALERTS);
  const [flightLogs, setFlightLogs] = useState<FlightLogEntry[]>(INITIAL_FLIGHT_LOGS);
  const [conflicts, setConflicts] = useState<AirspaceConflict[]>([]);

  // Map view mode
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'pov'>('2d');

  // Sidebar filters
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Settings & Configuration
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [safetyReservePercent, setSafetyReservePercent] = useState<number>(20);
  const [separationDistanceMeters, setSeparationDistanceMeters] = useState<number>(250);

  // Modals & Panels
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState<boolean>(true);
  const [replanData, setReplanData] = useState<{
    drone: Drone;
    proposedRoute: Waypoint[];
    addedDistanceKm: number;
    addedDelayMinutes: number;
  } | null>(null);
  const [isReplayModalOpen, setIsReplayModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);

  // Synthetic Radar Beep using Web Audio API
  const playRadarBeep = (freq = 880) => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Ignore if user hasn't interacted with audio context yet
    }
  };

  // Deterministic Telemetry Simulation Engine
  useEffect(() => {
    const tickInterval = 1000 / simulationSpeed;
    const timer = setInterval(() => {
      setDrones((prevDrones) => {
        const deltaSeconds = 1;
        const res = updateSimulationTick(prevDrones, deltaSeconds, geofences);

        // Prepend new flight logs if emitted
        if (res.newLogs.length > 0) {
          setFlightLogs((prevLogs) => [...res.newLogs, ...prevLogs].slice(0, 50));
          playRadarBeep(640);
        }

        // Update airspace conflicts
        setConflicts(res.conflicts);
        if (res.conflicts.length > 0) {
          playRadarBeep(1200);
        }

        return res.updatedDrones;
      });
    }, tickInterval);

    return () => clearInterval(timer);
  }, [simulationSpeed, geofences, isMuted]);


  // URL sync for dedicated /live-camera route
  useEffect(() => {
    const handlePopState = () => {
      const isCam = window.location.pathname === '/live-camera' || window.location.hash === '#/live-camera';
      setActiveTab(isCam ? 'camera' : 'live');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Subscribe to standalone checkpoint mission controller & PX4 SITL adapter
  useEffect(() => {
    const unsubController = missionController.subscribe((m, t) => {
      if (apiService.getMode() !== 'px4') {
        setCheckpointMission({ ...m });
        setCheckpointTelemetry({ ...t });
      }
    });

    const px4 = apiService.getPx4Adapter();
    const unsubPx4Tel = px4.onTelemetry((t) => {
      if (apiService.getMode() === 'px4') {
        setCheckpointTelemetry({ ...t });
      }
    });

    const unsubPx4Conn = px4.onConnectionChange(() => {
      if (apiService.getMode() === 'px4') {
        px4.getMissionStatus('px4-current').then((m) => {
          setCheckpointMission({ ...m });
        });
      }
    });

    return () => {
      unsubController();
      unsubPx4Tel();
      unsubPx4Conn();
    };
  }, [missionController]);


  // Selected drone helper
  const selectedDrone = drones.find((d) => d.id === selectedDroneId) || drones[0];

  // Handler: Select Drone
  const handleSelectDrone = (id: string) => {
    setSelectedDroneId(id);
    setIsDetailPanelOpen(true);
    setSelectedWaypointId(null);
    playRadarBeep(980);
  };

  // Handler: Pause / Resume Mission
  const handlePauseResume = (droneId: string) => {
    setDrones((prev) =>
      prev.map((d) => {
        if (d.id === droneId) {
          const nextPaused = !d.isPaused;
          const timeStr = new Date().toTimeString().split(' ')[0];
          setFlightLogs((logs) => [
            {
              id: `log-pause-${Date.now()}`,
              timestamp: timeStr,
              droneId: d.id,
              droneCallsign: d.callsign,
              event: nextPaused ? 'COMMAND: Auto-hover held; Mission paused by operator' : 'COMMAND: Mission resumed along assigned corridor',
              type: nextPaused ? 'warning' : 'info',
            },
            ...logs,
          ]);
          return { ...d, isPaused: nextPaused };
        }
        return d;
      })
    );
  };

  // Handler: Trigger Smart Route Replanning
  const handleTriggerReplan = (droneId: string) => {
    const targetDrone = drones.find((d) => d.id === droneId);
    if (!targetDrone) return;

    const restrictedZone = geofences.find((g) => g.type === 'restricted');
    const polygon = restrictedZone ? restrictedZone.coordinates : [];
    const replan = generateSmartReplan(targetDrone, polygon);

    setReplanData({
      drone: targetDrone,
      proposedRoute: replan.proposedRoute,
      addedDistanceKm: replan.addedDistanceKm,
      addedDelayMinutes: replan.addedDelayMinutes,
    });
  };

  // Handler: Accept Proposed Replan
  const handleAcceptReplan = () => {
    if (!replanData) return;

    setDrones((prev) =>
      prev.map((d) => {
        if (d.id === replanData.drone.id) {
          const timeStr = new Date().toTimeString().split(' ')[0];
          setFlightLogs((logs) => [
            {
              id: `log-replan-${Date.now()}`,
              timestamp: timeStr,
              droneId: d.id,
              droneCallsign: d.callsign,
              event: `SMART REPLAN: West clearance detour approved (+${replanData.addedDistanceKm} km, +${replanData.addedDelayMinutes} min)`,
              type: 'success',
            },
            ...logs,
          ]);

          return {
            ...d,
            route: replanData.proposedRoute,
            originalRoute: d.route,
            currentWaypointIndex: 0,
            status: 'delivering',
            isPaused: false,
          };
        }
        return d;
      })
    );

    setReplanData(null);
  };

  // Handler: Return to Base (RTB)
  const handleTriggerRTB = (droneId: string) => {
    setDrones((prev) =>
      prev.map((d) => {
        if (d.id === droneId) {
          const baseWaypoint: Waypoint = {
            id: `rtb-wp-${Date.now()}`,
            name: 'Hub Alpha Emergency RTB Dock',
            lat: -37.8155,
            lng: 145.1220,
            altitudeMeters: 0,
            type: 'base',
            status: 'upcoming',
            etaMinutes: 4,
          };

          const timeStr = new Date().toTimeString().split(' ')[0];
          setFlightLogs((logs) => [
            {
              id: `log-rtb-${Date.now()}`,
              timestamp: timeStr,
              droneId: d.id,
              droneCallsign: d.callsign,
              event: `COMMAND: Immediate Return-to-Base (RTB) commanded; Aborting current delivery drop`,
              type: 'warning',
            },
            ...logs,
          ]);

          return {
            ...d,
            status: 'returning_to_base',
            statusLabel: 'Returning to Base',
            route: [
              {
                id: `rtb-cur-${Date.now()}`,
                name: `Aborted Point (${d.callsign})`,
                lat: d.vitals.latitude,
                lng: d.vitals.longitude,
                altitudeMeters: d.vitals.altitudeMeters,
                type: 'transit',
                status: 'completed',
              },
              baseWaypoint,
            ],
            currentWaypointIndex: 0,
            isPaused: false,
          };
        }
        return d;
      })
    );
  };

  // Handler: Mark Delivery Complete
  const handleMarkComplete = (droneId: string) => {
    setDrones((prev) =>
      prev.map((d) => {
        if (d.id === droneId) {
          // Trigger confetti pulse
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.8 },
            colors: ['#00f0ff', '#10b981', '#ffffff'],
          });

          const timeStr = new Date().toTimeString().split(' ')[0];
          setFlightLogs((logs) => [
            {
              id: `log-complete-${Date.now()}`,
              timestamp: timeStr,
              droneId: d.id,
              droneCallsign: d.callsign,
              event: `DELIVERY VERIFIED: Optical package tether release confirmed by recipient PIN`,
              type: 'success',
            },
            ...logs,
          ]);

          return {
            ...d,
            status: 'returning_to_base',
            statusLabel: 'Returning to Base',
            delivery: d.delivery ? { ...d.delivery, status: 'Delivered' } : undefined,
          };
        }
        return d;
      })
    );
  };

  // Handler: Acknowledge All Alerts
  const handleAcknowledgeAllAlerts = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
  };

  // Handler: Acknowledge Single Alert
  const handleAcknowledgeAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#080b12] text-slate-100 overflow-hidden select-none font-sans">
      {/* Top Navigation Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'about') {
            setIsAboutModalOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        alerts={alerts}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenReplay={() => setIsReplayModalOpen(true)}
        onOpenApiContract={() => setIsApiContractOpen(true)}
      />

      {/* PX4 SITL & Gazebo Autopilot Integration Status Banner */}
      <Px4SitlStatusBanner onOpenSetupGuide={() => setIsPx4SetupOpen(true)}
      />

      {/* Main Command Workspace */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* TAB 1: LIVE OPERATIONS (Matches reference layout: Fleet Sidebar + Central Map + Detail / Overview + Right Alerts) */}
        {activeTab === 'live' && (
          <div className="flex-1 flex w-full h-full overflow-hidden">
            {/* Left Sidebar: Fleet Monitor */}
            <FleetSidebar
              drones={drones}
              selectedDroneId={selectedDroneId}
              onSelectDrone={handleSelectDrone}
              filter={filter}
              setFilter={setFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              activeAlertsCount={alerts.filter((a) => !a.acknowledged).length}
            />

            {/* Central Workspace: Map / POV + Bottom Panels */}
            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
              {/* Primary Viewport: Geospatial Map or Synthetic POV Camera */}
              <div className="flex-1 relative w-full h-full min-h-0">
                {viewMode === 'pov' && selectedDrone ? (
                  <DronePOVCamera
                    drone={selectedDrone}
                    onExit={() => setViewMode('2d')}
                  />
                ) : (
                  <MapWorkspace
                    drones={drones}
                    selectedDroneId={selectedDroneId}
                    onSelectDrone={handleSelectDrone}
                    geofences={geofences}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    proposedRoute={replanData ? replanData.proposedRoute : null}
                    selectedWaypointId={selectedWaypointId}
                    onSelectWaypoint={(wpId) => setSelectedWaypointId(wpId)}
                    checkpointMission={checkpointMission}
                    checkpointTelemetry={checkpointTelemetry}
                  />
                )}
              </div>

              {/* Bottom Multi-Panel Container */}
              <div className="flex flex-col shrink-0 border-t border-[#1e2a40] bg-[#0c101a]">
                {/* Panel Selector Strip */}
                <div className="flex items-center justify-between px-3 py-1 bg-[#090d17] border-b border-[#1b2538] text-xs">
                  <div className="flex items-center gap-1 font-sans">
                    <button
                      onClick={() => setBottomTabMode('checkpoint')}
                      className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                        bottomTabMode === 'checkpoint'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span>Checkpoint Showcase</span>
                    </button>

                    <button
                      onClick={() => setBottomTabMode('detail')}
                      className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        bottomTabMode === 'detail'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <span>Drone Vitals</span>
                    </button>

                    <button
                      onClick={() => setBottomTabMode('logs')}
                      className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        bottomTabMode === 'logs'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <span>Flight Logs</span>
                    </button>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-500">
                    <span>Active Telemetry: {checkpointTelemetry?.groundSpeedKmh || 0} km/h</span>
                    <span>•</span>
                    <span>Alt: {Math.round(checkpointTelemetry?.altitudeMeters || 0)}m</span>
                  </div>
                </div>

                {/* Selected Panel Content */}
                {bottomTabMode === 'checkpoint' && (
                  <CheckpointMissionPanel
                    onOpenApiContract={() => setIsApiContractOpen(true)}
                    onOpenPx4Setup={() => setIsPx4SetupOpen(true)}
                  />
                )}

                {bottomTabMode === 'detail' && selectedDrone && (
                  <DroneDetailPanel
                    drone={selectedDrone}
                    onClose={() => setBottomTabMode('checkpoint')}
                    onPauseResume={handlePauseResume}
                    onTriggerReplan={handleTriggerReplan}
                    onTriggerRTB={handleTriggerRTB}
                    onMarkComplete={handleMarkComplete}
                    onSwitchToPOV={() => setViewMode('pov')}
                    onSelectWaypoint={(wpId) => setSelectedWaypointId(wpId)}
                    selectedWaypointId={selectedWaypointId}
                  />
                )}

                {bottomTabMode === 'logs' && (
                  <BottomOverviewPanel
                    drones={drones}
                    flightLogs={flightLogs}
                    onSelectDrone={handleSelectDrone}
                  />
                )}
              </div>
            </div>

            {/* Right Sidebar: Alerts, Airspace Conflict Radar & Mission Status */}
            <RightSidebar
              alerts={alerts}
              conflicts={conflicts}
              onAcknowledgeAll={handleAcknowledgeAllAlerts}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onSelectDrone={handleSelectDrone}
            />
          </div>
        )}

        {/* TAB 2: FLEET DIRECTORY */}
        {activeTab === 'fleet' && (
          <FleetView
            drones={drones}
            onSelectDroneAndSwitchToLive={(id) => {
              handleSelectDrone(id);
              setActiveTab('live');
            }}
          />
        )}

        {/* TAB 3: MISSIONS MANIFESTS */}
        {activeTab === 'missions' && (
          <MissionsView
            drones={drones}
            onSelectDroneAndSwitchToLive={(id) => {
              handleSelectDrone(id);
              setActiveTab('live');
            }}
          />
        )}

        {/* TAB 4: AIRSPACE & UTM COMPLIANCE */}
        {activeTab === 'airspace' && (
          <AirspaceView
            geofences={geofences}
            conflicts={conflicts}
            onSwitchToLive={() => {
              setViewMode('3d');
              setActiveTab('live');
            }}
          />
        )}

        {/* TAB 5: ANALYTICS & ENERGY EFFICIENCY */}
        {activeTab === 'analytics' && <AnalyticsView />}

        {/* TAB 6: DEDICATED LIVE CAMERA SCREEN ROUTE (/live-camera) */}
        {activeTab === 'camera' && (
          <LiveCameraScreen
            onBackToMap={() => {
              setActiveTab('live');
              window.history.pushState({}, '', '/');
            }}
          />
        )}
      </main>

      {/* MODAL 1: Smart Route Replanning Modal */}
      {replanData && (
        <RouteReplanModal
          drone={replanData.drone}
          proposedRoute={replanData.proposedRoute}
          addedDistanceKm={replanData.addedDistanceKm}
          addedDelayMinutes={replanData.addedDelayMinutes}
          onAccept={handleAcceptReplan}
          onReject={() => setReplanData(null)}
        />
      )}

      {/* MODAL 2: Mission Flight Replay Modal */}
      {isReplayModalOpen && selectedDrone && (
        <MissionReplayModal
          drone={selectedDrone}
          onClose={() => setIsReplayModalOpen(false)}
        />
      )}

      {/* MODAL 3: Command Center Settings Modal */}
      {isSettingsModalOpen && (
        <SettingsModal
          onClose={() => setIsSettingsModalOpen(false)}
          simulationSpeed={simulationSpeed}
          setSimulationSpeed={setSimulationSpeed}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          safetyReservePercent={safetyReservePercent}
          setSafetyReservePercent={setSafetyReservePercent}
          separationDistanceMeters={separationDistanceMeters}
          setSeparationDistanceMeters={setSeparationDistanceMeters}
        />
      )}

      {/* MODAL 4: About Aerovata by Taspora System Modal */}
      {isAboutModalOpen && (
        <AboutModal onClose={() => setIsAboutModalOpen(false)} />
      )}

      {/* MODAL 5: REST API Contract Specification Modal */}
      {isApiContractOpen && (
        <ApiContractModal onClose={() => setIsApiContractOpen(false)} />
      )}

      {/* MODAL 6: PX4 SITL & Gazebo Setup Guide Modal */}
      {isPx4SetupOpen && (
        <Px4SetupModal onClose={() => setIsPx4SetupOpen(false)} />
      )}
    </div>
  );
}

export default App;
