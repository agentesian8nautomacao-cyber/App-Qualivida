# Reinstala dependencias: renomeia node_modules para um nome unico e roda npm install + build.
# Feche o Cursor e todos os terminais antes. Execute no PowerShell:
#   cd D:\GestaoQualividaResidence
#   .\scripts\reinstall-deps.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot | Split-Path -Parent
Set-Location $root

$nm = "node_modules"

# Nome que NAO conflita com nada (nao usa node_modules.bak)
$oldName = "node_modules.OLD." + (Get-Date -Format "yyyyMMddHHmmss")

if (-not (Test-Path $nm)) {
    Write-Host "Pasta node_modules nao encontrada. Rodando npm install..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
    exit $LASTEXITCODE
}

Write-Host "Renomeando node_modules -> $oldName ..." -ForegroundColor Cyan
try {
    Rename-Item -Path $nm -NewName $oldName -ErrorAction Stop
} catch {
    Write-Host "ERRO ao renomear. Feche Cursor, feche todos os terminais e tente de novo." -ForegroundColor Red
    Write-Host "Se ainda falhar, reinicie o PC e rode este script outra vez." -ForegroundColor Red
    exit 1
}

Write-Host "Instalando dependencias (npm install)..." -ForegroundColor Green
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$viteTemp = Join-Path $root "node_modules\.vite-temp"
if (Test-Path $viteTemp) {
    Remove-Item -Recurse -Force $viteTemp -ErrorAction SilentlyContinue
}

Write-Host "Build (npm run build)..." -ForegroundColor Green
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "OK. A pasta antiga foi renomeada para: $oldName" -ForegroundColor Gray
Write-Host "Quando quiser apagar: Remove-Item -Recurse -Force $oldName" -ForegroundColor Gray
