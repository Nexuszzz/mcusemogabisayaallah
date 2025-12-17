// ESP32-CAM Minimal Fire Detection - Stable Version
// Fix untuk boot loop dan power issues

#include <WiFi.h>
#include "esp_camera.h"
#include <WebServer.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ====== WiFi - GANTI SESUAI KEBUTUHAN ======
const char* WIFI_SSID = "RedmiNote13";     // Ganti dengan WiFi Anda
const char* WIFI_PASS = "naufal.453";      // Ganti dengan password

// ====== MQTT ======
const char* MQTT_SERVER = "3.27.0.139";
const int MQTT_PORT = 1883;
const char* MQTT_USER = "zaks";
const char* MQTT_PASSWORD = "enggangodinginmcu";

// ====== Pin AI Thinker ======
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
#define LED_GPIO           4

// ====== Servers ======
WebServer server(80);
WiFiServer streamServer(81);
WiFiClient espClient;
PubSubClient mqtt(espClient);

// ====== State ======
bool cameraReady = false;
unsigned long lastMqttTry = 0;
unsigned long bootTime = 0;

// ====== Camera Init - MINIMAL ======
bool initCamera() {
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

  // MINIMAL CONFIG untuk stabilitas
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA;  // 640x480
  config.jpeg_quality = 15;           // Medium quality
  config.fb_count = 1;                // Single buffer

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init FAILED: 0x%x\n", err);
    return false;
  }

  // Basic sensor settings
  sensor_t* s = esp_camera_sensor_get();
  if (s) {
    s->set_vflip(s, 1);
    s->set_hmirror(s, 0);
  }
  
  cameraReady = true;
  return true;
}

// ====== WiFi Connect ======
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  Serial.printf("Connecting to %s", WIFI_SSID);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi OK!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi Failed!");
  }
}

// ====== MQTT Connect ======
void connectMQTT() {
  if (!WiFi.isConnected() || (millis() - lastMqttTry < 10000)) return;
  
  lastMqttTry = millis();
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  
  if (mqtt.connect("esp32cam", MQTT_USER, MQTT_PASSWORD)) {
    Serial.println("MQTT OK!");
    
    // Send IP
    String payload = "{\"ip\":\"" + WiFi.localIP().toString() + "\",\"stream\":\"http://" + WiFi.localIP().toString() + ":81/stream\"}";
    mqtt.publish("lab/zaks/esp32cam/ip", payload.c_str(), true);
  } else {
    Serial.println("MQTT Failed");
  }
}

// ====== HTTP Handlers ======
void handleRoot() {
  String html = "<!DOCTYPE html><html><head><title>ESP32-CAM</title>";
  html += "<meta name='viewport' content='width=device-width'></head><body>";
  html += "<h2>ESP32-CAM Fire Detection</h2>";
  html += "<p><b>Status:</b> " + String(cameraReady ? "OK" : "ERROR") + "</p>";
  html += "<p><b>IP:</b> " + WiFi.localIP().toString() + "</p>";
  html += "<p><b>WiFi:</b> " + String(WiFi.isConnected() ? "Connected" : "Disconnected") + "</p>";
  html += "<p><b>MQTT:</b> " + String(mqtt.connected() ? "Connected" : "Disconnected") + "</p>";
  html += "<hr><img src='http://" + WiFi.localIP().toString() + ":81/stream' style='max-width:100%'>";
  html += "<hr><a href='/capture'>Capture</a> | <a href='/led?on=1'>LED ON</a> | <a href='/led?on=0'>LED OFF</a>";
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

void handleCapture() {
  if (!cameraReady) {
    server.send(503, "text/plain", "Camera not ready");
    return;
  }
  
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    server.send(503, "text/plain", "Capture failed");
    return;
  }
  
  server.setContentLength(fb->len);
  server.send(200, "image/jpeg", "");
  WiFiClient client = server.client();
  client.write(fb->buf, fb->len);
  esp_camera_fb_return(fb);
}

void handleLED() {
  String state = server.arg("on");
  digitalWrite(LED_GPIO, state == "1" ? HIGH : LOW);
  server.send(200, "text/plain", "OK");
}

// ====== Stream Handler ======
void handleStream(WiFiClient client) {
  if (!cameraReady) {
    client.stop();
    return;
  }
  
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: multipart/x-mixed-replace; boundary=frame");
  client.println("Cache-Control: no-cache");
  client.println();
  
  while (client.connected()) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
      delay(100);
      continue;
    }
    
    client.println("--frame");
    client.println("Content-Type: image/jpeg");
    client.printf("Content-Length: %u\r\n\r\n", fb->len);
    client.write(fb->buf, fb->len);
    client.println();
    
    esp_camera_fb_return(fb);
    delay(100); // 10 FPS
  }
  client.stop();
}

void setup() {
  // Basic init
  pinMode(LED_GPIO, OUTPUT);
  digitalWrite(LED_GPIO, LOW);
  
  Serial.begin(115200);
  Serial.println("\n========================================");
  Serial.println("ESP32-CAM Fire Detection - MINIMAL");
  Serial.println("========================================");
  
  // Camera
  Serial.print("Camera init... ");
  if (initCamera()) {
    Serial.println("OK!");
  } else {
    Serial.println("FAILED!");
    // Continue anyway
  }
  
  // WiFi
  connectWiFi();
  
  // HTTP
  server.on("/", handleRoot);
  server.on("/capture", handleCapture);
  server.on("/led", handleLED);
  server.begin();
  
  // Stream server
  streamServer.begin();
  
  // MQTT
  if (WiFi.isConnected()) {
    connectMQTT();
  }
  
  bootTime = millis();
  
  Serial.println("========================================");
  Serial.println("READY!");
  if (WiFi.isConnected()) {
    Serial.println("Web: http://" + WiFi.localIP().toString());
    Serial.println("Stream: http://" + WiFi.localIP().toString() + ":81/stream");
  }
  Serial.println("========================================");
}

void loop() {
  // Basic services
  server.handleClient();
  
  // Stream clients
  WiFiClient streamClient = streamServer.available();
  if (streamClient) {
    handleStream(streamClient);
  }
  
  // MQTT
  if (WiFi.isConnected()) {
    if (!mqtt.connected()) {
      connectMQTT();
    } else {
      mqtt.loop();
    }
  }
  
  delay(10);
}