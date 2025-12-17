@echo off
title Fire Detection System - Automated Installation
color 0A

cls
echo.
echo ================================================================================
echo      FIRE DETECTION SYSTEM - AUTOMATED INSTALLATION
echo ================================================================================
echo.
echo This script will:
echo   [1] Install npm dependencies for all 4 components
echo   [2] Create .env configuration templates
echo   [3] Setup initial configuration files
echo.
echo ================================================================================
echo.

REM Change to script directory
cd /d "%~dp0"

REM Check Node.js
echo [Step 1/5] Checking Prerequisites...
echo ================================================================================
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo    [ERROR] Node.js not found! Please install Node.js first.
    echo    Download: https://nodejs.org/
    pause
    exit /b 1
)

echo    [OK] Node.js: 
node --version

npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo    [ERROR] npm not found!
    pause
    exit /b 1
)

echo    [OK] npm: 
npm --version
echo.

timeout /t 2 >nul

REM Install Dependencies
echo.
echo [Step 2/5] Installing Dependencies...
echo ================================================================================
echo.

echo [1/4] Installing ROOT project dependencies...
call npm install
if %errorlevel% neq 0 (
    echo    [ERROR] Failed to install root dependencies!
    pause
    exit /b 1
)
echo    [OK] Root dependencies installed
echo.

echo [2/4] Installing PROXY SERVER dependencies...
cd proxy-server
call npm install
if %errorlevel% neq 0 (
    echo    [ERROR] Failed to install proxy-server dependencies!
    cd ..
    pause
    exit /b 1
)
echo    [OK] Proxy server dependencies installed
cd ..
echo.

echo [3/4] Installing WHATSAPP SERVER dependencies...
cd whatsapp-server
call npm install
if %errorlevel% neq 0 (
    echo    [ERROR] Failed to install whatsapp-server dependencies!
    cd ..
    pause
    exit /b 1
)
echo    [OK] WhatsApp server dependencies installed
cd ..
echo.

echo [4/4] Installing VOICE CALL SERVER dependencies...
cd voice-call-server
call npm install
if %errorlevel% neq 0 (
    echo    [ERROR] Failed to install voice-call-server dependencies!
    cd ..
    pause
    exit /b 1
)
echo    [OK] Voice call server dependencies installed
cd ..
echo.

timeout /t 2 >nul

REM Create .env files
echo.
echo [Step 3/5] Creating Configuration Files...
echo ================================================================================
echo.

REM Root .env
if not exist .env (
    echo Creating root .env...
    copy .env.example .env >nul 2>&1
    if exist .env.example (
        echo    [OK] Created .env from .env.example
    ) else (
        echo    [WARNING] .env.example not found, creating new .env
        (
            echo # MQTT Proxy Configuration
            echo VITE_MQTT_URL=ws://localhost:8080/ws
            echo VITE_MQTT_USERNAME=zaks
            echo VITE_MQTT_PASSWORD=enggangodinginmcu
            echo.
            echo # MQTT Topics
            echo VITE_TOPIC_EVENT=lab/zaks/event
            echo VITE_TOPIC_LOG=lab/zaks/log
            echo VITE_TOPIC_STATUS=lab/zaks/status
            echo VITE_TOPIC_ALERT=lab/zaks/alert
            echo VITE_TOPIC_CMD=nimak/deteksi-api/cmd
            echo.
            echo # Data Retention
            echo VITE_MAX_DATA_POINTS=10000
            echo.
            echo # Security
            echo ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
        ) > .env
        echo    [OK] Created .env with defaults
    )
) else (
    echo    [SKIP] .env already exists
)
echo.

REM Proxy Server .env
cd proxy-server
if not exist .env (
    echo Creating proxy-server .env...
    copy .env.example .env >nul 2>&1
    if exist .env.example (
        echo    [OK] Created proxy-server/.env from .env.example
    ) else (
        (
            echo # MQTT Broker Configuration
            echo MQTT_HOST=3.27.0.139
            echo MQTT_PORT=1883
            echo MQTT_USERNAME=zaks
            echo MQTT_PASSWORD=enggangodinginmcu
            echo.
            echo # Proxy Server Port
            echo PROXY_PORT=8080
            echo.
            echo # MQTT Topics
            echo TOPIC_EVENT=lab/zaks/event
            echo TOPIC_LOG=lab/zaks/log
            echo TOPIC_STATUS=lab/zaks/status
            echo TOPIC_ALERT=lab/zaks/alert
            echo TOPIC_ALL=lab/zaks/#
            echo.
            echo # Security
            echo ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
        ) > .env
        echo    [OK] Created proxy-server/.env with defaults
    )
) else (
    echo    [SKIP] proxy-server/.env already exists
)
cd ..
echo.

REM WhatsApp Server .env
cd whatsapp-server
if not exist .env (
    echo Creating whatsapp-server .env...
    copy .env.example .env >nul 2>&1
    if exist .env.example (
        echo    [OK] Created whatsapp-server/.env from .env.example
    ) else (
        (
            echo # WhatsApp Server Port
            echo WA_PORT=3001
            echo.
            echo # WhatsApp Browser Config
            echo WA_BROWSER_NAME=Fire Detection System
            echo WA_BROWSER_TYPE=Chrome
            echo WA_BROWSER_VERSION=110.0.0
            echo.
            echo # MQTT Configuration
            echo MQTT_HOST=3.27.0.139
            echo MQTT_PORT=1883
            echo MQTT_USER=zaks
            echo MQTT_PASSWORD=your-password-here
            echo MQTT_TOPIC_EVENT=lab/zaks/event
            echo MQTT_TOPIC_ALERT=lab/zaks/alert
            echo.
            echo # Twilio ^(Optional - for voice calls^)
            echo TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
            echo TWILIO_AUTH_TOKEN=your_auth_token_here
            echo TWILIO_PHONE_NUMBER=+1234567890
            echo TWILIO_VOICE_URL=https://demo.twilio.com/welcome/voice/
            echo.
            echo # Security
            echo ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
            echo.
            echo # Logging
            echo LOG_LEVEL=silent
        ) > .env
        echo    [OK] Created whatsapp-server/.env with defaults
    )
) else (
    echo    [SKIP] whatsapp-server/.env already exists
)
cd ..
echo.

REM Voice Call Server .env
cd voice-call-server
if not exist .env (
    echo Creating voice-call-server .env...
    copy .env.example .env >nul 2>&1
    if exist .env.example (
        echo    [OK] Created voice-call-server/.env from .env.example
    ) else (
        (
            echo # Voice Call Server Port
            echo VOICE_CALL_PORT=3002
            echo.
            echo # MQTT Configuration
            echo MQTT_HOST=3.27.0.139
            echo MQTT_PORT=1883
            echo MQTT_USER=zaks
            echo MQTT_PASSWORD=your-password-here
            echo MQTT_TOPIC_ALERT=lab/zaks/alert
            echo.
            echo # Twilio Configuration ^(REQUIRED^)
            echo TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
            echo TWILIO_AUTH_TOKEN=your_auth_token_here
            echo TWILIO_PHONE_NUMBER=+1234567890
            echo TWILIO_VOICE_URL=https://demo.twilio.com/welcome/voice/
            echo.
            echo # Security
            echo ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
        ) > .env
        echo    [OK] Created voice-call-server/.env with defaults
    )
) else (
    echo    [SKIP] voice-call-server/.env already exists
)
cd ..
echo.

timeout /t 2 >nul

REM Create uploads directory
echo.
echo [Step 4/5] Creating Required Directories...
echo ================================================================================
cd proxy-server
if not exist uploads mkdir uploads
echo    [OK] Created proxy-server/uploads directory
cd ..
echo.

timeout /t 2 >nul

REM Summary
echo.
echo [Step 5/5] Installation Summary
echo ================================================================================
echo.
echo    [OK] Root dependencies installed
echo    [OK] Proxy server dependencies installed
echo    [OK] WhatsApp server dependencies installed
echo    [OK] Voice call server dependencies installed
echo    [OK] Configuration files created
echo    [OK] Required directories created
echo.
echo ================================================================================
echo [SUCCESS] INSTALLATION COMPLETE!
echo ================================================================================
echo.
echo NEXT STEPS:
echo.
echo 1. EDIT CONFIGURATION FILES (IMPORTANT!):
echo    - Edit .env in root folder
echo    - Edit proxy-server\.env
echo    - Edit whatsapp-server\.env (update MQTT password)
echo    - Edit voice-call-server\.env (add Twilio credentials if needed)
echo.
echo 2. VERIFY MQTT BROKER:
echo    - Ensure MQTT broker at 3.27.0.139:1883 is accessible
echo    - Or change to localhost if using local Mosquitto
echo.
echo 3. START SERVICES:
echo    - Run: START-SEPARATED-SERVICES.bat
echo    - Or start manually one by one
echo.
echo 4. ACCESS DASHBOARD:
echo    - Open: http://localhost:5173
echo.
echo ================================================================================
echo CONFIGURATION NOTES:
echo ================================================================================
echo.
echo * MQTT password in .env files: Update "your-password-here" with real password
echo * Twilio credentials: Add if you want voice call feature
echo * WhatsApp: Configure after starting services via dashboard
echo.
echo ================================================================================
echo.
pause
