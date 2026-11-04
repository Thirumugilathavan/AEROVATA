"""
WSL2 <-> Windows Host Dynamic MAVLink Forwarder
AEROVATA by TASPORA - Autonomous Drone Command Center

Bridges PX4 SITL inside WSL2 to TASPORA Gateway on the Windows Host.
Automatically discovers the Windows Host Virtual IP via default route / resolv.conf.
"""

import os
import re
import socket
import subprocess
import sys
import threading
import time

def discover_windows_host_ip() -> str:
    """Discovers the Windows host IP address from inside WSL2."""
    # 1. Check environment variable override
    if "WINDOWS_HOST" in os.environ:
        return os.environ["WINDOWS_HOST"]

    # 2. Check default routing gateway in WSL2
    try:
        route_out = subprocess.check_output(["ip", "route", "show", "default"], universal_newlines=True)
        match = re.search(r"default via (\d+\.\d+\.\d+\.\d+)", route_out)
        if match:
            return match.group(1)
    except Exception:
        pass

    # 3. Check /etc/resolv.conf nameserver
    try:
        with open("/etc/resolv.conf", "r") as f:
            for line in f:
                if line.startswith("nameserver"):
                    parts = line.strip().split()
                    if len(parts) >= 2:
                        return parts[1]
    except Exception:
        pass

    # 4. Fallback to standard WSL2 virtual switch default
    return "172.26.64.1"

def main() -> None:
    discovered_ip = discover_windows_host_ip()
    windows_host = sys.argv[1] if len(sys.argv) > 1 else discovered_ip
    windows_port = int(sys.argv[2]) if len(sys.argv) > 2 else 14550
    px4_local_port = int(sys.argv[3]) if len(sys.argv) > 3 else 14540
    px4_remote_port = 14580

    print(f"================================================================")
    print(f" AEROVATA WSL2 MAVLink Forwarder (Dynamic Discovery)")
    print(f" Target Windows Host: {windows_host}:{windows_port}")
    print(f" Local PX4 Ingress:   127.0.0.1:{px4_local_port}")
    print(f"================================================================")

    px4_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    px4_sock.bind(("0.0.0.0", px4_local_port))

    win_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    from pymavlink.dialects.v20 import common as mavlink2
    from pymavlink import mavutil
    mav = mavlink2.MAVLink(None, srcSystem=255, srcComponent=0)
    hb = mav.heartbeat_encode(mavutil.mavlink.MAV_TYPE_GCS, mavutil.mavlink.MAV_AUTOPILOT_INVALID, 0, 0, 0)
    hb_bytes = hb.pack(mav)

    def keepalive() -> None:
        while True:
            try:
                px4_sock.sendto(hb_bytes, ("127.0.0.1", px4_remote_port))
            except Exception:
                pass
            time.sleep(1.0)

    t_keep = threading.Thread(target=keepalive, daemon=True)
    t_keep.start()

    def px4_to_win() -> None:
        while True:
            try:
                data, _ = px4_sock.recvfrom(65535)
                win_sock.sendto(data, (windows_host, windows_port))
            except Exception as e:
                print(f"[WSL Forwarder] px4_to_win error: {e}")
                time.sleep(0.2)

    def win_to_px4() -> None:
        while True:
            try:
                data, _ = win_sock.recvfrom(65535)
                px4_sock.sendto(data, ("127.0.0.1", px4_remote_port))
            except Exception as e:
                print(f"[WSL Forwarder] win_to_px4 error: {e}")
                time.sleep(0.2)

    t1 = threading.Thread(target=px4_to_win, daemon=True)
    t2 = threading.Thread(target=win_to_px4, daemon=True)
    t1.start()
    t2.start()

    print(f"[WSL Forwarder] Active bidirectional bridge operational.")
    while True:
        time.sleep(1)

if __name__ == "__main__":
    main()
