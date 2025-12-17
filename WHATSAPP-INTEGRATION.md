# 📱 WhatsApp Integration - Fire Alert System

Complete WhatsApp integration menggunakan **Baileys** untuk mengirim notifikasi kebakaran real-time.

## 🎯 Features

### ✅ **Pairing Code Authentication**
- Login menggunakan pairing code (tanpa QR scan)
- Multi-device support
- Session persistence

### ✅ **Real-time Fire Alerts**
- Otomatis mengirim alert saat deteksi kebakaran
- Data lengkap: Suhu, Kelembapan, Gas, Confidence
- Status: AMAN atau BERESIKO

### ✅ **Recipient Management**
- Tambah/hapus penerima notifikasi
- Test send message
- Multiple recipients support

### ✅ **Beautiful Dark UI**
- Modern dark theme
- Smooth animations
- Real-time status updates

---

## 🚀 Quick Start

### **1. Install Dependencies**
```bash
.\install-whatsapp-server.bat
```

### **2. Start WhatsApp Server**
```bash
.\start-whatsapp-server.bat
```
Server akan berjalan di `http://localhost:3001`

### **3. Start Dashboard**
```bash
npm run dev
```
Dashboard akan berjalan di `http://localhost:5173`

### **4. Connect WhatsApp**
1. Buka halaman **WhatsApp Integration** di dashboard
2. Masukkan nomor WhatsApp (format: 628xxx)
3. Klik **Start WhatsApp**
4. **Pairing code** akan muncul
5. Buka WhatsApp di HP → **Settings → Linked Devices → Link a Device → Link with phone number**
6. Masukkan pairing code
7. Tunggu sinkronisasi selesai
8. Status akan berubah menjadi **WhatsApp Connected** ✅

---

## 📱 How to Use

### **Add Recipients**
1. Klik tombol **Add** di panel Recipients
2. Masukkan nomor WhatsApp (628xxx)
3. Masukkan nama (opsional)
4. Klik **Add Recipient**

### **Test Message**
1. Hover pada recipient
2. Klik icon **Send** (paper plane)
3. Recipient akan menerima test message "Status Aman"

### **Fire Alerts**
Saat terjadi deteksi kebakaran:
- Alert otomatis dikirim ke semua recipients
- Format pesan:
  ```
  🔥 DETEKSI KEBAKARAN 🔴 BAHAYA!

  📊 Data Sensor:
  🌡️ Suhu: 45°C
  💧 Kelembapan: 30%
  ☁️ Gas: 850 ppm

  🎯 Deteksi:
  • Confidence: 85.5%
  • Level: CRITICAL
  • ✅ Verified by AI

  ⏰ Waktu: 29/10/2025, 11:45:30

  ⚠️ SEGERA CEK RUANGAN!
  ```

### **Stop Connection**
1. Klik **Stop Connection**
2. WhatsApp akan disconnect (session tetap tersimpan)

### **Delete Session**
1. Klik **Delete Session**
2. Semua auth data akan dihapus
3. Perlu pairing ulang untuk connect lagi

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FIRE DETECTION SYSTEM                    │
│  ┌──────────────┐              ┌──────────────┐            │
│  │   ESP32      │              │   Camera     │            │
│  │   (Sensors)  │              │   (YOLO AI)  │            │
│  └──────┬───────┘              └──────┬───────┘            │
│         │                             │                     │
│         └────────────┬────────────────┘                     │
│                      │                                      │
│                      ▼                                      │
│         ┌────────────────────────┐                          │
│         │    MQTT BROKER         │                          │
│         │  (3.27.0.139)       │                          │
│         └────────┬───────────────┘                          │
│                  │                                          │
│         ┌────────┴────────┐                                 │
│         │                 │                                 │
│         ▼                 ▼                                 │
│  ┌─────────────┐   ┌────────────────────┐                  │
│  │  Dashboard  │   │  WhatsApp Server   │                  │
│  │  (React)    │   │  (Baileys Node.js) │                  │
│  └─────────────┘   └────────┬───────────┘                  │
│                              │                              │
│                              ▼                              │
│                   ┌──────────────────────┐                  │
│                   │   WhatsApp API       │                  │
│                   │   (Baileys WebSocket)│                  │
│                   └──────────┬───────────┘                  │
│                              │                              │
│                              ▼                              │
│                   ┌──────────────────────┐                  │
│                   │    Recipients        │                  │
│                   │  📱 User 1, User 2   │                  │
│                   └──────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 File Structure

```
IotCobwengdev/
├── whatsapp-server/
│   ├── server.js                 # Baileys server utama
│   ├── package.json              # Dependencies
│   ├── auth_info/                # Session storage (auto-created)
│   └── .gitignore
│
├── src/
│   └── components/
│       └── WhatsAppIntegration.tsx   # React component
│
├── install-whatsapp-server.bat   # Install script
├── start-whatsapp-server.bat     # Start script
└── WHATSAPP-INTEGRATION.md       # Documentation (this file)
```

---

## 🔧 Configuration

### **MQTT Settings**
Edit `whatsapp-server/server.js`:
```javascript
const MQTT_CONFIG = {
  host: '3.27.0.139',
  port: 1883,
  username: 'zaks',
  password: 'enggangodinginmcu',
  topic_event: 'lab/zaks/event',
  topic_alert: 'lab/zaks/alert',
};
```

### **Server Port**
Default: `3001`

Edit di `server.js`:
```javascript
const PORT = process.env.WA_PORT || 3001;
```

### **API Base URL**
Edit di `WhatsAppIntegration.tsx`:
```typescript
const API_BASE = 'http://localhost:3001/api/whatsapp';
```

---

## 🔌 API Endpoints

### **GET /api/whatsapp/status**
Get connection status
```json
{
  "status": "connected",
  "phone": "628123456789",
  "syncProgress": 100,
  "pairingCode": null,
  "hasSession": true
}
```

### **POST /api/whatsapp/start**
Start WhatsApp connection
```json
{
  "phoneNumber": "628123456789"
}
```

### **POST /api/whatsapp/stop**
Stop WhatsApp connection

### **POST /api/whatsapp/delete-session**
Delete saved session

### **GET /api/whatsapp/recipients**
Get all recipients

### **POST /api/whatsapp/recipients**
Add new recipient
```json
{
  "phoneNumber": "628123456789",
  "name": "John Doe"
}
```

### **DELETE /api/whatsapp/recipients/:id**
Remove recipient

### **POST /api/whatsapp/test-send**
Send test message
```json
{
  "recipient": "628123456789"
}
```

---

## 📊 Message Formats

### **Fire Alert (Critical)**
```
🔥 DETEKSI KEBAKARAN 🔴 BAHAYA!

📊 Data Sensor:
🌡️ Suhu: 45°C
💧 Kelembapan: 30%
☁️ Gas: 850 ppm

🎯 Deteksi:
• Confidence: 85.5%
• Level: CRITICAL
• ✅ Verified by AI

⏰ Waktu: 29/10/2025, 11:45:30

⚠️ SEGERA CEK RUANGAN!
```

### **Fire Alert (High Risk)**
```
🔥 DETEKSI KEBAKARAN 🟠 BERESIKO TINGGI

📊 Data Sensor:
🌡️ Suhu: 38°C
💧 Kelembapan: 45%
☁️ Gas: 600 ppm

🎯 Deteksi:
• Confidence: 72.3%
• Level: HIGH
• ⏳ Pending verification

⏰ Waktu: 29/10/2025, 11:45:30

⚠️ SEGERA CEK RUANGAN!
```

### **Safe Status**
```
✅ STATUS AMAN

Sistem fire detection aktif dan tidak mendeteksi ancaman.
Semua sensor dalam kondisi normal.

⏰ 29/10/2025, 11:45:30
```

---

## 🎨 UI/UX Features

### **Dark Theme**
- Modern dark color scheme
- Gradient backgrounds
- Glass morphism effects

### **Animations**
- Fade in transitions
- Slide down effects
- Pulse animations for active status
- Smooth hover effects

### **Status Indicators**
- 🟢 **Connected** - Green badge with pulse
- 🟡 **Connecting** - Yellow with spinner
- 🔵 **Syncing** - Blue with progress
- 🔴 **Error** - Red alert
- ⚫ **Disconnected** - Gray

### **Interactive Elements**
- Real-time status updates (2s polling)
- Hover effects on recipients
- Smooth button transitions
- Custom scrollbar styling

---

## 🔒 Security Notes

### **⚠️ IMPORTANT**
1. **Baileys is UNOFFICIAL** - Not endorsed by WhatsApp/Meta
2. **Risk of ban** - Penggunaan bot bisa menyebabkan ban akun
3. **Use responsibly** - Jangan spam atau kirim pesan massal ilegal
4. **Personal account** - Gunakan nomor WhatsApp personal, bukan bisnis
5. **Multi-device** - Hanya untuk WhatsApp Multi-Device

### **Best Practices**
- ✅ Gunakan delay antar pesan (sudah di-handle di server)
- ✅ Batasi jumlah recipients (rekomendasi < 50)
- ✅ Monitor status ban/warning dari WhatsApp
- ✅ Backup session secara berkala
- ❌ Jangan kirim spam
- ❌ Jangan share session dengan pihak lain

---

## 🐛 Troubleshooting

### **Server tidak bisa start**
```bash
# Check port 3001 tersedia
netstat -ano | findstr :3001

# Kill process jika perlu
taskkill /PID <PID> /F
```

### **Pairing code tidak muncul**
1. Pastikan nomor benar (format: 628xxx)
2. Check console log untuk error
3. Tunggu 3-5 detik setelah klik Start
4. Coba restart server

### **Connection error**
1. Check internet connection
2. Verify nomor WhatsApp aktif
3. Check WhatsApp versi terbaru
4. Delete session dan coba lagi

### **Message tidak terkirim**
1. Verify WhatsApp status **Connected**
2. Check recipient nomor benar
3. Test send ke 1 recipient dulu
4. Check MQTT connection
5. Check console log untuk error

### **Session hilang**
1. Jangan delete folder `auth_info`
2. Backup folder `auth_info` secara berkala
3. Jangan logout dari WhatsApp Web

---

## 📚 References

- **Baileys Documentation**: [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)
- **WhatsApp Multi-Device**: [WhatsApp Help](https://faq.whatsapp.com/1324084875126592)
- **Pairing Code**: Fitur login tanpa QR scan

---

## 📝 Changelog

### **v1.0.0** (29 Oktober 2025)
- ✅ Initial release
- ✅ Pairing code authentication
- ✅ Real-time fire alerts via MQTT
- ✅ Recipient management
- ✅ Beautiful dark UI
- ✅ Auto-reconnect
- ✅ Session persistence
- ✅ Test send feature

---

## 🚀 Future Enhancements

- [ ] Group message support
- [ ] Image attachment in alerts
- [ ] Message templates
- [ ] Scheduled messages
- [ ] Message history log
- [ ] Multi-account support
- [ ] QR code authentication option
- [ ] WhatsApp Business API integration

---

## 📞 Support

**Issues?** Check:
1. Server console log
2. Browser console log (F12)
3. MQTT connection status
4. WhatsApp app connection

---

**🔥 Enjoy your Fire Detection System with WhatsApp Integration!**

Created with ❤️ using Baileys, React, Node.js, Express, MQTT
