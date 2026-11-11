import { OfficialAirspaceZone } from '../../types/fleet';
import { MetroSector, AirspaceViewport } from './types';
export type { MetroSector } from './types';
import { OFFICIAL_COIMBATORE_AIRSPACE_ZONES } from '../../data/officialAirspaceData';

// ─────────────────────────────────────────────────────────────────────────────
// 1. COIMBATORE METROPOLITAN SECTOR (VOCB / CJB)
// ─────────────────────────────────────────────────────────────────────────────
export const COIMBATORE_METRO_SECTOR: MetroSector = {
  id: 'coimbatore',
  name: 'Coimbatore Metropolitan Sector',
  shortCode: 'CJB',
  state: 'Tamil Nadu',
  center: [76.9558, 11.0168],
  defaultZoom: 12.8,
  bounds: [76.8500, 10.9500, 77.1000, 11.1000],
  primaryAirportIcao: 'VOCB',
  description: 'Coimbatore International Airport (CJB) & Western Ghats UAV corridor',
  zones: OFFICIAL_COIMBATORE_AIRSPACE_ZONES,
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. CHENNAI METROPOLITAN SECTOR (VOMM / MAA & VOTX / TAMBARAM)
// ─────────────────────────────────────────────────────────────────────────────
const CHENNAI_AIRSPACE_ZONES: OfficialAirspaceZone[] = [
  // Red Zone 1: Chennai International Airport (MAA / VOMM)
  {
    id: 'dgca-maa-red-01',
    name: 'Chennai International Airport (VOMM/MAA) Aerodrome Red Zone',
    classification: 'RED',
    sourceTerminology: 'RED ZONE (PROHIBITED - AERODROME SFC TO FL550)',
    coordinates: [
      [80.1450, 12.9750],
      [80.1900, 12.9750],
      [80.2000, 13.0150],
      [80.1550, 13.0200],
      [80.1350, 12.9950],
      [80.1450, 12.9750],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 18000,
    altitudeReference: 'AGL',
    terrainElevationMeters: 16,
    permissionRequired: true,
    permissionAuthority: 'DGCA / Ministry of Civil Aviation / AAI Chennai ATC',
    authorizedDrones: [],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky / AAI Chennai Aerodrome Directive VOMM-AD-01',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: '5 km statutory security perimeter around Runway 07/25 and 12/30 at Meenambakkam. Civilian drone operations strictly prohibited.',
  },
  // Red Zone 2: Tambaram Air Force Base (VOTX)
  {
    id: 'dgca-votx-red-02',
    name: 'IAF Station Tambaram (VOTX) Military Restricted Red Zone',
    classification: 'RED',
    sourceTerminology: 'RED ZONE (MILITARY DEFENSE AERODROME PROHIBITION)',
    coordinates: [
      [80.1000, 12.8900],
      [80.1450, 12.8900],
      [80.1500, 12.9300],
      [80.1050, 12.9350],
      [80.1000, 12.8900],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 18000,
    altitudeReference: 'AGL',
    terrainElevationMeters: 28,
    permissionRequired: true,
    permissionAuthority: 'Indian Air Force / Ministry of Defence / DGCA',
    authorizedDrones: [],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'Ministry of Defence / DGCA Gazette Notification G.S.R. 589(E)',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'IAF Station Tambaram flight operations and pilot training perimeter. Full defense prohibition.',
  },
  // Yellow Zone: Chennai ATC Controlled Approach Buffer (5km - 12km)
  {
    id: 'dgca-maa-yel-01',
    name: 'Chennai Controlled Airspace Buffer (5km-12km ATC Clearance Envelope)',
    classification: 'YELLOW',
    sourceTerminology: 'YELLOW ZONE (CONTROLLED AIRSPACE - ATC CLEARANCE REQUIRED)',
    coordinates: [
      [80.1100, 12.9500],
      [80.2200, 12.9500],
      [80.2400, 13.0500],
      [80.1300, 13.0600],
      [80.0900, 13.0100],
      [80.1100, 12.9500],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 120,
    altitudeReference: 'AGL',
    terrainElevationMeters: 18,
    permissionRequired: true,
    permissionAuthority: 'AAI Chennai Tower / Approach Control (118.5 MHz)',
    authorizedDrones: ['AV-01'],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2028-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky Airspace Map / AAI Chennai Directive',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'Controlled airspace between 5 km and 12 km from Chennai Airport ARP covering Guindy, Porur, Chromepet, and St. Thomas Mount.',
  },
  // Green Zone: OMR IT Expressway Corridor (Tidel Park to Sholinganallur)
  {
    id: 'dgca-che-grn-01',
    name: 'Chennai OMR Technology Corridor Autonomous Flight Green Zone',
    classification: 'GREEN',
    sourceTerminology: 'GREEN ZONE (PERMITTED UP TO 400 FT AGL)',
    coordinates: [
      [80.2250, 12.8700],
      [80.2650, 12.8700],
      [80.2600, 12.9900],
      [80.2200, 12.9900],
      [80.2250, 12.8700],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 120,
    altitudeReference: 'AGL',
    terrainElevationMeters: 12,
    permissionRequired: false,
    permissionAuthority: 'None (Self-declaration up to 120m AGL under Drone Rules 2021)',
    authorizedDrones: ['AV-01', 'AV-02', 'AV-03', 'AV-04'],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky Published Gazette Notification (Drone Rules 2021)',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'Autonomous drone delivery corridor along Rajiv Gandhi Salai (OMR) from Tidel Park to Siruseri IT corridor.',
  },
];

export const CHENNAI_METRO_SECTOR: MetroSector = {
  id: 'chennai',
  name: 'Chennai Metropolitan Sector',
  shortCode: 'MAA',
  state: 'Tamil Nadu',
  center: [80.2200, 12.9900],
  defaultZoom: 12.2,
  bounds: [80.0500, 12.8500, 80.3000, 13.1000],
  primaryAirportIcao: 'VOMM',
  description: 'Chennai International (MAA) & OMR autonomous drone corridor',
  zones: CHENNAI_AIRSPACE_ZONES,
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. BENGALURU METROPOLITAN SECTOR (VOBL / BLR, VOBG / HAL, VOYK / YELAHANKA)
// ─────────────────────────────────────────────────────────────────────────────
const BENGALURU_AIRSPACE_ZONES: OfficialAirspaceZone[] = [
  // Red Zone 1: Kempegowda International Airport (BLR / VOBL)
  {
    id: 'dgca-blr-red-01',
    name: 'Kempegowda International Airport (VOBL/BLR) Aerodrome Red Zone',
    classification: 'RED',
    sourceTerminology: 'RED ZONE (PROHIBITED - DEVANAHALLI AERODROME PERIMETER)',
    coordinates: [
      [77.6700, 13.1700],
      [77.7400, 13.1700],
      [77.7450, 13.2350],
      [77.6750, 13.2350],
      [77.6700, 13.1700],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 18000,
    altitudeReference: 'AGL',
    terrainElevationMeters: 915,
    permissionRequired: true,
    permissionAuthority: 'DGCA / Ministry of Civil Aviation / BIAL Airfield Security',
    authorizedDrones: [],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky / AAI VOBL Aerodrome Directive',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: '5 km aerodrome security buffer surrounding KIA dual runways (09L/27R, 09R/27L) at Devanahalli.',
  },
  // Red Zone 2: HAL Airport (VOBG) & Aerospace Test Facility
  {
    id: 'dgca-vobg-red-02',
    name: 'HAL Airport & Aerospace Test Facility (VOBG) Security Red Zone',
    classification: 'RED',
    sourceTerminology: 'RED ZONE (MILITARY & AEROSPACE FLIGHT TEST PROHIBITION)',
    coordinates: [
      [77.6400, 12.9300],
      [77.6950, 12.9300],
      [77.6950, 12.9750],
      [77.6400, 12.9750],
      [77.6400, 12.9300],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 18000,
    altitudeReference: 'AGL',
    terrainElevationMeters: 888,
    permissionRequired: true,
    permissionAuthority: 'Hindustan Aeronautics Limited / Indian Air Force / DGCA',
    authorizedDrones: [],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'MoD / HAL Flight Operations Security Envelope',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'HAL Aerodrome Runway 09/27 and military flight development test center. Prohibited civilian drone zone.',
  },
  // Yellow Zone: Yelahanka & North Bengaluru Controlled Transit Buffer (5km - 12km)
  {
    id: 'dgca-blr-yel-01',
    name: 'Yelahanka IAF & KIA Controlled Airspace Buffer (5km - 12km ATC)',
    classification: 'YELLOW',
    sourceTerminology: 'YELLOW ZONE (CONTROLLED AIRSPACE - ATC CLEARANCE REQUIRED)',
    coordinates: [
      [77.5600, 13.0800],
      [77.7200, 13.0800],
      [77.7300, 13.1800],
      [77.5700, 13.1800],
      [77.5600, 13.0800],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 120,
    altitudeReference: 'AGL',
    terrainElevationMeters: 900,
    permissionRequired: true,
    permissionAuthority: 'Air Force Station Yelahanka ATC / BIAL Tower',
    authorizedDrones: ['AV-01'],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2028-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky / MoD Indian Air Force Directives',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'Controlled airspace covering Hebbal, Jakkur, Yelahanka, and Kogilu under combined civil/military ATC.',
  },
  // Green Zone: Electronic City & Sarjapur Autonomous Tech Corridor
  {
    id: 'dgca-blr-grn-01',
    name: 'Bengaluru South Tech Corridor (Electronic City - Sarjapur Green Zone)',
    classification: 'GREEN',
    sourceTerminology: 'GREEN ZONE (PERMITTED UP TO 400 FT AGL)',
    coordinates: [
      [77.6400, 12.8200],
      [77.7300, 12.8200],
      [77.7300, 12.9150],
      [77.6400, 12.9150],
      [77.6400, 12.8200],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 120,
    altitudeReference: 'AGL',
    terrainElevationMeters: 910,
    permissionRequired: false,
    permissionAuthority: 'None (Self-declaration & BVLOS compliance under Drone Rules 2021)',
    authorizedDrones: ['AV-01', 'AV-02', 'AV-03', 'AV-04'],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky Gazette Notification (Drone Rules 2021)',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'Autonomous drone operations corridor spanning Electronic City Phase 1 & 2, Bellandur, and Sarjapur Road up to 120m AGL.',
  },
];

export const BENGALURU_METRO_SECTOR: MetroSector = {
  id: 'bengaluru',
  name: 'Bengaluru Metropolitan Sector',
  shortCode: 'BLR',
  state: 'Karnataka',
  center: [77.6400, 12.9700],
  defaultZoom: 11.8,
  bounds: [77.5000, 12.8000, 77.8000, 13.2500],
  primaryAirportIcao: 'VOBL',
  description: 'Kempegowda (BLR), HAL (VOBG), Yelahanka IAF & Electronic City corridor',
  zones: BENGALURU_AIRSPACE_ZONES,
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. DELHI NCR METROPOLITAN SECTOR (VIDP / DEL, VIDD / SAFDARJUNG, VIDX / HINDON)
// ─────────────────────────────────────────────────────────────────────────────
const DELHI_AIRSPACE_ZONES: OfficialAirspaceZone[] = [
  // Red Zone 1: Indira Gandhi International Airport (DEL / VIDP)
  {
    id: 'dgca-del-red-01',
    name: 'Indira Gandhi International Airport (VIDP/DEL) Aerodrome Red Zone',
    classification: 'RED',
    sourceTerminology: 'RED ZONE (PROHIBITED - CATEGORY-A CRITICAL AERODROME)',
    coordinates: [
      [77.0500, 28.5200],
      [77.1400, 28.5200],
      [77.1500, 28.5900],
      [77.0600, 28.5900],
      [77.0500, 28.5200],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 18000,
    altitudeReference: 'AGL',
    terrainElevationMeters: 237,
    permissionRequired: true,
    permissionAuthority: 'DGCA / Ministry of Civil Aviation / DIAL Aerodrome Control',
    authorizedDrones: [],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky / AAI Delhi Aerodrome Directive VIDP-AD-01',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: '5 km perimeter covering Runways 09/27, 10/28, 11/29, and 11L/29R at Palam / IGI. Strictly prohibited for civilian UAVs.',
  },
  // Red Zone 2: Central Vista, Rashtrapati Bhavan & Parliament High-Security Envelope (VIDD)
  {
    id: 'dgca-del-red-02',
    name: 'National Capital Central Vista & VVIP High-Security Red Zone',
    classification: 'RED',
    sourceTerminology: 'RED ZONE (VVIP SPECIAL NO-FLY SECURITY ENVELOPE)',
    coordinates: [
      [77.1850, 28.5950],
      [77.2400, 28.5950],
      [77.2400, 28.6350],
      [77.1850, 28.6350],
      [77.1850, 28.5950],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 18000,
    altitudeReference: 'AGL',
    terrainElevationMeters: 215,
    permissionRequired: true,
    permissionAuthority: 'Ministry of Home Affairs / Special Protection Group (SPG) / DGCA',
    authorizedDrones: [],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'MHA / DGCA Gazette Notification Prohibited Airspace',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'Prohibited airspace covering Rashtrapati Bhavan, Parliament House, Prime Minister Residence, and Safdarjung Aerodrome (VIDD).',
  },
  // Yellow Zone: Delhi NCR Controlled Buffer (Dwarka - Aerocity - Gurugram Border 5-12km)
  {
    id: 'dgca-del-yel-01',
    name: 'Delhi Controlled Airspace Buffer (5km - 12km ATC Authorization)',
    classification: 'YELLOW',
    sourceTerminology: 'YELLOW ZONE (CONTROLLED AIRSPACE - ATC CLEARANCE REQUIRED)',
    coordinates: [
      [77.0100, 28.4800],
      [77.1700, 28.4800],
      [77.1800, 28.6400],
      [77.0200, 28.6400],
      [77.0100, 28.4800],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 120,
    altitudeReference: 'AGL',
    terrainElevationMeters: 230,
    permissionRequired: true,
    permissionAuthority: 'Airports Authority of India (AAI) Delhi Tower (VIDP ATC - 118.1 MHz)',
    authorizedDrones: ['AV-01'],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2028-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky Airspace Map / AAI Delhi Directive',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'Controlled airspace envelope covering Dwarka, Mahipalpur, Aerocity, and DLF Cyber City buffer.',
  },
  // Green Zone: Noida Expressway Urban Drone Corridor (Sector 125 to Sector 144)
  {
    id: 'dgca-del-grn-01',
    name: 'Noida Expressway Urban Drone Corridor (Green Zone)',
    classification: 'GREEN',
    sourceTerminology: 'GREEN ZONE (PERMITTED UP TO 400 FT AGL)',
    coordinates: [
      [77.3300, 28.4800],
      [77.4100, 28.4800],
      [77.3800, 28.5600],
      [77.3000, 28.5600],
      [77.3300, 28.4800],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 120,
    altitudeReference: 'AGL',
    terrainElevationMeters: 200,
    permissionRequired: false,
    permissionAuthority: 'None (Standard BVLOS compliance under Drone Rules 2021)',
    authorizedDrones: ['AV-01', 'AV-02', 'AV-03', 'AV-04'],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky Platform Gazette Notification (Drone Rules 2021)',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'Commercial drone delivery corridor along Noida-Greater Noida Expressway outside controlled aerodrome radius.',
  },
];

export const DELHI_METRO_SECTOR: MetroSector = {
  id: 'delhi',
  name: 'Delhi NCR Metropolitan Sector',
  shortCode: 'DEL',
  state: 'National Capital Region',
  center: [77.1000, 28.5700],
  defaultZoom: 11.5,
  bounds: [76.9500, 28.4200, 77.4500, 28.7000],
  primaryAirportIcao: 'VIDP',
  description: 'IGI Airport (DEL), Central Vista VVIP Red Zone, Hindon IAF & Noida Corridor',
  zones: DELHI_AIRSPACE_ZONES,
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. MUMBAI MMR METROPOLITAN SECTOR (VABB / BOM, VAJJ / JUHU, INS SHIKRA)
// ─────────────────────────────────────────────────────────────────────────────
const MUMBAI_AIRSPACE_ZONES: OfficialAirspaceZone[] = [
  // Red Zone 1: Chhatrapati Shivaji Maharaj International Airport (BOM / VABB)
  {
    id: 'dgca-bom-red-01',
    name: 'CSMI Airport (VABB/BOM) Aerodrome Red Zone',
    classification: 'RED',
    sourceTerminology: 'RED ZONE (PROHIBITED - SANTA CRUZ / SAHAR PERIMETER)',
    coordinates: [
      [72.8450, 19.0750],
      [72.8950, 19.0750],
      [72.9050, 19.1150],
      [72.8550, 19.1150],
      [72.8450, 19.0750],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 18000,
    altitudeReference: 'AGL',
    terrainElevationMeters: 14,
    permissionRequired: true,
    permissionAuthority: 'DGCA / Ministry of Civil Aviation / MIAL Airport Operations',
    authorizedDrones: [],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky / AAI Mumbai Aerodrome Directive VABB-AD-01',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: '5 km perimeter covering Runway 09/27 and 14/32 at Sahar and Santacruz. High-density commercial flight envelope.',
  },
  // Red Zone 2: Juhu Aerodrome (VAJJ) & Helicopter Operations
  {
    id: 'dgca-vajj-red-02',
    name: 'Juhu Aerodrome (VAJJ) Helicopter Operations Red Zone',
    classification: 'RED',
    sourceTerminology: 'RED ZONE (HELICOPTER & GENERAL AVIATION AERODROME PROHIBITION)',
    coordinates: [
      [72.8250, 19.0880],
      [72.8450, 19.0880],
      [72.8450, 19.1100],
      [72.8250, 19.1100],
      [72.8250, 19.0880],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 18000,
    altitudeReference: 'AGL',
    terrainElevationMeters: 4,
    permissionRequired: true,
    permissionAuthority: 'Airports Authority of India (AAI) / ONGC Offshore Aviation / DGCA',
    authorizedDrones: [],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'AAI Juhu Aerodrome Operations Manual',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'Juhu Aerodrome offshore Bombay High helicopter base and General Aviation runway.',
  },
  // Red Zone 3: INS Shikra Naval Air Station & Southern Naval Command Perimeter
  {
    id: 'dgca-bom-red-03',
    name: 'INS Shikra Naval Air Station (Colaba) Defense Red Zone',
    classification: 'RED',
    sourceTerminology: 'RED ZONE (NAVAL DEFENSE AIR BASE PROHIBITION)',
    coordinates: [
      [72.8050, 18.8950],
      [72.8350, 18.8950],
      [72.8350, 18.9250],
      [72.8050, 18.9250],
      [72.8050, 18.8950],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 18000,
    altitudeReference: 'AGL',
    terrainElevationMeters: 6,
    permissionRequired: true,
    permissionAuthority: 'Indian Navy / Western Naval Command / DGCA',
    authorizedDrones: [],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'Ministry of Defence Gazette Notification G.S.R. 589(E)',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'Naval aviation base at Colaba with intensive military ASW and search-and-rescue helicopter movements.',
  },
  // Yellow Zone: Bandra-Kurla Complex (BKC) to Powai Controlled Corridor (5-12km)
  {
    id: 'dgca-bom-yel-01',
    name: 'Mumbai Controlled Airspace Buffer (5km - 12km ATC Clearance Envelope)',
    classification: 'YELLOW',
    sourceTerminology: 'YELLOW ZONE (CONTROLLED AIRSPACE - ATC CLEARANCE REQUIRED)',
    coordinates: [
      [72.8200, 19.0400],
      [72.9300, 19.0400],
      [72.9400, 19.1600],
      [72.8300, 19.1600],
      [72.8200, 19.0400],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 120,
    altitudeReference: 'AGL',
    terrainElevationMeters: 12,
    permissionRequired: true,
    permissionAuthority: 'AAI Mumbai Tower / Approach Radar (118.9 MHz)',
    authorizedDrones: ['AV-01'],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2028-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky / AAI Mumbai Directive',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'Controlled airspace envelope spanning BKC, Kurla, Ghatkopar, and Powai within 12km radius of CSMI Airport.',
  },
  // Green Zone: Navi Mumbai Vashi-Belapur Drone Corridor
  {
    id: 'dgca-bom-grn-01',
    name: 'Navi Mumbai Urban Drone Corridor (Vashi - Belapur Green Zone)',
    classification: 'GREEN',
    sourceTerminology: 'GREEN ZONE (PERMITTED UP TO 400 FT AGL)',
    coordinates: [
      [72.9800, 19.0000],
      [73.0500, 19.0000],
      [73.0500, 19.0700],
      [72.9800, 19.0700],
      [72.9800, 19.0000],
    ],
    lowerAltitudeLimitMeters: 0,
    upperAltitudeLimitMeters: 120,
    altitudeReference: 'AGL',
    terrainElevationMeters: 8,
    permissionRequired: false,
    permissionAuthority: 'None (Standard BVLOS compliance under Drone Rules 2021)',
    authorizedDrones: ['AV-01', 'AV-02', 'AV-03', 'AV-04'],
    effectiveDate: '2021-08-25T00:00:00Z',
    expiryDate: '2030-12-31T23:59:59Z',
    authoritativeSource: 'DGCA Digital Sky Platform Gazette Notification (Drone Rules 2021)',
    lastVerifiedTimestamp: '2026-11-01T08:00:00Z',
    status: 'VERIFIED_ACTIVE',
    description: 'Designated commercial UAV corridor in Navi Mumbai outside the operational radius of CSMI and NMIA.',
  },
];

export const MUMBAI_METRO_SECTOR: MetroSector = {
  id: 'mumbai',
  name: 'Mumbai Metropolitan Region Sector',
  shortCode: 'BOM',
  state: 'Maharashtra',
  center: [72.8777, 19.0760],
  defaultZoom: 11.8,
  bounds: [72.7800, 18.8800, 73.0800, 19.2000],
  primaryAirportIcao: 'VABB',
  description: 'CSMI (BOM), Juhu Aerodrome (VAJJ), INS Shikra & Navi Mumbai Corridor',
  zones: MUMBAI_AIRSPACE_ZONES,
};

// ─────────────────────────────────────────────────────────────────────────────
// ALL METRO SECTORS REGISTRY
// ─────────────────────────────────────────────────────────────────────────────
export const ALL_METRO_SECTORS: MetroSector[] = [
  COIMBATORE_METRO_SECTOR,
  CHENNAI_METRO_SECTOR,
  BENGALURU_METRO_SECTOR,
  DELHI_METRO_SECTOR,
  MUMBAI_METRO_SECTOR,
];

// ─────────────────────────────────────────────────────────────────────────────
// SPATIAL INDEXING & BOUNDING BOX UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export function getZoneBoundingBox(zone: OfficialAirspaceZone): BoundingBox {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of zone.coordinates) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return { minLng, minLat, maxLng, maxLat };
}

export function doBoundingBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.maxLng < b.minLng ||
    a.minLng > b.maxLng ||
    a.maxLat < b.minLat ||
    a.minLat > b.maxLat
  );
}

/**
 * Given a viewport, return all statutory DGCA zones that intersect this viewport.
 * If no statutory sectors intersect, returns an empty array.
 */
export function getStatutoryZonesForBounds(viewport: AirspaceViewport): {
  zones: OfficialAirspaceZone[];
  matchedSectors: MetroSector[];
} {
  const vpBox: BoundingBox = {
    minLng: Math.min(viewport.minLng, viewport.maxLng),
    maxLng: Math.max(viewport.minLng, viewport.maxLng),
    minLat: Math.min(viewport.minLat, viewport.maxLat),
    maxLat: Math.max(viewport.minLat, viewport.maxLat),
  };

  const matchedSectors: MetroSector[] = [];
  const zonesMap = new Map<string, OfficialAirspaceZone>();

  for (const sector of ALL_METRO_SECTORS) {
    const sectorBox: BoundingBox = {
      minLng: sector.bounds[0],
      minLat: sector.bounds[1],
      maxLng: sector.bounds[2],
      maxLat: sector.bounds[3],
    };

    if (doBoundingBoxesOverlap(vpBox, sectorBox)) {
      matchedSectors.push(sector);
      for (const zone of sector.zones) {
        const zoneBox = getZoneBoundingBox(zone);
        if (doBoundingBoxesOverlap(vpBox, zoneBox)) {
          zonesMap.set(zone.id, zone);
        }
      }
    }
  }

  return {
    zones: Array.from(zonesMap.values()),
    matchedSectors,
  };
}

/**
 * Find the primary sector corresponding to a given coordinate.
 */
export function findSectorForCoordinate(lng: number, lat: number): MetroSector | null {
  for (const sector of ALL_METRO_SECTORS) {
    const [minLng, minLat, maxLng, maxLat] = sector.bounds;
    if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
      return sector;
    }
  }
  return null;
}
