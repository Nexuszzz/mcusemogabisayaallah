@echo off
echo =========================================
echo ESP32 Buzzer Control Test
echo =========================================
echo.
echo Command topic: nimak/deteksi-api/cmd
echo ESP32 will receive these commands
echo.

:menu
echo.
echo [1] Buzzer ON
echo [2] Buzzer OFF
echo [3] Set Threshold to 1500
echo [4] Set Threshold to 2500
echo [5] Set Threshold to 3500
echo [6] Exit
echo.
set /p choice="Select option (1-6): "

if "%choice%"=="1" goto buzzer_on
if "%choice%"=="2" goto buzzer_off
if "%choice%"=="3" goto thr_1500
if "%choice%"=="4" goto thr_2500
if "%choice%"=="5" goto thr_3500
if "%choice%"=="6" goto end
echo Invalid option!
goto menu

:buzzer_on
echo.
echo Sending: BUZZER_ON
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "nimak/deteksi-api/cmd" -m "BUZZER_ON"
echo ✅ Command sent!
goto menu

:buzzer_off
echo.
echo Sending: BUZZER_OFF
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "nimak/deteksi-api/cmd" -m "BUZZER_OFF"
echo ✅ Command sent!
goto menu

:thr_1500
echo.
echo Sending: THR=1500
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "nimak/deteksi-api/cmd" -m "THR=1500"
echo ✅ Threshold set to 1500
goto menu

:thr_2500
echo.
echo Sending: THR=2500
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "nimak/deteksi-api/cmd" -m "THR=2500"
echo ✅ Threshold set to 2500
goto menu

:thr_3500
echo.
echo Sending: THR=3500
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "nimak/deteksi-api/cmd" -m "THR=3500"
echo ✅ Threshold set to 3500
goto menu

:end
echo.
echo Goodbye!
pause
