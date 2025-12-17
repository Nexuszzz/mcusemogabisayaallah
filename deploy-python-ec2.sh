#!/bin/bash
# ============================================================================
# 🐍 Deploy Python Fire Detection Service to EC2 (3.27.0.139)
# ============================================================================

set -e  # Exit on error

echo "============================================"
echo "🔥 Fire Detection - Python Service Deployment"
echo "============================================"

# Variables
PROJECT_DIR="/home/ubuntu/rtsp-project"
PYTHON_DIR="$PROJECT_DIR/python_scripts"

echo ""
echo "📦 Step 1: Update system and install Python..."
sudo apt-get update -y
sudo apt-get install -y python3 python3-pip python3-venv

echo "✅ Python version: $(python3 --version)"
echo "✅ Pip version: $(pip3 --version)"

echo ""
echo "📦 Step 2: Install system dependencies for OpenCV..."
sudo apt-get install -y \
    python3-opencv \
    libopencv-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1

echo ""
echo "📂 Step 3: Create Python project directories..."
mkdir -p $PYTHON_DIR
mkdir -p $PYTHON_DIR/recordings
mkdir -p $PYTHON_DIR/fire_recordings

echo ""
echo "📋 Step 4: Copy Python scripts..."
# Files will be uploaded via SCP/SFTP separately
cd $PYTHON_DIR

echo ""
echo "📦 Step 5: Install Python dependencies..."
if [ -f "requirements.txt" ]; then
    pip3 install --upgrade pip
    pip3 install -r requirements.txt
    echo "✅ Python dependencies installed"
else
    echo "❌ requirements.txt not found! Installing manually..."
    pip3 install \
        opencv-python>=4.8.0 \
        ultralytics>=8.0.0 \
        google-generativeai>=0.3.0 \
        paho-mqtt>=1.6.1 \
        requests>=2.31.0 \
        python-dotenv>=1.0.0 \
        numpy>=1.24.0 \
        Pillow>=10.0.0
fi

echo ""
echo "🔧 Step 6: Create production .env file..."
cat > .env << 'EOF'
# Google Gemini API
GOOGLE_API_KEY=AIzaSyAGX6tPV18q3xaVMsu2wSeJ6_8TcJapFm0

# EC2 Server URLs
UPLOAD_API=http://localhost:8080/api/video/upload
WEB_LOG_WS_URL=ws://localhost:8080/ws
PROXY_SERVER_URL=http://localhost:8080
WEB_API_URL=http://localhost:8080/api/fire-detection

# ESP32-CAM Configuration
ESP32_CAM_STREAM=http://192.168.1.100:80/stream
ESP32_CAM_IP=192.168.1.100

# MQTT Configuration
MQTT_BROKER=3.27.0.139
MQTT_PORT=1883
MQTT_USER=zaks
MQTT_PASSWORD=enggangodinginmcu
MQTT_TOPIC_ALERT=lab/zaks/alert
MQTT_TOPIC_LOG=lab/zaks/log
MQTT_TOPIC_EVENT=lab/zaks/event

# Model Configuration
MODEL_PATH=/home/ubuntu/rtsp-project/python_scripts/fire_yolov8s_ultra_best.pt
EOF

echo "✅ .env file created"

echo ""
echo "📝 Step 7: Create systemd service for fire detection..."
sudo tee /etc/systemd/system/fire-detection.service > /dev/null << EOF
[Unit]
Description=Fire Detection Service with YOLO + Gemini AI
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$PYTHON_DIR
Environment="PYTHONUNBUFFERED=1"
ExecStart=/usr/bin/python3 $PYTHON_DIR/fire_detect_record_ultimate.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "✅ systemd service created"

echo ""
echo "🔄 Step 8: Enable and start fire detection service..."
sudo systemctl daemon-reload
sudo systemctl enable fire-detection.service
sudo systemctl restart fire-detection.service

echo ""
echo "📊 Step 9: Check service status..."
sleep 2
sudo systemctl status fire-detection.service --no-pager

echo ""
echo "============================================"
echo "✅ Python Fire Detection Deployment Complete!"
echo "============================================"
echo ""
echo "📝 Service Management:"
echo "  Start:   sudo systemctl start fire-detection"
echo "  Stop:    sudo systemctl stop fire-detection"
echo "  Restart: sudo systemctl restart fire-detection"
echo "  Status:  sudo systemctl status fire-detection"
echo "  Logs:    sudo journalctl -u fire-detection -f"
echo ""
echo "⚠️ Note: Make sure to upload fire_yolov8s_ultra_best.pt model file!"
echo ""
