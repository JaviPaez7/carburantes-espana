# Publica el dashboard en GitHub Pages.
#   - Copia web/ en docs/ (GitHub Pages sirve desde /docs de la rama main)
#   - Hace commit y push de todo el proyecto
# Uso:  .\publicar.ps1                      (mensaje de commit por defecto)
#       .\publicar.ps1 -Mensaje "otra cosa"
param(
    [string]$Mensaje = "Actualiza el dashboard publicado"
)

$root = $PSScriptRoot
$src  = Join-Path $root 'web'
$dst  = Join-Path $root 'docs'
$repo = 'https://github.com/JaviPaez7/carburantes-espana'
$site = 'https://javipaez7.github.io/carburantes-espana/'

if (-not (Test-Path (Join-Path $src 'index.html'))) { Write-Error "No encuentro web\index.html"; exit 1 }

Write-Host "Sincronizando web\ -> docs\ ..." -ForegroundColor Cyan
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
Copy-Item $src $dst -Recurse

Set-Location $root
git add -A
$cambios = git status --porcelain
if (-not $cambios) { Write-Host "Sin cambios que publicar." -ForegroundColor Yellow; exit 0 }
git commit -m $Mensaje | Out-Host
git push | Out-Host

if ($LASTEXITCODE -ne 0) { Write-Error "El push ha fallado"; exit 1 }
Write-Host "Publicado. GitHub Pages tarda ~1 minuto en refrescar: $site" -ForegroundColor Green
Write-Host "Repositorio: $repo" -ForegroundColor DarkGray
