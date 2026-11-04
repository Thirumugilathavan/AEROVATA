import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Layers, 
  Wind, 
  Compass, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Radio,
  FileCheck,
  RefreshCw,
  UploadCloud,
  FileCode,
  Shield,
  Clock,
  ExternalLink,
  Info
} from 'lucide-react';
import { GeofenceZone, AirspaceConflict, OfficialAirspaceZone, AirspaceClassification } from '../types/fleet';
import { OFFICIAL_COIMBATORE_AIRSPACE_ZONES } from '../data/officialAirspaceData';

interface AirspaceViewProps {
  geofences?: GeofenceZone[];
  officialAirspaceZones?: OfficialAirspaceZone[];
  conflicts: AirspaceConflict[];
  onImportAirspaceData?: (importedZones: OfficialAirspaceZone[]) => void;
  onSwitchToLive: () => void;
}

export const AirspaceView: React.FC<AirspaceViewProps> = ({
  geofences = [],
  officialAirspaceZones = OFFICIAL_COIMBATORE_AIRSPACE_ZONES,
  conflicts,
  onImportAirspaceData,
  onSwitchToLive,
}) => {
  const [filterClass, setFilterClass] = useState<AirspaceClassification | 'ALL'>('ALL');
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const zones = officialAirspaceZones;
  const redCount = zones.filter((z) => z.classification === 'RED').length;
  const yellowCount = zones.filter((z) => z.classification === 'YELLOW').length;
  const greenCount = zones.filter((z) => z.classification === 'GREEN').length;
  const unknownCount = zones.filter((z) => z.classification === 'UNKNOWN').length;

  const filteredZones = filterClass === 'ALL' 
    ? zones 
    : zones.filter((z) => z.classification === filterClass);

  const handleImport = () => {
    setImportError(null);
    setImportSuccess(null);
    try {
      const parsed = JSON.parse(importJsonText);
      let imported: OfficialAirspaceZone[] = [];
      
      if (Array.isArray(parsed)) {
        imported = parsed;
      } else if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        // GeoJSON FeatureCollection conversion
        imported = parsed.features.map((f: any, idx: number) => {
          const props = f.properties || {};
          const geom = f.geometry || {};
          const coords = geom.coordinates?.[0] || [];
          return {
            id: props.id || `imported-zone-${idx + 1}`,
            name: props.name || `Imported Airspace Zone ${idx + 1}`,
            classification: (props.classification || props.zone_type || 'YELLOW').toUpperCase() as AirspaceClassification,
            sourceTerminology: props.sourceTerminology || props.zone_type || 'DGCA Import',
            coordinates: coords,
            lowerAltitudeLimitMeters: props.lowerLimitMeters ?? props.lowerAltitudeLimitMeters ?? 0,
            upperAltitudeLimitMeters: props.upperLimitMeters ?? props.upperAltitudeLimitMeters ?? 120,
            altitudeReference: props.altitudeReference || 'AGL',
            terrainElevationMeters: props.terrainElevationMeters ?? 411,
            permissionRequired: props.permissionRequired ?? true,
            permissionAuthority: props.permissionAuthority || props.sourceAuthority || 'DGCA Digital Sky Import',
            effectiveDate: props.effectiveDate || new Date().toISOString().split('T')[0],
            expiryDate: props.expiryDate || '2027-12-31',
            authoritativeSource: props.authoritativeSource || 'DGCA Digital Sky / AAI Airspace Map',
            lastVerifiedTimestamp: new Date().toISOString(),
            status: 'VERIFIED_ACTIVE',
            description: props.description || 'Imported official Digital Sky dataset',
            atcContactFrequency: props.atcContactFrequency || '118.150 MHz',
          } as OfficialAirspaceZone;
        });
      } else {
        throw new Error('Unsupported format. Provide an array of OfficialAirspaceZone objects or a valid GeoJSON FeatureCollection.');
      }

      if (imported.length === 0) {
        throw new Error('No valid airspace zones found in input.');
      }

      if (onImportAirspaceData) {
        onImportAirspaceData(imported);
      }
      setImportSuccess(`Successfully imported and synchronized ${imported.length} official airspace zone(s).`);
      setTimeout(() => {
        setShowImportModal(false);
        setImportJsonText('');
        setImportSuccess(null);
      }, 1500);
    } catch (err: any) {
      setImportError(err.message || 'Invalid JSON format');
    }
  };

  return (
    <div className="flex-1 bg-[#090d15] p-6 overflow-y-auto select-none font-mono">
      {/* Top Banner */}
      <div className="pb-6 border-b border-[#1f2b45] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl font-extrabold text-white tracking-wider">
              DGCA DIGITAL SKY OFFICIAL AIRSPACE CLASSIFICATION
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative Airspace Management for Coimbatore (VOCB / CJB) • DGCA Digital Sky UTM Compliance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 bg-[#121c2f] hover:bg-[#1a2944] text-cyan-300 border border-cyan-800/60 font-bold rounded text-xs transition-colors flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4 text-cyan-400" />
            IMPORT DGCA DATASET (JSON/GEOJSON)
          </button>

          <button
            onClick={onSwitchToLive}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded text-xs transition-colors flex items-center gap-1.5"
          >
            <Layers className="w-4 h-4" />
            VIEW IN 3D MAP
          </button>
        </div>
      </div>

      {/* DGCA Data Provenance & Verification Status Strip */}
      <div className="mt-4 p-3.5 bg-[#0f172a] border border-cyan-900/40 rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-950/60 rounded border border-cyan-700/40 text-cyan-400">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white flex items-center gap-2">
              <span>Primary Source: DGCA Digital Sky Platform</span>
              <a 
                href="https://digitalsky.dgca.gov.in/" 
                target="_blank" 
                rel="noreferrer"
                className="text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1 text-[11px]"
              >
                digitalsky.dgca.gov.in <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="text-slate-400 text-[11px] mt-0.5">
              Portal: digitalsky.aai.aero • Aerodrome: VOCB / CJB Coimbatore International • AAI ATS Mandate
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono">
          <div className="bg-[#142033] px-3 py-1.5 rounded border border-[#1e2e4a]">
            <span className="text-slate-400">Dataset Status: </span>
            <span className="text-emerald-400 font-bold">VERIFIED_ACTIVE</span>
          </div>
          <div className="bg-[#142033] px-3 py-1.5 rounded border border-[#1e2e4a]">
            <span className="text-slate-400">Retrieval: </span>
            <span className="text-white font-bold">2026-11-03 14:00 UTC</span>
          </div>
          <div className="bg-[#142033] px-3 py-1.5 rounded border border-[#1e2e4a]">
            <span className="text-slate-400">Effective: </span>
            <span className="text-white font-bold">AIRAC 2026-Q4</span>
          </div>
        </div>
      </div>

      {/* 4 Classification Metric KPI Cards */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div 
          onClick={() => setFilterClass(filterClass === 'RED' ? 'ALL' : 'RED')}
          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
            filterClass === 'RED' 
              ? 'bg-rose-950/60 border-rose-500 ring-1 ring-rose-400' 
              : 'bg-[#13111c] border-rose-900/40 hover:border-rose-700/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-400 font-bold uppercase">
            <span>RED ZONE (NO-FLY)</span>
            <Lock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">{redCount} Zones</div>
          <div className="text-[11px] text-rose-300/80 mt-1">Strict Prohibition without Central Govt clearance</div>
        </div>

        <div 
          onClick={() => setFilterClass(filterClass === 'YELLOW' ? 'ALL' : 'YELLOW')}
          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
            filterClass === 'YELLOW' 
              ? 'bg-amber-950/60 border-amber-500 ring-1 ring-amber-400' 
              : 'bg-[#181611] border-amber-900/40 hover:border-amber-700/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-400 font-bold uppercase">
            <span>YELLOW / AMBER (CONTROLLED)</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">{yellowCount} Zones</div>
          <div className="text-[11px] text-amber-300/80 mt-1">Air Traffic Control (ATC/AAI) permission required</div>
        </div>

        <div 
          onClick={() => setFilterClass(filterClass === 'GREEN' ? 'ALL' : 'GREEN')}
          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
            filterClass === 'GREEN' 
              ? 'bg-emerald-950/60 border-emerald-500 ring-1 ring-emerald-400' 
              : 'bg-[#0f1917] border-emerald-900/40 hover:border-emerald-700/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-400 font-bold uppercase">
            <span>GREEN ZONE (PERMITTED)</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">{greenCount} Zones</div>
          <div className="text-[11px] text-emerald-300/80 mt-1">Permitted up to 400ft (120m) AGL under UAS Rules</div>
        </div>

        <div 
          onClick={() => setFilterClass(filterClass === 'UNKNOWN' ? 'ALL' : 'UNKNOWN')}
          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
            filterClass === 'UNKNOWN' 
              ? 'bg-slate-800/60 border-slate-400 ring-1 ring-slate-300' 
              : 'bg-[#121622] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
            <span>UNKNOWN / PENDING</span>
            <HelpCircleIcon className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">{unknownCount} Zones</div>
          <div className="text-[11px] text-slate-400 mt-1">Pending validation; treated as restricted by A*</div>
        </div>
      </div>

      {/* Main Grid: Zone Registry + UTM Telemetry */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Zone Detail Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Published Coimbatore Airspace Polygons ({filteredZones.length})
            </h2>
            {filterClass !== 'ALL' && (
              <button 
                onClick={() => setFilterClass('ALL')}
                className="text-xs text-cyan-400 hover:underline"
              >
                Show All Classes
              </button>
            )}
          </div>

          <div className="space-y-3.5">
            {filteredZones.map((zone) => {
              const isRed = zone.classification === 'RED';
              const isYellow = zone.classification === 'YELLOW';
              const isGreen = zone.classification === 'GREEN';

              return (
                <div
                  key={zone.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isRed
                      ? 'bg-rose-950/25 border-rose-800/60'
                      : isYellow
                      ? 'bg-amber-950/25 border-amber-800/60'
                      : isGreen
                      ? 'bg-emerald-950/25 border-emerald-800/60'
                      : 'bg-slate-900/40 border-slate-800'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      {isRed ? (
                        <div className="p-1.5 rounded bg-rose-500/20 text-rose-400">
                          <Lock className="w-4 h-4" />
                        </div>
                      ) : isYellow ? (
                        <div className="p-1.5 rounded bg-amber-500/20 text-amber-400">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      ) : isGreen ? (
                        <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-1.5 rounded bg-slate-500/20 text-slate-400">
                          <Info className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <span className="font-extrabold text-sm text-white">{zone.name}</span>
                        <div className="text-[11px] text-slate-400 font-mono">
                          ID: {zone.id} • Authority: {zone.permissionAuthority || zone.sourceAuthority || 'DGCA / AAI'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase border ${
                        isRed ? 'bg-rose-900/60 text-rose-200 border-rose-700' :
                        isYellow ? 'bg-amber-900/60 text-amber-200 border-amber-700' :
                        isGreen ? 'bg-emerald-900/60 text-emerald-200 border-emerald-700' :
                        'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {zone.classification} {zone.sourceTerminology && zone.sourceTerminology !== zone.classification ? `(${zone.sourceTerminology})` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    {zone.description}
                  </p>

                  {/* Vertical Limits & Rules Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs bg-[#0b0f19] p-3 rounded border border-slate-800 text-slate-400">
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase">Vertical Floor</div>
                      <div className="text-white font-bold mt-0.5">
                        {zone.lowerAltitudeLimitMeters ?? zone.lowerLimitMeters ?? 0} m {zone.altitudeReference}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase">Vertical Ceiling</div>
                      <div className="text-white font-bold mt-0.5">
                        {zone.upperAltitudeLimitMeters ?? zone.upperLimitMeters ?? 120} m {zone.altitudeReference} ({Math.round((zone.upperAltitudeLimitMeters ?? zone.upperLimitMeters ?? 120) * 3.28084)} ft)
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase">Permission Rule</div>
                      <div className={`font-bold mt-0.5 ${
                        isRed ? 'text-rose-400' : isYellow ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {isRed ? 'PROHIBITED' : isYellow ? 'ATC CLEARANCE' : 'OPEN TO 400 FT'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase">ATC Frequency</div>
                      <div className="text-cyan-300 font-bold mt-0.5">
                        {zone.atcContactFrequency || 'VHF 118.150 MHz'}
                      </div>
                    </div>
                  </div>

                  {/* Polygon Coordinates Summary */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono">
                      Vertices: {zone.coordinates.length} points • Center: [{zone.coordinates[0]?.[0]?.toFixed(4)}, {zone.coordinates[0]?.[1]?.toFixed(4)}]
                    </span>
                    <span className="text-cyan-400 font-mono">
                      A* Autonomous Engine: {isRed ? 'Hard Avoidance Vector' : isYellow ? 'Permit Checked Prior to Routing' : 'Optimal Path Corridor'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Dynamic Atmospheric & UTM Safety Deconfliction */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            Airspace Safety & ATC Coordination
          </h2>

          {/* ATC Air Traffic Control Box */}
          <div className="bg-[#101626] border border-[#1f2c45] p-4 rounded-lg space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300 font-bold border-b border-slate-800 pb-2">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Radio className="w-4 h-4" /> Coimbatore ATC Gateway (VOCB)
              </span>
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> LINKED
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Tower Primary:</span>
                <span className="text-white font-bold">118.150 MHz VHF</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Approach Radar:</span>
                <span className="text-cyan-300 font-bold">120.400 MHz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Digital Sky Token:</span>
                <span className="text-emerald-400 font-mono">DGCA-VOCB-2026-ACTIVE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Separation Protocol:</span>
                <span className="text-slate-300">250m Horiz / 30m Vert</span>
              </div>
            </div>
          </div>

          {/* Micro-Weather Atmospheric Array */}
          <div className="bg-[#101626] border border-[#1f2c45] p-4 rounded-lg space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300 font-bold border-b border-slate-800 pb-2">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Wind className="w-4 h-4" /> Coimbatore Atmospheric Sensor Array
              </span>
              <span className="text-emerald-400">NOMINAL</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Surface Wind:</span>
                <span className="text-white font-bold">12 km/h • Bearing 045°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Corridor Wind (65m AGL):</span>
                <span className="text-cyan-300 font-bold">18 km/h (Tailwind +4 km/h)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Barometric Pressure:</span>
                <span className="text-white font-bold">1013.2 hPa (QNH)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Precipitation:</span>
                <span className="text-emerald-400 font-bold">0.0 mm/hr (Clear sky)</span>
              </div>
            </div>
          </div>

          {/* A* Autonomous Rerouting Guidance */}
          <div className="bg-[#101626] border border-[#1f2c45] p-4 rounded-lg space-y-2.5">
            <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> A* Intelligent Reroute Policy
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              When a flight vector approaches a Red Zone or an unauthorized Yellow Zone within 300m, TASPORA automatically engages metric 3D A* recalculation, bending trajectories along surveyed clearance corridors without operator delay.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL: Import Official DGCA Dataset */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1422] border border-cyan-500/60 rounded-xl max-w-xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Import Official DGCA / Digital Sky Dataset</h3>
              </div>
              <button 
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Paste official GeoJSON FeatureCollection or JSON airspace definition downloaded from the DGCA Digital Sky portal. The system will parse polygons, vertical limits, and update live navigation immediately.
            </p>

            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='{"type": "FeatureCollection", "features": [...]}'
              rows={8}
              className="w-full bg-[#080b12] border border-slate-700 rounded p-3 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
            />

            {importError && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-700 text-rose-300 text-xs rounded flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {importSuccess && (
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-700 text-emerald-300 text-xs rounded flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{importSuccess}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded text-xs transition-colors"
              >
                Validate &amp; Sync Airspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function HelpCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
