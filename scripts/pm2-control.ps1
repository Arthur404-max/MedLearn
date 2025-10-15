# PM2 Management Script

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "reload", "status", "logs", "monit", "delete", "scale")]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [int]$Instances = 0
)

switch ($Action) {
    "start" {
        Write-Host "🚀 Запуск PM2 кластера..." -ForegroundColor Green
        npm run pm2:start
    }
    "stop" {
        Write-Host "🛑 Остановка PM2 кластера..." -ForegroundColor Yellow
        npm run pm2:stop
    }
    "restart" {
        Write-Host "🔄 Перезапуск PM2 кластера..." -ForegroundColor Blue
        npm run pm2:restart
    }
    "reload" {
        Write-Host "♻️ Горячая перезагрузка PM2 кластера (без даунтайма)..." -ForegroundColor Cyan
        npm run pm2:reload
    }
    "status" {
        Write-Host "📊 Статус PM2 процессов:" -ForegroundColor Cyan
        pm2 status
    }
    "logs" {
        Write-Host "📋 Логи PM2:" -ForegroundColor Magenta
        pm2 logs --lines 50
    }
    "monit" {
        Write-Host "📈 Запуск PM2 монитора..." -ForegroundColor Green
        pm2 monit
    }
    "delete" {
        Write-Host "🗑️ ВНИМАНИЕ: Удаление всех PM2 процессов!" -ForegroundColor Red
        $confirm = Read-Host "Вы уверены? (y/N)"
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            npm run pm2:delete
            Write-Host "✅ PM2 процессы удалены" -ForegroundColor Green
        } else {
            Write-Host "❌ Операция отменена" -ForegroundColor Yellow
        }
    }
    "scale" {
        if ($Instances -le 0) {
            Write-Host "❌ Укажите количество экземпляров: -Instances N" -ForegroundColor Red
            return
        }
        Write-Host "⚖️ Масштабирование до $Instances экземпляров..." -ForegroundColor Blue
        pm2 scale medlearn-api $Instances
    }
}

# Показать статус после операции (кроме logs и monit)
if ($Action -notin @("logs", "monit", "delete")) {
    Write-Host "`n📊 Текущий статус:" -ForegroundColor Gray
    pm2 list
}