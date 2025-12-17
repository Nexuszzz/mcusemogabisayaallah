#!/usr/bin/env pwsh

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Converting PPK to PEM for OpenSSH" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$ppkFile = "C:\Users\NAUFAL\Downloads\sismod.ppk"
$pemFile = "C:\Users\NAUFAL\Downloads\sismod-openssh.pem"

if (-not (Test-Path $ppkFile)) {
    Write-Host "Error: $ppkFile not found!" -ForegroundColor Red
    exit 1
}

# Check for puttygen
$puttygenPath = "C:\Program Files\PuTTY\puttygen.exe"
if (-not (Test-Path $puttygenPath)) {
    $puttygenPath = "C:\Program Files (x86)\PuTTY\puttygen.exe"
}

if (Test-Path $puttygenPath) {
    Write-Host "Found PuTTYgen at: $puttygenPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Converting..." -ForegroundColor Yellow
    
    & $puttygenPath $ppkFile -O private-openssh -o $pemFile
    
    if (Test-Path $pemFile) {
        Write-Host "Success! Created: $pemFile" -ForegroundColor Green
        Write-Host ""
        
        # Now create SSH config
        $sshConfigPath = "$env:USERPROFILE\.ssh\config"
        $sshDir = "$env:USERPROFILE\.ssh"
        
        if (-not (Test-Path $sshDir)) {
            New-Item -ItemType Directory -Path $sshDir | Out-Null
        }
        
        $sshConfig = @"

# EC2 Fire Detection Server
Host ec2-fire-detection
    HostName 3.27.0.139
    User ubuntu
    IdentityFile $pemFile
    StrictHostKeyChecking no

"@
        
        Add-Content -Path $sshConfigPath -Value $sshConfig
        
        Write-Host "SSH config updated!" -ForegroundColor Green
        Write-Host "Config file: $sshConfigPath" -ForegroundColor Gray
        Write-Host ""
        Write-Host "You can now connect using:" -ForegroundColor Yellow
        Write-Host "  ssh ec2-fire-detection" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Or in VS Code:" -ForegroundColor Yellow
        Write-Host "  1. Press F1" -ForegroundColor White
        Write-Host "  2. Type: Remote-SSH: Connect to Host" -ForegroundColor White
        Write-Host "  3. Select: ec2-fire-detection" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "Conversion failed!" -ForegroundColor Red
    }
} else {
    Write-Host "PuTTYgen not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please convert manually:" -ForegroundColor Yellow
    Write-Host "1. Download PuTTY from https://www.putty.org/" -ForegroundColor White
    Write-Host "2. Open PuTTYgen" -ForegroundColor White
    Write-Host "3. Load sismod.ppk" -ForegroundColor White
    Write-Host "4. Conversions > Export OpenSSH key" -ForegroundColor White
    Write-Host "5. Save as sismod-openssh.pem" -ForegroundColor White
}

Write-Host ""
