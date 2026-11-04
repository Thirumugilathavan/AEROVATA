/**
 * Coordinate Transformation & Map Provider Independence Adapter
 * AEROVATA by TASPORA - PX4 SITL & Gazebo Integration Layer
 * 
 * Provides rigorous mathematical coordinate conversions between:
 * 1. Geographic WGS84 Coordinates (EPSG:4326)
 * 2. MAVLink Global Relative Altitude Integers (MAV_FRAME_GLOBAL_RELATIVE_ALT_INT)
 * 3. Local Tangent Plane NED (North-East-Down) for Gazebo physics & PX4 EKF2
 * 4. Web Mercator Projected Coordinates (EPSG:3857) for map rendering
 * 
 * Map Provider Independent: Enables hot-swapping MapLibre, Cesium, Leaflet, or custom engines.
 */

import type { Checkpoint } from '../../types/mission.ts';

export interface Wgs84Coordinate {
  lat: number;
  lng: number;
  altitudeMeters: number;
}

export interface LocalNedCoordinate {
  northMeters: number;
  eastMeters: number;
  downMeters: number;
}

export interface MavlinkMissionItemInt {
  seq: number;
  frame: number; // 6 = MAV_FRAME_GLOBAL_RELATIVE_ALT_INT
  command: number; // 16 = NAV_WAYPOINT, 22 = NAV_TAKEOFF, 21 = NAV_LAND, 19 = NAV_LOITER_TIME
  current: number; // 1 if current target, 0 otherwise
  autocontinue: number; // 1 to proceed to next item upon completion
  param1: number; // Dwell time in seconds (or takeoff pitch)
  param2: number; // Acceptance radius in meters
  param3: number; // Pass radius in meters (0 for straight through)
  param4: number; // Desired yaw heading (NaN for default)
  x: number; // Latitude * 1e7
  y: number; // Longitude * 1e7
  z: number; // Altitude in meters relative to home
}

// WGS84 Earth Ellipsoid Constants
const WGS84_A = 6378137.0; // Semi-major axis in meters
const WGS84_E2 = 0.00669437999014; // First eccentricity squared

/**
 * Interface decoupling TASPORA from any specific map renderer.
 * The application or user can supply MapLibre, Cesium 3D, Leaflet, or custom tiles.
 */
export interface IMapCoordinateAdapter {
  getName(): string;
  wgs84ToMapPoint(coord: Wgs84Coordinate): [number, number];
  mapPointToWgs84(point: [number, number]): Wgs84Coordinate;
  wgs84ToLocalNed(coord: Wgs84Coordinate, home: Wgs84Coordinate): LocalNedCoordinate;
  localNedToWgs84(ned: LocalNedCoordinate, home: Wgs84Coordinate): Wgs84Coordinate;
  checkpointToMavlinkItem(checkpoint: Checkpoint, isCurrent?: boolean): MavlinkMissionItemInt;
}

export class Px4GazeboCoordinateAdapter implements IMapCoordinateAdapter {
  private adapterName: string;

  constructor(name: string = 'Standard WGS84-NED Gazebo Adapter') {
    this.adapterName = name;
  }

  public getName(): string {
    return this.adapterName;
  }

  /**
   * Converts WGS84 to standard MapLibre / Web Mercator display coordinates [lng, lat]
   */
  public wgs84ToMapPoint(coord: Wgs84Coordinate): [number, number] {
    return [coord.lng, coord.lat];
  }

  /**
   * Converts MapLibre [lng, lat] back to WGS84 coordinate
   */
  public mapPointToWgs84(point: [number, number]): Wgs84Coordinate {
    return {
      lng: point[0],
      lat: point[1],
      altitudeMeters: 0,
    };
  }

  /**
   * Converts WGS84 to Gazebo / PX4 Local Tangent Plane NED (North, East, Down in meters).
   * Uses flat-earth equirectangular projection with geodetic curvature correction.
   */
  public wgs84ToLocalNed(coord: Wgs84Coordinate, home: Wgs84Coordinate): LocalNedCoordinate {
    const latRad = (coord.lat * Math.PI) / 180.0;
    const homeLatRad = (home.lat * Math.PI) / 180.0;
    const dLat = ((coord.lat - home.lat) * Math.PI) / 180.0;
    const dLon = ((coord.lng - home.lng) * Math.PI) / 180.0;

    // Radii of curvature
    const sinLat = Math.sin(homeLatRad);
    const N = WGS84_A / Math.sqrt(1.0 - WGS84_E2 * sinLat * sinLat);
    const M = (WGS84_A * (1.0 - WGS84_E2)) / Math.pow(1.0 - WGS84_E2 * sinLat * sinLat, 1.5);

    const northMeters = dLat * M;
    const eastMeters = dLon * (N * Math.cos(homeLatRad));
    const downMeters = -(coord.altitudeMeters - home.altitudeMeters);

    return {
      northMeters: (Math.round(northMeters * 100) / 100) || 0,
      eastMeters: (Math.round(eastMeters * 100) / 100) || 0,
      downMeters: (Math.round(downMeters * 100) / 100) || 0,
    };
  }

  /**
   * Converts Gazebo / PX4 Local Tangent Plane NED back to WGS84.
   */
  public localNedToWgs84(ned: LocalNedCoordinate, home: Wgs84Coordinate): Wgs84Coordinate {
    const homeLatRad = (home.lat * Math.PI) / 180.0;
    const sinLat = Math.sin(homeLatRad);
    const N = WGS84_A / Math.sqrt(1.0 - WGS84_E2 * sinLat * sinLat);
    const M = (WGS84_A * (1.0 - WGS84_E2)) / Math.pow(1.0 - WGS84_E2 * sinLat * sinLat, 1.5);

    const dLat = ned.northMeters / M;
    const dLon = ned.eastMeters / (N * Math.cos(homeLatRad));

    const lat = home.lat + (dLat * 180.0) / Math.PI;
    const lng = home.lng + (dLon * 180.0) / Math.PI;
    const altitudeMeters = home.altitudeMeters - ned.downMeters;

    return {
      lat: Math.round(lat * 1e7) / 1e7,
      lng: Math.round(lng * 1e7) / 1e7,
      altitudeMeters: Math.round(altitudeMeters * 10) / 10,
    };
  }

  /**
   * Converts a TASPORA Checkpoint into the standard MAVLink MISSION_ITEM_INT message format.
   * Compatible with PX4 Autopilot MAVLink v2.0 Mission Protocol.
   */
  public checkpointToMavlinkItem(checkpoint: Checkpoint, isCurrent: boolean = false): MavlinkMissionItemInt {
    // Determine MAVLink Command ID
    let command = 16; // MAV_CMD_NAV_WAYPOINT
    let param1 = checkpoint.dwellTimeSeconds || 0; // Hold time in seconds

    if (checkpoint.action === 'takeoff') {
      command = 22; // MAV_CMD_NAV_TAKEOFF
      param1 = 15; // Minimum pitch angle in degrees
    } else if (checkpoint.action === 'land') {
      command = 21; // MAV_CMD_NAV_LAND
      param1 = 0;
    } else if (checkpoint.action === 'hover_inspect' || checkpoint.dwellTimeSeconds > 0) {
      command = 19; // MAV_CMD_NAV_LOITER_TIME
      param1 = Math.max(1, checkpoint.dwellTimeSeconds);
    }

    return {
      seq: checkpoint.sequence - 1, // MAVLink missions are 0-indexed
      frame: 6, // MAV_FRAME_GLOBAL_RELATIVE_ALT_INT (relative to home altitude)
      command,
      current: isCurrent ? 1 : 0,
      autocontinue: 1,
      param1,
      param2: checkpoint.arrivalRadiusMeters || 5.0, // Acceptance radius
      param3: 0.0, // Pass radius
      param4: NaN, // Yaw heading (NaN = maintain trajectory track)
      x: Math.round(checkpoint.lat * 1e7),
      y: Math.round(checkpoint.lng * 1e7),
      z: Math.max(0, checkpoint.altitudeMeters),
    };
  }
}

export const defaultCoordinateAdapter = new Px4GazeboCoordinateAdapter();
