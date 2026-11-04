import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import { Layers, Compass, Plus, Minus, Eye, Box, Map as MapIcon, LocateFixed } from 'lucide-react';
import { Drone, GeofenceZone, Waypoint } from '../types/fleet.ts';
import type { Mission, MissionTelemetry, Checkpoint } from '../types/mission.ts';
import { AIRSPACE_CENTER } from '../data/mockFleet';

interface MapWorkspaceProps {
  drones: Drone[];
  selectedDroneId: string | null;
  onSelectDrone: (id: string) => void;
  geofences: GeofenceZone[];
  viewMode: '2d' | '3d' | 'pov';
  setViewMode: (mode: '2d' | '3d' | 'pov') => void;
  proposedRoute: Waypoint[] | null;
  selectedWaypointId: string | null;
  onSelectWaypoint: (wpId: string) => void;
  checkpointMission?: Mission | null;
  checkpointTelemetry?: MissionTelemetry | null;
  onSelectCheckpoint?: (checkpoint: Checkpoint) => void;
}

const STATUS_COLORS: Record<string, string> = {
  delivering: '#00f0ff',
  en_route_pickup: '#60a5fa',
  returning_to_base: '#34d399',
  charging: '#fbbf24',
  attention_required: '#f87171',
  standby: '#94a3b8',
  hovering: '#a78bfa',
};

const buildMarkerHtml = (drone: Drone, isSelected: boolean): string => {
  const color = STATUS_COLORS[drone.status] || '#94a3b8';
  const rot = drone.vitals.headingDegrees;
  const bat = drone.vitals.batteryPercentage;
  const batColor = bat > 60 ? '#34d399' : bat > 30 ? '#fbbf24' : '#f87171';
  const scale = isSelected ? 1.25 : 1;

  return `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      transform: scale(${scale});
      transition: transform 0.2s ease;
    ">
      ${isSelected ? `
        <div style="
          position: absolute;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: ${color}22;
          border: 1.5px solid ${color};
          animation: radar-pulse 2.2s cubic-bezier(0.2, 0.7, 0.3, 1) infinite;
          pointer-events: none;
          z-index: 0;
        "></div>
      ` : ''}
      <div style="
        position: relative;
        transform: rotate(${rot}deg);
        transition: transform 0.35s ease;
        filter: drop-shadow(0 0 6px ${color}88);
        z-index: 1;
      ">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Arm: NW -->
          <line x1="16" y1="16" x2="7" y2="7" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
          <!-- Arm: NE -->
          <line x1="16" y1="16" x2="25" y2="7" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
          <!-- Arm: SW -->
          <line x1="16" y1="16" x2="7" y2="25" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
          <!-- Arm: SE -->
          <line x1="16" y1="16" x2="25" y2="25" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
          <!-- Rotor NW -->
          <ellipse cx="7" cy="7" rx="4.5" ry="1.6" fill="${color}" fill-opacity="0.5" transform="rotate(-45 7 7)"/>
          <!-- Rotor NE -->
          <ellipse cx="25" cy="7" rx="4.5" ry="1.6" fill="${color}" fill-opacity="0.5" transform="rotate(45 25 7)"/>
          <!-- Rotor SW -->
          <ellipse cx="7" cy="25" rx="4.5" ry="1.6" fill="${color}" fill-opacity="0.5" transform="rotate(45 7 25)"/>
          <!-- Rotor SE -->
          <ellipse cx="25" cy="25" rx="4.5" ry="1.6" fill="${color}" fill-opacity="0.5" transform="rotate(-45 25 25)"/>
          <!-- Body -->
          <ellipse cx="16" cy="16" rx="4" ry="3" fill="${color}" fill-opacity="0.9"/>
          <circle cx="16" cy="16" r="1.5" fill="#ffffff" fill-opacity="0.95"/>
          <!-- Forward indicator -->
          <polygon points="16,7 17.5,11 14.5,11" fill="${color}" fill-opacity="0.85"/>
        </svg>
      </div>
      <div style="
        background: rgba(10,13,20,0.92);
        border: 1px solid ${isSelected ? color : '#1f2a3d'};
        border-radius: 4px;
        padding: 2px 7px;
        margin-top: 4px;
        display: flex;
        align-items: center;
        gap: 5px;
        backdrop-filter: blur(8px);
        pointer-events: none;
        z-index: 2;
        box-shadow: ${isSelected ? `0 0 10px ${color}55` : 'none'};
      ">
        <span style="color: ${color}; font-size: 10px; font-weight: 700; font-family: ui-monospace, monospace; letter-spacing: 0.05em;">
          ${drone.callsign}
        </span>
        <div style="width: 1px; height: 8px; background: #1f2a3d;"></div>
        <span style="color: ${batColor}; font-size: 10px; font-weight: 600; font-family: ui-monospace, monospace;">
          ${Math.round(bat)}%
        </span>
        <div style="width: 1px; height: 8px; background: #1f2a3d;"></div>
        <span style="color: #64748b; font-size: 10px; font-family: ui-monospace, monospace;">
          ${Math.round(drone.vitals.altitudeMeters)}m
        </span>
      </div>
    </div>
  `;
};

export const MapWorkspace: React.FC<MapWorkspaceProps> = ({
  drones,
  selectedDroneId,
  onSelectDrone,
  geofences,
  viewMode,
  setViewMode,
  proposedRoute,
  selectedWaypointId,
  onSelectWaypoint,
  checkpointMission,
  checkpointTelemetry,
  onSelectCheckpoint,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const waypointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const checkpointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const simDroneMarkerRef = useRef<maplibregl.Marker | null>(null);
  const mapLoadedRef = useRef(false);

  const [showFlightPaths, setShowFlightPaths] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showRestricted, setShowRestricted] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'dark'>('satellite');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const satelliteStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '',
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: 'satellite-tiles',
          type: 'raster',
          source: 'esri-satellite',
          paint: {
            'raster-opacity': 0.85,
            'raster-contrast': 0.1,
            'raster-brightness-min': 0.05,
          },
        },
      ],
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: satelliteStyle,
      center: AIRSPACE_CENTER,
      zoom: 14.5,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.on('load', () => {
      mapLoadedRef.current = true;
      initMapLayers(map);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
    };
  }, []);

  // Handle map style toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    if (map.getLayer('satellite-tiles')) {
      map.setPaintProperty('satellite-tiles', 'raster-opacity', mapStyle === 'satellite' ? 0.85 : 0.2);
      map.setPaintProperty('satellite-tiles', 'raster-contrast', mapStyle === 'satellite' ? 0.1 : -0.2);
    }
  }, [mapStyle]);

  // Handle 2D / 3D tilt toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (viewMode === '2d') {
      map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
    } else if (viewMode === '3d') {
      map.easeTo({ pitch: 55, bearing: -20, duration: 1000 });
    }
  }, [viewMode]);

  // Focus map on selected drone
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedDroneId) return;
    const drone = drones.find((d) => d.id === selectedDroneId);
    if (drone) {
      map.easeTo({
        center: [drone.vitals.longitude, drone.vitals.latitude],
        zoom: Math.max(map.getZoom(), 15),
        duration: 700,
      });
    }
  }, [selectedDroneId]);

  const initMapLayers = (map: maplibregl.Map) => {
    // ─── Restricted TFR Zone (Red Fill) ─────────────────────────
    const restrictedZone = geofences.find((g) => g.type === 'restricted');
    if (restrictedZone) {
      map.addSource('restricted-zone', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [restrictedZone.coordinates] },
        },
      });
      map.addLayer({
        id: 'restricted-zone-fill',
        type: 'fill',
        source: 'restricted-zone',
        paint: { 'fill-color': '#dc2626', 'fill-opacity': 0.28 },
      });
      map.addLayer({
        id: 'restricted-zone-outline',
        type: 'line',
        source: 'restricted-zone',
        paint: { 'line-color': '#ef4444', 'line-width': 2, 'line-dasharray': [3, 1.5] },
      });
    }

    // ─── Caution Zone (Amber) ────────────────────────────────────
    const cautionZone = geofences.find((g) => g.type === 'caution');
    if (cautionZone) {
      map.addSource('caution-zone', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [cautionZone.coordinates] },
        },
      });
      map.addLayer({
        id: 'caution-zone-fill',
        type: 'fill',
        source: 'caution-zone',
        paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.14 },
      });
      map.addLayer({
        id: 'caution-zone-outline',
        type: 'line',
        source: 'caution-zone',
        paint: { 'line-color': '#fbbf24', 'line-width': 1.6 },
      });
    }

    // ─── BVLOS Boundary (Blue Dashes) ───────────────────────────
    const bvlosBoundary = geofences.find((g) => g.type === 'boundary');
    if (bvlosBoundary) {
      map.addSource('bvlos-boundary', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [bvlosBoundary.coordinates] },
        },
      });
      map.addLayer({
        id: 'bvlos-boundary-outline',
        type: 'line',
        source: 'bvlos-boundary',
        paint: { 'line-color': '#38bdf8', 'line-width': 1.5, 'line-dasharray': [4, 3], 'line-opacity': 0.5 },
      });
    }

    // ─── Flight Paths (GeoJSON — updated in useEffect) ──────────
    map.addSource('flight-paths', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'flight-path-glow',
      type: 'line',
      source: 'flight-paths',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 8,
        'line-opacity': 0.25,
        'line-blur': 4,
      },
    });
    map.addLayer({
      id: 'flight-path-line',
      type: 'line',
      source: 'flight-paths',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['get', 'isSelected'], 2.5, 1.5],
        'line-opacity': ['case', ['get', 'isSelected'], 0.9, 0.5],
        'line-dasharray': [4, 2],
      },
    });

    // ─── Proposed Replan Route ───────────────────────────────────
    map.addSource('proposed-route', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'proposed-route-line',
      type: 'line',
      source: 'proposed-route',
      paint: { 'line-color': '#34d399', 'line-width': 3, 'line-dasharray': [2, 1], 'line-opacity': 0.9 },
    });

    // ─── Checkpoint Mission Corridor ───────────────────────────
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
      paint: {
        'line-color': '#00f0ff',
        'line-width': 2.5,
        'line-dasharray': [3, 2],
        'line-opacity': 0.95,
      },
    });
  };

  // Update flight path GeoJSON when drones change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const source = map.getSource('flight-paths') as maplibregl.GeoJSONSource;
    if (!source) return;

    const features = {
      type: 'FeatureCollection',
      features: drones.flatMap((drone) => {
        const isSelected = drone.id === selectedDroneId;
        const color = STATUS_COLORS[drone.status] || '#94a3b8';
        const upcomingWaypoints = drone.route.filter((w) => w.status === 'active' || w.status === 'upcoming');
        if (upcomingWaypoints.length < 1) return [];

        const coords = [
          [drone.vitals.longitude, drone.vitals.latitude],
          ...upcomingWaypoints.map((w) => [w.lng, w.lat]),
        ];

        return [
          {
            type: 'Feature' as const,
            properties: { droneId: drone.id, color, isSelected },
            geometry: { type: 'LineString', coordinates: coords },
          },
        ];
      }),
    };

    source.setData(features as any);
  }, [drones, selectedDroneId]);

  // Update proposed replan route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const source = map.getSource('proposed-route') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (proposedRoute && proposedRoute.length > 1) {
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
      } as any);
    } else {
      source.setData({ type: 'FeatureCollection', features: [] } as any);
    }
  }, [proposedRoute]);

  // Toggle layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const setLayerVisibility = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    };
    setLayerVisibility('flight-path-glow', showFlightPaths);
    setLayerVisibility('flight-path-line', showFlightPaths);
    setLayerVisibility('restricted-zone-fill', showRestricted);
    setLayerVisibility('restricted-zone-outline', showRestricted);
    setLayerVisibility('caution-zone-fill', showGeofences);
    setLayerVisibility('caution-zone-outline', showGeofences);
  }, [showFlightPaths, showGeofences, showRestricted]);

  // Render / update drone HTML markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    drones.forEach((drone) => {
      const isSelected = drone.id === selectedDroneId;
      let marker = markersRef.current[drone.id];

      if (!marker) {
        const el = document.createElement('div');
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectDrone(drone.id);
        });
        marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([drone.vitals.longitude, drone.vitals.latitude])
          .addTo(map);
        markersRef.current[drone.id] = marker;
      } else {
        marker.setLngLat([drone.vitals.longitude, drone.vitals.latitude]);
      }

      const el = marker.getElement();
      el.innerHTML = buildMarkerHtml(drone, isSelected);
    });
  }, [drones, selectedDroneId]);

  // Render / update waypoint markers for selected drone
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove all previous waypoint markers
    waypointMarkersRef.current.forEach((m) => m.remove());
    waypointMarkersRef.current = [];

    if (!showWaypoints) return;
    const selectedDrone = drones.find((d) => d.id === selectedDroneId);
    if (!selectedDrone) return;

    selectedDrone.route.forEach((wp) => {
      const isSelectedWp = wp.id === selectedWaypointId;
      const el = document.createElement('div');
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectWaypoint(wp.id);
      });

      let dotColor = '#94a3b8';
      let borderColor = '#1f2a3d';
      let labelBg = 'rgba(10,13,20,0.85)';

      if (wp.type === 'base') { dotColor = '#34d399'; borderColor = '#059669'; }
      else if (wp.type === 'delivery') { dotColor = '#00f0ff'; borderColor = '#0891b2'; }
      else if (wp.type === 'pickup') { dotColor = '#60a5fa'; borderColor = '#1d4ed8'; }
      else if (wp.type === 'handoff') { dotColor = '#c084fc'; borderColor = '#7c3aed'; }
      else if (wp.type === 'transit') { dotColor = '#475569'; borderColor = '#334155'; }

      if (wp.status === 'completed') { dotColor = '#334155'; borderColor = '#1e293b'; }

      el.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="
            width: ${isSelectedWp ? '16px' : '10px'};
            height: ${isSelectedWp ? '16px' : '10px'};
            border-radius: 50%;
            background: ${dotColor};
            border: 2px solid ${borderColor};
            box-shadow: 0 0 ${isSelectedWp ? '10px' : '5px'} ${dotColor}66;
            transition: all 0.2s;
          "></div>
          ${isSelectedWp ? `
            <div style="
              background: ${labelBg};
              border: 1px solid ${borderColor};
              border-radius: 3px;
              padding: 1px 5px;
              font-size: 9px;
              font-family: monospace;
              color: ${dotColor};
              margin-top: 2px;
              white-space: nowrap;
            ">${wp.name.split(' ').slice(0, 2).join(' ')}</div>
          ` : ''}
        </div>
      `;

      const m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map);
      waypointMarkersRef.current.push(m);
    });
  }, [drones, selectedDroneId, selectedWaypointId, showWaypoints]);

  // ─── Render Checkpoint Mission Corridor & Ordered Checkpoint Markers ─────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    checkpointMarkersRef.current.forEach((m) => m.remove());
    checkpointMarkersRef.current = [];

    const source = map.getSource('checkpoint-corridor') as maplibregl.GeoJSONSource;

    if (checkpointMission && checkpointMission.checkpoints.length > 0) {
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: checkpointMission.checkpoints.map((cp) => [cp.lng, cp.lat]),
              },
            },
          ],
        } as any);
      }

      checkpointMission.checkpoints.forEach((cp) => {
        const isActive = cp.status === 'active';
        const isReached = cp.status === 'reached';
        const isError = checkpointMission.status === 'error';

        const el = document.createElement('div');
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onSelectCheckpoint) onSelectCheckpoint(cp);
        });

        const badgeColor = isError ? '#f43f5e' : isActive ? '#00f0ff' : isReached ? '#10b981' : '#64748b';
        const bgBadge = isError ? '#881337' : isActive ? 'rgba(6,182,212,0.3)' : isReached ? 'rgba(16,185,129,0.3)' : 'rgba(30,41,59,0.9)';

        el.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 0 6px ${badgeColor}66);">
            ${isActive ? `
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
            ` : ''}
            <div style="
              width: ${isActive ? '26px' : '22px'};
              height: ${isActive ? '26px' : '22px'};
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
              box-shadow: 0 0 ${isActive ? '12px' : '6px'} ${badgeColor};
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

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([cp.lng, cp.lat])
          .addTo(map);

        checkpointMarkersRef.current.push(marker);
      });
    } else {
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] } as any);
      }
    }
  }, [checkpointMission, onSelectCheckpoint]);

  // ─── Render / Animate Simulation Drone Marker ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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

    if (!simDroneMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cursor = 'pointer';
      simDroneMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([checkpointTelemetry.lng, checkpointTelemetry.lat])
        .addTo(map);
    } else {
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
  }, [checkpointTelemetry, checkpointMission]);

  return (
    <div className="relative flex-1 w-full h-full overflow-hidden bg-[#080b12]">
      {/* MapLibre canvas container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Geofence zone labels (positioned over map visually) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Restricted Zone Label */}
        <div
          className="absolute"
          style={{ top: '26%', left: '56%', transform: 'translate(-50%, -50%)' }}
        >
          <div className="px-2 py-1 rounded border text-[10px] font-mono font-bold tracking-widest uppercase"
            style={{
              background: 'rgba(127,29,29,0.7)',
              borderColor: 'rgba(239,68,68,0.6)',
              color: '#fca5a5',
              boxShadow: '0 0 12px rgba(239,68,68,0.3)',
            }}>
            RESTRICTED ZONE
          </div>
        </div>
      </div>

      {/* ── TOP-RIGHT Map Controls ───────────────────────────────── */}
      <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
        {/* View Mode Toggle */}
        <div className="hud-glass rounded-md overflow-hidden flex">
          {(['2d', '3d', 'pov'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-2 text-xs font-mono font-bold uppercase transition-all ${
                viewMode === mode
                  ? 'bg-cyan-500/20 text-cyan-400 border-b border-cyan-500'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {mode === 'pov' ? <Eye className="w-3.5 h-3.5" /> : mode}
            </button>
          ))}
        </div>

        {/* Zoom + Compass Controls */}
        <div className="hud-glass rounded-md flex flex-col divide-y divide-white/5">
          <button
            onClick={() => mapRef.current?.zoomIn()}
            className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapRef.current?.resetNorthPitch()}
            className="p-2.5 text-slate-400 hover:text-cyan-400 hover:bg-white/5 transition-all"
            title="Reset North"
          >
            <Compass className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const selected = drones.find((d) => d.id === selectedDroneId);
              if (selected && mapRef.current) {
                mapRef.current.easeTo({
                  center: [selected.vitals.longitude, selected.vitals.latitude],
                  zoom: 15.5,
                  duration: 700,
                });
              }
            }}
            className="p-2.5 text-slate-400 hover:text-emerald-400 hover:bg-white/5 transition-all"
            title="Track Selected Drone"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowLayerMenu((prev) => !prev)}
            className={`p-2.5 transition-all ${showLayerMenu ? 'text-cyan-400 bg-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            title="Toggle Layers"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>

        {/* Layer Control Panel */}
        {showLayerMenu && (
          <div className="hud-glass rounded-lg p-3 w-44 shadow-2xl">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">Layers</p>
            {[
              { label: 'Flight Paths', state: showFlightPaths, set: setShowFlightPaths },
              { label: 'Geofences', state: showGeofences, set: setShowGeofences },
              { label: 'Restricted Zones', state: showRestricted, set: setShowRestricted },
              { label: 'Waypoints', state: showWaypoints, set: setShowWaypoints },
            ].map(({ label, state, set }) => (
              <label key={label} className="flex items-center justify-between py-1.5 cursor-pointer hover:text-white transition-colors">
                <span className="text-[11px] text-slate-400">{label}</span>
                <div
                  onClick={() => set(!state)}
                  className={`relative w-7 h-4 rounded-full transition-all cursor-pointer ${state ? 'bg-cyan-500/30 border border-cyan-500/50' : 'bg-slate-700/50 border border-slate-600'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${state ? 'bg-cyan-400 left-3.5' : 'bg-slate-500 left-0.5'}`} />
                </div>
              </label>
            ))}
            <div className="border-t border-white/5 mt-2 pt-2">
              <p className="text-[10px] text-slate-500 mb-1.5">Basemap</p>
              <div className="grid grid-cols-2 gap-1">
                {(['satellite', 'dark'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setMapStyle(s)}
                    className={`py-1 px-2 rounded text-[10px] font-mono capitalize transition-all ${
                      mapStyle === s
                        ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400'
                        : 'text-slate-500 hover:text-slate-300 border border-transparent hover:border-slate-600'
                    }`}
                  >
                    {s === 'satellite' ? 'Satellite' : 'Dark'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scale bar */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 px-2.5 py-1.5 hud-glass rounded">
        <div className="w-10 h-2 border-b-2 border-l-2 border-r-2 border-slate-500" />
        <span className="text-[10px] font-mono text-slate-400">500 m</span>
      </div>

      {/* SIMULATION badge */}
      <div className="absolute bottom-4 right-4 z-20 px-2 py-1 hud-glass rounded">
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">SIMULATION MODE</span>
      </div>
    </div>
  );
};
