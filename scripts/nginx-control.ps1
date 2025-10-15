# Nginx Management Script

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "reload", "status", "test", "logs")]
    [string]$Action
)

$NginxPath = "E:\ClioTest2\nginx\nginx-1.24.0"
$NginxExe = "$NginxPath\nginx.exe"
$ConfigPath = "$NginxPath\conf\nginx.conf"

function Test-NginxInstalled {
    return Test-Path $NginxExe
}

function Start-Nginx {
    if (-not (Test-NginxInstalled)) {
        Write-Host "ERROR: Nginx not found at: $NginxExe" -ForegroundColor Red
        Write-Host "Please download nginx and extract to $NginxPath" -ForegroundColor Yellow
        return $false
    }

    $process = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "WARNING: Nginx is already running (PID: $($process[0].Id))" -ForegroundColor Yellow
        return $true
    }

    try {
        Write-Host "Starting Nginx..." -ForegroundColor Green
        Set-Location $NginxPath
        Start-Process -FilePath $NginxExe -WorkingDirectory $NginxPath -WindowStyle Hidden
        Start-Sleep 2
        
        $process = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "SUCCESS: Nginx started (PID: $($process[0].Id))" -ForegroundColor Green
            Write-Host "Load Balancer available at http://localhost" -ForegroundColor Cyan
            return $true
        } else {
            Write-Host "ERROR: Failed to start Nginx" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "ERROR: Failed to start Nginx: $_" -ForegroundColor Red
        return $false
    }
}

function Stop-Nginx {
    $process = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
    if (-not $process) {
        Write-Host "WARNING: Nginx is not running" -ForegroundColor Yellow
        return $true
    }

    try {
        Write-Host "Stopping Nginx..." -ForegroundColor Yellow
        Set-Location $NginxPath
        & $NginxExe -s quit
        Start-Sleep 2
        
        $process = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
        if (-not $process) {
            Write-Host "SUCCESS: Nginx stopped" -ForegroundColor Green
            return $true
        } else {
            Write-Host "Force stopping..." -ForegroundColor Yellow
            Stop-Process -Name "nginx" -Force
            Write-Host "SUCCESS: Nginx force stopped" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "ERROR: Failed to stop Nginx: $_" -ForegroundColor Red
        return $false
    }
}

function Restart-Nginx {
    if (-not (Test-NginxInstalled)) {
        Write-Host "ERROR: Nginx not installed" -ForegroundColor Red
        return $false
    }

    $process = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
    if (-not $process) {
        Write-Host "WARNING: Nginx not running. Starting..." -ForegroundColor Yellow
        return Start-Nginx
    }

    try {
        Write-Host "Reloading Nginx configuration..." -ForegroundColor Blue
        Set-Location $NginxPath
        & $NginxExe -s reload
        Write-Host "SUCCESS: Configuration reloaded" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "ERROR: Failed to reload: $_" -ForegroundColor Red
        return $false
    }
}

function Test-NginxConfig {
    if (-not (Test-NginxInstalled)) {
        Write-Host "ERROR: Nginx not installed" -ForegroundColor Red
        return $false
    }

    try {
        Write-Host "Testing Nginx configuration..." -ForegroundColor Cyan
        Set-Location $NginxPath
        $output = & $NginxExe -t 2>&1
        Write-Host $output
        Write-Host "SUCCESS: Configuration is valid" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "ERROR: Configuration test failed: $_" -ForegroundColor Red
        return $false
    }
}

function Show-NginxStatus {
    Write-Host "Nginx Status:" -ForegroundColor Cyan
    
    if (-not (Test-NginxInstalled)) {
        Write-Host "ERROR: Nginx not installed at $NginxPath" -ForegroundColor Red
        return
    }

    $process = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "SUCCESS: Nginx is running" -ForegroundColor Green
        Write-Host "   PID: $($process[0].Id)" -ForegroundColor Gray
        Write-Host "   Memory: $([math]::Round($process[0].WorkingSet64 / 1MB, 2)) MB" -ForegroundColor Gray
        Write-Host "   Uptime: $((Get-Date) - $process[0].StartTime)" -ForegroundColor Gray
        
        Write-Host "`nAvailable endpoints:" -ForegroundColor Cyan
        Write-Host "   Load Balancer: http://localhost" -ForegroundColor White
        Write-Host "   Nginx Status: http://localhost/nginx_status" -ForegroundColor White
        Write-Host "   API Health: http://localhost/api/health" -ForegroundColor White
    } else {
        Write-Host "ERROR: Nginx is not running" -ForegroundColor Red
    }
}

function Show-NginxLogs {
    $accessLog = "$NginxPath\logs\access.log"
    $errorLog = "$NginxPath\logs\error.log"
    
    Write-Host "Nginx Logs:" -ForegroundColor Cyan
    
    if (Test-Path $errorLog) {
        Write-Host "`nRecent errors:" -ForegroundColor Red
        Get-Content $errorLog -Tail 10 | ForEach-Object { 
            Write-Host "   $_" -ForegroundColor Gray 
        }
    }
    
    if (Test-Path $accessLog) {
        Write-Host "`nRecent requests:" -ForegroundColor Green
        Get-Content $accessLog -Tail 10 | ForEach-Object { 
            Write-Host "   $_" -ForegroundColor Gray 
        }
    }
}

# Main execution
switch ($Action) {
    "start" { Start-Nginx }
    "stop" { Stop-Nginx }
    "restart" { 
        Stop-Nginx
        Start-Sleep 1
        Start-Nginx 
    }
    "reload" { Restart-Nginx }
    "status" { Show-NginxStatus }
    "test" { Test-NginxConfig }
    "logs" { Show-NginxLogs }
}