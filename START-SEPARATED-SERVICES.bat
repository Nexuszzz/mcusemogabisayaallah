@echo off
title Fire Detection System - Separated Services
color 0B

cls
echo.
echo ================================================================================
echo      FIRE DETECTION SYSTEM - SEPARATED SERVICES (NO CONFLICTS!)
echo ================================================================================
echo.
echo Starting services with SEPARATED architecture:
echo.
echo   [1/5] Proxy Server (Backend + MQTT)       - Port 8080
echo   [2/5] WhatsApp Server (Baileys ONLY)      - Port 3001  (WhatsApp)
echo   [3/5] Voice Call Server (Twilio ONLY)     - Port 3002  (Voice Calls)
echo   [4/5] Dashboard Frontend (Web UI)         - Port 5173
echo   [5/5] Python Fire Detection Script        - Manual start
echo.
echo Benefits of separation:
echo   * WhatsApp and Voice Call are INDEPENDENT
echo   * Easier debugging (separate logs)
echo   * Can restart one without affecting other
echo   * No port conflicts!
echo.
echo ================================================================================
echo.

REM Change to script directory
cd /d "%~dp0"

REM Kill old processes
echo Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 >nul
echo    [OK] Ready to start
echo.

echo ================================================================================
echo [1/5] Starting Proxy Server...
echo ================================================================================
cd proxy-server
start "Proxy Server (8080)" cmd /k "title Proxy Server & npm start"
cd ..
timeout /t 3 /nobreak >nul
echo    [OK] Proxy Server: http://localhost:8080
echo.

echo ================================================================================
echo [2/5] Starting WhatsApp Server (Baileys ONLY)...
echo ================================================================================
cd whatsapp-server
start "WhatsApp Server (3001)" cmd /k "title WhatsApp Server - Baileys & npm start"
cd ..
timeout /t 3 /nobreak >nul
echo    [OK] WhatsApp Server: http://localhost:3001
echo.

echo ================================================================================
echo [3/5] Starting Voice Call Server (Twilio ONLY)...
echo ================================================================================
cd voice-call-server
start "Voice Call Server (3002)" cmd /k "title Voice Call Server - Twilio & npm start"
cd ..
timeout /t 3 /nobreak >nul
echo    [OK] Voice Call Server: http://localhost:3002
echo.

echo ================================================================================
echo [4/5] Starting Dashboard Frontend...
echo ================================================================================
start "Dashboard (5173)" cmd /k "title Dashboard Frontend & npm run dev"
timeout /t 5 /nobreak >nul
echo    [OK] Dashboard: http://localhost:5173
echo.

echo ================================================================================
echo [5/5] Python Fire Detection Script
echo ================================================================================
echo.
echo    [MANUAL STEP] Open NEW terminal and run:
echo.
echo       cd d:\zakaiot
echo       python fire_detect_esp32_ultimate.py
echo.

timeout /t 3 >nul

echo ================================================================================
echo [SUCCESS] ALL SERVICES STARTED!
echo ================================================================================
echo.
echo Service Architecture:
echo ================================================================================
echo.
echo    Port 8080:  Proxy Server (Backend + MQTT)
echo    Port 3001:  WhatsApp Server (Baileys messaging)
echo    Port 3002:  Voice Call Server (Twilio calls)
echo    Port 5173:  Dashboard (Frontend)
echo.
echo    MQTT Broker: 3.27.0.139:1883 (user: zaks)
echo.
echo ================================================================================
echo Verifying Services...
echo ================================================================================
timeout /t 8 /nobreak >nul
echo.

echo [Proxy Server]
curl -s http://localhost:8080/health 2>nul
if %errorlevel% equ 0 (
    echo    [OK] Running
) else (
    echo    [ERROR] Not responding
)

echo.
echo [WhatsApp Server]
curl -s http://localhost:3001/api/whatsapp/status 2>nul | findstr "status" >nul
if %errorlevel% equ 0 (
    echo    [OK] Running
) else (
    echo    [ERROR] Not responding
)

echo.
echo [Voice Call Server]
curl -s http://localhost:3002/health 2>nul | findstr "voice-call-server" >nul
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
echo 2. Configure WhatsApp (if needed)
echo 3. Add WhatsApp recipients
echo 4. Add Emergency call numbers (NEW separated server!)
echo 5. Start fire detection Python script
echo.
echo ================================================================================
echo TIPS:
echo ================================================================================
echo.
echo * You now have 4 terminal windows (Proxy, WhatsApp, Voice Call, Dashboard)
echo * Each service is INDEPENDENT
echo * Voice Call server logs are SEPARATE from WhatsApp
echo * Can restart Voice Call server without affecting WhatsApp!
echo * Much easier to debug!
echo.
echo ================================================================================
echo.
pause
