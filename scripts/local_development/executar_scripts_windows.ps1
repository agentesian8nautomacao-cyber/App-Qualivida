# ============================================
# SCRIPT POWERSHELL PARA EXECUTAR SCRIPTS SQL
# ============================================
# Versão PowerShell do script de execução
# Compatível com Windows PowerShell e PowerShell Core
# ============================================

param(
    [string]$PostgreSQLPath = "C:\Program Files\PostgreSQL\15\bin\psql.exe",
    [string]$HostName = "localhost",
    [string]$UserName = "postgres",
    [string]$Database = "gestao_qualivida"
)

function Write-Header {
    Clear-Host
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "SCRIPTS DE CORREÇÃO - BOLETOS PDF" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-PostgreSQL {
    Write-Host "🔍 Verificando instalação do PostgreSQL..." -ForegroundColor Yellow
    Write-Host ""

    try {
        $version = & $PostgreSQLPath --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ PostgreSQL encontrado!" -ForegroundColor Green
            Write-Host "📊 Versão: $version" -ForegroundColor Green
            return $true
        }
    } catch {
        # Ignorar erro
    }

    Write-Host "❌ PostgreSQL NÃO encontrado no caminho especificado" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 SOLUÇÕES:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. INSTALAR PostgreSQL:" -ForegroundColor White
    Write-Host "   • Site oficial: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
    Write-Host "   • Chocolatey: choco install postgresql" -ForegroundColor Gray
    Write-Host "   • winget: winget install PostgreSQL.PostgreSQL" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. AJUSTAR CAMINHO:" -ForegroundColor White
    Write-Host "   • Execute com parâmetro: -PostgreSQLPath 'C:\caminho\correto\psql.exe'" -ForegroundColor Gray
    Write-Host "   • Ou edite a variável no início deste script" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. VERIFICAR INSTALAÇÃO:" -ForegroundColor White
    Write-Host "   • Execute: Get-Command psql -ErrorAction SilentlyContinue" -ForegroundColor Gray
    Write-Host ""

    return $false
}

function Execute-SQLScript {
    param(
        [string]$ScriptName,
        [string]$Description
    )

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Magenta
    Write-Host "EXECUTANDO: $Description" -ForegroundColor Magenta
    Write-Host "============================================" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "📄 Script: $ScriptName" -ForegroundColor Cyan
    Write-Host "🗄️  Banco: $Database" -ForegroundColor Cyan
    Write-Host "👤 Usuário: $UserName" -ForegroundColor Cyan
    Write-Host ""

    $scriptPath = Join-Path $PSScriptRoot $ScriptName

    if (!(Test-Path $scriptPath)) {
        Write-Host "❌ Arquivo não encontrado: $scriptPath" -ForegroundColor Red
        return
    }

    Write-Host "🚀 Executando comando..." -ForegroundColor Yellow
    Write-Host "& '$PostgreSQLPath' -h $HostName -U $UserName -d $Database -f '$scriptPath'" -ForegroundColor Gray
    Write-Host ""

    try {
        & $PostgreSQLPath -h $HostName -U $UserName -d $Database -f $scriptPath

        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Script executado com sucesso!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "⚠️  Script executado com avisos/códigos de saída" -ForegroundColor Yellow
        }
    } catch {
        Write-Host ""
        Write-Host "❌ Erro ao executar script: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Show-Menu {
    Write-Header
    Write-Host "Escolha uma opção:" -ForegroundColor White
    Write-Host ""
    Write-Host "[1]" -NoNewline -ForegroundColor Green; Write-Host " Diagnosticar boletos sem PDF" -ForegroundColor White
    Write-Host "[2]" -NoNewline -ForegroundColor Green; Write-Host " Validar importações recentes" -ForegroundColor White
    Write-Host "[3]" -NoNewline -ForegroundColor Green; Write-Host " Ver exemplos de consultas" -ForegroundColor White
    Write-Host "[4]" -NoNewline -ForegroundColor Green; Write-Host " Verificar instalação do PostgreSQL" -ForegroundColor White
    Write-Host "[5]" -NoNewline -ForegroundColor Green; Write-Host " Configurar parâmetros de conexão" -ForegroundColor White
    Write-Host "[0]" -NoNewline -ForegroundColor Red; Write-Host " Sair" -ForegroundColor White
    Write-Host ""
}

function Configure-Connection {
    Write-Header
    Write-Host "🔧 CONFIGURAÇÃO DE CONEXÃO" -ForegroundColor Yellow
    Write-Host ""

    $newPath = Read-Host "Caminho do psql.exe (ou Enter para manter atual: $PostgreSQLPath)"
    if ($newPath) { $script:PostgreSQLPath = $newPath }

    $newHost = Read-Host "Host do PostgreSQL (ou Enter para manter atual: $HostName)"
    if ($newHost) { $script:HostName = $newHost }

    $newUser = Read-Host "Usuário do PostgreSQL (ou Enter para manter atual: $UserName)"
    if ($newUser) { $script:UserName = $newUser }

    $newDB = Read-Host "Nome do banco (ou Enter para manter atual: $Database)"
    if ($newDB) { $script:Database = $newDB }

    Write-Host ""
    Write-Host "✅ Configuração atualizada!" -ForegroundColor Green
    Read-Host "Pressione Enter para continuar"
}

# ============================================
# LOOP PRINCIPAL DO MENU
# ============================================

if (!(Test-PostgreSQL)) {
    Write-Host ""
    $configure = Read-Host "Deseja configurar o caminho do PostgreSQL? (s/n)"
    if ($configure -eq 's' -or $configure -eq 'S') {
        Configure-Connection
    } else {
        exit 1
    }
}

do {
    Show-Menu
    $choice = Read-Host "Digite sua opção (0-5)"

    switch ($choice) {
        "1" {
            Execute-SQLScript "correcao_boletos_sem_pdf.sql" "DIAGNÓSTICO DE BOLETOS SEM PDF"
            Read-Host "Pressione Enter para continuar"
        }
        "2" {
            Execute-SQLScript "validacao_importacao_boletos_com_pdf.sql" "VALIDAÇÃO DE IMPORTAÇÕES RECENTES"
            Read-Host "Pressione Enter para continuar"
        }
        "3" {
            Execute-SQLScript "exemplo_execucao_boletos.sql" "EXEMPLOS DE CONSULTAS INDIVIDUAIS"
            Read-Host "Pressione Enter para continuar"
        }
        "4" {
            Test-PostgreSQL | Out-Null
            Read-Host "Pressione Enter para continuar"
        }
        "5" {
            Configure-Connection
        }
        "0" {
            Write-Host ""
            Write-Host "👋 Até logo!" -ForegroundColor Cyan
            break
        }
        default {
            Write-Host "❌ Opção inválida!" -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
} while ($true)