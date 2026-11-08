param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'seed')]
    [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$DockerBin = "C:\Users\halli\AppData\Local\Programs\DockerDesktop\resources\bin"
$DockerDesktopExe = "C:\Users\halli\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
$NodeBin = "C:\Program Files\nodejs"

if (Test-Path $DockerBin) { $env:PATH = "$DockerBin;$env:PATH" }
if (Test-Path $NodeBin) { $env:PATH = "$NodeBin;$env:PATH" }

function Read-DotEnv([string]$Path) {
    $map = @{}
    if (-not (Test-Path $Path)) { return $map }
    foreach ($line in Get-Content $Path) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
        $idx = $trimmed.IndexOf('=')
        if ($idx -gt 0) {
            $k = $trimmed.Substring(0, $idx).Trim()
            $v = $trimmed.Substring($idx + 1).Trim()
            $map[$k] = $v
        }
    }
    return $map
}

function Ensure-DockerRunning {
    docker info > $null 2>&1
    if ($LASTEXITCODE -eq 0) { return }
    if (-not (Test-Path $DockerDesktopExe)) {
        throw "Docker Desktop nao encontrado em $DockerDesktopExe."
    }
    Write-Host "[SGE] Iniciando Docker Desktop..."
    Start-Process $DockerDesktopExe
    for ($i = 1; $i -le 45; $i++) {
        Start-Sleep -Seconds 2
        docker info > $null 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[SGE] Docker Engine pronto."
            return
        }
    }
    throw "Tempo esgotado aguardando inicializacao do Docker Engine."
}

function Sync-BackendConfig {
    $envMap = Read-DotEnv (Join-Path $RepoRoot ".env")
    if ($envMap.Count -eq 0) {
        throw "Arquivo .env nao encontrado na raiz do projeto. Copie .env.example para .env e preencha os valores."
    }
    $dbPort = if ($envMap.ContainsKey('DB_PORT')) { $envMap['DB_PORT'] } else { '3306' }
    $dbPass = $envMap['DB_PASSWORD']
    $jwtKey = if ($envMap.ContainsKey('JWT_KEY') -and $envMap['JWT_KEY']) { $envMap['JWT_KEY'] } else { 'sge_dev_jwt_secret_key_minimo_32_caracteres_2026' }
    $s3Key = $envMap['S3_ACCESS_KEY_ID']
    $s3Secret = $envMap['S3_SECRET_ACCESS_KEY']
    $seedPass = if ($envMap.ContainsKey('SGE_SEED_SENHA') -and $envMap['SGE_SEED_SENHA']) { $envMap['SGE_SEED_SENHA'] } else { 'SgeDevLocal2026!' }

    $env:ASPNETCORE_ENVIRONMENT = "Development"
    $env:ConnectionStrings__DefaultConnection = "Server=127.0.0.1;Port=$dbPort;Database=sge;User=sge_app;Password=$dbPass;"
    $env:Jwt__Key = $jwtKey
    $env:S3_ENDPOINT = "http://127.0.0.1:9000"
    $env:S3_BUCKET = "sge-documentos"
    $env:S3_REGION = "us-east-1"
    $env:S3_FORCE_PATH_STYLE = "true"
    $env:S3_ACCESS_KEY_ID = $s3Key
    $env:S3_SECRET_ACCESS_KEY = $s3Secret
    $env:SGE_SEED_SENHA = $seedPass
}

function Show-Status {
    Write-Host "=== STATUS DOS CONTAINERS DOCKER ==="
    docker compose ps
    Write-Host "`n=== STATUS DAS PORTAS LOCAIS ==="
    $ports = @(3307, 9000, 9001, 5170, 5173)
    foreach ($p in $ports) {
        $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($conn) {
            Write-Host ("Porta {0,-5}: ATIVA (PID {1})" -f $p, $conn.OwningProcess)
        } else {
            Write-Host ("Porta {0,-5}: INATIVA" -f $p)
        }
    }
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:5170/api/health" -TimeoutSec 3
        Write-Host ("API Health  : OK ({0})" -f ($health | ConvertTo-Json -Compress))
    } catch {
        Write-Host "API Health  : INDISPONIVEL"
    }
}

function Stop-AppProcesses {
    foreach ($port in @(5170, 5173)) {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            if ($c.OwningProcess -gt 0) {
                Write-Host "[SGE] Encerrando processo na porta $port (PID $($c.OwningProcess))..."
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

switch ($Action) {
    'status' {
        Ensure-DockerRunning
        Show-Status
    }
    'seed' {
        Ensure-DockerRunning
        Sync-BackendConfig
        Write-Host "[SGE] Executando seeder de desenvolvimento..."
        dotnet run --project "$RepoRoot\backend\Sge.Api\Sge.Api.csproj" -- seed-dev
    }
    'stop' {
        Stop-AppProcesses
        docker info > $null 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[SGE] Parando servicos Docker (volumes preservados)..."
            docker compose stop
        }
        Write-Host "[SGE] Servicos parados com sucesso."
    }
    'start' {
        Ensure-DockerRunning
        Sync-BackendConfig
        Write-Host "[SGE] Subindo MySQL e MinIO via Docker Compose..."
        docker compose up -d db minio minio-init
        Write-Host "[SGE] Aguardando MySQL ficar saudavel..."
        for ($i = 1; $i -le 30; $i++) {
            $status = docker inspect --format "{{.State.Health.Status}}" sge-db-1 2>$null
            if ($status -eq "healthy") { break }
            Start-Sleep -Seconds 2
        }
        Show-Status
    }
    'restart' {
        & $PSCommandPath stop
        & $PSCommandPath start
    }
}

