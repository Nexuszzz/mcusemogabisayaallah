# 🔥 Auto WhatsApp Notification - GOWA Integration

## Overview

Sistem ini secara otomatis mengirim notifikasi WhatsApp ketika:
1. **🔥 API/Kebakaran terdeteksi** - Event `flame_on` dari sensor atau AI camera
2. **💨 Kebocoran Gas** - Nilai ADC gas sensor mencapai **4095** (saturated/maximum)

## Arsitektur

```
┌─────────────┐     MQTT      ┌──────────────────┐     HTTP      ┌────────────┐
│  ESP32/     │ ────────────> │   Proxy Server   │ ────────────> │   GOWA     │
│  Sensors    │   lab/zaks/*  │   (port 8080)    │   /send/msg   │ (port 3000)│
└─────────────┘               └──────────────────┘               └────────────┘
                                      │                                │
                                      │                                │
                                      ▼                                ▼
                              ┌──────────────────┐               ┌────────────┐
                              │  Recipients JSON │               │  WhatsApp  │
                              │  (server-side)   │               │  Messages  │
                              └──────────────────┘               └────────────┘
```

## MQTT Topics yang Dimonitor

| Topic | Kondisi Trigger | Aksi |
|-------|-----------------|------|
| `lab/zaks/event` | `event: "flame_on"` | Kirim notifikasi kebakaran |
| `lab/zaks/log` | `gasA >= 4095` | Kirim notifikasi gas berbahaya |
| `lab/zaks/log` | `alarm: true` | Kirim notifikasi sesuai tipe |
| `lab/zaks/alert` | Any message | Proses dan kirim notifikasi |

## Deteksi Gas Berbahaya

### ADC Value System
- ESP32 ADC: 12-bit (0-4095)
- MQ-2 Gas Sensor output analog → ADC
- **4095 = Saturated = MAXIMUM = BAHAYA!**

### Gas Level Interpretation
| ADC Value | Level | Status |
|-----------|-------|--------|
| 0-500 | Normal | ✅ Aman |
| 500-1500 | Sedikit terdeteksi | ✅ Aman |
| 1500-2500 | Elevated | ⚠️ Perhatian |
| 2500-3500 | Tinggi | 🟠 Warning |
| 3500-4094 | Sangat tinggi | 🔴 Bahaya |
| **4095** | **SATURATED** | **⚫ KRITIS!** |

## API Endpoints

### Recipients Management

```bash
# Get all recipients
GET /api/recipients

# Add recipient
POST /api/recipients
{
  "name": "John Doe",
  "phone": "6281234567890",
  "enabled": true
}

# Update recipient
PUT /api/recipients/:id
{
  "name": "Jane Doe",
  "enabled": false
}

# Delete recipient
DELETE /api/recipients/:id

# Toggle enabled/disabled
PATCH /api/recipients/:id/toggle

# Sync from frontend (bulk)
POST /api/recipients/sync
{
  "recipients": [...]
}

# Test send to specific recipient
POST /api/recipients/:id/test

# Get notification stats
GET /api/notifications/stats
```

### Manual Alert Trigger (Testing)

```bash
# Trigger fire alert manually
POST /api/alert/trigger
{
  "type": "fire",
  "data": { "deviceId": "ESP32-Test" }
}

# Trigger gas alert manually
POST /api/alert/trigger
{
  "type": "gas",
  "data": { "gasValue": 4095, "deviceId": "ESP32-Test" }
}
```

## Cooldown System

- **Default Cooldown**: 60 detik antara notifikasi
- Mencegah spam jika sensor terus mendeteksi
- Cooldown direset setelah setiap notifikasi terkirim

## Format Pesan

### Fire Alert
```
🔥 *PERINGATAN KEBAKARAN!*

⚠️ Sensor mendeteksi api!

📍 Lokasi: Lab IoT
📅 Waktu: 17 Des 2025, 14:30
🔢 Device: ESP32

_Segera periksa lokasi dan ambil tindakan!_

🤖 _Pesan otomatis dari Fire Detection System_
```

### Gas Alert
```
⚠️ *PERINGATAN KEBOCORAN GAS!*

💨 Level gas BERBAHAYA terdeteksi!

📊 Level: 4095 ADC (MAX)
📍 Lokasi: Lab IoT
📅 Waktu: 17 Des 2025, 14:30
🔢 Device: ESP32

⚡ _Tindakan: Segera ventilasi area dan matikan sumber gas!_

🤖 _Pesan otomatis dari Fire Detection System_
```

## Setup

### 1. Start Services

```batch
.\START-SEPARATED-SERVICES.bat
```

### 2. Connect WhatsApp (Dashboard)

1. Buka http://localhost:5173
2. Settings → WhatsApp Integration
3. Scan QR Code atau gunakan Pairing Code
4. Pastikan status "Connected"

### 3. Add Recipients

1. Di halaman WhatsApp Integration
2. Klik "Add Recipient"
3. Masukkan nama dan nomor HP (format: 628xxx)
4. Recipients otomatis di-sync ke server

### 4. Test Notification

```bash
# Via API
curl -X POST http://localhost:8080/api/recipients/{id}/test

# Atau di Dashboard, klik "Test" di samping recipient
```

## File Structure

```
proxy-server/
├── server.js                    # Main server dengan GOWA auto-notification
├── whatsapp-recipients.json     # Recipients storage (server-side)
└── .env                         # Configuration

src/components/
└── WhatsAppIntegration.tsx      # Frontend dengan server sync
```

## Troubleshooting

### Notifikasi tidak terkirim?

1. **Check GOWA Server**
   ```bash
   curl http://localhost:3000/app/devices
   ```
   Pastikan ada device connected

2. **Check Recipients**
   ```bash
   curl http://localhost:8080/api/recipients
   ```
   Pastikan ada recipients dengan `enabled: true`

3. **Check Cooldown**
   ```bash
   curl http://localhost:8080/api/notifications/stats
   ```
   Lihat `cooldownRemaining`

4. **Check Logs**
   Lihat terminal Proxy Server untuk log MQTT dan notifikasi

### Format nomor salah?

- Sistem otomatis convert: `0812xxx` → `62812xxx`
- Pastikan nomor valid Indonesia (10-13 digit setelah kode negara)

## Environment Variables

```env
# proxy-server/.env
GOWA_SERVER_URL=http://localhost:3000
MQTT_HOST=3.27.0.139
MQTT_PORT=1883
MQTT_USERNAME=zaks
MQTT_PASSWORD=enggangodinginmcu
```

## Changelog

- **v1.0.0** (17 Des 2025)
  - Initial GOWA auto-notification system
  - Fire and gas detection triggers
  - Server-side recipients management
  - Frontend sync with server
  - Cooldown system (60s default)
