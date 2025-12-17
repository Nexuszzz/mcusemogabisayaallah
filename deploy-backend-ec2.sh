#!/bin/bash
# ============================================================================
# 🚀 Deploy Backend Express.js to EC2 (3.27.0.139)
# ============================================================================

set -e  # Exit on error

echo "============================================"
echo "🚀 RTSP Fire Detection - Backend Deployment"
echo "============================================"

# Variables
PROJECT_DIR="/home/ubuntu/rtsp-project"
BACKEND_DIR="$PROJECT_DIR/proxy-server"

echo ""
echo "📦 Step 1: Update system and install Node.js..."
sudo apt-get update -y
sudo apt-get install -y curl wget git

# Install Node.js 20.x (LTS)
if ! command -v node &> /dev/null; then
    echo "📥 Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ NPM version: $(npm -v)"

echo ""
echo "📦 Step 2: Install PM2 globally..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi
echo "✅ PM2 version: $(pm2 -v)"

echo ""
echo "📂 Step 3: Create project directories..."
mkdir -p $PROJECT_DIR
mkdir -p $BACKEND_DIR/uploads/fire-detections
mkdir -p $BACKEND_DIR/recordings
mkdir -p $BACKEND_DIR/data
mkdir -p $BACKEND_DIR/public

echo ""
echo "📋 Step 4: Copy backend files..."
# Files will be uploaded via SCP/SFTP separately
# This script assumes files are already in place

cd $BACKEND_DIR

echo ""
echo "📦 Step 5: Install backend dependencies..."
if [ -f "package.json" ]; then
    npm install --production
    echo "✅ Dependencies installed"
else
    echo "❌ package.json not found! Please upload backend files first."
    exit 1
fi

echo ""
echo "🔧 Step 6: Create production .env file..."
cat > .env << 'EOF'
# Express Server Configuration
PORT=8080
NODE_ENV=production

# MQTT Configuration
MQTT_HOST=3.27.0.139
MQTT_PORT=1883
MQTT_USERNAME=zaks
MQTT_PASSWORD=enggangodinginmcu
TOPIC_EVENT=lab/zaks/event
TOPIC_LOG=lab/zaks/log
TOPIC_STATUS=lab/zaks/status
TOPIC_ALERT=lab/zaks/alert

# Auth Configuration
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=7d

# API Keys
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number
EOF

echo "✅ .env file created"

echo ""
echo "📝 Step 7: Create PM2 ecosystem config..."
cat > ecosystem.config.json << 'EOF'
{
  "apps": [
    {
      "name": "proxy-server",
      "script": "./server.js",
      "cwd": "/home/ubuntu/rtsp-project/proxy-server",
      "instances": 1,
      "exec_mode": "fork",
      "autorestart": true,
      "watch": false,
      "max_memory_restart": "500M",
      "env": {
        "NODE_ENV": "production",
        "PORT": "8080"
      },
      "error_file": "/home/ubuntu/.pm2/logs/proxy-server-error.log",
      "out_file": "/home/ubuntu/.pm2/logs/proxy-server-out.log",
      "log_date_format": "YYYY-MM-DD HH:mm:ss Z",
      "merge_logs": true
    }
  ]
}
EOF

echo "✅ PM2 config created"

echo ""
echo "🚀 Step 8: Start backend with PM2..."
pm2 delete proxy-server 2>/dev/null || true
pm2 start ecosystem.config.json
pm2 save
sudo pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo ""
echo "📊 Step 9: Check PM2 status..."
pm2 status

echo ""
echo "✅ Step 10: Test backend health..."
sleep 3
curl -s http://localhost:8080/health || echo "⚠️ Health check failed"

echo ""
echo "============================================"
echo "✅ Backend Deployment Complete!"
echo "============================================"
echo ""
echo "📝 Next Steps:"
echo "1. Test API: curl http://3.27.0.139:8080/health"
echo "2. Check logs: pm2 logs proxy-server"
echo "3. Monitor: pm2 monit"
echo ""
echo "🔗 Backend URL: http://3.27.0.139:8080"
echo "🔗 API Endpoint: http://3.27.0.139:8080/api"
echo "🔗 WebSocket: ws://3.27.0.139:8080/ws"
echo ""
