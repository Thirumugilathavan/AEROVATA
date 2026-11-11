import { OfficialAirspaceZone, AirspaceClassification } from '../../types/fleet';

export interface AirspaceViewport {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom?: number;
  center?: [number, number];
}

export type AirspaceProviderType = 
  | 'STATUTORY_REGISTRY' 
  | 'MAPPLS' 
  | 'DIGITALSKY' 
  | 'HYBRID';

export type AirspaceCoverageStatus = 
  | 'VERIFIED_OFFICIAL'
  | 'MAPPLS_LIVE'
  | 'UNVERIFIED_COVERAGE'
  | 'AUTHENTICATION_REQUIRED'
  | 'NETWORK_ERROR';

export interface MetroSector {
  id: string;
  name: string;
  shortCode: string;
  state: string;
  center: [number, number]; // [lng, lat]
  defaultZoom: number;
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  primaryAirportIcao: string;
  description: string;
  zones: OfficialAirspaceZone[];
}

export interface AirspaceQueryResult {
  zones: OfficialAirspaceZone[];
  coverageStatus: AirspaceCoverageStatus;
  sectorName?: string;
  sectorId?: string;
  provider: AirspaceProviderType;
  disclaimer: string;
  lastVerifiedTimestamp: string;
  warning?: string;
  cached?: boolean;
}

export interface AirspaceManagerConfig {
  provider?: AirspaceProviderType;
  mapplsApiKey?: string;
  mapplsAccessToken?: string;
  debounceMs?: number;
}
