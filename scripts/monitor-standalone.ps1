# Скрипт для управления мониторингом отдельно от основной системы
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "dashboard", "logs", "status")]
    [string]$Action
)

$LOG_DIR = "E:\ClioTest2\logs"
$MONITOR_PID_FILE = "E:\ClioTest2\.monitor.pid"

function Test-MonitoringRunning {
    # Проверяем, запущен ли PM2
    try {
        pm2 status 2>$null | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Start-Monitoring {
    Write-Host "📊 Запуск системы мониторинга..." -ForegroundColor Cyan
    
    if (Test-MonitoringRunning) {
        Write-Host "⚠️ Мониторинг уже активен!" -ForegroundColor Yellow
        Show-MonitoringStatus
        return
    }
    
    Write-Host "🔍 Создание директории для логов..." -ForegroundColor Gray
    if (!(Test-Path $LOG_DIR)) {
        New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
    }
    
    Write-Host "🚀 Запуск PM2 процессов для мониторинга..." -ForegroundColor Gray
    
    # Создаем минимальную конфигурацию для мониторинга
    $monitorConfig = @{
        apps = @(
            @{
                name = "monitor-logger"
                script = "E:\ClioTest2\server.ts"
                interpreter = "ts-node"
                instances = 1
                exec_mode = "fork"
                env = @{
                    NODE_ENV = "development"
                    MONITOR_ONLY = "true"
                }
                log_file = "$LOG_DIR\monitor.log"
                error_file = "$LOG_DIR\monitor-error.log"
                out_file = "$LOG_DIR\monitor-out.log"
                merge_logs = $true
            }
        )
    } | ConvertTo-Json -Depth 3
    
    $configPath = "E:\ClioTest2\monitor.config.json"
    $monitorConfig | Out-File -FilePath $configPath -Encoding UTF8
    
    try {
        pm2 start $configPath
        Write-Host "✅ Мониторинг запущен!" -ForegroundColor Green
        Write-Host "📊 Dashboard: npm run monitor:dashboard" -ForegroundColor White
        Write-Host "📝 Логи: npm run monitor:logs" -ForegroundColor White
        
        # Сохраняем PID для отслеживания
        "monitor-active" | Out-File $MONITOR_PID_FILE -Encoding UTF8
        
    } catch {
        Write-Host "❌ Ошибка запуска мониторинга: $_" -ForegroundColor Red
    }
}

function Stop-Monitoring {
    Write-Host "🛑 Остановка мониторинга..." -ForegroundColor Cyan
    
    try {
        pm2 delete monitor-logger 2>$null
        Write-Host "✅ Процесс мониторинга остановлен" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Процесс мониторинга уже остановлен" -ForegroundColor Yellow
    }
    
    # Удаляем PID файл
    if (Test-Path $MONITOR_PID_FILE) {
        Remove-Item $MONITOR_PID_FILE -Force
    }
    
    # Удаляем временную конфигурацию
    $configPath = "E:\ClioTest2\monitor.config.json"
    if (Test-Path $configPath) {
        Remove-Item $configPath -Force
    }
    
    Write-Host "🏁 Мониторинг полностью остановлен" -ForegroundColor Green
}

function Show-Dashboard {
    Write-Host "🚀 Открытие PM2 Dashboard..." -ForegroundColor Cyan
    
    if (!(Test-MonitoringRunning)) {
        Write-Host "❌ Мониторинг не запущен. Запустите: npm run monitor:start" -ForegroundColor Red
        return
    }
    
    Write-Host "📊 Запуск интерактивного dashboard..." -ForegroundColor Green
    Write-Host "💡 Для выхода нажмите Ctrl+C" -ForegroundColor Gray
    pm2 monit
}

function Show-Logs {
    Write-Host "📝 Просмотр логов мониторинга..." -ForegroundColor Cyan
    
    if (!(Test-MonitoringRunning)) {
        Write-Host "❌ Мониторинг не запущен. Запустите: npm run monitor:start" -ForegroundColor Red
        return
    }
    
    Write-Host "📋 Доступные команды:" -ForegroundColor Yellow
    Write-Host "  - pm2 logs                 # Все логи" -ForegroundColor Gray
    Write-Host "  - pm2 logs monitor-logger  # Логи мониторинга" -ForegroundColor Gray
    Write-Host "  - pm2 logs --lines 50      # Последние 50 строк" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "🔄 Показ последних логов..." -ForegroundColor Green
    pm2 logs --lines 20
}

function Show-MonitoringStatus {
    Write-Host "📊 СТАТУС МОНИТОРИНГА" -ForegroundColor Magenta
    Write-Host "=" * 35 -ForegroundColor Gray
    
    if (Test-MonitoringRunning) {
        Write-Host "✅ PM2 Dashboard: АКТИВЕН" -ForegroundColor Green
        
        # Показываем статус процессов
        Write-Host "📈 Статус процессов:" -ForegroundColor Cyan
        pm2 status
        
        Write-Host ""
        Write-Host "📊 Доступные команды:" -ForegroundColor Yellow
        Write-Host "  - npm run monitor:dashboard  # Интерактивный dashboard" -ForegroundColor Gray
        Write-Host "  - npm run monitor:logs       # Просмотр логов" -ForegroundColor Gray
        Write-Host "  - pm2 monit                  # Прямой запуск dashboard" -ForegroundColor Gray
        Write-Host "  - pm2 logs                   # Прямой просмотр логов" -ForegroundColor Gray
        
        # Проверяем логи
        if (Test-Path $LOG_DIR) {
            $logFiles = Get-ChildItem $LOG_DIR -Filter "*.log" | Measure-Object
            Write-Host "📁 Файлов логов: $($logFiles.Count)" -ForegroundColor White
        }
        
    } else {
        Write-Host "❌ Статус: ОСТАНОВЛЕН" -ForegroundColor Red
        Write-Host "💡 Запуск: npm run monitor:start" -ForegroundColor Gray
        
        # Проверяем наличие основной системы
        try {
            $mainProcesses = pm2 status 2>$null
            if ($mainProcesses -match "medlearn") {
                Write-Host "ℹ️ Основная система запущена - можно включить мониторинг" -ForegroundColor Blue
            } else {
                Write-Host "⚠️ Основная система не запущена" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⚠️ PM2 не установлен или не запущен" -ForegroundColor Yellow
        }
    }
    
    Write-Host "=" * 35 -ForegroundColor Gray
}

function Show-QuickStats {
    Write-Host "⚡ БЫСТРАЯ СТАТИСТИКА" -ForegroundColor Magenta
    Write-Host "=" * 25 -ForegroundColor Gray
    
    # Системная информация
    $memory = Get-WmiObject -Class Win32_OperatingSystem
    $memoryUsed = [math]::Round(($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / $memory.TotalVisibleMemorySize * 100, 2)
    Write-Host "💾 Использование RAM: $memoryUsed%" -ForegroundColor $(if($memoryUsed -gt 80) {"Red"} elseif($memoryUsed -gt 60) {"Yellow"} else {"Green"})
    
    # PM2 процессы
    if (Test-MonitoringRunning) {
        try {
            $pm2List = pm2 jlist | ConvertFrom-Json
            $runningProcesses = ($pm2List | Where-Object { $_.pm2_env.status -eq "online" }).Count
            Write-Host "🔄 Активных процессов PM2: $runningProcesses" -ForegroundColor Green
        } catch {
            Write-Host "🔄 PM2 процессы: Недоступно" -ForegroundColor Gray
        }
    }
    
    # Порты
    $ports = @(3000, 3002, 8080)
    foreach ($port in $ports) {
        $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet
        $status = if ($connection) { "🟢 Активен" } else { "🔴 Закрыт" }
        Write-Host "Port $port`: $status" -ForegroundColor $(if($connection) {"Green"} else {"Red"})
    }
    
    Write-Host "=" * 25 -ForegroundColor Gray
}

# Выполняем действие
switch ($Action) {
    "start" { 
        Start-Monitoring 
        Show-QuickStats
    }
    "stop" { Stop-Monitoring }
    "dashboard" { Show-Dashboard }
    "logs" { Show-Logs }
    "status" { 
        Show-MonitoringStatus
        Show-QuickStats 
    }
}