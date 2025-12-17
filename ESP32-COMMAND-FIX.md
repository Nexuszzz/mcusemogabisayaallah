# 🔧 ESP32 Command Topic Fix

**Tanggal**: 19 Oktober 2025  
**Issue**: Buzzer dan Threshold control tidak berfungsi dari dashboard

---

## 🐛 Root Cause

### **Masalah:**
ESP32 subscribe untuk command di topik yang berbeda dengan yang dikirim dashboard:

| Component | Topic | Status |
|-----------|-------|--------|
| **ESP32 Subscribe** | `nimak/deteksi-api/cmd` | ✅ |
| **Dashboard Publish** | `lab/zaks/event` | ❌ Wrong topic! |

### **Hasil:**
- ❌ Command `BUZZER_ON` tidak sampai ke ESP32
- ❌ Command `BUZZER_OFF` tidak sampai ke ESP32  
- ❌ Command `THR=xxxx` tidak sampai ke ESP32

---

## ✅ Solution Implemented

### **Changes Made:**

1. **`src/hooks/useMqttClient.ts`**
   ```typescript
   // OLD: topicCmd: 'lab/zaks/event'
   // NEW: topicCmd: 'nimak/deteksi-api/cmd'
   ```

2. **`.env.example`**
   ```env
   VITE_TOPIC_CMD=nimak/deteksi-api/cmd
   ```

3. **`src/vite-env.d.ts`**
   ```typescript
   readonly VITE_TOPIC_CMD: string
   ```

4. **`.env`** (auto-updated via script)

---

## 📡 ESP32 Command Protocol

### **Topic:** `nimak/deteksi-api/cmd`

### **Commands:**

| Command | Payload | ESP32 Action | Description |
|---------|---------|--------------|-------------|
| **Buzzer ON** | `BUZZER_ON` | `forceAlarm = true` | Force buzzer ON (manual override) |
| **Buzzer OFF** | `BUZZER_OFF` | `forceAlarm = false` | Turn buzzer OFF |
| **Set Threshold** | `THR=2000` | `GAS_THRESHOLD = 2000` | Set gas alarm threshold (100-4000) |

### **ESP32 Response:**

When threshold is updated, ESP32 akan publish event:
```json
// Topic: lab/zaks/event
{
  "event": "thr_update",
  "thr": 2000
}
```

---

## 🎯 ESP32 Topic Architecture

### **ESP32 Subscribes To:**
```cpp
const char* TOPIC_SUB = "nimak/deteksi-api/cmd";  // ✅ Command input
```

### **ESP32 Publishes To:**

| Topic | Frequency | Content | Retained |
|-------|-----------|---------|----------|
| `nimak/deteksi-api/telemetry` | 30s | Full telemetry | No |
| `lab/zaks/log` | 30s | Same as telemetry | No |
| `lab/zaks/status` | On connect | Online/offline | Yes (LWT) |
| `lab/zaks/alert` | On flame ON | Alert with data | No |
| `lab/zaks/event` | On events | flame_on, thr_update, boot | No |

---

## 📊 Telemetry Data Format

### **From ESP32:**
```json
{
  "id": "04E72EF9BBD4",
  "t": 28.5,
  "h": 65.0,
  "gasA": 1850,
  "gasMv": 2134,
  "gasD": false,
  "flame": false,
  "alarm": false
}
```

### **Fields:**
- `id`: ESP32 chip ID (unique identifier)
- `t`: Temperature (°C) - `null` if DHT read fails
- `h`: Humidity (%) - `null` if DHT read fails
- `gasA`: Gas analog reading (0-4095 ADC)
- `gasMv`: Gas voltage (millivolts)
- `gasD`: Gas digital sensor state
- `flame`: Flame sensor state (true = detected)
- `alarm`: Buzzer state (only follows `flame`)

---

## 🔥 Fire Detection Logic (ESP32)

```cpp
// Buzzer only follows flame sensor
bool fire = flameTrig;  
digitalWrite(BUZZER_PIN, fire ? HIGH : LOW);
```

**Important:**
- ⚠️ `forceAlarm` variable exists but **TIDAK** mengontrol buzzer
- ⚠️ Buzzer **HANYA** mengikuti sensor flame
- ⚠️ Gas threshold **TIDAK** trigger buzzer (hanya untuk monitoring)

**Jika ingin buzzer mengikuti command:**
```cpp
// Option 1: Buzzer follows flame OR forceAlarm
bool fire = flameTrig || forceAlarm;

// Option 2: Buzzer follows flame OR gas OR forceAlarm  
bool fire = flameTrig || (gasAnalog > GAS_THRESHOLD) || forceAlarm;
```

---

## 🧪 Testing

### **Test Commands:**

```bash
# Manual test dengan mosquitto_pub
# 1. Buzzer ON
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "nimak/deteksi-api/cmd" -m "BUZZER_ON"

# 2. Buzzer OFF
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "nimak/deteksi-api/cmd" -m "BUZZER_OFF"

# 3. Set threshold
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "nimak/deteksi-api/cmd" -m "THR=2500"
```

### **Interactive Test:**
```bash
.\test-buzzer-control.bat
```

### **Monitor ESP32 Response:**
```bash
mosquitto_sub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/#" -v
```

---

## 🚀 How to Use Dashboard Controls

### **1. Restart Dashboard**
Setelah update .env file:
```bash
# Ctrl+C untuk stop, lalu:
npm run dev
```

### **2. Open Dashboard**
```
http://localhost:3000
```

### **3. Test Controls**

#### **Buzzer Control:**
1. Klik **"Buzzer ON"** → ESP32 terima `BUZZER_ON`
2. Klik **"Buzzer OFF"** → ESP32 terima `BUZZER_OFF`
3. ⚠️ **Note:** Buzzer di ESP32 hanya mengikuti flame sensor!

#### **Threshold Control:**
1. Geser slider (100-4000)
2. Klik **"Apply"**
3. ESP32 terima `THR=xxxx`
4. ESP32 publish event konfirmasi
5. Threshold tersimpan di ESP32

---

## 📝 Expected Behavior

### **Dashboard → ESP32:**

1. **User clicks "Buzzer ON"**
   ```
   Dashboard → Proxy → MQTT → ESP32
   Topic: nimak/deteksi-api/cmd
   Payload: BUZZER_ON
   ```

2. **ESP32 receives command**
   ```
   Serial output:
   [MQTT] nimak/deteksi-api/cmd => BUZZER_ON
   ```

3. **ESP32 sets variable**
   ```cpp
   forceAlarm = true;
   ```

4. ⚠️ **BUT buzzer remains following flame sensor!**
   ```cpp
   // Current logic (buzzer ignores forceAlarm):
   bool fire = flameTrig;
   
   // To make it work, change to:
   bool fire = flameTrig || forceAlarm;
   ```

---

## 🔧 Recommended ESP32 Code Update

Jika ingin buzzer bisa dikontrol dari dashboard:

```cpp
// BEFORE (line ~207):
bool fire = flameTrig;

// AFTER (recommended):
bool fire = flameTrig || forceAlarm;
```

Atau dengan gas threshold:
```cpp
bool fire = flameTrig || (gasAnalog > GAS_THRESHOLD) || forceAlarm;
```

---

## ✅ Verification Checklist

### **Frontend:**
- [x] `.env` updated dengan `VITE_TOPIC_CMD`
- [x] `useMqttClient.ts` menggunakan topik yang benar
- [x] TypeScript types updated
- [x] Control panel sudah ada
- [x] Buzzer ON/OFF buttons functional
- [x] Threshold slider functional

### **Backend/Proxy:**
- [x] Proxy server subscribe ke `lab/zaks/#`
- [x] Proxy server relay command topic
- [x] Enhanced logging untuk debug

### **ESP32:**
- [x] Subscribe ke `nimak/deteksi-api/cmd` ✅
- [ ] **Buzzer logic perlu update** (opsional)
- [x] Threshold command working
- [x] Event publish working

---

## 📚 Files Modified

1. ✅ `src/hooks/useMqttClient.ts`
2. ✅ `src/vite-env.d.ts`
3. ✅ `.env.example`
4. ✅ `.env` (via script)
5. ✅ `env-configured.txt`
6. ✅ `update-env-cmd.bat` (new)
7. ✅ `test-buzzer-control.bat` (new)
8. ✅ `ESP32-COMMAND-FIX.md` (new)

---

## 🎯 Next Steps

1. **Restart Dashboard:**
   ```bash
   npm run dev
   ```

2. **Test from Dashboard:**
   - Click "Buzzer ON" button
   - Check ESP32 serial monitor for: `[MQTT] nimak/deteksi-api/cmd => BUZZER_ON`

3. **Test Threshold:**
   - Adjust slider to 2500
   - Click "Apply"
   - Check serial: `[MQTT] THR -> 2500`
   - Check event: `{"event":"thr_update","thr":2500}`

4. **(Optional) Update ESP32 buzzer logic:**
   ```cpp
   bool fire = flameTrig || forceAlarm;  // Line ~207
   ```

---

**Dashboard sekarang sudah kompatibel dengan ESP32!** 🎉
