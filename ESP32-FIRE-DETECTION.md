# 🔥 ESP32-CAM Fire Detection Integration

Dashboard ini telah diintegrasikan dengan sistem deteksi api **ESP32-CAM YOLOv10** dari proyek `D:\zakaiot`.

## 📋 Fitur Terintegrasi

### 1. **Fire Detection Gallery**
- Menampilkan gambar-gambar deteksi api dari ESP32-CAM
- Real-time gallery dengan auto-refresh setiap 30 detik
- Filter dan pagination untuk gambar deteksi
- Modal view untuk melihat gambar full-size
- Statistics: Total detections, Last 24 hours, Recent images

### 2. **Fire Detection Statistics**
- Total deteksi api yang terekam
- Deteksi dalam 24 jam terakhir
- Breakdown deteksi per tanggal

### 3. **Fire Detection Logs**
- Logs dari YOLOv10 fire detection system
- Informasi confidence, area, dan fire pixel ratio
- Timestamp detail setiap deteksi

## 🚀 Cara Menjalankan

### 1. Jalankan Fire Detection System (zakaiot)

Buka terminal di `D:\zakaiot`:

```bash
# Pilih salah satu mode deteksi:

# YOLOv10 saja (tanpa MQTT)
python fire_detection_yolov10.py

# YOLOv10 dengan MQTT (recommended untuk dashboard)
python firedetect_mqtt.py
```

### 2. Jalankan Proxy Server

Buka terminal di `D:\IotCobwengdev\proxy-server`:

```bash
npm start
```

Server akan berjalan di **http://localhost:8080** dan menyediakan:
- WebSocket endpoint: `ws://localhost:8080/ws`
- API endpoint: `http://localhost:8080/api/fire-detections`
- Health check: `http://localhost:8080/health`

### 3. Jalankan Dashboard Frontend

Buka terminal di `D:\IotCobwengdev`:

```bash
npm run dev
```

Dashboard akan tersedia di **http://localhost:5173**

## 📡 API Endpoints

Proxy server menyediakan endpoint untuk mengakses data fire detection:

### **GET** `/api/fire-detections`
Mendapatkan daftar gambar deteksi api
```
Query params:
- limit: jumlah maksimal gambar (default: 50)
- offset: offset untuk pagination (default: 0)

Response:
{
  "detections": [...],
  "total": 250,
  "offset": 0,
  "limit": 50
}
```

### **GET** `/api/fire-detections/:filename`
Serve gambar deteksi individual
```
Contoh: /api/fire-detections/fire_20251027_080427.jpg
```

### **GET** `/api/fire-stats`
Mendapatkan statistik deteksi api
```
Response:
{
  "total_detections": 250,
  "recent_detections_24h": 45,
  "detections_by_date": {
    "2025-10-27": 45,
    "2025-10-26": 32
  }
}
```

### **GET** `/api/fire-logs`
Mendapatkan log deteksi terbaru
```
Query params:
- limit: jumlah baris log (default: 100)

Response:
{
  "logs": [...],
  "total": 1523,
  "log_file": "fire_mqtt_2025-10-27.log"
}
```

## 📁 Struktur File

```
D:\zakaiot\
├── detections/          # Gambar deteksi api (fire_*.jpg)
├── logs/                # Log file deteksi
├── models/              # YOLOv10 model (fire.pt)
├── firedetect_mqtt.py   # Fire detection dengan MQTT
└── fire_detection_yolov10.py  # Fire detection standalone

D:\IotCobwengdev\
├── proxy-server/
│   └── server.js        # Proxy dengan fire detection API
├── src/
│   ├── components/
│   │   └── FireDetectionGallery.tsx  # Komponen gallery
│   └── App.tsx          # Main app dengan gallery
└── ...
```

## 🔧 Konfigurasi

### Path ke zakaiot Project

Edit `D:\IotCobwengdev\proxy-server\server.js`:

```javascript
// Path to zakaiot project
const ZAKAIOT_PATH = 'D:\\zakaiot'  // Sesuaikan jika berbeda
const DETECTIONS_PATH = join(ZAKAIOT_PATH, 'detections')
const LOGS_PATH = join(ZAKAIOT_PATH, 'logs')
```

### MQTT Configuration

Edit `D:\zakaiot\config_yolov10.json` untuk mengatur MQTT:

```json
{
  "mqtt": {
    "host": "3.27.0.139",
    "port": 1883,
    "user": "zaks",
    "password": "enggangodinginmcu",
    "topic_alert": "lab/zaks/alert",
    "topic_event": "lab/zaks/event"
  }
}
```

## 🎯 Workflow Lengkap

1. **ESP32-CAM** streaming video → `http://10.75.111.108:81/stream`
2. **Fire Detection System** (zakaiot) membaca stream dan mendeteksi api dengan YOLOv10
3. Saat api terdeteksi:
   - Gambar disimpan ke `D:\zakaiot\detections/`
   - Log ditulis ke `D:\zakaiot\logs/`
   - MQTT alert dikirim ke broker (jika menggunakan `firedetect_mqtt.py`)
4. **Dashboard** menampilkan:
   - Gambar deteksi api via Fire Detection Gallery
   - MQTT alerts dan events via WebSocket
   - Statistics dan logs

## 🔥 Tips

### Auto-refresh
- Gallery auto-refresh setiap 30 detik
- Klik tombol **Refresh** untuk refresh manual
- Statistics update otomatis setiap refresh

### Viewing Images
- Klik gambar thumbnail untuk melihat full-size
- Tekan **ESC** atau klik di luar gambar untuk menutup modal
- Hover di gambar untuk melihat timestamp

### Performance
- Default limit: 20 gambar terbaru
- Gunakan pagination untuk gambar lebih lama
- Gambar di-cache oleh browser untuk loading lebih cepat

## 📊 Dashboard Features

Dashboard menampilkan:
1. **Header** - Status koneksi MQTT dan ESP32-CAM
2. **Metric Cards** - Statistics real-time dari sensor
3. **Live Chart** - Grafik sensor data
4. **Control Panel** - Kontrol buzzer dan LED
5. **Fire Detection Gallery** ⭐ **NEW** - Galeri deteksi api ESP32-CAM
6. **Log Table** - Log events dari MQTT

## ⚠️ Troubleshooting

### Gallery tidak muncul
- Pastikan fire detection system (zakaiot) sudah berjalan
- Check folder `D:\zakaiot\detections` ada gambar
- Cek console browser untuk error API

### Gambar tidak loading
- Pastikan proxy server berjalan di port 8080
- Check path ke zakaiot di `server.js` sudah benar
- Pastikan file gambar ada di folder detections

### Statistics tidak update
- Refresh manual dengan tombol Refresh
- Check browser console untuk error
- Restart proxy server jika perlu

## 📚 Related Files

- `D:\zakaiot\firedetect_mqtt.py` - Fire detection dengan MQTT
- `D:\zakaiot\fire_detection_yolov10.py` - Fire detection standalone
- `D:\IotCobwengdev\proxy-server\server.js` - API server
- `D:\IotCobwengdev\src\components\FireDetectionGallery.tsx` - Gallery component

## 🎉 Success!

Dashboard kini terintegrasi penuh dengan sistem deteksi api ESP32-CAM!

Gambar deteksi api dan logs dari zakaiot project akan langsung muncul di dashboard IoT Cobwengdev.
