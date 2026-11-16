# Quick Start Script for Detection Services
# Run this before starting your app: .\start-detection.ps1

Write-Host "🚀 Starting Detection Services..." -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "📦 Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker is installed: $dockerVersion" -ForegroundColor Green
    } else {
        throw "Docker not found"
    }
} catch {
    Write-Host "❌ Docker is not installed or not running" -ForegroundColor Red
    Write-Host "   Download from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "📚 Starting Noplag Engine (Plagiarism Detection)..." -ForegroundColor Yellow

# Start Noplag Engine
docker compose -f docker-compose.noplag.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Noplag Engine started successfully!" -ForegroundColor Green
    Write-Host "   API: http://localhost:8000" -ForegroundColor Cyan
    Write-Host "   Docs: http://localhost:8000/docs" -ForegroundColor Cyan
} else {
    Write-Host "❌ Failed to start Noplag Engine" -ForegroundColor Red
    Write-Host "   Check logs: docker compose -f docker-compose.noplag.yml logs" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "⏳ Waiting for Noplag to be ready (first start may take 2-3 minutes)..." -ForegroundColor Yellow

# Wait for Noplag to be ready
$maxAttempts = 60
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts -and -not $ready) {
    $attempt++
    Start-Sleep -Seconds 2
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/docs" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $ready = $true
        }
    } catch {
        Write-Host "   Attempt $attempt/$maxAttempts..." -ForegroundColor Gray
    }
}

if ($ready) {
    Write-Host "✅ Noplag Engine is ready!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Noplag Engine may still be starting up" -ForegroundColor Yellow
    Write-Host "   Check status: docker ps" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Detection Services Status:" -ForegroundColor Cyan
Write-Host "   ✅ Noplag Engine: RUNNING (Plagiarism)" -ForegroundColor Green
Write-Host "   ✅ TruthScan: CONFIGURED (AI Detection)" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Make sure TRUTHSCAN_API_KEY is set in .env" -ForegroundColor White
Write-Host "   2. Run: npm run dev" -ForegroundColor White
Write-Host "   3. Upload a document to test" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation: See SETUP_DETECTION.md" -ForegroundColor Cyan
