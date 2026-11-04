#!/usr/bin/env bash
# ==============================================================================
# Modern Gazebo & PX4 SITL Launch Script
# AEROVATA by TASPORA - Autonomous Drone Command Center
# ==============================================================================
set -e

VEHICLE="${1:-gz_x500}"
PX4_DIR="${PX4_DIR:-$HOME/PX4-Autopilot}"

echo "================================================================"
echo " Starting PX4 SITL with modern Gazebo ($VEHICLE)"
echo " Repository: $PX4_DIR"
echo "================================================================"

if [ ! -d "$PX4_DIR" ]; then
    echo "[ERROR] PX4-Autopilot directory not found at: $PX4_DIR"
    echo "Please clone PX4-Autopilot with submodules:"
    echo "  git clone https://github.com/PX4/PX4-Autopilot.git --recursive"
    exit 1
fi

cd "$PX4_DIR"

# Launch modern Gazebo SITL
# Target gz_x500 uses modern Gazebo (Garden/Harmonic)
export HEADLESS="${HEADLESS:-0}"
export PX4_GZ_STANDALONE="${PX4_GZ_STANDALONE:-1}"

make px4_sitl "$VEHICLE"
