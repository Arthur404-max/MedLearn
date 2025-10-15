param(# Скрипт для управления админ панелью отдельно от основной системы

    [Parameter(Mandatory=$true)]param(

    [ValidateSet("start", "stop", "status")]    [Parameter(Mandatory=$true)]

    [string]$Action    [ValidateSet("start", "stop", "status", "restart")]

)    [string]$Action

)

$ADMIN_DIR = "E:\ClioTest2\admin-panel"

$ADMIN_PID_FILE = "$ADMIN_DIR\.admin.pid"$ADMIN_DIR = "E:\ClioTest2\admin-panel"

$ADMIN_PORT = 3002$ADMIN_PID_FILE = "$ADMIN_DIR\.admin.pid"

$ADMIN_PORT = 3002

function Test-AdminRunning {

    if (Test-Path $ADMIN_PID_FILE) {function Test-AdminRunning {

        $processId = Get-Content $ADMIN_PID_FILE -ErrorAction SilentlyContinue    if (Test-Path $ADMIN_PID_FILE) {

        if ($processId -and (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {        $processId = Get-Content $ADMIN_PID_FILE -ErrorAction SilentlyContinue

            return $true        if ($processId -and (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {

        }            return $true

        Remove-Item $ADMIN_PID_FILE -Force -ErrorAction SilentlyContinue        } else {

    }            Remove-Item $ADMIN_PID_FILE -Force -ErrorAction SilentlyContinue

    return $false            return $false

}        }

    }

function Start-AdminPanel {    return $false

    Write-Host "🚀 Запуск админ панели..." -ForegroundColor Cyan}

    

    if (Test-AdminRunning) {function Start-AdminPanel {

        Write-Host "⚠️ Админ панель уже запущена!" -ForegroundColor Yellow    Write-Host "🚀 Запуск админ панели..." -ForegroundColor Cyan

        return    

    }    if (Test-AdminRunning) {

            Write-Host "⚠️ Админ панель уже запущена!" -ForegroundColor Yellow

    Push-Location $ADMIN_DIR        return

    $process = Start-Process powershell -ArgumentList "-NoExit", "-Command", "node server.js" -PassThru -WindowStyle Normal    }

    $process.Id | Out-File $ADMIN_PID_FILE -Encoding UTF8    

    Pop-Location    # Проверяем, что основной сервер запущен

        try {

    Start-Sleep -Seconds 3        Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5 -ErrorAction Stop | Out-Null

            Write-Host "✅ Основной сервер доступен" -ForegroundColor Green

    try {    } catch {

        Invoke-WebRequest -Uri "http://localhost:$ADMIN_PORT" -TimeoutSec 5 | Out-Null        Write-Host "⚠️ Предупреждение: Основной сервер недоступен. Админ панель может работать некорректно." -ForegroundColor Yellow

        Write-Host "✅ Админ панель запущена!" -ForegroundColor Green        Write-Host "   Для полной функциональности запустите основной сервер: npm run pm2:start" -ForegroundColor Gray

        Write-Host "📱 URL: http://localhost:$ADMIN_PORT" -ForegroundColor White    }

        Write-Host "🔐 Пароль: admin2024" -ForegroundColor Yellow    

    } catch {    # Запускаем админ панель

        Write-Host "❌ Ошибка запуска админ панели" -ForegroundColor Red    Push-Location $ADMIN_DIR

    }    try {

}        $process = Start-Process powershell -ArgumentList "-NoExit", "-Command", "node server.js" -PassThru -WindowStyle Normal

        $process.Id | Out-File $ADMIN_PID_FILE -Encoding UTF8

function Stop-AdminPanel {        

    Write-Host "🛑 Остановка админ панели..." -ForegroundColor Cyan        # Ждем запуска

            Start-Sleep -Seconds 3

    if (Test-Path $ADMIN_PID_FILE) {        

        $processId = Get-Content $ADMIN_PID_FILE -ErrorAction SilentlyContinue        # Проверяем запуск

        if ($processId) {        try {

            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue            Invoke-WebRequest -Uri "http://localhost:$ADMIN_PORT" -TimeoutSec 5 | Out-Null

            Write-Host "✅ Админ панель остановлена" -ForegroundColor Green            Write-Host "✅ Админ панель успешно запущена!" -ForegroundColor Green

        }            Write-Host "📱 URL: http://localhost:$ADMIN_PORT" -ForegroundColor White

        Remove-Item $ADMIN_PID_FILE -Force -ErrorAction SilentlyContinue            Write-Host "🔐 Пароль: admin2024" -ForegroundColor Yellow

    }            Write-Host "📊 PID: $($process.Id)" -ForegroundColor Gray

            } catch {

    # Очистка процессов на порту 3002            Write-Host "❌ Ошибка при запуске админ панели" -ForegroundColor Red

    $netstatOutput = netstat -ano | Select-String ":3002"            Stop-AdminPanel

    if ($netstatOutput) {        }

        foreach ($line in $netstatOutput) {    } catch {

            $parts = $line -split '\s+'        Write-Host "❌ Не удалось запустить админ панель: $_" -ForegroundColor Red

            $processId = $parts[-1]    } finally {

            if ($processId -match '^\d+$') {        Pop-Location

                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue    }

            }}

        }

    }function Stop-AdminPanel {

}    Write-Host "🛑 Остановка админ панели..." -ForegroundColor Cyan

    

function Get-AdminStatus {    if (Test-Path $ADMIN_PID_FILE) {

    Write-Host "📊 СТАТУС АДМИН ПАНЕЛИ" -ForegroundColor Magenta        $processId = Get-Content $ADMIN_PID_FILE -ErrorAction SilentlyContinue

    Write-Host "=" * 30 -ForegroundColor Gray        if ($processId) {

                try {

    if (Test-AdminRunning) {                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue

        $processId = Get-Content $ADMIN_PID_FILE                Write-Host "✅ Админ панель остановлена (PID: $processId)" -ForegroundColor Green

        Write-Host "✅ Статус: ЗАПУЩЕНА" -ForegroundColor Green            } catch {

        Write-Host "📊 PID: $processId" -ForegroundColor White                Write-Host "⚠️ Процесс уже завершен" -ForegroundColor Yellow

        Write-Host "📱 URL: http://localhost:$ADMIN_PORT" -ForegroundColor White            }

        Write-Host "🔐 Пароль: admin2024" -ForegroundColor Yellow        }

                Remove-Item $ADMIN_PID_FILE -Force -ErrorAction SilentlyContinue

        try {    }

            Invoke-WebRequest -Uri "http://localhost:$ADMIN_PORT" -TimeoutSec 3 | Out-Null    

            Write-Host "🌐 Доступность: ДОСТУПНА" -ForegroundColor Green    # Дополнительная очистка - убиваем все node.js процессы на порту 3002

        } catch {    $netstatOutput = netstat -ano | Select-String ":3002"

            Write-Host "🌐 Доступность: НЕДОСТУПНА" -ForegroundColor Red    if ($netstatOutput) {

        }        foreach ($line in $netstatOutput) {

    } else {            $parts = $line -split '\s+'

        Write-Host "❌ Статус: ОСТАНОВЛЕНА" -ForegroundColor Red            $processId = $parts[-1]

        Write-Host "💡 Запуск: npm run admin:start" -ForegroundColor Gray            if ($processId -match '^\d+$') {

    }                try {

                        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue

    Write-Host "=" * 30 -ForegroundColor Gray                    Write-Host "🧹 Очищен процесс на порту 3002 (PID: $processId)" -ForegroundColor Gray

}                } catch {}

            }

switch ($Action) {        }

    "start" { Start-AdminPanel }    }

    "stop" { Stop-AdminPanel }    

    "status" { Get-AdminStatus }    Write-Host "🏁 Админ панель полностью остановлена" -ForegroundColor Green

}}

function Get-AdminStatus {
    Write-Host "📊 СТАТУС АДМИН ПАНЕЛИ" -ForegroundColor Magenta
    Write-Host "=" * 30 -ForegroundColor Gray
    
    if (Test-AdminRunning) {
        $processId = Get-Content $ADMIN_PID_FILE
        Write-Host "✅ Статус: ЗАПУЩЕНА" -ForegroundColor Green
        Write-Host "📊 PID: $processId" -ForegroundColor White
        Write-Host "📱 URL: http://localhost:$ADMIN_PORT" -ForegroundColor White
        Write-Host "🔐 Пароль: admin2024" -ForegroundColor Yellow
        
        # Проверяем доступность
        try {
            Invoke-WebRequest -Uri "http://localhost:$ADMIN_PORT" -TimeoutSec 3 | Out-Null
            Write-Host "🌐 Доступность: ДОСТУПНА" -ForegroundColor Green
        } catch {
            Write-Host "🌐 Доступность: НЕДОСТУПНА" -ForegroundColor Red
        }
        
        # Проверяем основной сервер
        try {
            Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 3 | Out-Null
            Write-Host "🔗 Основной сервер: ПОДКЛЮЧЕН" -ForegroundColor Green
        } catch {
            Write-Host "🔗 Основной сервер: НЕ ПОДКЛЮЧЕН" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Статус: ОСТАНОВЛЕНА" -ForegroundColor Red
        Write-Host "💡 Запуск: npm run admin:start" -ForegroundColor Gray
    }
    
    Write-Host "=" * 30 -ForegroundColor Gray
}

function Restart-AdminPanel {
    Write-Host "🔄 Перезапуск админ панели..." -ForegroundColor Cyan
    Stop-AdminPanel
    Start-Sleep -Seconds 2
    Start-AdminPanel
}

# Выполняем действие
switch ($Action) {
    "start" { Start-AdminPanel }
    "stop" { Stop-AdminPanel }
    "status" { Get-AdminStatus }
    "restart" { Restart-AdminPanel }
}