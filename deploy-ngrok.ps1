#!/usr/bin/env pwsh
# ============================================
# 🌐 PUBLIC HOSTING WITH NGROK (INSTANT!)
# ============================================

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     🌐 INSTANT PUBLIC URL WITH NGROK                          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if ngrok is installed
$ngrokInstalled = Get-Command ngrok -ErrorAction SilentlyContinue

if (-not $ngrokInstalled) {
    Write-Host "📦 Ngrok not found. Installing via Chocolatey..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Installing Chocolatey..." -ForegroundColor Gray
    
    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        
        Write-Host "✅ Chocolatey installed" -ForegroundColor Green
        Write-Host ""
        Write-Host "Installing ngrok..." -ForegroundColor Yellow
        choco install ngrok -y
        
        Write-Host "✅ Ngrok installed!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to install via Chocolatey" -ForegroundColor Red
        Write-Host ""
        Write-Host "Manual installation:" -ForegroundColor Yellow
        Write-Host "1. Download ngrok from: https://ngrok.com/download" -ForegroundColor White
        Write-Host "2. Extract to: C:\ngrok" -ForegroundColor White
        Write-Host "3. Add to PATH" -ForegroundColor White
        Write-Host "4. Run this script again" -ForegroundColor White
        exit 1
    }
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 Starting local servers..." -ForegroundColor Yellow
Write-Host ""

# Start proxy server in background
Write-Host "[1/2] Starting proxy server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\proxy-server'; npm start" -WindowStyle Minimized

Start-Sleep -Seconds 5

# Start Vite dev server in background
Write-Host "[2/2] Starting Vite dev server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev" -WindowStyle Minimized

Start-Sleep -Seconds 10

Write-Host "✅ Servers started!" -ForegroundColor Green
Write-Host ""

Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Creating public URL with ngrok..." -ForegroundColor Yellow
Write-Host ""

# Start ngrok
Write-Host "Opening ngrok tunnel on port 5174..." -ForegroundColor White
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "✅ NGROK IS STARTING!" -ForegroundColor Green
Write-Host ""
Write-Host "Look for the 'Forwarding' URL in the ngrok window" -ForegroundColor Yellow
Write-Host "Example: https://xxxx-xxx-xxx-xxx.ngrok-free.app" -ForegroundColor White
Write-Host ""
Write-Host "Share that URL to access your website from anywhere!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Login: admin / admin123" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C in ngrok window to stop" -ForegroundColor Yellow
Write-Host ""

ngrok http 5174
