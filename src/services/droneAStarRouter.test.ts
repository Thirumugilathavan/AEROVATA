import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  calculateDroneAStarRoute,
  calculateDroneMultiRoute,
  generateAdaptiveCheckpoints,
  validateRouteAgainstConstraints,
  areRoutesGenuinelyDistinct,
  OFFICIAL_REGULATORY_CONFIG,
  COIMBATORE_LOCATIONS, 
  SIMULATION_BOUNDS, 
  isCoordinateWithinBounds 
} from './droneAStarRouter';
import { COIMBATORE_DETAILED_OBSTACLES } from '../data/coimbatoreGeoData';
import { OFFICIAL_COIMBATORE_AIRSPACE_ZONES } from '../data/officialAirspaceData';

describe('Drone A* Pathfinding Engine & Route Generator', () => {
  // ─── 1. Simulation Bounds and Input Validation ───────────────────────────
  it('correctly validates simulation bounds', () => {
    assert.strictEqual(isCoordinateWithinBounds(76.9665, 11.0025), true); // CMCH Hub
    assert.strictEqual(isCoordinateWithinBounds(70.0000, 11.0000), false); // Far west
    assert.strictEqual(isCoordinateWithinBounds(76.9665, 15.0000), false); // Far north
  });

  it('rejects identical start and destination coordinates', () => {
    const loc = COIMBATORE_LOCATIONS[0];
    const res = calculateDroneAStarRoute(loc.coordinates, loc.coordinates);
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /Destination cannot be the same as the starting point/);
  });

  // ─── 2. Adaptive Frequent Checkpoint Generation ──────────────────────────
  it('subdivides long route segments into substantially more frequent checkpoints', () => {
    const start = COIMBATORE_LOCATIONS.find((l) => l.id === 'loc-cmch-hub')!;
    const dest = COIMBATORE_LOCATIONS.find((l) => l.id === 'loc-peelamedu-depot')!;

    const res = calculateDroneAStarRoute(start.coordinates, dest.coordinates, {
      startName: start.name,
      destName: dest.name,
      checkpointSpacingMeters: 100,
    });

    assert.strictEqual(res.success, true);
    // On the ~5.5km route, there must be substantially more than a few checkpoints (> 15 checkpoints)
    assert.ok(res.waypoints.length >= 15, `Expected >= 15 checkpoints on ~5.5km corridor, got ${res.waypoints.length}`);
    assert.ok(res.distanceKm > 4.0 && res.distanceKm < 8.0, `Expected distance ~5-7km, got ${res.distanceKm}`);
    assert.ok(res.estimatedMinutes >= 5, 'Estimated flight time should be calculated');

    // Departure pad and delivery arrival pad types
    assert.strictEqual(res.waypoints[0].type, 'base');
    assert.strictEqual(res.waypoints[res.waypoints.length - 1].type, 'delivery');
  });

  it('respects configurable checkpoint spacing and deduplicates close points', () => {
    const coords: [number, number][] = [
      [76.9665, 11.0025],
      [76.9765, 11.0025], // ~1.08 km straight line
    ];

    // With 100m spacing, ~1000m should yield ~10-12 checkpoints
    const cps100 = generateAdaptiveCheckpoints(coords, { spacingMeters: 100, minSeparationMeters: 15 });
    assert.ok(cps100.length >= 8 && cps100.length <= 15, `Expected 8-15 checkpoints, got ${cps100.length}`);

    // With 50m spacing, should yield approximately double the checkpoints
    const cps50 = generateAdaptiveCheckpoints(coords, { spacingMeters: 50, minSeparationMeters: 15 });
    assert.ok(cps50.length > cps100.length, `50m spacing (${cps50.length}) should produce more checkpoints than 100m spacing (${cps100.length})`);

    // Verify deduplication: no two consecutive points closer than minSeparation (15m)
    for (let i = 0; i < cps100.length - 1; i++) {
      const p1 = cps100[i];
      const p2 = cps100[i + 1];
      const dLat = (p2.lat - p1.lat) * 111000;
      const dLng = (p2.lng - p1.lng) * 111000 * Math.cos((p1.lat * Math.PI) / 180);
      const dist = Math.hypot(dLat, dLng);
      assert.ok(dist >= 14.5, `Checkpoints ${i} and ${i+1} separated by ${dist}m (< 15m)`);
    }
  });

  it('increases checkpoint density near route bends (direction changes >= 20 degrees)', () => {
    // Polyline with a sharp 90-degree bend in the middle
    const turnCoords: [number, number][] = [
      [76.9600, 11.0000],
      [76.9700, 11.0000], // Heading 90 East
      [76.9700, 11.0100], // Heading 0 North (90 degree turn!)
    ];

    const turnCps = generateAdaptiveCheckpoints(turnCoords, {
      spacingMeters: 100,
      bendDensityFactor: 2.0,
      minSeparationMeters: 15,
    });

    assert.ok(turnCps.length >= 15, `Expected >= 15 checkpoints for turning route, got ${turnCps.length}`);
    
    // Check that turn waypoint contains turn label
    const turnPoint = turnCps.find((w) => w.name.includes('Turn') || w.name.includes('HDG'));
    assert.ok(turnPoint, 'Should contain labeled turn checkpoint');
  });

  it('assigns explicit simulated altitude in metres AGL and sequence labels to all checkpoints', () => {
    const coords: [number, number][] = [
      [76.9665, 11.0025],
      [76.9750, 11.0060],
      [76.9800, 11.0100],
    ];

    const cps = generateAdaptiveCheckpoints(coords, {
      cruiseAltMeters: 75,
      routeIdPrefix: 'test',
    });

    assert.ok(cps.length >= 3);
    cps.forEach((cp, idx) => {
      assert.strictEqual(typeof cp.altitudeMeters, 'number');
      const isFirst = idx === 0;
      const isLast = idx === cps.length - 1;
      if (isFirst || isLast) {
        assert.strictEqual(cp.altitudeMeters, 0, 'Landing/takeoff pads should be at 0m AGL ground');
      } else {
        assert.strictEqual(cp.altitudeMeters, 75, 'Intermediate checkpoints should be at configured cruise altitude');
      }
      assert.ok(cp.name.length > 0);
      assert.ok(cp.id.startsWith('test-'));
      assert.strictEqual(cp.status, idx === 0 ? 'completed' : 'upcoming');
    });
  });

  // ─── 3. 3D Building Clearance and Airspace Zone Constraints ──────────────
  it('validates vertical clearance and horizontal separation against 3D buildings', () => {
    // Take a route near a known high-rise obstacle (e.g. TIDEL Park or Express Tower)
    const obstacle = COIMBATORE_DETAILED_OBSTACLES.find((o) => (o.heightMeters || 0) >= 40)!;
    assert.ok(obstacle, 'Should have test obstacle >= 40m');

    // Route coordinates traversing right through the obstacle footprint
    const obsCoords = obstacle.coordinates;
    const centerLng = obsCoords.reduce((sum, c) => sum + c[0], 0) / obsCoords.length;
    const centerLat = obsCoords.reduce((sum, c) => sum + c[1], 0) / obsCoords.length;

    const penetratingCoords: [number, number][] = [
      [centerLng - 0.002, centerLat],
      [centerLng + 0.002, centerLat],
    ];

    // Flight altitude LOWER than obstacle height + 15m buffer -> must be BLOCKED
    const lowAlt = (obstacle.physicalHeightMeters || obstacle.heightMeters) - 5;
    const invalidRes = validateRouteAgainstConstraints(penetratingCoords, lowAlt, [obstacle], []);
    assert.strictEqual(invalidRes.isValid, false);
    assert.strictEqual(invalidRes.status, 'BLOCKED');
    assert.ok(invalidRes.reasons.some((r) => r.includes('Collision risk') || r.includes(obstacle.name)));

    // Flight altitude WELL ABOVE obstacle height + 15m buffer -> should be VALIDATED vertically
    const safeHighAlt = (obstacle.physicalHeightMeters || obstacle.heightMeters) + 30;
    const safeRes = validateRouteAgainstConstraints(penetratingCoords, safeHighAlt, [obstacle], []);
    assert.strictEqual(safeRes.isValid, true);
    assert.strictEqual(safeRes.status, 'VALIDATED');
  });

  it('fails gracefully when destination is inside DGCA Red Zone (VOCB Runway)', () => {
    const start = COIMBATORE_LOCATIONS[0].coordinates; // CMCH
    const insideRedZone: [number, number] = [77.0434, 11.0300]; // Inside Airport Red Zone

    const res = calculateDroneAStarRoute(start, insideRedZone, {
      startName: 'CMCH Hub',
      destName: 'VOCB Active Runway Perimeter',
    });

    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes('prohibited') || res.error?.includes('Arrival denied') || res.error?.includes('Red Zone'));
  });

  it('flags Yellow Zone traversal with RESTRICTED authorization warning rather than hard blocking', () => {
    const yellowZone = OFFICIAL_COIMBATORE_AIRSPACE_ZONES.find((z) => z.classification === 'YELLOW')!;
    assert.ok(yellowZone, 'Should have test Yellow Zone');

    // Peelamedu Depot is inside the Yellow Zone buffer of Coimbatore Airport
    const start = COIMBATORE_LOCATIONS.find((l) => l.id === 'loc-cmch-hub')!;
    const dest = COIMBATORE_LOCATIONS.find((l) => l.id === 'loc-peelamedu-depot')!;

    const multiRes = calculateDroneMultiRoute(start.coordinates, dest.coordinates);
    assert.strictEqual(multiRes.success, true);
    assert.ok(multiRes.primaryRoute !== null);

    // The primary route terminates in the Yellow Zone, so it should flag RESTRICTED status with authorization warning
    assert.strictEqual(multiRes.primaryRoute.validation.status, 'RESTRICTED');
    assert.ok(multiRes.primaryRoute.validation.warnings.some((w) => w.includes('Yellow Zone') || w.includes('ATC authorization')));
  });

  it('enforces 120m regulatory ceiling per DGCA Drone Rules 2021', () => {
    assert.strictEqual(OFFICIAL_REGULATORY_CONFIG.maxPermittedGreenZoneAltMeters, 120);
    assert.strictEqual(OFFICIAL_REGULATORY_CONFIG.lastVerificationDate, '2026-03-01');

    const testCoords: [number, number][] = [
      [76.9665, 11.0025],
      [76.9700, 11.0050],
    ];

    // Altitude exceeding 120m AGL ceiling flags warning and UNVERIFIED_DATA status
    const overCeilingRes = validateRouteAgainstConstraints(testCoords, 140, [], []);
    assert.strictEqual(overCeilingRes.status, 'UNVERIFIED_DATA');
    assert.ok(overCeilingRes.warnings.some((w) => w.includes('regulatory ceiling') && w.includes('120m')));
  });

  // ─── 4. Multiple Distinct Candidate Routes ───────────────────────────────
  it('generates multiple distinct candidate routes with genuine geometric divergence', () => {
    const start = COIMBATORE_LOCATIONS.find((l) => l.id === 'loc-cmch-hub')!;
    const dest = COIMBATORE_LOCATIONS.find((l) => l.id === 'loc-peelamedu-depot')!;

    const multi = calculateDroneMultiRoute(start.coordinates, dest.coordinates, {
      startName: start.name,
      destName: dest.name,
      cruiseAltMeters: 65,
    });

    assert.strictEqual(multi.success, true);
    assert.ok(multi.allCandidates.length >= 2, `Expected at least 2 distinct candidates, got ${multi.allCandidates.length}`);
    
    // Primary route must have isRecommended = true
    assert.strictEqual(multi.primaryRoute?.isRecommended, true);
    assert.ok(multi.primaryRoute.recommendationReason.includes('Recommended:'));

    // Check candidate divergence
    if (multi.allCandidates.length >= 2) {
      const candA = multi.allCandidates[0];
      const candB = multi.allCandidates[1];
      assert.notStrictEqual(candA.id, candB.id);
      assert.notStrictEqual(candA.strategy, candB.strategy);
      
      const areDistinct = areRoutesGenuinelyDistinct(candA.coordinates, candB.coordinates, 60);
      assert.strictEqual(areDistinct, true, 'Candidates should be genuinely distinct (min avg divergence >= 60m)');
    }
  });

  it('rejects trivial or duplicate routes in areRoutesGenuinelyDistinct', () => {
    const coords: [number, number][] = [
      [76.9665, 11.0025],
      [76.9800, 11.0100],
      [77.0000, 11.0200],
    ];

    // Identical route coordinates -> must return false
    assert.strictEqual(areRoutesGenuinelyDistinct(coords, coords, 60), false);

    // Negligible perturbation (< 10m) -> must return false
    const trivialPerturbation: [number, number][] = coords.map(([lng, lat]) => [lng + 0.00005, lat + 0.00005]);
    assert.strictEqual(areRoutesGenuinelyDistinct(coords, trivialPerturbation, 60), false);
  });
});
