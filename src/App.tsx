import React, { useState, useEffect } from 'react';
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
import { NotificationPanel } from './components/NotificationPanel';
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
import { BottomMissionBar } from './components/BottomMissionBar';
import { AddDroneModal } from './components/AddDroneModal';
import { apiService } from './services/api/index';
import type { Mission, MissionTelemetry } from './types/mission';
import { Navigation, X } from 'lucide-react';
import { 
  INITIAL_DRONES, 
  INITIAL_GEOFENCES, 
  INITIAL_ALERTS, 
  INITIAL_FLIGHT_LOGS,
  COIMBATORE_OBSTACLES,
  INITIAL_NOTIFICATIONS
} from './data/mockFleet';
import { 
  Drone, 
  DroneStatus,
  GeofenceZone, 
  AirspaceAlert, 
  FlightLogEntry, 
  AirspaceConflict,
  Waypoint,
  Obstacle,
  ObstacleConflict,
  NotificationItem,
  OfficialAirspaceZone,
  RouteComparisonParameter
} from './types/fleet';
import { 
  updateSimulationTick, 
  generateSmartReplan 
} from './services/telemetryEngine';
import { OFFICIAL_COIMBATORE_AIRSPACE_ZONES } from './data/officialAirspaceData';

export function App() {
  // Navigation tab
  // Navigation tab with /live-camera URL route detection
  const [activeTab, setActiveTab] = useState<'live' | 'fleet' | 'missions' | 'airspace' | 'analytics' | 'camera' | 'about'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/live-camera' || window.location.hash === '#/live-camera') {
        return 'camera';
      }
    }
    return 'live';
  });

  // Standalone Checkpoint Simulation Controller & PX4 SITL Gateway
  const missionController = apiService.getController();
  const [checkpointMission, setCheckpointMission] = useState<Mission | null>(() => missionController.getMission());
  const [checkpointTelemetry, setCheckpointTelemetry] = useState<MissionTelemetry | null>(() => missionController.getTelemetry());
  const [bottomTabMode, setBottomTabMode] = useState<'detail' | 'checkpoint' | 'logs'>('detail');
  const [isApiContractOpen, setIsApiContractOpen] = useState<boolean>(false);
  const [isPx4SetupOpen, setIsPx4SetupOpen] = useState<boolean>(false);

  // Map-First 3D Command Center Layout & Drawer States
  const [isLeftFleetOpen, setIsLeftFleetOpen] = useState<boolean>(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState<boolean>(false);
  const [rightDrawerTab, setRightDrawerTab] = useState<'alerts' | 'airspace' | 'radar' | 'missions' | 'system'>('alerts');
  const [bottomDrawerTab, setBottomDrawerTab] = useState<'none' | 'route' | 'checkpoints' | 'logs'>('none');
  const [isBottomBarHidden, setIsBottomBarHidden] = useState<boolean>(false);
  const [autoFollow, setAutoFollow] = useState<boolean>(false);

  // Core Simulation & Fleet state (Zero drones on initial startup - Requirement 2)
  const [drones, setDrones] = useState<Drone[]>([]);
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);
  const [isAddDroneModalOpen, setIsAddDroneModalOpen] = useState<boolean>(false);
  const [isMapPickingDestination, setIsMapPickingDestination] = useState<boolean>(false);
  const [mapPickedDestination, setMapPickedDestination] = useState<[number, number] | null>(null);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [geofences, setGeofences] = useState<GeofenceZone[]>(INITIAL_GEOFENCES);
  const [officialAirspaceZones, setOfficialAirspaceZones] = useState<OfficialAirspaceZone[]>(OFFICIAL_COIMBATORE_AIRSPACE_ZONES);
  const [obstacles, setObstacles] = useState<Obstacle[]>(COIMBATORE_OBSTACLES);
  const [alerts, setAlerts] = useState<AirspaceAlert[]>(INITIAL_ALERTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [flightLogs, setFlightLogs] = useState<FlightLogEntry[]>(INITIAL_FLIGHT_LOGS);
  const [conflicts, setConflicts] = useState<AirspaceConflict[]>([]);
  const [obstacleConflicts, setObstacleConflicts] = useState<ObstacleConflict[]>([]);

  // Map view mode (2D / 3D / POV Cockpit)
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'pov'>('3d');

  // Sidebar filters
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Simulation controls (Req 8.C)
  const [isSimRunning, setIsSimRunning] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [safetyReservePercent, setSafetyReservePercent] = useState<number>(20);
  const [separationDistanceMeters, setSeparationDistanceMeters] = useState<number>(250);
  const [obstacleWarningRadiusMeters, setObstacleWarningRadiusMeters] = useState<number>(40);

  // Modals & Panels
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState<boolean>(true);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState<boolean>(false);
  const [replanData, setReplanData] = useState<{
    drone: Drone;
    proposedRoute: Waypoint[];
    addedDistanceKm: number;
    addedDelayMinutes: number;
    originalDistanceKm?: number;
    alternativeDistanceKm?: number;
    comparisonTable?: RouteComparisonParameter[];
  } | null>(null);
  const [isReplayModalOpen, setIsReplayModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);

  // URL sync for /live-camera route
  useEffect(() => {
    const handlePopState = () => {
      const isCam = window.location.pathname === '/live-camera' || window.location.hash === '#/live-camera';
      setActiveTab(isCam ? 'camera' : 'live');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Automatic MapLibre GL canvas resize trigger when drawers expand/collapse
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((window as any).__map) {
        (window as any).__map.resize();
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [isLeftFleetOpen, isRightDrawerOpen, bottomDrawerTab, isBottomBarHidden]);

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

        // Priority 2: Directly drive the vehicle from genuine PX4 SITL MAVLink telemetry
        setDrones((prevDrones: Drone[]): Drone[] => {
          const targetId = t.droneId || 'AV-01';
          return prevDrones.map((d): Drone => {
            if (d.id === targetId) {
              return {
                ...d,
                vitals: {
                  ...d.vitals,
                  latitude: t.lat,
                  longitude: t.lng,
                  altitudeMeters: t.altitudeMeters,
                  headingDegrees: t.headingDegrees,
                  groundSpeedKmh: t.groundSpeedKmh,
                  verticalSpeedMs: t.verticalSpeedMs || 0,
                  batteryPercentage: t.batteryPercentage,
                  batteryVoltage: t.batteryVoltage || 24.8,
                  satellites: t.satellites || 18,
                  gpsFix: (t.rtkFix || 'RTK_FIX') as 'RTK_FIX' | '3D_FIX' | 'DGPS' | 'SEARCHING',
                },
                status: (t.missionStatus === 'running' ? 'en_route_pickup' : t.missionStatus === 'paused' ? 'hovering' : 'active') as DroneStatus,
              };
            }
            return d;
          });
        });
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

  // Master Telemetry & Multi-Drone Simulation Engine (Runs continuously, NO AUDIO)
  useEffect(() => {
    if (!isSimRunning) return;

    const tickInterval = 1000 / simulationSpeed;
    const timer = setInterval(() => {
      setDrones((prevDrones) => {
        const deltaSeconds = 1;
        const isPx4Live = apiService.getMode() === 'px4' && apiService.getPx4Adapter().isAutopilotConnected();
        const px4ControlledIds = isPx4Live ? new Set(['AV-01']) : undefined;
        const res = updateSimulationTick(prevDrones, deltaSeconds, geofences, obstacles, officialAirspaceZones, px4ControlledIds);

        // Prepend new flight logs if emitted
        if (res.newLogs.length > 0) {
          setFlightLogs((prevLogs) => [...res.newLogs, ...prevLogs].slice(0, 50));
        }

        // Update airspace conflicts & 3D obstacle conflicts
        setConflicts(res.conflicts);
        setObstacleConflicts(res.obstacleConflicts);

        // Prepend new notifications if emitted (Req 3)
        if (res.newNotifications.length > 0) {
          setNotifications((prevNotifs) => {
            // Avoid duplicate notifications within 10 seconds
            const filteredNew = res.newNotifications.filter(
              (n) => !prevNotifs.some((p) => p.title === n.title && Math.abs(Date.now() - parseInt(p.id.split('-').pop() || '0')) < 10000)
            );
            return [...filteredNew, ...prevNotifs].slice(0, 100);
          });
        }

        return res.updatedDrones;
      });
    }, tickInterval);

    return () => clearInterval(timer);
  }, [isSimRunning, simulationSpeed, geofences, obstacles, officialAirspaceZones]);

  // Selected drone helper (safely handles zero drones on startup)
  const selectedDrone = drones.find((d) => d.id === selectedDroneId) || drones[0] || null;
  const selectedDroneConflict = selectedDrone ? (obstacleConflicts.find((c) => c.droneId === selectedDrone.id) || null) : null;

  // Handler: Select Drone
  const handleSelectDrone = (id: string) => {
    setSelectedDroneId(id);
    setIsDetailPanelOpen(true);
    setSelectedWaypointId(null);
  };

  // Handler: Add Drone to Fleet (Dynamic Fleet Management - Requirement 2 & 3)
  const handleAddDrone = (newDrone: Drone) => {
    setDrones((prev) => [...prev, newDrone]);
    setSelectedDroneId(newDrone.id);
    setMapPickedDestination(null);
    setIsMapPickingDestination(false);
    const timeStr = new Date().toTimeString().split(' ')[0];
    setFlightLogs((logs) => [
      {
        id: `log-add-${Date.now()}`,
        timestamp: timeStr,
        droneId: newDrone.id,
        droneCallsign: newDrone.callsign,
        event: `COMMISSIONED: ${newDrone.callsign} (${newDrone.model}) added to fleet. A* corridor locked from ${newDrone.missionStartLocation} to ${newDrone.missionDestinationName} (${newDrone.distanceRemainingKm} km).`,
        type: 'info',
      },
      ...logs,
    ]);
  };

  // Handler: Remove Drone from Fleet with Cleanup (Requirement 2)
  const handleRemoveDrone = (droneId: string) => {
    const target = drones.find((d) => d.id === droneId);
    setDrones((prev) => prev.filter((d) => d.id !== droneId));
    if (selectedDroneId === droneId) {
      const remaining = drones.filter((d) => d.id !== droneId);
      setSelectedDroneId(remaining.length > 0 ? remaining[0].id : null);
    }
    if (target) {
      const timeStr = new Date().toTimeString().split(' ')[0];
      setFlightLogs((logs) => [
        {
          id: `log-rm-${Date.now()}`,
          timestamp: timeStr,
          droneId: target.id,
          droneCallsign: target.callsign,
          event: `DECOMMISSIONED: ${target.callsign} (${target.id}) removed from fleet. Airframe markers, corridor, and telemetry cleared.`,
          type: 'warning',
        },
        ...logs,
      ]);
    }
  };

  // Handler: Map Click Destination Capture (Requirement 3)
  const handleMapPickDestination = (coords: [number, number]) => {
    setMapPickedDestination(coords);
    setIsAddDroneModalOpen(true);
    setIsMapPickingDestination(false);
  };

  // Handler: Pause / Resume Mission for individual drone
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

  // Handler: Reset Simulation (Resets active drones to departure pad)
  const handleResetSimulation = () => {
    setDrones((prev) =>
      prev.map((d) => {
        const startCoords = d.missionStartCoords || (d.route[0] ? [d.route[0].lng, d.route[0].lat] : [76.9665, 11.0025]);
        return {
          ...d,
          currentWaypointIndex: 0,
          status: 'active',
          statusLabel: 'Ready for Autonomous Transit',
          isPaused: false,
          routeStatus: 'ON_COURSE',
          flightTrail: [startCoords as [number, number]],
          vitals: {
            ...d.vitals,
            latitude: startCoords[1],
            longitude: startCoords[0],
            altitudeMeters: 0,
            groundSpeedKmh: 0,
            headingDegrees: 0,
            batteryPercentage: 100,
          },
          route: d.route.map((wp, idx) => ({
            ...wp,
            status: idx === 0 ? 'completed' : 'upcoming',
          })),
        };
      })
    );
    setFlightLogs((logs) => [
      {
        id: `log-reset-${Date.now()}`,
        timestamp: new Date().toTimeString().split(' ')[0],
        droneId: 'FLEET',
        droneCallsign: 'FLEET',
        event: 'SIMULATION RESET: All active aircraft repositioned at departure pads. Waypoints reset to 0.',
        type: 'info',
      },
      ...logs,
    ]);
    setConflicts([]);
    setObstacleConflicts([]);
    setSelectedWaypointId(null);
  };

  // Handler: Trigger Smart Route Replanning
  const handleTriggerReplan = (droneId: string) => {
    const targetDrone = drones.find((d) => d.id === droneId);
    if (!targetDrone) return;

    const replan = generateSmartReplan(targetDrone, obstacles, officialAirspaceZones, drones);

    setReplanData({
      drone: targetDrone,
      proposedRoute: replan.proposedRoute,
      addedDistanceKm: replan.addedDistanceKm,
      addedDelayMinutes: replan.addedDelayMinutes,
      originalDistanceKm: replan.originalDistanceKm,
      alternativeDistanceKm: replan.alternativeDistanceKm,
      comparisonTable: replan.comparisonTable,
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
              event: `SMART REPLAN: Peelamedu clearance detour approved (+${replanData.addedDistanceKm} km, +${replanData.addedDelayMinutes} min)`,
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
            routeStatus: 'A_STAR_REROUTED',
            isRerouting: true,
            isPaused: false,
          };
        }
        return d;
      })
    );

    setReplanData(null);
  };

  // Handler: Select Route Alternative Candidate (Requirement 4 & 5)
  const handleSelectCandidateRoute = (droneId: string, candidateId: string) => {
    setDrones((prev) =>
      prev.map((d) => {
        if (d.id !== droneId || !d.routeCandidates) return d;
        const cand = d.routeCandidates.find((c) => c.id === candidateId);
        if (!cand) return d;

        const timeStr = new Date().toTimeString().split(' ')[0];
        setFlightLogs((logs) => [
          {
            id: `log-cand-${Date.now()}`,
            timestamp: timeStr,
            droneId: d.id,
            droneCallsign: d.callsign,
            event: `TRAJECTORY SWITCH: Active route switched to '${cand.name}' (${cand.distanceKm} km, ${cand.checkpointCount} CPs)`,
            type: 'info',
          },
          ...logs,
        ]);

        return {
          ...d,
          selectedCandidateId: cand.id,
          route: cand.waypoints,
          currentWaypointIndex: 0,
          totalFlightDistanceKm: cand.distanceKm,
          estimatedFlightMinutes: cand.simulatedMinutes,
        };
      })
    );
  };

  // Handler: Return to Base (RTB)
  const handleTriggerRTB = (droneId: string) => {
    setDrones((prev) =>
      prev.map((d) => {
        if (d.id === droneId) {
          const baseWaypoint: Waypoint = {
            id: `rtb-wp-${Date.now()}`,
            name: 'CMCH Hub Alpha Emergency RTB Dock',
            lat: 11.0025,
            lng: 76.9665,
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

  // Handlers: Notifications (Req 3)
  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleAcknowledgeNotification = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, acknowledged: true, read: true } : n))
    );
  };

  const handleAcknowledgeAllNotifications = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, acknowledged: true, read: true }))
    );
  };

  // Handlers: Operational Alerts
  const handleAcknowledgeAllAlerts = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
  };

  const handleAcknowledgeAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#080b12] text-slate-100 overflow-hidden select-none font-sans">
      {/* Top Navigation Bar (NO AUDIO BUTTON) */}
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
        notifications={notifications}
        isNotificationPanelOpen={isNotificationPanelOpen}
        setIsNotificationPanelOpen={setIsNotificationPanelOpen}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenReplay={() => setIsReplayModalOpen(true)}
        onOpenApiContract={() => setIsApiContractOpen(true)}
        onOpenPx4Setup={() => setIsPx4SetupOpen(true)}
      />

      {/* PX4 SITL & Gazebo Autopilot Integration Status Banner */}
      <Px4SitlStatusBanner onOpenSetupGuide={() => setIsPx4SetupOpen(true)} />

      {/* Main Command Center Workspace */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* TAB 1: LIVE OPERATIONS (Map-First 3D Drone Command Center Layout) */}
        {activeTab === 'live' && (
          <div className="flex-1 flex w-full h-full overflow-hidden relative min-h-0 min-w-0 bg-[#070a12]">
            {/* Column 1: Left Compact Sidebar & Slide-out Aircraft Drawer */}
            <FleetSidebar
              drones={drones}
              selectedDroneId={selectedDroneId}
              onSelectDrone={handleSelectDrone}
              filter={filter}
              setFilter={setFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              activeAlertsCount={alerts.filter((a) => !a.acknowledged).length}
              obstacleConflicts={obstacleConflicts}
              isExpanded={isLeftFleetOpen}
              onToggleExpand={setIsLeftFleetOpen}
              onOpenAddDrone={() => setIsAddDroneModalOpen(true)}
              onRemoveDrone={handleRemoveDrone}
            />

            {/* Column 2: Central Geospatial Workspace (Dominant Map Viewport: 85-88% of screen) */}
            <div className="flex-1 h-full flex flex-col relative overflow-hidden min-w-0 border-r border-[#1f2a40]">
              {/* Primary Map Viewport */}
              <div className="flex-1 relative w-full h-full min-h-0 overflow-hidden">
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
                    officialAirspaceZones={officialAirspaceZones}
                    obstacles={obstacles}
                    obstacleConflicts={obstacleConflicts}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    proposedRoute={replanData ? replanData.proposedRoute : null}
                    selectedWaypointId={selectedWaypointId}
                    onSelectWaypoint={(wpId) => setSelectedWaypointId(wpId)}
                    isSimRunning={isSimRunning}
                    onToggleSim={() => setIsSimRunning(!isSimRunning)}
                    simSpeed={simulationSpeed}
                    onChangeSimSpeed={setSimulationSpeed}
                    onResetSim={handleResetSimulation}
                    onImportAirspaceData={(imported) => setOfficialAirspaceZones(imported)}
                    checkpointMission={checkpointMission}
                    checkpointTelemetry={checkpointTelemetry}
                    isMapPickingDestination={isMapPickingDestination}
                    onMapPickDestination={handleMapPickDestination}
                    tempDestinationCoords={mapPickedDestination}
                  />
                )}

                {/* Floating Expandable Drawer (Route HUD, Checkpoints, Logs) */}
                {bottomDrawerTab !== 'none' && (
                  <div className="absolute bottom-[46px] left-3 right-3 max-h-[380px] bg-[#0c101a]/95 backdrop-blur-md border border-[#1f2a40] rounded-t-lg z-20 shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-200 overflow-hidden">
                    <div className="px-3 py-2 border-b border-[#1f2a40] bg-[#101522] flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="font-bold text-cyan-300 uppercase">
                          {bottomDrawerTab === 'route' && 'Aircraft Vitals & Route Intelligence HUD'}
                          {bottomDrawerTab === 'checkpoints' && 'Autonomous Checkpoint Mission Controller'}
                          {bottomDrawerTab === 'logs' && 'Live UTM Flight Logs & Battery Cells'}
                        </span>
                      </div>
                      <button
                        onClick={() => setBottomDrawerTab('none')}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 min-h-0">
                      {bottomDrawerTab === 'route' && selectedDrone && (
                        <DroneDetailPanel
                          drone={selectedDrone}
                          onClose={() => setBottomDrawerTab('none')}
                          onPauseResume={handlePauseResume}
                          onTriggerReplan={handleTriggerReplan}
                          onTriggerRTB={handleTriggerRTB}
                          onMarkComplete={handleMarkComplete}
                          onSwitchToPOV={() => setViewMode('pov')}
                          onSelectWaypoint={(wpId) => setSelectedWaypointId(wpId)}
                          selectedWaypointId={selectedWaypointId}
                          activeConflict={selectedDroneConflict}
                          onSelectCandidateRoute={handleSelectCandidateRoute}
                        />
                      )}

                      {bottomDrawerTab === 'checkpoints' && (
                        <CheckpointMissionPanel
                          onOpenApiContract={() => setIsApiContractOpen(true)}
                          onOpenPx4Setup={() => setIsPx4SetupOpen(true)}
                        />
                      )}

                      {bottomDrawerTab === 'logs' && (
                        <BottomOverviewPanel
                          drones={drones}
                          flightLogs={flightLogs}
                          onSelectDrone={handleSelectDrone}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Compact Bottom Mission Bar (~46px) */}
              <BottomMissionBar
                selectedDrone={selectedDrone}
                drones={drones}
                isSimRunning={isSimRunning}
                onToggleSim={() => setIsSimRunning(!isSimRunning)}
                simSpeed={simulationSpeed}
                onChangeSimSpeed={setSimulationSpeed}
                onResetSim={handleResetSimulation}
                onFocusDrone={() => {
                  if (selectedDrone && (window as any).__map) {
                    (window as any).__map.flyTo({
                      center: [selectedDrone.vitals.longitude, selectedDrone.vitals.latitude],
                      zoom: 15.4,
                      pitch: viewMode === '3d' ? 62 : 0,
                      bearing: viewMode === '3d' ? -25 : 0,
                      duration: 900,
                      essential: true,
                    });
                  }
                }}
                autoFollow={autoFollow}
                onToggleAutoFollow={() => setAutoFollow(!autoFollow)}
                onSelectDrone={handleSelectDrone}
                activeDrawer={bottomDrawerTab}
                onSetActiveDrawer={(tab) => setBottomDrawerTab(tab)}
                isFullyCollapsed={isBottomBarHidden}
                onToggleFullyCollapse={() => setIsBottomBarHidden(!isBottomBarHidden)}
                checkpointTelemetry={checkpointTelemetry}
              />
            </div>

            {/* Column 3: Right Compact Sidebar & Slide-out Tool Drawer */}
            <RightSidebar
              alerts={alerts}
              conflicts={conflicts}
              obstacleConflicts={obstacleConflicts}
              onAcknowledgeAll={handleAcknowledgeAllAlerts}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onSelectDrone={handleSelectDrone}
              officialAirspaceZones={officialAirspaceZones}
              isExpanded={isRightDrawerOpen}
              onToggleExpand={setIsRightDrawerOpen}
              activeTab={rightDrawerTab}
              onChangeTab={setRightDrawerTab}
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
            onOpenAddDrone={() => setIsAddDroneModalOpen(true)}
            onRemoveDrone={handleRemoveDrone}
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
            officialAirspaceZones={officialAirspaceZones}
            conflicts={conflicts}
            onImportAirspaceData={(imported) => setOfficialAirspaceZones(imported)}
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
            drones={drones}
            selectedDroneId={selectedDroneId}
            onSelectDrone={handleSelectDrone}
            onPauseResume={handlePauseResume}
            onTriggerRTB={handleTriggerRTB}
            onBackToMap={() => {
              setActiveTab('live');
              window.history.pushState({}, '', '/');
            }}
          />
        )}
      </main>

      {/* SLIDE-OVER: Operational Notifications Panel (Req 3) */}
      <NotificationPanel
        isOpen={isNotificationPanelOpen}
        onClose={() => setIsNotificationPanelOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onAcknowledge={handleAcknowledgeNotification}
        onAcknowledgeAll={handleAcknowledgeAllNotifications}
        onSelectDrone={handleSelectDrone}
      />

      {/* MODAL 1: Smart Route Replanning Modal */}
      {replanData && (
        <RouteReplanModal
          drone={replanData.drone}
          proposedRoute={replanData.proposedRoute}
          addedDistanceKm={replanData.addedDistanceKm}
          addedDelayMinutes={replanData.addedDelayMinutes}
          originalDistanceKm={replanData.originalDistanceKm}
          alternativeDistanceKm={replanData.alternativeDistanceKm}
          comparisonTable={replanData.comparisonTable}
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
          safetyReservePercent={safetyReservePercent}
          setSafetyReservePercent={setSafetyReservePercent}
          separationDistanceMeters={separationDistanceMeters}
          setSeparationDistanceMeters={setSeparationDistanceMeters}
          obstacleWarningRadiusMeters={obstacleWarningRadiusMeters}
          setObstacleWarningRadiusMeters={setObstacleWarningRadiusMeters}
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

      {/* MODAL 7: Dynamic Add Drone & A* Route Modal */}
      <AddDroneModal
        isOpen={isAddDroneModalOpen}
        onClose={() => {
          setIsAddDroneModalOpen(false);
          setIsMapPickingDestination(false);
        }}
        onAddDrone={handleAddDrone}
        existingDrones={drones}
        mapPickedCoords={mapPickedDestination}
        onStartMapPickMode={() => {
          setIsAddDroneModalOpen(false);
          setIsMapPickingDestination(true);
        }}
        isMapPickingActive={isMapPickingDestination}
      />
    </div>
  );
}

export default App;
