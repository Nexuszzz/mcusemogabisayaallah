# 🔧 Konfigurasi Fire Detection untuk EC2

## 📋 Opsi Deployment Python Script

Ada 3 cara untuk menjalankan fire detection di EC2:

---

## ✅ **Opsi 1: ESP32-CAM + EC2 (RECOMMENDED)**

### Konsep:
- **ESP32-CAM** tetap di lokasi (streaming RTSP)
- **Python script** jalan di EC2 (akses ESP32 via internet)
- **Web Dashboard** di EC2 (akses dari mana saja)

### Langkah-Langkah:

#### 1️⃣ Setup ESP32-CAM untuk Public Access
Anda butuh salah satu:

**Opsi A - Port Forwarding di Router:**
```
1. Login ke router Anda
2. Port forward:
   - External Port: 8080 → Internal IP ESP32:80
3. Akses ESP32 dari internet: http://YOUR_PUBLIC_IP:8080/stream
```

**Opsi B - Ngrok (Temporary, untuk testing):**
```bash
# Di komputer lokal yang satu jaringan dengan ESP32
ngrok http http://192.168.1.100:80
# Dapat URL: https://abcd1234.ngrok.io
```

**Opsi C - Cloud MQTT Bridge (Best for Production):**
ESP32 kirim frame via MQTT → EC2 subscribe → Process

#### 2️⃣ Modifikasi Script untuk EC2

File yang perlu diubah:
```python
# Di fire_detect_record_ultimate.py

# Ganti localhost dengan 0.0.0.0 atau domain EC2
UPLOAD_API = "http://YOUR_EC2_IP:8080/api/video/upload"
WEB_LOG_WS_URL = "ws://YOUR_EC2_IP:8080/ws"
PROXY_SERVER_URL = "http://YOUR_EC2_IP:8080"
WEB_API_URL = "http://YOUR_EC2_IP:8080/api/fire-detection"

# ESP32-CAM akan diinput saat start
# Masukkan: http://YOUR_PUBLIC_IP:8080/stream
# Atau: https://ngrok-url.io/stream
```

---

## ⚡ **Opsi 2: USB Camera di EC2**

### Konsep:
- Colok USB camera langsung ke EC2
- Script akses camera lokal di EC2
- Cocok untuk demo/testing

### Langkah:
```python
# Ganti ESP32 stream dengan USB camera
cap = cv2.VideoCapture(0)  # 0 = USB camera pertama
```

**Catatan:** Butuh instance EC2 yang support USB (bare metal atau dedicated)

---

## 🌐 **Opsi 3: IP Camera with Public RTSP**

### Konsep:
- Gunakan IP camera yang sudah punya RTSP public
- Script di EC2 akses RTSP langsung

### Langkah:
```python
# Contoh RTSP public camera
STREAM_URL = "rtsp://username:password@public-ip:554/stream"
cap = cv2.VideoCapture(STREAM_URL)
```

---

## 🚀 Setup untuk EC2 (Opsi 1 - Recommended)

### File: `.env` di EC2

```env
# Environment variables untuk production

# Google Gemini API
# GET YOUR API KEY: https://makersuite.google.com/app/apikey
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY_HERE

# EC2 Server URLs (ganti YOUR_EC2_IP)
UPLOAD_API=http://YOUR_EC2_IP:8080/api/video/upload
WEB_LOG_WS_URL=ws://YOUR_EC2_IP:8080/ws
PROXY_SERVER_URL=http://YOUR_EC2_IP:8080
WEB_API_URL=http://YOUR_EC2_IP:8080/api/fire-detection

# ESP32-CAM (via port forwarding atau ngrok)
ESP32_CAM_STREAM=http://YOUR_HOME_PUBLIC_IP:8080/stream
# Atau jika pakai ngrok: https://abcd1234.ngrok.io/stream

# MQTT Configuration
MQTT_BROKER=3.27.0.139
MQTT_PORT=1883
MQTT_USER=zaks
MQTT_PASSWORD=enggangodinginmcu

# Model Path di EC2
MODEL_PATH=/home/ubuntu/sudahtapibelum/python_scripts/fire_yolov8s_ultra_best.pt

# Recording
RECORD_SAVE_DIR=/home/ubuntu/sudahtapibelum/fire_recordings
RECORD_DURATION=30
RECORD_COOLDOWN=60
```

---

## 📝 Step-by-Step Deployment

### 1. Upload Model YOLO ke EC2

```bash
# Di komputer lokal (PowerShell)
# Upload via WinSCP atau scp
scp -i your-key.pem D:\zakaiot\fire_yolov8s_ultra_best.pt ubuntu@YOUR_EC2_IP:~/sudahtapibelum/python_scripts/
```

### 2. Setup Port Forwarding untuk ESP32

**Di Router Anda:**
1. Login router (biasanya 192.168.1.1)
2. Cari menu "Port Forwarding" atau "Virtual Server"
3. Tambah rule:
   - **Service Name:** ESP32-CAM
   - **External Port:** 8080
   - **Internal IP:** 192.168.1.100 (IP ESP32 Anda)
   - **Internal Port:** 80
   - **Protocol:** TCP
4. Save & Restart router

**Test dari luar:**
```
http://YOUR_HOME_PUBLIC_IP:8080/stream
```

### 3. Jalankan di EC2

```bash
# SSH ke EC2
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Masuk ke directory
cd ~/sudahtapibelum/python_scripts

# Jalankan dengan PM2
pm2 start fire_detect_record_ultimate.py \
  --name fire-detection \
  --interpreter python3 \
  --env production

# Monitor
pm2 logs fire-detection
```

---

## 🔧 Alternative: Ngrok untuk Testing Cepat

Jika belum bisa setup port forwarding:

### Di komputer lokal:

```bash
# Install ngrok: https://ngrok.com/download

# Start ngrok untuk ESP32
ngrok http 192.168.1.100:80

# Dapat URL seperti: https://abc123.ngrok.io
```

### Di EC2:

```bash
# Set ESP32 stream URL
export ESP32_CAM_STREAM=https://abc123.ngrok.io/stream

# Run script
pm2 start fire_detect_record_ultimate.py \
  --name fire-detection \
  --interpreter python3
```

---

## 📊 Architecture Diagram

```
┌──────────────┐      RTSP/HTTP       ┌──────────────┐
│  ESP32-CAM   │ ──────────────────> │   Internet   │
│  (Rumah)     │   Port Forward       └──────┬───────┘
└──────────────┘      :8080                  │
                                             │
                                             ▼
                                   ┌──────────────────┐
                                   │   AWS EC2        │
                                   │                  │
                                   │  Python Script   │
                                   │  (Fire Detect)   │
                                   │       +          │
                                   │  Node.js Server  │
                                   │       +          │
                                   │  Web Dashboard   │
                                   └──────────────────┘
                                             │
                                             ▼
                                   ┌──────────────────┐
                                   │   Users          │
                                   │   (Browser)      │
                                   └──────────────────┘
```

---

## 🛡️ Security Considerations

### Port Forwarding:
- ⚠️ Expose minimal ports saja
- ✅ Gunakan password/auth di ESP32
- ✅ Atau gunakan VPN untuk akses ESP32

### Ngrok:
- ✅ Gratis untuk testing
- ⚠️ URL berubah setiap restart (kecuali paid)
- ✅ Built-in HTTPS

### Best Practice:
- Upload model ke EC2 (jangan download tiap start)
- Gunakan environment variables untuk config
- Setup firewall di AWS Security Group

---

## 🎯 Mana Yang Dipilih?

| Opsi | Kelebihan | Kekurangan | Use Case |
|------|-----------|------------|----------|
| **ESP32 + Port Forward** | Permanent, Free | Butuh akses router | Production |
| **ESP32 + Ngrok** | Easy setup | URL berubah | Testing/Demo |
| **USB Camera** | Simple | Butuh physical access | Lab/Testing |
| **IP Camera** | Professional | Mahal | Enterprise |

**Recommendation:** **ESP32 + Port Forwarding** untuk production.

---

Mau saya buatkan script yang sudah dimodifikasi untuk EC2?
