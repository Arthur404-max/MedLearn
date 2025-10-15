# Упрощенные команды управления production компонентами
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("check", "redis", "pm2", "nginx", "cdn", "admin")]
    [string]$Component,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("start", "stop", "status")]
    [string]$Action = "start"
)

$ProjectRoot = "E:\ClioTest2"

function Show-Header {
    param($Title)
    Write-Host "🔧 $Title" -ForegroundColor Cyan -BackgroundColor Black
    Write-Host ""
}

Set-Location $ProjectRoot

switch ($Component) {
    "check" {
        Show-Header "СИСТЕМНАЯ ПРОВЕРКА"
        
        # Redis
        try {
            wsl -d Ubuntu -- redis-cli ping | Out-Null
            Write-Host "✅ Redis: работает" -ForegroundColor Green
        } catch {
            Write-Host "❌ Redis: недоступен" -ForegroundColor Red
        }
        
        # PM2
        try {
            $pmOutput = pm2 list 2>$null
            if ($pmOutput -match "online") {
                Write-Host "✅ PM2: процессы активны" -ForegroundColor Green
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
        
        # Main Server
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
    }
    
    "redis" {
        Show-Header "REDIS MANAGEMENT"
        switch ($Action) {
            "start" { 
                Write-Host "🚀 Запуск Redis..." -ForegroundColor Yellow
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
        }
    }
    
    "pm2" {
        Show-Header "PM2 MANAGEMENT"
        switch ($Action) {
            "start" { 
                Write-Host "🚀 Запуск PM2 кластера..." -ForegroundColor Yellow
                npm run pm2:start
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
        }
    }
    
    "nginx" {
        Show-Header "NGINX MANAGEMENT"
        switch ($Action) {
            "start" { 
                Write-Host "🚀 Запуск Nginx..." -ForegroundColor Yellow
                nginx
                Write-Host "✅ Nginx запущен" -ForegroundColor Green
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
        }
    }
    
    "cdn" {
        Show-Header "CDN MANAGEMENT"
        switch ($Action) {
            "start" { 
                Write-Host "🚀 Запуск CDN сервера..." -ForegroundColor Yellow
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\cdn'; node cdn-server.js"
                Start-Sleep 3
                try {
                    Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 3 | Out-Null
                    Write-Host "✅ CDN запущен на порту 8080" -ForegroundColor Green
                } catch {
                    Write-Host "⚠️ CDN запускается..." -ForegroundColor Yellow
                }
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
                    Write-Host "✅ CDN остановлен" -ForegroundColor Green
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
        }
    }
    
    "admin" {
        Show-Header "ADMIN PANEL MANAGEMENT"
        switch ($Action) {
            "start" { 
                Write-Host "🚀 Запуск админ панели..." -ForegroundColor Yellow
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\admin-panel'; node server.js"
                Start-Sleep 3
                try {
                    Invoke-WebRequest -Uri "http://localhost:3002" -TimeoutSec 3 | Out-Null
                    Write-Host "✅ Админ панель запущена: http://localhost:3002" -ForegroundColor Green
                    Write-Host "🔐 Пароль: admin2024" -ForegroundColor Yellow
                } catch {
                    Write-Host "⚠️ Админ панель запускается..." -ForegroundColor Yellow
                }
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
                    Write-Host "✅ Админ панель остановлена" -ForegroundColor Green
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
        }
    }
}