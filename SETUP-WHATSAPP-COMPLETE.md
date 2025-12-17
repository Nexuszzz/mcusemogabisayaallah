# 🚀 Complete Setup Guide - WhatsApp Integration

## 📋 Prerequisites

- ✅ Node.js 18+ installed
- ✅ npm or yarn
- ✅ WhatsApp account (personal)
- ✅ Active internet connection
- ✅ MQTT broker running (3.27.0.139:1883)

---

## 🎯 Step-by-Step Installation

### **Step 1: Install Main Project Dependencies**
```bash
cd D:\IotCobwengdev
npm install
```

### **Step 2: Install WhatsApp Server Dependencies**
```bash
.\install-whatsapp-server.bat
```

Or manually:
```bash
cd whatsapp-server
npm install
cd ..
```

### **Step 3: Start MQTT Broker (if not running)**
```bash
# Your MQTT broker should be running
# Default: 3.27.0.139:1883
```

### **Step 4: Start Proxy Server (if needed)**
```bash
.\start-proxy.bat
```

### **Step 5: Start WhatsApp Server**
```bash
.\start-whatsapp-server.bat
```

Server akan running di **http://localhost:3001**

Console output:
```
============================================================
🚀 WhatsApp Baileys Server
📡 Running on http://localhost:3001
============================================================

✅ MQTT Connected
```

### **Step 6: Start Dashboard**
Buka terminal baru:
```bash
npm run dev
```

Dashboard akan running di **http://localhost:5173**

---

## 📱 Connect WhatsApp

### **Method: Pairing Code (Recommended)**

1. **Buka Dashboard**
   - Navigate ke **http://localhost:5173**
   - Klik tab **WhatsApp** di header

2. **Enter Phone Number**
   - Format: `628123456789` (tanpa + atau spasi)
   - Contoh: `6281234567890`

3. **Start Connection**
   - Klik tombol **Start WhatsApp**
   - Tunggu 3-5 detik

4. **Pairing Code Appears**
   ```
   ┌──────────────────────────┐
   │    Pairing Code          │
   │                          │
   │      A B C D - E F G H   │
   │                          │
   └──────────────────────────┘
   ```

5. **Link di WhatsApp**
   - Buka WhatsApp di smartphone
   - Tap **⚙️ Settings** (atau **☰ Menu**)
   - Tap **Linked Devices**
   - Tap **Link a Device**
   - Tap **Link with phone number instead**
   - Masukkan pairing code (8 karakter)
   - Tap **Link**

6. **Wait for Sync**
   ```
   Status: Syncing... 50%
   ```
   - Proses sync memakan waktu 10-30 detik
   - Tergantung jumlah chat history

7. **Connected! ✅**
   ```
   Status: WhatsApp Connected
   Phone: 628123456789
   ```

---

## 👥 Add Recipients

1. **Click Add Button**
   - Di panel **Recipients**
   - Klik tombol **Add** (ikon UserPlus)

2. **Enter Details**
   ```
   Phone Number: 6281234567890
   Name: John Doe (optional)
   ```

3. **Save**
   - Klik **Add Recipient**
   - Recipient akan muncul di list

4. **Test Send (Optional)**
   - Hover pada recipient card
   - Klik icon **Send** (paper plane)
   - Recipient akan terima message:
     ```
     ✅ STATUS AMAN
     
     Sistem fire detection aktif dan tidak mendeteksi ancaman.
     Semua sensor dalam kondisi normal.
     
     ⏰ 29/10/2025, 11:45:30
     ```

---

## 🔥 Test Fire Alert

### **Simulate Fire Detection**

1. **Trigger Fire Event** (via MQTT)
   ```bash
   mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P enggangodinginmcu -t "lab/zaks/alert" -m '{"alert":"flame","conf":0.85,"level":"CRITICAL","temperature":45,"humidity":30,"gas":850,"gemini":true,"ts":1730172330}'
   ```

2. **Check Recipients WhatsApp**
   Recipients akan menerima:
   ```
   🔥 DETEKSI KEBAKARAN 🔴 BAHAYA!

   📊 Data Sensor:
   🌡️ Suhu: 45°C
   💧 Kelembapan: 30%
   ☁️ Gas: 850 ppm

   🎯 Deteksi:
   • Confidence: 85.0%
   • Level: CRITICAL
   • ✅ Verified by AI

   ⏰ Waktu: 29/10/2025, 11:45:30

   ⚠️ SEGERA CEK RUANGAN!
   ```

---

## 🎨 UI Features

### **Status Indicators**
- 🟢 **Connected** - Green badge with pulse animation
- 🟡 **Connecting** - Yellow with spinner
- 🔵 **Syncing** - Blue with progress bar
- 🔴 **Error** - Red alert
- ⚫ **Disconnected** - Gray

### **Navigation**
- **Dashboard Tab** - Main monitoring page
- **WhatsApp Tab** - Integration page

### **Dark Theme**
- Modern dark color scheme
- Gradient backgrounds
- Glass morphism effects
- Smooth animations

---

## 🔧 Configuration

### **WhatsApp Server Config**
File: `whatsapp-server/server.js`

```javascript
// MQTT Config
const MQTT_CONFIG = {
  host: '3.27.0.139',
  port: 1883,
  username: 'zaks',
  password: 'enggangodinginmcu',
  topic_event: 'lab/zaks/event',
  topic_alert: 'lab/zaks/alert',
};

// Server Port
const PORT = 3001;
```

### **Frontend Config**
File: `src/components/WhatsAppIntegration.tsx`

```typescript
const API_BASE = 'http://localhost:3001/api/whatsapp';
```

---

## 🐛 Common Issues & Solutions

### **Issue 1: "Cannot find module '@whiskeysockets/baileys'"**

**Solution:**
```bash
cd whatsapp-server
npm install
```

### **Issue 2: "Port 3001 already in use"**

**Solution:**
```bash
# Find process
netstat -ano | findstr :3001

# Kill process
taskkill /PID <PID> /F
```

Or change port in `server.js`:
```javascript
const PORT = 3002; // Change to available port
```

### **Issue 3: "Pairing code not showing"**

**Checklist:**
- ✅ Server running? Check console
- ✅ Phone number correct? Format: 628xxx
- ✅ Wait 3-5 seconds after clicking Start
- ✅ Check browser console (F12) for errors

**Try:**
1. Refresh page
2. Restart server
3. Check server logs

### **Issue 4: "Connection keeps disconnecting"**

**Causes:**
- Weak internet connection
- WhatsApp servers busy
- Too many requests

**Solutions:**
- Check internet stability
- Wait 5 minutes and retry
- Delete session and reconnect

### **Issue 5: "Messages not sending"**

**Checklist:**
- ✅ WhatsApp status Connected?
- ✅ Recipient number correct?
- ✅ MQTT connected?
- ✅ Check server console logs

**Try:**
1. Test send to 1 recipient
2. Verify recipient number format (628xxx)
3. Check MQTT broker connection
4. Restart WhatsApp server

### **Issue 6: "Session deleted after restart"**

**Prevent:**
- ✅ Don't delete `whatsapp-server/auth_info` folder
- ✅ Add to .gitignore
- ✅ Backup regularly

**Session Location:**
```
whatsapp-server/
└── auth_info/
    ├── creds.json
    └── [other session files]
```

---

## 📊 API Testing

### **Using curl**

**Get Status:**
```bash
curl http://localhost:3001/api/whatsapp/status
```

**Start Connection:**
```bash
curl -X POST http://localhost:3001/api/whatsapp/start \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\": \"628123456789\"}"
```

**Add Recipient:**
```bash
curl -X POST http://localhost:3001/api/whatsapp/recipients \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\": \"6281234567890\", \"name\": \"John Doe\"}"
```

**Get Recipients:**
```bash
curl http://localhost:3001/api/whatsapp/recipients
```

---

## 🔒 Security Best Practices

### **DO ✅**
- Use personal WhatsApp number
- Limit recipients (<50 recommended)
- Monitor for ban warnings
- Backup session regularly
- Use delay between messages (auto-handled)

### **DON'T ❌**
- Send spam messages
- Use for mass marketing
- Share session with others
- Exceed WhatsApp limits
- Use Business API number

### **WhatsApp Limits**
- Max messages per day: ~1000
- Max recipients per message: 256 (we send individual)
- Cooldown: Auto-handled in server

---

## 📈 Performance

### **Resource Usage**
- **Server RAM:** ~100-150MB
- **CPU:** <5% idle, <20% active
- **Network:** ~1-2 Mbps during sync

### **Response Times**
- Pairing code: 3-5 seconds
- Message send: 1-3 seconds
- Sync time: 10-30 seconds (depends on chat history)

---

## 🔄 Backup & Restore

### **Backup Session**
```bash
# Copy auth_info folder
xcopy /E /I whatsapp-server\auth_info backup\auth_info_2025-10-29
```

### **Restore Session**
```bash
# Stop server first
# Delete current auth_info
rmdir /S /Q whatsapp-server\auth_info

# Restore from backup
xcopy /E /I backup\auth_info_2025-10-29 whatsapp-server\auth_info

# Start server
.\start-whatsapp-server.bat
```

---

## 📝 Logs

### **Server Logs**
Location: Console output

Monitor:
```
✅ MQTT Connected
📱 Requesting pairing code for 628xxx...
🔑 Pairing Code: ABCD-EFGH
✅ WhatsApp Connected!
📨 Message received: 628xxx@s.whatsapp.net
✅ Fire alert sent to 628xxx
```

### **Error Logs**
```
❌ Connection error: [error details]
⚠️  MQTT message error: [error details]
⚠️  Failed to send to 628xxx: [error details]
```

---

## 🎯 Production Deployment

### **Environment Variables**
Create `.env` in `whatsapp-server/`:
```env
WA_PORT=3001
MQTT_HOST=3.27.0.139
MQTT_PORT=1883
MQTT_USER=zaks
MQTT_PASSWORD=enggangodinginmcu
```

### **Process Manager (Optional)**
Use PM2 for auto-restart:
```bash
npm install -g pm2

cd whatsapp-server
pm2 start server.js --name whatsapp-server
pm2 save
pm2 startup
```

### **Systemd Service (Linux)**
Create `/etc/systemd/system/whatsapp-server.service`:
```ini
[Unit]
Description=WhatsApp Baileys Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/IotCobwengdev/whatsapp-server
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## 📚 Additional Resources

- **Baileys Docs:** https://github.com/WhiskeySockets/Baileys
- **WhatsApp Multi-Device:** https://faq.whatsapp.com/1324084875126592
- **MQTT Docs:** https://mqtt.org/
- **Node.js Docs:** https://nodejs.org/

---

## ✅ Checklist

Before going live:

- [ ] WhatsApp server installed
- [ ] Dependencies installed
- [ ] Server running on port 3001
- [ ] Dashboard running on port 5173
- [ ] MQTT broker accessible
- [ ] WhatsApp connected successfully
- [ ] Test message sent successfully
- [ ] Fire alert tested
- [ ] Recipients added
- [ ] Session backed up
- [ ] Logs monitored

---

## 🎉 You're Ready!

System is now fully integrated and ready to send fire alerts via WhatsApp!

**Need help?** Check:
1. Server console logs
2. Browser console (F12)
3. WHATSAPP-INTEGRATION.md
4. This guide (SETUP-WHATSAPP-COMPLETE.md)

**Happy monitoring! 🔥📱**
