# Скрипт проверки статуса системы MedLearn
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '📊 Статус системы MedLearn' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# 1. Проверка портов
Write-Host '🔌 Проверка портов:' -ForegroundColor Yellow
Write-Host ''

$port3000 = netstat -ano | Select-String ':3000' | Select-Object -First 1
$port3002 = netstat -ano | Select-String ':3002' | Select-Object -First 1
$port3001 = netstat -ano | Select-String ':3001' | Select-Object -First 1

if ($port3000) {
    $pid3000 = ($port3000 -split '\s+')[-1]
    Write-Host "  ✅ Основной сервер (3000): Работает (PID: $pid3000)" -ForegroundColor Green
} else {
    Write-Host '  ❌ Основной сервер (3000): Не запущен' -ForegroundColor Red
}

if ($port3002) {
    $pid3002 = ($port3002 -split '\s+')[-1]
    Write-Host "  ✅ Админ панель (3002): Работает (PID: $pid3002)" -ForegroundColor Green
} else {
    Write-Host '  ❌ Админ панель (3002): Не запущена' -ForegroundColor Red
}

if ($port3001) {
    $pid3001 = ($port3001 -split '\s+')[-1]
    Write-Host "  ✅ APM Dashboard (3001): Работает (PID: $pid3001)" -ForegroundColor Green
} else {
    Write-Host '  ⚠️  APM Dashboard (3001): Не запущен' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# 2. Процессы Node.js
Write-Host '💻 Процессы Node.js:' -ForegroundColor Yellow
Write-Host ''

$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Format-Table Id, ProcessName, @{Name='CPU (s)';Expression={$_.CPU};Format='N2'}, @{Name='Memory (MB)';Expression={[math]::Round($_.WorkingSet64/1MB, 2)}} -AutoSize
} else {
    Write-Host '  ℹ️  Процессы Node.js не найдены' -ForegroundColor Gray
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# 3. База данных
Write-Host '🗄️  База данных PostgreSQL:' -ForegroundColor Yellow
Write-Host ''

try {
    $env:PGPASSWORD = '1'
    $dbVersion = & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -d medlearndb -t -c "SELECT version();" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host '  ✅ PostgreSQL: Подключено' -ForegroundColor Green
        
        # Подсчёт данных
        $userCount = & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -d medlearndb -t -c "SELECT COUNT(*) FROM users;" 2>&1
        $testCount = & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -d medlearndb -t -c "SELECT COUNT(*) FROM tests;" 2>&1
        $subjectCount = & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -d medlearndb -t -c "SELECT COUNT(*) FROM subjects;" 2>&1
        
        Write-Host "  📊 Пользователей: $($userCount.Trim())" -ForegroundColor Cyan
        Write-Host "  📝 Тестов: $($testCount.Trim())" -ForegroundColor Cyan
        Write-Host "  📚 Предметов: $($subjectCount.Trim())" -ForegroundColor Cyan
    } else {
        Write-Host '  ❌ PostgreSQL: Ошибка подключения' -ForegroundColor Red
        Write-Host "  Детали: $dbVersion" -ForegroundColor Gray
    }
} catch {
    Write-Host '  ❌ PostgreSQL: Недоступен' -ForegroundColor Red
    Write-Host "  Ошибка: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# 4. Redis
Write-Host '🔴 Redis:' -ForegroundColor Yellow
Write-Host ''

$redisProcess = Get-Process redis-server -ErrorAction SilentlyContinue
if ($redisProcess) {
    Write-Host '  ✅ Redis: Работает' -ForegroundColor Green
} else {
    Write-Host '  ⚠️  Redis: Не запущен (необязательно)' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# 5. HTTP эндпоинты
Write-Host '🌐 Проверка HTTP эндпоинтов:' -ForegroundColor Yellow
Write-Host ''

# Проверка основного сервера
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host '  ✅ http://localhost:3000/api/health - OK' -ForegroundColor Green
} catch {
    Write-Host '  ❌ http://localhost:3000/api/health - Недоступен' -ForegroundColor Red
}

# Проверка регистрации
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/register.html" -TimeoutSec 2 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host '  ✅ http://localhost:3000/register.html - OK' -ForegroundColor Green
    }
} catch {
    Write-Host '  ❌ http://localhost:3000/register.html - Недоступен' -ForegroundColor Red
}

# Проверка админ панели
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3002" -TimeoutSec 2 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host '  ✅ http://localhost:3002 (Админ панель) - OK' -ForegroundColor Green
    }
} catch {
    Write-Host '  ❌ http://localhost:3002 (Админ панель) - Недоступен' -ForegroundColor Red
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# 6. Итоговая информация
$allServicesRunning = $port3000 -and $port3002
$dbConnected = $LASTEXITCODE -eq 0

if ($allServicesRunning -and $dbConnected) {
    Write-Host '✅ Система полностью работоспособна!' -ForegroundColor Green
} elseif ($allServicesRunning) {
    Write-Host '⚠️  Система частично работает (проблемы с БД)' -ForegroundColor Yellow
} else {
    Write-Host '❌ Система не запущена или есть критические проблемы' -ForegroundColor Red
}

Write-Host ''
Write-Host '💡 Полезные команды:' -ForegroundColor Cyan
Write-Host '   .\start-all.bat  - Запустить всю систему' -ForegroundColor Gray
Write-Host '   .\stop-all.bat   - Остановить всю систему' -ForegroundColor Gray
Write-Host '   .\check-status.ps1 - Проверить статус (этот скрипт)' -ForegroundColor Gray
Write-Host ''
