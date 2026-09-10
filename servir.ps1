# Arranca el servidor local del dashboard y abre el navegador.
# Uso:  .\servir.ps1            (puerto 8765 por defecto)
#       .\servir.ps1 -Port 9000
param([int]$Port = 8765)

$root = $PSScriptRoot
if (-not (Test-Path (Join-Path $root 'web\index.html'))) {
    Write-Error "No encuentro web\index.html junto a este script."
    exit 1
}

$ocupado = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($ocupado) {
    Write-Host "El puerto $Port ya está en uso; abro el navegador directamente." -ForegroundColor Yellow
} else {
    Write-Host "Sirviendo $root\web en http://127.0.0.1:$Port/ ..." -ForegroundColor Cyan
    $job = Start-Job -ScriptBlock {
        param($r, $p)
        python -m http.server $p --bind 127.0.0.1 --directory (Join-Path $r 'web')
    } -ArgumentList $root, $Port
    Start-Sleep -Seconds 2
}

Start-Process "http://127.0.0.1:$Port/"
Write-Host "Dashboard abierto. Pulsa Ctrl+C en esta ventana para parar el servidor." -ForegroundColor Green
try { Wait-Job $job | Out-Null } catch { }
