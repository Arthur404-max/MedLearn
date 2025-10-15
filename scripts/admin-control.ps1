# Admin Panel Management Script

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "status", "install")]
    [string]$Action
)

$AdminPath = "E:\ClioTest2\admin-panel"
$AdminPort = 3002

function Start-AdminPanel {
    Write-Host "🔧 Запуск Admin Panel..." -ForegroundColor Cyan
    
    # Проверяем, что зависимости установлены
    if (-not (Test-Path "$AdminPath\node_modules")) {
        Write-Host "📦 Установка зависимостей Admin Panel..." -ForegroundColor Yellow
        Set-Location $AdminPath
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Ошибка установки зависимостей" -ForegroundColor Red
            return $false
        }
    }
    
    # Проверяем, не запущена ли уже
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$AdminPort" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "⚠️ Admin Panel уже запущена на порту $AdminPort" -ForegroundColor Yellow
        return $true
    } catch {
        # Не запущена, продолжаем
    }
    
    # Запускаем в фоновом режиме
    Set-Location $AdminPath
    Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $AdminPath -WindowStyle Hidden
    
    # Ждем запуска
    Start-Sleep 3
    
    # Проверяем успешность запуска
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$AdminPort" -TimeoutSec 5
        Write-Host "✅ Admin Panel запущена на http://localhost:$AdminPort" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "❌ Не удалось запустить Admin Panel" -ForegroundColor Red
        return $false
    }
}

function Stop-AdminPanel {
    Write-Host "🛑 Остановка Admin Panel..." -ForegroundColor Yellow
    
    # Останавливаем все процессы node.js на порту 3002
    try {
        $processes = Get-NetTCPConnection -LocalPort $AdminPort -ErrorAction SilentlyContinue
        foreach ($conn in $processes) {
            $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -eq "node") {
                Write-Host "Остановка процесса PID: $($proc.Id)" -ForegroundColor Gray
                Stop-Process -Id $proc.Id -Force
            }
        }
        Write-Host "✅ Admin Panel остановлена" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "⚠️ Admin Panel не была запущена" -ForegroundColor Yellow
        return $true
    }
}

function Show-AdminStatus {
    Write-Host "📊 Статус Admin Panel:" -ForegroundColor Cyan
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$AdminPort" -TimeoutSec 5
        Write-Host "✅ Admin Panel работает" -ForegroundColor Green
        Write-Host "   URL: http://localhost:$AdminPort" -ForegroundColor White
        Write-Host "   Логин: http://localhost:$AdminPort/login" -ForegroundColor White
        Write-Host "   Пароль: admin2024" -ForegroundColor Gray
        
        # Проверяем доступность основного API
        try {
            $apiResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 3
            Write-Host "✅ Связь с основным API: OK" -ForegroundColor Green
        } catch {
            Write-Host "❌ Основной API недоступен (запустите основной сервер)" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "❌ Admin Panel не запущена" -ForegroundColor Red
        Write-Host "   Ожидаемый порт: $AdminPort" -ForegroundColor Gray
        Write-Host "   Для запуска: .\scripts\admin-control.ps1 start" -ForegroundColor Gray
    }
}

function Install-AdminDeps {
    Write-Host "📦 Установка зависимостей Admin Panel..." -ForegroundColor Cyan
    Set-Location $AdminPath
    
    if (Test-Path "package.json") {
        npm install
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Зависимости установлены" -ForegroundColor Green
        } else {
            Write-Host "❌ Ошибка установки зависимостей" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ package.json не найден в $AdminPath" -ForegroundColor Red
    }
}

# Main execution
switch ($Action) {
    "start" { Start-AdminPanel }
    "stop" { Stop-AdminPanel }
    "restart" { 
        Stop-AdminPanel
        Start-Sleep 2
        Start-AdminPanel 
    }
    "status" { Show-AdminStatus }
    "install" { Install-AdminDeps }
}