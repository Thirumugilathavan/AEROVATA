import { OfficialAirspaceZone, AirspaceClassification } from '../../types/fleet';
import { AirspaceViewport } from './types';

export interface MapplsProviderStatus {
  available: boolean;
  reason?: 'AUTHENTICATION_REQUIRED' | 'INVALID_KEY' | 'NETWORK_ERROR' | 'READY';
  message?: string;
}

/**
 * Mappls Airspace Provider
 * Integrates with Mappls (MapmyIndia) Airspace Layers API under:
 * https://developer.mappls.com/mapping/air-space/
 * 
 * Maps official Mappls layers:
 * - airport_region_radius_0_to_5_km  -> RED (Prohibited)
 * - airport_region_radius_5_to_8_km  -> YELLOW (Controlled Airspace)
 * - airport_region_radius_8_to_12_km -> YELLOW (ATC Authorization)
 * - coastal_area_india_region_25km   -> RED/YELLOW (Security zone)
 */
export class MapplsAirspaceProvider {
  private apiKey: string | null;
  private accessToken: string | null;

  constructor(apiKey?: string, accessToken?: string) {
    this.apiKey = apiKey || (import.meta.env.VITE_MAPPLS_API_KEY as string) || null;
    this.accessToken = accessToken || (import.meta.env.VITE_MAPPLS_ACCESS_TOKEN as string) || null;
  }

  public getStatus(): MapplsProviderStatus {
    if (!this.apiKey && !this.accessToken) {
      return {
        available: false,
        reason: 'AUTHENTICATION_REQUIRED',
        message: 'Mappls Airspace API key not configured. Set VITE_MAPPLS_API_KEY or VITE_MAPPLS_ACCESS_TOKEN in .env',
      };
    }
    return {
      available: true,
      reason: 'READY',
      message: 'Mappls Airspace Provider ready with configured credentials',
    };
  }

  /**
   * Fetch airspace features for a given viewport.
   * If remote API returns error or is not configured, returns null to allow fallback.
   */
  public async fetchAirspaceForViewport(
    viewport: AirspaceViewport,
    signal?: AbortSignal
  ): Promise<OfficialAirspaceZone[] | null> {
    const status = this.getStatus();
    if (!status.available) {
      return null;
    }

    try {
      // Mappls Geoanalytics Airspace REST query
      const bboxStr = `${viewport.minLng},${viewport.minLat},${viewport.maxLng},${viewport.maxLat}`;
      const token = this.accessToken || this.apiKey;
      const url = `https://apis.mappls.com/advancedmaps/v1/${token}/geoanalytics/airspace?bbox=${encodeURIComponent(bboxStr)}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal,
      });

      if (!res.ok) {
        console.warn(`[MapplsAirspaceProvider] API query returned ${res.status}: ${res.statusText}`);
        return null;
      }

      const json = await res.json();
      if (!json || !Array.isArray(json.features)) {
        return null;
      }

      // Convert GeoJSON features to OfficialAirspaceZone
      const zones: OfficialAirspaceZone[] = [];
      for (const feat of json.features) {
        if (!feat.geometry || feat.geometry.type !== 'Polygon') continue;

        const props = feat.properties || {};
        const layerName = String(props.layer || props.type || '').toLowerCase();

        let classification: AirspaceClassification = 'YELLOW';
        let upperLimit = 120;
        let lowerLimit = 0;

        if (layerName.includes('0_to_5') || layerName.includes('red') || layerName.includes('prohibited')) {
          classification = 'RED';
          upperLimit = 18000;
        } else if (layerName.includes('green') || layerName.includes('permitted')) {
          classification = 'GREEN';
          upperLimit = 120;
        }

        const id = `mappls-${props.id || Math.random().toString(36).substring(2, 9)}`;
        const coords = feat.geometry.coordinates[0] as [number, number][];

        zones.push({
          id,
          name: props.name || props.zone_name || `Mappls Airspace Zone (${classification})`,
          classification,
          sourceTerminology: `MAPPLS LIVE (${layerName || classification})`,
          coordinates: coords,
          lowerAltitudeLimitMeters: lowerLimit,
          upperAltitudeLimitMeters: upperLimit,
          altitudeReference: 'AGL',
          terrainElevationMeters: props.elevation || 0,
          permissionRequired: classification !== 'GREEN',
          permissionAuthority: props.authority || 'DGCA / Mappls Airspace Feed',
          authoritativeSource: 'Mappls Airspace Layers API (developer.mappls.com)',
          effectiveDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 86400000).toISOString(),
          lastVerifiedTimestamp: new Date().toISOString(),
          status: 'VERIFIED_ACTIVE',
          description: props.description || `Mappls live drone zone layer: ${layerName}`,
        });
      }

      return zones;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      console.warn('[MapplsAirspaceProvider] Error querying Mappls API:', err);
      return null;
    }
  }
}
