@echo off
chcp 65001 >nul
cls
color 0B

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                                                                ║
echo ║        🚀 CONNECT TO EC2 VIA VS CODE REMOTE SSH                ║
echo ║                                                                ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo.
echo ✅ Extension Remote-SSH sudah diinstall!
echo ✅ SSH config sudah dibuat di: %USERPROFILE%\.ssh\config
echo.
echo Target Server:
echo   Host: ec2-fire-detection
echo   IP: 3.27.0.139
echo   User: ubuntu
echo.
echo ════════════════════════════════════════════════════════════════
echo.
echo CARA CONNECT:
echo.
echo 1. Tekan F1 di VS Code
echo.
echo 2. Ketik: Remote-SSH: Connect to Host
echo.
echo 3. Pilih: ec2-fire-detection
echo.
echo 4. Tunggu VS Code connect ke server
echo.
echo 5. Setelah terconnect, buka Terminal (Ctrl + `)
echo.
echo 6. Jalankan commands deployment:
echo.
echo    cd ~
echo    git clone https://github.com/Nexuszzz/sudahtapibelum.git
echo    cd sudahtapibelum
echo    chmod +x deploy-to-ec2.sh
echo    ./deploy-to-ec2.sh
echo.
echo ════════════════════════════════════════════════════════════════
echo.
echo 💡 TIP: Copy command ini untuk quick deploy:
echo.
echo cd ~ ^&^& git clone https://github.com/Nexuszzz/sudahtapibelum.git ^&^& cd sudahtapibelum ^&^& chmod +x deploy-to-ec2.sh ^&^& ./deploy-to-ec2.sh
echo.
echo ════════════════════════════════════════════════════════════════
echo.
echo.

set /p open="Press Enter to open VS Code Command Palette..."

echo.
echo ⚠️  JIKA MUNCUL ERROR "PERMISSION DENIED":
echo.
echo   Itu berarti file .ppk tidak cocok dengan EC2 ini.
echo   Coba file .ppk lain:
echo     - zakaaws.ppk
echo     - zam.ppk
echo.
echo   Edit file: C:\Users\NAUFAL\.ssh\config
echo   Ganti IdentityFile dengan file .ppk yang benar
echo.
echo ════════════════════════════════════════════════════════════════
echo.
pause
