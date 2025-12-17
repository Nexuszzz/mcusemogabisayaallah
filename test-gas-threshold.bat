@echo off
echo =========================================
echo Gas Threshold Testing Tool
echo =========================================
echo.
echo ESP32 ADC Range: 0 - 4095 (12-bit)
echo Current default threshold: 3500
echo.

:menu
echo.
echo === THRESHOLD TESTS ===
echo [1] Set Threshold to 1500 (Low - More sensitive)
echo [2] Set Threshold to 2500 (Medium)
echo [3] Set Threshold to 3500 (Default)
echo [4] Set Threshold to 4000 (High)
echo [5] Set Threshold to 4095 (Maximum - Only saturated sensor)
echo.
echo === SIMULATE GAS LEVELS ===
echo [6] Simulate Normal Air (send log with gasA: 500)
echo [7] Simulate Elevated Gas (send log with gasA: 2000)
echo [8] Simulate High Gas (send log with gasA: 3000)
echo [9] Simulate Dangerous Gas (send log with gasA: 4000)
echo [0] Simulate Saturated Sensor (send log with gasA: 4095)
echo.
echo [X] Exit
echo.
set /p choice="Select option: "

if /i "%choice%"=="1" goto thr_1500
if /i "%choice%"=="2" goto thr_2500
if /i "%choice%"=="3" goto thr_3500
if /i "%choice%"=="4" goto thr_4000
if /i "%choice%"=="5" goto thr_4095
if /i "%choice%"=="6" goto sim_500
if /i "%choice%"=="7" goto sim_2000
if /i "%choice%"=="8" goto sim_3000
if /i "%choice%"=="9" goto sim_4000
if /i "%choice%"=="0" goto sim_4095
if /i "%choice%"=="x" goto end
echo Invalid option!
goto menu

:thr_1500
echo.
echo Setting threshold to 1500 (Low sensitivity)
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "nimak/deteksi-api/cmd" -m "THR=1500"
echo ✅ Threshold set to 1500
echo Dashboard will show DANGER if gas >= 1500
goto menu

:thr_2500
echo.
echo Setting threshold to 2500 (Medium sensitivity)
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "nimak/deteksi-api/cmd" -m "THR=2500"
echo ✅ Threshold set to 2500
echo Dashboard will show DANGER if gas >= 2500
goto menu

:thr_3500
echo.
echo Setting threshold to 3500 (Default - Recommended)
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "nimak/deteksi-api/cmd" -m "THR=3500"
echo ✅ Threshold set to 3500
echo Dashboard will show DANGER if gas >= 3500
goto menu

:thr_4000
echo.
echo Setting threshold to 4000 (High sensitivity)
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "nimak/deteksi-api/cmd" -m "THR=4000"
echo ✅ Threshold set to 4000
echo Dashboard will show DANGER if gas >= 4000
goto menu

:thr_4095
echo.
echo Setting threshold to 4095 (Maximum - Only saturated sensor triggers)
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "nimak/deteksi-api/cmd" -m "THR=4095"
echo ✅ Threshold set to 4095
echo ⚠️ Alert only if sensor completely saturated!
goto menu

:sim_500
echo.
echo Simulating Normal Air (gasA: 500)
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/log" -m "{\"id\":\"TEST123\",\"t\":28.5,\"h\":65.0,\"gasA\":500,\"gasMv\":600,\"gasD\":false,\"flame\":false,\"alarm\":false}"
echo ✅ Sent! Dashboard should show SAFE (green)
goto menu

:sim_2000
echo.
echo Simulating Elevated Gas (gasA: 2000)
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/log" -m "{\"id\":\"TEST123\",\"t\":28.5,\"h\":65.0,\"gasA\":2000,\"gasMv\":2300,\"gasD\":false,\"flame\":false,\"alarm\":false}"
echo ✅ Sent! Check dashboard alert status
goto menu

:sim_3000
echo.
echo Simulating High Gas (gasA: 3000)
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/log" -m "{\"id\":\"TEST123\",\"t\":28.5,\"h\":65.0,\"gasA\":3000,\"gasMv\":3200,\"gasD\":true,\"flame\":false,\"alarm\":false}"
echo ✅ Sent! If threshold < 3000, should show DANGER (red)
goto menu

:sim_4000
echo.
echo Simulating Dangerous Gas (gasA: 4000)
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/log" -m "{\"id\":\"TEST123\",\"t\":28.5,\"h\":65.0,\"gasA\":4000,\"gasMv\":3300,\"gasD\":true,\"flame\":false,\"alarm\":true}"
echo ✅ Sent! Should show DANGER (red)
goto menu

:sim_4095
echo.
echo Simulating Saturated Sensor (gasA: 4095 - MAXIMUM!)
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/log" -m "{\"id\":\"TEST123\",\"t\":28.5,\"h\":65.0,\"gasA\":4095,\"gasMv\":3300,\"gasD\":true,\"flame\":false,\"alarm\":true}"
echo ✅ Sent! Should ALWAYS show DANGER (red)
echo ⚠️ Note: Actual gas may be HIGHER than sensor can read!
goto menu

:end
echo.
echo Goodbye! Test summary:
echo - Threshold range: 100 - 4095
echo - Alert triggers: gas >= threshold
echo - Default: 3500 (recommended)
echo.
pause
