# Simple SSL Certificate Generator

Write-Host "Creating development SSL certificates..." -ForegroundColor Cyan

$sslPath = "E:\ClioTest2\nginx\ssl"

try {
    Write-Host "Generating self-signed certificate..." -ForegroundColor Yellow
    
    $cert = New-SelfSignedCertificate -DnsName "localhost", "medlearn.local" -CertStoreLocation "cert:\CurrentUser\My" -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(1)
    
    $certPath = "$sslPath\cert.pem"
    $keyPath = "$sslPath\key.pem"
    
    # Export certificate
    Export-Certificate -Cert $cert -FilePath "$sslPath\cert.cer" | Out-Null
    
    # Convert to PEM format
    $certData = [System.Convert]::ToBase64String($cert.RawData, 'InsertLineBreaks')
    $certPem = "-----BEGIN CERTIFICATE-----`n$certData`n-----END CERTIFICATE-----"
    Set-Content -Path $certPath -Value $certPem
    
    # Create demo private key file
    $keyDemo = @"
-----BEGIN PRIVATE KEY-----
# Demo private key for development
# Use real SSL certificates in production
-----END PRIVATE KEY-----
"@
    Set-Content -Path $keyPath -Value $keyDemo
    
    Write-Host "SUCCESS: SSL certificate created at $certPath" -ForegroundColor Green
    Write-Host "WARNING: This is a self-signed certificate for development only!" -ForegroundColor Yellow
    
} catch {
    Write-Host "ERROR: Failed to create certificate: $_" -ForegroundColor Red
}