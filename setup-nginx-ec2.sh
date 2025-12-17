#!/bin/bash
# ============================================================================
# ⚙️ Setup Nginx Reverse Proxy on EC2 (3.27.0.139)
# ============================================================================

set -e  # Exit on error

echo "============================================"
echo "🌐 Nginx Reverse Proxy Setup"
echo "============================================"

echo ""
echo "📦 Step 1: Install Nginx..."
sudo apt-get update -y
sudo apt-get install -y nginx

echo "✅ Nginx version: $(nginx -v 2>&1)"

echo ""
echo "🔧 Step 2: Configure Nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/rtsp-api > /dev/null << 'EOF'
# RTSP Fire Detection API - Nginx Configuration

upstream backend {
    server localhost:8080;
    keepalive 32;
}

server {
    listen 80;
    server_name 3.27.0.139;
    
    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # CORS for Vercel frontend
    add_header Access-Control-Allow-Origin "https://rtsp-main.vercel.app" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;
    add_header Access-Control-Allow-Credentials "true" always;
    
    # Handle preflight requests
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin "https://rtsp-main.vercel.app" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;
        add_header Access-Control-Max-Age 1728000;
        add_header Content-Type "text/plain charset=UTF-8";
        add_header Content-Length 0;
        return 204;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket endpoint
    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
    
    # Static files - recordings
    location /recordings/ {
        alias /home/ubuntu/rtsp-project/proxy-server/recordings/;
        autoindex on;
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
    }
    
    # Static files - uploads
    location /uploads/ {
        alias /home/ubuntu/rtsp-project/proxy-server/uploads/;
        autoindex on;
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
    }
    
    # Health check
    location /health {
        proxy_pass http://backend;
        access_log off;
    }
    
    # Root
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Logging
    access_log /var/log/nginx/rtsp-api-access.log;
    error_log /var/log/nginx/rtsp-api-error.log;
}
EOF

echo "✅ Nginx config created"

echo ""
echo "🔗 Step 3: Enable site configuration..."
sudo ln -sf /etc/nginx/sites-available/rtsp-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

echo ""
echo "🧪 Step 4: Test Nginx configuration..."
sudo nginx -t

echo ""
echo "🔄 Step 5: Restart Nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "📊 Step 6: Check Nginx status..."
sudo systemctl status nginx --no-pager

echo ""
echo "🔥 Step 7: Configure firewall (UFW)..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw allow 8080/tcp
    echo "✅ Firewall rules configured"
else
    echo "⚠️ UFW not installed, skipping firewall config"
fi

echo ""
echo "============================================"
echo "✅ Nginx Reverse Proxy Setup Complete!"
echo "============================================"
echo ""
echo "📝 Testing Commands:"
echo "  Health check: curl http://localhost/health"
echo "  API test: curl http://localhost/api/auth/health"
echo "  External: curl http://3.27.0.139/health"
echo ""
echo "📝 Nginx Commands:"
echo "  Test config: sudo nginx -t"
echo "  Reload: sudo systemctl reload nginx"
echo "  Restart: sudo systemctl restart nginx"
echo "  Logs: sudo tail -f /var/log/nginx/rtsp-api-error.log"
echo ""
echo "🔗 Public API: http://3.27.0.139/api"
echo "🔗 WebSocket: ws://3.27.0.139/ws"
echo ""
