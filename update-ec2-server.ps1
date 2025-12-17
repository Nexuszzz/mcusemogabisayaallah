# PowerShell script to test EC2 server and show update instructions

Write-Host "Copy the updated server.js to EC2:"
Write-Host "File to copy: D:\rtsp-main\proxy-server\server.js"
Write-Host "Target: /home/ec2-user/rtsp-main/proxy-server/server.js"
Write-Host ""

Write-Host "Key CORS updates added:"
Write-Host "- Added Vercel domains to CORS origin"
Write-Host "- Added /api/status endpoint"  
Write-Host "- Enhanced preflight OPTIONS handling"
Write-Host ""

# Test current EC2 status
Write-Host "Testing current EC2 server..."
try {
    $response = Invoke-RestMethod -Uri "http://3.27.0.139:8080/health" -Method Get -TimeoutSec 10
    Write-Host "EC2 server is responding:"
    $response | ConvertTo-Json
} catch {
    Write-Host "EC2 server not responding: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Manual steps if you have EC2 access:"
Write-Host "1. Copy server.js changes"
Write-Host "2. Run: pm2 restart proxy-server"
Write-Host "3. Check: pm2 status"
Write-Host "4. Test: curl http://localhost:8080/api/status"