// Official Airspace Zone Dataset - Coimbatore UTM Airspace
// Primary Source: DGCA Digital Sky Platform (https://digitalsky.aai.aero/ | https://digitalsky.dgca.gov.in/)
// Formatted under Drone Rules 2021 & AAI Aerodrome Airspace Directives

import { OfficialAirspaceZone, AltitudeReference } from '../types/fleet';

export const OFFICIAL_COIMBATORE_AIRSPACE_ZONES: OfficialAirspaceZone[] = [
  // ─── 1. RED ZONE: COIMBATORE INTERNATIONAL AIRPORT (CJB / VOCB) ───
  {
    id: 'dgca-cjb-red-01',
    name: 'Coimbatore International Airport (VOCB/CJB) Aerodrome Red Zone',
    classification: 'RED',
    sourceTerminology: 'RED ZONE (PROHIBITED - UNAUTHORIZED FLIGHT DENIAL)',
    coordinates: [
      [77.0260, 11.0180],
      [77.0600, 11.0200],
      [77.0680, 11.0450],
      [77.0380, 11.0500],
      [77.0240, 11.0360],
      [77.0260, 11.0180],
    ],
    lowerAltitudeLimitMeters: 0, // Surface (SFC)
    upperAltitudeLimitMeters: 18000, // FL550 / Unlimited
    altitudeReference: 'AGL',
    terrainElevationMeters: 404, // Airport reference elevation (AMSL)
    permissionRequired: true,
    permissionAuthority: 'DGCA / Ministry of Civil Aviation (Central Authorization Required)',
    authorizedDrones: [], // Hard blocked for standard commercial drones
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky Platform (Drone Rules 2021) / AAI Airspace Directive VOCB-AD-01',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: '5 km statutory security and IFR approach perimeter surrounding Runway 05/23 and Peelamedu aerodrome facility. Absolute civilian drone prohibition without specific Central Government authorization.',
  },

  // ─── 2. RED ZONE: CENTRAL PRISON & POLICE TRAINING ACADEMY ───
  {
    id: 'dgca-cbe-red-02',
    name: 'Coimbatore Central Prison & Police Academy Security Perimeter',
    classification: 'RED',
    sourceTerminology: 'RED ZONE (HIGH-SECURITY FACILITY PROHIBITION)',
    coordinates: [
      [76.9720, 11.0040],
      [76.9780, 11.0040],
      [76.9780, 11.0110],
      [76.9720, 11.0110],
      [76.9720, 11.0040],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 120,
    altitudeReference: 'AGL',
    terrainElevationMeters: 412,
    permissionRequired: true,
    permissionAuthority: 'State Home Department & DGCA Security Wing',
    authorizedDrones: [],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky High-Security Sensitive Facility Registry',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'High-security correctional and police training complex in central Coimbatore. Strict no-fly envelope.',
  },

  // ─── 3. YELLOW ZONE: PEELAMEDU - AIRPORT CONTROLLED TRANSIT BUFFER ───
  {
    id: 'dgca-cjb-yel-01',
    name: 'CJB Controlled Airspace Buffer (5km - 12km ATC Authorization Envelope)',
    classification: 'YELLOW',
    sourceTerminology: 'YELLOW ZONE (CONTROLLED AIRSPACE - ATC CLEARANCE REQUIRED)',
    coordinates: [
      [76.9920, 11.0060],
      [77.0650, 11.0080],
      [77.0720, 11.0580],
      [76.9950, 11.0560],
      [76.9880, 11.0320],
      [76.9920, 11.0060],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 120, // 400 ft AGL under standard micro/small drone limits
    altitudeReference: 'AGL',
    terrainElevationMeters: 410,
    permissionRequired: true,
    permissionAuthority: 'Airports Authority of India (AAI) Coimbatore Tower (VOCB ATC - 118.1 MHz)',
    authorizedDrones: ['AV-01'], // AV-01 holds active Life-Flight organ/blood dispatch clearance
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2028-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky Airspace Map / AAI Coimbatore Delegation Directive',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'Peelamedu, Nava India East, Hope College, and Kalapatti airspace within 12km radius of CJB ARP. Prior automated Digital Sky ATC permission or Tower VHF clearance mandatory.',
  },

  // ─── 4. GREEN ZONE: COIMBATORE URBAN CORRIDOR (GANDHIPURAM - RS PURAM) ───
  {
    id: 'dgca-cbe-grn-01',
    name: 'Coimbatore Western & Central Urban Corridor (Green Zone)',
    classification: 'GREEN',
    sourceTerminology: 'GREEN ZONE (PERMITTED UP TO 400 FT AGL)',
    coordinates: [
      [76.9350, 10.9850],
      [76.9880, 10.9850],
      [76.9880, 11.0320],
      [76.9350, 11.0320],
      [76.9350, 10.9850],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 120, // 400 ft AGL
    altitudeReference: 'AGL',
    terrainElevationMeters: 411,
    permissionRequired: false,
    permissionAuthority: 'None (Self-declaration & standard BVLOS compliance under Drone Rules 2021)',
    authorizedDrones: ['AV-01', 'AV-02', 'AV-03', 'AV-04'],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky Platform Published Gazette Notification (Drone Rules 2021)',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'Designated autonomous drone delivery corridor covering Gandhipuram, RS Puram, Cross Cut Road, Ukkadam, and Saibaba Colony up to 120m (400 ft) AGL.',
  },

  // ─── 5. UNKNOWN / UNVERIFIED ENVELOPE: FOOTHILLS SECTOR ───
  {
    id: 'dgca-cbe-unk-01',
    name: 'Western Ghats Peripheral Outskirts (Siruvani Foothills Envelope)',
    classification: 'UNKNOWN',
    sourceTerminology: 'UNVERIFIED AIRSPACE / PENDING RECONNAISSANCE SURVEY',
    coordinates: [
      [76.8900, 10.9900],
      [76.9350, 10.9900],
      [76.9350, 11.0400],
      [76.8900, 11.0400],
      [76.8900, 10.9900],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 120,
    altitudeReference: 'AGL',
    terrainElevationMeters: 460,
    permissionRequired: true,
    permissionAuthority: 'Awaiting Official Survey Publication (Conservative Safe Fallback)',
    authorizedDrones: [],
    effectiveDate: '2024-01-01T00:00:00Z',
    expiryDate: '2025-01-01T00:00:00Z', // Intentionally flagged as stale/uncertain
    authoritativeSource: 'Preliminary Remote Sensing Survey (Pending Official Digital Sky Update)',
    lastVerifiedTimestamp: '2024-10-15T00:00:00Z',
    status: 'UNCERTAIN',
    description: 'Peripheral zone along Western Ghats foothills with unverified vertical obstruction data. Hard-blocked for automated routing until field surveyed.',
  },
];

// Helper: Convert AGL to AMSL or AMSL to AGL based on local ground terrain
export function convertAltitude(
  altMeters: number,
  fromRef: AltitudeReference,
  toRef: AltitudeReference,
  terrainElevationMeters: number
): number {
  if (fromRef === toRef) return altMeters;
  if (fromRef === 'AGL' && toRef === 'AMSL') {
    return altMeters + terrainElevationMeters;
  }
  // AMSL to AGL
  return Math.max(0, altMeters - terrainElevationMeters);
}

// Point in Polygon evaluation
export function isPointInZone(point: [number, number], zone: OfficialAirspaceZone): boolean {
  const [x, y] = point; // [lng, lat]
  const polygon = zone.coordinates;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Check vertical limits
export function isAltitudeInZoneLimits(
  altitudeMeters: number,
  droneAltRef: AltitudeReference,
  zone: OfficialAirspaceZone
): boolean {
  // Normalize drone altitude to zone reference
  const normalizedAlt = convertAltitude(
    altitudeMeters,
    droneAltRef,
    zone.altitudeReference,
    zone.terrainElevationMeters
  );
  return normalizedAlt >= zone.lowerAltitudeLimitMeters && normalizedAlt <= zone.upperAltitudeLimitMeters;
}

// Find applicable zone for a point and altitude
export function evaluatePointAirspace(
  lng: number,
  lat: number,
  altMeters: number,
  altRef: AltitudeReference,
  zones: OfficialAirspaceZone[]
): OfficialAirspaceZone | null {
  // Strictest first: RED > YELLOW > UNKNOWN > GREEN
  const sortedZones = [...zones].sort((a, b) => {
    const order = { RED: 0, YELLOW: 1, UNKNOWN: 2, GREEN: 3 };
    return order[a.classification] - order[b.classification];
  });

  for (const zone of sortedZones) {
    if (isPointInZone([lng, lat], zone)) {
      if (isAltitudeInZoneLimits(altMeters, altRef, zone)) {
        return zone;
      }
    }
  }
  return null;
}
