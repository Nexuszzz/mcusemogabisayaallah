@echo off
echo =========================================
echo Clear Retained MQTT Messages
echo =========================================
echo.
echo This will clear any retained messages in lab/zaks topics
echo to prevent old events from triggering notifications.
echo.
pause

echo.
echo Clearing lab/zaks/event...
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/event" -r -n

echo Clearing lab/zaks/alert...
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/alert" -r -n

echo Clearing lab/zaks/log...
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/log" -r -n

echo.
echo ✅ Retained messages cleared!
echo.
echo Status topic (lab/zaks/status) not cleared - it's the LWT topic.
echo.
pause
