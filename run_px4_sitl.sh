#!/bin/bash
export GIT_SUBMODULES_ARE_EVIL=1
HOST_IP=$(ip route show default | awk '{print $3}')
export PX4_SIM_HOST_ADDR="${HOST_IP:-172.26.64.1}"
export HEADLESS=1
echo "=========================================================="
echo "Starting PX4 SITL & Gazebo x500"
echo "Target GCS Host: $PX4_SIM_HOST_ADDR (port 14550)"
echo "HEADLESS mode: $HEADLESS"
echo "=========================================================="
cd /mnt/c/Users/ssara/PX4-Autopilot
make px4_sitl gz_x500
