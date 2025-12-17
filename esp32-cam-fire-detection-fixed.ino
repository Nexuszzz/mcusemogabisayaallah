// ESP32-CAM Fire Detection + MQTT IP Broadcasting
// Compatible dengan backend 3.27.0.139:8080
// 
// Endpoints:
//   /                 -> HTML view
//   /capture          -> single JPEG
//   :81/stream        -> MJPEG stream (untuk YOLO)
//   /led?on=1|0       -> kontrol flash LED
//   /set?size=...     -> ubah resolusi
//   /status           -> info JSON
//
// MQTT:
//   Topic: lab/zaks/esp32cam/ip
//   Payload: {"ip":"192.168.x.x","stream_url":"http://..."}

#include <WiFi.h>
#include "esp_camera.h"
#include <WebServer.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ====== WiFi Fallback System ======
struct WiFiCredentials {
  const char* ssid;
  const char* password;
};

WiFiCredentials wifiList[] = {
  {"RedmiNote13", "naufal.453"},           // Primary hotspot
  {"AndroidAP", "12345678"},               // Alternative hotspot
  {"WIFI_RUMAH", "password123"},           // Home WiFi
  {"TP-Link_XXXX", "admin123"}             // Office WiFi
};
const int wifiCount = sizeof(wifiList) / sizeof(wifiList[0]);

// ====== MQTT Configuration ======
const char* MQTT_SERVER = "3.27.0.139";
const int MQTT_PORT = 1883;
const char* MQTT_USER = "zaks";
const char* MQTT_PASSWORD = "enggangodinginmcu";
const char* MQTT_CLIENT_ID = "esp32cam-fire";
const char* TOPIC_IP_ANNOUNCE = "lab/zaks/esp32cam/ip";
const char* TOPIC_EVENT = "lab/zaks/event";
const char* TOPIC_LOG = "lab/zaks/log";

// ====== Pin mapping AI Thinker ======
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
#define LED_FLASH_GPIO     4   // flash LED aktif HIGH

// ====== HTTP servers & MQTT ======
WebServer server(80);         // HTML, capture, control
WiFiServer streamServer(81);  // MJPEG stream
WiFiClient espClient;
PubSubClient mqtt(espClient);

// ====== State ======
unsigned long bootMs = 0;
unsigned long lastMqttAttempt = 0;
unsigned long lastIPBroadcast = 0;
unsigned long lastHeartbeat = 0;
const unsigned long MQTT_RETRY_INTERVAL = 5000;    // 5 detik retry MQTT
const unsigned long IP_BROADCAST_INTERVAL = 30000; // 30 detik broadcast IP
const unsigned long HEARTBEAT_INTERVAL = 60000;    // 1 menit heartbeat
bool mqttConnected = false;

String chipIdString() {
  uint64_t id = ESP.getEfuseMac();
  char buf[17];
  snprintf(buf, sizeof(buf), "%04X%08X", (uint16_t)(id>>32), (uint32_t)id);
  return String(buf);
}

const char* frameSizeName(framesize_t fs) {
  switch (fs) {
    case FRAMESIZE_QQVGA:  return "qqvga";   // 160x120
    case FRAMESIZE_QVGA:   return "qvga";    // 320x240
    case FRAMESIZE_VGA:    return "vga";     // 640x480
    case FRAMESIZE_SVGA:   return "svga";    // 800x600
    case FRAMESIZE_XGA:    return "xga";     // 1024x768
    case FRAMESIZE_SXGA:   return "sxga";    // 1280x1024
    case FRAMESIZE_UXGA:   return "uxga";    // 1600x1200
    default:               return "custom";
  }
}

framesize_t parseFrameSize(String s) {
  s.toLowerCase();
  if (s == "qqvga") return FRAMESIZE_QQVGA;
  if (s == "qvga")  return FRAMESIZE_QVGA;
  if (s == "vga")   return FRAMESIZE_VGA;   // 640x480
  if (s == "svga")  return FRAMESIZE_SVGA;
  if (s == "xga")   return FRAMESIZE_XGA;
  if (s == "sxga")  return FRAMESIZE_SXGA;
  if (s == "uxga")  return FRAMESIZE_UXGA;
  return FRAMESIZE_VGA;
}

// OPTIMIZED: VGA 640x480 @ quality 12, single framebuffer untuk stabilitas
bool initCamera(framesize_t fs=FRAMESIZE_VGA, int jpeg_quality=12, int fb_count=1) {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href  = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn  = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;

  config.xclk_freq_hz = 20000000;       // 20 MHz
  config.frame_size   = fs;             // DEFAULT VGA
  config.pixel_format = PIXFORMAT_JPEG; // stream JPEG
  config.jpeg_quality = jpeg_quality;   // 10..63 (kecil=lebih bagus)
  config.fb_count     = fb_count;       // 1 fb untuk stabilitas

  // Inisialisasi dengan error handling
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return false;
  }

  sensor_t* s = esp_camera_sensor_get();
  if (s) {
    // Optimized settings untuk fire detection
    s->set_brightness(s, 0);     // -2 to 2
    s->set_contrast(s, 0);       // -2 to 2  
    s->set_saturation(s, -1);    // -2 to 2 (kurangi saturasi untuk deteksi api lebih baik)
    s->set_special_effect(s, 0); // 0 to 6 (0=None, 1=Negative, 2=Grayscale, 3=Red Tint, 4=Green Tint, 5=Blue Tint, 6=Sepia)
    s->set_whitebal(s, 1);       // 0 = disable, 1 = enable
    s->set_awb_gain(s, 1);       // 0 = disable, 1 = enable
    s->set_wb_mode(s, 0);        // 0 to 4 - if awb_gain enabled (0 - Auto, 1 - Sunny, 2 - Cloudy, 3 - Office, 4 - Home)
    s->set_exposure_ctrl(s, 1);  // 0 = disable, 1 = enable
    s->set_aec2(s, 0);           // 0 = disable, 1 = enable
    s->set_ae_level(s, 0);       // -2 to 2
    s->set_aec_value(s, 300);    // 0 to 1200
    s->set_gain_ctrl(s, 1);      // 0 = disable, 1 = enable
    s->set_agc_gain(s, 0);       // 0 to 30
    s->set_gainceiling(s, (gainceiling_t)0);  // 0 to 6
    s->set_bpc(s, 0);            // 0 = disable, 1 = enable
    s->set_wpc(s, 1);            // 0 = disable, 1 = enable
    s->set_raw_gma(s, 1);        // 0 = disable, 1 = enable
    s->set_lenc(s, 1);           // 0 = disable, 1 = enable
    s->set_hmirror(s, 0);        // 0 = disable, 1 = enable
    s->set_vflip(s, 1);          // 0 = disable, 1 = enable
    s->set_dcw(s, 1);            // 0 = disable, 1 = enable
    s->set_colorbar(s, 0);       // 0 = disable, 1 = enable
  }
  return true;
}

// ====== MQTT Functions ======
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.printf("[MQTT] Received on %s: %s\n", topic, message.c_str());
  
  // Handle commands if needed
  if (String(topic) == "lab/zaks/esp32cam/cmd") {
    if (message == "FLASH_ON") {
      digitalWrite(LED_FLASH_GPIO, HIGH);
    } else if (message == "FLASH_OFF") {
      digitalWrite(LED_FLASH_GPIO, LOW);
    } else if (message == "RESTART") {
      ESP.restart();
    }
  }
}

void connectMQTT() {
  if (!WiFi.isConnected()) return;
  
  // Jangan retry terlalu sering
  if (millis() - lastMqttAttempt < MQTT_RETRY_INTERVAL) return;
  lastMqttAttempt = millis();
  
  Serial.print("\n[MQTT] Connecting to ");
  Serial.print(MQTT_SERVER);
  Serial.print(":");
  Serial.println(MQTT_PORT);
  
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  
  if (mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD)) {
    Serial.println("[MQTT] ✅ Connected!");
    mqttConnected = true;
    
    // Subscribe to command topic
    mqtt.subscribe("lab/zaks/esp32cam/cmd");
    
    // Broadcast IP immediately
    broadcastIP();
    
    // Publish online event
    StaticJsonDocument<256> doc;
    doc["event"] = "esp32cam_online";
    doc["id"] = chipIdString();
    doc["ip"] = WiFi.localIP().toString();
    doc["rssi"] = WiFi.RSSI();
    doc["ts"] = millis();
    
    String payload;
    serializeJson(doc, payload);
    mqtt.publish(TOPIC_EVENT, payload.c_str());
    
  } else {
    Serial.print("[MQTT] ❌ Failed, rc=");
    Serial.println(mqtt.state());
    mqttConnected = false;
  }
}

void broadcastIP() {
  if (!mqtt.connected()) return;
  
  String ip = WiFi.localIP().toString();
  String streamUrl = "http://" + ip + ":81/stream";
  String snapshotUrl = "http://" + ip + "/capture";
  
  StaticJsonDocument<512> doc;
  doc["id"] = chipIdString();
  doc["ip"] = ip;
  doc["stream_url"] = streamUrl;
  doc["snapshot_url"] = snapshotUrl;
  doc["status_url"] = "http://" + ip + "/status";
  doc["rssi"] = WiFi.RSSI();
  doc["uptime"] = (millis() - bootMs) / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["camera_ready"] = true;
  doc["ts"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  
  // Retained message = persistent, subscriber baru langsung dapat
  bool published = mqtt.publish(TOPIC_IP_ANNOUNCE, payload.c_str(), true);
  
  if (published) {
    Serial.println("\n[MQTT] 📡 IP Broadcast SUCCESS:");
    Serial.print("   IP: ");
    Serial.println(ip);
    Serial.print("   Stream: ");
    Serial.println(streamUrl);
    Serial.print("   Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("[MQTT] ❌ IP Broadcast FAILED");
  }
}

void sendHeartbeat() {
  if (!mqtt.connected()) return;
  
  StaticJsonDocument<256> doc;
  doc["id"] = chipIdString();
  doc["ip"] = WiFi.localIP().toString();
  doc["uptime"] = (millis() - bootMs) / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["rssi"] = WiFi.RSSI();
  doc["camera_ready"] = true;
  doc["ts"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  
  mqtt.publish(TOPIC_LOG, payload.c_str());
}

// ====== HTTP Handlers ======
void handleRoot() {
  sensor_t* s = esp_camera_sensor_get();
  String html;
  html.reserve(3048);
  html += "<!doctype html><html><head><meta name='viewport' content='width=device-width'>";
  html += "<meta charset='UTF-8'>";
  html += "<title>ESP32-CAM Fire Detection</title>";
  html += "<style>body{font-family:system-ui,Arial;margin:14px;background:#1e1e1e;color:#fff;} ";
  html += ".row{margin:8px 0} a{color:#4ecdc4;text-decoration:none} ";
  html += ".status{color:#4ecca3;font-weight:bold} ";
  html += ".error{color:#ff6b6b;font-weight:bold} ";
  html += ".info{background:#2a2a2a;padding:10px;border-radius:5px;margin:10px 0} ";
  html += "img{max-width:100%;border:2px solid #333;border-radius:8px}</style>";
  html += "<script>setInterval(()=>document.getElementById('v').src=document.getElementById('v').src.split('?')[0]+'?t='+Date.now(),30000)</script>";
  html += "</head><body>";
  html += "<h2>🔥 ESP32-CAM Fire Detection</h2>";
  html += "<div class='row'><span class='status'>✅ Camera: Online</span></div>";
  html += "<div class='row'><b>Chip ID:</b> " + chipIdString() + "</div>";
  html += "<div class='row'><b>IP:</b> " + WiFi.localIP().toString() + "</div>";
  html += "<div class='row'><b>Signal:</b> " + String(WiFi.RSSI()) + " dBm</div>";
  html += "<div class='row'><b>MQTT:</b> " + String(mqttConnected ? "✅ Connected" : "<span class='error'>❌ Disconnected</span>") + "</div>";
  html += "<hr>";
  html += "<div class='row'><img id='v' src='http://" + WiFi.localIP().toString() + ":81/stream' onload='this.style.border=\"2px solid #4ecca3\"' onerror='this.style.border=\"2px solid #ff6b6b\"'></div>";
  html += "<hr>";
  html += "<div class='row'><b>Controls:</b></div>";
  html += "<div class='row'><a href='/capture' target='_blank'>📸 Snapshot</a> | ";
  html += "<a href='/led?on=1'>💡 Flash ON</a> | <a href='/led?on=0'>💡 Flash OFF</a></div>";
  html += "<div class='row'><b>Resolution:</b> " + String(frameSizeName(s ? (framesize_t)s->status.framesize : FRAMESIZE_VGA));
  html += " | <b>Quality:</b> " + String(s ? s->status.quality : 12) + "</div>";
  html += "<div class='row'><b>Set:</b> ";
  html += "<a href='/set?size=qqvga&quality=10'>QQVGA/10</a> · ";
  html += "<a href='/set?size=qvga&quality=10'>QVGA/10</a> · ";
  html += "<a href='/set?size=vga&quality=12'>VGA/12</a></div>";
  html += "<hr>";
  html += "<div class='info'><b>🔗 Integration URLs:</b><br>";
  html += "<b>Stream:</b> http://" + WiFi.localIP().toString() + ":81/stream<br>";
  html += "<b>Snapshot:</b> http://" + WiFi.localIP().toString() + "/capture<br>";
  html += "<b>Status API:</b> http://" + WiFi.localIP().toString() + "/status</div>";
  html += "<div class='row'><a href='/status' target='_blank'>📊 JSON Status</a></div>";
  html += "<hr>";
  html += "<div class='row' style='font-size:12px;color:#888'>Uptime: " + String((millis()-bootMs)/1000) + "s | ";
  html += "Free Heap: " + String(ESP.getFreeHeap()/1024) + " KB | Backend: 3.27.0.139:8080</div>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleCapture() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) { 
    server.send(503, "text/plain", "Camera capture failed"); 
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
    Serial.println("[LED] Flash ON");
  } else if (on == "0") {
    digitalWrite(LED_FLASH_GPIO, LOW);
    Serial.println("[LED] Flash OFF");
  }
  server.sendHeader("Location", "/", true);
  server.send(302, "text/plain", "OK");
}

void handleSet() {
  sensor_t* s = esp_camera_sensor_get();
  String size = server.hasArg("size") ? server.arg("size") : "";
  String qstr = server.hasArg("quality") ? server.arg("quality") : "";
  bool changed = false;

  if (size.length() && s) {
    framesize_t fs = parseFrameSize(size);
    s->set_framesize(s, fs);
    changed = true;
    Serial.printf("[CAM] Resolution changed to: %s\n", frameSizeName(fs));
  }
  
  if (qstr.length() && s) {
    int q = constrain(server.arg("quality").toInt(), 10, 63);
    s->set_quality(s, q);
    changed = true;
    Serial.printf("[CAM] Quality changed to: %d\n", q);
  }

  String resp = "{\"ok\":true,\"size\":\"";
  resp += frameSizeName((framesize_t)(s ? s->status.framesize : FRAMESIZE_VGA));
  resp += "\",\"quality\":";
  resp += (s ? s->status.quality : 12);
  resp += ",\"changed\":";
  resp += changed ? "true" : "false";
  resp += "}";
  
  server.send(200, "application/json", resp);
}

void handleStatus() {
  sensor_t* s = esp_camera_sensor_get();
  StaticJsonDocument<512> doc;
  
  doc["id"] = chipIdString();
  doc["ip"] = WiFi.localIP().toString();
  doc["stream_url"] = "http://" + WiFi.localIP().toString() + ":81/stream";
  doc["snapshot_url"] = "http://" + WiFi.localIP().toString() + "/capture";
  doc["size"] = frameSizeName((framesize_t)(s ? s->status.framesize : FRAMESIZE_VGA));
  doc["quality"] = (int)(s ? s->status.quality : 12);
  doc["uptime_s"] = (millis() - bootMs) / 1000UL;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["rssi"] = WiFi.RSSI();
  doc["mqtt_connected"] = mqttConnected;
  doc["camera_ready"] = (s != nullptr);
  doc["backend_server"] = "3.27.0.139:8080";
  doc["ts"] = millis();
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
}

// Stream loop optimized untuk multiple clients
void streamClient(WiFiClient client) {
  const char* header =
    "HTTP/1.1 200 OK\r\n"
    "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n"
    "Cache-Control: no-cache\r\n"
    "Access-Control-Allow-Origin: *\r\n"
    "Connection: close\r\n\r\n";
  client.print(header);

  unsigned long lastFrame = 0;
  const unsigned long frameDelay = 100; // Max 10 FPS untuk stability

  while (client.connected()) {
    if (millis() - lastFrame < frameDelay) {
      delay(10);
      continue;
    }
    
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) { 
      delay(10); 
      continue; 
    }

    client.print("--frame\r\n");
    client.print("Content-Type: image/jpeg\r\n");
    client.printf("Content-Length: %u\r\n\r\n", fb->len);
    
    if (client.write(fb->buf, fb->len) != fb->len) {
      esp_camera_fb_return(fb);
      break; // Client disconnect
    }
    
    client.print("\r\n");
    esp_camera_fb_return(fb);
    
    lastFrame = millis();
  }
  client.stop();
}

void setup() {
  pinMode(LED_FLASH_GPIO, OUTPUT);
  digitalWrite(LED_FLASH_GPIO, LOW);
  Serial.begin(115200);
  delay(500);
  
  Serial.println("\n\n========================================");
  Serial.println("🔥 ESP32-CAM Fire Detection System");
  Serial.println("   Backend: 3.27.0.139:8080");
  Serial.println("   MQTT IP Broadcasting Enabled");
  Serial.println("========================================");

  // Camera init dengan retry
  Serial.print("[CAM] Initializing camera... ");
  int camRetries = 3;
  bool camOK = false;
  while (camRetries-- > 0 && !camOK) {
    camOK = initCamera(FRAMESIZE_VGA, 12, 1);
    if (!camOK) {
      Serial.printf("❌ Failed (retries left: %d)\n", camRetries);
      delay(1000);
    }
  }
  
  if (!camOK) {
    Serial.println("❌ Camera init FAILED after retries!");
    while (true) { delay(1000); }
  }
  Serial.println("✅ Camera ready");

  // WiFi connection dengan multiple networks fallback
  WiFi.mode(WIFI_STA);
  bool connected = false;
  
  for (int i = 0; i < wifiCount && !connected; i++) {
    Serial.printf("[WiFi] Trying %s", wifiList[i].ssid);
    WiFi.begin(wifiList[i].ssid, wifiList[i].password);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      connected = true;
      Serial.println("\n[WiFi] ✅ Connected!");
      Serial.printf("   Network: %s\n", wifiList[i].ssid);
      Serial.print("   IP: ");
      Serial.println(WiFi.localIP());
      Serial.print("   Gateway: ");
      Serial.println(WiFi.gatewayIP());
      Serial.print("   Signal: ");
      Serial.print(WiFi.RSSI());
      Serial.println(" dBm");
    } else {
      Serial.printf(" ❌ Failed\n");
      WiFi.disconnect();
      delay(1000);
    }
  }
  
  if (!connected) {
    Serial.println("\n[WiFi] ❌ All networks failed!");
    Serial.println("   Check WiFi credentials and availability");
    Serial.println("   Device will continue with periodic retry...");
  }

  // HTTP server setup
  server.on("/", handleRoot);
  server.on("/capture", handleCapture);
  server.on("/led", handleLed);
  server.on("/set", handleSet);
  server.on("/status", handleStatus);
  server.begin();
  Serial.println("[HTTP] ✅ Server started on port 80");

  // Stream server setup
  streamServer.begin();
  Serial.println("[STREAM] ✅ MJPEG server started on port 81");

  // MQTT initial connection
  if (WiFi.isConnected()) {
    connectMQTT();
  }

  bootMs = millis();
  
  Serial.println("\n========================================");
  Serial.println("🎉 ESP32-CAM READY FOR FIRE DETECTION!");
  Serial.println("========================================");
  Serial.println("📡 Endpoints:");
  Serial.println("   http://" + WiFi.localIP().toString() + "/");
  Serial.println("   http://" + WiFi.localIP().toString() + "/capture");
  Serial.println("   http://" + WiFi.localIP().toString() + ":81/stream");
  Serial.println("   http://" + WiFi.localIP().toString() + "/status");
  Serial.println("\n📨 MQTT Topics:");
  Serial.println("   " + String(TOPIC_IP_ANNOUNCE) + " (IP broadcast)");
  Serial.println("   " + String(TOPIC_EVENT) + " (events)");
  Serial.println("   " + String(TOPIC_LOG) + " (heartbeat)");
  Serial.println("========================================\n");
}

void loop() {
  // Handle HTTP requests
  server.handleClient();

  // Handle stream clients dengan timeout protection
  WiFiClient client = streamServer.available();
  if (client) {
    Serial.println("[STREAM] New client connected");
    streamClient(client);
    Serial.println("[STREAM] Client disconnected");
  }

  // WiFi reconnection handling
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWiFiAttempt = 0;
    if (millis() - lastWiFiAttempt > 30000) { // Try every 30s
      Serial.println("[WiFi] Reconnecting...");
      WiFi.reconnect();
      lastWiFiAttempt = millis();
    }
    delay(100);
    return; // Skip MQTT if no WiFi
  }

  // MQTT maintenance
  if (!mqtt.connected()) {
    mqttConnected = false;
    connectMQTT();
  } else {
    mqtt.loop();
    
    // Periodic IP broadcast
    if (millis() - lastIPBroadcast > IP_BROADCAST_INTERVAL) {
      broadcastIP();
      lastIPBroadcast = millis();
    }
    
    // Periodic heartbeat
    if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
      sendHeartbeat();
      lastHeartbeat = millis();
    }
  }
  
  delay(10);
}