/**
 * API Contract Modal
 * AEROVATA by TASPORA - Mission Architecture Specification
 * 
 * In-app interactive documentation of the REST endpoints, schemas,
 * and request/response contracts for backend integration.
 */

import React, { useState } from 'react';
import { 
  Code, 
  Copy, 
  Check, 
  ExternalLink, 
  Server, 
  ShieldCheck, 
  Layers, 
  Cpu, 
  Globe 
} from 'lucide-react';

interface ApiContractModalProps {
  onClose: () => void;
}

export const ApiContractModal: React.FC<ApiContractModalProps> = ({ onClose }) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('checkpoints');
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-[#0b101c] border border-cyan-500/30 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="h-14 bg-[#0e1627] border-b border-[#1f2d47] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <Code className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white tracking-wide">AEROVATA BACKEND API CONTRACT SPECIFICATION</h3>
              <div className="text-[11px] text-slate-400">RESTful Interface & Schemas for Checkpoint Mission Engine</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 text-xs font-semibold"
          >
            ✕ Close
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation: Endpoint list */}
          <div className="w-72 bg-[#080d17] border-r border-[#1a253a] p-3 overflow-y-auto space-y-1 text-xs">
            <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold px-2 py-1">
              Mission Endpoints
            </div>

            <button
              onClick={() => setSelectedEndpoint('checkpoints')}
              className={`w-full text-left px-2.5 py-2 rounded font-mono text-xs flex items-center justify-between ${
                selectedEndpoint === 'checkpoints' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <span className="font-bold text-emerald-400">GET</span>
              <span className="truncate ml-2">/missions/&#123;id&#125;/checkpoints</span>
            </button>

            <button
              onClick={() => setSelectedEndpoint('status')}
              className={`w-full text-left px-2.5 py-2 rounded font-mono text-xs flex items-center justify-between ${
                selectedEndpoint === 'status' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <span className="font-bold text-emerald-400">GET</span>
              <span className="truncate ml-2">/missions/&#123;id&#125;/status</span>
            </button>

            <button
              onClick={() => setSelectedEndpoint('telemetry')}
              className={`w-full text-left px-2.5 py-2 rounded font-mono text-xs flex items-center justify-between ${
                selectedEndpoint === 'telemetry' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <span className="font-bold text-emerald-400">GET</span>
              <span className="truncate ml-2">/drones/&#123;id&#125;/telemetry</span>
            </button>

            <button
              onClick={() => setSelectedEndpoint('camera')}
              className={`w-full text-left px-2.5 py-2 rounded font-mono text-xs flex items-center justify-between ${
                selectedEndpoint === 'camera' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <span className="font-bold text-emerald-400">GET</span>
              <span className="truncate ml-2">/drones/&#123;id&#125;/camera</span>
            </button>

            <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold px-2 py-1 mt-4">
              Simulation Controls
            </div>

            <button
              onClick={() => setSelectedEndpoint('start')}
              className={`w-full text-left px-2.5 py-2 rounded font-mono text-xs flex items-center justify-between ${
                selectedEndpoint === 'start' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <span className="font-bold text-amber-400">POST</span>
              <span className="truncate ml-2">/simulation/start</span>
            </button>

            <button
              onClick={() => setSelectedEndpoint('pause')}
              className={`w-full text-left px-2.5 py-2 rounded font-mono text-xs flex items-center justify-between ${
                selectedEndpoint === 'pause' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <span className="font-bold text-amber-400">POST</span>
              <span className="truncate ml-2">/simulation/pause</span>
            </button>

            <button
              onClick={() => setSelectedEndpoint('reset')}
              className={`w-full text-left px-2.5 py-2 rounded font-mono text-xs flex items-center justify-between ${
                selectedEndpoint === 'reset' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <span className="font-bold text-amber-400">POST</span>
              <span className="truncate ml-2">/simulation/reset</span>
            </button>
          </div>

          {/* Right Detail Pane */}
          <div className="flex-1 p-5 overflow-y-auto font-sans text-xs space-y-4">
            {selectedEndpoint === 'checkpoints' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono">GET</span>
                  <span className="font-mono text-sm text-white font-bold">/api/v1/missions/&#123;missionId&#125;/checkpoints</span>
                </div>
                <p className="text-slate-400 mb-3">
                  Retrieves the chronological list of checkpoints for the specified mission, including sequences, coordinates, commanded altitudes, speeds, arrival cylinder tolerances, dwell seconds, and actions.
                </p>

                <div className="font-bold text-slate-300 mb-1">Response Schema (200 OK):</div>
                <pre className="p-3 bg-black/60 rounded border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto">
{`{
  "missionId": "MSN-TAS-01",
  "checkpoints": [
    {
      "id": "cp-hosp-01",
      "sequence": 1,
      "name": "Taspora Hub Alpha Pad 1",
      "lat": -37.8155,
      "lng": 145.1220,
      "altitudeMeters": 0,
      "targetSpeedKmh": 42,
      "arrivalRadiusMeters": 8,
      "dwellTimeSeconds": 0,
      "action": "takeoff",
      "status": "reached"
    },
    {
      "id": "cp-hosp-02",
      "sequence": 2,
      "name": "Transit Waypoint Bravo",
      "lat": -37.8138,
      "lng": 145.1238,
      "altitudeMeters": 85,
      "targetSpeedKmh": 50,
      "arrivalRadiusMeters": 10,
      "dwellTimeSeconds": 0,
      "action": "transit",
      "status": "active"
    }
  ]
}`}
                </pre>
              </div>
            )}

            {selectedEndpoint === 'status' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono">GET</span>
                  <span className="font-mono text-sm text-white font-bold">/api/v1/missions/&#123;missionId&#125;/status</span>
                </div>
                <p className="text-slate-400 mb-3">
                  Returns synchronized mission lifecycle state ('idle' | 'running' | 'paused' | 'completed' | 'aborted' | 'error'), progress percentage, and time remaining.
                </p>

                <div className="font-bold text-slate-300 mb-1">Response Schema (200 OK):</div>
                <pre className="p-3 bg-black/60 rounded border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto">
{`{
  "id": "MSN-TAS-01",
  "title": "St. Jude Trauma Hospital Emergency Rapid Response",
  "droneId": "AV-01",
  "status": "running",
  "currentCheckpointIndex": 2,
  "totalDistanceMeters": 2840,
  "elapsedTimeSeconds": 48,
  "estimatedRemainingSeconds": 192,
  "progressPercent": 33,
  "dwellRemainingSeconds": 0
}`}
                </pre>
              </div>
            )}

            {selectedEndpoint === 'telemetry' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono">GET</span>
                  <span className="font-mono text-sm text-white font-bold">/api/v1/drones/&#123;droneId&#125;/telemetry</span>
                </div>
                <p className="text-slate-400 mb-3">
                  Returns sub-second aircraft telemetry broadcast including GPS fixes, battery state of charge, ground speed, heading, and distance to next checkpoint.
                </p>

                <div className="font-bold text-slate-300 mb-1">Response Schema (200 OK):</div>
                <pre className="p-3 bg-black/60 rounded border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto">
{`{
  "droneId": "AV-01",
  "timestamp": 1793751280000,
  "lat": -37.812345,
  "lng": 145.125678,
  "altitudeMeters": 88.0,
  "headingDegrees": 34,
  "groundSpeedKmh": 46.5,
  "verticalSpeedMs": 0.2,
  "batteryPercentage": 88,
  "batteryVoltage": 24.2,
  "signalQualityPercent": 96,
  "rtkFix": "RTK_FIX",
  "satellites": 18,
  "currentCheckpointIndex": 2,
  "distanceToNextCheckpointMeters": 142,
  "missionStatus": "running",
  "isDwellActive": false
}`}
                </pre>
              </div>
            )}

            {selectedEndpoint === 'camera' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono">GET</span>
                  <span className="font-mono text-sm text-white font-bold">/api/v1/drones/&#123;droneId&#125;/camera</span>
                </div>
                <p className="text-slate-400 mb-3">
                  Returns optical camera sensor connection metadata, stream URL, resolution, latency, and simulation disclaimer flags.
                </p>

                <div className="font-bold text-slate-300 mb-1">Response Schema (200 OK):</div>
                <pre className="p-3 bg-black/60 rounded border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto">
{`{
  "droneId": "AV-01",
  "connectionStatus": "FALLBACK_SIMULATION",
  "streamUrl": null,
  "resolution": "1920x1080",
  "fps": 60,
  "latencyMs": 85,
  "codec": "H.264",
  "isSimulated": true,
  "disclaimer": "DEMO VIDEO FALLBACK / SYNTHETIC SENSOR SIMULATION - NOT LIVE FOOTAGE"
}`}
                </pre>
              </div>
            )}

            {selectedEndpoint === 'start' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold font-mono">POST</span>
                  <span className="font-mono text-sm text-white font-bold">/api/v1/simulation/start</span>
                </div>
                <p className="text-slate-400 mb-3">
                  Transitions mission state from 'idle' or 'paused' to 'running'. Begins kinematics tick-loop.
                </p>

                <div className="font-bold text-slate-300 mb-1">Request Body:</div>
                <pre className="p-3 bg-black/60 rounded border border-slate-800 font-mono text-[11px] text-amber-300 overflow-x-auto mb-3">
{`{
  "missionId": "MSN-TAS-01"
}`}
                </pre>

                <div className="font-bold text-slate-300 mb-1">Response (200 OK):</div>
                <pre className="p-3 bg-black/60 rounded border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto">
{`{
  "success": true,
  "state": "running",
  "message": "Simulation started successfully"
}`}
                </pre>
              </div>
            )}

            {selectedEndpoint === 'pause' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold font-mono">POST</span>
                  <span className="font-mono text-sm text-white font-bold">/api/v1/simulation/pause</span>
                </div>
                <p className="text-slate-400 mb-3">
                  Freezes simulated aircraft velocity and trajectory at current fix. State transitions to 'paused'.
                </p>

                <div className="font-bold text-slate-300 mb-1">Request Body:</div>
                <pre className="p-3 bg-black/60 rounded border border-slate-800 font-mono text-[11px] text-amber-300 overflow-x-auto mb-3">
{`{
  "missionId": "MSN-TAS-01"
}`}
                </pre>
              </div>
            )}

            {selectedEndpoint === 'reset' && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold font-mono">POST</span>
                  <span className="font-mono text-sm text-white font-bold">/api/v1/simulation/reset</span>
                </div>
                <p className="text-slate-400 mb-3">
                  Rewinds mission checkpoints to initial state, positions aircraft at checkpoint 1, resets battery and elapsed time.
                </p>

                <div className="font-bold text-slate-300 mb-1">Request Body:</div>
                <pre className="p-3 bg-black/60 rounded border border-slate-800 font-mono text-[11px] text-amber-300 overflow-x-auto mb-3">
{`{
  "missionId": "MSN-TAS-01"
}`}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-12 bg-[#0a0f1b] border-t border-[#1b263b] px-6 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-400">
            Full Markdown documentation available at <span className="font-mono text-cyan-300 font-bold">docs/API_CONTRACT.md</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
