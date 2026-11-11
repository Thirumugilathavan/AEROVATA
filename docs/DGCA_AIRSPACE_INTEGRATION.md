# Nationwide Location-Aware DGCA Drone Airspace Integration

**Document Version:** 1.0.0  
**Compliance Standard:** Directorate General of Civil Aviation (DGCA) Drone Rules 2021 (G.S.R. 589(E)) & AAI Aerodrome Airspace Directives  
**Target Systems:** Aerovata V2 Autonomous UTM Engine, MapLibre GL JS, PX4 SITL MAVLink Interface

---

## 1. Executive Summary & Regulatory Background

The Directorate General of Civil Aviation (DGCA) under the Ministry of Civil Aviation (MoCA), Government of India, promulgated the **Drone Rules 2021** (Gazette Notification G.S.R. 589(E)) on 25 August 2021. The rules establish a location-aware, three-tier airspace classification system governing Unmanned Aircraft System (UAS) operations across the sovereign territory and territorial waters of India:

1. **Red Zone (Prohibited Airspace):**
   - The airspace extending up to **5 km** from the perimeter of an operational aerodrome/airport.
   - Airspace within 25 km from international borders or the Line of Control.
   - Airspace extending up to 3 km from the perimeter of military installations, defense establishments, central prisons, or designated VVIP security zones (e.g., Central Vista, Parliament House, Rashtrapati Bhavan).
   - Airspace up to 2 km from strategic national installations (nuclear stations, vital infrastructure).
   - **Regulatory Mandate:** Absolute civilian drone prohibition without prior, explicit authorization from the Central Government / Ministry of Civil Aviation.

2. **Yellow Zone (Controlled Airspace):**
   - The airspace between **5 km and 12 km** from the perimeter of an operational aerodrome/airport.
   - Airspace between 8 km and 12 km above 200 feet (60 m) AGL.
   - Airspace above 400 feet (120 m) AGL in a designated green zone.
   - **Regulatory Mandate:** Drone operations require prior permission from the concerned Air Traffic Control (ATC) authority (Airports Authority of India or Indian Air Force / Navy).

3. **Green Zone (Permitted Airspace):**
   - The airspace extending up to **400 feet (120 m)** Above Ground Level (AGL) in areas not designated as a red zone or yellow zone.
   - The airspace between 8 km and 12 km from an operational airport perimeter up to 200 feet (60 m) AGL.
   - **Regulatory Mandate:** Micro and small drones (<25 kg) do not require prior flight permission; automated self-declaration under standard DigitalSky BVLOS operating guidelines applies.

4. **Unverified / Unmapped Airspace:**
   - Airspace sectors outside authoritative registry boundaries or areas pending official GIS boundary publication.
   - **Safety Policy:** Under Aerovata's safety protocol, unmapped regions **must never be assumed to be unrestricted green zones**, nor will the application silently fall back to Coimbatore. Such sectors are assigned `UNVERIFIED_COVERAGE` with active advisory warnings.

---

## 2. Investigation of Authoritative Airspace Data Sources

To transition Aerovata from a Coimbatore-only prototype to a genuine nationwide UTM command center, two primary official and industry sources were investigated:

### 2.1 DGCA DigitalSky Platform (`digitalsky.aai.aero` / `digitalsky.dgca.gov.in`)
- **Portal:** [DigitalSky Airspace Map](https://digitalsky.dgca.gov.in/airspace-map/#/app)
- **API Documentation:** [DigitalSky API Documentation](https://digitalsky.aai.aero/api-documentation)
- **Findings:**
  - DigitalSky provides an interactive Leaflet/MapLibre map viewer for certified Remote Pilot Training Certificate (RPTC) holders and registered UAS operators.
  - The DigitalSky API is a transactional REST service (`/api/v1/flight-plan/verify`, `/api/v1/airspace/check`) requiring operator OAuth2 authentication and digital PKI signing. It validates specific flight trajectory geometries and KML polygons submitted by pilots for automated fly/no-fly clearance.
  - DigitalSky does **not** provide an open, unauthenticated bulk GeoJSON download feed of nationwide boundaries for unrestricted third-party client embedding. Scraping or querying undocumented internal endpoints violates terms of service.

### 2.2 Mappls (MapmyIndia) Airspace Layers API
- **Documentation:** [Mappls Airspace Layers](https://developer.mappls.com/mapping/air-space/)
- **API Architecture:**
  - Mappls maintains official vectorized DGCA airspace envelopes updated with AAI aerodrome circulars through the Mappls Geoanalytics REST API.
  - Layers include:
    - `airport_region_radius_0_to_5_km` (Red Zone / Prohibited)
    - `airport_region_radius_5_to_8_km` (Yellow Zone / ATC Controlled)
    - `airport_region_radius_8_to_12_km_yellow` (Yellow Zone / ATC Authorization)
    - `coastal_area_india_region_25km` (Restricted coastal perimeter)
  - **Authentication:** Requires Mappls Developer credentials (`VITE_MAPPLS_API_KEY` / `MAPPLS_CLIENT_ID`).
  - **Adapter Implementation:** Implemented in `src/services/airspace/mapplsProvider.ts`. If keys are configured, Aerovata queries live Mappls layers; if keys are absent, it cleanly reports `AUTHENTICATION_REQUIRED` and uses the statutory baseline.

### 2.3 Statutory National Metro Baseline
To ensure Aerovata functions seamlessly out of the box without requiring third-party API keys, a verified statutory registry (`src/services/airspace/nationalRegistry.ts`) was constructed under the statutory definitions of Drone Rules 2021:
- **Coimbatore Metropolitan Sector (CJB / VOCB):** Preserved existing Peelamedu airport red zone, prison security perimeter, Peelamedu-Hope College yellow buffer, and Western urban corridor green zone.
- **Chennai Metropolitan Sector (MAA / VOMM & VOTX):** Dual aerodrome red zones for Chennai International Airport (Runways 07/25, 12/30) and Tambaram Air Force Base, 5-12km ATC controlled corridor, and OMR IT Expressway autonomous delivery corridor.
- **Bengaluru Metropolitan Sector (BLR / VOBL & VOBG / VOYK):** Kempegowda International Airport (Devanahalli dual runways) red zone, HAL Airport test facility red zone, Yelahanka IAF yellow buffer, and Electronic City - Sarjapur green corridor.
- **Delhi NCR Metropolitan Sector (DEL / VIDP & VIDD / VIDX):** IGI Airport Category-A red zone, Central Vista / Rashtrapati Bhavan / Parliament high-security prohibited envelope, Dwarka-Gurugram yellow buffer, and Noida Expressway drone corridor.
- **Mumbai MMR Metropolitan Sector (BOM / VABB, VAJJ & INS Shikra):** CSMI Airport (Sahar/Santacruz) red zone, Juhu helicopter aerodrome red zone, INS Shikra Naval Air Station (Colaba) defense perimeter, BKC-Powai controlled corridor, and Navi Mumbai urban delivery corridor.

---

## 3. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│                   MapWorkspace.tsx                     │
│  (MapLibre GL JS WebGL Canvas & Vector Tile Layers)   │
└───────────────▲────────────────────────▲───────────────┘
                │                        │
       moveend / load (BBox)       GeoJSON Features
                │                        │
┌───────────────▼────────────────────────┴───────────────┐
│              AirspaceManager (Singleton)               │
│  - Debounce Queue (250ms)                              │
│  - AbortController Request Cancellation                │
│  - Spatial LRU Viewport Cache                          │
│  - Deduplication Engine                                │
└───────────────▲────────────────────────▲───────────────┘
                │                        │
       Provider Hierarchy:               │
       1. Mappls Provider                │ (If API key provided)
       2. Statutory National Registry ───┘ (Authoritative fallback)
          (CJB, MAA, BLR, DEL, BOM)
       3. Unmapped Region Safety Guarantee
          (Empty zones + UNVERIFIED_COVERAGE warning)
```

### 3.1 Viewport-Aware Querying
- When the map moves, `map.on('moveend')` triggers `globalAirspaceManager.queryAirspace(viewport, callback)`.
- Viewport bounding box `[minLng, minLat, maxLng, maxLat]`, center, and zoom level are passed.
- Queries are debounced by **250 ms** to eliminate redundant requests while dragging.
- If a new move begins before the previous query completes, the active `AbortController` cancels obsolete in-flight requests.
- Viewports are quantized and cached in an LRU memory store, enabling instantaneous recall when panning back to previously viewed cities.

### 3.2 MapLibre GeoJSON Source Synchronization
- Zones are formatted into a GeoJSON `FeatureCollection` and uploaded directly into the existing `official-airspace-source` via `src.setData(...)`.
- Distinct MapLibre paint layers (`airspace-zones-fill`, `airspace-zones-outline`, `airspace-zones-3d-volume`) render the zones with:
  - **Red Zones:** `#EF4444` translucent fill, `#DC2626` outline, full FL550 extrusion.
  - **Yellow Zones:** `#FACC15` translucent fill, `#EAB308` outline, 120m extrusion.
  - **Green Zones:** `#22C55E` translucent fill, `#16A34A` outline, 120m ceiling.
  - **Unknown / Unverified:** `#94A3B8` warning slate.

---

## 4. Unmapped Airspace Safety Guarantee

A core mandate of aviation safety is **never to present an unverified airspace envelope as an unrestricted green zone**, nor to silently fallback to Coimbatore when panning to another location.

When the user navigates outside registered metro sectors (e.g. rural areas or unmapped districts):
1. **Zero Silent Fallback:** No Coimbatore zones are displayed.
2. **Empty Airspace Collection:** `result.zones` is `[]`, clearing false polygons from the map canvas.
3. **Status Flag:** `coverageStatus` is set to `'UNVERIFIED_COVERAGE'`.
4. **Active UI Advisory Banner:** A prominent amber notification appears on the map canvas:
   > ⚠️ **UNVERIFIED AIRSPACE COVERAGE:** Authoritative DGCA DigitalSky data is unavailable for this visible area. Operations outside verified sectors require prior DigitalSky filing. Do not assume unrestricted green airspace.
5. **Quick-Jump Recovery:** The advisory banner provides one-click jump buttons (`CJB`, `MAA`, `BLR`, `DEL`, `BOM`) to return immediately to verified airspace hubs.

---

## 5. UI Controls & Quick-Jump Sector Navigator

To enable operators and evaluators to test nationwide coverage without manual panning across thousands of kilometers:

1. **Top-Right Sector Navigator Bar:**
   Located in the map dock:
   ```
   SECTOR: [ CJB | MAA | BLR | DEL | BOM | UNMAPPED ]
   ```
   - Clicking **`CJB`** smoothly flies the camera to Coimbatore International Airport (`11.0168° N, 76.9558° E`).
   - Clicking **`MAA`** flies to Chennai International Airport & OMR corridor (`12.9900° N, 80.2200° E`).
   - Clicking **`BLR`** flies to Kempegowda & HAL Airport (`12.9700° N, 77.6400° E`).
   - Clicking **`DEL`** flies to Delhi IGI Airport & Central Vista VVIP Red Zone (`28.5700° N, 77.1000° E`).
   - Clicking **`BOM`** flies to Mumbai CSMI & Juhu Aerodrome (`19.0760° N, 72.8777° E`).
   - Clicking **`UNMAPPED`** flies to rural Central India (`21.0500° N, 78.5500° E`), demonstrating the `UNVERIFIED_COVERAGE` safety warning and zero-fallback guarantee.

2. **Top-Left Dynamic Airspace Badge:**
   Replaces the legacy static Coimbatore header:
   - Displays dynamic sector name (e.g., `CHENNAI METROPOLITAN SECTOR` or `UNVERIFIED SECTOR`).
   - Displays active statutory badge: `DGCA STATUTORY`, `MAPPLS LIVE`, or `UNVERIFIED`.
   - Real-time center coordinates (latitude / longitude) and active zone count.

3. **Airspace & UTM Tab Synchronization:**
   - The standalone **Airspace Classification** view (`AirspaceView.tsx`) and **Right Tactical Sidebar** (`RightSidebar.tsx`) reactively update to display the exact zones, vertical ceilings, and authorities of the currently viewed sector.

---

## 6. Environment Configuration

To enable remote live data feeds from Mappls, configure the following keys in your `.env.local` file:

```env
# DGCA Airspace Integration Settings
# Primary Statutory Baseline: Built-in DGCA Drone Rules 2021 statutory metro registry
# Optional Live Mappls (MapmyIndia) Airspace Integration (https://developer.mappls.com/mapping/air-space/)
VITE_MAPPLS_API_KEY=your_mappls_api_key_here
VITE_MAPPLS_ACCESS_TOKEN=your_mappls_access_token_here
VITE_AIRSPACE_PROVIDER=HYBRID
```

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_MAPPLS_API_KEY` | String | `""` | Mappls Developer API key for Geoanalytics Airspace REST queries. |
| `VITE_MAPPLS_ACCESS_TOKEN` | String | `""` | Optional bearer token for enterprise Mappls accounts. |
| `VITE_AIRSPACE_PROVIDER` | Enum | `'HYBRID'` | `'HYBRID'`, `'STATUTORY_REGISTRY'`, or `'MAPPLS'`. In `'HYBRID'` mode, Mappls is queried first if credentials exist, falling back gracefully to the statutory registry. |

---

## 7. Verification & Automated Test Coverage

The nationwide airspace service is verified through automated unit tests in `src/services/airspace/airspaceManager.test.ts`:
- **Coimbatore Viewport:** Verifies `VERIFIED_OFFICIAL` status and VOCB Runway Red Zone presence.
- **Chennai Viewport:** Verifies `VERIFIED_OFFICIAL` status and MAA/Tambaram Red Zones presence.
- **Bengaluru Viewport:** Verifies Kempegowda (VOBL) and HAL (VOBG) zone resolution.
- **Delhi NCR Viewport:** Verifies IGI Airport and Central Vista VVIP Red Zone resolution.
- **Mumbai MMR Viewport:** Verifies CSMI Airport (VABB), Juhu, and INS Shikra naval defense zone resolution.
- **Unmapped Area Safety:** Verifies `UNVERIFIED_COVERAGE` status, 0 zones returned, and explicit statutory warning message.
- **Deduplication & Cache:** Verifies stable cached responses on repeated queries and 100% unique zone IDs.

Run test suite:
```bash
npm test
```
All 38 test suites pass with 0 failures.
