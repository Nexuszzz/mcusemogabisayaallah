// ESP32-CAM Fire Detection + WiFi Manager + MQTT IP Broadcasting
// ================================================================
// 
// FITUR WiFi Manager:
//   - Jika tidak bisa connect WiFi → ESP32 jadi Access Point
//   - User connect ke AP "FireCam-Setup" (password: fire12345)
//   - Buka browser http://192.168.4.1 → pilih WiFi & masukkan password
//   - Setelah connect → IP otomatis broadcast via MQTT
//   - Python script auto-detect IP (tidak perlu input manual!)
//
// ENDPOINTS:
//   /                 -> HTML view dengan live stream
//   /capture          -> single JPEG capture
//   :81/stream        -> MJPEG stream (untuk YOLO detection)
//   /led?on=1|0       -> kontrol flash LED
//   /set?size=...     -> ubah resolusi
//   /status           -> info JSON
//   /reset            -> reset WiFi credentials (kembali ke AP mode)
//
// MQTT TOPICS:
//   lab/zaks/esp32cam/ip     -> Broadcast IP (retained)
//   lab/zaks/event           -> Status events
//   lab/zaks/esp32cam/cmd    -> Receive commands (FLASH_ON, FLASH_OFF, RESTART)
//
// INSTALL LIBRARY:
//   1. Arduino IDE -> Library Manager
//   2. Search "WiFiManager" by tzapu
//   3. Install "WiFiManager" (pastikan untuk ESP32)

#include <WiFi.h>
#include <WiFiManager.h>  // https://github.com/tzapu/WiFiManager
#include "esp_camera.h"
#include <WebServer.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ====== WiFi Manager Configuration ======
#define AP_NAME "FireCam-Setup"      // Nama Access Point saat setup mode (NO PASSWORD)
#define CONFIG_TIMEOUT 180           // Timeout AP mode (3 menit)

// ====== MQTT Configuration ======
const char* MQTT_SERVER = "3.27.0.139";
const int MQTT_PORT = 1883;
const char* MQTT_USER = "zaks";
const char* MQTT_PASSWORD = "enggangodinginmcu";
const char* MQTT_CLIENT_ID = "esp32cam-fire";
const char* TOPIC_IP_ANNOUNCE = "lab/zaks/esp32cam/ip";
const char* TOPIC_EVENT = "lab/zaks/event";
const char* TOPIC_CMD = "lab/zaks/esp32cam/cmd";

// ====== Pin mapping AI Thinker ESP32-CAM ======
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
#define LED_FLASH_GPIO     4   // Flash LED (active HIGH)
#define LED_STATUS_GPIO   33   // Red LED (active LOW)

// ====== Objects ======
WebServer server(80);
WiFiServer streamServer(81);
WiFiClient espClient;
PubSubClient mqtt(espClient);
WiFiManager wifiManager;
Preferences preferences;

// ====== State Variables ======
unsigned long bootMs = 0;
unsigned long lastMqttAttempt = 0;
unsigned long lastIPBroadcast = 0;
unsigned long lastHeartbeat = 0;
const unsigned long MQTT_RETRY_INTERVAL = 5000;
const unsigned long IP_BROADCAST_INTERVAL = 30000;
const unsigned long HEARTBEAT_INTERVAL = 60000;
bool mqttConnected = false;
bool wifiConfigured = false;

// ====== Utility Functions ======
String chipIdString() {
  uint64_t id = ESP.getEfuseMac();
  char buf[17];
  snprintf(buf, sizeof(buf), "%04X%08X", (uint16_t)(id>>32), (uint32_t)id);
  return String(buf);
}

String getShortChipId() {
  String fullId = chipIdString();
  return fullId.substring(fullId.length() - 6);
}

const char* frameSizeName(framesize_t fs) {
  switch (fs) {
    case FRAMESIZE_QQVGA:  return "qqvga";
    case FRAMESIZE_QVGA:   return "qvga";
    case FRAMESIZE_VGA:    return "vga";
    case FRAMESIZE_SVGA:   return "svga";
    case FRAMESIZE_XGA:    return "xga";
    case FRAMESIZE_SXGA:   return "sxga";
    case FRAMESIZE_UXGA:   return "uxga";
    default:               return "custom";
  }
}

framesize_t parseFrameSize(String s) {
  s.toLowerCase();
  if (s == "qqvga") return FRAMESIZE_QQVGA;
  if (s == "qvga")  return FRAMESIZE_QVGA;
  if (s == "vga")   return FRAMESIZE_VGA;
  if (s == "svga")  return FRAMESIZE_SVGA;
  if (s == "xga")   return FRAMESIZE_XGA;
  if (s == "sxga")  return FRAMESIZE_SXGA;
  if (s == "uxga")  return FRAMESIZE_UXGA;
  return FRAMESIZE_VGA;
}

// ====== Camera Initialization ======
bool initCamera(framesize_t fs = FRAMESIZE_VGA, int jpeg_quality = 12, int fb_count = 1) {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
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
  config.pin_href  = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn  = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size   = fs;
  config.pixel_format = PIXFORMAT_JPEG;
  config.jpeg_quality = jpeg_quality;
  config.fb_count     = fb_count;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAM] Init failed: 0x%x\n", err);
    return false;
  }

  sensor_t* s = esp_camera_sensor_get();
  if (s) {
    s->set_brightness(s, 0);
    s->set_contrast(s, 0);
    s->set_saturation(s, -1);
    s->set_whitebal(s, 1);
    s->set_awb_gain(s, 1);
    s->set_exposure_ctrl(s, 1);
    s->set_gain_ctrl(s, 1);
    s->set_vflip(s, 1);
    s->set_hmirror(s, 0);
  }
  return true;
}

// ====== MQTT Functions ======
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.printf("[MQTT] Received on %s: %s\n", topic, message.c_str());
  
  if (String(topic) == TOPIC_CMD) {
    if (message == "FLASH_ON") {
      digitalWrite(LED_FLASH_GPIO, HIGH);
      Serial.println("[CMD] Flash ON");
    } else if (message == "FLASH_OFF") {
      digitalWrite(LED_FLASH_GPIO, LOW);
      Serial.println("[CMD] Flash OFF");
    } else if (message == "RESTART") {
      Serial.println("[CMD] Restarting...");
      delay(1000);
      ESP.restart();
    } else if (message == "RESET_WIFI") {
      Serial.println("[CMD] Resetting WiFi credentials...");
      wifiManager.resetSettings();
      delay(1000);
      ESP.restart();
    } else if (message == "STATUS") {
      broadcastIP();
    }
  }
}

void connectMQTT() {
  if (!WiFi.isConnected()) return;
  if (millis() - lastMqttAttempt < MQTT_RETRY_INTERVAL) return;
  lastMqttAttempt = millis();
  
  Serial.printf("[MQTT] Connecting to %s:%d...\n", MQTT_SERVER, MQTT_PORT);
  
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setBufferSize(1024);  // Increase buffer for retained messages
  mqtt.setCallback(mqttCallback);
  
  String clientId = String(MQTT_CLIENT_ID) + "-" + getShortChipId();
  
  if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD)) {
    Serial.println("[MQTT] ✅ Connected!");
    mqttConnected = true;
    
    // Subscribe to command topic
    mqtt.subscribe(TOPIC_CMD);
    Serial.printf("[MQTT] Subscribed to: %s\n", TOPIC_CMD);
    
    // Broadcast IP immediately
    broadcastIP();
    
    // Publish online event
    StaticJsonDocument<256> doc;
    doc["event"] = "esp32cam_online";
    doc["id"] = chipIdString();
    doc["ip"] = WiFi.localIP().toString();
    doc["ssid"] = WiFi.SSID();
    doc["rssi"] = WiFi.RSSI();
    doc["ts"] = millis();
    
    String payload;
    serializeJson(doc, payload);
    mqtt.publish(TOPIC_EVENT, payload.c_str());
    
  } else {
    Serial.printf("[MQTT] ❌ Failed, rc=%d\n", mqtt.state());
    mqttConnected = false;
  }
}

void broadcastIP() {
  if (!mqtt.connected()) return;
  
  String ip = WiFi.localIP().toString();
  String streamUrl = "http://" + ip + ":81/stream";
  String snapshotUrl = "http://" + ip + "/capture";
  
  StaticJsonDocument<768> doc;
  doc["chipId"] = chipIdString();
  doc["id"] = "firecam-" + getShortChipId();
  doc["ip"] = ip;
  doc["stream_url"] = streamUrl;
  doc["snapshot_url"] = snapshotUrl;
  doc["status_url"] = "http://" + ip + "/status";
  doc["ssid"] = WiFi.SSID();
  doc["rssi"] = WiFi.RSSI();
  doc["uptime"] = (millis() - bootMs) / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["camera_ready"] = true;
  doc["ts"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  
  // Debug: Show payload size
  Serial.printf("[MQTT] Payload size: %d bytes\n", payload.length());
  
  // Retained message - new subscribers get it immediately
  bool published = mqtt.publish(TOPIC_IP_ANNOUNCE, payload.c_str(), true);
  
  if (published) {
    Serial.println("\n[MQTT] 📡 IP Broadcast SUCCESS:");
    Serial.printf("   ID: firecam-%s\n", getShortChipId().c_str());
    Serial.printf("   IP: %s\n", ip.c_str());
    Serial.printf("   Stream: %s\n", streamUrl.c_str());
    Serial.printf("   WiFi: %s (%d dBm)\n", WiFi.SSID().c_str(), WiFi.RSSI());
  } else {
    Serial.println("[MQTT] ❌ IP Broadcast FAILED");
    Serial.printf("   Reason: Buffer overflow or connection issue\n");
    Serial.printf("   Payload length: %d bytes\n", payload.length());
    Serial.printf("   MQTT State: %d\n", mqtt.state());
  }
  
  lastIPBroadcast = millis();
}

void sendHeartbeat() {
  if (!mqtt.connected()) return;
  
  StaticJsonDocument<256> doc;
  doc["event"] = "heartbeat";
  doc["id"] = chipIdString();
  doc["ip"] = WiFi.localIP().toString();
  doc["uptime"] = (millis() - bootMs) / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["rssi"] = WiFi.RSSI();
  
  String payload;
  serializeJson(doc, payload);
  mqtt.publish(TOPIC_EVENT, payload.c_str());
  
  lastHeartbeat = millis();
}

// ====== HTTP Handlers ======
void handleRoot() {
  sensor_t* s = esp_camera_sensor_get();
  String html;
  html.reserve(3000);
  
  html += "<!DOCTYPE html><html><head>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<meta charset='UTF-8'>";
  html += "<title>FireCam - " + getShortChipId() + "</title>";
  html += "<style>";
  html += "body{font-family:system-ui,Arial;margin:0;padding:14px;background:#1a1a2e;color:#eee}";
  html += "h2{color:#ff6b6b;margin-bottom:5px}";
  html += ".subtitle{color:#888;font-size:14px;margin-bottom:15px}";
  html += ".card{background:#16213e;border-radius:10px;padding:15px;margin-bottom:15px}";
  html += ".row{margin:8px 0;display:flex;justify-content:space-between}";
  html += ".label{color:#888}";
  html += ".value{color:#4ecca3;font-weight:bold}";
  html += ".online{color:#4ecca3}";
  html += ".offline{color:#ff6b6b}";
  html += "a{color:#4ecdc4;text-decoration:none}";
  html += "a:hover{text-decoration:underline}";
  html += ".btn{display:inline-block;padding:8px 16px;background:#4ecdc4;color:#1a1a2e;";
  html += "border-radius:5px;text-decoration:none;margin:3px;font-weight:bold}";
  html += ".btn:hover{background:#45b7aa}";
  html += ".btn-red{background:#ff6b6b}";
  html += ".btn-red:hover{background:#e85555}";
  html += "img{max-width:100%;border-radius:8px;border:2px solid #333}";
  html += "pre{background:#0f0f23;padding:10px;border-radius:5px;overflow:auto;font-size:12px}";
  html += ".footer{text-align:center;color:#666;font-size:11px;margin-top:20px}";
  html += "</style></head><body>";
  
  html += "<h2>🔥 FireCam</h2>";
  html += "<div class='subtitle'>ESP32-CAM Fire Detection with WiFi Manager</div>";
  
  // Status Card
  html += "<div class='card'>";
  html += "<div class='row'><span class='label'>Status</span><span class='value online'>✅ Online</span></div>";
  html += "<div class='row'><span class='label'>Chip ID</span><span class='value'>" + getShortChipId() + "</span></div>";
  html += "<div class='row'><span class='label'>IP Address</span><span class='value'>" + WiFi.localIP().toString() + "</span></div>";
  html += "<div class='row'><span class='label'>WiFi</span><span class='value'>" + WiFi.SSID() + " (" + String(WiFi.RSSI()) + " dBm)</span></div>";
  html += "<div class='row'><span class='label'>MQTT</span><span class='value " + String(mqttConnected ? "online" : "offline") + "'>";
  html += mqttConnected ? "✅ Connected" : "❌ Disconnected";
  html += "</span></div>";
  html += "</div>";
  
  // Live Stream Card
  html += "<div class='card'>";
  html += "<h3 style='margin-top:0;color:#4ecdc4'>📹 Live Stream</h3>";
  html += "<img id='stream' src='http://" + WiFi.localIP().toString() + ":81/stream' onerror=\"this.src='/capture'\">";
  html += "</div>";
  
  // Controls Card
  html += "<div class='card'>";
  html += "<h3 style='margin-top:0;color:#4ecdc4'>🎮 Controls</h3>";
  html += "<a href='/capture' target='_blank' class='btn'>📸 Capture</a>";
  html += "<a href='/led?on=1' class='btn'>💡 Flash ON</a>";
  html += "<a href='/led?on=0' class='btn'>💡 Flash OFF</a>";
  html += "<a href='/reset' class='btn btn-red' onclick=\"return confirm('Reset WiFi credentials?')\">🔄 Reset WiFi</a>";
  html += "</div>";
  
  // Resolution Card
  html += "<div class='card'>";
  html += "<h3 style='margin-top:0;color:#4ecdc4'>📐 Resolution</h3>";
  html += "<div class='row'><span class='label'>Current</span><span class='value'>";
  html += String(frameSizeName(s ? (framesize_t)s->status.framesize : FRAMESIZE_VGA));
  html += " / Q" + String(s ? s->status.quality : 12) + "</span></div>";
  html += "<div style='margin-top:10px'>";
  html += "<a href='/set?size=qvga&quality=10' class='btn'>QVGA</a>";
  html += "<a href='/set?size=vga&quality=12' class='btn'>VGA</a>";
  html += "<a href='/set?size=svga&quality=14' class='btn'>SVGA</a>";
  html += "</div></div>";
  
  // Python Config Card
  html += "<div class='card'>";
  html += "<h3 style='margin-top:0;color:#4ecdc4'>🐍 Python Auto-Config</h3>";
  html += "<p style='color:#888;font-size:13px'>IP otomatis broadcast via MQTT. Python script akan auto-detect!</p>";
  html += "<pre>MQTT Topic: " + String(TOPIC_IP_ANNOUNCE) + "\n";
  html += "Stream URL: http://" + WiFi.localIP().toString() + ":81/stream</pre>";
  html += "<a href='/status' target='_blank' class='btn'>📊 Status JSON</a>";
  html += "</div>";
  
  // Footer
  html += "<div class='footer'>";
  html += "Uptime: " + String((millis()-bootMs)/1000) + "s | ";
  html += "Heap: " + String(ESP.getFreeHeap()/1024) + " KB | ";
  html += "FireCam v2.0";
  html += "</div>";
  
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleCapture() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    server.send(503, "text/plain", "Camera Busy");
    return;
  }
  server.setContentLength(fb->len);
  server.send(200, "image/jpeg", "");
  WiFiClient c = server.client();
  c.write(fb->buf, fb->len);
  esp_camera_fb_return(fb);
}

void handleLed() {
  String on = server.hasArg("on") ? server.arg("on") : "";
  if (on == "1") {
    digitalWrite(LED_FLASH_GPIO, HIGH);
  } else if (on == "0") {
    digitalWrite(LED_FLASH_GPIO, LOW);
  }
  server.sendHeader("Location", "/", true);
  server.send(302, "text/plain", "OK");
}

void handleSet() {
  sensor_t* s = esp_camera_sensor_get();
  if (server.hasArg("size")) {
    framesize_t fs = parseFrameSize(server.arg("size"));
    if (s) s->set_framesize(s, fs);
  }
  if (server.hasArg("quality")) {
    int q = constrain(server.arg("quality").toInt(), 10, 63);
    if (s) s->set_quality(s, q);
  }
  
  server.sendHeader("Location", "/", true);
  server.send(302, "text/plain", "OK");
}

void handleStatus() {
  sensor_t* s = esp_camera_sensor_get();
  StaticJsonDocument<512> doc;
  
  doc["chipId"] = chipIdString();
  doc["id"] = "firecam-" + getShortChipId();
  doc["ip"] = WiFi.localIP().toString();
  doc["stream_url"] = "http://" + WiFi.localIP().toString() + ":81/stream";
  doc["snapshot_url"] = "http://" + WiFi.localIP().toString() + "/capture";
  doc["ssid"] = WiFi.SSID();
  doc["rssi"] = WiFi.RSSI();
  doc["size"] = frameSizeName((framesize_t)(s ? s->status.framesize : FRAMESIZE_VGA));
  doc["quality"] = s ? s->status.quality : 12;
  doc["uptime_s"] = (millis() - bootMs) / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["mqtt_connected"] = mqttConnected;
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleReset() {
  server.send(200, "text/html", 
    "<html><body style='background:#1a1a2e;color:#fff;font-family:Arial;text-align:center;padding:50px'>"
    "<h2>🔄 Resetting WiFi...</h2>"
    "<p>ESP32-CAM will restart in AP mode.</p>"
    "<p>Connect to: <b>" AP_NAME "</b></p>"
    "<p>Password: <b>NO PASSWORD (Open WiFi)</b></p>"
    "</body></html>");
  delay(2000);
  wifiManager.resetSettings();
  ESP.restart();
}

// ====== Stream Handler ======
void streamClient(WiFiClient client) {
  const char* header =
    "HTTP/1.1 200 OK\r\n"
    "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n"
    "Cache-Control: no-cache\r\n"
    "Access-Control-Allow-Origin: *\r\n"
    "Connection: close\r\n\r\n";
  client.print(header);

  while (client.connected()) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
      delay(10);
      continue;
    }

    client.print("--frame\r\n");
    client.print("Content-Type: image/jpeg\r\n");
    client.printf("Content-Length: %u\r\n\r\n", fb->len);
    client.write(fb->buf, fb->len);
    client.print("\r\n");

    esp_camera_fb_return(fb);
    delay(10);
  }
  client.stop();
}

// ====== WiFi Manager Callbacks ======
void configModeCallback(WiFiManager *myWiFiManager) {
  Serial.println("\n========================================");
  Serial.println("📡 Entered WiFi Config Mode!");
  Serial.println("========================================");
  Serial.printf("   AP Name: %s\n", AP_NAME);
  Serial.println("   AP Pass: (NO PASSWORD - Open WiFi)");
  Serial.println("   AP IP: 192.168.4.1");
  Serial.println("");
  Serial.println("   1. Connect to WiFi: " AP_NAME);
  Serial.println("   2. Open browser: http://192.168.4.1");
  Serial.println("   3. Select your WiFi & enter password");
  Serial.println("========================================\n");
  
  // Blink LED to indicate config mode
  for (int i = 0; i < 5; i++) {
    digitalWrite(LED_FLASH_GPIO, HIGH);
    delay(100);
    digitalWrite(LED_FLASH_GPIO, LOW);
    delay(100);
  }
}

void saveConfigCallback() {
  Serial.println("[WiFiManager] Config saved!");
  wifiConfigured = true;
}

// ====== SETUP ======
void setup() {
  // Initialize pins
  pinMode(LED_FLASH_GPIO, OUTPUT);
  pinMode(LED_STATUS_GPIO, OUTPUT);
  digitalWrite(LED_FLASH_GPIO, LOW);
  digitalWrite(LED_STATUS_GPIO, HIGH); // OFF (active LOW)
  
  Serial.begin(115200);
  delay(500);
  
  Serial.println("\n\n================================================");
  Serial.println("🔥 ESP32-CAM Fire Detection + WiFi Manager");
  Serial.println("================================================");
  Serial.printf("   Chip ID: %s\n", chipIdString().c_str());
  Serial.printf("   Short ID: %s\n", getShortChipId().c_str());
  Serial.println("================================================\n");

  // Initialize camera
  Serial.print("[CAM] Initializing... ");
  if (!initCamera(FRAMESIZE_VGA, 12, 1)) {
    Serial.println("❌ FAILED!");
    while (true) {
      digitalWrite(LED_FLASH_GPIO, HIGH);
      delay(500);
      digitalWrite(LED_FLASH_GPIO, LOW);
      delay(500);
    }
  }
  Serial.println("✅ OK");

  // Configure WiFi Manager
  wifiManager.setAPCallback(configModeCallback);
  wifiManager.setSaveConfigCallback(saveConfigCallback);
  wifiManager.setConfigPortalTimeout(CONFIG_TIMEOUT);
  wifiManager.setMinimumSignalQuality(20);
  
  // Custom AP name with chip ID
  String apName = String(AP_NAME) + "-" + getShortChipId();
  
  Serial.println("[WiFi] Starting WiFi Manager...");
  Serial.printf("   If no saved WiFi, AP will start: %s (NO PASSWORD)\n", apName.c_str());
  
  // Try to connect to saved WiFi, or start AP (NO PASSWORD)
  if (!wifiManager.autoConnect(apName.c_str())) {
    Serial.println("[WiFi] ❌ Failed to connect and timeout reached!");
    Serial.println("   Restarting...");
    delay(3000);
    ESP.restart();
  }

  // Connected!
  Serial.println("\n[WiFi] ✅ Connected!");
  Serial.printf("   SSID: %s\n", WiFi.SSID().c_str());
  Serial.printf("   IP: %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("   Gateway: %s\n", WiFi.gatewayIP().toString().c_str());
  Serial.printf("   Signal: %d dBm\n", WiFi.RSSI());

  // Setup HTTP server
  server.on("/", handleRoot);
  server.on("/capture", handleCapture);
  server.on("/led", handleLed);
  server.on("/set", handleSet);
  server.on("/status", handleStatus);
  server.on("/reset", handleReset);
  server.begin();
  Serial.println("[HTTP] ✅ Server started on port 80");

  // Setup Stream server
  streamServer.begin();
  Serial.println("[HTTP] ✅ Stream server started on port 81");

  // Connect MQTT
  connectMQTT();

  bootMs = millis();
  
  Serial.println("\n================================================");
  Serial.println("🎉 FIRECAM READY!");
  Serial.println("================================================");
  Serial.println("Endpoints:");
  Serial.printf("   Dashboard: http://%s/\n", WiFi.localIP().toString().c_str());
  Serial.printf("   Stream:    http://%s:81/stream\n", WiFi.localIP().toString().c_str());
  Serial.printf("   Capture:   http://%s/capture\n", WiFi.localIP().toString().c_str());
  Serial.printf("   Status:    http://%s/status\n", WiFi.localIP().toString().c_str());
  Serial.printf("   Reset:     http://%s/reset\n", WiFi.localIP().toString().c_str());
  Serial.println("\nMQTT Topics:");
  Serial.printf("   IP Announce: %s\n", TOPIC_IP_ANNOUNCE);
  Serial.printf("   Events: %s\n", TOPIC_EVENT);
  Serial.printf("   Commands: %s\n", TOPIC_CMD);
  Serial.println("================================================\n");
}

// ====== LOOP ======
void loop() {
  // Handle HTTP requests
  server.handleClient();

  // Handle stream clients
  WiFiClient client = streamServer.available();
  if (client) {
    Serial.println("[Stream] Client connected");
    streamClient(client);
    Serial.println("[Stream] Client disconnected");
  }

  // MQTT maintenance
  if (WiFi.isConnected()) {
    if (!mqtt.connected()) {
      mqttConnected = false;
      connectMQTT();
    } else {
      mqtt.loop();
      
      // Periodic IP broadcast
      if (millis() - lastIPBroadcast > IP_BROADCAST_INTERVAL) {
        broadcastIP();
      }
      
      // Heartbeat
      if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
        sendHeartbeat();
      }
    }
  } else {
    // WiFi disconnected - try reconnect
    Serial.println("[WiFi] Connection lost! Reconnecting...");
    WiFi.reconnect();
    delay(5000);
  }
  
  delay(10);
}
