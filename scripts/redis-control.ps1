# Redis Control Script для WSL2

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "status", "logs", "connect", "flush")]
    [string]$Action
)

switch ($Action) {
    "start" {
        Write-Host "🚀 Запуск Redis сервера..." -ForegroundColor Green
        wsl -d Ubuntu -- sudo systemctl start redis-server
        Write-Host "✅ Redis запущен" -ForegroundColor Green
    }
    "stop" {
        Write-Host "🛑 Остановка Redis сервера..." -ForegroundColor Yellow
        wsl -d Ubuntu -- sudo systemctl stop redis-server
        Write-Host "✅ Redis остановлен" -ForegroundColor Yellow
    }
    "restart" {
        Write-Host "🔄 Перезапуск Redis сервера..." -ForegroundColor Blue
        wsl -d Ubuntu -- sudo systemctl restart redis-server
        Write-Host "✅ Redis перезапущен" -ForegroundColor Green
    }
    "status" {
        Write-Host "📊 Статус Redis сервера:" -ForegroundColor Cyan
        wsl -d Ubuntu -- sudo systemctl status redis-server --no-pager
    }
    "logs" {
        Write-Host "📋 Логи Redis сервера:" -ForegroundColor Cyan
        wsl -d Ubuntu -- sudo journalctl -u redis-server --no-pager -n 50
    }
    "connect" {
        Write-Host "🔗 Подключение к Redis CLI..." -ForegroundColor Magenta
        Write-Host "Для выхода введите 'quit'" -ForegroundColor Gray
        wsl -d Ubuntu -- redis-cli
    }
    "flush" {
        Write-Host "🗑️ ВНИМАНИЕ: Очистка всех данных Redis!" -ForegroundColor Red
        $confirm = Read-Host "Вы уверены? (y/N)"
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            wsl -d Ubuntu -- redis-cli flushall
            Write-Host "✅ Redis очищен" -ForegroundColor Green
        } else {
            Write-Host "❌ Операция отменена" -ForegroundColor Yellow
        }
    }
}