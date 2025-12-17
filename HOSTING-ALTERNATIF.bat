@echo off
chcp 65001 >nul
cls
color 0B

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                                                                ║
echo ║        🌐 HOSTING ALTERNATIF - TANPA EC2!                     ║
echo ║                                                                ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo.
echo Karena EC2 SSH bermasalah, mari coba cara lain:
echo.
echo ════════════════════════════════════════════════════════════════
echo.
echo PILIH METODE HOSTING:
echo.
echo   [1] 🚀 VERCEL - Hosting Gratis (Recommended)
echo       • Deploy otomatis dari GitHub
echo       • URL permanen (https://yourproject.vercel.app)
echo       • SSL/HTTPS gratis
echo       • Serverless functions
echo       • Setup: 2 menit
echo.
echo   [2] 🌐 NGROK - Instant Public URL
echo       • Share laptop Anda ke internet
echo       • URL sementara (berubah setiap restart)
echo       • Cocok untuk demo/testing
echo       • Setup: 30 detik
echo.
echo   [3] 📦 NETLIFY - Hosting Gratis
echo       • Deploy dari GitHub
echo       • URL permanen
echo       • SSL/HTTPS gratis
echo       • Setup: 2 menit
echo.
echo   [4] 🔧 LOCAL TESTING
echo       • Test di localhost dulu
echo       • Tidak public
echo.
echo   [5] ❌ Exit
echo.
echo ════════════════════════════════════════════════════════════════
echo.
set /p choice="Pilih [1-5]: "

if "%choice%"=="1" goto VERCEL
if "%choice%"=="2" goto NGROK
if "%choice%"=="3" goto NETLIFY
if "%choice%"=="4" goto LOCAL
if "%choice%"=="5" goto EXIT

:VERCEL
cls
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║              🚀 DEPLOY TO VERCEL                               ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo Starting Vercel deployment...
echo.
powershell -ExecutionPolicy Bypass -File ".\deploy-vercel.ps1"
pause
goto END

:NGROK
cls
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║              🌐 NGROK PUBLIC URL                               ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo Creating public URL...
echo.
powershell -ExecutionPolicy Bypass -File ".\deploy-ngrok.ps1"
pause
goto END

:NETLIFY
cls
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║              📦 DEPLOY TO NETLIFY                              ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo.
echo CARA DEPLOY KE NETLIFY:
echo ════════════════════════════════════════════════════════════════
echo.
echo 1. Buka: https://www.netlify.com/
echo.
echo 2. Sign up dengan GitHub account
echo.
echo 3. Klik "Add new site" → "Import an existing project"
echo.
echo 4. Connect to GitHub → Pilih repository: sudahtapibelum
echo.
echo 5. Build settings:
echo    • Build command: npm run build
echo    • Publish directory: dist
echo.
echo 6. Klik "Deploy site"
echo.
echo 7. Tunggu 2-3 menit
echo.
echo 8. Website live di: https://yourproject.netlify.app
echo.
echo ════════════════════════════════════════════════════════════════
echo.
echo Opening Netlify...
timeout /t 2 >nul
start https://www.netlify.com/
echo.
pause
goto END

:LOCAL
cls
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║              🔧 LOCAL TESTING                                  ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo Starting local servers...
echo.

echo [1/2] Starting proxy server...
start "Proxy Server" cmd /k "cd proxy-server && npm start"

timeout /t 5 >nul

echo [2/2] Starting Vite dev server...
start "Vite Dev Server" cmd /k "npm run dev"

timeout /t 5 >nul

echo.
echo ✅ Servers started!
echo.
echo Open browser: http://localhost:5174
echo Login: admin / admin123
echo.
echo Press any key to open browser...
pause >nul
start http://localhost:5174
goto END

:EXIT
exit

:END
echo.
echo.
echo ════════════════════════════════════════════════════════════════
echo.
echo 💡 REKOMENDASI:
echo.
echo   • VERCEL/NETLIFY untuk production (gratis, permanen)
echo   • NGROK untuk demo cepat (gratis, sementara)
echo   • LOCAL untuk testing
echo.
echo ════════════════════════════════════════════════════════════════
echo.
pause
