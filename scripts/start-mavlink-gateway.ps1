<#
.SYNOPSIS
    Starts the AEROVATA Unified Backend & MAVLink Gateway Service
    AEROVATA by TASPORA - Autonomous Drone Command Center
#>
param(
    [int]$HttpPort = 8000,
    [string]$MavlinkPort = "udpin:0.0.0.0:14550",
    [switch]$TestHarness = $false
)

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " STARTING AEROVATA BACKEND & MAVLINK GATEWAY SERVICE" -ForegroundColor Cyan
Write-Host " HTTP REST API: http://localhost:$HttpPort/api/v1" -ForegroundColor Green
Write-Host " Telemetry WS:  ws://localhost:$HttpPort/api/v1/ws/telemetry" -ForegroundColor Green
Write-Host " MAVLink Target: $MavlinkPort" -ForegroundColor Green
if ($TestHarness) {
    Write-Host " Test Harness:  ACTIVATED (Transmitting MAVLink packets on UDP:14550)" -ForegroundColor Yellow
}
Write-Host "=================================================================" -ForegroundColor Cyan

$scriptPath = Join-Path $PSScriptRoot "..\simulation-gateway\px4_gateway.py"

$argsList = @(
    $scriptPath,
    "--http-port", $HttpPort,
    "--mavlink-port", $MavlinkPort
)

if ($TestHarness) {
    $argsList += "--test-harness"
}

python @argsList
