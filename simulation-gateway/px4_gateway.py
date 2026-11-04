"""
PX4 SITL & Gazebo MAVLink Gateway Service
AEROVATA by TASPORA - Autonomous Drone Delivery Command Center

Connects directly to PX4 Autopilot Software-in-the-Loop (SITL) running in Gazebo
over MAVLink (UDP: 14550 / 14540). Bridges autopilot telemetry and missions
to the TASPORA web application over WebSocket and REST.

For simulation and software demonstration only. Isolated from physical aircraft.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import math
import queue
import socket
import sys
import threading
import time
from typing import Any, Dict, List, Optional, Union

try:
    from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Body
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
    from pymavlink import mavutil
except ImportError as e:
    sys.stderr.write(f"Missing dependency: {e}\nRun: pip install pymavlink fastapi uvicorn websockets\n")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("px4_gateway")

app = FastAPI(
    title="AEROVATA PX4 SITL Gateway",
    description="MAVLink-to-WebSocket bridge connecting TASPORA to PX4 SITL & Gazebo",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── PX4 TELEMETRY & STATE CONTAINER ─────────────────────────────────────────

class Px4State:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.connected: bool = False
        self.last_heartbeat_time: float = 0.0
        self.system_id: int = 1
        self.component_id: int = 1
        self.autopilot_type: str = "UNKNOWN"
        self.vehicle_type: str = "UNKNOWN"
        self.armed: bool = False
        self.flight_mode: str = "DISCONNECTED"

        # Position and Kinematics
        self.latitude: float = -37.8155
        self.longitude: float = 145.1220
        self.altitude_msl_m: float = 0.0
        self.relative_altitude_m: float = 0.0
        self.heading_degrees: float = 0.0
        self.groundspeed_kmh: float = 0.0
        self.vertical_speed_ms: float = 0.0
        self.roll_deg: float = 0.0
        self.pitch_deg: float = 0.0
        self.yaw_deg: float = 0.0

        # Health & Battery
        self.battery_percentage: float = 100.0
        self.battery_voltage_v: float = 24.8
        self.satellites_visible: int = 18
        self.gps_fix_type: str = "RTK_FIX"

        # Mission Progress
        self.current_waypoint_seq: int = 0
        self.mission_count: int = 0
        self.mission_state: str = "idle" # idle | running | paused | completed | error
        self.is_dwell_active: bool = False
        self.last_status_text: str = ""

    def update_heartbeat(self, msg: Any) -> None:
        # Ignore GCS echoes (system ID 255 or GCS type)
        if msg.get_srcSystem() == 255 or msg.type == mavutil.mavlink.MAV_TYPE_GCS:
            return

        with self.lock:
            self.connected = True
            self.last_heartbeat_time = time.time()
            self.system_id = msg.get_srcSystem()
            self.component_id = msg.get_srcComponent()
            self.armed = bool(msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED)
            self.autopilot_type = "PX4 Autopilot (SITL)" if msg.autopilot == mavutil.mavlink.MAV_AUTOPILOT_PX4 else f"Autopilot({msg.autopilot})"
            self.vehicle_type = "x500 Quadrotor" if msg.type == mavutil.mavlink.MAV_TYPE_QUADROTOR else f"Type({msg.type})"
            self.flight_mode = self._decode_px4_mode(msg.custom_mode)

    def _decode_px4_mode(self, custom_mode: int) -> str:
        # PX4 custom mode bitmask: main_mode in bits 16-23, sub_mode in bits 24-31
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
        return res

    def check_connection_timeout(self) -> None:
        with self.lock:
            if self.connected and (time.time() - self.last_heartbeat_time > 3.5):
                self.connected = False
                self.flight_mode = "DISCONNECTED"
                logger.warning("PX4 heartbeat timeout. Vehicle marked DISCONNECTED.")

    def to_telemetry_dict(self) -> Dict[str, Any]:
        with self.lock:
            return {
                "droneId": "AV-PX4-SITL",
                "timestamp": int(time.time() * 1000),
                "connected": self.connected,
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
                "signalQualityPercent": 99 if self.connected else 0,
                "rtkFix": self.gps_fix_type if self.connected else "SEARCHING",
                "satellites": self.satellites_visible if self.connected else 0,
                "currentCheckpointIndex": self.current_waypoint_seq,
                "missionStatus": self.mission_state if self.connected else "error",
                "isDwellActive": self.is_dwell_active,
                "lastStatusText": self.last_status_text,
            }

px4_state = Px4State()

# ─── MAVLINK CONNECTION & BACKGROUND THREAD ──────────────────────────────────

class MavlinkBridge:
    def __init__(self, connection_str: str) -> None:
        self.connection_str = connection_str
        self.mav: Optional[mavutil.mavfile] = None
        self.running: bool = False
        self.thread: Optional[threading.Thread] = None
        self.active_checkpoints: List[Dict[str, Any]] = []
        self.mission_msg_queue: queue.Queue = queue.Queue()

    def start(self) -> None:
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        logger.info(f"MAVLink bridge started, listening on {self.connection_str}")

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
                logger.info(f"Binding MAVLink socket on {self.connection_str}...")
                self.mav = mavutil.mavlink_connection(self.connection_str, autoreconnect=True)
                logger.info("MAVLink socket bound. Awaiting heartbeat from PX4 SITL...")
                return
            except Exception as e:
                logger.error(f"Failed to bind MAVLink connection: {e}. Retrying in 2s...")
                time.sleep(2.0)

    def _run(self) -> None:
        self._connect()
        while self.running:
            if not self.mav:
                time.sleep(0.5)
                continue

            try:
                msg = self.mav.recv_match(blocking=True, timeout=1.0)
                px4_state.check_connection_timeout()

                if not msg:
                    continue

                msg_type = msg.get_type()

                if msg_type == "HEARTBEAT":
                    px4_state.update_heartbeat(msg)

                elif msg_type == "GLOBAL_POSITION_INT":
                    with px4_state.lock:
                        px4_state.latitude = msg.lat / 1e7
                        px4_state.longitude = msg.lon / 1e7
                        px4_state.altitude_msl_m = msg.alt / 1000.0
                        px4_state.relative_altitude_m = max(0.0, msg.relative_alt / 1000.0)
                        px4_state.heading_degrees = (msg.hdg / 100.0) if msg.hdg != 65535 else px4_state.heading_degrees
                        # Velocity components in cm/s -> km/h
                        v_horiz = math.sqrt(msg.vx * msg.vx + msg.vy * msg.vy) / 100.0 # m/s
                        px4_state.groundspeed_kmh = v_horiz * 3.6
                        px4_state.vertical_speed_ms = -msg.vz / 100.0

                elif msg_type == "ATTITUDE":
                    with px4_state.lock:
                        px4_state.roll_deg = math.degrees(msg.roll)
                        px4_state.pitch_deg = math.degrees(msg.pitch)
                        px4_state.yaw_deg = math.degrees(msg.yaw)

                elif msg_type == "SYS_STATUS":
                    with px4_state.lock:
                        if msg.battery_remaining != -1:
                            px4_state.battery_percentage = float(msg.battery_remaining)
                        if msg.voltage_battery != 65535:
                            px4_state.battery_voltage_v = msg.voltage_battery / 1000.0

                elif msg_type == "MISSION_CURRENT":
                    with px4_state.lock:
                        px4_state.current_waypoint_seq = msg.seq

                elif msg_type == "MISSION_ITEM_REACHED":
                    with px4_state.lock:
                        logger.info(f"PX4 reached checkpoint sequence #{msg.seq}")
                        if msg.seq >= px4_state.mission_count - 1 and px4_state.mission_count > 0:
                            px4_state.mission_state = "completed"

                elif msg_type == "STATUSTEXT":
                    text = msg.text
                    if isinstance(text, bytes):
                        text = text.decode("utf-8", errors="ignore")
                    logger.info(f"PX4 STATUSTEXT [{msg.severity}]: {text}")
                    with px4_state.lock:
                        px4_state.last_status_text = text

                elif msg_type in ("MISSION_REQUEST_INT", "MISSION_REQUEST", "MISSION_ACK", "COMMAND_ACK"):
                    self.mission_msg_queue.put(msg)

            except Exception as e:
                logger.error(f"Exception in MAVLink reader loop: {e}")
                time.sleep(0.5)

    def upload_mission(self, checkpoints: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Uploads checkpoints to PX4 via standard MAVLink mission protocol."""
        if not self.mav or not px4_state.connected:
            return {"success": False, "error": "PX4 SITL is not connected. Awaiting autopilot heartbeat."}

        count = len(checkpoints)
        if count < 2:
            return {"success": False, "error": "Mission requires at least 2 checkpoints"}

        self.active_checkpoints = checkpoints
        with px4_state.lock:
            px4_state.mission_count = count
            px4_state.mission_state = "idle"

        logger.info(f"Initiating MAVLink mission upload ({count} items) to PX4...")

        # Drain any residual messages from previous uploads
        while not self.mission_msg_queue.empty():
            try:
                self.mission_msg_queue.get_nowait()
            except queue.Empty:
                break

        # Send mission count (overwrites previous mission)
        self.mav.mav.mission_count_send(
            px4_state.system_id,
            px4_state.component_id,
            count,
            mavutil.mavlink.MAV_MISSION_TYPE_MISSION,
        )
        logger.info(f"Sent MAVLink MISSION_COUNT ({count} items) to sys={px4_state.system_id}, comp={px4_state.component_id}")

        # Process mission requests from queue
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
                    p2 = float(cp.get("arrivalRadiusMeters", 5.0))
                    p3 = 0.0
                    p4 = float("nan")

                    if cp.get("action") == "takeoff" or seq == 0:
                        cmd = 22 # MAV_CMD_NAV_TAKEOFF
                        p1 = 0.0
                        p2 = 0.0
                        p3 = 0.0
                        p4 = float("nan")
                    elif cp.get("action") == "land" or seq == count - 1:
                        cmd = 21 # MAV_CMD_NAV_LAND
                        p1 = 0.0
                        p2 = 0.0
                        p3 = 0.0
                        p4 = float("nan")

                    lat_val = float(cp.get("latitude", cp.get("lat", 0.0)))
                    lng_val = float(cp.get("longitude", cp.get("lng", 0.0)))
                    lat_int = int(round(lat_val * 1e7))
                    lon_int = int(round(lng_val * 1e7))
                    alt_m = float(cp.get("altitudeMeters", 20.0))
                    if cmd == 21:
                        alt_m = 0.0

                    self.mav.mav.mission_item_int_send(
                        px4_state.system_id,
                        px4_state.component_id,
                        seq,
                        mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
                        cmd,
                        1 if seq == 0 else 0, # current
                        1, # autocontinue
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
                    logger.info(f"Uploaded MAVLink mission item #{seq}/{count} (cmd={cmd}, alt={alt_m}m, lat={lat_val}, lng={lng_val})")

            elif msg_type == "MISSION_ACK":
                ack_type = msg.type
                if last_uploaded_seq >= count - 1:
                    if ack_type == mavutil.mavlink.MAV_MISSION_ACCEPTED:
                        logger.info(f"PX4 successfully accepted mission ({count} waypoints)!")
                        return {"success": True, "count": count, "message": "Mission accepted by PX4 Autopilot"}
                    else:
                        logger.error(f"PX4 rejected mission with code: {ack_type}")
                        return {"success": False, "error": f"PX4 rejected mission with ACK code {ack_type}"}
                else:
                    logger.info(f"Received intermediate MISSION_ACK({ack_type}) before completing all items (uploaded {last_uploaded_seq + 1}/{count})")

        return {"success": False, "error": "Mission upload timed out waiting for PX4 ACK"}

    def arm_and_start(self) -> Dict[str, Any]:
        """Sets AUTO.MISSION mode, arms vehicle, and starts mission."""
        if not self.mav or not px4_state.connected:
            return {"success": False, "error": "PX4 SITL is not connected"}

        logger.info("Setting PX4 mode to AUTO.MISSION...")
        # PX4 custom mode: param2=main_mode (4=AUTO), param3=sub_mode (4=MISSION)
        self.mav.mav.command_long_send(
            px4_state.system_id,
            px4_state.component_id,
            mavutil.mavlink.MAV_CMD_DO_SET_MODE,
            0,
            mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
            4,  # PX4_CUSTOM_MAIN_MODE_AUTO
            4,  # PX4_CUSTOM_SUB_MODE_AUTO_MISSION
            0, 0, 0, 0,
        )
        time.sleep(0.2)

        logger.info("Sending ARM command to PX4...")
        self.mav.mav.command_long_send(
            px4_state.system_id,
            px4_state.component_id,
            mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
            0,
            1,  # 1 = Arm
            0, 0, 0, 0, 0, 0,
        )
        time.sleep(0.2)

        logger.info("Sending MAV_CMD_MISSION_START to PX4...")
        self.mav.mav.command_long_send(
            px4_state.system_id,
            px4_state.component_id,
            mavutil.mavlink.MAV_CMD_MISSION_START,
            0,
            0, 0, 0, 0, 0, 0, 0,
        )

        with px4_state.lock:
            px4_state.mission_state = "running"

        return {"success": True, "state": "running", "message": "PX4 armed and commanded AUTO.MISSION"}

    def pause(self) -> Dict[str, Any]:
        """Commands AUTO.LOITER (Hold) mode."""
        if not self.mav or not px4_state.connected:
            return {"success": False, "error": "PX4 SITL is not connected"}

        logger.info("Setting PX4 mode to AUTO.LOITER (Hold position)...")
        # PX4 custom mode: param2=4 (AUTO), param3=3 (LOITER)
        self.mav.mav.command_long_send(
            px4_state.system_id,
            px4_state.component_id,
            mavutil.mavlink.MAV_CMD_DO_SET_MODE,
            0,
            mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
            4,  # PX4_CUSTOM_MAIN_MODE_AUTO
            3,  # PX4_CUSTOM_SUB_MODE_AUTO_LOITER
            0, 0, 0, 0,
        )

        with px4_state.lock:
            px4_state.mission_state = "paused"

        return {"success": True, "state": "paused", "message": "PX4 switched to AUTO.LOITER hold mode"}

    def return_to_launch(self) -> Dict[str, Any]:
        """Commands Return-To-Launch."""
        if not self.mav or not px4_state.connected:
            return {"success": False, "error": "PX4 SITL is not connected"}

        logger.info("Setting PX4 mode to AUTO.RTL...")
        # PX4 custom mode: param2=4 (AUTO), param3=5 (RTL)
        self.mav.mav.command_long_send(
            px4_state.system_id,
            px4_state.component_id,
            mavutil.mavlink.MAV_CMD_DO_SET_MODE,
            0,
            mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
            4,  # PX4_CUSTOM_MAIN_MODE_AUTO
            5,  # PX4_CUSTOM_SUB_MODE_AUTO_RTL
            0, 0, 0, 0,
        )
        return {"success": True, "message": "PX4 commanded Return-to-Launch"}

mavlink_bridge: Optional[MavlinkBridge] = None

# ─── REST ENDPOINTS ──────────────────────────────────────────────────────────

@app.get("/api/v1/px4/status")
async def get_px4_status() -> Dict[str, Any]:
    px4_state.check_connection_timeout()
    with px4_state.lock:
        return {
            "connected": px4_state.connected,
            "armed": px4_state.armed,
            "flightMode": px4_state.flight_mode,
            "autopilot": px4_state.autopilot_type,
            "vehicle": px4_state.vehicle_type,
            "systemId": px4_state.system_id,
            "heartbeatAgeSec": round(time.time() - px4_state.last_heartbeat_time, 2) if px4_state.last_heartbeat_time > 0 else None,
            "missionState": px4_state.mission_state,
            "currentWaypoint": px4_state.current_waypoint_seq,
        }

@app.get("/api/v1/px4/telemetry")
async def get_px4_telemetry() -> Dict[str, Any]:
    px4_state.check_connection_timeout()
    return px4_state.to_telemetry_dict()

@app.post("/api/v1/px4/mission")
async def upload_px4_mission(payload: Any = Body(...)) -> Dict[str, Any]:
    if isinstance(payload, list):
        checkpoints = payload
    elif isinstance(payload, dict):
        checkpoints = payload.get("checkpoints", [])
    else:
        checkpoints = []

    if not checkpoints or not isinstance(checkpoints, list):
        raise HTTPException(status_code=400, detail="Payload must include a 'checkpoints' list or be a list of checkpoints")

    if not mavlink_bridge:
        raise HTTPException(status_code=500, detail="MAVLink bridge is not initialized")

    result = mavlink_bridge.upload_mission(checkpoints)
    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result.get("error", "Mission upload failed"))
    return result

@app.post("/api/v1/px4/arm_and_start")
async def arm_and_start() -> Dict[str, Any]:
    if not mavlink_bridge:
        raise HTTPException(status_code=500, detail="MAVLink bridge is not initialized")
    result = mavlink_bridge.arm_and_start()
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Arming failed"))
    return result

@app.post("/api/v1/px4/pause")
async def pause_mission() -> Dict[str, Any]:
    if not mavlink_bridge:
        raise HTTPException(status_code=500, detail="MAVLink bridge is not initialized")
    return mavlink_bridge.pause()

@app.post("/api/v1/px4/rtl")
async def rtl_mission() -> Dict[str, Any]:
    if not mavlink_bridge:
        raise HTTPException(status_code=500, detail="MAVLink bridge is not initialized")
    return mavlink_bridge.return_to_launch()

# ─── WEBSOCKET TELEMETRY BROADCASTER ─────────────────────────────────────────

@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    logger.info(f"WebSocket client connected from {websocket.client.host}")
    try:
        while True:
            px4_state.check_connection_timeout()
            telemetry_data = px4_state.to_telemetry_dict()
            await websocket.send_text(json.dumps(telemetry_data))
            await asyncio.sleep(0.1) # 10 Hz broadcast
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")

# ─── IN-PROCESS AUTOPILOT SITL TEST HARNESS ─────────────────────────────────

def run_test_harness(port: int = 14550) -> None:
    """
    Sends simulated PX4 MAVLink telemetry packets to UDP port 14550.
    Used for automated end-to-end verification and testing on platforms
    where modern Gazebo / Linux is not yet running.
    """
    logger.info(f"Starting in-process PX4 SITL test harness transmitting to UDP 127.0.0.1:{port}...")
    from pymavlink.dialects.v20 import common as mavlink2
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setblocking(False)
    mav = mavlink2.MAVLink(None, srcSystem=1, srcComponent=1)

    lat = -37.8155
    lng = 145.1220
    alt = 0.0
    hdg = 4500  # 45 deg in centidegrees
    t = 0.0

    while True:
        t += 0.2
        try:
            # 1. HEARTBEAT (PX4, Quadrotor, Armed, AUTO.MISSION mode)
            custom_mode = (4 << 16) | (4 << 24)  # AUTO.MISSION
            hb = mav.heartbeat_encode(
                mavutil.mavlink.MAV_TYPE_QUADROTOR,
                mavutil.mavlink.MAV_AUTOPILOT_PX4,
                mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED | mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
                custom_mode,
                mavutil.mavlink.MAV_STATE_ACTIVE,
            )
            sock.sendto(hb.pack(mav), ("127.0.0.1", port))

            # Simulate drone moving along corridor if armed
            lat += 0.000015 * math.cos(math.radians(45))
            lng += 0.000015 * math.sin(math.radians(45))
            alt = min(85.0, alt + 1.2)

            # 2. GLOBAL_POSITION_INT
            pos = mav.global_position_int_encode(
                int(time.time() * 1000) & 0xFFFFFFFF,
                int(lat * 1e7),
                int(lng * 1e7),
                int((alt + 50) * 1000),  # MSL
                int(alt * 1000),  # Relative alt
                int(12.5 * 100 * math.cos(math.radians(45))),  # vx cm/s
                int(12.5 * 100 * math.sin(math.radians(45))),  # vy cm/s
                int(-0.1 * 100),  # vz cm/s
                hdg,
            )
            sock.sendto(pos.pack(mav), ("127.0.0.1", port))

            # 3. ATTITUDE
            att = mav.attitude_encode(
                int(time.time() * 1000) & 0xFFFFFFFF,
                math.radians(2.0 * math.sin(t)),
                math.radians(3.5),
                math.radians(45.0),
                0.0,
                0.0,
                0.0,
            )
            sock.sendto(att.pack(mav), ("127.0.0.1", port))

            # 4. SYS_STATUS
            sys_st = mav.sys_status_encode(
                0, 0, 0, 500, 24500, -1, 92, 0, 0, 0, 0, 0, 0
            )
            sock.sendto(sys_st.pack(mav), ("127.0.0.1", port))

            # 5. MISSION_CURRENT
            mc = mav.mission_current_encode(1)
            sock.sendto(mc.pack(mav), ("127.0.0.1", port))

            # Process incoming requests from gateway
            while True:
                try:
                    data, _ = sock.recvfrom(4096)
                    if not data:
                        break
                    msgs = mav.parse_buffer(data)
                    if not msgs:
                        continue
                    for in_msg in msgs:
                        mtype = in_msg.get_type()
                        if mtype == "MISSION_CLEAR_ALL":
                            ack = mav.mission_ack_encode(
                                1, 1, mavutil.mavlink.MAV_MISSION_ACCEPTED, mavutil.mavlink.MAV_MISSION_TYPE_MISSION
                            )
                            sock.sendto(ack.pack(mav), ("127.0.0.1", port))
                        elif mtype == "MISSION_COUNT":
                            m_count = in_msg.count
                            for s in range(m_count):
                                req = mav.mission_request_int_encode(
                                    1, 1, s, mavutil.mavlink.MAV_MISSION_TYPE_MISSION
                                )
                                sock.sendto(req.pack(mav), ("127.0.0.1", port))
                                time.sleep(0.02)
                            ack = mav.mission_ack_encode(
                                1, 1, mavutil.mavlink.MAV_MISSION_ACCEPTED, mavutil.mavlink.MAV_MISSION_TYPE_MISSION
                            )
                            sock.sendto(ack.pack(mav), ("127.0.0.1", port))
                            logger.info(f"Test harness accepted mission with {m_count} waypoints")
                        elif mtype == "COMMAND_LONG":
                            cmd_ack = mav.command_ack_encode(
                                in_msg.command, mavutil.mavlink.MAV_RESULT_ACCEPTED
                            )
                            sock.sendto(cmd_ack.pack(mav), ("127.0.0.1", port))
                except (BlockingIOError, socket.error):
                    break

        except Exception as e:
            logger.error(f"Error in test harness sender: {e}")

        time.sleep(0.2)

# ─── MAIN ENTRY POINT ────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="PX4 SITL & Gazebo Gateway")
    parser.add_argument("--mavlink-port", default="udpin:0.0.0.0:14550", help="MAVLink connection string (default: udpin:0.0.0.0:14550)")
    parser.add_argument("--http-port", type=int, default=8080, help="HTTP/WebSocket port for TASPORA web app (default: 8080)")
    parser.add_argument("--test-harness", action="store_true", help="Launch built-in PX4 SITL test harness on UDP:14550 for automated verification")
    args = parser.parse_args()

    global mavlink_bridge
    mavlink_bridge = MavlinkBridge(args.mavlink_port)
    mavlink_bridge.start()

    if args.test_harness:
        th_thread = threading.Thread(target=run_test_harness, args=(14550,), daemon=True)
        th_thread.start()
        logger.info("Test harness transmitter active on UDP 127.0.0.1:14550")

    logger.info(f"Starting AEROVATA PX4 Gateway API on http://127.0.0.1:{args.http_port}...")
    uvicorn.run(app, host="127.0.0.1", port=args.http_port, log_level="info")

if __name__ == "__main__":
    main()
