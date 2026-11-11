import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AirspaceManager } from './airspaceManager';
import { AirspaceViewport } from './types';

describe('AirspaceManager (Nationwide DGCA Airspace Service)', () => {
  const manager = new AirspaceManager({ debounceMs: 50 });

  it('correctly resolves Coimbatore Metro Sector when viewing Coimbatore', () => {
    const coimbatoreVp: AirspaceViewport = {
      minLng: 76.90,
      minLat: 10.98,
      maxLng: 77.08,
      maxLat: 11.06,
      center: [76.9558, 11.0168],
      zoom: 12.8,
    };

    const result = manager.querySync(coimbatoreVp);
    assert.strictEqual(result.coverageStatus, 'VERIFIED_OFFICIAL');
    assert.ok(result.sectorName && result.sectorName.includes('Coimbatore'));
    assert.ok(result.zones.length > 0);

    const hasAirportRedZone = result.zones.some(
      (z) => z.classification === 'RED' && z.name.includes('Coimbatore International Airport')
    );
    assert.strictEqual(hasAirportRedZone, true);
  });

  it('correctly resolves Chennai Metro Sector when viewing Chennai (MAA)', () => {
    const chennaiVp: AirspaceViewport = {
      minLng: 80.10,
      minLat: 12.90,
      maxLng: 80.25,
      maxLat: 13.05,
      center: [80.22, 12.99],
      zoom: 12.2,
    };

    const result = manager.querySync(chennaiVp);
    assert.strictEqual(result.coverageStatus, 'VERIFIED_OFFICIAL');
    assert.ok(result.sectorName && result.sectorName.includes('Chennai'));
    assert.ok(result.zones.length > 0);

    const hasMaaRedZone = result.zones.some(
      (z) => z.classification === 'RED' && z.name.includes('Chennai International Airport')
    );
    assert.strictEqual(hasMaaRedZone, true);
  });

  it('correctly resolves Bengaluru Metro Sector when viewing Bengaluru (BLR/HAL)', () => {
    const blrVp: AirspaceViewport = {
      minLng: 77.55,
      minLat: 12.90,
      maxLng: 77.75,
      maxLat: 13.22,
      center: [77.64, 12.97],
      zoom: 11.8,
    };

    const result = manager.querySync(blrVp);
    assert.strictEqual(result.coverageStatus, 'VERIFIED_OFFICIAL');
    assert.ok(result.sectorName && result.sectorName.includes('Bengaluru'));
    assert.ok(result.zones.length > 0);

    const hasBlrRedZone = result.zones.some(
      (z) => z.classification === 'RED' && z.name.includes('Kempegowda')
    );
    assert.strictEqual(hasBlrRedZone, true);
  });

  it('correctly resolves Delhi NCR Sector when viewing Delhi (VIDP/DEL)', () => {
    const delVp: AirspaceViewport = {
      minLng: 77.02,
      minLat: 28.50,
      maxLng: 77.25,
      maxLat: 28.65,
      center: [77.10, 28.57],
      zoom: 11.5,
    };

    const result = manager.querySync(delVp);
    assert.strictEqual(result.coverageStatus, 'VERIFIED_OFFICIAL');
    assert.ok(result.sectorName && result.sectorName.includes('Delhi'));
    assert.ok(result.zones.length > 0);

    const hasIgiRedZone = result.zones.some(
      (z) => z.classification === 'RED' && z.name.includes('Indira Gandhi International Airport')
    );
    assert.strictEqual(hasIgiRedZone, true);
  });

  it('correctly resolves Mumbai MMR Sector when viewing Mumbai (VABB/BOM)', () => {
    const bomVp: AirspaceViewport = {
      minLng: 72.80,
      minLat: 18.90,
      maxLng: 73.05,
      maxLat: 19.18,
      center: [72.8777, 19.076],
      zoom: 11.8,
    };

    const result = manager.querySync(bomVp);
    assert.strictEqual(result.coverageStatus, 'VERIFIED_OFFICIAL');
    assert.ok(result.sectorName && result.sectorName.includes('Mumbai'));
    assert.ok(result.zones.length > 0);

    const hasBomRedZone = result.zones.some(
      (z) => z.classification === 'RED' && z.name.includes('CSMI')
    );
    assert.strictEqual(hasBomRedZone, true);
  });

  it('SAFELY handles unmapped regions: NEVER assumes safe green zone or falls back to Coimbatore', () => {
    // Arbitrary remote point outside any covered metro sector
    const unmappedVp: AirspaceViewport = {
      minLng: 78.50,
      minLat: 21.00,
      maxLng: 78.60,
      maxLat: 21.10,
      center: [78.55, 21.05],
      zoom: 12.0,
    };

    const result = manager.querySync(unmappedVp);
    assert.strictEqual(result.coverageStatus, 'UNVERIFIED_COVERAGE');
    assert.strictEqual(result.zones.length, 0);
    assert.strictEqual(result.sectorName, undefined);
    assert.ok(result.warning);
    assert.ok(result.warning.includes('UNVERIFIED AIRSPACE COVERAGE'));
    assert.ok(result.warning.includes('must NOT be assumed to be unrestricted green'));
  });

  it('deduplicates zones and returns stable cached responses on repeated queries', () => {
    const vp: AirspaceViewport = {
      minLng: 80.12,
      minLat: 12.92,
      maxLng: 80.24,
      maxLat: 13.04,
      center: [80.22, 12.99],
    };

    const res1 = manager.querySync(vp);
    const res2 = manager.querySync(vp);

    assert.strictEqual(res2.cached, true);
    assert.strictEqual(res2.zones.length, res1.zones.length);

    // Verify all zone IDs are strictly unique
    const idSet = new Set(res1.zones.map((z) => z.id));
    assert.strictEqual(idSet.size, res1.zones.length);
  });
});
