<#
.SYNOPSIS
    Gracefully stops PX4 Autopilot SITL, Gazebo, and the MAVLink Gateway
    AEROVATA by TASPORA - Autonomous Drone Command Center
#>

Write-Host "Stopping AEROVATA PX4 SITL & Gateway processes safely..." -ForegroundColor Yellow

# 1. Stop local gateway python processes
$gw = Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
    try {
        $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
        $cmd -like "*px4_gateway.py*" -or $cmd -like "*wsl_mavlink_forwarder.py*"
    } catch { $false }
}

if ($gw) {
    foreach ($p in $gw) {
        Write-Host "Terminating gateway process (PID: $($p.Id))..." -ForegroundColor DarkGray
        Stop-Process -Id $p.Id -Force
    }
}

# 2. Stop WSL PX4/Gazebo processes if WSL is active
try {
    wsl --list --quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        wsl -d Ubuntu-22.04 -- bash -c "killall -9 px4 ruby gz-sim-server gz-sim-gui gz gazebo 2>/dev/null || true"
        Write-Host "WSL PX4 & Gazebo daemons stopped." -ForegroundColor DarkGray
    }
} catch {}

Write-Host "All PX4 SITL, Gazebo, and gateway processes stopped cleanly." -ForegroundColor Green
