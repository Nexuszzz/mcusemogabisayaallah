# 🔧 Quick Setup - Environment Variables

## ⚡ Quick Start (3 Steps)

### **Step 1: Create .env files**
```bash
cp .env.example .env
cp whatsapp-server/.env.example whatsapp-server/.env
```

### **Step 2: Edit whatsapp-server/.env**
```bash
notepad whatsapp-server\.env
```

**Change this line:**
```env
MQTT_PASSWORD=your-secure-password-here
```

**To:**
```env
MQTT_PASSWORD=enggangodinginmcu
```

### **Step 3: Done! Start servers**
```bash
# Terminal 1
.\start-whatsapp-server.bat

# Terminal 2  
npm run dev
```

---

## 📝 Full Configuration

### **whatsapp-server/.env**
```env
# WhatsApp Server Port
WA_PORT=3001

# Browser Identity
WA_BROWSER_NAME=Fire Detection System
WA_BROWSER_TYPE=Chrome
WA_BROWSER_VERSION=110.0.0

# MQTT Broker (Direct TCP)
MQTT_HOST=3.27.0.139
MQTT_PORT=1883
MQTT_USER=zaks
MQTT_PASSWORD=enggangodinginmcu

# MQTT Topics
MQTT_TOPIC_EVENT=lab/zaks/event
MQTT_TOPIC_ALERT=lab/zaks/alert

# CORS (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Logging
LOG_LEVEL=silent
```

### **.env** (Root directory)
```env
# MQTT Proxy (WebSocket - for frontend)
VITE_MQTT_URL=ws://localhost:8080/ws
VITE_MQTT_USERNAME=zaks
VITE_MQTT_PASSWORD=enggangodinginmcu

# MQTT Topics
VITE_TOPIC_EVENT=lab/zaks/event
VITE_TOPIC_LOG=lab/zaks/log
VITE_TOPIC_STATUS=lab/zaks/status
VITE_TOPIC_ALERT=lab/zaks/alert
VITE_TOPIC_CMD=nimak/deteksi-api/cmd

# Data retention
VITE_MAX_DATA_POINTS=10000

# WhatsApp API URL
VITE_WA_API_URL=http://localhost:3001/api/whatsapp
```

---

## ✅ Verification

### **Check if .env exists:**
```bash
dir .env
dir whatsapp-server\.env
```

### **Check if .env in .gitignore:**
```bash
type .gitignore | findstr ".env"
```

Should show:
```
.env
.env.local
.env.production
.env.*.local
whatsapp-server/.env
```

---

## 🚨 IMPORTANT

### **❌ NEVER commit .env files!**

```bash
# Before commit, check:
git status

# If .env appears, remove from staging:
git reset .env
git reset whatsapp-server/.env
```

### **✅ ALWAYS commit .env.example files**

These are templates WITHOUT real passwords!

---

## 🔄 For Production

### **Change these values:**

```env
# Production MQTT broker
MQTT_HOST=your-production-broker.com
MQTT_PASSWORD=your-strong-production-password

# Production frontend URL
VITE_WA_API_URL=https://your-domain.com/api/whatsapp

# Production allowed origins
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

---

## 🐛 Troubleshooting

### **Error: "Missing required MQTT environment variables!"**

**Solution:**
```bash
# Make sure .env file exists in whatsapp-server/
cd whatsapp-server
dir .env

# If not, create it:
copy .env.example .env
notepad .env
```

### **Error: "MQTT connection failed"**

**Check:**
1. ✅ MQTT_HOST is correct
2. ✅ MQTT_PORT is correct (1883)
3. ✅ MQTT_USER is correct
4. ✅ MQTT_PASSWORD is correct
5. ✅ Broker is accessible

### **Error: "Not allowed by CORS"**

**Solution:**
```env
# Add your frontend URL to ALLOWED_ORIGINS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://your-url
```

---

## 📚 More Info

- **Full Audit:** AUDIT-REPORT.md
- **All Fixes:** FIXES-IMPLEMENTED.md
- **Setup Guide:** SETUP-WHATSAPP-COMPLETE.md
- **Dual Auth:** WHATSAPP-DUAL-AUTH.md

---

**Quick setup done! Start testing! 🚀**
