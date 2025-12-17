@echo off
REM Test fire event notification

echo =========================================
echo Testing Fire Event Notification
echo =========================================
echo.
echo Sending flame_on event to lab/zaks/event...
echo.

mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/event" -m "{\"event\":\"flame_on\"}"

echo.
echo Event sent! Check your dashboard for notification.
echo.
pause
