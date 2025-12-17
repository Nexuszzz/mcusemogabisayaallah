# 🔌 ESP32 Integration Guide

Panduan integrasi ESP32 dengan IoT Fire Detection Dashboard.

## 📋 Hardware Requirements

- **ESP32 Dev Board** (ESP32-WROOM atau ESP32-DevKit)
- **DHT22** sensor (Temperature & Humidity)
- **MQ-2** atau **MQ-135** gas sensor
- **Buzzer** aktif/pasif
- **LED** indicator (optional)
- **Resistor** dan kabel jumper

## 🔌 Wiring Diagram

```
DHT22:
  VCC  → 3.3V
  DATA → GPIO 4
  GND  → GND

MQ-2/MQ-135 Gas Sensor:
  VCC  → 5V
  AO   → GPIO 34 (ADC1_CH6)
  DO   → GPIO 35
  GND  → GND

Buzzer:
  VCC  → GPIO 5
  GND  → GND

LED Indicator:
  Anode  → GPIO 2 (via 220Ω resistor)
  Cathode → GND
```

## 📚 Library Dependencies

Install via Arduino Library Manager atau PlatformIO:

```cpp
// WiFi
#include <WiFi.h>

// MQTT
#include <PubSubClient.h>  // v2.8+

// Sensor
#include <DHT.h>           // DHT sensor library v1.4+

// JSON
#include <ArduinoJson.h>   // v6.21+
```

## 💾 Example Arduino Code

### Full Implementation

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ==================== CONFIGURATION ====================
// WiFi credentials
const char* WIFI_SSID = "YourWiFiSSID";
const char* WIFI_PASSWORD = "YourWiFiPassword";

// MQTT broker
const char* MQTT_SERVER = "192.168.1.100";
const int MQTT_PORT = 1883;
const char* MQTT_USERNAME = "your_username";  // Optional
const char* MQTT_PASSWORD = "your_password";  // Optional

// MQTT Topics
const char* TOPIC_EVENT = "lab/zaks/event";
const char* TOPIC_LOG = "lab/zaks/log";
const char* TOPIC_STATUS = "lab/zaks/status";
const char* TOPIC_ALERT = "lab/zaks/alert";

// Pin definitions
#define DHT_PIN 4
#define GAS_ANALOG_PIN 34
#define GAS_DIGITAL_PIN 35
#define BUZZER_PIN 5
#define LED_PIN 2

// Sensor type
#define DHT_TYPE DHT22

// Thresholds
int gasThreshold = 2000;  // Default threshold
const int TEMP_THRESHOLD = 40;  // °C
const int GAS_DIGITAL_THRESHOLD = 1;

// Update interval
const unsigned long TELEMETRY_INTERVAL = 2000;  // 2 seconds

// ==================== GLOBAL VARIABLES ====================
DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastTelemetryTime = 0;
bool alarmState = false;
bool buzzerState = false;

String chipId;

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=== IoT Fire Detection System ===");
  
  // Get ESP32 Chip ID
  uint64_t chipid = ESP.getEfuseMac();
  chipId = String((uint32_t)(chipid >> 32), HEX) + String((uint32_t)chipid, HEX);
  chipId.toUpperCase();
  Serial.printf("Chip ID: %s\n", chipId.c_str());
  
  // Initialize pins
  pinMode(GAS_DIGITAL_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  // Initialize DHT sensor
  dht.begin();
  Serial.println("DHT22 initialized");
  
  // Connect to WiFi
  connectWiFi();
  
  // Setup MQTT
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(30);
  
  Serial.println("Setup complete!");
}

// ==================== MAIN LOOP ====================
void loop() {
  // Ensure WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  
  // Ensure MQTT connection
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();
  
  // Send telemetry data
  if (millis() - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = millis();
    sendTelemetry();
  }
  
  // Check alarm conditions
  checkAlarmConditions();
  
  // Control buzzer
  digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
  digitalWrite(LED_PIN, alarmState ? HIGH : LOW);
}

// ==================== WIFI CONNECTION ====================
void connectWiFi() {
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi connection failed!");
  }
}

// ==================== MQTT CONNECTION ====================
void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  Serial.print("Connecting to MQTT broker...");
  
  String clientId = "ESP32-" + chipId;
  
  bool connected;
  if (strlen(MQTT_USERNAME) > 0) {
    connected = mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD);
  } else {
    connected = mqttClient.connect(clientId.c_str());
  }
  
  if (connected) {
    Serial.println(" Connected!");
    
    // Subscribe to command topic
    mqttClient.subscribe(TOPIC_CMD);
    Serial.printf("Subscribed to: %s\n", TOPIC_CMD);
    
    // Publish status
    publishStatus("online");
  } else {
    Serial.printf(" Failed! State: %d\n", mqttClient.state());
    delay(5000);
  }
}

// ==================== MQTT CALLBACK ====================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.printf("MQTT received [%s]: %s\n", topic, message.c_str());
  
  // Handle commands
  if (strcmp(topic, TOPIC_CMD) == 0) {
    handleCommand(message);
  }
}

// ==================== COMMAND HANDLER ====================
void handleCommand(String command) {
  command.trim();
  
  if (command == "BUZZER_ON") {
    buzzerState = true;
    Serial.println("✓ Buzzer ON");
  }
  else if (command == "BUZZER_OFF") {
    buzzerState = false;
    Serial.println("✓ Buzzer OFF");
  }
  else if (command.startsWith("THR=")) {
    int newThreshold = command.substring(4).toInt();
    if (newThreshold >= 100 && newThreshold <= 4000) {
      gasThreshold = newThreshold;
      Serial.printf("✓ Gas threshold set to: %d\n", gasThreshold);
    } else {
      Serial.println("✗ Invalid threshold value");
    }
  }
  else {
    Serial.printf("✗ Unknown command: %s\n", command.c_str());
  }
}

// ==================== SEND TELEMETRY ====================
void sendTelemetry() {
  // Read sensors
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int gasAnalog = analogRead(GAS_ANALOG_PIN);
  int gasDigital = digitalRead(GAS_DIGITAL_PIN);
  
  // Check for sensor errors
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read from DHT sensor!");
    temperature = 0;
    humidity = 0;
  }
  
  // Create JSON payload
  StaticJsonDocument<256> doc;
  doc["id"] = chipId;
  doc["t"] = round(temperature * 10) / 10.0;  // Round to 1 decimal
  doc["h"] = round(humidity * 10) / 10.0;
  doc["gasA"] = gasAnalog;
  doc["gasD"] = gasDigital;
  doc["alarm"] = alarmState;
  
  // Serialize to string
  String payload;
  serializeJson(doc, payload);
  
  // Publish to MQTT
  if (mqttClient.publish(TOPIC_TELEMETRY, payload.c_str())) {
    Serial.printf("📤 Published: %s\n", payload.c_str());
  } else {
    Serial.println("✗ Failed to publish telemetry");
  }
}

// ==================== ALARM LOGIC ====================
void checkAlarmConditions() {
  float temperature = dht.readTemperature();
  int gasAnalog = analogRead(GAS_ANALOG_PIN);
  int gasDigital = digitalRead(GAS_DIGITAL_PIN);
  
  // Trigger alarm if any threshold exceeded
  if (!isnan(temperature) && temperature > TEMP_THRESHOLD) {
    alarmState = true;
  } else if (gasAnalog > gasThreshold) {
    alarmState = true;
  } else if (gasDigital == GAS_DIGITAL_THRESHOLD) {
    alarmState = true;
  } else {
    alarmState = false;
  }
}

// ==================== PUBLISH STATUS ====================
void publishStatus(const char* status) {
  StaticJsonDocument<128> doc;
  doc["id"] = chipId;
  doc["status"] = status;
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  
  String payload;
  serializeJson(doc, payload);
  
  mqttClient.publish(TOPIC_STATUS, payload.c_str(), true);  // Retained
  Serial.printf("Status published: %s\n", status);
}
```

## 🔧 Configuration Steps

### 1. Update WiFi Credentials

```cpp
const char* WIFI_SSID = "YourWiFiSSID";
const char* WIFI_PASSWORD = "YourWiFiPassword";
```

### 2. Update MQTT Broker Address

```cpp
const char* MQTT_SERVER = "192.168.1.100";  // IP broker Anda
const int MQTT_PORT = 1883;
```

### 3. Update MQTT Topics (opsional)

Sesuaikan dengan topik di dashboard:

```cpp
const char* TOPIC_EVENT = "lab/zaks/event";
const char* TOPIC_LOG = "lab/zaks/log";
const char* TOPIC_STATUS = "lab/zaks/status";
const char* TOPIC_ALERT = "lab/zaks/alert";
```

## 📤 MQTT Message Format

### Telemetry (ESP32 → Dashboard)

Published ke `TOPIC_LOG` setiap 2 detik:

```json
{
  "id": "A1B2C3D4E5F6",
  "t": 28.5,
  "h": 65.0,
  "gasA": 1850,
  "gasD": 0,
  "alarm": false
}
```

### Commands (Dashboard → ESP32)

Subscribe dari `TOPIC_EVENT`:

- `BUZZER_ON` - Nyalakan buzzer
- `BUZZER_OFF` - Matikan buzzer
- `THR=2000` - Set gas threshold ke 2000

### Status (ESP32 → Dashboard)

Published ke `TOPIC_STATUS` saat connect:

```json
{
  "id": "A1B2C3D4E5F6",
  "status": "online",
  "ip": "192.168.1.50",
  "rssi": -45
}
```

## 🧪 Testing ESP32

### Serial Monitor Output

```
=== IoT Fire Detection System ===
Chip ID: A1B2C3D4E5F6
DHT22 initialized
Connecting to WiFi: MyWiFi
........
WiFi connected!
IP Address: 192.168.1.50
Connecting to MQTT broker... Connected!
Subscribed to: lab/zaks/event
Status published: online
📤 Published: {"id":"A1B2C3D4E5F6","t":27.5,"h":62.0,"gasA":1830,"gasD":0,"alarm":false}
```

### MQTT Test Commands

```bash
# Subscribe untuk monitor data ESP32
mosquitto_sub -h 3.27.0.139 -p 1883 -u zaks -P 'enggangodinginmcu' -t "lab/zaks/#" -v

# Send command ke ESP32
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P 'enggangodinginmcu' -t "lab/zaks/event" -m "BUZZER_ON"
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P 'enggangodinginmcu' -t "lab/zaks/event" -m "THR=2500"
```

## 🐛 Troubleshooting

### ESP32 tidak connect ke WiFi

- Periksa SSID dan password
- Pastikan ESP32 dalam jangkauan WiFi
- Cek Serial Monitor untuk error

### Tidak connect ke MQTT broker

- Ping broker: `ping 192.168.1.100`
- Cek broker running: `netstat -an | grep 1883`
- Verifikasi username/password

### Sensor DHT22 read NaN

- Cek wiring DHT22
- Ganti library DHT
- Tambahkan delay di `setup()`

### Data tidak muncul di dashboard

- Cek topik MQTT sama persis
- Validasi format JSON di Serial Monitor
- Test manual dengan mosquitto_pub

## 📊 Performance Tips

1. **Optimize telemetry interval**: Jangan terlalu cepat (min 1 detik)
2. **Use QoS wisely**: QoS 0 untuk telemetry, QoS 1 untuk commands
3. **Enable WiFi power save**: Untuk battery-powered devices
4. **Handle reconnection**: Implement exponential backoff

## 🔐 Security Recommendations

1. Gunakan **WPA2** untuk WiFi
2. Enable **MQTT authentication** (username/password)
3. Gunakan **TLS/SSL** untuk production
4. Jangan hardcode credentials (gunakan EEPROM/SPIFFS)
5. Implement **OTA updates** untuk firmware

## 📚 Additional Resources

- [ESP32 Arduino Core](https://github.com/espressif/arduino-esp32)
- [PubSubClient Library](https://github.com/knolleary/pubsubclient)
- [DHT Sensor Library](https://github.com/adafruit/DHT-sensor-library)
- [ArduinoJson](https://arduinojson.org/)

---

**Happy Coding! 🚀**
