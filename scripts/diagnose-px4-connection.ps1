<#
.SYNOPSIS
    PX4 SITL & Gazebo Integration Comprehensive Diagnostic Audit
    AEROVATA by TASPORA - Autonomous Drone Command Center
#>

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " AEROVATA / TASPORA - PX4 SITL & GAZEBO DIAGNOSTIC AUDIT" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Environment & Architecture
Write-Host "[1/6] Auditing Host Environment..." -ForegroundColor Yellow
$os = (Get-CimInstance Win32_OperatingSystem).Caption
Write-Host "  * Windows OS: $os" -ForegroundColor White
$py = python --version 2>&1
Write-Host "  * Python Version: $py" -ForegroundColor White

# 2. Check WSL2 Status
Write-Host ""
Write-Host "[2/6] Auditing Windows Subsystem for Linux (WSL2)..." -ForegroundColor Yellow
try {
    $wslList = wsl --list --verbose 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  * WSL Installed: YES" -ForegroundColor Green
        Write-Host "  * Installed Distros:" -ForegroundColor White
        Write-Host $wslList -ForegroundColor Gray
    } else {
        Write-Host "  * WSL Installed: NO / Not configured" -ForegroundColor Red
        Write-Host "  * To install Ubuntu 22.04 LTS: wsl --install -d Ubuntu-22.04" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "  * WSL check failed: $_" -ForegroundColor Red
}

# 3. Check Network Ports
Write-Host ""
Write-Host "[3/6] Auditing Network Ports..." -ForegroundColor Yellow
$portsToCheck = @(8000, 5173, 14550, 14540)
foreach ($portNum in $portsToCheck) {
    $tcp = Get-NetTCPConnection -LocalPort $portNum -ErrorAction SilentlyContinue
    $udp = Get-NetUDPEndpoint -LocalPort $portNum -ErrorAction SilentlyContinue
    if ($tcp) {
        Write-Host "  * Port $portNum (TCP): LISTENING (PID: $($tcp.OwningProcess[0]))" -ForegroundColor Green
    } elseif ($udp) {
        Write-Host "  * Port $portNum (UDP): BOUND (PID: $($udp.OwningProcess[0]))" -ForegroundColor Green
    } else {
        Write-Host "  * Port ${portNum}: FREE (Not occupied)" -ForegroundColor Gray
    }
}

# 4. Check Python Dependencies
Write-Host ""
Write-Host "[4/6] Auditing Gateway Python Dependencies..." -ForegroundColor Yellow
$pyCheck = python -c "import fastapi, uvicorn, pymavlink, websockets; print('OK')" 2>&1
if ($pyCheck -like "*OK*") {
    Write-Host "  * Python packages (fastapi, uvicorn, pymavlink, websockets): INSTALLED & READY" -ForegroundColor Green
} else {
    Write-Host "  * Missing Python dependencies: $pyCheck" -ForegroundColor Red
    Write-Host "  * Run: python -m pip install pymavlink fastapi uvicorn websockets" -ForegroundColor White
}

# 5. Check FastAPI Backend Health
Write-Host ""
Write-Host "[5/6] Probing Backend Health Endpoint (http://localhost:8000/api/v1/health)..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/health" -Method Get -TimeoutSec 3
    Write-Host "  * Backend API Status: ONLINE" -ForegroundColor Green
    Write-Host "  * MAVLink Gateway: $($health.px4_gateway_status)" -ForegroundColor White
    Write-Host "  * Connection State: $($health.connection_state)" -ForegroundColor Cyan
    Write-Host "  * Reason: $($health.connection_reason)" -ForegroundColor Gray
    Write-Host "  * Connected Vehicles: $($health.connected_vehicles_count)" -ForegroundColor White
} catch {
    Write-Host "  * Backend API Status: OFFLINE (http://localhost:8000 not responding)" -ForegroundColor Red
    Write-Host "  * Start the backend with: powershell -ExecutionPolicy Bypass -File .\scripts\start-mavlink-gateway.ps1" -ForegroundColor White
}

# 6. Check Windows Firewall UDP Rules
Write-Host ""
Write-Host "[6/6] Auditing Windows Firewall UDP 14550 / 14540 Rules..." -ForegroundColor Yellow
$fw = Get-NetFirewallRule -DisplayName "*MAVLink*" -ErrorAction SilentlyContinue
if ($fw) {
    Write-Host "  * MAVLink Firewall Rule: CONFIGURED ($($fw.Name))" -ForegroundColor Green
} else {
    Write-Host "  * MAVLink Firewall Rule: Standard Windows local loopback is allowed" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " DIAGNOSTIC AUDIT COMPLETE" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
