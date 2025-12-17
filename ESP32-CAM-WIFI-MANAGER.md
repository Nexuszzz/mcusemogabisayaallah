# 🔥 ESP32-CAM WiFi Manager + Auto IP Detection

## Fitur Utama

### ESP32-CAM dengan WiFi Manager:
1. **Tidak perlu hardcode SSID/password** di code
2. **AP Mode otomatis** jika tidak bisa connect ke WiFi
3. **Web portal** untuk pilih WiFi & masukkan password
4. **IP broadcast via MQTT** - Python auto-detect!

### Python Auto IP Detection:
1. **Subscribe ke MQTT** topic `lab/zaks/esp32cam/ip`
2. **Auto-connect** ke stream URL yang di-broadcast
3. **Multi-camera support** - detect semua ESP32-CAM yang aktif
4. **No manual input** - semua otomatis!

---

## 📱 Cara Setup ESP32-CAM

### 1. Install Library di Arduino IDE
```
Library Manager → Search:
1. WiFiManager by tzapu
2. PubSubClient by Nick O'Leary  
3. ArduinoJson by Benoit Blanchon
```

### 2. Upload Code
- Buka file: `esp32-cam-wifimanager.ino`
- Select Board: AI Thinker ESP32-CAM
- Upload!

### 3. Pertama Kali (Setup WiFi)
```
1. ESP32-CAM akan menyala dalam AP Mode
2. LED akan berkedip 5x menandakan AP mode

3. Buka WiFi di HP/laptop
4. Connect ke: "FireCam-Setup-XXXXXX" (XXXXXX = Chip ID)
5. Password: fire12345

6. Browser akan otomatis buka portal
   Atau manual buka: http://192.168.4.1

7. Pilih WiFi rumah/kantor Anda
8. Masukkan password WiFi
9. Klik "Save"

10. ESP32-CAM akan restart dan connect ke WiFi
11. IP akan di-broadcast via MQTT setiap 30 detik
```

### 4. Setelah Setup (Penggunaan Normal)
```
1. Nyalakan ESP32-CAM
2. Otomatis connect ke WiFi yang sudah disimpan
3. IP broadcast via MQTT
4. Python script auto-detect IP!
```

### 5. Reset WiFi (Jika Perlu Ganti WiFi)
```
Opsi 1: Via Web
- Buka http://[IP-ESP32]/reset
- Confirm reset
- ESP32 akan restart dalam AP mode

Opsi 2: Via MQTT
- Publish ke topic: lab/zaks/esp32cam/cmd
- Payload: RESET_WIFI

Opsi 3: Via Serial
- Restart ESP32 sambil tekan tombol FLASH/GPIO0
- Tahan sampai LED berkedip
```

---

## 🐍 Cara Jalankan Python (Auto IP)

### 1. Install Dependencies
```bash
pip install paho-mqtt opencv-python ultralytics websocket-client
```

### 2. Jalankan Script
```bash
cd D:\rtsp-main\python_scripts
python fire_detect_auto_ip.py
```

### 3. Output yang Diharapkan
```
================================================================================
🔥 FIRE DETECTION + AUTO IP DETECTION VIA MQTT
================================================================================

✅ Model: D:/zekk/zakaiot/fire_yolov8s_ultra_best.pt

[MQTT] Connecting to 3.27.0.139:1883...
✅ MQTT Connected to 3.27.0.139
📡 Subscribed to: lab/zaks/esp32cam/ip
⏳ Waiting for ESP32-CAM IP broadcast...

📸 Camera Discovered: firecam-A1B2C3
   IP: 192.168.1.100
   Stream: http://192.168.1.100:81/stream
   WiFi: MyWiFi (-65 dBm)

✅ Auto-selected camera: firecam-A1B2C3

==================================================
📸 AVAILABLE CAMERAS
==================================================
✅  1. firecam-A1B2C3
      IP: 192.168.1.100
      Stream: http://192.168.1.100:81/stream
      WiFi: MyWiFi (-65 dBm)
==================================================

🎬 Starting fire detection...
   Stream URL: http://192.168.1.100:81/stream
   Loading YOLO model...
   ✅ Model loaded
   Connecting to camera stream...
✅ Stream connected!

============================================================
🔥 FIRE DETECTION RUNNING
============================================================
Press 'q' to quit, 'r' to reconnect, 'c' to switch camera
============================================================
```

---

## 🔧 MQTT Topics

| Topic | Fungsi |
|-------|--------|
| `lab/zaks/esp32cam/ip` | ESP32 broadcast IP (retained) |
| `lab/zaks/event` | Status events (online, fire detected, etc) |
| `lab/zaks/esp32cam/cmd` | Commands ke ESP32 (FLASH_ON, RESTART, etc) |
| `lab/zaks/alert` | Fire alerts ke buzzer/LED |

---

## 📡 MQTT Commands

Kirim command ke ESP32-CAM via MQTT topic `lab/zaks/esp32cam/cmd`:

| Command | Fungsi |
|---------|--------|
| `FLASH_ON` | Nyalakan flash LED |
| `FLASH_OFF` | Matikan flash LED |
| `RESTART` | Restart ESP32 |
| `RESET_WIFI` | Reset WiFi credentials |
| `STATUS` | Request IP broadcast |

**Contoh via MQTT.fx atau mosquitto_pub:**
```bash
mosquitto_pub -h 3.27.0.139 -u zaks -P enggangodinginmcu -t "lab/zaks/esp32cam/cmd" -m "FLASH_ON"
```

---

## 🔄 Alur Kerja

```
┌─────────────────────────────────────────────────────────────────────┐
│                          SETUP (Sekali)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ESP32-CAM nyala    HP connect ke    Pilih WiFi &     ESP32        │
│   dalam AP mode  →   "FireCam-Setup"  →  masukkan   →  restart &    │
│                                        password      connect WiFi  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    PENGGUNAAN (Setiap Kali)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ESP32-CAM     Auto connect    IP broadcast     Python script     │
│   nyala      →   ke WiFi    →   via MQTT    →   auto-detect IP    │
│                  (tersimpan)    setiap 30s      & start detection  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       GANTI WIFI                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Buka /reset    ESP32 restart    Connect ke AP    Pilih WiFi      │
│   di browser  →  ke AP mode   →   & buka portal →  baru            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ❓ Troubleshooting

### ESP32-CAM tidak broadcast IP
1. Cek Serial Monitor - lihat error apa
2. Pastikan WiFi sudah tersimpan (bukan AP mode)
3. Cek koneksi ke MQTT broker

### Python tidak dapat IP
1. Pastikan ESP32-CAM sudah connect ke WiFi (lihat Serial Monitor)
2. Cek MQTT broker running: `mosquitto -v`
3. Test subscribe manual:
   ```bash
   mosquitto_sub -h 3.27.0.139 -u zaks -P enggangodinginmcu -t "lab/zaks/esp32cam/ip"
   ```

### Stream tidak bisa dibuka
1. Cek IP sudah benar
2. Test di browser: `http://[IP]:81/stream`
3. Pastikan tidak ada firewall blocking

---

## 📁 File Structure

```
D:\rtsp-main\
├── esp32-cam-wifimanager.ino    # ESP32-CAM dengan WiFi Manager
├── python_scripts\
│   ├── fire_detect_auto_ip.py   # Python Auto IP via MQTT
│   └── fire_detect_record_ultimate.py  # Python manual IP
└── ESP32-CAM-WIFI-MANAGER.md    # Guide ini
```

---

## 🎯 Summary

| Sebelum | Sesudah |
|---------|---------|
| Hardcode SSID/password | WiFi Manager portal |
| Ganti WiFi = ubah code | Ganti WiFi via web portal |
| Input IP manual di Python | IP auto-detect via MQTT |
| Single camera | Multi-camera support |
