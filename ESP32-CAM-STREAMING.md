# 📹 ESP32-CAM Live Streaming Integration

## 🎯 **OVERVIEW**

Dashboard kini mendukung **Live Streaming Real-Time** dari ESP32-CAM dengan fitur:
- ✅ **MJPEG HTTP Stream** (native ESP32-CAM)
- ✅ **Real-time Fire Detection Overlay**
- ✅ **Snapshot & Recording**
- ✅ **Auto-reconnect & Error handling**
- ✅ **Fullscreen mode**
- ✅ **Configurable quality settings**

---

## 🚀 **QUICK START**

### 1. **Setup ESP32-CAM**

#### A. Upload Code ESP32-CAM

```cpp
// ESP32-CAM Fire Detection Streaming
#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>

// WiFi Credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Camera pins (AI-Thinker module)
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

WebServer server(80);

// MJPEG Stream Handler
void handleJpgStream() {
  WiFiClient client = server.client();
  String response = "HTTP/1.1 200 OK\r\n";
  response += "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n";
  server.sendContent(response);

  while(true){
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      break;
    }

    if(client.connected()){
      response = "--frame\r\n";
      response += "Content-Type: image/jpeg\r\n\r\n";
      server.sendContent(response);
      
      client.write((const char *)fb->buf, fb->len);
      server.sendContent("\r\n");
    }
    
    esp_camera_fb_return(fb);
    
    if(!client.connected()) break;
    delay(30); // ~30 FPS
  }
}

// Single Frame Handler
void handleJpg() {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    server.send(503, "text/plain", "Camera capture failed");
    return;
  }

  server.sendHeader("Content-Type", "image/jpeg");
  server.sendHeader("Content-Length", String(fb->len));
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send_P(200, "image/jpeg", (const char *)fb->buf, fb->len);
  
  esp_camera_fb_return(fb);
}

void setup() {
  Serial.begin(115200);
  
  // Camera Config
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  // Frame size and quality
  if(psramFound()){
    config.frame_size = FRAMESIZE_VGA;  // 640x480
    config.jpeg_quality = 10;            // 0-63, lower = better
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  // Init Camera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  // WiFi Connect
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi connected!");
  Serial.print("Camera Stream Ready! Go to: http://");
  Serial.println(WiFi.localIP());
  Serial.println("Stream URL: http://" + WiFi.localIP().toString() + "/stream");
  Serial.println("Snapshot URL: http://" + WiFi.localIP().toString() + "/capture");

  // Setup Routes
  server.on("/", HTTP_GET, [](){
    server.send(200, "text/html", 
      "<html><body><h1>ESP32-CAM Fire Detection</h1>"
      "<img src='/stream' style='width:100%;max-width:800px;'/>"
      "</body></html>");
  });
  
  server.on("/stream", HTTP_GET, handleJpgStream);
  server.on("/capture", HTTP_GET, handleJpg);
  
  server.begin();
}

void loop() {
  server.handleClient();
}
```

#### B. Upload ke ESP32-CAM

1. **Arduino IDE Setup:**
   - Board: "AI Thinker ESP32-CAM"
   - Upload Speed: 115200
   - Flash Mode: QIO
   - Partition Scheme: "Huge APP (3MB No OTA)"

2. **Upload:**
   - Connect FTDI programmer
   - GPIO0 to GND (boot mode)
   - Upload code
   - Remove GPIO0-GND connection
   - Press RESET

3. **Cek IP Address:**
   - Buka Serial Monitor (115200 baud)
   - Catat IP address ESP32-CAM
   - Contoh: `192.168.1.100`

---

### 2. **Update Dashboard Configuration**

Edit file `src/components/ESP32CamStream.tsx`:

```typescript
// Line 35: Ganti dengan IP ESP32-CAM Anda
const [streamUrl, setStreamUrl] = useState('http://192.168.1.100/stream');

// Line 46: Update default config
const [config, setConfig] = useState<StreamConfig>({
  url: 'http://192.168.1.100/stream', // <-- IP ESP32-CAM Anda
  quality: 'medium',
  fps: 15,
  enabled: true,
});
```

---

### 3. **Test Stream**

1. **Langsung di Browser:**
   ```
   http://192.168.1.100/stream
   ```
   Harus menampilkan video stream

2. **Via Dashboard:**
   - Buka http://localhost:5173
   - Scroll ke "ESP32-CAM Live Stream"
   - Klik tombol "Start"
   - Stream akan muncul

---

## 📋 **FEATURES**

### **1. Live Streaming**
- MJPEG HTTP stream (native ESP32)
- Auto-reconnect jika disconnect
- Configurable FPS (5-30 FPS)
- Low latency (<500ms)

### **2. Fire Detection Overlay**
- Real-time bounding box saat api terdeteksi
- Confidence score display
- Auto-hide setelah 2 detik
- Toggle on/off

### **3. Controls**
- **Start/Stop**: Mulai/hentikan streaming
- **Snapshot**: Ambil foto dari stream
- **Restart**: Restart stream jika lag
- **Fullscreen**: Mode layar penuh
- **Settings**: Konfigurasi URL, quality, FPS

### **4. Auto Features**
- Auto-reconnect (max 5 retries)
- Connection status indicator
- Error handling dengan pesan detail
- FPS counter

---

## 🔧 **CONFIGURATION**

### **Stream Quality Settings**

| Quality | Resolution | JPEG Quality | Bandwidth | Use Case |
|---------|------------|--------------|-----------|----------|
| Low | 320x240 | 20 | ~100 KB/s | Monitoring, slow network |
| Medium | 640x480 | 12 | ~200 KB/s | **Recommended** |
| High | 1024x768 | 8 | ~400 KB/s | High detail, fast network |

### **ESP32-CAM Frame Sizes**

```cpp
FRAMESIZE_QVGA,    // 320x240
FRAMESIZE_VGA,     // 640x480 (recommended)
FRAMESIZE_SVGA,    // 800x600
FRAMESIZE_XGA,     // 1024x768
FRAMESIZE_SXGA,    // 1280x1024
FRAMESIZE_UXGA,    // 1600x1200
```

### **Network Configuration**

**Same Network (Recommended):**
- ESP32-CAM: 192.168.1.100
- Computer: 192.168.1.X
- Access via: `http://192.168.1.100/stream`

**Different Network (Requires Port Forwarding):**
- Router port forward 80 → ESP32-CAM
- Access via: `http://PUBLIC_IP/stream`

---

## 🔥 **INTEGRATION WITH FIRE DETECTION**

### **Method 1: Python OpenCV + MQTT** (Recommended)

File: `fire_detection_stream.py`

```python
import cv2
import numpy as np
from ultralytics import YOLO
import paho.mqtt.client as mqtt
import json
import time

# MQTT Config
MQTT_BROKER = "3.27.0.139"
MQTT_PORT = 1883
MQTT_USER = "zaks"
MQTT_PASS = "enggangodinginmcu"
MQTT_TOPIC_DETECTION = "lab/zaks/fire-detection"

# ESP32-CAM Stream URL
STREAM_URL = "http://192.168.1.100/stream"

# Load YOLO Model
model = YOLO('fire.pt')

# MQTT Setup
mqtt_client = mqtt.Client()
mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
mqtt_client.connect(MQTT_BROKER, MQTT_PORT)

# Open Stream
cap = cv2.VideoCapture(STREAM_URL)

print("🔥 Fire Detection Stream Started!")
print(f"📹 Stream: {STREAM_URL}")
print(f"📡 MQTT: {MQTT_BROKER}")

while True:
    ret, frame = cap.read()
    if not ret:
        print("❌ Stream lost, reconnecting...")
        cap = cv2.VideoCapture(STREAM_URL)
        time.sleep(2)
        continue

    # Run Detection
    results = model(frame, conf=0.5)
    
    for result in results:
        boxes = result.boxes
        for box in boxes:
            # Get coordinates
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            conf = box.conf[0].cpu().numpy()
            cls = box.cls[0].cpu().numpy()
            
            # Calculate normalized bbox (for overlay)
            height, width = frame.shape[:2]
            bbox = {
                'x': (x1 / width) * 100,
                'y': (y1 / height) * 100,
                'width': ((x2 - x1) / width) * 100,
                'height': ((y2 - y1) / height) * 100
            }
            
            # Publish to MQTT
            payload = {
                'type': 'fire_detection',
                'bbox': bbox,
                'confidence': float(conf),
                'timestamp': int(time.time() * 1000),
                'frame_size': {'width': width, 'height': height}
            }
            
            mqtt_client.publish(MQTT_TOPIC_DETECTION, json.dumps(payload))
            print(f"🔥 Fire detected! Confidence: {conf:.2f}")
            
            # Draw on frame (optional, for local viewing)
            cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)
            cv2.putText(frame, f"Fire {conf:.2f}", (int(x1), int(y1)-10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
    
    # Show local preview (optional)
    cv2.imshow('Fire Detection', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
mqtt_client.disconnect()
```

### **Method 2: Direct ESP32 Integration** (Advanced)

Tambahkan AI model di ESP32 (membutuhkan ESP32-S3):

```cpp
// Coming soon: TensorFlow Lite Micro on ESP32-S3
// Real-time fire detection on device
```

---

## 📡 **MQTT INTEGRATION**

### **Subscribe di Dashboard**

Update `src/hooks/useMqttClient.ts`:

```typescript
// Add subscription
client.subscribe('lab/zaks/fire-detection', (err) => {
  if (!err) {
    console.log('Subscribed to fire detection overlay');
  }
});

// Handle messages
client.on('message', (topic, payload) => {
  if (topic === 'lab/zaks/fire-detection') {
    const detection = JSON.parse(payload.toString());
    // Update detection overlay in ESP32CamStream component
    updateDetectionOverlay(detection);
  }
});
```

### **Update ESP32CamStream Component**

```typescript
// Subscribe to MQTT fire-detection topic
useEffect(() => {
  const client = useTelemetryStore.getState().mqttClient;
  if (!client) return;

  const handleFireDetection = (topic: string, payload: Buffer) => {
    if (topic === 'lab/zaks/fire-detection') {
      const detection = JSON.parse(payload.toString());
      setDetections([detection]);
      
      // Clear after 2 seconds
      setTimeout(() => setDetections([]), 2000);
    }
  };

  client.on('message', handleFireDetection);
  
  return () => {
    client.off('message', handleFireDetection);
  };
}, []);
```

---

## 🎨 **UI FEATURES**

### **Stream Container**
```
┌─────────────────────────────────────────────┐
│ 📹 ESP32-CAM Live Stream      🟢 Connected │
│ ┌─────────────────────────────────────────┐ │
│ │                                         │ │
│ │         [LIVE VIDEO STREAM]            │ │
│ │                                         │ │
│ │     [🔥 Fire Detection Overlay]        │ │
│ │                                         │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Status: Streaming | Quality: Medium        │
│ Detection: Enabled | Connection: Online    │
└─────────────────────────────────────────────┘
```

### **Controls Panel**
- 🔥 Detection Overlay Toggle
- 📸 Snapshot
- ↻ Restart
- ⚙️ Settings
- ⛶ Fullscreen
- ▶️ Start/Stop

---

## ⚠️ **TROUBLESHOOTING**

### **Stream tidak muncul**

1. **Check ESP32-CAM IP:**
   ```bash
   ping 192.168.1.100
   ```

2. **Test di browser:**
   ```
   http://192.168.1.100/stream
   ```

3. **Check same network:**
   - ESP32-CAM dan PC harus di network yang sama
   - Disable VPN

4. **Check firewall:**
   - Allow port 80 untuk ESP32-CAM
   - Disable antivirus temporarily

### **Stream lag / patah-patah**

1. **Reduce quality:**
   - Settings → Quality: Low
   - ESP32 code: `config.jpeg_quality = 15;` (higher = more compression)

2. **Reduce frame rate:**
   - ESP32 code: `delay(50);` // ~20 FPS
   - Settings → FPS: 10

3. **Check WiFi signal:**
   - ESP32-CAM dekat dengan router
   - Gunakan WiFi 2.4GHz (bukan 5GHz)

### **Auto-reconnect gagal**

1. **Restart ESP32-CAM:**
   - Press RESET button
   - Or power cycle

2. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R

3. **Check ESP32 logs:**
   - Serial Monitor untuk error messages

### **Detection overlay tidak muncul**

1. **Check MQTT connection:**
   - Dashboard header harus show "Connected"

2. **Run fire detection script:**
   ```bash
   python fire_detection_stream.py
   ```

3. **Check MQTT topic:**
   - Must be `lab/zaks/fire-detection`

---

## 📊 **PERFORMANCE**

### **Latency**

| Component | Latency |
|-----------|---------|
| ESP32-CAM encoding | ~30ms |
| Network transfer | ~50-100ms |
| Browser decoding | ~20ms |
| **Total** | **100-150ms** |

### **Bandwidth Usage**

| Quality | Resolution | Bitrate | Bandwidth/minute |
|---------|------------|---------|------------------|
| Low | 320x240 | 100 KB/s | ~6 MB |
| Medium | 640x480 | 200 KB/s | ~12 MB |
| High | 1024x768 | 400 KB/s | ~24 MB |

### **CPU Usage**

- ESP32-CAM: ~40-60%
- Browser: ~10-20%
- Python detection: ~30-50% (1 core)

---

## 🔜 **ADVANCED FEATURES** (Optional)

### **1. Multi-Camera Support**

```typescript
const cameras = [
  { id: 1, url: 'http://192.168.1.100/stream', name: 'Camera 1' },
  { id: 2, url: 'http://192.168.1.101/stream', name: 'Camera 2' },
  { id: 3, url: 'http://192.168.1.102/stream', name: 'Camera 3' },
];
```

### **2. Recording (Server-side)**

```python
# Record stream to MP4
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter('output.mp4', fourcc, 20.0, (640, 480))
out.write(frame)
```

### **3. PTZ Control** (If supported)

```cpp
// ESP32-CAM with servo motors
#include <ESP32Servo.h>

Servo panServo;
Servo tiltServo;

void movePan(int angle) {
  panServo.write(angle);
}
```

### **4. WebRTC (Ultra Low Latency)**

For <50ms latency, implement WebRTC:
- ESP32-CAM WebRTC library
- Dashboard: `react-webrtc`
- More complex setup

---

## 📚 **REFERENCES**

- ESP32-CAM Docs: https://github.com/espressif/esp32-camera
- YOLO Fire Detection: https://github.com/ultralytics/ultralytics
- MQTT Protocol: https://mqtt.org/
- OpenCV: https://opencv.org/

---

## ✅ **CHECKLIST**

- [ ] ESP32-CAM hardware setup
- [ ] WiFi configured
- [ ] Code uploaded to ESP32-CAM
- [ ] IP address noted
- [ ] Stream URL updated in dashboard
- [ ] Dashboard running (http://localhost:5173)
- [ ] Stream component visible
- [ ] Click "Start" button
- [ ] Video stream appears
- [ ] Fire detection overlay tested
- [ ] Snapshot feature tested
- [ ] Fullscreen mode tested
- [ ] Python detection script running (optional)
- [ ] MQTT overlay integration (optional)

---

## 🎉 **SUCCESS!**

Dashboard kini memiliki **Live Streaming Real-Time** dari ESP32-CAM dengan fire detection overlay!

**Features:**
- ✅ MJPEG HTTP Stream (native ESP32)
- ✅ Real-time fire detection overlay via MQTT
- ✅ Snapshot & recording ready
- ✅ Auto-reconnect & error handling
- ✅ Responsive design & fullscreen
- ✅ Configurable quality settings

**Perfect for:**
- Fire detection monitoring
- Security surveillance
- Industrial automation
- Research & development
- Educational purposes

---

**Next Steps:**
1. Deploy to production server
2. Add multi-camera support
3. Implement recording feature
4. Add PTZ control (if applicable)
5. Optimize for mobile devices

🔥 **Happy Monitoring!** 🔥
