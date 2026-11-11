import { OfficialAirspaceZone } from '../../types/fleet';
import {
  AirspaceViewport,
  AirspaceQueryResult,
  AirspaceCoverageStatus,
  AirspaceManagerConfig,
  MetroSector,
} from './types';
import {
  ALL_METRO_SECTORS,
  getStatutoryZonesForBounds,
  findSectorForCoordinate,
} from './nationalRegistry';
import { MapplsAirspaceProvider } from './mapplsProvider';

export class AirspaceManager {
  private config: AirspaceManagerConfig;
  private mapplsProvider: MapplsAirspaceProvider;
  private cache: Map<string, AirspaceQueryResult> = new Map();
  private maxCacheSize: number = 50;
  private debounceTimer: any = null;
  private activeAbortController: AbortController | null = null;
  private lastViewportKey: string = '';

  constructor(config: AirspaceManagerConfig = {}) {
    this.config = {
      debounceMs: 250,
      ...config,
    };
    this.mapplsProvider = new MapplsAirspaceProvider(
      config.mapplsApiKey,
      config.mapplsAccessToken
    );
  }

  /**
   * Quantize viewport coordinates to create a stable cache key
   */
  private getViewportCacheKey(vp: AirspaceViewport): string {
    const qMinLng = Math.round(vp.minLng * 50) / 50;
    const qMinLat = Math.round(vp.minLat * 50) / 50;
    const qMaxLng = Math.round(vp.maxLng * 50) / 50;
    const qMaxLat = Math.round(vp.maxLat * 50) / 50;
    return `${qMinLng},${qMinLat}_${qMaxLng},${qMaxLat}`;
  }

  /**
   * Asynchronous debounced query with request cancellation and caching.
   * Cancels in-flight requests if the viewport changes rapidly (e.g., continuous panning).
   */
  public queryAirspace(
    viewport: AirspaceViewport,
    callback: (result: AirspaceQueryResult) => void
  ): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    const cacheKey = this.getViewportCacheKey(viewport);

    // If already in cache, return immediately
    const cached = this.cache.get(cacheKey);
    if (cached) {
      callback({ ...cached, cached: true });
      return;
    }

    this.debounceTimer = setTimeout(async () => {
      this.activeAbortController = new AbortController();
      const signal = this.activeAbortController.signal;

      try {
        const result = await this.executeAirspaceQuery(viewport, signal);
        
        // Cache result
        this.cache.set(cacheKey, result);
        if (this.cache.size > this.maxCacheSize) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) this.cache.delete(firstKey);
        }

        callback(result);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Request was cancelled by a newer viewport movement; ignore
          return;
        }
        console.error('[AirspaceManager] Error executing query:', err);
      }
    }, this.config.debounceMs);
  }

  /**
   * Synchronous query primarily for immediate inspection, tests, or initial load
   */
  public querySync(viewport: AirspaceViewport): AirspaceQueryResult {
    const cacheKey = this.getViewportCacheKey(viewport);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const result = this.resolveStatutoryCoverage(viewport);
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Execute query with fallback hierarchy:
   * 1. If Mappls is configured and available, try Mappls
   * 2. Otherwise use Statutory National Registry
   * 3. If no coverage in registry, return UNVERIFIED_COVERAGE with honesty
   */
  private async executeAirspaceQuery(
    viewport: AirspaceViewport,
    signal: AbortSignal
  ): Promise<AirspaceQueryResult> {
    // 1. Try remote Mappls if configured
    const mapplsStatus = this.mapplsProvider.getStatus();
    if (mapplsStatus.available) {
      try {
        const remoteZones = await this.mapplsProvider.fetchAirspaceForViewport(viewport, signal);
        if (remoteZones && remoteZones.length > 0) {
          return {
            zones: remoteZones,
            coverageStatus: 'MAPPLS_LIVE',
            provider: 'MAPPLS',
            disclaimer: 'Live airspace data streamed from Mappls (MapmyIndia) Geoanalytics API.',
            lastVerifiedTimestamp: new Date().toISOString(),
          };
        }
      } catch (e: any) {
        if (e.name === 'AbortError') throw e;
        console.warn('[AirspaceManager] Mappls fetch failed, falling back to statutory registry:', e);
      }
    }

    // 2. Resolve using verified statutory national dataset
    return this.resolveStatutoryCoverage(viewport);
  }

  /**
   * Evaluates viewport against national registry.
   * NEVER silently falls back to Coimbatore!
   */
  private resolveStatutoryCoverage(viewport: AirspaceViewport): AirspaceQueryResult {
    const { zones, matchedSectors } = getStatutoryZonesForBounds(viewport);

    // If one or more official metro sectors matched
    if (matchedSectors.length > 0 && zones.length > 0) {
      const primarySector = matchedSectors[0];
      const sectorNames = matchedSectors.map((s) => s.name).join(' / ');
      const sectorIds = matchedSectors.map((s) => s.id).join('-');

      return {
        zones,
        coverageStatus: 'VERIFIED_OFFICIAL',
        sectorName: sectorNames,
        sectorId: sectorIds,
        provider: 'STATUTORY_REGISTRY',
        disclaimer: `Official DGCA Drone Rules 2021 statutory airspace boundaries for ${sectorNames}.`,
        lastVerifiedTimestamp: zones[0]?.lastVerifiedTimestamp || new Date().toISOString(),
      };
    }

    // Check if the center coordinate belongs to a known sector even if bounds are tight
    if (viewport.center) {
      const centerSector = findSectorForCoordinate(viewport.center[0], viewport.center[1]);
      if (centerSector) {
        return {
          zones: centerSector.zones,
          coverageStatus: 'VERIFIED_OFFICIAL',
          sectorName: centerSector.name,
          sectorId: centerSector.id,
          provider: 'STATUTORY_REGISTRY',
          disclaimer: `Official DGCA Drone Rules 2021 statutory airspace boundaries for ${centerSector.name}.`,
          lastVerifiedTimestamp: centerSector.zones[0]?.lastVerifiedTimestamp || new Date().toISOString(),
        };
      }
    }

    // ─── UNMAPPED AIRSPACE SAFETY GUARANTEE ───
    // Critical safety requirement: NEVER pretend unmapped areas are unrestricted green zones
    // or fall back silently to Coimbatore.
    return {
      zones: [],
      coverageStatus: 'UNVERIFIED_COVERAGE',
      provider: 'STATUTORY_REGISTRY',
      disclaimer: 'Unverified Airspace: No authoritative DGCA DigitalSky or Statutory Metro records found for this viewport.',
      warning: 'UNVERIFIED AIRSPACE COVERAGE: Authoritative DGCA DigitalSky data is unavailable for this visible sector. Under DGCA Drone Rules 2021, unverified airspace must NOT be assumed to be unrestricted green zone. Autonomous operations require prior DigitalSky flight permission filing.',
      lastVerifiedTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Clears in-memory cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Retrieve list of all available supported metro sectors
   */
  public getSupportedMetroSectors(): MetroSector[] {
    return ALL_METRO_SECTORS;
  }
}

// Singleton instance for convenient global access across the app
export const globalAirspaceManager = new AirspaceManager();
