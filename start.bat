@echo off
cd /d "%~dp0"
echo ========================================================
echo    AEROVATA by TASPORA - Command Center Launcher
echo ========================================================
echo.
echo Opening http://localhost:5173/ in your browser...
start http://localhost:5173/
echo.
echo Checking server status...
netstat -ano | findstr :5173 >nul
if %errorlevel% equ 0 (
    echo [INFO] TASPORA server is ALREADY running on port 5173!
    echo Opened http://localhost:5173/ in your browser.
    timeout /t 5 >nul
    exit /b 0
)

echo [INFO] Starting Vite development server...
"C:\Users\HP\nodejs\node.exe" "./node_modules/vite/bin/vite.js" --host 0.0.0.0 --port 5173
pause
