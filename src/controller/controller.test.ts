/**
 * Unit Tests for Simulation Mission Controller
 * AEROVATA by TASPORA
 * 
 * Verifies checkpoint progression, state machine guards,
 * invalid input error handling, and telemetry calculations.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { MissionStateMachine } from './MissionStateMachine.ts';
import { validateMission } from './validation.ts';
import { SimulationMissionController } from './SimulationMissionController.ts';
import type { Mission, Checkpoint } from '../types/mission.ts';

function createValidTestMission(): Mission {
  const checkpoints: Checkpoint[] = [
    {
      id: 'cp-01',
      sequence: 1,
      name: 'Hub Alpha Launch Pad',
      lat: -37.8155,
      lng: 145.1220,
      altitudeMeters: 0,
      targetSpeedKmh: 40,
      arrivalRadiusMeters: 10,
      dwellTimeSeconds: 0,
      action: 'takeoff',
      status: 'pending',
    },
    {
      id: 'cp-02',
      sequence: 2,
      name: 'Ridge Corridor Point Alpha',
      lat: -37.8130,
      lng: 145.1240,
      altitudeMeters: 80,
      targetSpeedKmh: 45,
      arrivalRadiusMeters: 10,
      dwellTimeSeconds: 2,
      action: 'transit',
      status: 'pending',
    },
    {
      id: 'cp-03',
      sequence: 3,
      name: 'St. Jude Trauma Delivery Drop',
      lat: -37.8100,
      lng: 145.1270,
      altitudeMeters: 40,
      targetSpeedKmh: 35,
      arrivalRadiusMeters: 8,
      dwellTimeSeconds: 0,
      action: 'drop_payload',
      status: 'pending',
    },
  ];

  return {
    id: 'MSN-TEST-001',
    title: 'Hospital Urgent Delivery Test',
    description: 'Unit test automated flight path',
    priority: 'URGENT',
    droneId: 'AV-01',
    droneCallsign: 'DRONE 01',
    status: 'idle',
    checkpoints,
    currentCheckpointIndex: 0,
    totalDistanceMeters: 0,
    elapsedTimeSeconds: 0,
    estimatedRemainingSeconds: 0,
    progressPercent: 0,
  };
}

test('MissionStateMachine transitions correctly', () => {
  const sm = new MissionStateMachine('idle');
  assert.strictEqual(sm.getState(), 'idle');

  // Valid: idle -> running
  assert.strictEqual(sm.transition('running'), true);
  assert.strictEqual(sm.getState(), 'running');

  // Valid: running -> paused
  assert.strictEqual(sm.transition('paused'), true);
  assert.strictEqual(sm.getState(), 'paused');

  // Valid: paused -> running
  assert.strictEqual(sm.transition('running'), true);
  assert.strictEqual(sm.getState(), 'running');

  // Invalid: cannot jump directly from running to idle without reset
  assert.strictEqual(sm.canTransition('idle'), true); // Reset allowed

  // Invalid: cannot jump to invalid state
  assert.strictEqual(sm.canTransition('running'), false); // Cannot transition to self
});

test('MissionStateMachine rejects invalid transitions', () => {
  const sm = new MissionStateMachine('idle');
  assert.strictEqual(sm.canTransition('completed'), false);
  assert.strictEqual(sm.transition('completed'), false);
  assert.strictEqual(sm.getState(), 'idle');
});

test('validateMission accepts well-formed missions', () => {
  const mission = createValidTestMission();
  const res = validateMission(mission);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.error, undefined);
});

test('validateMission rejects missions with fewer than 2 checkpoints', () => {
  const mission = createValidTestMission();
  mission.checkpoints = [mission.checkpoints[0]]; // Only 1 checkpoint
  const res = validateMission(mission);
  assert.strictEqual(res.valid, false);
  assert.match(res.error || '', /at least 2 checkpoints/i);
});

test('validateMission rejects negative altitudes and invalid coordinates', () => {
  const mission = createValidTestMission();
  mission.checkpoints[1].altitudeMeters = -15; // Negative altitude
  const res = validateMission(mission);
  assert.strictEqual(res.valid, false);
  assert.match(res.error || '', /altitude cannot be negative/i);

  const mission2 = createValidTestMission();
  mission2.checkpoints[1].lat = 145.0; // Out of range latitude
  const res2 = validateMission(mission2);
  assert.strictEqual(res2.valid, false);
  assert.match(res2.error || '', /invalid latitude/i);
});

test('validateMission rejects duplicate consecutive coordinates', () => {
  const mission = createValidTestMission();
  mission.checkpoints[1].lat = mission.checkpoints[0].lat;
  mission.checkpoints[1].lng = mission.checkpoints[0].lng;
  const res = validateMission(mission);
  assert.strictEqual(res.valid, false);
  assert.match(res.error || '', /identical/i);
});

test('SimulationMissionController transitions to error state on invalid mission', () => {
  const controller = new SimulationMissionController();
  const invalidMission = createValidTestMission();
  invalidMission.checkpoints = []; // Empty checkpoints

  const res = controller.loadMission(invalidMission);
  assert.strictEqual(res.success, false);
  assert.strictEqual(controller.getState(), 'error');

  const loaded = controller.getMission();
  assert.strictEqual(loaded?.status, 'error');
  assert.ok(loaded?.errorMessage);
});

test('SimulationMissionController loads valid mission and resets to checkpoint 0', () => {
  const controller = new SimulationMissionController();
  const mission = createValidTestMission();

  const res = controller.loadMission(mission);
  assert.strictEqual(res.success, true);
  assert.strictEqual(controller.getState(), 'idle');

  const telemetry = controller.getTelemetry();
  assert.ok(telemetry);
  assert.strictEqual(telemetry!.lat, mission.checkpoints[0].lat);
  assert.strictEqual(telemetry!.lng, mission.checkpoints[0].lng);
  assert.strictEqual(telemetry!.currentCheckpointIndex, 1);
  assert.strictEqual(telemetry!.missionStatus, 'idle');
});

test('SimulationMissionController starts, advances checkpoints, and finishes', () => {
  const controller = new SimulationMissionController();
  const mission = createValidTestMission();
  controller.loadMission(mission);

  assert.strictEqual(controller.start(), true);
  assert.strictEqual(controller.getState(), 'running');

  // Step simulation forward until drone reaches Checkpoint 2 (cp-02)
  // Distance from cp1 to cp2 is approx 330m. At 45 km/h (12.5 m/s), it takes ~27 seconds.
  // Step in 5s increments
  for (let i = 0; i < 7; i++) {
    controller.step(5);
  }

  const telemetry1 = controller.getTelemetry();
  const mission1 = controller.getMission();
  assert.ok(telemetry1);
  assert.ok(mission1);

  // Checkpoint 2 has dwellTimeSeconds = 2. Advance past dwell
  controller.step(3);

  // Now the active checkpoint should have advanced to index 2 (cp-03)
  assert.strictEqual(mission1!.currentCheckpointIndex, 2);
  assert.strictEqual(mission1!.checkpoints[1].status, 'reached');
  assert.strictEqual(mission1!.checkpoints[2].status, 'active');

  // Step further to reach final checkpoint (cp-03)
  for (let i = 0; i < 15; i++) {
    controller.step(5);
    if (controller.getState() === 'completed') break;
  }

  assert.strictEqual(controller.getState(), 'completed');
  assert.strictEqual(mission1!.progressPercent, 100);
  assert.strictEqual(mission1!.checkpoints[2].status, 'reached');
});

test('SimulationMissionController pauses, resumes, and resets', () => {
  const controller = new SimulationMissionController();
  const mission = createValidTestMission();
  controller.loadMission(mission);

  controller.start();
  assert.strictEqual(controller.getState(), 'running');

  // Advance slightly
  controller.step(5);

  // Pause
  assert.strictEqual(controller.pause(), true);
  assert.strictEqual(controller.getState(), 'paused');

  // Stepping while paused should not advance position
  const latBefore = controller.getTelemetry()?.lat;
  controller.step(10);
  const latAfter = controller.getTelemetry()?.lat;
  assert.strictEqual(latBefore, latAfter);

  // Resume
  assert.strictEqual(controller.resume(), true);
  assert.strictEqual(controller.getState(), 'running');

  // Reset
  controller.reset();
  assert.strictEqual(controller.getState(), 'idle');
  const resetTelemetry = controller.getTelemetry();
  assert.strictEqual(resetTelemetry?.lat, mission.checkpoints[0].lat);
  assert.strictEqual(resetTelemetry?.lng, mission.checkpoints[0].lng);
  assert.strictEqual(resetTelemetry?.missionStatus, 'idle');
});
