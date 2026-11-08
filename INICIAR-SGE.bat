@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title SGE - Inicializacao do Sistema

set "NO_BROWSER=0"
set "NO_PAUSE=0"
if /I "%SGE_NO_BROWSER%"=="1" set "NO_BROWSER=1"
if /I "%SGE_NO_PAUSE%"=="1" set "NO_PAUSE=1"

for %%A in (%*) do (
    if /I "%%~A"=="--no-browser" set "NO_BROWSER=1"
    if /I "%%~A"=="--no-pause" set "NO_PAUSE=1"
)

REM Altera para o diretorio raiz do projeto utilizando caminho relativo ao proprio script
pushd "%~dp0" >nul 2>&1
if errorlevel 1 goto :erro_diretorio

echo ============================================================================
echo   SGE - SISTEMA DE GESTAO E ESTOQUE - INICIALIZACAO LOCAL
echo ============================================================================
echo.

REM Garante que os caminhos padrao do Docker Desktop no Windows estejam no PATH da sessao
if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
    set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;%PATH%"
)
if exist "%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin;%PATH%"
)

REM 1. Verifica se o Docker esta instalado
where docker >nul 2>&1
if errorlevel 1 goto :erro_docker_ausente

REM Verifica se o script principal de orquestracao existe
if not exist ".\scripts\sge-local.ps1" goto :erro_script_ausente

REM 2 a 6. Executa o fluxo de inicializacao reutilizando scripts/sge-local.ps1:
REM        - Verifica se o Docker Desktop esta em execucao e inicia se estiver fechado
REM        - Aguarda o Docker ficar operacional com limite de tempo
REM        - Sobe MySQL e MinIO e aguarda healthcheck do MySQL
REM        - Inicia Backend e Frontend e aguarda os respectivos healthchecks
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\sge-local.ps1" start
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" goto :erro_execucao

echo.
echo ============================================================================
echo [SGE] Sistema iniciado e pronto para uso!
echo       Endereco da aplicacao : http://localhost:5173
echo       Acessos padrao (usuario / senha):
echo         - Administrador : admin / admin
echo         - Almoxarifado  : almoxarife / almoxarife
echo         - Solicitante   : usuario / usuario
echo ============================================================================

REM 7. Abre o navegador somente apos a aplicacao estar disponivel
if "%NO_BROWSER%"=="0" (
    echo [SGE] Abrindo o navegador em http://localhost:5173 ...
    start "" "http://localhost:5173"
)

popd >nul 2>&1
exit /b 0

:erro_diretorio
echo [ERRO] Nao foi possivel acessar o diretorio do projeto SGE.
if "%NO_PAUSE%"=="0" pause
exit /b 1

:erro_docker_ausente
echo [ERRO] O Docker nao foi encontrado neste computador.
echo        Por favor, instale o Docker Desktop para Windows e tente novamente.
echo.
popd >nul 2>&1
if "%NO_PAUSE%"=="0" pause
exit /b 1

:erro_script_ausente
echo [ERRO] O script de inicializacao ".\scripts\sge-local.ps1" nao foi encontrado.
echo        Verifique se os arquivos do projeto estao completos.
echo.
popd >nul 2>&1
if "%NO_PAUSE%"=="0" pause
exit /b 1

:erro_execucao
echo.
echo ============================================================================
echo [ERRO] Falha ao iniciar o SGE. Codigo de saida: %EXIT_CODE%.
echo        Verifique as mensagens acima para identificar a causa do problema.
echo ============================================================================
popd >nul 2>&1
if "%NO_PAUSE%"=="0" pause
exit /b %EXIT_CODE%
