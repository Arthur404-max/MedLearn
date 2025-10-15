# CDN Management Script

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "status", "purge", "stats")]
    [string]$Action
)

$CdnPath = "E:\ClioTest2\nginx\nginx-1.24.0"
$CdnExe = "$CdnPath\nginx.exe"
$CdnConfig = "E:\ClioTest2\cdn\nginx-cdn.conf"
$CdnPort = 8080

function Test-CdnSetup {
    $nginxExists = Test-Path $CdnExe
    $configExists = Test-Path $CdnConfig
    
    if (-not $nginxExists) {
        Write-Host "ERROR: Nginx not found at $CdnExe" -ForegroundColor Red
        return $false
    }
    
    if (-not $configExists) {
        Write-Host "ERROR: CDN config not found at $CdnConfig" -ForegroundColor Red
        return $false
    }
    
    return $true
}

function Start-CdnServer {
    if (-not (Test-CdnSetup)) {
        return $false
    }

    # Check if CDN is already running
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$CdnPort/cdn/health" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "WARNING: CDN is already running on port $CdnPort" -ForegroundColor Yellow
        return $true
    } catch {
        # CDN not running, continue to start
    }

    try {
        Write-Host "Starting CDN Server on port $CdnPort..." -ForegroundColor Green
        
        # Create cache directories if they don't exist
        $cacheDir = "E:\ClioTest2\cdn\cache"
        if (-not (Test-Path $cacheDir)) {
            New-Item -Path $cacheDir -ItemType Directory -Force | Out-Null
        }
        
        # Start nginx with CDN config
        Set-Location $CdnPath
        $process = Start-Process -FilePath $CdnExe -ArgumentList "-c", $CdnConfig -WorkingDirectory $CdnPath -WindowStyle Hidden -PassThru
        
        Start-Sleep 3
        
        # Verify CDN is running
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$CdnPort/cdn/health" -TimeoutSec 5
            $healthData = $response.Content | ConvertFrom-Json
            
            Write-Host "SUCCESS: CDN Server started" -ForegroundColor Green
            Write-Host "   Port: $CdnPort" -ForegroundColor Gray
            Write-Host "   PID: $($process.Id)" -ForegroundColor Gray
            Write-Host "   Status: $($healthData.status)" -ForegroundColor Gray
            Write-Host "   Cache Zones: $($healthData.cache_zones -join ', ')" -ForegroundColor Gray
            
            return $true
        } catch {
            Write-Host "ERROR: CDN failed to start properly" -ForegroundColor Red
            return $false
        }
        
    } catch {
        Write-Host "ERROR: Failed to start CDN: $_" -ForegroundColor Red
        return $false
    }
}

function Stop-CdnServer {
    try {
        # Try to get CDN process by port
        $processes = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
        $cdnProcess = $null
        
        foreach ($proc in $processes) {
            try {
                $connections = netstat -ano | Select-String ":$CdnPort "
                if ($connections -and $connections -match $proc.Id) {
                    $cdnProcess = $proc
                    break
                }
            } catch {
                # Continue searching
            }
        }
        
        if ($cdnProcess) {
            Write-Host "Stopping CDN Server (PID: $($cdnProcess.Id))..." -ForegroundColor Yellow
            
            # Try graceful shutdown first
            Set-Location $CdnPath
            & $CdnExe -c $CdnConfig -s quit
            
            Start-Sleep 2
            
            # Check if still running
            $stillRunning = Get-Process -Id $cdnProcess.Id -ErrorAction SilentlyContinue
            if ($stillRunning) {
                Write-Host "Force stopping CDN..." -ForegroundColor Yellow
                Stop-Process -Id $cdnProcess.Id -Force
            }
            
            Write-Host "SUCCESS: CDN Server stopped" -ForegroundColor Green
            return $true
        } else {
            Write-Host "WARNING: CDN Server is not running" -ForegroundColor Yellow
            return $true
        }
        
    } catch {
        Write-Host "ERROR: Failed to stop CDN: $_" -ForegroundColor Red
        return $false
    }
}

function Show-CdnStatus {
    Write-Host "CDN Server Status:" -ForegroundColor Cyan
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$CdnPort/cdn/health" -TimeoutSec 5
        $healthData = $response.Content | ConvertFrom-Json
        
        Write-Host "SUCCESS: CDN is running" -ForegroundColor Green
        Write-Host "   Port: $CdnPort" -ForegroundColor Gray
        Write-Host "   Status: $($healthData.status)" -ForegroundColor Gray
        Write-Host "   Cache Zones: $($healthData.cache_zones -join ', ')" -ForegroundColor Gray
        
        Write-Host "`nCDN Endpoints:" -ForegroundColor Cyan
        Write-Host "   Health: http://localhost:$CdnPort/cdn/health" -ForegroundColor White
        Write-Host "   Static Assets: http://localhost:$CdnPort/*.{js,css,png,etc}" -ForegroundColor White
        Write-Host "   API Cache: http://localhost:$CdnPort/api/*" -ForegroundColor White
        Write-Host "   Cache Purge: http://localhost:$CdnPort/cdn/purge" -ForegroundColor White
        
    } catch {
        Write-Host "ERROR: CDN is not running or not responding" -ForegroundColor Red
        Write-Host "   Expected port: $CdnPort" -ForegroundColor Gray
        Write-Host "   Config file: $CdnConfig" -ForegroundColor Gray
    }
}

function Clear-CdnCache {
    Write-Host "Purging CDN cache..." -ForegroundColor Yellow
    
    try {
        # Clear cache directories
        $cacheDir = "E:\ClioTest2\cdn\cache"
        if (Test-Path $cacheDir) {
            Remove-Item "$cacheDir\*" -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "SUCCESS: Local cache cleared" -ForegroundColor Green
        }
        
        # Try to purge via API if CDN is running
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$CdnPort/cdn/purge" -Method POST -TimeoutSec 5
            Write-Host "SUCCESS: CDN cache purged via API" -ForegroundColor Green
        } catch {
            Write-Host "WARNING: Could not purge via API (CDN may not be running)" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "ERROR: Failed to purge cache: $_" -ForegroundColor Red
    }
}

function Show-CdnStats {
    Write-Host "CDN Statistics:" -ForegroundColor Cyan
    
    # Cache directory stats
    $cacheDir = "E:\ClioTest2\cdn\cache"
    if (Test-Path $cacheDir) {
        $cacheFiles = Get-ChildItem $cacheDir -Recurse -File -ErrorAction SilentlyContinue
        $totalSize = ($cacheFiles | Measure-Object -Property Length -Sum).Sum
        
        Write-Host "`nCache Storage:" -ForegroundColor Yellow
        Write-Host "   Files: $($cacheFiles.Count)" -ForegroundColor Gray
        Write-Host "   Size: $([math]::Round($totalSize / 1MB, 2)) MB" -ForegroundColor Gray
        Write-Host "   Directory: $cacheDir" -ForegroundColor Gray
    }
    
    # Log stats
    $logDir = "E:\ClioTest2\cdn\logs"
    if (Test-Path $logDir) {
        $accessLog = "$logDir\cdn_access.log"
        $errorLog = "$logDir\cdn_error.log"
        
        Write-Host "`nLog Files:" -ForegroundColor Yellow
        
        if (Test-Path $accessLog) {
            $accessLines = (Get-Content $accessLog -ErrorAction SilentlyContinue).Count
            Write-Host "   Access Log: $accessLines requests" -ForegroundColor Gray
        }
        
        if (Test-Path $errorLog) {
            $errorLines = (Get-Content $errorLog -ErrorAction SilentlyContinue).Count
            Write-Host "   Error Log: $errorLines errors" -ForegroundColor Gray
        }
    }
    
    # Recent performance test
    Write-Host "`nPerformance Test:" -ForegroundColor Yellow
    try {
        $startTime = Get-Date
        $response = Invoke-WebRequest -Uri "http://localhost:$CdnPort/cdn/health" -TimeoutSec 10
        $endTime = Get-Date
        $responseTime = ($endTime - $startTime).TotalMilliseconds
        
        Write-Host "   Response Time: $([math]::Round($responseTime, 2))ms" -ForegroundColor Gray
        Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
        
    } catch {
        Write-Host "   Status: Offline" -ForegroundColor Red
    }
}

# Main execution
switch ($Action) {
    "start" { Start-CdnServer }
    "stop" { Stop-CdnServer }
    "restart" { 
        Stop-CdnServer
        Start-Sleep 2
        Start-CdnServer 
    }
    "status" { Show-CdnStatus }
    "purge" { Clear-CdnCache }
    "stats" { Show-CdnStats }
}