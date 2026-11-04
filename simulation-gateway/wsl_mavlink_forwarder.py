"""
WSL2 <-> Windows Host MAVLink Forwarder
Bridges PX4 SITL in WSL2 (127.0.0.1:14540 / 14580)
to TASPORA Gateway on Windows (172.26.64.1:14550).
"""
import socket
import sys
import threading
import time

def main():
    windows_host = sys.argv[1] if len(sys.argv) > 1 else "172.26.64.1"
    windows_port = int(sys.argv[2]) if len(sys.argv) > 2 else 14550
    px4_local_port = 14540
    px4_remote_port = 14580

    print(f"Starting WSL MAVLink Forwarder -> Windows {windows_host}:{windows_port}...")

    px4_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    px4_sock.bind(("127.0.0.1", px4_local_port))

    win_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    from pymavlink.dialects.v20 import common as mavlink2
    from pymavlink import mavutil
    mav = mavlink2.MAVLink(None, srcSystem=255, srcComponent=0)
    hb = mav.heartbeat_encode(mavutil.mavlink.MAV_TYPE_GCS, mavutil.mavlink.MAV_AUTOPILOT_INVALID, 0, 0, 0)
    hb_bytes = hb.pack(mav)

    def keepalive():
        while True:
            try:
                px4_sock.sendto(hb_bytes, ("127.0.0.1", px4_remote_port))
            except Exception:
                pass
            time.sleep(1.0)

    t_keep = threading.Thread(target=keepalive, daemon=True)
    t_keep.start()

    def px4_to_win():
        while True:
            try:
                data, _ = px4_sock.recvfrom(65535)
                win_sock.sendto(data, (windows_host, windows_port))
            except Exception as e:
                print("px4_to_win error:", e)
                time.sleep(0.1)

    def win_to_px4():
        while True:
            try:
                data, _ = win_sock.recvfrom(65535)
                px4_sock.sendto(data, ("127.0.0.1", px4_remote_port))
            except Exception as e:
                print("win_to_px4 error:", e)
                time.sleep(0.1)

    t1 = threading.Thread(target=px4_to_win, daemon=True)
    t2 = threading.Thread(target=win_to_px4, daemon=True)
    t1.start()
    t2.start()

    print(f"Forwarder active: PX4 (127.0.0.1:{px4_local_port}) <===> Windows ({windows_host}:{windows_port})")
    while True:
        time.sleep(1)

if __name__ == "__main__":
    main()
