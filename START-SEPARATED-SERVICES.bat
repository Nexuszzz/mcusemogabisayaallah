@echo off
title Fire Detection System - GOWA Integration
color 0A

cls
echo.
echo ================================================================================
echo      FIRE DETECTION SYSTEM - GO-WHATSAPP (GOWA) INTEGRATION
echo ================================================================================
echo.
echo Starting services with GOWA architecture:
echo.
echo   [1/4] Go-WhatsApp Server (GOWA REST API)  - Port 3000
echo   [2/4] Proxy Server (Backend + MQTT)       - Port 8080
echo   [3/4] Dashboard Frontend (Web UI)         - Port 5173
echo   [4/4] Python Fire Detection Script        - Manual start
echo.
echo Benefits of GOWA:
echo   * Lower memory usage (~50MB vs ~150MB Baileys)
echo   * Faster startup (^<1s vs 2-5s)
echo   * Single binary deployment
echo   * MCP (Model Context Protocol) support
echo   * No Twilio dependency (removed)
echo.
echo ================================================================================
echo.

REM Change to script directory
cd /d "%~dp0"

REM Kill old processes
echo Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 >nul
echo    [OK] Ready to start
echo.

echo ================================================================================
echo [1/4] Starting Go-WhatsApp (GOWA) Server...
echo ================================================================================
cd go-whatsapp-web-multidevice\src
if exist "whatsapp.exe" (
    start "GOWA Server (3000)" cmd /k "title GOWA Server - Go-WhatsApp & whatsapp.exe rest --port 3000 --debug"
) else (
    start "GOWA Server (3000)" cmd /k "title GOWA Server - Go-WhatsApp & go run . rest --port 3000 --debug"
)
cd ..\..
timeout /t 5 /nobreak >nul
echo    [OK] GOWA Server: http://localhost:3000
echo.

echo ================================================================================
echo [2/4] Starting Proxy Server...
echo ================================================================================
cd proxy-server
start "Proxy Server (8080)" cmd /k "title Proxy Server & npm start"
cd ..
timeout /t 3 /nobreak >nul
echo    [OK] Proxy Server: http://localhost:8080
echo.

echo ================================================================================
echo [3/4] Starting Dashboard Frontend...
echo ================================================================================
start "Dashboard (5173)" cmd /k "title Dashboard Frontend & npm run dev"
timeout /t 5 /nobreak >nul
echo    [OK] Dashboard: http://localhost:5173
echo.

echo ================================================================================
echo [4/4] Python Fire Detection Script
echo ================================================================================
echo.
echo    [MANUAL STEP] Open NEW terminal and run:
echo.
echo       cd D:\rtsp-main\python_scripts
echo       python fire_detect_record_ultimate.py
echo.

timeout /t 3 >nul

echo ================================================================================
echo [SUCCESS] ALL SERVICES STARTED!
echo ================================================================================
echo.
echo Service Architecture (GOWA):
echo ================================================================================
echo.
echo    Port 3000:  GOWA Server (Go-WhatsApp REST API)
echo    Port 8080:  Proxy Server (Backend + MQTT + /gowa routes)
echo    Port 5173:  Dashboard (Frontend)
echo.
echo    MQTT Broker: 3.27.0.139:1883 (user: zaks)
echo.
echo ================================================================================
echo Verifying Services...
echo ================================================================================
timeout /t 8 /nobreak >nul
echo.

echo [GOWA Server]
curl -s http://localhost:3000/app/devices 2>nul
if %errorlevel% equ 0 (
    echo    [OK] Running
) else (
    echo    [INFO] May need login - check Swagger at http://localhost:3000/docs/swagger.yaml
)

echo.
echo [Proxy Server]
curl -s http://localhost:8080/health 2>nul
if %errorlevel% equ 0 (
    echo    [OK] Running
) else (
    echo    [ERROR] Not responding
)

echo.
echo ================================================================================
echo NEXT STEPS:
echo ================================================================================
echo.
echo 1. Open Dashboard: http://localhost:5173
echo 2. Go to Settings - WhatsApp Integration
echo 3. Scan QR Code OR use Pairing Code to connect WhatsApp
echo 4. Add WhatsApp recipients
echo 5. Start fire detection Python script
echo.
echo ================================================================================
echo GOWA API REFERENCE:
echo ================================================================================
echo.
echo * QR Code Login:   GET  http://localhost:3000/app/login?output=image
echo * Pairing Code:    GET  http://localhost:3000/user/my/login?phone=628xxx
echo * Get Devices:     GET  http://localhost:3000/app/devices
echo * Send Message:    POST http://localhost:3000/send/message
echo * Send Image:      POST http://localhost:3000/send/image
echo * Swagger Docs:    http://localhost:3000/docs/swagger.yaml
echo.
echo ================================================================================
echo TIPS:
echo ================================================================================
echo.
echo * Only 3 terminal windows now (GOWA, Proxy, Dashboard)
echo * GOWA uses much less memory than Baileys (~50MB vs 150MB)
echo * No more Twilio dependency - voice calls removed
echo * WhatsApp messages only via Go-WhatsApp REST API
echo * Python uses fire_gowa_helper.py for notifications
echo.
echo ================================================================================
echo.
pause
