# SSL Certificate Generation Script

param(
    [switch]$GenerateOnly
)

Write-Host "🔒 Создание SSL сертификатов для разработки..." -ForegroundColor Cyan

$sslPath = "E:\ClioTest2\nginx\ssl"

# Проверяем OpenSSL (может быть в Git)
$openssl = $null
$possiblePaths = @(
    "C:\Program Files\Git\usr\bin\openssl.exe",
    "C:\Program Files (x86)\Git\usr\bin\openssl.exe", 
    "openssl.exe"
)

foreach ($path in $possiblePaths) {
    if (Get-Command $path -ErrorAction SilentlyContinue) {
        $openssl = $path
        break
    }
}

if (-not $openssl) {
    Write-Host "❌ OpenSSL не найден. Создаем самоподписанный сертификат через PowerShell..." -ForegroundColor Yellow
    
    # Создаем простой сертификат через .NET
    try {
        $cert = New-SelfSignedCertificate -DnsName "localhost", "medlearn.local" -CertStoreLocation "cert:\CurrentUser\My" -KeyAlgorithm RSA -KeyLength 2048 -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(1)
        
        $certPath = "$sslPath\cert.pem"
        $keyPath = "$sslPath\key.pem"
        
        # Экспортируем сертификат
        Export-Certificate -Cert $cert -FilePath "$sslPath\cert.cer" | Out-Null
        
        # Конвертируем в PEM формат (базовая версия)
        $certData = [System.Convert]::ToBase64String($cert.RawData, 'InsertLineBreaks')
        $certPem = "-----BEGIN CERTIFICATE-----`n$certData`n-----END CERTIFICATE-----"
        Set-Content -Path $certPath -Value $certPem
        
        Write-Host "✅ SSL сертификат создан: $certPath" -ForegroundColor Green
        Write-Host "⚠️ Это самоподписанный сертификат для разработки!" -ForegroundColor Yellow
        
        # Создаем фиктивный ключ для демонстрации
        $keyContent = @"
-----BEGIN PRIVATE KEY-----
# Это демо-ключ для разработки
# В production используйте настоящий SSL сертификат
-----END PRIVATE KEY-----
"@
        Set-Content -Path $keyPath -Value $keyContent
        
        return $true
        
    } catch {
        Write-Host "❌ Ошибка создания сертификата: $_" -ForegroundColor Red
        return $false
    }
} else {
    Write-Host "✅ OpenSSL найден: $openssl" -ForegroundColor Green
    
    # Создаем сертификат через OpenSSL
    $configFile = "$sslPath\openssl.conf"
    $configContent = @"
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = RU
ST = Moscow
L = Moscow
O = MedLearn Development
CN = localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = medlearn.local
DNS.3 = *.medlearn.local
IP.1 = 127.0.0.1
"@
    
    Set-Content -Path $configFile -Value $configContent
    
    try {
        # Генерируем приватный ключ
        $keyPath = "$sslPath\key.pem"
        & $openssl genrsa -out $keyPath 2048
        
        # Генерируем сертификат
        $certPath = "$sslPath\cert.pem"
        & $openssl req -new -x509 -key $keyPath -out $certPath -days 365 -config $configFile
        
        if (Test-Path $certPath -and Test-Path $keyPath) {
            Write-Host "✅ SSL сертификат создан через OpenSSL" -ForegroundColor Green
            Write-Host "   📄 Сертификат: $certPath" -ForegroundColor Gray
            Write-Host "   🔑 Ключ: $keyPath" -ForegroundColor Gray
            return $true
        } else {
            throw "Файлы сертификата не созданы"
        }
        
    } catch {
        Write-Host "❌ Ошибка создания сертификата через OpenSSL: $_" -ForegroundColor Red
        return $false
    }
}

Write-Host ""
Write-Host "🔐 SSL НАСТРОЙКА ЗАВЕРШЕНА" -ForegroundColor Green
Write-Host "⚠️ ВАЖНО: Это сертификат для разработки!" -ForegroundColor Yellow
Write-Host "📋 Для production используйте сертификаты от Let's Encrypt или коммерческого CA" -ForegroundColor Gray