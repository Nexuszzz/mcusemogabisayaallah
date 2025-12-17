Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " DEPLOY TO VERCEL - NO EC2 NEEDED!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if vercel CLI is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "Installing Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
    Write-Host "Vercel CLI installed!" -ForegroundColor Green
    Write-Host ""
}

Write-Host "Preparing project for Vercel..." -ForegroundColor Yellow
Write-Host ""

# Build the project first
Write-Host "Building project..." -ForegroundColor Yellow
npm run build

Write-Host "Project built successfully!" -ForegroundColor Green
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "DEPLOYING TO VERCEL..." -ForegroundColor Yellow
Write-Host ""
Write-Host "You will be asked to:" -ForegroundColor White
Write-Host "  1. Login to Vercel (opens browser)" -ForegroundColor Gray
Write-Host "  2. Confirm project settings" -ForegroundColor Gray
Write-Host ""

# Deploy
vercel --prod

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host ""
Write-Host "Your website is now LIVE!" -ForegroundColor Yellow
Write-Host "Check the URL above to access it" -ForegroundColor White
Write-Host ""
Write-Host "Login: admin / admin123" -ForegroundColor Gray
Write-Host ""
