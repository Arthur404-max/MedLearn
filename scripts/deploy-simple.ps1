# Simple Production Component Management
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
    Write-Host "=== $Title ===" -ForegroundColor Cyan
    Write-Host ""
}

Set-Location $ProjectRoot

switch ($Component) {
    "check" {
        Show-Header "SYSTEM CHECK"
        
        # Redis
        try {
            wsl -d Ubuntu -- redis-cli ping | Out-Null
            Write-Host "Redis: OK" -ForegroundColor Green
        } catch {
            Write-Host "Redis: FAIL" -ForegroundColor Red
        }
        
        # PM2
        try {
            $pmOutput = pm2 list 2>$null
            if ($pmOutput -match "online") {
                Write-Host "PM2: OK" -ForegroundColor Green
            } else {
                Write-Host "PM2: FAIL" -ForegroundColor Red
            }
        } catch {
            Write-Host "PM2: FAIL" -ForegroundColor Red
        }
        
        # Nginx
        if (Get-Process nginx -ErrorAction SilentlyContinue) {
            Write-Host "Nginx: OK" -ForegroundColor Green
        } else {
            Write-Host "Nginx: STOPPED" -ForegroundColor Red
        }
        
        # CDN
        try {
            Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 3 | Out-Null
            Write-Host "CDN: OK" -ForegroundColor Green
        } catch {
            Write-Host "CDN: FAIL" -ForegroundColor Red
        }
        
        # Admin Panel
        try {
            Invoke-WebRequest -Uri "http://localhost:3002" -TimeoutSec 3 | Out-Null
            Write-Host "Admin Panel: OK" -ForegroundColor Green
        } catch {
            Write-Host "Admin Panel: FAIL" -ForegroundColor Red
        }
        
        # Main Server
        try {
            Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 3 | Out-Null
            Write-Host "Main Server: OK" -ForegroundColor Green
        } catch {
            Write-Host "Main Server: FAIL" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "PORTS:" -ForegroundColor Yellow
        Write-Host "  3000 - Main Server"
        Write-Host "  3002 - Admin Panel" 
        Write-Host "  8080 - CDN Server"
    }
    
    "redis" {
        Show-Header "REDIS"
        switch ($Action) {
            "start" { 
                Write-Host "Starting Redis..." -ForegroundColor Yellow
                wsl -d Ubuntu -- sudo service redis-server start
                Start-Sleep 2
                wsl -d Ubuntu -- redis-cli ping
            }
            "stop" { 
                Write-Host "Stopping Redis..." -ForegroundColor Yellow
                wsl -d Ubuntu -- sudo service redis-server stop
            }
            "status" { 
                Write-Host "Redis Status:" -ForegroundColor Yellow
                try {
                    $result = wsl -d Ubuntu -- redis-cli ping
                    Write-Host "Redis: $result" -ForegroundColor Green
                } catch {
                    Write-Host "Redis: Not Available" -ForegroundColor Red
                }
            }
        }
    }
    
    "pm2" {
        Show-Header "PM2"
        switch ($Action) {
            "start" { 
                Write-Host "Starting PM2 cluster..." -ForegroundColor Yellow
                npm run pm2:start
            }
            "stop" { 
                Write-Host "Stopping PM2..." -ForegroundColor Yellow
                pm2 stop all
                pm2 delete all
            }
            "status" { 
                Write-Host "PM2 Status:" -ForegroundColor Yellow
                pm2 list --no-color
            }
        }
    }
    
    "nginx" {
        Show-Header "NGINX"
        switch ($Action) {
            "start" { 
                Write-Host "Starting Nginx..." -ForegroundColor Yellow
                nginx
                Write-Host "Nginx started" -ForegroundColor Green
            }
            "stop" { 
                Write-Host "Stopping Nginx..." -ForegroundColor Yellow
                nginx -s quit
            }
            "status" { 
                Write-Host "Nginx Status:" -ForegroundColor Yellow
                if (Get-Process nginx -ErrorAction SilentlyContinue) {
                    Write-Host "Nginx: Running" -ForegroundColor Green
                } else {
                    Write-Host "Nginx: Stopped" -ForegroundColor Red
                }
            }
        }
    }
    
    "cdn" {
        Show-Header "CDN"
        switch ($Action) {
            "start" { 
                Write-Host "Starting CDN server..." -ForegroundColor Yellow
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\cdn'; node cdn-server.js"
                Start-Sleep 3
                try {
                    Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 3 | Out-Null
                    Write-Host "CDN started on port 8080" -ForegroundColor Green
                } catch {
                    Write-Host "CDN starting..." -ForegroundColor Yellow
                }
            }
            "stop" { 
                Write-Host "Stopping CDN..." -ForegroundColor Yellow
                $netstatOutput = netstat -ano | Select-String ":8080"
                if ($netstatOutput) {
                    foreach ($line in $netstatOutput) {
                        $parts = $line -split '\s+'
                        $processId = $parts[-1]
                        if ($processId -match '^\d+$') {
                            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                        }
                    }
                    Write-Host "CDN stopped" -ForegroundColor Green
                }
            }
            "status" { 
                Write-Host "CDN Status:" -ForegroundColor Yellow
                try {
                    Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 3 | Out-Null
                    Write-Host "CDN: Available on port 8080" -ForegroundColor Green
                } catch {
                    Write-Host "CDN: Not available" -ForegroundColor Red
                }
            }
        }
    }
    
    "admin" {
        Show-Header "ADMIN PANEL"
        switch ($Action) {
            "start" { 
                Write-Host "Starting admin panel..." -ForegroundColor Yellow
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\admin-panel'; node server.js"
                Start-Sleep 3
                try {
                    Invoke-WebRequest -Uri "http://localhost:3002" -TimeoutSec 3 | Out-Null
                    Write-Host "Admin panel started: http://localhost:3002" -ForegroundColor Green
                    Write-Host "Password: admin2024" -ForegroundColor Yellow
                } catch {
                    Write-Host "Admin panel starting..." -ForegroundColor Yellow
                }
            }
            "stop" { 
                Write-Host "Stopping admin panel..." -ForegroundColor Yellow
                $netstatOutput = netstat -ano | Select-String ":3002"
                if ($netstatOutput) {
                    foreach ($line in $netstatOutput) {
                        $parts = $line -split '\s+'
                        $processId = $parts[-1]
                        if ($processId -match '^\d+$') {
                            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                        }
                    }
                    Write-Host "Admin panel stopped" -ForegroundColor Green
                }
            }
            "status" { 
                Write-Host "Admin Panel Status:" -ForegroundColor Yellow
                try {
                    Invoke-WebRequest -Uri "http://localhost:3002" -TimeoutSec 3 | Out-Null
                    Write-Host "Admin Panel: Available at http://localhost:3002" -ForegroundColor Green
                } catch {
                    Write-Host "Admin Panel: Not available" -ForegroundColor Red
                }
            }
        }
    }
}