@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title SGE - Encerramento do Sistema

set "NO_PAUSE=0"
if /I "%SGE_NO_PAUSE%"=="1" set "NO_PAUSE=1"

for %%A in (%*) do (
    if /I "%%~A"=="--no-pause" set "NO_PAUSE=1"
)

REM Altera para o diretorio raiz do projeto utilizando caminho relativo ao proprio script
pushd "%~dp0" >nul 2>&1
if errorlevel 1 goto :erro_diretorio

echo ============================================================================
echo   SGE - SISTEMA DE GESTAO E ESTOQUE - ENCERRAMENTO DE SERVICOS
echo ============================================================================
echo.

REM Garante que os caminhos padrao do Docker Desktop no Windows estejam no PATH da sessao
if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
    set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;%PATH%"
)
if exist "%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin;%PATH%"
)

if not exist ".\scripts\sge-local.ps1" goto :erro_script_ausente

REM Encerra Backend, Frontend e containers via Docker Compose (docker compose stop)
REM preservando todos os volumes, imagens e dados persistidos (sem usar down -v).
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\sge-local.ps1" stop
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" goto :erro_execucao

echo.
echo ============================================================================
echo [SGE] Operacao concluida com sucesso!
echo       Os servicos do SGE foram encerrados e todos os dados foram preservados.
echo ============================================================================

popd >nul 2>&1
exit /b 0

:erro_diretorio
echo [ERRO] Nao foi possivel acessar o diretorio do projeto SGE.
if "%NO_PAUSE%"=="0" pause
exit /b 1

:erro_script_ausente
echo [ERRO] O script ".\scripts\sge-local.ps1" nao foi encontrado.
echo.
popd >nul 2>&1
if "%NO_PAUSE%"=="0" pause
exit /b 1

:erro_execucao
echo.
echo ============================================================================
echo [ERRO] Ocorreu uma falha ao encerrar os servicos do SGE. Codigo: %EXIT_CODE%.
echo        Verifique as mensagens acima para mais detalhes.
echo ============================================================================
popd >nul 2>&1
if "%NO_PAUSE%"=="0" pause
exit /b %EXIT_CODE%
