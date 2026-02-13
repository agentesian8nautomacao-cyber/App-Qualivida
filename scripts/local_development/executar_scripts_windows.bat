@echo off
REM ============================================
REM SCRIPT PARA EXECUTAR SCRIPTS SQL NO WINDOWS
REM ============================================
REM Este arquivo facilita a execução dos scripts SQL
REM sem precisar digitar comandos longos no terminal
REM ============================================

echo ============================================
echo SCRIPTS DE CORREÇÃO - BOLETOS PDF
echo ============================================
echo.
echo Escolha uma opção:
echo [1] Diagnosticar boletos sem PDF
echo [2] Validar importações recentes
echo [3] Ver exemplos de consultas
echo [4] Verificar instalação do PostgreSQL
echo [0] Sair
echo.

set /p choice="Digite sua opção (0-4): "

if "%choice%"=="1" goto diagnostico
if "%choice%"=="2" goto validacao
if "%choice%"=="3" goto exemplos
if "%choice%"=="4" goto verificar_psql
if "%choice%"=="0" goto sair

echo Opção inválida!
pause
goto menu

:diagnostico
echo.
echo ============================================
echo EXECUTANDO DIAGNÓSTICO DE BOLETOS SEM PDF
echo ============================================
echo.
echo Comando: psql -h localhost -U postgres -d gestao_qualivida -f scripts/correcao_boletos_sem_pdf.sql
echo.
psql -h localhost -U postgres -d gestao_qualivida -f scripts/correcao_boletos_sem_pdf.sql
echo.
echo Pressione qualquer tecla para continuar...
pause >nul
goto menu

:validacao
echo.
echo ============================================
echo EXECUTANDO VALIDAÇÃO DE IMPORTAÇÕES
echo ============================================
echo.
echo Comando: psql -h localhost -U postgres -d gestao_qualivida -f scripts/validacao_importacao_boletos_com_pdf.sql
echo.
psql -h localhost -U postgres -d gestao_qualivida -f scripts/validacao_importacao_boletos_com_pdf.sql
echo.
echo Pressione qualquer tecla para continuar...
pause >nul
goto menu

:exemplos
echo.
echo ============================================
echo EXECUTANDO EXEMPLOS DE CONSULTAS
echo ============================================
echo.
echo Comando: psql -h localhost -U postgres -d gestao_qualivida -f scripts/exemplo_execucao_boletos.sql
echo.
psql -h localhost -U postgres -d gestao_qualivida -f scripts/exemplo_execucao_boletos.sql
echo.
echo Pressione qualquer tecla para continuar...
pause >nul
goto menu

:verificar_psql
echo.
echo ============================================
echo VERIFICANDO INSTALAÇÃO DO POSTGRESQL
echo ============================================
echo.

REM Tentar executar psql --version
psql --version 2>nul
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL NAO está instalado ou não está no PATH
    echo.
    echo 🔧 SOLUÇÕES:
    echo.
    echo 1. INSTALAR PostgreSQL:
    echo    • Baixe do site oficial: https://www.postgresql.org/download/windows/
    echo    • Ou use chocolatey: choco install postgresql
    echo.
    echo 2. ADICIONAR AO PATH:
    echo    • Localizar pasta de instalação (ex: C:\Program Files\PostgreSQL\15\bin)
    echo    • Adicionar ao PATH do sistema
    echo.
    echo 3. VERIFICAR INSTALAÇÃO:
    echo    • Abrir CMD como Administrador
    echo    • Executar: where psql
    echo.
) else (
    echo ✅ PostgreSQL está instalado e disponível!
    echo.
    echo 📊 VERSÃO DETECTADA:
    psql --version
    echo.
    echo 🎯 PRÓXIMOS PASSOS:
    echo    • Verifique se o banco 'gestao_qualivida' existe
    echo    • Ajuste usuário/senha se necessário
    echo    • Execute os scripts de diagnóstico
    echo.
)

echo Pressione qualquer tecla para continuar...
pause >nul
goto menu

:sair
echo.
echo Até logo!
echo.
pause
exit /b 0

:menu
cls
echo ============================================
echo SCRIPTS DE CORREÇÃO - BOLETOS PDF
echo ============================================
echo.
echo Escolha uma opção:
echo [1] Diagnosticar boletos sem PDF
echo [2] Validar importações recentes
echo [3] Ver exemplos de consultas
echo [4] Verificar instalação do PostgreSQL
echo [0] Sair
echo.

set /p choice="Digite sua opção (0-4): "

if "%choice%"=="1" goto diagnostico
if "%choice%"=="2" goto validacao
if "%choice%"=="3" goto exemplos
if "%choice%"=="4" goto verificar_psql
if "%choice%"=="0" goto sair

echo Opção inválida!
pause
goto menu