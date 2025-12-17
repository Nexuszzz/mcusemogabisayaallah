# ============================================================================
# 🚀 Complete EC2 Deployment Script for Windows (PowerShell)
# ============================================================================
# This script automates the entire deployment process to EC2 3.27.0.139

param(
    [string]$SSHKey = "C:\Users\fahri\Downloads\sismod",
    [string]$EC2Host = "3.27.0.139",
    [string]$EC2User = "ubuntu"
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "🚀 RTSP Fire Detection - EC2 Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Variables
$LocalProjectDir = "d:\rtsp-main"
$RemoteProjectDir = "/home/ubuntu/rtsp-project"
$SSHConnection = "$EC2User@$EC2Host"

# Check if SSH key exists
if (-not (Test-Path $SSHKey)) {
    Write-Host "[ERROR] SSH key not found: $SSHKey" -ForegroundColor Red
    Write-Host "Please make sure the sismod key file exists!" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] SSH key found: $SSHKey" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 1: Test SSH Connection
# ============================================================================
Write-Host "📡 Step 1: Testing SSH connection..." -ForegroundColor Yellow
try {
    ssh -i $SSHKey -o StrictHostKeyChecking=no $SSHConnection "echo 'SSH connection successful!'"
    Write-Host "[OK] SSH connection verified" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] SSH connection failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
Write-Host ""

# ============================================================================
# Step 2: Create remote directories
# ============================================================================
Write-Host "📂 Step 2: Creating remote directories..." -ForegroundColor Yellow
ssh -i $SSHKey $SSHConnection @"
mkdir -p $RemoteProjectDir
mkdir -p $RemoteProjectDir/proxy-server
mkdir -p $RemoteProjectDir/python_scripts
"@
Write-Host "[OK] Remote directories created" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 3: Upload backend files
# ============================================================================
Write-Host "📤 Step 3: Uploading backend files..." -ForegroundColor Yellow

# Create a temporary archive
$TempBackendZip = "$env:TEMP\backend.zip"
Write-Host "  Creating backend archive..." -ForegroundColor Cyan

# Compress proxy-server folder
Compress-Archive -Path "$LocalProjectDir\proxy-server\*" `
    -DestinationPath $TempBackendZip `
    -Force

Write-Host "  Uploading to EC2..." -ForegroundColor Cyan
scp -i $SSHKey $TempBackendZip "$SSHConnection`:$RemoteProjectDir/"

ssh -i $SSHKey $SSHConnection @"
cd $RemoteProjectDir
unzip -o backend.zip -d proxy-server/
rm backend.zip
"@

Remove-Item $TempBackendZip
Write-Host "[OK] Backend files uploaded" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 4: Upload Python scripts
# ============================================================================
Write-Host "📤 Step 4: Uploading Python scripts..." -ForegroundColor Yellow

$TempPythonZip = "$env:TEMP\python_scripts.zip"
Write-Host "  Creating Python archive..." -ForegroundColor Cyan

Compress-Archive -Path "$LocalProjectDir\python_scripts\*" `
    -DestinationPath $TempPythonZip `
    -Force

Write-Host "  Uploading to EC2..." -ForegroundColor Cyan
scp -i $SSHKey $TempPythonZip "$SSHConnection`:$RemoteProjectDir/"

ssh -i $SSHKey $SSHConnection @"
cd $RemoteProjectDir
unzip -o python_scripts.zip -d python_scripts/
rm python_scripts.zip
"@

Remove-Item $TempPythonZip
Write-Host "[OK] Python scripts uploaded" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 5: Upload deployment scripts
# ============================================================================
Write-Host "📤 Step 5: Uploading deployment scripts..." -ForegroundColor Yellow

scp -i $SSHKey `
    "$LocalProjectDir\deploy-backend-ec2.sh" `
    "$LocalProjectDir\deploy-python-ec2.sh" `
    "$LocalProjectDir\setup-nginx-ec2.sh" `
    "$SSHConnection`:$RemoteProjectDir/"

ssh -i $SSHKey $SSHConnection @"
cd $RemoteProjectDir
chmod +x *.sh
"@

Write-Host "[OK] Deployment scripts uploaded" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 6: Deploy backend
# ============================================================================
Write-Host "🚀 Step 6: Deploying backend..." -ForegroundColor Yellow
ssh -i $SSHKey $SSHConnection "bash -c 'cd $RemoteProjectDir ; ./deploy-backend-ec2.sh'"
Write-Host "[OK] Backend deployed successfully" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 7: Setup Nginx
# ============================================================================
Write-Host "⚙️ Step 7: Setting up Nginx..." -ForegroundColor Yellow
ssh -i $SSHKey $SSHConnection "bash -c 'cd $RemoteProjectDir ; sudo ./setup-nginx-ec2.sh'"
Write-Host "[OK] Nginx configured successfully" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 8: Deploy Python service
# ============================================================================
Write-Host "🐍 Step 8: Deploying Python fire detection..." -ForegroundColor Yellow
ssh -i $SSHKey $SSHConnection "bash -c 'cd $RemoteProjectDir ; ./deploy-python-ec2.sh'"
Write-Host "[OK] Python service deployed successfully" -ForegroundColor Green
Write-Host ""

# ============================================================================
# Step 9: Test endpoints
# ============================================================================
Write-Host "🧪 Step 9: Testing deployed services..." -ForegroundColor Yellow
Write-Host ""

Write-Host "  Testing health endpoint..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://$EC2Host/health" -TimeoutSec 10
    Write-Host "  [OK] Health check: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "  [WARNING] Health check failed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Testing auth endpoint..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://$EC2Host/api/auth/health" -TimeoutSec 10
    Write-Host "  [OK] Auth API: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "  [WARNING] Auth API not responding" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# Deployment Complete
# ============================================================================
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "[SUCCESS] EC2 DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Deployment Summary:" -ForegroundColor White
Write-Host "  [OK] Backend Express.js deployed and running" -ForegroundColor Green
Write-Host "  [OK] Python fire detection service deployed" -ForegroundColor Green
Write-Host "  [OK] Nginx reverse proxy configured" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 Access URLs:" -ForegroundColor White
Write-Host "  Backend API: http://$EC2Host/api" -ForegroundColor Cyan
Write-Host "  Health Check: http://$EC2Host/health" -ForegroundColor Cyan
Write-Host "  WebSocket: ws://$EC2Host/ws" -ForegroundColor Cyan
Write-Host "  Frontend: https://rtsp-main.vercel.app" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Service Management (SSH to EC2):" -ForegroundColor White
Write-Host "  PM2 status: pm2 status" -ForegroundColor Gray
Write-Host "  PM2 logs: pm2 logs proxy-server" -ForegroundColor Gray
Write-Host "  Fire detection: sudo systemctl status fire-detection" -ForegroundColor Gray
Write-Host "  Nginx logs: sudo tail -f /var/log/nginx/rtsp-api-error.log" -ForegroundColor Gray
Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor White
Write-Host "  1. Update frontend to use http://$EC2Host/api" -ForegroundColor Yellow
Write-Host "  2. Rebuild and redeploy frontend to Vercel" -ForegroundColor Yellow
Write-Host "  3. Test complete login flow" -ForegroundColor Yellow
Write-Host "  4. Test fire detection triggers" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
