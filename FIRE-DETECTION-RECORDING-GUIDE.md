# 🔥 FIRE DETECTION + AUTO RECORDING + WEB LOGGING

## 📋 **Deskripsi**

Script Python yang menggabungkan:
- ✅ **Fire Detection** (YOLOv8 + Gemini AI) dari `D:\zakaiot`
- ✅ **Auto Video Recording** saat api terdeteksi
- ✅ **Save ke laptop** (`D:/fire_recordings/`)
- ✅ **Auto-upload** ke web server
- ✅ **Real-time logging** ke dashboard via WebSocket
- ✅ **MQTT alerts** ke ESP32 DevKit

---

## 🚀 **Cara Menggunakan**

### **Method 1: Batch File (Recommended)**

```batch
# Double-click file ini
D:\rtsp-main\RUN-FIRE-DETECTION-RECORDING.bat
```

### **Method 2: Manual Python**

```bash
cd D:\rtsp-main\python_scripts
python fire_detect_record_ultimate.py
```

---

## 📊 **Fitur Lengkap**

### **1. Fire Detection**
```
YOLO Model: fire_yolov8s_ultra_best.pt
├── Confidence Threshold: 0.25
├── Min Area: 150 pixels
├── Multi-stage filtering
└── GPU acceleration (if available)

Gemini AI Verification:
├── Model: gemini-2.0-flash
├── Score Threshold: 0.40
├── Non-blocking async processing
└── Visual reasoning analysis
```

### **2. Auto Video Recording**
```
Trigger: Fire verified by Gemini AI
Duration: 30 seconds per clip
Save Location: D:/fire_recordings/
Format: MP4 (H.264)
FPS: 20
Auto-upload: Yes (to http://localhost:8080/api/video/upload)
Cooldown: 60 seconds (prevent spam)

Filename Format: fire_detection_YYYYMMDD_HHMMSS.mp4
Example: fire_detection_20251209_143022.mp4
```

### **3. Web Logging (Real-time)**
```
Protocol: WebSocket
URL: ws://localhost:8080/ws
Topics:
  - lab/zaks/log (system logs, detection logs, recording logs)
  - lab/zaks/alert (fire alerts)
  - lab/zaks/event (system events)

Log Categories:
  - fire_detection: YOLO detections, Gemini verification
  - recording: Recording start/stop, duration, file size
  - upload: Upload progress, success/failure
  - system: Connection status, errors, startup/shutdown
  - alert: Fire alerts with metadata
```

### **4. Dashboard Integration**
```
Logs tampil di: http://localhost:5173/live-stream
└── Tab "Live Stream" → Log panel (real-time)

WebSocket messages:
{
  "topic": "lab/zaks/log",
  "type": "log",
  "category": "fire_detection",
  "level": "warning",
  "message": "🔥 Fire VERIFIED! Gemini: 0.85",
  "timestamp": 1702123456789,
  "metadata": {
    "yolo_conf": 0.78,
    "gemini_score": 0.85,
    "bbox": [120, 150, 280, 320]
  }
}
```

---

## 📁 **Struktur File**

```
D:\rtsp-main\
├── python_scripts\
│   └── fire_detect_record_ultimate.py  ← Main script (NEW)
│
├── RUN-FIRE-DETECTION-RECORDING.bat    ← Quick launcher (NEW)
│
├── proxy-server\
│   ├── server.js                       ← WebSocket server (existing)
│   └── recordings\                     ← Uploaded videos
│
└── src\pages\
    └── LiveStream.tsx                  ← Dashboard with logs (existing)

D:\fire_recordings\                     ← Local recordings (auto-created)
├── fire_detection_20251209_143022.mp4
├── fire_detection_20251209_144500.mp4
└── ...

D:\zakaiot\                             ← Fire detection models
├── fire_yolov8s_ultra_best.pt         ← Primary model
└── fire_training\
    └── fire_yolov8n_best.pt           ← Fallback model
```

---

## 🔧 **Konfigurasi**

### **Environment Variables (.env)**

```env
# ESP32-CAM
ESP32_CAM_IP=10.148.218.219

# Gemini AI
GOOGLE_API_KEY=AIzaSyBFSMHncnK-G9OxjPE90H7wnYGkpGOcdEw

# MQTT (optional, defaults provided)
MQTT_BROKER=3.27.0.139
MQTT_PORT=1883
MQTT_USER=zaks
MQTT_PASSWORD=enggangodinginmcu
```

### **Script Configuration (edit in file)**

```python
# Video Recording
ENABLE_AUTO_RECORD = True
RECORD_SAVE_DIR = "D:/fire_recordings"
RECORD_DURATION = 30  # seconds
RECORD_FPS = 20
RECORD_COOLDOWN = 60  # seconds between recordings

# Upload
UPLOAD_API = "http://localhost:8080/api/video/upload"
AUTO_UPLOAD_AFTER_RECORD = True

# Web Logging
WEB_LOG_ENABLED = True
WEB_LOG_WS_URL = "ws://localhost:8080/ws"

# Detection
CONF_THRESHOLD = 0.25
MIN_AREA = 150
GEMINI_SCORE_THRESHOLD = 0.40
PROCESS_EVERY_N_FRAMES = 2
```

---

## 📊 **Output Examples**

### **Console Output**

```
================================================================================
🔥 FIRE DETECTION + AUTO VIDEO RECORDING + WEB LOGGING
================================================================================

📦 Loading YOLO model: fire_yolov8s_ultra_best.pt
✅ YOLO loaded!
🤖 Initializing Gemini AI (gemini-2.0-flash)...
✅ Gemini gemini-2.0-flash ready!
📡 Connecting to WebSocket: ws://localhost:8080/ws
✅ WebSocket connected!
📡 Connecting to MQTT broker: 3.27.0.139:1883
✅ MQTT connected!
📹 Auto-recording enabled: 30s clips
📁 Recording directory: D:/fire_recordings

================================================================================
Connecting to ESP32-CAM: 10.148.218.219
Stream URL: http://10.148.218.219:81/stream
================================================================================

✅ Stream connected! Press 'q' to quit

✅ Fire VERIFIED! Gemini: 0.85 - Visible orange flames with smoke
🎬 Recording started: fire_detection_20251209_143022.mp4 (30s)
📤 Submitted to Gemini (YOLO: 0.78, pending: 1)
✅ Recording complete: fire_detection_20251209_143022.mp4 (30.2s, 5.67MB, 604 frames)
📤 Uploading: fire_detection_20251209_143022.mp4
✅ Upload successful: fire_detection_20251209_143022.mp4
```

### **Web Dashboard Logs**

Dashboard akan menampilkan real-time logs:

```
[14:30:22] 🔥 Fire VERIFIED! Gemini: 0.85 - Visible orange flames
[14:30:22] 🎬 Recording started: fire_detection_20251209_143022.mp4
[14:30:52] ✅ Recording complete (30.2s, 5.67MB, 604 frames)
[14:30:54] 📤 Uploading: fire_detection_20251209_143022.mp4
[14:31:02] ✅ Upload successful: fire_detection_20251209_143022.mp4
```

---

## 🎯 **Workflow Lengkap**

```
1. ESP32-CAM Stream (MJPEG)
   ↓
2. YOLO Detection (fire_yolov8s_ultra_best.pt)
   ├── Confidence ≥ 0.25
   ├── Area ≥ 150 pixels
   └── Submit to Gemini for verification
   ↓
3. Gemini AI Verification
   ├── Visual reasoning analysis
   ├── Score ≥ 0.40 = VERIFIED
   └── Log to WebSocket → Dashboard
   ↓
4. Fire VERIFIED
   ├── Start video recording (30s)
   ├── Send MQTT alert → ESP32 DevKit (buzzer/LED)
   └── Log to dashboard: "🔥 Fire VERIFIED!"
   ↓
5. Recording (30 seconds)
   ├── Save frames to D:/fire_recordings/
   ├── Display recording status: "🔴 RECORDING"
   └── Log progress to dashboard
   ↓
6. Recording Complete
   ├── Stop recording
   ├── Log: "✅ Recording complete (duration, size, frames)"
   └── Trigger upload (async)
   ↓
7. Upload to Web Server
   ├── POST to http://localhost:8080/api/video/upload
   ├── Log: "📤 Uploading: filename.mp4"
   └── Log: "✅ Upload successful!" or "❌ Upload failed"
   ↓
8. Video Available
   ├── Local: D:/fire_recordings/fire_detection_*.mp4
   ├── Server: proxy-server/recordings/
   └── Dashboard: Recordings tab → Video gallery
```

---

## 🐛 **Troubleshooting**

### **Problem: WebSocket connection failed**

**Error:**
```
⚠️  WebSocket connection failed: Connection refused
```

**Solution:**
```bash
# Ensure proxy-server is running
cd D:\rtsp-main\proxy-server
npm start

# Or use batch file
D:\rtsp-main\START-SEPARATED-SERVICES.bat
```

---

### **Problem: YOLO model not found**

**Error:**
```
❌ Model not found! Please check path.
```

**Solution:**
```
1. Check model exists:
   D:\zakaiot\fire_yolov8s_ultra_best.pt
   OR
   D:\zakaiot\fire_training\fire_yolov8n_best.pt

2. If missing, copy from zakaiot folder:
   copy D:\zakaiot\fire_yolov8s_ultra_best.pt D:\rtsp-main\python_scripts\
```

---

### **Problem: Recording not starting**

**Possible causes:**
1. Fire not verified by Gemini (score < 0.40)
2. Recording cooldown active (60s between recordings)
3. Disk space full

**Solution:**
```python
# Check Gemini threshold (edit in script)
GEMINI_SCORE_THRESHOLD = 0.30  # Lower threshold (was 0.40)

# Check cooldown
RECORD_COOLDOWN = 30  # Reduce to 30s (was 60s)

# Check disk space
D:\fire_recordings\ should have >1GB free space
```

---

### **Problem: Upload timeout**

**Error:**
```
❌ Upload failed: timeout
```

**Solution:**
```python
# Increase upload timeout (edit in FireVideoRecorder class)
response = requests.post(
    self.upload_api,
    files=files,
    data=data,
    timeout=600  # Increase to 10 minutes (was 300)
)
```

---

## 📈 **Performance Tuning**

### **For Faster Detection:**
```python
# Process every frame (slower, more accurate)
PROCESS_EVERY_N_FRAMES = 1

# Skip more frames (faster, less CPU)
PROCESS_EVERY_N_FRAMES = 3
```

### **For Longer Recordings:**
```python
# Record 60 seconds instead of 30
RECORD_DURATION = 60

# Record 120 seconds (2 minutes)
RECORD_DURATION = 120
```

### **For More Frequent Recording:**
```python
# Record every 30 seconds when fire detected
RECORD_COOLDOWN = 30  # Was 60

# No cooldown (record continuously)
RECORD_COOLDOWN = 0
```

---

## 🎉 **Success Criteria**

✅ **System working if you see:**

1. **Console:**
   ```
   ✅ YOLO loaded!
   ✅ Gemini ready!
   ✅ WebSocket connected!
   ✅ MQTT connected!
   ✅ Stream connected!
   ```

2. **Dashboard (http://localhost:5173/live-stream):**
   - Real-time logs appearing in log panel
   - Fire detection alerts showing up
   - Recording status updates visible

3. **File System:**
   ```
   D:\fire_recordings\
   └── fire_detection_YYYYMMDD_HHMMSS.mp4 (new files appear)
   ```

4. **Web Server:**
   ```
   http://localhost:5173/live-stream → Recordings tab
   └── Videos appear in gallery after upload
   ```

---

## 🆚 **Comparison with Other Scripts**

| Feature | fire_detect_record_ultimate.py | record_and_upload_esp32cam.py | fire_detect_esp32_ultimate.py |
|---------|-------------------------------|------------------------------|------------------------------|
| Fire Detection | ✅ YOLO + Gemini | ❌ No | ✅ YOLO + Gemini |
| Auto Recording | ✅ On fire detected | ✅ Manual trigger | ❌ No |
| Web Logging | ✅ Real-time WebSocket | ❌ No | ❌ No |
| MQTT Alerts | ✅ Yes | ❌ No | ✅ Yes |
| Upload to Server | ✅ Auto after record | ✅ After record | ❌ No |
| Save to Laptop | ✅ Yes | ✅ Yes | ❌ No |
| Dashboard Integration | ✅ Full (logs + videos) | ⚠️ Partial (videos only) | ❌ No |

**Recommendation:** Use `fire_detect_record_ultimate.py` untuk production karena fitur paling lengkap!

---

## 📝 **Next Steps**

1. ✅ Run script: `RUN-FIRE-DETECTION-RECORDING.bat`
2. ✅ Open dashboard: http://localhost:5173/live-stream
3. ✅ Monitor logs in real-time
4. ✅ Test fire detection (use lighter or candle)
5. ✅ Check recording saved: `D:\fire_recordings\`
6. ✅ Verify upload: Dashboard → Recordings tab

---

**🎊 Fire Detection + Recording System Ready!**

Test now: Wave lighter near ESP32-CAM → See logs → Check recording!
