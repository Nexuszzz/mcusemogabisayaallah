@echo off
REM Fix .env file to connect to proxy server
echo Updating .env file...

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
echo.
echo # Optional: Data retention ^(number of data points to keep in memory^)
echo VITE_MAX_DATA_POINTS=10000
) > .env

echo.
echo ✅ .env file updated successfully!
echo.
echo Frontend will now connect to: ws://localhost:8080/ws
echo.
echo Please restart the dashboard: npm run dev
pause
