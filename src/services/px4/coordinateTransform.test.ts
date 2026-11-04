/**
 * Unit Tests for PX4 Gazebo Coordinate Transformations & Map Adapter
 * AEROVATA by TASPORA
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { Px4GazeboCoordinateAdapter, defaultCoordinateAdapter } from './coordinateTransform.ts';
import type { Checkpoint } from '../../types/mission.ts';

test('wgs84ToLocalNed computes zero displacement at home datum', () => {
  const home = { lat: -37.8155, lng: 145.1220, altitudeMeters: 45.0 };
  const ned = defaultCoordinateAdapter.wgs84ToLocalNed(home, home);

  assert.strictEqual(ned.northMeters, 0.0);
  assert.strictEqual(ned.eastMeters, 0.0);
  assert.strictEqual(ned.downMeters, 0.0);
});

test('wgs84ToLocalNed correctly computes North and Down displacements', () => {
  const home = { lat: -37.8155, lng: 145.1220, altitudeMeters: 0.0 };
  // Target point 0.001 deg North and 50m AGL
  const target = { lat: -37.8145, lng: 145.1220, altitudeMeters: 50.0 };
  const ned = defaultCoordinateAdapter.wgs84ToLocalNed(target, home);

  // 0.001 deg of latitude is approx 111 meters
  assert.ok(ned.northMeters > 110.0 && ned.northMeters < 112.0);
  assert.strictEqual(Math.round(ned.eastMeters), 0);
  assert.strictEqual(ned.downMeters, -50.0); // Down is negative when flying higher
});

test('Round-trip coordinate conversion WGS84 -> NED -> WGS84 preserves accuracy', () => {
  const home = { lat: -37.8155, lng: 145.1220, altitudeMeters: 25.0 };
  const original = { lat: -37.812345, lng: 145.125678, altitudeMeters: 85.0 };

  const ned = defaultCoordinateAdapter.wgs84ToLocalNed(original, home);
  const reconstructed = defaultCoordinateAdapter.localNedToWgs84(ned, home);

  assert.ok(Math.abs(reconstructed.lat - original.lat) < 1e-6);
  assert.ok(Math.abs(reconstructed.lng - original.lng) < 1e-6);
  assert.ok(Math.abs(reconstructed.altitudeMeters - original.altitudeMeters) < 0.1);
});

test('checkpointToMavlinkItem formats MAVLink mission command correctly', () => {
  const cpTakeoff: Checkpoint = {
    id: 'cp-01',
    sequence: 1,
    name: 'Launch Pad',
    lat: -37.8155,
    lng: 145.1220,
    altitudeMeters: 20.0,
    targetSpeedKmh: 30,
    arrivalRadiusMeters: 5.0,
    dwellTimeSeconds: 0,
    action: 'takeoff',
    status: 'pending',
  };

  const itemTakeoff = defaultCoordinateAdapter.checkpointToMavlinkItem(cpTakeoff, true);
  assert.strictEqual(itemTakeoff.seq, 0); // 0-indexed in MAVLink
  assert.strictEqual(itemTakeoff.frame, 6); // MAV_FRAME_GLOBAL_RELATIVE_ALT_INT
  assert.strictEqual(itemTakeoff.command, 22); // MAV_CMD_NAV_TAKEOFF
  assert.strictEqual(itemTakeoff.current, 1);
  assert.strictEqual(itemTakeoff.x, -378155000); // Lat * 1e7
  assert.strictEqual(itemTakeoff.y, 1451220000); // Lng * 1e7
  assert.strictEqual(itemTakeoff.z, 20.0);

  const cpHover: Checkpoint = {
    id: 'cp-02',
    sequence: 2,
    name: 'Inspection Waypoint',
    lat: -37.8118,
    lng: 145.1248,
    altitudeMeters: 80.0,
    targetSpeedKmh: 45,
    arrivalRadiusMeters: 8.0,
    dwellTimeSeconds: 5,
    action: 'hover_inspect',
    status: 'pending',
  };

  const itemHover = defaultCoordinateAdapter.checkpointToMavlinkItem(cpHover, false);
  assert.strictEqual(itemHover.seq, 1);
  assert.strictEqual(itemHover.command, 19); // MAV_CMD_NAV_LOITER_TIME
  assert.strictEqual(itemHover.param1, 5); // Dwell time in seconds
  assert.strictEqual(itemHover.param2, 8.0); // Acceptance radius
});
