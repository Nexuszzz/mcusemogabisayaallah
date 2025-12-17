# 📞 Voice Call Setup Guide - Twilio Integration

## 🎯 Overview

Sistem voice call otomatis akan **menelepon nomor darurat** ketika fire detection terjadi. Menggunakan **Twilio API** untuk membuat panggilan telepon dengan pesan suara otomatis.

---

## 🔧 Prerequisites

### 1. Twilio Account
- Buat akun di [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
- **Trial Account**: Gratis $15 credit
- **Limitation**: Hanya bisa call **VERIFIED** numbers

### 2. Twilio Phone Number
- Dapatkan nomor telepon Twilio (gratis untuk trial)
- Dashboard → Phone Numbers → Buy a Number
- Pilih nomor dengan **Voice** capability

### 3. Verify Your Phone Number (PENTING!)
**🚨 TRIAL ACCOUNT WAJIB VERIFY NOMOR TERLEBIH DAHULU!**

```
1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
2. Click "Add a new Caller ID"
3. Enter phone number: +6289677175597 (example)
4. Choose verification method: SMS
5. Enter code received via SMS
6. ✅ Done! You can now receive calls
```

**Without verification, calls will NOT ring even if API succeeds!**

---

## 📝 Step-by-Step Setup

### Step 1: Get Twilio Credentials

```bash
1. Login to Twilio Console: https://console.twilio.com
2. Go to Account Info section
3. Copy these values:
   - Account SID (starts with AC...)
   - Auth Token (click to reveal)
   - Phone Number (your Twilio number)
```

### Step 2: Configure Voice Call Server

Navigate to voice-call-server folder:

```bash
cd d:\IotCobwengdev-backup-20251103-203857\voice-call-server
```

Create `.env` file:

```env
# Voice Call Server Port
VOICE_CALL_PORT=3002

# MQTT Configuration
MQTT_HOST=3.27.0.139
MQTT_PORT=1883
MQTT_USER=zaks
MQTT_PASSWORD=enggangodinginmcu

# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+12174398497

# NOT NEEDED - We use inline TwiML now!
# TWILIO_VOICE_URL=https://demo.twilio.com/welcome/voice/
```

**Important Notes:**
- ✅ `TWILIO_VOICE_URL` is **NO LONGER REQUIRED**
- ✅ System now uses **inline TwiML** (works with localhost)
- ✅ No need for public URL or TwiML Bin
- ✅ Voice message is generated dynamically with fire detection data

### Step 3: Install Dependencies

```bash
npm install
```

Dependencies:
- `twilio` - Twilio SDK
- `mqtt` - MQTT client
- `express` - Web server
- `cors` - CORS handling
- `dotenv` - Environment variables

### Step 4: Start Voice Call Server

```bash
npm start
```

Expected output:
```
============================================================
📞 Voice Call Server (Twilio)
📡 Running on http://localhost:3002
============================================================

✅ Twilio Voice Call initialized
   Phone: +12174398497
✅ MQTT Connected
📥 Subscribed to: lab/zaks/fire_photo
```

---

## 🧪 Testing Voice Call

### Method 1: Using BAT Script (Easiest)

```bash
cd d:\IotCobwengdev-backup-20251103-203857\voice-call-server
TEST-VOICE-CALL.bat
```

Enter your phone number (with country code):
- Indonesia: `+628123456789`
- USA: `+1234567890`

### Method 2: Using Python Script

```bash
cd d:\zakaiot
python test_twilio_fire_alert.py
```

### Method 3: Using curl

```bash
curl -X POST http://localhost:3002/api/voice-call/test \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\":\"+628123456789\"}"
```

### Method 4: Via Dashboard

1. Open http://localhost:5173
2. Go to "Emergency Voice Calls" section
3. Add phone number
4. Click "Test Call"

---

## 🔥 Fire Detection Integration

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│  1. ESP32-CAM detects fire                              │
│     ↓                                                    │
│  2. Python YOLO + Gemini verification                   │
│     ↓                                                    │
│  3. Send to Proxy Server (8080)                         │
│     ↓                                                    │
│  4. Proxy publishes MQTT: lab/zaks/fire_photo          │
│     ↓                                                    │
│  5. Voice Call Server receives MQTT                     │
│     ↓                                                    │
│  6. Make emergency calls with fire details              │
│     - Confidence percentage                             │
│     - Camera location                                   │
│     - Timestamp                                         │
└─────────────────────────────────────────────────────────┘
```

### Voice Message Format

When fire detected, recipients will hear:

```
"Emergency Alert! Fire detected with 89 percent confidence 
at ESP32 Camera Lab. This is an automated emergency call 
from the Fire Detection System. Please check the camera 
location immediately and take appropriate action. Fire 
confidence level is 89 percent."

[1 second pause]

"I repeat: Fire detected at ESP32 Camera Lab. 
Confidence: 89 percent. Respond immediately!"
```

### Add Emergency Numbers

Via Dashboard:
```
1. Open http://localhost:5173
2. Go to "Emergency Voice Calls" section
3. Click "Add Number"
4. Enter phone number: +6289677175597
5. Enter name: "Security Team"
6. Save
```

Via API:
```bash
curl -X POST http://localhost:3002/api/voice-call/numbers \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\":\"+6289677175597\",\"name\":\"Security Team\"}"
```

---

## 🎛️ Configuration Options

### Cooldown Settings

**Default:** 120 seconds (2 minutes) between calls

To change, edit `voice-call-server/server.js`:

```javascript
const VOICE_CALL_COOLDOWN = 120000; // milliseconds
```

Recommended values:
- Testing: `30000` (30 seconds)
- Production: `120000` (2 minutes)
- Critical: `60000` (1 minute)

### Voice Settings

TwiML message is in `handleFireDetectionWithVoiceCall()` function.

Available voices:
- `Polly.Joanna` (Female, English - US)
- `Polly.Matthew` (Male, English - US)
- `Polly.Aditi` (Female, Hindi/Indian English)

For Indonesian:
```xml
<Say voice="Polly.Joanna" language="id-ID">
  Darurat! Kebakaran terdeteksi!
</Say>
```

---

## 📊 API Endpoints

### Health Check
```
GET http://localhost:3002/health

Response:
{
  "status": "ok",
  "service": "voice-call-server",
  "port": 3002,
  "twilioEnabled": true,
  "mqttConnected": true,
  "emergencyNumbersCount": 2
}
```

### Get Emergency Numbers
```
GET http://localhost:3002/api/voice-call/numbers

Response:
{
  "success": true,
  "numbers": [
    {
      "id": "1699123456789",
      "phoneNumber": "+6289677175597",
      "name": "Security Team",
      "addedAt": 1699123456789
    }
  ],
  "twilioEnabled": true,
  "cooldown": 120
}
```

### Add Emergency Number
```
POST http://localhost:3002/api/voice-call/numbers
Content-Type: application/json

{
  "phoneNumber": "+6289677175597",
  "name": "Security Team"
}
```

### Remove Emergency Number
```
DELETE http://localhost:3002/api/voice-call/numbers/:id
```

### Test Call
```
POST http://localhost:3002/api/voice-call/test
Content-Type: application/json

{
  "phoneNumber": "+6289677175597",
  "message": "Custom test message (optional)"
}
```

---

## 🐛 Troubleshooting

### Issue 1: Call Not Received

**Problem:** API succeeds but phone doesn't ring

**Solution:**
1. **Check if number is verified** (trial accounts only)
   - Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
   - Your number MUST be in the list
   
2. **Check Twilio logs:**
   - https://console.twilio.com/us1/monitor/logs/calls
   - Look for "unverified" or "blocked" status

3. **Verify phone number format:**
   - Must include country code: `+628xxx`
   - No spaces or dashes

### Issue 2: "Twilio not enabled"

**Problem:** Server shows "Twilio not enabled"

**Solution:**
1. Check `.env` file exists in `voice-call-server/`
2. Verify all credentials are set:
   ```bash
   TWILIO_ACCOUNT_SID=ACxxxxx (starts with AC)
   TWILIO_AUTH_TOKEN=xxxxx
   TWILIO_PHONE_NUMBER=+1234567890
   ```
3. Restart server: `Ctrl+C` then `npm start`

### Issue 3: MQTT Not Receiving

**Problem:** Fire detected but no calls made

**Solution:**
1. Check MQTT connection:
   ```bash
   curl http://localhost:3002/health
   # Check "mqttConnected": true
   ```

2. Verify MQTT credentials in `.env`:
   ```
   MQTT_HOST=3.27.0.139
   MQTT_USER=zaks
   MQTT_PASSWORD=enggangodinginmcu
   ```

3. Check if proxy server is publishing:
   - Open proxy-server logs
   - Look for "Fire photo published to MQTT"

### Issue 4: "Carrier Block" or "Busy"

**Problem:** Call status shows "busy"

**Solution:**
1. **Indonesian carriers may block US numbers** (+1)
2. Solutions:
   - Buy Indonesian Twilio number (+62)
   - Use WhatsApp as primary alert
   - Test with US/verified numbers first

### Issue 5: No Emergency Numbers

**Problem:** "No emergency call numbers configured"

**Solution:**
1. Add numbers via dashboard: http://localhost:5173
2. Or via API (see "Add Emergency Number" section)
3. Check file exists: `voice-call-server/emergency-call-numbers.json`

---

## 💰 Twilio Pricing

### Trial Account
- ✅ Free $15 credit
- ✅ Unlimited incoming calls
- ❌ Can only call **verified** numbers
- ❌ Calls show "Twilio Trial" caller ID

### Paid Account
- ✅ Call **any** number (no verification needed)
- ✅ Custom caller ID
- ✅ $20 minimum top-up
- 💰 Pricing:
  - Outbound calls (US): $0.013/min
  - Outbound calls (Indonesia): $0.048/min
  - Phone number rental: $1/month

**Recommendation:**
- Development: Use trial (verify your test numbers)
- Production: Upgrade to paid ($20 minimum)

---

## 🎯 Best Practices

### 1. Cooldown Configuration
- Set appropriate cooldown to prevent spam
- Recommended: 2 minutes between calls
- Consider phone bill costs

### 2. Emergency Numbers
- Add multiple contacts (security, manager, fire dept)
- Test all numbers before production
- Keep list updated

### 3. Voice Message
- Keep message clear and concise
- Include: confidence level, location, action needed
- Consider bilingual messages (English + Indonesian)

### 4. Monitoring
- Check Twilio Console regularly
- Monitor call success rate
- Review call logs for failed attempts

### 5. Backup Alerts
- Don't rely only on voice calls
- Also use: WhatsApp, MQTT buzzer, dashboard
- Multi-channel alerts = better response

---

## 📈 Integration Checklist

- [ ] Twilio account created
- [ ] Phone numbers verified (trial) or account upgraded
- [ ] `.env` file configured with credentials
- [ ] Voice call server started successfully
- [ ] MQTT connection established
- [ ] Emergency numbers added
- [ ] Test call successful
- [ ] Fire detection tested end-to-end
- [ ] Monitoring setup (Twilio Console)
- [ ] Team trained on how system works

---

## 🔗 Useful Links

- **Twilio Console:** https://console.twilio.com
- **Verify Numbers:** https://console.twilio.com/us1/develop/phone-numbers/manage/verified
- **Call Logs:** https://console.twilio.com/us1/monitor/logs/calls
- **TwiML Reference:** https://www.twilio.com/docs/voice/twiml
- **Pricing:** https://www.twilio.com/voice/pricing

---

## 🎉 Success Criteria

Your voice call system is working correctly when:

✅ Test call reaches your phone and you hear the message
✅ Fire detection triggers automatic calls
✅ Emergency contacts receive calls within 10 seconds
✅ Voice message is clear with fire detection details
✅ Cooldown prevents excessive calls
✅ All calls logged in Twilio Console

---

**Made with 🔥 for Fire Detection System**
