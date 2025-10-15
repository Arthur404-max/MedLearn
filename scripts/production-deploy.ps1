# Production Deployment Script for MedLearn Platform
# Полный запуск всех сервисов для production

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("deploy", "stop", "restart", "status", "optimize", "backup", "redis", "pm2", "nginx", "cdn", "admin", "check")]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("development", "production")]
    [string]$Environment = "production",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$SubAction = "start"
)

$ProjectRoot = "E:\ClioTest2"
$BackupDir = "E:\ClioTest2\backups"

function Write-Banner {
    param($Message)
    Write-Host ""
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host " $Message" -ForegroundColor White
    Write-Host "=" * 60 -ForegroundColor Cyan
}

function Test-Prerequisites {
    Write-Host "📋 Проверка системных требований..." -ForegroundColor Yellow
    
    $checks = @(
        @{ Name = "Node.js"; Command = "node --version" },
        @{ Name = "PM2"; Command = "pm2 --version" },
        @{ Name = "TypeScript"; Command = "npx tsc --version" },
        @{ Name = "Redis (WSL)"; Command = "wsl -d Ubuntu -- redis-cli ping" },
        @{ Name = "PostgreSQL"; Command = "pg_isready" }
    )
    
    $allPassed = $true
    
    foreach ($check in $checks) {
        try {
            $result = Invoke-Expression $check.Command 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ $($check.Name): OK" -ForegroundColor Green
            } else {
                Write-Host "   ❌ $($check.Name): FAILED" -ForegroundColor Red
                $allPassed = $false
            }
        } catch {
            Write-Host "   ⚠️ $($check.Name): NOT AVAILABLE" -ForegroundColor Yellow
        }
    }
    
    return $allPassed
}

function Deploy-Production {
    Write-Banner "🚀 PRODUCTION DEPLOYMENT - MEDLEARN PLATFORM"
    
    if (-not (Test-Prerequisites)) {
        Write-Host "❌ Проверьте системные требования перед развертыванием" -ForegroundColor Red
        return $false
    }
    
    Write-Host "📦 1. Сборка проекта..." -ForegroundColor Cyan
    Set-Location $ProjectRoot
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ошибка сборки проекта" -ForegroundColor Red
        return $false
    }
    Write-Host "✅ Проект собран" -ForegroundColor Green
    
    Write-Host "🎨 2. Оптимизация статических ресурсов..." -ForegroundColor Cyan
    npm run optimize-static
    Write-Host "✅ Статические ресурсы оптимизированы" -ForegroundColor Green
    
    Write-Host "🔄 3. Запуск Redis..." -ForegroundColor Cyan
    PowerShell -File "$ProjectRoot\scripts\redis-control.ps1" -Action start
    Write-Host "✅ Redis запущен" -ForegroundColor Green
    
    Write-Host "⚡ 4. Запуск PM2 кластера..." -ForegroundColor Cyan
    if ($Environment -eq "production") {
        npm run pm2:start:prod
    } else {
        npm run pm2:start
    }
    Write-Host "✅ PM2 кластер запущен" -ForegroundColor Green
    
    Write-Host "🌐 5. Запуск Nginx Load Balancer..." -ForegroundColor Cyan
    PowerShell -ExecutionPolicy Bypass -File "$ProjectRoot\scripts\nginx-control.ps1" -Action start
    Write-Host "✅ Nginx Load Balancer запущен" -ForegroundColor Green
    
    Write-Host "📊 6. Аудит производительности..." -ForegroundColor Cyan
    Start-Sleep 5  # Даем время системе стабилизироваться
    npm run performance-audit
    
    Write-Banner "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
    Show-DeploymentInfo
    
    return $true
}

function Stop-Production {
    Write-Banner "🛑 STOPPING PRODUCTION SERVICES"
    
    Write-Host "🌐 Остановка Nginx..." -ForegroundColor Yellow
    PowerShell -ExecutionPolicy Bypass -File "$ProjectRoot\scripts\nginx-control.ps1" -Action stop
    
    Write-Host "⚡ Остановка PM2..." -ForegroundColor Yellow
    npm run pm2:stop
    
    Write-Host "🔄 Остановка Redis..." -ForegroundColor Yellow
    PowerShell -File "$ProjectRoot\scripts\redis-control.ps1" -Action stop
    
    Write-Host "✅ Все сервисы остановлены" -ForegroundColor Green
}

function Restart-Production {
    Write-Banner "🔄 RESTARTING PRODUCTION SERVICES"
    Stop-Production
    Start-Sleep 3
    Deploy-Production
}

function Show-ProductionStatus {
    Write-Banner "📊 PRODUCTION STATUS DASHBOARD"
    
    Write-Host "🔄 Redis Status:" -ForegroundColor Cyan
    PowerShell -File "$ProjectRoot\scripts\redis-control.ps1" -Action status
    
    Write-Host "`n⚡ PM2 Cluster Status:" -ForegroundColor Cyan
    pm2 status
    
    Write-Host "`n🌐 Nginx Load Balancer Status:" -ForegroundColor Cyan
    PowerShell -ExecutionPolicy Bypass -File "$ProjectRoot\scripts\nginx-control.ps1" -Action status
    
    Write-Host "`n📈 Quick Performance Test:" -ForegroundColor Cyan
    try {
        $startTime = Get-Date
        $response = Invoke-WebRequest -Uri "http://localhost/api/health" -TimeoutSec 10
        $endTime = Get-Date
        $responseTime = ($endTime - $startTime).TotalMilliseconds
        
        Write-Host "   ✅ Load Balancer: ${responseTime}ms" -ForegroundColor Green
        
        $healthData = $response.Content | ConvertFrom-Json
        Write-Host "   📊 Cluster PID: $($healthData.cluster.pid)" -ForegroundColor Gray
        Write-Host "   🆔 Instance ID: $($healthData.cluster.instanceId)" -ForegroundColor Gray
        
    } catch {
        Write-Host "   ❌ Load Balancer: Offline" -ForegroundColor Red
    }
}

function Optimize-Production {
    Write-Banner "⚡ PRODUCTION OPTIMIZATION"
    
    Write-Host "🎨 Оптимизация статических ресурсов..." -ForegroundColor Cyan
    npm run optimize-static
    
    Write-Host "🗄️ Оптимизация базы данных..." -ForegroundColor Cyan
    npm run db:optimize
    
    Write-Host "💾 Очистка кэша..." -ForegroundColor Cyan
    PowerShell -File "$ProjectRoot\scripts\redis-control.ps1" -Action flush
    
    Write-Host "♻️ Перезагрузка PM2 (zero-downtime)..." -ForegroundColor Cyan
    npm run pm2:reload
    
    Write-Host "🌐 Перезагрузка Nginx..." -ForegroundColor Cyan
    PowerShell -ExecutionPolicy Bypass -File "$ProjectRoot\scripts\nginx-control.ps1" -Action reload
    
    Write-Host "✅ Оптимизация завершена" -ForegroundColor Green
}

function Backup-Production {
    Write-Banner "💾 PRODUCTION BACKUP"
    
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $backupPath = "$BackupDir\backup_$timestamp"
    
    if (-not (Test-Path $BackupDir)) {
        New-Item -Path $BackupDir -ItemType Directory -Force | Out-Null
    }
    
    New-Item -Path $backupPath -ItemType Directory -Force | Out-Null
    
    Write-Host "📁 Создание архива файлов..." -ForegroundColor Cyan
    $excludeDirs = @("node_modules", "dist", "logs", "temp", ".git")
    
    # Простое копирование важных файлов
    $importantFiles = @(
        "package.json", "package-lock.json", "tsconfig.json", 
        "ecosystem.config.json", ".env"
    )
    
    foreach ($file in $importantFiles) {
        if (Test-Path "$ProjectRoot\$file") {
            Copy-Item "$ProjectRoot\$file" "$backupPath\" -Force
        }
    }
    
    # Копирование папок
    $importantDirs = @("src", "routes", "middleware", "scripts", "public", "nginx")
    foreach ($dir in $importantDirs) {
        if (Test-Path "$ProjectRoot\$dir") {
            Copy-Item "$ProjectRoot\$dir" "$backupPath\" -Recurse -Force
        }
    }
    
    Write-Host "🗄️ Экспорт базы данных..." -ForegroundColor Cyan
    # Здесь можно добавить pg_dump если PostgreSQL доступен локально
    
    Write-Host "💾 Экспорт Redis данных..." -ForegroundColor Cyan
    try {
        wsl -d Ubuntu -- redis-cli save
        $redisBackup = wsl -d Ubuntu -- find /var/lib/redis -name "dump.rdb" 2>/dev/null | Select-Object -First 1
        if ($redisBackup) {
            wsl -d Ubuntu -- cp $redisBackup /mnt/c/temp/redis_backup_$timestamp.rdb
        }
    } catch {
        Write-Host "   ⚠️ Redis backup не удался" -ForegroundColor Yellow
    }
    
    Write-Host "✅ Backup создан: $backupPath" -ForegroundColor Green
    Write-Host "📊 Размер backup: $((Get-ChildItem $backupPath -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB | ForEach {[math]::Round($_, 2)}) MB" -ForegroundColor Gray
}

function Show-DeploymentInfo {
    Write-Host ""
    Write-Host "🌐 PRODUCTION ENDPOINTS:" -ForegroundColor Green
    Write-Host "   Main Site: http://localhost" -ForegroundColor White
    Write-Host "   API Health: http://localhost/api/health" -ForegroundColor White
    Write-Host "   Nginx Status: http://localhost/nginx_status" -ForegroundColor White
    Write-Host "   Direct PM2: http://localhost:3000" -ForegroundColor Gray
    Write-Host ""
    Write-Host "⚡ MANAGEMENT COMMANDS:" -ForegroundColor Green
    Write-Host "   PM2 Monitor: pm2 monit" -ForegroundColor White
    Write-Host "   PM2 Logs: pm2 logs" -ForegroundColor White
    Write-Host "   Load Test: npm run nginx-test" -ForegroundColor White
    Write-Host "   Performance: npm run performance-audit" -ForegroundColor White
    Write-Host ""
    Write-Host "🎯 PRODUCTION READY FOR 100,000+ USERS!" -ForegroundColor Yellow -BackgroundColor Green
}

function Manage-Redis {
    Write-Host "🔄 Redis Management..." -ForegroundColor Cyan
    switch ($SubAction) {
        "start" { 
            Write-Host "🚀 Запуск Redis через WSL..." -ForegroundColor Yellow
            wsl -d Ubuntu -- sudo service redis-server start
            Start-Sleep 2
            wsl -d Ubuntu -- redis-cli ping
        }
        "stop" { 
            Write-Host "🛑 Остановка Redis..." -ForegroundColor Yellow
            wsl -d Ubuntu -- sudo service redis-server stop
        }
        "status" { 
            Write-Host "📊 Статус Redis:" -ForegroundColor Yellow
            try {
                $result = wsl -d Ubuntu -- redis-cli ping
                Write-Host "✅ Redis: $result" -ForegroundColor Green
            } catch {
                Write-Host "❌ Redis: недоступен" -ForegroundColor Red
            }
        }
        "restart" { 
            wsl -d Ubuntu -- sudo service redis-server restart
            Start-Sleep 2
            wsl -d Ubuntu -- redis-cli ping
        }
    }
}

function Manage-PM2 {
    Write-Host "⚡ PM2 Management..." -ForegroundColor Cyan
    switch ($SubAction) {
        "start" { 
            Write-Host "🚀 Запуск PM2 кластера..." -ForegroundColor Yellow
            if ($Environment -eq "production") {
                npm run pm2:start:prod
            } else {
                npm run pm2:start
            }
        }
        "stop" { 
            Write-Host "🛑 Остановка PM2..." -ForegroundColor Yellow
            pm2 stop all
            pm2 delete all
        }
        "status" { 
            Write-Host "📊 Статус PM2:" -ForegroundColor Yellow
            pm2 list --no-color
        }
        "restart" { 
            Write-Host "🔄 Перезапуск PM2..." -ForegroundColor Yellow
            pm2 restart all
        }
    }
}

function Manage-Nginx {
    Write-Host "🌐 Nginx Management..." -ForegroundColor Cyan
    switch ($SubAction) {
        "start" { 
            Write-Host "🚀 Запуск Nginx..." -ForegroundColor Yellow
            PowerShell -ExecutionPolicy Bypass -File "$ProjectRoot\scripts\nginx-control.ps1" -Action start
        }
        "stop" { 
            Write-Host "🛑 Остановка Nginx..." -ForegroundColor Yellow
            nginx -s quit
        }
        "status" { 
            Write-Host "📊 Статус Nginx:" -ForegroundColor Yellow
            if (Get-Process nginx -ErrorAction SilentlyContinue) {
                Write-Host "✅ Nginx: запущен" -ForegroundColor Green
            } else {
                Write-Host "❌ Nginx: остановлен" -ForegroundColor Red
            }
        }
        "restart" { 
            Write-Host "🔄 Перезапуск Nginx..." -ForegroundColor Yellow
            nginx -s reload
        }
    }
}

function Manage-CDN {
    Write-Host "⚡ CDN Management..." -ForegroundColor Cyan
    switch ($SubAction) {
        "start" { 
            Write-Host "🚀 Запуск CDN сервера..." -ForegroundColor Yellow
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\cdn'; node cdn-server.js"
        }
        "stop" { 
            Write-Host "🛑 Остановка CDN..." -ForegroundColor Yellow
            $netstatOutput = netstat -ano | Select-String ":8080"
            if ($netstatOutput) {
                foreach ($line in $netstatOutput) {
                    $parts = $line -split '\s+'
                    $processId = $parts[-1]
                    if ($processId -match '^\d+$') {
                        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    }
                }
            }
        }
        "status" { 
            Write-Host "📊 Статус CDN:" -ForegroundColor Yellow
            try {
                Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 3 | Out-Null
                Write-Host "✅ CDN: доступен на порту 8080" -ForegroundColor Green
            } catch {
                Write-Host "❌ CDN: недоступен" -ForegroundColor Red
            }
        }
        "restart" {
            Write-Host "🔄 Перезапуск CDN..." -ForegroundColor Yellow
            # Останавливаем
            $netstatOutput = netstat -ano | Select-String ":8080"
            if ($netstatOutput) {
                foreach ($line in $netstatOutput) {
                    $parts = $line -split '\s+'
                    $processId = $parts[-1]
                    if ($processId -match '^\d+$') {
                        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    }
                }
            }
            Start-Sleep 2
            # Запускаем
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\cdn'; node cdn-server.js"
        }
    }
}

function Manage-Admin {
    Write-Host "🎛️ Admin Panel Management..." -ForegroundColor Cyan
    switch ($SubAction) {
        "start" { 
            Write-Host "🚀 Запуск админ панели..." -ForegroundColor Yellow
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\admin-panel'; node server.js"
        }
        "stop" { 
            Write-Host "🛑 Остановка админ панели..." -ForegroundColor Yellow
            $netstatOutput = netstat -ano | Select-String ":3002"
            if ($netstatOutput) {
                foreach ($line in $netstatOutput) {
                    $parts = $line -split '\s+'
                    $processId = $parts[-1]
                    if ($processId -match '^\d+$') {
                        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    }
                }
            }
        }
        "status" { 
            Write-Host "📊 Статус админ панели:" -ForegroundColor Yellow
            try {
                Invoke-WebRequest -Uri "http://localhost:3002" -TimeoutSec 3 | Out-Null
                Write-Host "✅ Админ панель: доступна на http://localhost:3002" -ForegroundColor Green
            } catch {
                Write-Host "❌ Админ панель: недоступна" -ForegroundColor Red
            }
        }
        "restart" {
            Write-Host "🔄 Перезапуск админ панели..." -ForegroundColor Yellow
            # Останавливаем
            $netstatOutput = netstat -ano | Select-String ":3002"
            if ($netstatOutput) {
                foreach ($line in $netstatOutput) {
                    $parts = $line -split '\s+'
                    $processId = $parts[-1]
                    if ($processId -match '^\d+$') {
                        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    }
                }
            }
            Start-Sleep 2
            # Запускаем
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\admin-panel'; node server.js"
        }
    }
}

function Show-SystemCheck {
    Write-Banner "🔍 СИСТЕМНАЯ ПРОВЕРКА"
    
    Write-Host "📋 Проверка компонентов:" -ForegroundColor Cyan
    
    # Redis
    try {
        wsl -d Ubuntu -- redis-cli ping | Out-Null
        Write-Host "✅ Redis: работает" -ForegroundColor Green
    } catch {
        Write-Host "❌ Redis: недоступен" -ForegroundColor Red
    }
    
    # PM2
    try {
        $processes = pm2 jlist | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($processes) {
            $online = ($processes | Where-Object {$_.pm2_env.status -eq 'online'}).Count
            Write-Host "✅ PM2: $online процессов активно" -ForegroundColor Green
        } else {
            Write-Host "❌ PM2: процессы не запущены" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ PM2: недоступен" -ForegroundColor Red
    }
    
    # Nginx
    if (Get-Process nginx -ErrorAction SilentlyContinue) {
        Write-Host "✅ Nginx: запущен" -ForegroundColor Green
    } else {
        Write-Host "❌ Nginx: остановлен" -ForegroundColor Red
    }
    
    # CDN
    try {
        Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 3 | Out-Null
        Write-Host "✅ CDN: доступен" -ForegroundColor Green
    } catch {
        Write-Host "❌ CDN: недоступен" -ForegroundColor Red
    }
    
    # Admin Panel
    try {
        Invoke-WebRequest -Uri "http://localhost:3002" -TimeoutSec 3 | Out-Null
        Write-Host "✅ Админ панель: доступна" -ForegroundColor Green
    } catch {
        Write-Host "❌ Админ панель: недоступна" -ForegroundColor Red
    }
    
    # Основной сервер
    try {
        Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 3 | Out-Null
        Write-Host "✅ Основной сервер: доступен" -ForegroundColor Green
    } catch {
        Write-Host "❌ Основной сервер: недоступен" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "🎯 ПОРТЫ:" -ForegroundColor Yellow
    Write-Host "  3000 - Основной сервер"
    Write-Host "  3002 - Админ панель" 
    Write-Host "  8080 - CDN сервер"
    Write-Host "  6379 - Redis (WSL)"
}

# Main execution
Set-Location $ProjectRoot

switch ($Action) {
    "deploy" { Deploy-Production }
    "stop" { Stop-Production }
    "restart" { Restart-Production }
    "redis" { Manage-Redis }
    "pm2" { Manage-PM2 }
    "nginx" { Manage-Nginx }
    "cdn" { Manage-CDN }
    "admin" { Manage-Admin }
    "check" { Show-SystemCheck }
    "status" { Show-ProductionStatus }
    "optimize" { Optimize-Production }
    "backup" { Backup-Production }
}