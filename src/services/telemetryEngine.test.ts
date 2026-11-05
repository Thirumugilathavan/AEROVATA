import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  getDistanceMeters, 
  getBearingDegrees, 
  formatWaypointDistance, 
  getWaypointStatusBadge,
  updateSimulationTick 
} from './telemetryEngine';
import { INITIAL_DRONES } from '../data/mockFleet';
import { OFFICIAL_COIMBATORE_AIRSPACE_ZONES } from '../data/officialAirspaceData';

test('formatWaypointDistance formats meters and kilometers accurately', () => {
  assert.equal(formatWaypointDistance(850), '850m');
  assert.equal(formatWaypointDistance(340), '340m');
  assert.equal(formatWaypointDistance(45), '45m');
  assert.equal(formatWaypointDistance(1450), '1.45 km');
  assert.equal(formatWaypointDistance(2100), '2.10 km');
  assert.equal(formatWaypointDistance(0), '0m');
  assert.equal(formatWaypointDistance(null), '--');
  assert.equal(formatWaypointDistance(undefined), '--');
});

test('getWaypointStatusBadge returns correct style and labels', () => {
  const approaching = getWaypointStatusBadge('APPROACHING');
  assert.equal(approaching.label, 'APPROACHING');
  assert.ok(approaching.colorClass.includes('cyan'));

  const near = getWaypointStatusBadge('NEAR_WAYPOINT');
  assert.equal(near.label, 'NEAR WAYPOINT');
  assert.ok(near.colorClass.includes('amber'));

  const reached = getWaypointStatusBadge('WAYPOINT_REACHED');
  assert.equal(reached.label, 'WAYPOINT REACHED');
  assert.ok(reached.colorClass.includes('emerald'));
});

test('Geodesic distance calculation produces expected metric distances', () => {
  // Distance from Peelamedu depot (11.0260, 77.0120) to Nava India (11.0180, 76.9940)
  const dist = getDistanceMeters(11.0260, 77.0120, 11.0180, 76.9940);
  assert.ok(dist > 2000 && dist < 2300, `Expected ~2160m, got ${dist}`);

  // Zero distance for same point
  assert.equal(Math.round(getDistanceMeters(11.0260, 77.0120, 11.0260, 77.0120)), 0);
});

test('Sequential simulation tick produces strictly monotonic decreasing distance countdown toward active waypoint', () => {
  const testDrone = JSON.parse(JSON.stringify(INITIAL_DRONES[0]));
  // Target waypoint is route[1]: Nava India Sky Corridor
  assert.equal(testDrone.targetWaypointIndex, 1);
  const initialDist = testDrone.distanceToNextWaypointMeters;
  assert.ok(initialDist > 2000);

  let currentDrone = testDrone;
  let previousDist = initialDist;

  // Run 10 simulation ticks (1 second each)
  for (let tick = 1; tick <= 10; tick++) {
    const result = updateSimulationTick([currentDrone], 1, [], [], OFFICIAL_COIMBATORE_AIRSPACE_ZONES);
    currentDrone = result.updatedDrones[0];

    const currentDist = currentDrone.distanceToNextWaypointMeters!;
    // Remaining distance must decrease monotonically towards WP-02
    assert.ok(
      currentDist < previousDist,
      `Tick ${tick}: Expected current distance (${currentDist}m) to be less than previous (${previousDist}m)`
    );
    assert.equal(currentDrone.targetWaypointIndex, 1);
    assert.equal(currentDrone.nextWaypointName, 'Nava India Sky Corridor');
    previousDist = currentDist;
  }
});

test('Waypoint arrival switches cleanly to next pending waypoint and recalculates fresh distance', () => {
  const testDrone = JSON.parse(JSON.stringify(INITIAL_DRONES[0]));
  // Place drone 12 meters from WP-02 (within the 18m arrival tolerance)
  const targetWp = testDrone.route[1];
  testDrone.vitals.latitude = targetWp.lat;
  testDrone.vitals.longitude = targetWp.lng + 0.0001; // ~11m offset
  testDrone.distanceToNextWaypointMeters = 11;

  const result = updateSimulationTick([testDrone], 1, [], [], OFFICIAL_COIMBATORE_AIRSPACE_ZONES);
  const updated = result.updatedDrones[0];

  // Must have arrived at WP-02 and advanced targetWaypointIndex to 2 (WP-03: Lakshmi Mills)
  assert.equal(updated.targetWaypointIndex, 2);
  assert.equal(updated.route[1].status, 'completed');
  assert.equal(updated.route[2].status, 'active');
  assert.equal(updated.nextWaypointName, 'Lakshmi Mills Overfly Corridor');
  // New distance must be measured to WP-03 (> 1000m)
  assert.ok(updated.distanceToNextWaypointMeters! > 1000);
});
