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
  isCoordinateWithinBounds,
  checkSegmentObstacleIntersection,
  rerouteSegmentAroundObstacles,
  generateVerticalOverflight,
  validateRoute3D,
  deconflictWaypointRoute,
  deconflictWaypointRoute3D
} from './droneAStarRouter';
import { COIMBATORE_DETAILED_OBSTACLES } from '../data/coimbatoreGeoData';
import { OFFICIAL_COIMBATORE_AIRSPACE_ZONES } from '../data/officialAirspaceData';
import { SimulationMissionController } from '../controller/SimulationMissionController';

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
    });
  });

  // ─── 3. 3D Obstacle and Airspace Validation ──────────────────────────────
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
    const dupCoords: [number, number][] = [
      [76.9665, 11.0025],
      [76.9800, 11.0100],
      [77.0000, 11.0200],
    ];

    assert.strictEqual(areRoutesGenuinelyDistinct(coords, dupCoords, 50), false);
  });
});

describe('AEROVATA Part 7 — Complete Building-Aware 3D Navigation Test Suite', () => {
  const testBuilding = {
    id: 'test-building-1',
    name: 'Apollo Medical Tower',
    type: 'building' as const,
    heightMeters: 35,
    physicalHeightMeters: 35,
    verticalClearanceBufferMeters: 15,
    safetyBufferMeters: 20,
    heightConfidence: 'verified' as const,
    center: [76.9800, 11.0100] as [number, number],
    coordinates: [
      [76.9790, 11.0090],
      [76.9810, 11.0090],
      [76.9810, 11.0110],
      [76.9790, 11.0110],
      [76.9790, 11.0090],
    ] as [number, number][],
  };

  const wpA = {
    id: 'wp-start',
    name: 'Peelamedu North Pad',
    lng: 76.9740,
    lat: 11.0100,
    altitudeMeters: 40,
    type: 'base' as const,
    status: 'completed' as const,
  };

  const wpB = {
    id: 'wp-dest',
    name: 'Gandhipuram East Pad',
    lng: 76.9860,
    lat: 11.0100,
    altitudeMeters: 40,
    type: 'delivery' as const,
    status: 'upcoming' as const,
  };

  // ─── TEST 1: Single building ──────────────────────────────────────────
  it('Test 1: Single building - avoids building horizontally or safely passes above it using known height', () => {
    const check = checkSegmentObstacleIntersection(wpA, wpB, 40, 20, [testBuilding as any], []);
    assert.strictEqual(check.isBlocked, true);
    assert.ok(check.reason?.includes('Apollo Medical Tower'));

    const res = rerouteSegmentAroundObstacles(wpA, wpB, 40, 20, [testBuilding as any], []);
    assert.strictEqual(res.isRerouted, true);
    assert.ok(res.avoidanceMode === 'horizontal' || res.avoidanceMode === 'vertical_overflight');

    assert.strictEqual(res.waypoints[res.waypoints.length - 1].id, wpB.id);

    const val = validateRoute3D([wpA, ...res.waypoints], 20, 15, [testBuilding as any], []);
    assert.strictEqual(val.isValid, true);
    assert.strictEqual(val.hasCollision, false);
  });

  // ─── TEST 2: Multiple buildings ───────────────────────────────────────
  it('Test 2: Multiple buildings - entire route avoids all building volumes', () => {
    const secondBuilding = {
      id: 'test-building-2',
      name: 'Victoria Corporate Plaza',
      type: 'building' as const,
      heightMeters: 42,
      physicalHeightMeters: 42,
      verticalClearanceBufferMeters: 15,
      safetyBufferMeters: 20,
      heightConfidence: 'verified' as const,
      center: [76.9890, 11.0100] as [number, number],
      coordinates: [
        [76.9880, 11.0090],
        [76.9900, 11.0090],
        [76.9900, 11.0110],
        [76.9880, 11.0110],
        [76.9880, 11.0090],
      ] as [number, number][],
    };

    const wpC = {
      id: 'wp-dest-far',
      name: 'Singanallur Hub',
      lng: 76.9950,
      lat: 11.0100,
      altitudeMeters: 40,
      type: 'delivery' as const,
      status: 'upcoming' as const,
    };

    const multiMission = [wpA, wpB, wpC];
    const deconf = deconflictWaypointRoute(multiMission, 40, {
      safetyMargin: 20,
      verticalMargin: 15,
      obstacles: [testBuilding as any, secondBuilding as any],
      airspaceZones: [],
    });

    assert.strictEqual(deconf.hasRerouted, true);
    assert.strictEqual(deconf.route[0].id, wpA.id);
    assert.strictEqual(deconf.route[deconf.route.length - 1].id, wpC.id);

    const val = validateRoute3D(deconf.route, 20, 15, [testBuilding as any, secondBuilding as any], []);
    assert.strictEqual(val.isValid, true);
    assert.strictEqual(val.hasCollision, false);
    assert.strictEqual(val.violations.length, 0);
  });

  // ─── TEST 3: Vertical overflight ──────────────────────────────────────
  it('Test 3: Vertical overflight - climbs to safe altitude, passes above building with clearance, descends safely', () => {
    const overflight = generateVerticalOverflight(wpA, wpB, 20, 15, [testBuilding as any], []);
    assert.ok(overflight !== null);
    assert.strictEqual(overflight.overflightAlt, 50); // 35m height + 15m buffer = 50m

    assert.ok(overflight.waypoints.some((w) => w.id.includes('climb')));
    assert.ok(overflight.waypoints.some((w) => w.id.includes('overflight')));
    assert.ok(overflight.waypoints.some((w) => w.id.includes('descent')));

    assert.strictEqual(overflight.waypoints[overflight.waypoints.length - 1].id, wpB.id);

    const fullRoute = [wpA, ...overflight.waypoints];
    const val = validateRoute3D(fullRoute, 20, 15, [testBuilding as any], []);
    assert.strictEqual(val.isValid, true);
    assert.strictEqual(val.hasCollision, false);
  });

  // ─── TEST 4: Unknown building height ──────────────────────────────────
  it('Test 4: Unknown building height - avoids footprint horizontally and does not assume overflight', () => {
    const unknownHeightBuilding = {
      ...testBuilding,
      id: 'building-unknown-height',
      name: 'Unsurveyed Masonry Structure',
      heightConfidence: 'unknown' as const,
      physicalHeightMeters: undefined,
      heightMeters: 0,
    };

    const overflight = generateVerticalOverflight(wpA, wpB, 20, 15, [unknownHeightBuilding as any], []);
    assert.strictEqual(overflight, null, 'Overflight must be strictly null when building height is unknown');

    const res = rerouteSegmentAroundObstacles(wpA, wpB, 40, 20, [unknownHeightBuilding as any], [], {
      modePreference: 'auto',
    });

    assert.strictEqual(res.isRerouted, true);
    assert.strictEqual(res.avoidanceMode, 'horizontal');

    const minLat = Math.min(...res.coordinates.map((c) => c[1]));
    const maxLat = Math.max(...res.coordinates.map((c) => c[1]));
    const isDetouredAround = minLat < 11.0090 || maxLat > 11.0110;
    assert.strictEqual(isDetouredAround, true, 'Detour must navigate around polygon footprint');
  });

  // ─── TEST 5: Multiple nearby obstacles ────────────────────────────────
  it('Test 5: Multiple nearby obstacles - finds safe passage between or around them', () => {
    const northObstacle = {
      id: 'obs-north-annex',
      name: 'North High-Rise Annex',
      type: 'building' as const,
      heightMeters: 55,
      physicalHeightMeters: 55,
      verticalClearanceBufferMeters: 15,
      safetyBufferMeters: 20,
      heightConfidence: 'verified' as const,
      center: [76.9800, 11.0125] as [number, number],
      coordinates: [
        [76.9780, 11.0105],
        [76.9820, 11.0105],
        [76.9820, 11.0145],
        [76.9780, 11.0145],
        [76.9780, 11.0105],
      ] as [number, number][],
    };

    const res = rerouteSegmentAroundObstacles(wpA, wpB, 40, 18, [testBuilding as any, northObstacle as any], [], {
      modePreference: 'prefer_horizontal',
    });

    assert.strictEqual(res.isRerouted, true);
    assert.strictEqual(res.avoidanceMode, 'horizontal');

    const minLat = Math.min(...res.coordinates.map((c) => c[1]));
    assert.ok(minLat < 11.0090, `Expected route to bypass south (< 11.0090), got ${minLat}`);

    const val = validateRoute3D([wpA, ...res.waypoints], 18, 15, [testBuilding as any, northObstacle as any], []);
    assert.strictEqual(val.isValid, true);
  });

  // ─── TEST 6: Obstacle near destination ────────────────────────────────
  it('Test 6: Obstacle near destination - destination remains unchanged and approach is safe', () => {
    const nearDestBuilding = {
      id: 'building-near-dest',
      name: 'Destination Approach Substation',
      type: 'building' as const,
      heightMeters: 30,
      physicalHeightMeters: 30,
      verticalClearanceBufferMeters: 15,
      safetyBufferMeters: 15,
      heightConfidence: 'verified' as const,
      center: [76.9845, 11.0100] as [number, number],
      coordinates: [
        [76.9835, 11.0095],
        [76.9852, 11.0095],
        [76.9852, 11.0105],
        [76.9835, 11.0105],
        [76.9835, 11.0095],
      ] as [number, number][],
    };

    const res = rerouteSegmentAroundObstacles(wpA, wpB, 40, 15, [nearDestBuilding as any], []);
    assert.strictEqual(res.isRerouted, true);

    const finalWp = res.waypoints[res.waypoints.length - 1];
    assert.strictEqual(finalWp.id, wpB.id);
    assert.strictEqual(finalWp.lat, wpB.lat);
    assert.strictEqual(finalWp.lng, wpB.lng);

    const val = validateRoute3D([wpA, ...res.waypoints], 15, 15, [nearDestBuilding as any], []);
    assert.strictEqual(val.isValid, true);
    assert.strictEqual(val.hasCollision, false);
  });

  // ─── TEST 7: Impossible route ─────────────────────────────────────────
  it('Test 7: Impossible route - rejects route and reports clear warning reason', () => {
    const trappedDestination = {
      id: 'trapped-dest',
      name: 'Vault Center Pad',
      lat: 11.0100,
      lng: 76.9800,
      altitudeMeters: 15,
      type: 'delivery' as const,
      status: 'upcoming' as const,
    };

    const res = rerouteSegmentAroundObstacles(wpA, trappedDestination, 15, 20, [testBuilding as any], []);
    assert.strictEqual(res.isRerouted, false);
    assert.ok(res.warning !== undefined);
    assert.ok(res.warning.includes('No valid route') || res.warning.includes('blocked'));
  });

  // ─── TEST 8: Already-safe route ───────────────────────────────────────
  it('Test 8: Already-safe route - remains completely unchanged', () => {
    const clearWpA = {
      id: 'clear-1',
      name: 'Open Sky Pad 1',
      lat: 11.0200,
      lng: 76.9500,
      altitudeMeters: 65,
      type: 'base' as const,
      status: 'completed' as const,
    };
    const clearWpB = {
      id: 'clear-2',
      name: 'Open Sky Pad 2',
      lat: 11.0250,
      lng: 76.9500,
      altitudeMeters: 65,
      type: 'delivery' as const,
      status: 'upcoming' as const,
    };

    const res = rerouteSegmentAroundObstacles(clearWpA, clearWpB, 65, 20, [testBuilding as any], []);
    assert.strictEqual(res.isRerouted, false);
    assert.strictEqual(res.waypoints.length, 1);
    assert.strictEqual(res.waypoints[0].id, clearWpB.id);
    assert.strictEqual(res.addedDistanceMeters, 0);
  });

  // ─── TEST 9: Complete 3D collision validation ─────────────────────────
  it('Test 9: Complete 3D collision validation - validates climb, cruise, overflight and descent segments', () => {
    const testMission = [
      wpA,
      {
        id: 'wp-climb',
        name: 'Climb Waypoint',
        lat: 11.0100,
        lng: 76.9770,
        altitudeMeters: 55,
        type: 'transit' as const,
        status: 'upcoming' as const,
      },
      {
        id: 'wp-over',
        name: 'Overflight Waypoint',
        lat: 11.0100,
        lng: 76.9800,
        altitudeMeters: 55,
        type: 'transit' as const,
        status: 'upcoming' as const,
      },
      {
        id: 'wp-desc',
        name: 'Descent Waypoint',
        lat: 11.0100,
        lng: 76.9830,
        altitudeMeters: 55,
        type: 'transit' as const,
        status: 'upcoming' as const,
      },
      wpB,
    ];

    const val = validateRoute3D(testMission, 20, 15, [testBuilding as any], []);
    assert.strictEqual(val.isValid, true);
    assert.strictEqual(val.hasCollision, false);
    assert.strictEqual(val.violations.length, 0);
    assert.strictEqual(val.regulatoryCompliant, true);
    assert.ok(val.minVerticalClearanceMeters >= 0);
  });

  // ─── TEST 10: Mission integration ─────────────────────────────────────
  it('Test 10: Mission integration - displayed route and simulation system route are identical in waypoints and altitude', () => {
    const testMissionDef = {
      id: 'MSN-INTEG-01',
      title: 'Autonomous Integration Mission',
      description: 'Tests synchronization between simulation mission controller and 3D map route',
      priority: 'URGENT' as const,
      droneId: 'AV-01',
      droneCallsign: 'DRONE 01',
      status: 'idle' as const,
      currentCheckpointIndex: 0,
      totalDistanceMeters: 1000,
      elapsedTimeSeconds: 0,
      estimatedRemainingSeconds: 60,
      progressPercent: 0,
      checkpoints: [
        {
          id: 'cp-start',
          sequence: 1,
          name: 'Peelamedu North Pad',
          lat: wpA.lat,
          lng: wpA.lng,
          altitudeMeters: 40,
          targetSpeedKmh: 45,
          arrivalRadiusMeters: 8,
          dwellTimeSeconds: 0,
          action: 'takeoff' as const,
          status: 'pending' as const,
        },
        {
          id: 'cp-dest',
          sequence: 2,
          name: 'Gandhipuram East Pad',
          lat: wpB.lat,
          lng: wpB.lng,
          altitudeMeters: 40,
          targetSpeedKmh: 45,
          arrivalRadiusMeters: 8,
          dwellTimeSeconds: 0,
          action: 'drop_payload' as const,
          status: 'pending' as const,
        },
      ],
    };

    const controller = new SimulationMissionController();
    const loadRes = controller.loadMission(testMissionDef, { obstacles: [testBuilding as any], airspaceZones: [] });
    assert.strictEqual(loadRes.success, true);

    const loadedMission = controller.getMission();
    assert.ok(loadedMission !== null);

    const expectedRoute = deconflictWaypointRoute3D(
      testMissionDef.checkpoints.map((cp) => ({
        id: cp.id,
        name: cp.name,
        lat: cp.lat,
        lng: cp.lng,
        altitudeMeters: cp.altitudeMeters,
        type: 'transit' as const,
        status: 'upcoming' as const,
      })),
      40,
      { obstacles: [testBuilding as any], airspaceZones: [] }
    );

    assert.strictEqual(loadedMission.checkpoints.length, expectedRoute.route.length);
    for (let k = 0; k < loadedMission.checkpoints.length; k++) {
      const cp: any = loadedMission.checkpoints[k];
      const wp = expectedRoute.route[k];
      assert.strictEqual(cp.id, wp.id);
      assert.strictEqual(Math.round(cp.lat * 10000), Math.round(wp.lat * 10000));
      assert.strictEqual(Math.round(cp.lng * 10000), Math.round(wp.lng * 10000));
      assert.strictEqual(cp.altitudeMeters, wp.altitudeMeters);
    }
  });
});
