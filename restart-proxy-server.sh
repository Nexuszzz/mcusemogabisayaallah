#!/bin/bash
# Script to restart proxy server with updated CORS

echo "🔄 Stopping existing proxy server..."
pm2 stop proxy-server 2>/dev/null || echo "No proxy-server process found"

echo "📂 Going to proxy server directory..."
cd /home/ec2-user/rtsp-main/proxy-server

echo "📦 Installing dependencies..."
npm install

echo "🚀 Starting proxy server with PM2..."
pm2 start server.js --name "proxy-server" --watch

echo "📊 PM2 Status:"
pm2 status

echo "✅ Server restarted with updated CORS configuration!"
echo "🌐 Testing endpoints:"
echo "Health: http://3.27.0.139:8080/health"
echo "Status: http://3.27.0.139:8080/api/status"

# Test the endpoints
echo "🧪 Testing connectivity..."
curl -s http://localhost:8080/health | jq . || echo "Health check failed"
curl -s http://localhost:8080/api/status | jq . || echo "Status check failed"