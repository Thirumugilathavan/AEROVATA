/**
 * Shared 3D World Model & Building Obstacle Representation
 * AEROVATA by TASPORA - UTM Autonomous Airspace Command
 * 
 * Provides a unified 3D obstacle and airspace representation shared
 * across path planning, collision checking, and visualization.
 * 
 * Separation of Concerns:
 * - Physical building obstacles have footprints and 3D heights [0, H] AGL.
 * - DGCA Airspace boundaries (Red/Yellow/Green) are regulatory zones, NOT physical obstacles.
 */

import { Obstacle, OfficialAirspaceZone, RegulatoryAltitudeConfig } from '../../types/fleet';
import { COIMBATORE_DETAILED_OBSTACLES } from '../../data/coimbatoreGeoData';
import { OFFICIAL_COIMBATORE_AIRSPACE_ZONES } from '../../data/officialAirspaceData';
import { OFFICIAL_REGULATORY_CONFIG } from '../droneAStarRouter';
import { BuildingObstacle3D, IWorldModel3D } from './types';
import { DEFAULT_REGIONAL_GROUND_ELEVATION_METERS, aglToAmsl } from './altitudeUtils';

/**
 * Validates a 2D geographic polygon footprint.
 * Returns true if polygon has at least 3 distinct coordinates.
 */
export function isValidFootprint(coords: [number, number][]): boolean {
  if (!Array.isArray(coords) || coords.length < 3) return false;
  // Check if coordinates contain valid finite numbers
  for (const pt of coords) {
    if (!Array.isArray(pt) || pt.length < 2 || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
      return false;
    }
  }
  return true;
}

/**
 * Tests if a point [lng, lat] is inside a polygon using ray casting.
 */
export function isPointInsidePolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Computes polygon centroid [lng, lat].
 */
export function computePolygonCenter(coords: [number, number][]): [number, number] {
  if (coords.length === 0) return [0, 0];
  let sumLng = 0;
  let sumLat = 0;
  const count = coords.length;
  for (let i = 0; i < count; i++) {
    sumLng += coords[i][0];
    sumLat += coords[i][1];
  }
  return [sumLng / count, sumLat / count];
}

/**
 * Extracts and derives a normalized 3D building obstacle representation
 * from an application Obstacle structure.
 */
export function extractBuildingObstacle3D(
  raw: Obstacle, 
  regionalGroundElevation: number = DEFAULT_REGIONAL_GROUND_ELEVATION_METERS
): BuildingObstacle3D {
  const validFootprint = isValidFootprint(raw.coordinates);
  
  // Height resolution: prefer physicalHeightMeters > heightMeters > fallback
  let rawHeight = raw.physicalHeightMeters ?? raw.heightMeters;
  let heightConfidence = raw.heightConfidence || 'verified';
  let isHeightEstimated = false;

  if (typeof rawHeight !== 'number' || !Number.isFinite(rawHeight) || rawHeight <= 0) {
    // Fallback: estimate standard 24.0m height for unidentified buildings
    rawHeight = 24.0;
    heightConfidence = 'estimated';
    isHeightEstimated = true;
  }

  const baseElevation = Number.isFinite(raw.baseElevationMeters) 
    ? raw.baseElevationMeters! 
    : regionalGroundElevation;

  const roofElevation = Number.isFinite(raw.roofElevationMeters)
    ? raw.roofElevationMeters!
    : aglToAmsl(rawHeight, baseElevation);

  const center = (raw.center && Number.isFinite(raw.center[0]) && Number.isFinite(raw.center[1]))
    ? raw.center
    : computePolygonCenter(raw.coordinates);

  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    footprint: raw.coordinates,
    center,
    heightAboveGroundMeters: rawHeight,
    groundElevationMeters: baseElevation,
    roofElevationMeters: roofElevation,
    horizontalSafetyBufferMeters: raw.safetyBufferMeters ?? 25.0,
    verticalClearanceBufferMeters: raw.verticalClearanceBufferMeters ?? 15.0,
    heightConfidence,
    heightSource: raw.heightSource || (isHeightEstimated ? 'Fallback Estimation' : 'Surveyed Dataset'),
    isValid: validFootprint && !isHeightEstimated,
    metadata: {
      deckElevationMeters: raw.deckElevationMeters,
      deckThicknessMeters: raw.deckThicknessMeters,
      isGroundLevelRoad: raw.isGroundLevelRoad,
      rawObstacle: raw,
    },
  };
}

/**
 * Central 3D World Model Implementation
 */
export class WorldModel3D implements IWorldModel3D {
  private buildingObstacles: BuildingObstacle3D[] = [];
  private airspaceZones: OfficialAirspaceZone[] = [];
  private regionalElevation: number;
  private regulatoryConfig: RegulatoryAltitudeConfig;

  constructor(
    obstacles: Obstacle[] = COIMBATORE_DETAILED_OBSTACLES,
    airspaceZones: OfficialAirspaceZone[] = OFFICIAL_COIMBATORE_AIRSPACE_ZONES,
    regionalElevation: number = DEFAULT_REGIONAL_GROUND_ELEVATION_METERS,
    regulatoryConfig: RegulatoryAltitudeConfig = OFFICIAL_REGULATORY_CONFIG
  ) {
    this.regionalElevation = regionalElevation;
    this.regulatoryConfig = regulatoryConfig;
    this.airspaceZones = airspaceZones;
    this.buildingObstacles = obstacles.map((obs) => extractBuildingObstacle3D(obs, this.regionalElevation));
  }

  public getBuildingObstacles(): BuildingObstacle3D[] {
    return this.buildingObstacles;
  }

  public getAirspaceZones(): OfficialAirspaceZone[] {
    return this.airspaceZones;
  }

  public getRegionalElevation(_lat: number, _lng: number): number {
    return this.regionalElevation;
  }

  public getRegulatoryConfig(): RegulatoryAltitudeConfig {
    return this.regulatoryConfig;
  }

  public findObstaclesInBBox(
    minLng: number, 
    minLat: number, 
    maxLng: number, 
    maxLat: number
  ): BuildingObstacle3D[] {
    return this.buildingObstacles.filter((obs) => {
      // Check if center or any footprint point is inside bounding box
      const [cLng, cLat] = obs.center;
      if (cLng >= minLng && cLng <= maxLng && cLat >= minLat && cLat <= maxLat) {
        return true;
      }
      return obs.footprint.some(([lng, lat]) => lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat);
    });
  }

  public findObstacleAtPoint(lng: number, lat: number): BuildingObstacle3D | null {
    for (const obs of this.buildingObstacles) {
      if (obs.type !== 'highway_flyover' && isPointInsidePolygon([lng, lat], obs.footprint)) {
        return obs;
      }
    }
    return null;
  }

  public addObstacle(obs: Obstacle): void {
    this.buildingObstacles.push(extractBuildingObstacle3D(obs, this.regionalElevation));
  }

  public setAirspaceZones(zones: OfficialAirspaceZone[]): void {
    this.airspaceZones = zones;
  }
}
