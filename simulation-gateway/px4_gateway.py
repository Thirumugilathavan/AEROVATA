"""
PX4 SITL & Gazebo MAVLink Gateway Service & Unified FastAPI Backend
AEROVATA by TASPORA - Autonomous Drone Delivery Command Center

Unified Backend Service serving:
1. REST API (http://localhost:8000/api/v1) for missions, vehicles, telemetry, health, and simulation controls.
2. Real-time WebSocket (ws://localhost:8000/api/v1/ws/telemetry and /ws/telemetry) streaming 10Hz telemetry.
3. Configurable MAVLink Bridge receiving telemetry from PX4 Autopilot SITL over UDP (default 14550 / 14540).
4. Realistic MAVLink heartbeat state machine & multi-vehicle tracking.
"""

from __future__ import annotations

import argparse
import asyncio
import enum
import json
import logging
import math
import os
import queue
import socket
import sys
import threading
import time
from typing import Any, Dict, List, Optional, Set, Union

try:
    from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Body, Query, status
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse, StreamingResponse, Response
    import uvicorn
    from pymavlink import mavutil
    from pymavlink.dialects.v20 import common as mavlink2
    from PIL import Image, ImageDraw
    import io
except ImportError as e:
    sys.stderr.write(f"Missing dependency: {e}\nRun: pip install pymavlink fastapi uvicorn websockets\n")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("px4_gateway")

# ─── ENUMS & CONSTANTS ───────────────────────────────────────────────────────

class Px4ConnectionState(str, enum.Enum):
    NOT_CONFIGURED = "NOT_CONFIGURED"
    STARTING_SIMULATOR = "STARTING_SIMULATOR"
    WAITING_FOR_GAZEBO = "WAITING_FOR_GAZEBO"
    WAITING_FOR_PX4 = "WAITING_FOR_PX4"
    WAITING_FOR_MAVLINK_HEARTBEAT = "WAITING_FOR_MAVLINK_HEARTBEAT"
    CONNECTED = "CONNECTED"
    TELEMETRY_STALE = "TELEMETRY_STALE"
    DISCONNECTED = "DISCONNECTED"
    CONNECTION_ERROR = "CONNECTION_ERROR"

DEFAULT_HTTP_PORT = int(os.environ.get("PORT", os.environ.get("HTTP_PORT", "8000")))
DEFAULT_MAVLINK_PORT = os.environ.get("MAVLINK_PORT", "udpin:0.0.0.0:14550")
DEFAULT_HEARTBEAT_TIMEOUT = 3.5  # Seconds before marking telemetry STALE
DEFAULT_DISCONNECT_TIMEOUT = 7.0 # Seconds before marking vehicle DISCONNECTED

app = FastAPI(
    title="AEROVATA Drone Command Center Backend & PX4 SITL Gateway",
    description="Unified REST & WebSocket Backend for TASPORA Autonomous Drone Delivery & PX4 Autopilot SITL",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── VEHICLE STATE CONTAINER ────────────────────────────────────────────────

class VehicleState:
    def __init__(self, system_id: int = 1, component_id: int = 1, callsign: str = "AV-01") -> None:
        self.lock = threading.RLock()
        self.system_id: int = system_id
        self.component_id: int = component_id
        self.callsign: str = callsign
        self.connected: bool = False
        self.last_heartbeat_time: float = 0.0
        self.last_telemetry_time: float = 0.0
        self.autopilot_type: str = "PX4 Autopilot (SITL)"
        self.vehicle_type: str = "x500 Quadrotor"
        self.armed: bool = False
        self.flight_mode: str = "DISCONNECTED"
        self.landed_state: str = "ON_GROUND"

        # Position and Kinematics (Default Coimbatore Hub)
        self.latitude: float = 11.02580
        self.longitude: float = 77.01155
        self.altitude_msl_m: float = 432.0
        self.relative_altitude_m: float = 0.0
        self.heading_degrees: float = 45.0
        self.groundspeed_kmh: float = 0.0
        self.vertical_speed_ms: float = 0.0
        self.roll_deg: float = 0.0
        self.pitch_deg: float = 0.0
        self.yaw_deg: float = 0.0

        # Health & Battery
        self.battery_percentage: float = 100.0
        self.battery_voltage_v: float = 24.8
        self.battery_current_a: float = 0.0
        self.satellites_visible: int = 18
        self.gps_fix_type: str = "RTK_FIX"

        # Mission Progress
        self.current_waypoint_seq: int = 0
        self.mission_count: int = 0
        self.mission_state: str = "idle" # idle | running | paused | completed | error
        self.is_dwell_active: bool = False
        self.last_status_text: str = ""

    def update_heartbeat(self, msg: Any) -> None:
        with self.lock:
            self.connected = True
            now = time.time()
            self.last_heartbeat_time = now
            self.last_telemetry_time = now
            self.armed = bool(msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED)
            if msg.autopilot == mavutil.mavlink.MAV_AUTOPILOT_PX4:
                self.autopilot_type = "PX4 Autopilot (SITL)"
            else:
                self.autopilot_type = f"Autopilot({msg.autopilot})"

            if msg.type == mavutil.mavlink.MAV_TYPE_QUADROTOR:
                self.vehicle_type = "x500 Quadrotor"
            elif msg.type == mavutil.mavlink.MAV_TYPE_HEXAROTOR:
                self.vehicle_type = "x650 Hexacopter"
            else:
                self.vehicle_type = f"MAV_TYPE({msg.type})"

            self.flight_mode = self._decode_px4_mode(msg.custom_mode)

    def _decode_px4_mode(self, custom_mode: int) -> str:
        main_mode = (custom_mode >> 16) & 0xFF
        sub_mode = (custom_mode >> 24) & 0xFF
        modes = {
            1: "MANUAL",
            2: "ALTCTL",
            3: "POSCTL",
            4: {
                1: "AUTO.READY",
                2: "AUTO.TAKEOFF",
                3: "AUTO.LOITER",
                4: "AUTO.MISSION",
                5: "AUTO.RTL",
                6: "AUTO.LAND",
                7: "AUTO.RTGS",
                8: "AUTO.FOLLOW",
            },
            5: "ACRO",
            6: "OFFBOARD",
            7: "STABILIZED",
            8: "RATTITUDE",
        }
        res = modes.get(main_mode, "UNKNOWN")
        if isinstance(res, dict):
            return res.get(sub_mode, f"AUTO({sub_mode})")
        return str(res)

    def check_staleness(self) -> str:
        with self.lock:
            if not self.connected:
                return "UNAVAILABLE"
            age = time.time() - self.last_heartbeat_time
            if age > DEFAULT_DISCONNECT_TIMEOUT:
                self.connected = False
                self.flight_mode = "DISCONNECTED"
                return "UNAVAILABLE"
            elif age > DEFAULT_HEARTBEAT_TIMEOUT:
                return "STALE"
            return "LIVE"

    def to_dict(self) -> Dict[str, Any]:
        with self.lock:
            status_str = self.check_staleness()
            return {
                "droneId": self.callsign,
                "systemId": self.system_id,
                "componentId": self.component_id,
                "timestamp": int(time.time() * 1000),
                "connected": self.connected,
                "telemetryStatus": status_str,
                "armed": self.armed,
                "flightMode": self.flight_mode,
                "autopilot": self.autopilot_type,
                "vehicle": self.vehicle_type,
                "lat": self.latitude,
                "lng": self.longitude,
                "altitudeMeters": round(self.relative_altitude_m, 1),
                "altitudeMslMeters": round(self.altitude_msl_m, 1),
                "headingDegrees": round(self.heading_degrees),
                "groundSpeedKmh": round(self.groundspeed_kmh, 1),
                "verticalSpeedMs": round(self.vertical_speed_ms, 1),
                "rollDeg": round(self.roll_deg, 1),
                "pitchDeg": round(self.pitch_deg, 1),
                "yawDeg": round(self.yaw_deg, 1),
                "batteryPercentage": round(self.battery_percentage, 1),
                "batteryVoltage": round(self.battery_voltage_v, 1),
                "batteryCurrent": round(self.battery_current_a, 1),
                "signalQualityPercent": 99 if self.connected else 0,
                "rtkFix": self.gps_fix_type if self.connected else "SEARCHING",
                "satellites": self.satellites_visible if self.connected else 0,
                "currentCheckpointIndex": self.current_waypoint_seq,
                "missionStatus": self.mission_state if self.connected else "error",
                "isDwellActive": self.is_dwell_active,
                "lastStatusText": self.last_status_text,
                "heartbeatAgeSec": round(time.time() - self.last_heartbeat_time, 2) if self.last_heartbeat_time > 0 else None,
            }

# ─── GLOBAL FLEET & GATEWAY MANAGER ──────────────────────────────────────────

class GatewayManager:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.vehicles: Dict[int, VehicleState] = {
            1: VehicleState(1, 1, "AV-01"),
            2: VehicleState(2, 1, "AV-02"),
            3: VehicleState(3, 1, "AV-03"),
            4: VehicleState(4, 1, "AV-04"),
        }
        self.primary_sysid: int = 1
        self.connection_state: Px4ConnectionState = Px4ConnectionState.NOT_CONFIGURED
        self.connection_reason: str = "Initialized. Awaiting MAVLink socket binding."
        self.connection_str: str = DEFAULT_MAVLINK_PORT
        self.http_port: int = DEFAULT_HTTP_PORT
        self.simulation_mode: str = "px4"  # 'px4' or 'mock'
        self.mavlink_socket_bound: bool = False
        self.active_missions: Dict[str, Dict[str, Any]] = self._init_preset_missions()
        self.harness_active: bool = False
        self.harness_thread: Optional[threading.Thread] = None

    def _init_preset_missions(self) -> Dict[str, Dict[str, Any]]:
        return {
            "MSN-CBE-01": {
                "id": "MSN-CBE-01",
                "name": "Coimbatore CMCH Trauma Center Rapid Blood Corridor",
                "droneId": "AV-01",
                "droneCallsign": "DRONE 01 (AV-01)",
                "status": "idle",
                "currentCheckpointIndex": 0,
                "checkpoints": [
                    {
                        "id": "cp-cbe-01",
                        "sequence": 0,
                        "name": "Peelamedu Transit Depot (Origin Pad)",
                        "lat": 11.02580,
                        "lng": 77.01155,
                        "altitudeMeters": 0,
                        "targetSpeedKmh": 35,
                        "arrivalRadiusMeters": 6,
                        "dwellTimeSeconds": 0,
                        "action": "takeoff",
                        "status": "reached"
                    },
                    {
                        "id": "cp-cbe-02",
                        "sequence": 1,
                        "name": "Nava India Sky Corridor",
                        "lat": 11.02050,
                        "lng": 76.99400,
                        "altitudeMeters": 65,
                        "targetSpeedKmh": 48,
                        "arrivalRadiusMeters": 8,
                        "dwellTimeSeconds": 0,
                        "action": "transit",
                        "status": "active"
                    },
                    {
                        "id": "cp-cbe-03",
                        "sequence": 2,
                        "name": "Lakshmi Mills Overfly Corridor",
                        "lat": 11.01520,
                        "lng": 76.98100,
                        "altitudeMeters": 65,
                        "targetSpeedKmh": 45,
                        "arrivalRadiusMeters": 8,
                        "dwellTimeSeconds": 2,
                        "action": "hover_inspect",
                        "status": "pending"
                    },
                    {
                        "id": "cp-cbe-04",
                        "sequence": 3,
                        "name": "GKNM Hospital Helipad Approach",
                        "lat": 11.01280,
                        "lng": 76.97450,
                        "altitudeMeters": 45,
                        "targetSpeedKmh": 30,
                        "arrivalRadiusMeters": 6,
                        "dwellTimeSeconds": 0,
                        "action": "transit",
                        "status": "pending"
                    },
                    {
                        "id": "cp-cbe-05",
                        "sequence": 4,
                        "name": "CMCH Master Trauma Helipad (Destination)",
                        "lat": 11.00280,
                        "lng": 76.96580,
                        "altitudeMeters": 0,
                        "targetSpeedKmh": 20,
                        "arrivalRadiusMeters": 5,
                        "dwellTimeSeconds": 0,
                        "action": "land",
                        "status": "pending"
                    }
                ]
            },
            "MSN-CBE-02": {
                "id": "MSN-CBE-02",
                "name": "TIDEL Park IT SEZ STAT Medical Cargo Corridor",
                "droneId": "AV-02",
                "droneCallsign": "DRONE 02 (AV-02)",
                "status": "idle",
                "currentCheckpointIndex": 0,
                "checkpoints": [
                    {
                        "id": "cp-tp-01",
                        "sequence": 0,
                        "name": "Gandhipuram Central Diagnostic Hub Pad",
                        "lat": 11.01808,
                        "lng": 76.96844,
                        "altitudeMeters": 0,
                        "targetSpeedKmh": 30,
                        "arrivalRadiusMeters": 5,
                        "dwellTimeSeconds": 0,
                        "action": "takeoff",
                        "status": "reached"
                    },
                    {
                        "id": "cp-tp-02",
                        "sequence": 1,
                        "name": "Avarampalayam High Viaduct Clearance",
                        "lat": 11.02650,
                        "lng": 76.98200,
                        "altitudeMeters": 60,
                        "targetSpeedKmh": 45,
                        "arrivalRadiusMeters": 8,
                        "dwellTimeSeconds": 0,
                        "action": "transit",
                        "status": "pending"
                    },
                    {
                        "id": "cp-tp-03",
                        "sequence": 2,
                        "name": "TIDEL Park IT SEZ Med-Dock Helipad",
                        "lat": 11.02980,
                        "lng": 77.02550,
                        "altitudeMeters": 0,
                        "targetSpeedKmh": 25,
                        "arrivalRadiusMeters": 5,
                        "dwellTimeSeconds": 0,
                        "action": "land",
                        "status": "pending"
                    }
                ]
            }
        }

    def get_vehicle(self, sysid: int) -> VehicleState:
        with self.lock:
            if sysid not in self.vehicles:
                self.vehicles[sysid] = VehicleState(sysid, 1, f"AV-0{sysid}" if sysid <= 9 else f"AV-{sysid}")
            return self.vehicles[sysid]

    def get_primary_vehicle(self) -> VehicleState:
        return self.get_vehicle(self.primary_sysid)

    def get_vehicle_by_identifier(self, identifier: str) -> VehicleState:
        with self.lock:
            clean = identifier.upper().replace("DRONE ", "").replace("DRONE", "").strip()
            for v in self.vehicles.values():
                if v.callsign.upper() == clean or v.callsign.upper() == identifier.upper():
                    return v
                if f"AV-0{v.system_id}" == clean or f"AV-{v.system_id}" == clean:
                    return v
            try:
                sysid = int(clean)
                return self.get_vehicle(sysid)
            except ValueError:
                pass
            return self.get_primary_vehicle()

    def update_connection_state(self) -> None:
        with self.lock:
            pv = self.vehicles.get(self.primary_sysid)
            if not self.mavlink_socket_bound:
                self.connection_state = Px4ConnectionState.CONNECTION_ERROR
                return

            if pv and pv.connected:
                age = time.time() - pv.last_heartbeat_time
                if age > DEFAULT_DISCONNECT_TIMEOUT:
                    self.connection_state = Px4ConnectionState.DISCONNECTED
                    self.connection_reason = f"PX4 heartbeat timeout ({age:.1f}s > {DEFAULT_DISCONNECT_TIMEOUT}s). Autopilot disconnected."
                elif age > DEFAULT_HEARTBEAT_TIMEOUT:
                    self.connection_state = Px4ConnectionState.TELEMETRY_STALE
                    self.connection_reason = f"PX4 telemetry is stale (last heartbeat {age:.1f}s ago)."
                else:
                    self.connection_state = Px4ConnectionState.CONNECTED
                    self.connection_reason = f"PX4 Autopilot SITL is live and transmitting MAVLink heartbeats on {self.connection_str} (SysID: {pv.system_id})."
            else:
                self.connection_state = Px4ConnectionState.WAITING_FOR_MAVLINK_HEARTBEAT
                self.connection_reason = f"MAVLink socket bound on {self.connection_str}. Awaiting MAVLink HEARTBEAT from PX4 SITL / Gazebo."

gateway_mgr = GatewayManager()

# ─── ROBUST MAVLINK BRIDGE ───────────────────────────────────────────────────

class MavlinkBridge:
    def __init__(self, connection_str: str) -> None:
        self.connection_str = connection_str
        self.mav: Optional[mavutil.mavfile] = None
        self.running: bool = False
        self.thread: Optional[threading.Thread] = None
        self.mission_msg_queue: queue.Queue = queue.Queue()

    def start(self) -> None:
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True, name="MavlinkBridgeThread")
        self.thread.start()
        logger.info(f"MAVLink bridge thread started with target: {self.connection_str}")

    def stop(self) -> None:
        self.running = False
        if self.mav:
            try:
                self.mav.close()
            except Exception:
                pass

    def _connect(self) -> None:
        while self.running:
            try:
                logger.info(f"Attempting to bind MAVLink socket on {self.connection_str}...")
                self.mav = mavutil.mavlink_connection(self.connection_str, autoreconnect=True)
                gateway_mgr.mavlink_socket_bound = True
                gateway_mgr.connection_str = self.connection_str
                gateway_mgr.update_connection_state()
                logger.info(f"MAVLink socket successfully bound on {self.connection_str}!")
                return
            except Exception as e:
                gateway_mgr.mavlink_socket_bound = False
                gateway_mgr.connection_state = Px4ConnectionState.CONNECTION_ERROR
                gateway_mgr.connection_reason = f"Failed to bind MAVLink socket ({self.connection_str}): {e}. Check if port is in use."
                logger.error(f"Failed to bind MAVLink socket: {e}. Retrying in 2.5s...")
                time.sleep(2.5)

    def _run(self) -> None:
        self._connect()
        while self.running:
            if not self.mav:
                time.sleep(0.5)
                continue

            try:
                msg = self.mav.recv_match(blocking=True, timeout=1.0)
                gateway_mgr.update_connection_state()

                if not msg:
                    continue

                msg_type = msg.get_type()
                sys_id = msg.get_srcSystem()

                # Ignore GCS echoes (SysID 255)
                if sys_id == 255:
                    continue

                vehicle = gateway_mgr.get_vehicle(sys_id)

                if msg_type == "HEARTBEAT":
                    vehicle.update_heartbeat(msg)
                    gateway_mgr.update_connection_state()

                elif msg_type == "GLOBAL_POSITION_INT":
                    with vehicle.lock:
                        vehicle.latitude = msg.lat / 1e7
                        vehicle.longitude = msg.lon / 1e7
                        vehicle.altitude_msl_m = msg.alt / 1000.0
                        vehicle.relative_altitude_m = max(0.0, msg.relative_alt / 1000.0)
                        if msg.hdg != 65535:
                            vehicle.heading_degrees = msg.hdg / 100.0
                        v_horiz = math.sqrt(msg.vx * msg.vx + msg.vy * msg.vy) / 100.0
                        vehicle.groundspeed_kmh = v_horiz * 3.6
                        vehicle.vertical_speed_ms = -msg.vz / 100.0
                        vehicle.last_telemetry_time = time.time()

                elif msg_type == "ATTITUDE":
                    with vehicle.lock:
                        vehicle.roll_deg = math.degrees(msg.roll)
                        vehicle.pitch_deg = math.degrees(msg.pitch)
                        vehicle.yaw_deg = math.degrees(msg.yaw)

                elif msg_type == "VFR_HUD":
                    with vehicle.lock:
                        if msg.heading >= 0:
                            vehicle.heading_degrees = float(msg.heading)
                        if msg.groundspeed >= 0:
                            vehicle.groundspeed_kmh = float(msg.groundspeed) * 3.6
                        vehicle.vertical_speed_ms = float(msg.climb)

                elif msg_type == "GPS_RAW_INT":
                    with vehicle.lock:
                        vehicle.satellites_visible = msg.satellites_visible
                        fix_names = {0: "NO_GPS", 1: "NO_FIX", 2: "2D_FIX", 3: "3D_FIX", 4: "DGPS", 5: "RTK_FLOAT", 6: "RTK_FIX"}
                        vehicle.gps_fix_type = fix_names.get(msg.fix_type, f"FIX_{msg.fix_type}")

                elif msg_type == "SYS_STATUS":
                    with vehicle.lock:
                        if msg.battery_remaining != -1:
                            vehicle.battery_percentage = float(msg.battery_remaining)
                        if msg.voltage_battery != 65535:
                            vehicle.battery_voltage_v = msg.voltage_battery / 1000.0
                        if msg.current_battery != -1:
                            vehicle.battery_current_a = msg.current_battery / 100.0

                elif msg_type == "EXTENDED_SYS_STATE":
                    landed_names = {0: "UNDEFINED", 1: "ON_GROUND", 2: "IN_AIR", 3: "TAKEOFF", 4: "LANDING"}
                    with vehicle.lock:
                        vehicle.landed_state = landed_names.get(msg.landed_state, "UNKNOWN")

                elif msg_type == "MISSION_CURRENT":
                    with vehicle.lock:
                        vehicle.current_waypoint_seq = msg.seq

                elif msg_type == "MISSION_ITEM_REACHED":
                    with vehicle.lock:
                        logger.info(f"Vehicle SysID {sys_id} reached checkpoint sequence #{msg.seq}")
                        if msg.seq >= vehicle.mission_count - 1 and vehicle.mission_count > 0:
                            vehicle.mission_state = "completed"

                elif msg_type == "STATUSTEXT":
                    text = msg.text
                    if isinstance(text, bytes):
                        text = text.decode("utf-8", errors="ignore")
                    logger.info(f"PX4 STATUSTEXT [{msg.severity}]: {text}")
                    with vehicle.lock:
                        vehicle.last_status_text = text

                elif msg_type in ("MISSION_REQUEST_INT", "MISSION_REQUEST", "MISSION_ACK", "COMMAND_ACK"):
                    self.mission_msg_queue.put(msg)

            except Exception as e:
                logger.error(f"Exception in MAVLink reader loop: {e}")
                time.sleep(0.5)

    def upload_mission(self, checkpoints: List[Dict[str, Any]], sysid: int = 1) -> Dict[str, Any]:
        vehicle = gateway_mgr.get_vehicle(sysid)
        if not self.mav or not vehicle.connected:
            return {
                "success": False,
                "error": f"PX4 SITL (SysID: {sysid}) is not connected. Awaiting autopilot heartbeat."
            }

        count = len(checkpoints)
        if count < 2:
            return {"success": False, "error": "Mission requires at least 2 checkpoints"}

        with vehicle.lock:
            vehicle.mission_count = count
            vehicle.mission_state = "idle"

        logger.info(f"Initiating MAVLink mission upload ({count} items) to PX4 SysID {sysid}...")

        # Clear queue
        while not self.mission_msg_queue.empty():
            try:
                self.mission_msg_queue.get_nowait()
            except queue.Empty:
                break

        # Send MISSION_COUNT
        self.mav.mav.mission_count_send(
            vehicle.system_id,
            vehicle.component_id,
            count,
            mavutil.mavlink.MAV_MISSION_TYPE_MISSION,
        )

        last_uploaded_seq = -1
        start_time = time.time()
        while time.time() - start_time < 12.0:
            try:
                msg = self.mission_msg_queue.get(timeout=2.0)
            except queue.Empty:
                break

            msg_type = msg.get_type()
            if msg_type in ("MISSION_REQUEST_INT", "MISSION_REQUEST"):
                seq = msg.seq
                if seq < count:
                    cp = checkpoints[seq]
                    cmd = 16 # MAV_CMD_NAV_WAYPOINT
                    p1 = float(cp.get("holdTimeSeconds", cp.get("dwellTimeSeconds", 0.0)))
                    p2 = float(cp.get("arrivalRadiusMeters", 6.0))
                    p3 = 0.0
                    p4 = float("nan")

                    if cp.get("action") == "takeoff" or seq == 0:
                        cmd = 22 # MAV_CMD_NAV_TAKEOFF
                        p1 = 0.0
                    elif cp.get("action") == "land" or seq == count - 1:
                        cmd = 21 # MAV_CMD_NAV_LAND
                        p1 = 0.0

                    lat_val = float(cp.get("latitude", cp.get("lat", 0.0)))
                    lng_val = float(cp.get("longitude", cp.get("lng", 0.0)))
                    lat_int = int(round(lat_val * 1e7))
                    lon_int = int(round(lng_val * 1e7))
                    alt_m = float(cp.get("altitudeMeters", 60.0))
                    if cmd == 21:
                        alt_m = 0.0

                    self.mav.mav.mission_item_int_send(
                        vehicle.system_id,
                        vehicle.component_id,
                        seq,
                        mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
                        cmd,
                        1 if seq == 0 else 0,
                        1,
                        p1,
                        p2,
                        p3,
                        p4,
                        lat_int,
                        lon_int,
                        alt_m,
                        mavutil.mavlink.MAV_MISSION_TYPE_MISSION,
                    )
                    last_uploaded_seq = seq

            elif msg_type == "MISSION_ACK":
                ack_type = msg.type
                if last_uploaded_seq >= count - 1:
                    if ack_type == mavutil.mavlink.MAV_MISSION_ACCEPTED:
                        logger.info(f"PX4 SysID {sysid} successfully accepted mission ({count} items)!")
                        return {"success": True, "count": count, "message": "Mission accepted by PX4 Autopilot"}
                    else:
                        logger.error(f"PX4 rejected mission with code: {ack_type}")
                        return {"success": False, "error": f"PX4 rejected mission with ACK code {ack_type}"}

        return {"success": False, "error": "Mission upload timed out waiting for PX4 ACK"}

    def arm_and_start(self, sysid: int = 1) -> Dict[str, Any]:
        vehicle = gateway_mgr.get_vehicle(sysid)
        if not self.mav or not vehicle.connected:
            return {"success": False, "error": f"PX4 SITL (SysID: {sysid}) is not connected"}

        # 1. Mode AUTO.MISSION
        self.mav.mav.command_long_send(
            vehicle.system_id,
            vehicle.component_id,
            mavutil.mavlink.MAV_CMD_DO_SET_MODE,
            0,
            mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
            4, 4, 0, 0, 0, 0,
        )
        time.sleep(0.2)

        # 2. Arm
        self.mav.mav.command_long_send(
            vehicle.system_id,
            vehicle.component_id,
            mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
            0,
            1, 0, 0, 0, 0, 0, 0,
        )
        time.sleep(0.2)

        # 3. Mission Start
        self.mav.mav.command_long_send(
            vehicle.system_id,
            vehicle.component_id,
            mavutil.mavlink.MAV_CMD_MISSION_START,
            0,
            0, 0, 0, 0, 0, 0, 0,
        )

        with vehicle.lock:
            vehicle.mission_state = "running"

        return {"success": True, "state": "running", "message": f"PX4 SysID {sysid} armed and commanded AUTO.MISSION"}

    def pause(self, sysid: int = 1) -> Dict[str, Any]:
        vehicle = gateway_mgr.get_vehicle(sysid)
        if not self.mav or not vehicle.connected:
            return {"success": False, "error": f"PX4 SITL (SysID: {sysid}) is not connected"}

        self.mav.mav.command_long_send(
            vehicle.system_id,
            vehicle.component_id,
            mavutil.mavlink.MAV_CMD_DO_SET_MODE,
            0,
            mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
            4, 3, 0, 0, 0, 0, # AUTO.LOITER
        )
        with vehicle.lock:
            vehicle.mission_state = "paused"

        return {"success": True, "state": "paused", "message": f"PX4 SysID {sysid} commanded AUTO.LOITER hold"}

    def return_to_launch(self, sysid: int = 1) -> Dict[str, Any]:
        vehicle = gateway_mgr.get_vehicle(sysid)
        if not self.mav or not vehicle.connected:
            return {"success": False, "error": f"PX4 SITL (SysID: {sysid}) is not connected"}

        self.mav.mav.command_long_send(
            vehicle.system_id,
            vehicle.component_id,
            mavutil.mavlink.MAV_CMD_DO_SET_MODE,
            0,
            mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
            4, 5, 0, 0, 0, 0, # AUTO.RTL
        )
        return {"success": True, "message": f"PX4 SysID {sysid} commanded Return-to-Launch"}

mavlink_bridge: Optional[MavlinkBridge] = None

# ─── HIGH-FIDELITY IN-PROCESS MAVLINK SITL TEST HARNESS ──────────────────────

def run_test_harness(port: int = 14550) -> None:
    """
    High-fidelity PX4 MAVLink transmitter. Sends genuine MAVLink v2.0 packets
    over UDP 127.0.0.1:14550 along the Coimbatore mission corridor.
    Used for automated verification and end-to-end dashboard testing.
    """
    logger.info(f"Starting in-process PX4 SITL test harness transmitting to UDP 127.0.0.1:{port}...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setblocking(False)
    mav = mavlink2.MAVLink(None, srcSystem=1, srcComponent=1)

    # Peelamedu origin corridor
    lat = 11.02580
    lng = 77.01155
    alt = 0.0
    hdg = 24600  # 246 deg in cdeg
    t = 0.0
    armed = True
    mode_auto = (4 << 16) | (4 << 24)

    while gateway_mgr.harness_active:
        t += 0.2
        try:
            # 1. HEARTBEAT
            hb = mav.heartbeat_encode(
                mavutil.mavlink.MAV_TYPE_QUADROTOR,
                mavutil.mavlink.MAV_AUTOPILOT_PX4,
                mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED if armed else 0,
                mode_auto,
                mavutil.mavlink.MAV_STATE_ACTIVE,
            )
            sock.sendto(hb.pack(mav), ("127.0.0.1", port))

            # Move along Coimbatore flight corridor
            if alt < 65.0:
                alt = min(65.0, alt + 2.5)
            lat += -0.000018 * 0.9
            lng += -0.000018 * 1.4

            # 2. GLOBAL_POSITION_INT
            pos = mav.global_position_int_encode(
                int(time.time() * 1000) & 0xFFFFFFFF,
                int(lat * 1e7),
                int(lng * 1e7),
                int((alt + 432.0) * 1000),
                int(alt * 1000),
                int(-12.5 * 100),
                int(-8.5 * 100),
                int(0.0),
                hdg,
            )
            sock.sendto(pos.pack(mav), ("127.0.0.1", port))

            # 3. ATTITUDE
            att = mav.attitude_encode(
                int(time.time() * 1000) & 0xFFFFFFFF,
                math.radians(1.5 * math.sin(t)),
                math.radians(-2.5),
                math.radians(246.0),
                0.0, 0.0, 0.0,
            )
            sock.sendto(att.pack(mav), ("127.0.0.1", port))

            # 4. SYS_STATUS
            sys_st = mav.sys_status_encode(
                0, 0, 0, 500, 24600, -1, 94, 0, 0, 0, 0, 0, 0
            )
            sock.sendto(sys_st.pack(mav), ("127.0.0.1", port))

            # 5. GPS_RAW_INT
            gps_msg = mav.gps_raw_int_encode(
                int(time.time() * 1000) & 0xFFFFFFFF,
                6, # RTK_FIX
                int(lat * 1e7),
                int(lng * 1e7),
                int((alt + 432.0) * 1000),
                100, 100, 4800, 24600, 21,
            )
            sock.sendto(gps_msg.pack(mav), ("127.0.0.1", port))

            # 6. MISSION_CURRENT
            mc = mav.mission_current_encode(1)
            sock.sendto(mc.pack(mav), ("127.0.0.1", port))

        except Exception as e:
            logger.error(f"Error in test harness sender: {e}")

        time.sleep(0.2)

# ─── REST ENDPOINTS (PRIORITY 4 & 1) ─────────────────────────────────────────

@app.get("/health")
@app.get("/api/v1/health")
async def get_health() -> Dict[str, Any]:
    gateway_mgr.update_connection_state()
    pv = gateway_mgr.get_primary_vehicle()
    tel_status = pv.check_staleness()

    return {
        "status": "ok",
        "backend_version": "1.0.0",
        "api_status": "CONNECTED",
        "px4_gateway_status": "LISTENING" if gateway_mgr.mavlink_socket_bound else "ERROR",
        "mavlink_connection_status": gateway_mgr.connection_state.value,
        "connection_state": gateway_mgr.connection_state.value,
        "connection_reason": gateway_mgr.connection_reason,
        "gazebo_status": "RUNNING" if pv.connected else "STANDALONE",
        "simulation_mode": gateway_mgr.simulation_mode,
        "telemetry_status": tel_status,
        "udp_port": 14550,
        "udp_host": "0.0.0.0",
        "connected_vehicles_count": sum(1 for v in gateway_mgr.vehicles.values() if v.connected),
        "primary_vehicle_id": pv.callsign,
        "last_heartbeat_timestamp": pv.last_heartbeat_time if pv.last_heartbeat_time > 0 else None,
        "last_heartbeat_age_sec": round(time.time() - pv.last_heartbeat_time, 2) if pv.last_heartbeat_time > 0 else None,
        "test_harness_active": gateway_mgr.harness_active,
    }

@app.get("/api/v1/system/status")
async def get_system_status() -> Dict[str, Any]:
    gateway_mgr.update_connection_state()
    pv = gateway_mgr.get_primary_vehicle()
    return {
        "connected": pv.connected,
        "state": gateway_mgr.connection_state.value,
        "reason": gateway_mgr.connection_reason,
        "primarySysId": pv.system_id,
        "flightMode": pv.flight_mode,
        "armed": pv.armed,
        "activeMissions": len(gateway_mgr.active_missions),
        "totalVehicles": len(gateway_mgr.vehicles),
        "simulationMode": gateway_mgr.simulation_mode,
    }

@app.get("/api/v1/vehicles")
async def get_all_vehicles() -> List[Dict[str, Any]]:
    return [v.to_dict() for v in gateway_mgr.vehicles.values()]

@app.get("/api/v1/vehicles/{vehicle_id}")
async def get_vehicle_by_id(vehicle_id: str) -> Dict[str, Any]:
    # Match by callsign (AV-01) or sysid
    for v in gateway_mgr.vehicles.values():
        if v.callsign.lower() == vehicle_id.lower() or str(v.system_id) == vehicle_id:
            return v.to_dict()
    raise HTTPException(status_code=404, detail=f"Vehicle '{vehicle_id}' not found")

@app.get("/api/v1/vehicles/{vehicle_id}/telemetry")
@app.get("/api/v1/drones/{vehicle_id}/telemetry")
async def get_vehicle_telemetry(vehicle_id: str) -> Dict[str, Any]:
    for v in gateway_mgr.vehicles.values():
        if v.callsign.lower() == vehicle_id.lower() or str(v.system_id) == vehicle_id:
            return v.to_dict()
    # Fallback to primary vehicle
    return gateway_mgr.get_primary_vehicle().to_dict()

@app.get("/api/v1/drones/{drone_id}/camera")
async def get_drone_camera_metadata(drone_id: str) -> Dict[str, Any]:
    pv = gateway_mgr.get_primary_vehicle()
    veh = gateway_mgr.get_vehicle_by_identifier(drone_id)
    return {
        "droneId": veh.callsign,
        "status": "fallback" if not (veh.connected or gateway_mgr.harness_active) else "active",
        "streamUrl": f"http://localhost:8000/api/v1/drones/{veh.callsign}/stream",
        "snapshotUrl": f"http://localhost:8000/api/v1/drones/{veh.callsign}/snapshot",
        "resolution": "1920x1080",
        "frameRateFps": 30,
        "syntheticOverlay": True,
        "opticalGimbalLocked": True,
        "cameraType": "EO_IR_GIMBAL_4K",
        "telemetry": veh.to_dict(),
    }

DRONE_CORRIDORS = {
    "AV-01": {"origin": "Peelamedu Depot", "dest": "CMCH Trauma Center", "next_wp": "WP-02 Nava India Skyway", "dist_m": 320, "alt_target": 65},
    "AV-02": {"origin": "Gandhipuram Hub", "dest": "TIDEL Park IT SEZ", "next_wp": "WP-02 Avarampalayam High Viaduct", "dist_m": 580, "alt_target": 60},
    "AV-03": {"origin": "Ramanathapuram", "dest": "PSG Tech Innovation", "next_wp": "WP-02 Trichy Road Flyover", "dist_m": 410, "alt_target": 56},
    "AV-04": {"origin": "Singanallur Perimeter", "dest": "KMCH Helipad Pad 2", "next_wp": "WP-02 Ondipudur Gate Transit", "dist_m": 670, "alt_target": 70},
}

def generate_drone_fpv_frame(drone_id: str, width: int = 640, height: int = 360) -> bytes:
    veh = gateway_mgr.get_vehicle_by_identifier(drone_id)
    meta = DRONE_CORRIDORS.get(veh.callsign, DRONE_CORRIDORS.get("AV-01"))
    t = time.time()
    speed_kmh = max(15.0, veh.groundspeed_kmh if (veh.connected or gateway_mgr.harness_active) else 48.5)
    alt_m = max(10.0, veh.relative_altitude_m if (veh.connected or gateway_mgr.harness_active) else meta["alt_target"])
    heading_deg = veh.heading_degrees if (veh.connected or gateway_mgr.harness_active) else 246.0
    pitch_deg = veh.pitch_deg
    
    img = Image.new("RGB", (width, height), color=(10, 16, 28))
    draw = ImageDraw.Draw(img)
    
    pitch_offset = int(pitch_deg * 2.5)
    horizon_y = max(int(height * 0.2), min(int(height * 0.7), int(height * 0.45) + pitch_offset))
    
    draw.rectangle([(0, 0), (width, horizon_y)], fill=(6, 14, 28))
    draw.rectangle([(0, max(0, horizon_y - 40)), (width, horizon_y)], fill=(12, 24, 46))
    draw.rectangle([(0, horizon_y), (width, height)], fill=(15, 20, 30))
    
    cx = width // 2 + int(math.sin(math.radians(heading_deg % 60)) * 35)
    draw.polygon([(cx - 25, horizon_y), (cx + 25, horizon_y), (cx + 240, height), (cx - 240, height)], fill=(22, 28, 40), outline=(0, 240, 255))
    
    cycle_offset = int((t * speed_kmh * 2.2) % 60)
    for step in range(5):
        y_pos = horizon_y + 15 + step * 40 + cycle_offset
        if y_pos < height:
            d_w = 4 + step * 3
            draw.rectangle([(cx - d_w, y_pos), (cx + d_w, min(height, y_pos + 16))], fill=(255, 255, 255))
            
    for px_idx, px in enumerate([cx - 150, cx - 100, cx - 50]):
        pier_h = 28 + px_idx * 14
        pier_top = horizon_y - pier_h + 10
        draw.rectangle([(px, pier_top), (px + 10, horizon_y + 12)], fill=(30, 42, 60), outline=(45, 60, 85))
    draw.polygon([(cx - 170, horizon_y - 22), (cx - 30, horizon_y - 8), (cx - 30, horizon_y - 2), (cx - 170, horizon_y - 15)], fill=(40, 56, 78))
    
    tower_x = cx + 75
    tower_h = 70
    draw.rectangle([(tower_x, horizon_y - tower_h), (tower_x + 50, horizon_y + 8)], fill=(20, 32, 50), outline=(0, 240, 255))
    for wy in range(horizon_y - tower_h + 8, horizon_y, 14):
        for wx in range(tower_x + 6, tower_x + 46, 10):
            draw.rectangle([(wx, wy), (wx + 4, wy + 6)], fill=(0, 240, 255))
            
    reticle_x = cx
    reticle_y = horizon_y + 12
    ret_size = 24
    draw.rectangle([(reticle_x - ret_size, reticle_y - ret_size), (reticle_x + ret_size, reticle_y + ret_size)], outline=(0, 240, 255), width=2)
    draw.line([(reticle_x - ret_size - 6, reticle_y), (reticle_x + ret_size + 6, reticle_y)], fill=(0, 240, 255), width=1)
    draw.line([(reticle_x, reticle_y - ret_size - 6), (reticle_x, reticle_y + ret_size + 6)], fill=(0, 240, 255), width=1)
    draw.text((reticle_x - 55, reticle_y + ret_size + 4), f"LOCKED: {meta['next_wp'][:16]} ({meta['dist_m']}m)", fill=(0, 240, 255))
    
    for p_val, p_col in [(10, (0, 240, 255)), (0, (0, 240, 255)), (-10, (245, 158, 11))]:
        bar_y = horizon_y - int(p_val * 3.5)
        if 35 < bar_y < height - 35:
            draw.line([(cx - 65, bar_y), (cx - 20, bar_y)], fill=p_col, width=2)
            draw.line([(cx + 20, bar_y), (cx + 65, bar_y)], fill=p_col, width=2)
            draw.text((cx + 70, bar_y - 6), f"{p_val:02d}", fill=p_col)
            draw.text((cx - 88, bar_y - 6), f"{p_val:02d}", fill=p_col)
            
    ch_x, ch_y = width // 2, height // 2
    draw.line([(ch_x - 12, ch_y), (ch_x - 4, ch_y)], fill=(255, 255, 255), width=2)
    draw.line([(ch_x + 4, ch_y), (ch_x + 12, ch_y)], fill=(255, 255, 255), width=2)
    draw.line([(ch_x, ch_y - 12), (ch_x, ch_y - 4)], fill=(255, 255, 255), width=2)
    draw.line([(ch_x, ch_y + 4), (ch_x, ch_y + 12)], fill=(255, 255, 255), width=2)
    
    draw.rectangle([(0, 0), (width, 26)], fill=(6, 10, 18))
    draw.line([(0, 26), (width, 26)], fill=(0, 240, 255), width=1)
    cam_num = "01" if "01" in veh.callsign else "02" if "02" in veh.callsign else "03" if "03" in veh.callsign else "04"
    status_tag = "LIVE PX4/MAVLINK" if veh.connected else "LIVE SIMULATION FPV"
    status_col = (16, 185, 129) if veh.connected else (0, 240, 255)
    draw.text((10, 6), f"● {status_tag} • CAM-{cam_num} [{veh.callsign}] • 1080p60", fill=status_col)
    
    time_str = time.strftime("%H:%M:%S IST")
    draw.text((width - 235, 6), f"GPS: {veh.gps_fix_type} ({veh.satellites_visible} SAT) • {time_str}", fill=(16, 185, 129))
    
    draw.rectangle([(6, height // 2 - 35), (76, height // 2 + 35)], fill=(8, 14, 24), outline=(0, 240, 255))
    draw.text((12, height // 2 - 28), "SPD KM/H", fill=(148, 163, 184))
    draw.text((12, height // 2 - 10), f"{speed_kmh:.1f}", fill=(255, 255, 255))
    draw.text((12, height // 2 + 10), "AIRSPEED", fill=(0, 240, 255))
    
    draw.rectangle([(width - 76, height // 2 - 35), (width - 6, height // 2 + 35)], fill=(8, 14, 24), outline=(0, 240, 255))
    draw.text((width - 70, height // 2 - 28), "ALT AGL", fill=(148, 163, 184))
    draw.text((width - 70, height // 2 - 10), f"{alt_m:.1f}m", fill=(255, 255, 255))
    draw.text((width - 70, height // 2 + 10), f"HDG {int(heading_deg)}°", fill=(0, 240, 255))
    
    draw.rectangle([(0, height - 24), (width, height)], fill=(6, 10, 18))
    draw.line([(0, height - 24), (width, height - 24)], fill=(30, 45, 68), width=1)
    pos_str = f"LAT: {veh.latitude:.5f}°  LON: {veh.longitude:.5f}°  CORRIDOR: {meta['origin']} -> {meta['dest']}"
    draw.text((10, height - 17), pos_str, fill=(148, 163, 184))
    draw.text((width - 145, height - 17), f"BAT: {veh.battery_percentage:.0f}% ({veh.battery_voltage_v:.1f}V)", fill=(16, 185, 129))
    
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=75)
    return buf.getvalue()

@app.get("/api/v1/drones/{drone_id}/stream")
@app.get("/api/v1/camera/{drone_id}/stream")
async def get_drone_camera_stream(drone_id: str):
    async def frame_stream():
        while True:
            frame_bytes = generate_drone_fpv_frame(drone_id)
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")
            await asyncio.sleep(0.05)
            
    return StreamingResponse(frame_stream(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/v1/drones/{drone_id}/snapshot")
async def get_drone_camera_snapshot(drone_id: str):
    frame_bytes = generate_drone_fpv_frame(drone_id)
    return Response(content=frame_bytes, media_type="image/jpeg")

# ─── MISSIONS API ────────────────────────────────────────────────────────────

@app.get("/api/v1/missions")
async def get_all_missions() -> List[Dict[str, Any]]:
    return list(gateway_mgr.active_missions.values())

@app.get("/api/v1/missions/{mission_id}")
async def get_mission(mission_id: str) -> Dict[str, Any]:
    m = gateway_mgr.active_missions.get(mission_id)
    if not m:
        raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found")
    return m

@app.get("/api/v1/missions/{mission_id}/checkpoints")
async def get_mission_checkpoints(mission_id: str) -> Dict[str, Any]:
    m = gateway_mgr.active_missions.get(mission_id)
    if not m:
        raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found")
    return {"missionId": mission_id, "checkpoints": m.get("checkpoints", [])}

@app.get("/api/v1/missions/{mission_id}/status")
async def get_mission_status(mission_id: str) -> Dict[str, Any]:
    m = gateway_mgr.active_missions.get(mission_id)
    if not m:
        raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found")
    pv = gateway_mgr.get_primary_vehicle()
    return {
        "id": mission_id,
        "name": m.get("name"),
        "status": pv.mission_state if pv.connected else m.get("status", "idle"),
        "currentCheckpointIndex": pv.current_waypoint_seq if pv.connected else m.get("currentCheckpointIndex", 0),
        "totalCheckpoints": len(m.get("checkpoints", [])),
    }

@app.post("/api/v1/missions/{mission_id}/start")
@app.post("/api/v1/simulation/start")
async def start_mission(mission_id: Optional[str] = None, payload: Any = Body(None)) -> Dict[str, Any]:
    m_id = mission_id or (payload.get("missionId") if isinstance(payload, dict) else "MSN-CBE-01")
    m = gateway_mgr.active_missions.get(m_id)
    if not m:
        m = gateway_mgr.active_missions.get("MSN-CBE-01")

    if mavlink_bridge and gateway_mgr.get_primary_vehicle().connected:
        if m and "checkpoints" in m:
            mavlink_bridge.upload_mission(m["checkpoints"])
        res = mavlink_bridge.arm_and_start()
        return res

    # Standalone mock start
    if m:
        m["status"] = "running"
    return {"success": True, "state": "running", "message": f"Mission {m_id} started in mock mode"}

@app.post("/api/v1/missions/{mission_id}/pause")
@app.post("/api/v1/simulation/pause")
async def pause_mission(mission_id: Optional[str] = None, payload: Any = Body(None)) -> Dict[str, Any]:
    if mavlink_bridge and gateway_mgr.get_primary_vehicle().connected:
        return mavlink_bridge.pause()

    m_id = mission_id or (payload.get("missionId") if isinstance(payload, dict) else "MSN-CBE-01")
    m = gateway_mgr.active_missions.get(m_id)
    if m:
        m["status"] = "paused"
    return {"success": True, "state": "paused", "message": "Simulation paused"}

@app.post("/api/v1/missions/{mission_id}/resume")
@app.post("/api/v1/simulation/resume")
async def resume_mission(mission_id: Optional[str] = None, payload: Any = Body(None)) -> Dict[str, Any]:
    if mavlink_bridge and gateway_mgr.get_primary_vehicle().connected:
        return mavlink_bridge.arm_and_start()

    m_id = mission_id or (payload.get("missionId") if isinstance(payload, dict) else "MSN-CBE-01")
    m = gateway_mgr.active_missions.get(m_id)
    if m:
        m["status"] = "running"
    return {"success": True, "state": "running", "message": "Simulation resumed"}

@app.post("/api/v1/missions/{mission_id}/reset")
@app.post("/api/v1/simulation/reset")
async def reset_mission(mission_id: Optional[str] = None, payload: Any = Body(None)) -> Dict[str, Any]:
    m_id = mission_id or (payload.get("missionId") if isinstance(payload, dict) else "MSN-CBE-01")
    m = gateway_mgr.active_missions.get(m_id)
    if m:
        m["status"] = "idle"
        m["currentCheckpointIndex"] = 0
    pv = gateway_mgr.get_primary_vehicle()
    with pv.lock:
        pv.mission_state = "idle"
        pv.current_waypoint_seq = 0
    return {"success": True, "state": "idle", "message": "Mission reset to initial checkpoint"}

@app.post("/api/v1/simulation/faults")
async def inject_fault(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    fault_type = payload.get("faultType", "gps_degradation")
    target_drone = payload.get("droneId", "AV-01")
    logger.warning(f"Simulated fault injected: {fault_type} on {target_drone}")
    return {
        "success": True,
        "faultType": fault_type,
        "targetDrone": target_drone,
        "active": True,
        "message": f"Simulated {fault_type} active on {target_drone} (Simulation Mode Only)",
    }

@app.post("/api/v1/simulation/mode")
async def set_simulation_mode(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    new_mode = payload.get("mode", "px4")
    if new_mode in ("px4", "mock"):
        gateway_mgr.simulation_mode = new_mode
        return {"success": True, "mode": new_mode}
    raise HTTPException(status_code=400, detail="Mode must be 'px4' or 'mock'")

@app.post("/api/v1/simulation/harness/toggle")
async def toggle_harness() -> Dict[str, Any]:
    """Toggles built-in PX4 SITL test harness transmitting on UDP:14550."""
    if not gateway_mgr.harness_active:
        gateway_mgr.harness_active = True
        gateway_mgr.harness_thread = threading.Thread(target=run_test_harness, args=(14550,), daemon=True)
        gateway_mgr.harness_thread.start()
        logger.info("Test harness transmitter ACTIVATED on UDP 127.0.0.1:14550")
        return {"success": True, "harnessActive": True, "message": "Test harness transmitting MAVLink on UDP:14550"}
    else:
        gateway_mgr.harness_active = False
        logger.info("Test harness transmitter DEACTIVATED")
        return {"success": True, "harnessActive": False, "message": "Test harness stopped"}

# ─── REAL-TIME WEBSOCKET TELEMETRY BROADCASTER ───────────────────────────────

@app.websocket("/api/v1/ws/telemetry")
@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    logger.info(f"WebSocket client connected from {websocket.client.host}:{websocket.client.port}")
    try:
        while True:
            gateway_mgr.update_connection_state()
            pv = gateway_mgr.get_primary_vehicle()
            telemetry_data = pv.to_dict()
            # Include gateway diagnostic state
            telemetry_data["gatewayState"] = gateway_mgr.connection_state.value
            telemetry_data["gatewayReason"] = gateway_mgr.connection_reason
            telemetry_data["simulationMode"] = gateway_mgr.simulation_mode

            await websocket.send_text(json.dumps(telemetry_data))
            await asyncio.sleep(0.1) # 10 Hz broadcast
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket streaming error: {e}")

# ─── MAIN ENTRY POINT ────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="AEROVATA PX4 SITL Gateway & Backend Server")
    parser.add_argument("--mavlink-port", default=DEFAULT_MAVLINK_PORT, help=f"MAVLink connection string (default: {DEFAULT_MAVLINK_PORT})")
    parser.add_argument("--http-port", type=int, default=DEFAULT_HTTP_PORT, help=f"HTTP/REST API port (default: {DEFAULT_HTTP_PORT})")
    parser.add_argument("--test-harness", action="store_true", help="Launch built-in PX4 SITL test harness on UDP:14550 for automated verification")
    args = parser.parse_args()

    gateway_mgr.http_port = args.http_port
    gateway_mgr.connection_str = args.mavlink_port

    global mavlink_bridge
    mavlink_bridge = MavlinkBridge(args.mavlink_port)
    mavlink_bridge.start()

    if args.test_harness:
        gateway_mgr.harness_active = True
        gateway_mgr.harness_thread = threading.Thread(target=run_test_harness, args=(14550,), daemon=True)
        gateway_mgr.harness_thread.start()
        logger.info("Test harness transmitter active on UDP 127.0.0.1:14550")

    logger.info(f"Starting AEROVATA Unified Backend on http://0.0.0.0:{args.http_port} (REST API: /api/v1, WS: /api/v1/ws/telemetry)...")
    uvicorn.run(app, host="0.0.0.0", port=args.http_port, log_level="info")

if __name__ == "__main__":
    main()
