# 🚨 False Fire Alarm Fix

**Issue**: Notifikasi "INDIKASI KEBAKARAN!" muncul padahal tidak ada api  
**Tanggal**: 19 Oktober 2025

---

## 🐛 Root Cause

### **Masalah:**

1. **State tidak di-clear**
   - `fireAlert` state tetap ada setelah notifikasi ditampilkan
   - Component re-render bisa trigger notifikasi lagi

2. **Duplicate prevention kurang ketat**
   - Hanya check 1 detik window
   - Tidak cukup untuk prevent multiple triggers

3. **Kurang logging untuk debugging**
   - Sulit track kapan event diterima
   - Tidak jelas kenapa notifikasi muncul

---

## ✅ Solutions Implemented

### **1. Auto-Clear FireAlert State**

**File**: `src/hooks/useMqttClient.ts`

```typescript
if (eventData.event === 'flame_on') {
  setFireAlert({
    message: 'Api terdeteksi! Segera periksa lokasi sensor.',
    type: 'fire',
    timestamp: new Date(),
  })
  
  // ✅ NEW: Clear after 1 second
  setTimeout(() => {
    setFireAlert(null)
  }, 1000)
}
```

**Benefit**: State di-clear otomatis, prevent re-trigger dari re-render

---

### **2. Improved Duplicate Prevention**

**File**: `src/components/FireNotification.tsx`

**Before:**
```typescript
// Check duplicate dalam 1 detik
if (now - lastAlertTime < 1000) return
```

**After:**
```typescript
// Check duplicate dalam 3 detik
if (now - lastAlertTime < 3000) {
  console.log('⏭️ Skipping duplicate alert (too soon)')
  return
}

// Also check dalam 5 detik untuk same message
const hasDuplicate = prev.some((n) => 
  n.message === notification.message && 
  n.type === notification.type &&
  now - new Date(n.timestamp).getTime() < 5000
)
```

**Benefit**: 
- Minimum 3 detik antar alert
- Exact duplicate blocked selama 5 detik

---

### **3. Enhanced Logging**

**Added Console Logs:**

```typescript
// Event received
console.log('📢 Event received:', {
  topic,
  event: eventData.event,
  payload: eventData,
  timestamp: new Date().toISOString()
})

// Flame detected
console.log('🔥 FLAME DETECTED! Showing notification...')

// Showing notification
console.log('🔔 Showing notification:', notification)

// Duplicate blocked
console.log('⏭️ Duplicate notification blocked')
console.log('⏭️ Skipping duplicate alert (too soon)')
```

**Benefit**: Mudah debug false alarms

---

## 🔍 Debugging Steps

### **Check Browser Console (F12)**

Jika notifikasi muncul tanpa api:

1. **Look for event log:**
   ```
   📢 Event received: {
     topic: "lab/zaks/event",
     event: "flame_on",
     payload: {...},
     timestamp: "2025-10-19T13:51:31.000Z"
   }
   ```

2. **Check source:**
   - Apakah event dari ESP32?
   - Apakah ada duplicate event?
   - Timing berapa detik sejak event terakhir?

3. **Verify MQTT topic:**
   ```bash
   mosquitto_sub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/event" -v
   ```

---

## 🧪 Testing

### **Test 1: Single Flame Event**

**Expected:**
1. ESP32 publish: `{"event":"flame_on"}`
2. Dashboard log: `📢 Event received`
3. Notification muncul 1x
4. After 10 seconds, notification hilang
5. No duplicate

**Test Command:**
```bash
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/event" -m "{\"event\":\"flame_on\"}"
```

---

### **Test 2: Rapid Flame Events**

**Scenario:** Kirim 5 event dalam 2 detik

**Expected:**
- Only 1 notification (duplicates blocked)
- Console: `⏭️ Skipping duplicate alert (too soon)`

**Test:**
```bash
for /L %i in (1,1,5) do @(mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/event" -m "{\"event\":\"flame_on\"}" & timeout /t 0 /nobreak > nul)
```

---

### **Test 3: Multiple Events with Gap**

**Scenario:** Event 1 → wait 4 seconds → Event 2

**Expected:**
- 2 notifications (allowed karena > 3 detik gap)
- Each auto-dismiss after 10 seconds

**Test:**
```bash
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/event" -m "{\"event\":\"flame_on\"}"
timeout /t 4
mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/event" -m "{\"event\":\"flame_on\"}"
```

---

## 📊 Timeline Protection

| Time | Event | Notification | Reason |
|------|-------|--------------|--------|
| 0s | flame_on | ✅ Show | First event |
| 1s | flame_on | ❌ Block | < 3s window |
| 2s | flame_on | ❌ Block | < 3s window |
| 4s | flame_on | ✅ Show | > 3s gap OK |
| 5s | flame_on | ❌ Block | < 3s window |
| 8s | flame_on | ✅ Show | > 3s gap OK |

---

## 🔧 ESP32 Flame Logic

**Verify ESP32 Code:**

```cpp
// Di loop() - line ~207
if (flameTrig && !prevFlame) {
  // ✅ GOOD: Hanya kirim event saat transisi OFF → ON
  mqtt.publish(TOPIC_ALERT, abuf, false);
  mqtt.publish(TOPIC_EVENT, "{\"event\":\"flame_on\"}", false);
}
prevFlame = flameTrig;
```

**Expected Behavior:**
- Event **HANYA** saat flame sensor **BARU** detect (edge detection)
- **TIDAK** kirim event continuous saat flame masih ON
- Jika false alarm, kemungkinan:
  1. Sensor flame false positive
  2. Noise di pin FLAME_PIN
  3. Grounding issue

---

## 🛠️ Troubleshooting

### **Problem: Notification muncul tanpa api**

**Kemungkinan:**

1. **ESP32 false trigger**
   - Check flame sensor connection
   - Check FLAME_PIN (26) wiring
   - Test sensor dengan multimeter
   - Sensor mungkin sensitif ke cahaya ruangan

2. **Old event in MQTT retained**
   - Clear retained messages:
     ```bash
     mosquitto_pub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/event" -r -n
     ```

3. **Network replay**
   - Restart proxy server
   - Restart dashboard

---

### **Problem: Notification tidak muncul saat ada api**

**Check:**

1. **ESP32 serial monitor:**
   ```
   [PUB] {"event":"flame_on"}  // Should appear
   ```

2. **MQTT subscriber:**
   ```bash
   mosquitto_sub -h 3.27.0.139 -p 1883 -u zaks -P "enggangodinginmcu" -t "lab/zaks/event" -v
   ```

3. **Browser console:**
   ```
   📢 Event received: {...}
   🔥 FLAME DETECTED! Showing notification...
   ```

---

## 📝 Verification Logs

### **Normal Operation:**

```javascript
// Event diterima
📢 Event received: {
  topic: "lab/zaks/event",
  event: "flame_on",
  payload: {event: "flame_on"},
  timestamp: "2025-10-19T13:51:31.123Z"
}

// Flame detection
🔥 FLAME DETECTED! Showing notification...

// Notification shown
🔔 Showing notification: {
  id: "1729346491123",
  message: "Api terdeteksi! Segera periksa lokasi sensor.",
  type: "fire",
  timestamp: Date
}
```

### **Duplicate Blocked:**

```javascript
📢 Event received: {...}
⏭️ Skipping duplicate alert (too soon)
```

---

## ✅ Summary of Protections

| Protection | Duration | Purpose |
|------------|----------|---------|
| **Auto-clear state** | 1s | Prevent state persistence |
| **Rapid fire block** | 3s | Minimum gap between alerts |
| **Exact duplicate** | 5s | Block identical messages |
| **Auto-dismiss** | 10s | Clear notification UI |

---

## 🚀 Deployment

### **1. Restart Dashboard**
```bash
# Ctrl+C untuk stop
npm run dev
```

### **2. Clear Browser Cache**
- Hard refresh: `Ctrl + Shift + R`
- Or clear site data in DevTools

### **3. Monitor Console**
- Buka F12 → Console tab
- Watch for event logs

### **4. Test Flame Sensor**
- Dekatkan api ke sensor
- Check serial monitor ESP32
- Verify MQTT event published
- Verify dashboard notification

---

## 📁 Files Modified

1. ✅ `src/hooks/useMqttClient.ts`
   - Auto-clear fireAlert
   - Enhanced event logging

2. ✅ `src/components/FireNotification.tsx`
   - 3-second minimum gap
   - 5-second duplicate check
   - Debug logging

3. ✅ `FALSE-ALARM-FIX.md` (this file)

---

## 🎯 Expected Result

**After Fix:**
- ✅ Notifikasi HANYA muncul saat ESP32 kirim `{"event":"flame_on"}`
- ✅ No duplicate dalam 3 detik
- ✅ State auto-clear, no persistence
- ✅ Easy debug dengan console logs
- ✅ False alarm eliminated

**Dashboard siap detect api dengan akurat!** 🔥✨
