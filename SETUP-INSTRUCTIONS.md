# 🚀 Setup Instructions - MQTT Connection

Broker MQTT Anda menggunakan **port 1883 (TCP)**, yang tidak bisa diakses langsung dari browser. Ada **2 cara** untuk menghubungkan dashboard:

## ⚡ Quick Start (Recommended)

### Option 1: Menggunakan Proxy Server (TERMUDAH)

Proxy server akan meneruskan koneksi dari TCP MQTT ke WebSocket untuk browser.

#### Step 1: Setup Proxy Server

```bash
# Masuk ke folder proxy-server
cd proxy-server

# Install dependencies
npm install

# Copy dan rename environment file
copy env-configured.txt .env
# Atau di Linux/Mac: cp env-configured.txt .env

# Start proxy server
npm start
```

Proxy akan berjalan di `http://localhost:8080`

#### Step 2: Setup Frontend Dashboard

```bash
# Kembali ke root folder
cd ..

# Install dependencies
npm install

# Copy dan rename environment file
copy env-configured.txt .env
# Atau di Linux/Mac: cp env-configured.txt .env

# Edit .env dan pastikan menggunakan:
# VITE_MQTT_URL=ws://localhost:8080/ws

# Start dashboard
npm run dev
```

Dashboard akan berjalan di `http://localhost:3000`

#### Step 3: Test Koneksi

1. Buka browser: `http://localhost:3000`
2. Cek status koneksi di header (harus hijau "Connected")
3. ESP32 Anda akan mulai mengirim data ke topik `nimak/deteksi-api/telemetry`
4. Data akan muncul real-time di dashboard

---

## 🔧 Option 2: Cek WebSocket di Broker (Advanced)

Beberapa broker MQTT memiliki WebSocket listener di port berbeda. Coba test:

```bash
# Test WebSocket di port 9001
wscat -c ws://3.27.0.139:9001/mqtt

# Atau port 8083
wscat -c ws://3.27.0.139:8083/mqtt
```

Jika berhasil connect, edit `.env`:

```env
VITE_MQTT_URL=ws://3.27.0.139:9001/mqtt
VITE_MQTT_USERNAME=admin
VITE_MQTT_PASSWORD=Asdcvbjkl1!
```

Lalu langsung `npm run dev` tanpa proxy.

---

## 📋 Kredensial MQTT Anda

```
Host: 3.27.0.139
Port: 1883 (TCP)
User: admin
Pass: Asdcvbjkl1!
Topics:
  - Telemetry: nimak/deteksi-api/telemetry
  - Command: nimak/deteksi-api/cmd
  - Status: nimak/deteksi-api/status
```

---

## 🧪 Testing Koneksi

### Test dengan mosquitto_sub

```bash
# Subscribe untuk monitor data dari ESP32
mosquitto_sub -h 3.27.0.139 -p 1883 -u admin -P "Asdcvbjkl1!" -t "nimak/deteksi-api/#" -v
```

### Test publish manual

```bash
# Kirim test payload
mosquitto_pub -h 3.27.0.139 -p 1883 -u admin -P "Asdcvbjkl1!" \
  -t "nimak/deteksi-api/telemetry" \
  -m '{"id":"TEST-001","t":28.5,"h":65.0,"gasA":1850,"gasD":0,"alarm":false}'
```

---

## 🔥 ESP32 Configuration

Update kode ESP32 Anda dengan kredensial ini:

```cpp
const char* MQTT_HOST = "3.27.0.139";
const uint16_t MQTT_PORT = 1883;
const char* MQTT_USER = "admin";
const char* MQTT_PASS = "Asdcvbjkl1!";

const char* TOPIC_TELEMETRY = "nimak/deteksi-api/telemetry";
const char* TOPIC_CMD = "nimak/deteksi-api/cmd";
const char* TOPIC_STATUS = "nimak/deteksi-api/status";
```

Contoh lengkap ada di `docs/ESP32-INTEGRATION.md`

---

## ⚙️ Troubleshooting

### Proxy tidak connect ke broker

**Cek**:
```bash
# Ping broker
ping 3.27.0.139

# Test telnet
telnet 3.27.0.139 1883
```

**Solusi**:
- Pastikan firewall tidak block port 1883
- Cek kredensial benar
- Cek broker status running

### Dashboard tidak connect ke proxy

**Cek**:
1. Proxy server running di terminal
2. Browser console untuk error WebSocket
3. URL di `.env` benar: `ws://localhost:8080/ws`

### Data tidak muncul

**Cek**:
1. ESP32 connected dan publish ke topik yang benar
2. Monitor proxy server logs
3. Test manual dengan mosquitto_pub

---

## 📊 Next Steps

1. ✅ Setup proxy server
2. ✅ Setup frontend dashboard
3. ✅ Configure ESP32 dengan kredensial
4. ✅ Upload kode ESP32
5. ✅ Monitor dashboard untuk data real-time

---

## 🆘 Need Help?

Lihat dokumentasi lengkap:
- `README.md` - Overview dan fitur
- `docs/ESP32-INTEGRATION.md` - Integrasi ESP32
- `proxy-server/README.md` - Dokumentasi proxy

**Selamat mencoba! 🚀**
