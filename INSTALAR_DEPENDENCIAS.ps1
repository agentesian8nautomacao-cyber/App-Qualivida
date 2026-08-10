# Script para instalar dependências corretamente
# Execute este script em um PowerShell ADMINISTRADOR

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Instalando dependências do Qualivida" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Navegar para o diretório
cd "D:\App Qualivida"

# Parar processos Node
Write-Host "`n[1/6] Parando processos Node..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Limpar variáveis de ambiente
Write-Host "[2/6] Limpando variáveis de ambiente..." -ForegroundColor Yellow
$env:NODE_ENV = ""

# Limpar configurações do npm
Write-Host "[3/6] Limpando configurações do npm..." -ForegroundColor Yellow
npm config set omit ""
npm config set production false

# Remover node_modules (se não estiver bloqueado)
Write-Host "[4/6] Removendo node_modules..." -ForegroundColor Yellow
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

# Instalar dependências
Write-Host "[5/6] Instalando dependências (isso pode demorar)..." -ForegroundColor Yellow
npm install --include=dev

# Verificar instalação
Write-Host "[6/6] Verificando instalação..." -ForegroundColor Yellow
npm list vite

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Instalação concluída!" -ForegroundColor Green
Write-Host "Execute: npm run dev" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green