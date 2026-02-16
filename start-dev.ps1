# WearAware Development Startup Script
# Starts Docker (PostgreSQL + Redis + Backend) and Expo Dev Client
# For production build with Vision API + ML Kit support

Write-Host "🚀 Starting WearAware Development Environment..." -ForegroundColor Cyan
Clear-Host
Write-Host "Starting WearAware Development Environment..." -ForegroundColor Cyan

# Start Docker containers
Write-Host "Checking Docker..." -ForegroundColor Cyan
docker info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not running. Please start Docker Desktop and retry." -ForegroundColor Red
    exit 1
}
Write-Host "Docker is running" -ForegroundColor Green

Write-Host "Starting containers (PostgreSQL, Redis, Backend, Ollama)..." -ForegroundColor Cyan
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start Docker containers" -ForegroundColor Red
    exit 1
}

# Wait for services with simple progress (no fancy Unicode)
$maxWait = 60
$elapsed = 0
$interval = 2

function Get-Health($name) {
    $status = docker inspect --format='{{.State.Health.Status}}' $name 2>$null
    if (-not $status) { return 'starting' }
    return $status
}

function Get-State($name) {
    $state = docker inspect --format='{{.State.Status}}' $name 2>$null
    if (-not $state) { return 'starting' }
    return $state
}

Write-Host "Waiting for services to be ready..." -ForegroundColor Cyan
while ($elapsed -lt $maxWait) {
    $pg = Get-Health 'wearaware-db'
    $redis = Get-Health 'wearaware-cache'
    $ollama = Get-Health 'wearaware-ollama'
    $backend = Get-State 'wearaware-backend'

    $progress = [math]::Min(100, [int](($elapsed / $maxWait) * 100))
    $barLen = 30
    $filled = [int](($progress / 100) * $barLen)
    $bar = ('#' * $filled) + ('.' * ($barLen - $filled))

    Write-Host ("PostgreSQL: {0}" -f $pg)
    Write-Host ("Redis:      {0}" -f $redis)
    Write-Host ("Ollama:     {0}" -f $ollama)
    Write-Host ("Backend:    {0}" -f $backend)
    Write-Host ("Progress:   [{0}] {1}%" -f $bar, $progress)
    Write-Host ("Elapsed:    {0}/{1} sec" -f $elapsed, $maxWait)
    Write-Host ""

    if ($pg -eq 'healthy' -and $redis -eq 'healthy' -and $ollama -eq 'healthy' -and $backend -eq 'running') {
        Write-Host "All services are ready!" -ForegroundColor Green
        break
    }

    Start-Sleep -Seconds $interval
    $elapsed += $interval
}

if ($elapsed -ge $maxWait) {
    Write-Host "Timeout waiting for services. You can continue, but some services may still be starting." -ForegroundColor Yellow
}

Write-Host "Service URLs:" -ForegroundColor Cyan
Write-Host "  PostgreSQL:  localhost:5432"
Write-Host "  Redis:       localhost:6379"
Write-Host "  Backend API: http://localhost:3000"
Write-Host "  Ollama API:  http://localhost:11434"
Write-Host ""

# Optional: enable Android device to access localhost:3000 via USB
try {
    $adb = Get-Command adb -ErrorAction Stop
    Write-Host "Setting up adb reverse for backend (device -> host localhost:3000)" -ForegroundColor Cyan
    adb devices | Out-Null
    adb reverse tcp:3000 tcp:3000 | Out-Null
    Write-Host "adb reverse configured: device localhost:3000 -> host localhost:3000" -ForegroundColor Green
} catch {
    Write-Host "adb not found or device not connected; skipping reverse port setup" -ForegroundColor Yellow
}

Write-Host "Starting Expo Go (LAN mode, no dev client)..." -ForegroundColor Cyan
# LAN mode works when phone and PC are on the same Wi-Fi
# If using USB, adb reverse above already forwards port 3000
npx expo start --lan

Write-Host "Expo stopped." -ForegroundColor Yellow
$resp = Read-Host "Do you want to stop Docker containers? (y/n)"
if ($resp -match '^[Yy]$') {
    Write-Host "Stopping Docker containers..." -ForegroundColor Cyan
    docker-compose down
    Write-Host "Cleanup complete" -ForegroundColor Green
} else {
    Write-Host "Docker containers are still running in the background." -ForegroundColor Green
}

exit 0
Write-Host "📊 Service Status:" -ForegroundColor Cyan
Write-Host "   PostgreSQL:  http://localhost:5432" -ForegroundColor White
Write-Host "   Redis:       http://localhost:6379" -ForegroundColor White
Write-Host "   Backend API: http://localhost:3000" -ForegroundColor White
Write-Host "   Ollama API:  http://localhost:11434" -ForegroundColor White
Write-Host ""

# Start Expo for Expo Go
Write-Host "📱 Starting Expo (use Expo Go app to scan QR code)..." -ForegroundColor Cyan
Write-Host ""

# Start Expo without dev-client flag
npx expo start

# Cleanup on exit (Ctrl+C)
Write-Host ""
Write-Host "🛑 Expo stopped." -ForegroundColor Yellow
Write-Host ""
$response = Read-Host "Do you want to stop Docker containers? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "Shutting down Docker containers..." -ForegroundColor Cyan
    docker-compose down
    Write-Host "✅ Cleanup complete" -ForegroundColor Green
} else {
    Write-Host "✅ Docker containers still running in background" -ForegroundColor Green
}
