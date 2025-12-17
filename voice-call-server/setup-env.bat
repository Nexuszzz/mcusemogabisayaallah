@echo off
echo Setting up Voice Call Server .env file...
(
echo VOICE_CALL_PORT=3002
echo.
echo MQTT_HOST=3.27.0.139
echo MQTT_PORT=1883
echo MQTT_USER=zaks
echo MQTT_PASSWORD=enggangodinginmcu
echo.
echo ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
echo.
echo TWILIO_ACCOUNT_SID=your_account_sid_here
echo TWILIO_AUTH_TOKEN=your_auth_token_here
echo TWILIO_PHONE_NUMBER=+1234567890
echo TWILIO_VOICE_URL=https://demo.twilio.com/welcome/voice/
) > .env

echo Done! .env file created.
