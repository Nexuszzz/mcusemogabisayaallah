# ✅ VS CODE REMOTE SSH - READY!

## 🎉 Setup Selesai!

Saya sudah setup semuanya untuk deploy ke EC2 menggunakan VS Code Remote SSH!

### ✅ Yang Sudah Dikonfigurasi:

1. **Extension Remote-SSH** - Sudah diinstall
2. **SSH Config File** - Sudah dibuat di `C:\Users\NAUFAL\.ssh\config`
3. **Connection Profile** - `ec2-fire-detection` untuk IP 3.27.0.139

---

## 🚀 CARA DEPLOY (3 Langkah Mudah)

### Langkah 1: Connect ke EC2

**Cara A: Via Command Palette (Recommended)**
1. Tekan **F1** di VS Code
2. Ketik: `Remote-SSH: Connect to Host`
3. Pilih: `ec2-fire-detection`
4. Tunggu VS Code connect (mungkin diminta fingerprint, klik Yes)

**Cara B: Via Batch File**
```cmd
Double-click: CONNECT-EC2-VSCODE.bat
```

### Langkah 2: Buka Terminal di EC2

Setelah terconnect:
1. Tekan **Ctrl + `** (backtick) untuk buka terminal
2. Terminal akan langsung terhubung ke EC2!

### Langkah 3: Deploy!

Copy-paste command ini di terminal VS Code yang sudah connect ke EC2:

```bash
cd ~ && git clone https://github.com/Nexuszzz/sudahtapibelum.git && cd sudahtapibelum && chmod +x deploy-to-ec2.sh && ./deploy-to-ec2.sh
```

Atau jalankan satu per satu:

```bash
cd ~
git clone https://github.com/Nexuszzz/sudahtapibelum.git
cd sudahtapibelum
chmod +x deploy-to-ec2.sh
./deploy-to-ec2.sh
```

**Tunggu 10-15 menit** untuk deployment lengkap!

---

## 🐛 Troubleshooting

### Error: "Permission denied (publickey)"

Artinya file `sismod.ppk` tidak cocok dengan EC2 ini. Coba file key lain:

**Edit file SSH config:**
```
C:\Users\NAUFAL\.ssh\config
```

**Ganti IdentityFile dengan salah satu:**
- `C:\Users\NAUFAL\Downloads\zakaaws.ppk`
- `C:\Users\NAUFAL\Downloads\zam.ppk`

**Contoh:**
```
Host ec2-fire-detection
    HostName 3.27.0.139
    User ubuntu
    IdentityFile C:\Users\NAUFAL\Downloads\zakaaws.ppk
    StrictHostKeyChecking no
```

Lalu coba connect lagi.

### VS Code Cannot Find Host

1. Pastikan file config ada di: `C:\Users\NAUFAL\.ssh\config`
2. Reload VS Code: **Ctrl + Shift + P** → `Developer: Reload Window`
3. Coba lagi connect

### Connection Timeout

1. Check internet connection
2. Check AWS Security Group allow port 22 (SSH)
3. Check EC2 instance is running

---

## 📊 Monitoring Deployment

Setelah menjalankan `./deploy-to-ec2.sh`, Anda akan lihat output deployment real-time di terminal.

**Progress yang akan muncul:**
```
📦 Step 1: Updating system...
📦 Step 2: Installing Node.js 18.x...
📦 Step 3: Installing Python 3...
📦 Step 4: Installing PM2...
📦 Step 5: Installing Nginx...
📦 Step 6: Installing Git...
📂 Step 7: Cloning repository...
📦 Step 8: Installing Node.js dependencies...
📦 Step 9: Installing Python dependencies...
🔨 Step 10: Building React frontend...
⚙️  Step 11: Setting up environment...
🌐 Step 12: Configuring Nginx...
🚀 Step 13: Starting services with PM2...
🛡️  Step 14: Configuring firewall...
🎉 DEPLOYMENT COMPLETE!
```

---

## ✅ Verification

Setelah deployment selesai, cek status:

```bash
# Check PM2 services
pm2 status

# Check Nginx
sudo systemctl status nginx

# View logs
pm2 logs
```

**Expected PM2 Output:**
```
┌─────┬──────────────────┬─────────┐
│ id  │ name             │ status  │
├─────┼──────────────────┼─────────┤
│ 0   │ proxy-server     │ online  │
│ 1   │ fire-detection   │ online  │
└─────┴──────────────────┴─────────┘
```

---

## 🌐 Access Website

Setelah semua services running:

**URL:** http://3.27.0.139

**Login:**
- Username: `admin`
- Password: `admin123`

---

## 🎯 Next Steps Setelah Deploy

1. **Test Website**
   - Buka http://3.27.0.139
   - Login dengan admin/admin123
   - Check dashboard

2. **Change Admin Password**
   - Settings → Change Password

3. **Update ESP32-CAM**
   ```cpp
   const char* serverUrl = "http://3.27.0.139/api/esp32/capture";
   ```

4. **Monitor Services**
   ```bash
   pm2 monit
   ```

---

## 🔄 Update Code Later

Jika ada perubahan code:

```bash
# Di local Windows
cd d:\rtsp-main
git add .
git commit -m "Update features"
git push origin master

# Di EC2 (via VS Code Remote SSH)
cd ~/sudahtapibelum
git pull origin master
npm install
npm run build
pm2 restart all
```

---

## 📁 File Helper yang Tersedia

| File | Fungsi |
|------|--------|
| **CONNECT-EC2-VSCODE.bat** | Guide untuk connect via VS Code |
| **deploy-remote.ps1** | Auto-push code dan show deployment guide |
| **test-ec2-connection.ps1** | Test berbagai .pem/.ppk files |
| **convert-ppk-to-pem.ps1** | Convert .ppk ke .pem (butuh PuTTYgen) |

---

## 🎉 Keuntungan VS Code Remote SSH

✅ **Edit code langsung di server** - Tidak perlu upload manual  
✅ **Terminal terintegrasi** - Jalankan command langsung dari VS Code  
✅ **File explorer** - Browse files di EC2 seperti di local  
✅ **IntelliSense** - Auto-complete untuk Python & JavaScript di server  
✅ **Git integration** - Pull/push langsung dari VS Code  
✅ **Extension support** - Install extension di remote server  

---

## 🚀 READY TO GO!

**Jalankan:**
```cmd
CONNECT-EC2-VSCODE.bat
```

atau langsung:

**F1** → `Remote-SSH: Connect to Host` → `ec2-fire-detection`

**Happy Deploying! 🔥**

---

## 📞 Quick Commands Reference

```bash
# Connect
ssh ec2-fire-detection

# Or in VS Code
F1 → Remote-SSH: Connect to Host → ec2-fire-detection

# Deploy
cd ~ && git clone https://github.com/Nexuszzz/sudahtapibelum.git && cd sudahtapibelum && chmod +x deploy-to-ec2.sh && ./deploy-to-ec2.sh

# Monitor
pm2 status
pm2 logs
pm2 monit

# Restart
pm2 restart all
```
