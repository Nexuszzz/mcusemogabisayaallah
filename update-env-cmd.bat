@echo off
REM Update .env file dengan command topic

echo Updating .env file with command topic...

(
echo # MQTT Broker Configuration
echo # IMPORTANT: Connect to PROXY SERVER, not directly to broker
echo # Proxy server handles TCP to WebSocket conversion
echo VITE_MQTT_URL=ws://localhost:8080/ws
echo VITE_MQTT_USERNAME=zaks
echo VITE_MQTT_PASSWORD=enggangodinginmcu
echo.
echo # MQTT Topics
echo VITE_TOPIC_EVENT=lab/zaks/event
echo VITE_TOPIC_LOG=lab/zaks/log
echo VITE_TOPIC_STATUS=lab/zaks/status
echo VITE_TOPIC_ALERT=lab/zaks/alert
echo # Command topic ^(ESP32 subscribe^)
echo VITE_TOPIC_CMD=nimak/deteksi-api/cmd
echo.
echo # Optional: Data retention ^(number of data points to keep in memory^)
echo VITE_MAX_DATA_POINTS=10000
) > .env

echo.
echo ✅ .env updated successfully!
echo.
echo Command topic: nimak/deteksi-api/cmd
echo.
pause
