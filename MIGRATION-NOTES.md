# 📝 Migration Notes: nimak/deteksi-api → lab/zaks

**Tanggal Migrasi**: 19 Oktober 2025

## 🔄 Perubahan MQTT Topics

### Topic Lama (nimak/deteksi-api)
```
nimak/deteksi-api/telemetry
nimak/deteksi-api/cmd
nimak/deteksi-api/status
```

### Topic Baru (lab/zaks)
```
lab/zaks/event   → Command/Event dari dashboard ke ESP32
lab/zaks/log     → Telemetry/Log data dari ESP32 ke dashboard
lab/zaks/status  → Status connection
lab/zaks/alert   → Alert notifications (kebakaran, gas, dll)
```

## 📡 MQTT Broker Configuration

**Broker Details:**
- Host: `3.27.0.139`
- Port: `1883` (TCP/MQTT)
- Username: `zaks`
- Password: `enggangodinginmcu`

**Subscribe Wildcard:**
```bash
mosquitto_sub -h 3.27.0.139 -p 1883 -u zaks -P 'enggangodinginmcu' -t 'lab/zaks/#' -v
```

## ✅ File yang Telah Diupdate

### 1. **Environment Configuration**
- ✅ `.env.example` - Template dengan topics baru
- ✅ `.env` - File aktif (auto-copied)
- ✅ `env-configured.txt` - Backup configuration
- ✅ `proxy-server/.env.example`
- ✅ `proxy-server/.env`
- ✅ `proxy-server/env-configured.txt`

### 2. **Source Code**
- ✅ `src/config/mqtt.config.ts` - Config file baru (CREATED)
- ✅ `src/hooks/useMqttClient.ts` - Updated topic references
- ✅ `src/vite-env.d.ts` - Updated TypeScript definitions
- ✅ `proxy-server/server.js` - Subscribe ke `lab/zaks/#`

### 3. **Documentation**
- ✅ `docs/ESP32-INTEGRATION.md` - Updated all topic references
- ✅ `docs/DEPLOYMENT.md` - Updated environment variables
- ✅ `docs/API-REFERENCE.md` - Updated API documentation

## 🎯 Environment Variables Mapping

| Old Variable | New Variable | New Default Value |
|-------------|--------------|-------------------|
| `VITE_TOPIC_PUB` | `VITE_TOPIC_LOG` | `lab/zaks/log` |
| `VITE_TOPIC_CMD` | `VITE_TOPIC_EVENT` | `lab/zaks/event` |
| `VITE_TOPIC_STATUS` | `VITE_TOPIC_STATUS` | `lab/zaks/status` |
| _(new)_ | `VITE_TOPIC_ALERT` | `lab/zaks/alert` |

## 📊 Data Format (dari Screenshot)

### lab/zaks/log
```json
{
  "id": "8C201A34E3EC",
  "t": 29.5,
  "h": 72.0,
  "gasA": 2465,
  "gasMv": 2138,
  "gasD": false,
  "flame": false,
  "alarm": false
}
```

### lab/zaks/event
```json
{
  "event": "flame_on"
}
```

### lab/zaks/alert
```json
{
  "id": "8C201A34E3EC",
  "alert": "flame",
  "t": 30.0,
  "h": 72.0,
  "gasA": 2446,
  "gasMv": 2147
}
```

## 🚀 Next Steps

1. **Restart Proxy Server:**
   ```bash
   cd proxy-server
   npm start
   ```

2. **Restart Dashboard:**
   ```bash
   npm run dev
   ```

3. **Update ESP32 Code** (jika ada):
   ```cpp
   const char* TOPIC_EVENT = "lab/zaks/event";
   const char* TOPIC_LOG = "lab/zaks/log";
   const char* TOPIC_STATUS = "lab/zaks/status";
   const char* TOPIC_ALERT = "lab/zaks/alert";
   ```

4. **Test Connection:**
   ```bash
   # Monitor all topics
   mosquitto_sub -h 3.27.0.139 -p 1883 -u zaks -P 'enggangodinginmcu' -t 'lab/zaks/#' -v
   
   # Test publish
   mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P 'enggangodinginmcu' -t 'lab/zaks/event' -m 'BUZZER_ON'
   ```

## ⚠️ Breaking Changes

- Environment variable names changed
- Topic structure completely changed
- Old configurations will not work without updates

## 🔍 Verification Checklist

- [x] Config files updated
- [x] Source code updated
- [x] Documentation updated
- [x] Proxy server updated
- [ ] Test dashboard connection
- [ ] Test MQTT subscription
- [ ] Test data flow
- [ ] Update ESP32 firmware (if needed)
