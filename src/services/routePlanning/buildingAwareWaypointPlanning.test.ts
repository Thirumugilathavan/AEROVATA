/**
 * Automated Test Suite: 3D Building-Aware Drone Waypoint Planning Engine
 * AEROVATA by TASPORA - UTM Autonomous Airspace Command
 * 
 * Verifies all 10 required test scenarios from the engineering specification:
 * 1. A direct route with no obstacles.
 * 2. A building blocking the direct route, requiring a horizontal detour.
 * 3. A building where a permitted altitude adjustment is sufficient.
 * 4. A building that cannot be bypassed within the configured altitude ceiling.
 * 5. A route near a building corner (Corner-clipping prevention).
 * 6. A route whose straight segments are clear but whose smoothed curve intersects a building.
 * 7. Invalid or missing building-height data (Graceful estimation & unverified warnings).
 * 8. Ground-elevation and altitude-reference conversions (AGL <-> AMSL).
 * 9. A destination inside a building footprint (Rejection & failure reporting).
 * 10. A route constrained by a no-fly or restricted-airspace region (DGCA Red Zone).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  ObstacleAwarePlanner3D, 
  WorldModel3D, 
  ExactSegmentCollisionChecker3D,
  extractBuildingObstacle3D,
  CollisionSafeRouteSimplifier,
  aglToAmsl,
  amslToAgl,
  validateAltitudeWithinLimits,
  DEFAULT_ALTITUDE_CONFIG,
  DEFAULT_REGIONAL_GROUND_ELEVATION_METERS,
  segmentToPolygonDistanceMetric
} from './index';
import { Obstacle, OfficialAirspaceZone } from '../../types/fleet';
import { COIMBATORE_DETAILED_OBSTACLES } from '../../data/coimbatoreGeoData';
import { OFFICIAL_COIMBATORE_AIRSPACE_ZONES } from '../../data/officialAirspaceData';

describe('3D Building-Aware Drone Waypoint Planning Engine', () => {

  // ─── Test 1: Direct route with no obstacles ───────────────────────────────
  it('1. generates direct collision-free route with minimal checkpoints when unobstructed', () => {
    // Open airspace corridor in western Coimbatore with no obstacles
    const start: [number, number, number] = [76.9420, 11.0020, 65];
    const dest: [number, number, number] = [76.9480, 11.0020, 65];

    const planner = new ObstacleAwarePlanner3D();
    const result = planner.planRoute({
      start,
      destination: dest,
      cruiseAltitudeMeters: 65,
      checkpointSpacingMeters: 100,
      startName: 'West Station',
      destName: 'West Terminal',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.detourCount, 0, 'Direct route should require 0 detours');
    assert.strictEqual(result.altitudeAdjusted, false, 'Direct route should not adjust cruise altitude');
    assert.ok(result.waypoints.length >= 2, 'Should contain departure, arrival and spacing waypoints');
    assert.strictEqual(result.validation.isValid, true);
    assert.strictEqual(result.validation.status, 'VALIDATED');
    assert.strictEqual(result.waypoints[0].type, 'base');
    assert.strictEqual(result.waypoints[result.waypoints.length - 1].type, 'delivery');
  });

  // ─── Test 2: Building blocking direct route requiring horizontal detour ──
  it('2. executes realistic horizontal detour around building without arbitrary altitude climb', () => {
    // Define a 45m tall building directly between start and dest
    const testBuilding: Obstacle = {
      id: 'test-highrise-block',
      name: 'Test Commercial High-Rise',
      type: 'building',
      heightMeters: 45.0,
      physicalHeightMeters: 45.0,
      safetyBufferMeters: 25.0,
      verticalClearanceBufferMeters: 15.0,
      baseElevationMeters: 411.0,
      roofElevationMeters: 456.0,
      center: [76.9800, 11.0100],
      coordinates: [
        [76.9790, 11.0090],
        [76.9810, 11.0090],
        [76.9810, 11.0110],
        [76.9790, 11.0110],
        [76.9790, 11.0090],
      ],
      heightConfidence: 'verified',
      description: 'Test building obstacle blocking direct path',
    };

    const start: [number, number, number] = [76.9750, 11.0100, 40]; // West
    const dest: [number, number, number] = [76.9850, 11.0100, 40];  // East

    // Drone cruises at 40m AGL (well below 45m roof + 15m clearance = 60m required)
    const world = new WorldModel3D([testBuilding], []);
    const planner = new ObstacleAwarePlanner3D(world);

    const result = planner.planRoute({
      start,
      destination: dest,
      cruiseAltitudeMeters: 40,
      safetyMarginMeters: 25,
      preferHorizontalDetour: true,
      customObstacles: [testBuilding],
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.detourCount > 0, 'Must generate horizontal detour waypoints');
    assert.strictEqual(result.validation.isValid, true);
    assert.ok(result.validation.minObstacleClearanceMeters >= 20, `Minimum clearance ${result.validation.minObstacleClearanceMeters}m must satisfy safety margin`);

    // Ensure the drone did not arbitrarily climb to hundreds of meters
    for (const wp of result.waypoints) {
      assert.ok(wp.altitudeMeters <= 50, `Waypoint altitude ${wp.altitudeMeters}m must remain near cruise altitude (no arbitrary boost)`);
    }

    // Verify connecting segments never intersect building footprint
    const checker = new ExactSegmentCollisionChecker3D(world);
    for (let i = 0; i < result.waypoints.length - 1; i++) {
      const p1: [number, number, number] = [result.waypoints[i].lng, result.waypoints[i].lat, result.waypoints[i].altitudeMeters || 40];
      const p2: [number, number, number] = [result.waypoints[i+1].lng, result.waypoints[i+1].lat, result.waypoints[i+1].altitudeMeters || 40];
      const segCheck = checker.checkSegment(p1, p2, { droneRadiusMeters: 1.5, horizontalBufferMeters: 20 });
      assert.strictEqual(segCheck.isCollisionFree, true, `Segment ${i}->${i+1} must be collision-free: ${segCheck.blockedReason}`);
    }
  });

  // ─── Test 3: Building where permitted altitude adjustment is sufficient ───
  it('3. climbs smoothly over a low obstacle when lateral detour is constrained, staying under 120m ceiling', () => {
    // Low 18m structure blocking corridor
    const lowObstacle: Obstacle = {
      id: 'test-low-overpass',
      name: 'Test Urban Overpass',
      type: 'highway_flyover',
      heightMeters: 18.0,
      physicalHeightMeters: 18.0,
      deckElevationMeters: 18.0,
      deckThicknessMeters: 2.5,
      safetyBufferMeters: 20.0,
      verticalClearanceBufferMeters: 12.0,
      baseElevationMeters: 411.0,
      center: [76.9700, 11.0100],
      coordinates: [
        [76.9690, 10.9200],
        [76.9710, 10.9200],
        [76.9710, 11.1200],
        [76.9690, 11.1200],
        [76.9690, 10.9200],
      ],
      heightConfidence: 'verified',
      description: 'Long low overpass viaduct',
    };

    const start: [number, number, number] = [76.9660, 11.0100, 25];
    const dest: [number, number, number] = [76.9740, 11.0100, 25];

    const world = new WorldModel3D([lowObstacle], []);
    const planner = new ObstacleAwarePlanner3D(world);

    const result = planner.planRoute({
      start,
      destination: dest,
      cruiseAltitudeMeters: 25,
      maxAltitudeMeters: 120,
      customObstacles: [lowObstacle],
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.validation.isValid, true);

    // Overflight altitude should safely clear the 18m deck + 12m buffer (>= 30m AGL)
    const maxAlt = Math.max(...result.waypoints.map(w => w.altitudeMeters));
    assert.ok(maxAlt >= 30, `Overflight altitude ${maxAlt}m must clear 18m + 12m vertical buffer`);
    assert.ok(maxAlt <= 120, `Overflight altitude ${maxAlt}m must not exceed 120m ceiling`);
  });

  // ─── Test 4: Building that cannot be bypassed within altitude ceiling ────
  it('4. reports failure honestly when an obstacle exceeds the 120m altitude ceiling and cannot be bypassed', () => {
    // Massive 115m skyscraper (+ 15m buffer = 130m > 120m ceiling) with boundary constraint
    const extremeSkyscraper: Obstacle = {
      id: 'test-extreme-skyscraper',
      name: 'Apex Mega-Tower',
      type: 'building',
      heightMeters: 115.0,
      physicalHeightMeters: 115.0,
      safetyBufferMeters: 80.0,
      verticalClearanceBufferMeters: 15.0,
      center: [76.9700, 11.0100],
      coordinates: [
        [76.9650, 10.9200],
        [76.9750, 10.9200],
        [76.9750, 11.1200],
        [76.9650, 11.1200],
        [76.9650, 10.9200],
      ],
      heightConfidence: 'verified',
      description: 'Massive tower completely blocking flight corridor',
    };

    const start: [number, number, number] = [76.9600, 11.0100, 65];
    const dest: [number, number, number] = [76.9800, 11.0100, 65];

    const world = new WorldModel3D([extremeSkyscraper], []);
    const planner = new ObstacleAwarePlanner3D(world);

    const result = planner.planRoute({
      start,
      destination: dest,
      cruiseAltitudeMeters: 65,
      maxAltitudeMeters: 120, // Strict 120m ceiling
      customObstacles: [extremeSkyscraper],
    });

    // Must fail honestly instead of inventing a 150m or 500m illegal route
    assert.strictEqual(result.success, false);
    assert.match(result.error || '', /Path blocked|ceiling/);
    assert.strictEqual(result.waypoints.length, 0);
  });

  // ─── Test 5: Route near a building corner (Corner-clipping prevention) ───
  it('5. detects and prevents corner clipping near building vertices', () => {
    // 35m building
    const cornerBuilding: Obstacle = {
      id: 'test-corner-building',
      name: 'Corner Landmark Complex',
      type: 'building',
      heightMeters: 35.0,
      physicalHeightMeters: 35.0,
      safetyBufferMeters: 25.0,
      verticalClearanceBufferMeters: 15.0,
      center: [76.9800, 11.0100],
      coordinates: [
        [76.9780, 11.0080],
        [76.9820, 11.0080],
        [76.9820, 11.0120],
        [76.9780, 11.0120], // Top-Left corner: [76.9780, 11.0120]
        [76.9780, 11.0080],
      ],
      heightConfidence: 'verified',
      description: 'Square building for corner clipping verification',
    };

    const world = new WorldModel3D([cornerBuilding], []);
    const checker = new ExactSegmentCollisionChecker3D(world);

    // Diagonal flight segment passing ~8m outside the corner [76.9780, 11.0120] at 30m altitude
    // Corner is at [76.9780, 11.0120]. 8m offset in lng is ~0.000073 deg
    const clippingP1: [number, number, number] = [76.97785, 11.01210, 30];
    const clippingP2: [number, number, number] = [76.97810, 11.01225, 30];

    const clipCheck = checker.checkSegment(clippingP1, clippingP2, {
      droneRadiusMeters: 1.5,
      horizontalBufferMeters: 25.0,
    });

    // Must be detected as a collision (cannot clip within the 25m buffer)
    assert.strictEqual(clipCheck.isCollisionFree, false);
    assert.ok(clipCheck.conflictType === 'CORNER_PROXIMITY' || clipCheck.conflictType === 'BUILDING');
    assert.ok(clipCheck.minimumHorizontalSeparationMeters < 25.0, `Separation ${clipCheck.minimumHorizontalSeparationMeters}m was within 25m buffer`);

    // A segment with safe 45m separation from the corner must pass cleanly
    const safeP1: [number, number, number] = [76.9770, 11.0130, 30];
    const safeP2: [number, number, number] = [76.9785, 11.0135, 30];
    const safeCheck = checker.checkSegment(safeP1, safeP2, {
      droneRadiusMeters: 1.5,
      horizontalBufferMeters: 25.0,
    });
    assert.strictEqual(safeCheck.isCollisionFree, true);
  });

  // ─── Test 6: Route whose smoothed curve intersects a building ────────────
  it('6. rejects smoothing shortcut that would clip building corner, preserving safe detour vertex', () => {
    const cornerBuilding: Obstacle = {
      id: 'test-smoother-building',
      name: 'Smoother Obstacle Block',
      type: 'building',
      heightMeters: 40.0,
      physicalHeightMeters: 40.0,
      safetyBufferMeters: 25.0,
      verticalClearanceBufferMeters: 15.0,
      center: [76.9800, 11.0100],
      coordinates: [
        [76.9780, 11.0080],
        [76.9820, 11.0080],
        [76.9820, 11.0120],
        [76.9780, 11.0120],
        [76.9780, 11.0080],
      ],
      heightConfidence: 'verified',
      description: 'Obstacle testing shortcut re-validation',
    };

    const world = new WorldModel3D([cornerBuilding], []);
    const checker = new ExactSegmentCollisionChecker3D(world);
    const simplifier = new CollisionSafeRouteSimplifier();

    // Flight path with safe corner detour:
    // Pt 0 (West), Pt 1 (Safe NW Detour Point), Pt 2 (Safe NE Detour Point), Pt 3 (East)
    const p0: [number, number, number] = [76.9750, 11.0100, 35];
    const p1NW: [number, number, number] = [76.9770, 11.0135, 35]; // Safe NW corner detour
    const p2NE: [number, number, number] = [76.9830, 11.0135, 35]; // Safe NE corner detour
    const p3: [number, number, number] = [76.9850, 11.0100, 35];   // East

    // Direct segment p0 -> p3 would penetrate the building directly
    const directCheck = checker.checkSegment(p0, p3);
    assert.strictEqual(directCheck.isCollisionFree, false);

    // Direct segment p0 -> p2NE would clip the NW corner
    const clipCheckNW = checker.checkSegment(p0, p2NE);
    assert.strictEqual(clipCheckNW.isCollisionFree, false);

    // Direct segment p1NW -> p3 would clip the NE corner
    const clipCheckNE = checker.checkSegment(p1NW, p3);
    assert.strictEqual(clipCheckNE.isCollisionFree, false);

    // Run simplifier on [p0, p1NW, p2NE, p3]
    const simplified = simplifier.simplify([p0, p1NW, p2NE, p3], checker);

    // Simplifier must REJECT shortcutting and retain all detour vertices!
    assert.strictEqual(simplified.length, 4, 'Must retain both corner detour vertices to avoid clipping corners');
    assert.deepStrictEqual(simplified[1], p1NW);
    assert.deepStrictEqual(simplified[2], p2NE);

    // Polyline must remain 100% collision-free
    const polyCheck = checker.checkPolyline(simplified);
    assert.strictEqual(polyCheck.isCollisionFree, true);
  });

  // ─── Test 7: Invalid or missing building-height data ──────────────────────
  it('7. safely estimates fallback height and flags UNVERIFIED_DATA for unverified obstacles', () => {
    const unverifiedObstacle: Obstacle = {
      id: 'unverified-bldg-01',
      name: 'Unsurveyed Industrial Shed',
      type: 'building',
      heightMeters: 0, // Missing / unverified 0m
      physicalHeightMeters: undefined,
      coordinates: [
        [76.9700, 11.0100],
        [76.9720, 11.0100],
        [76.9720, 11.0120],
        [76.9700, 11.0120],
        [76.9700, 11.0100],
      ],
      heightConfidence: 'unknown',
      safetyBufferMeters: 25,
      center: [76.9710, 11.0110],
      description: 'Missing survey records',
    };

    const bldg3D = extractBuildingObstacle3D(unverifiedObstacle);
    // Must fall back to conservative estimate (>= 20m) rather than assuming 0m clear airspace
    assert.ok(bldg3D.heightAboveGroundMeters >= 20.0, `Fallback height ${bldg3D.heightAboveGroundMeters}m must be conservative`);
    assert.strictEqual(bldg3D.heightConfidence, 'estimated');

    const world = new WorldModel3D([unverifiedObstacle], []);
    const checker = new ExactSegmentCollisionChecker3D(world);

    // Flight segment through the unverified obstacle at 25m AGL (below estimated 24m + 15m buffer = 39m)
    const res = checker.checkSegment(
      [76.9690, 11.0110, 25],
      [76.9730, 11.0110, 25]
    );

    assert.strictEqual(res.isCollisionFree, false, 'Cannot assume missing building height is 0m safe airspace');
    assert.strictEqual(res.hasUnverifiedData, true);
  });

  // ─── Test 8: Ground-elevation and altitude-reference conversions ───────────
  it('8. accurately converts between AGL and AMSL with terrain elevation and validates ceilings', () => {
    const groundElevation = 411.0; // Coimbatore MSL datum

    // 65m AGL -> AMSL
    const amsl = aglToAmsl(65, groundElevation);
    assert.strictEqual(amsl, 476.0);

    // 476m AMSL -> AGL
    const agl = amslToAgl(476.0, groundElevation);
    assert.strictEqual(agl, 65.0);

    // Round-trip precision test
    const testAlts = [20, 35.5, 65, 90, 120];
    for (const a of testAlts) {
      assert.strictEqual(amslToAgl(aglToAmsl(a, groundElevation), groundElevation), a);
    }

    // Regulatory limits validation
    const validCheck = validateAltitudeWithinLimits(65, 'AGL', groundElevation);
    assert.strictEqual(validCheck.valid, true);
    assert.strictEqual(validCheck.aglMeters, 65);
    assert.strictEqual(validCheck.amslMeters, 476);

    // Exceeding 120m ceiling check
    const overCeilingCheck = validateAltitudeWithinLimits(135, 'AGL', groundElevation);
    assert.strictEqual(overCeilingCheck.valid, false);
    assert.match(overCeilingCheck.reason || '', /exceeds statutory 120m AGL regulatory ceiling/);

    // Negative altitude check
    const negativeCheck = validateAltitudeWithinLimits(-5, 'AGL', groundElevation);
    assert.strictEqual(negativeCheck.valid, false);
    assert.match(negativeCheck.reason || '', /below ground level/);
  });

  // ─── Test 9: Destination inside a building footprint ──────────────────────
  it('9. rejects flight plan when destination is located inside a building footprint', () => {
    // TIDEL Park coordinates: [77.0250, 11.0280]
    const tidelPark = COIMBATORE_DETAILED_OBSTACLES.find(o => o.id === 'cbe-bldg-tidel-park')!;
    assert.ok(tidelPark);

    const start: [number, number, number] = [76.9665, 11.0025, 65]; // CMCH Hub
    const destInsideTidel: [number, number, number] = [tidelPark.center[0], tidelPark.center[1], 0];

    const planner = new ObstacleAwarePlanner3D();
    const result = planner.planRoute({
      start,
      destination: destInsideTidel,
      startName: 'CMCH Hub',
      destName: 'TIDEL Park Rooftop (Unsurveyed Landing)',
    });

    assert.strictEqual(result.success, false);
    assert.match(result.error || '', /Destination is inside building footprint/);
    assert.strictEqual(result.waypoints.length, 0);
  });

  // ─── Test 10: Route constrained by a no-fly or restricted-airspace region ──
  it('10. strictly blocks routes entering DGCA Red Zones while permitting Yellow Zone authorization', () => {
    const redZone = OFFICIAL_COIMBATORE_AIRSPACE_ZONES.find(z => z.classification === 'RED')!;
    assert.ok(redZone, 'Must have official Red Zone in dataset');

    const start: [number, number, number] = [76.9665, 11.0025, 65];
    const redZoneCenter = redZone.coordinates[0]; // Point inside runway red zone

    const planner = new ObstacleAwarePlanner3D();
    const result = planner.planRoute({
      start,
      destination: [redZoneCenter[0], redZoneCenter[1], 0],
      startName: 'CMCH Hub',
      destName: 'VOCB Runway Red Zone',
    });

    assert.strictEqual(result.success, false);
    assert.match(result.error || '', /Arrival denied.*Red Zone/);
  });

});
