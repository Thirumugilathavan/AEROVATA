<#
.SYNOPSIS
    Starts PX4 Autopilot SITL & Gazebo in WSL2
    AEROVATA by TASPORA - Autonomous Drone Command Center
#>
param(
    [string]$Vehicle = "gz_x500",
    [switch]$ForwardMavlink = $true
)

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " LAUNCHING PX4 SITL & MODERN GAZEBO ($Vehicle)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Check WSL
$wslCheck = wsl --list --quiet 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] WSL2 is not installed or configured on this machine." -ForegroundColor Red
    Write-Host "Please install Ubuntu 22.04 LTS via: wsl --install -d Ubuntu-22.04" -ForegroundColor White
    Write-Host "Then follow the instructions in the dashboard's PX4 Setup Guide." -ForegroundColor Gray
    exit 1
}

Write-Host "[1/3] Starting PX4 SITL with modern Gazebo ($Vehicle)..." -ForegroundColor Yellow
$launchCmd = "cd ~/PX4-Autopilot && make px4_sitl $Vehicle"

Start-Process -FilePath "wsl.exe" -ArgumentList "-d", "Ubuntu-22.04", "--", "bash", "-ic", $launchCmd

if ($ForwardMavlink) {
    Write-Host "[2/3] Starting WSL MAVLink UDP forwarder to Windows host..." -ForegroundColor Yellow
    $fwdCmd = "cd ~/TASPORA/simulation-gateway && python3 wsl_mavlink_forwarder.py"
    Start-Process -FilePath "wsl.exe" -ArgumentList "-d", "Ubuntu-22.04", "--", "bash", "-ic", $fwdCmd
}

Write-Host "[3/3] PX4 SITL & Gazebo launched. Monitoring MAVLink stream on UDP:14550." -ForegroundColor Green
