param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'seed')]
    [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

# Descoberta portavel de binarios (funciona em qualquer conta de usuario do Windows)
$DockerBinCandidates = @(
    "$env:ProgramFiles\Docker\Docker\resources\bin",
    "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin"
)
foreach ($candidate in $DockerBinCandidates) {
    if ($candidate -and (Test-Path $candidate) -and ($env:PATH -notlike "*$candidate*")) {
        $env:PATH = "$candidate;$env:PATH"
    }
}

$DockerDesktopCandidates = @(
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
)
$DockerDesktopExe = $DockerDesktopCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$NodeBinCandidates = @(
    "$env:ProgramFiles\nodejs",
    "$env:LOCALAPPDATA\Programs\nodejs"
)
foreach ($candidate in $NodeBinCandidates) {
    if ($candidate -and (Test-Path $candidate) -and ($env:PATH -notlike "*$candidate*")) {
        $env:PATH = "$candidate;$env:PATH"
    }
}

function Get-ActiveNetworkInfo {
    $virtualPattern = 'vEthernet|WSL|Hyper-V|Docker|Loopback|Radmin|Hamachi|Tailscale|ZeroTier|VMware|VirtualBox|Bluetooth'

    # 1. Prioriza a interface com rota padrao ativa (0.0.0.0/0), seja Cabo (Ethernet) ou Wi-Fi
    $routes = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
        Sort-Object { $_.RouteMetric + $_.InterfaceMetric }
    foreach ($r in $routes) {
        $ipObj = Get-NetIPAddress -InterfaceIndex $r.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object {
                $_.IPAddress -ne '127.0.0.1' -and
                $_.IPAddress -notlike '169.254.*' -and
                $_.InterfaceAlias -notmatch $virtualPattern
            } | Select-Object -First 1
        if ($ipObj) {
            return @{ IPAddress = $ipObj.IPAddress; InterfaceAlias = $ipObj.InterfaceAlias }
        }
    }

    # 2. Fallback para interfaces fisicas ativas (Ethernet / Wi-Fi) em redes locais sem gateway de internet
    $fallbackIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -ne '127.0.0.1' -and
            $_.IPAddress -notlike '169.254.*' -and
            $_.PrefixOrigin -ne 'WellKnown' -and
            $_.InterfaceAlias -notmatch $virtualPattern
        } | Select-Object -First 1
    if ($fallbackIp) {
        return @{ IPAddress = $fallbackIp.IPAddress; InterfaceAlias = $fallbackIp.InterfaceAlias }
    }

    return @{ IPAddress = '127.0.0.1'; InterfaceAlias = 'Loopback' }
}

function Get-LanIpAddress {
    return (Get-ActiveNetworkInfo).IPAddress
}

function Test-FirewallLanRules {
    # Consulta rapida sem exigir privilegios de administrador
    $customRule = Get-NetFirewallRule -DisplayName "SGE-Prod LAN*" -ErrorAction SilentlyContinue |
        Where-Object { $_.Enabled -eq 'True' -and $_.Action -eq 'Allow' } |
        Select-Object -First 1
    if ($customRule) {
        return @{ Configured = $true; Detail = "Regra ativa ($($customRule.DisplayName))" }
    }
    return @{
        Configured = $false
        Detail     = "Regra especifica 'SGE-Prod LAN' nao encontrada. Se outros dispositivos nao conseguirem acessar, execute uma unica vez no PowerShell como Administrador:`n  New-NetFirewallRule -DisplayName `"SGE-Prod LAN (5170, 5173)`" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5170,5173 -RemoteAddress LocalSubnet"
    }
}

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
    if (-not $DockerDesktopExe -or -not (Test-Path $DockerDesktopExe)) {
        throw "Docker Engine nao esta em execucao e o executavel do Docker Desktop nao foi localizado automaticamente. Inicie o Docker Desktop manualmente."
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
    $dbPort = if ($envMap.ContainsKey('DB_PORT') -and $envMap['DB_PORT']) { $envMap['DB_PORT'] } else { '3306' }
    $dbPass = $envMap['DB_PASSWORD']
    $jwtKey = if ($envMap.ContainsKey('JWT_KEY') -and $envMap['JWT_KEY']) { $envMap['JWT_KEY'] } else { 'sge_dev_jwt_secret_key_minimo_32_caracteres_2026' }
    $s3Key = $envMap['S3_ACCESS_KEY_ID']
    $s3Secret = $envMap['S3_SECRET_ACCESS_KEY']
    $seedPass = if ($envMap.ContainsKey('SGE_SEED_SENHA') -and $envMap['SGE_SEED_SENHA']) { $envMap['SGE_SEED_SENHA'] } else { 'SgeDevLocal2026!' }

    $env:ASPNETCORE_ENVIRONMENT = "Development"
    $env:ASPNETCORE_URLS = "http://0.0.0.0:5170"
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

function Ensure-FrontendEnv {
    $feEnvPath = Join-Path $RepoRoot "frontend\.env"
    $feExamplePath = Join-Path $RepoRoot "frontend\.env.example"
    if (-not (Test-Path $feEnvPath)) {
        if (Test-Path $feExamplePath) {
            Copy-Item -Path $feExamplePath -Destination $feEnvPath
        } else {
            $defaultContent = "# Configuracao padrao do frontend (sem IP fixo).`r`nVITE_API_BASE_URL=http://localhost:5170`r`n"
            Set-Content -Path $feEnvPath -Value $defaultContent -Encoding UTF8
        }
    }
}

function Start-AppProcesses {
    Ensure-FrontendEnv

    $apiConn = Get-NetTCPConnection -LocalPort 5170 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $apiConn) {
        Write-Host "[SGE] Iniciando Backend ASP.NET Core em 0.0.0.0:5170..."
        Start-Process -FilePath "dotnet" `
            -ArgumentList "run --project `"$RepoRoot\backend\Sge.Api.csproj`" --urls `"http://0.0.0.0:5170`"" `
            -WorkingDirectory "$RepoRoot\backend" `
            -WindowStyle Hidden
    }

    $feConn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $feConn) {
        Write-Host "[SGE] Iniciando Frontend Vite em 0.0.0.0:5173..."
        $npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
        if (-not $npmCmd) { $npmCmd = "npm.cmd" }
        Start-Process -FilePath $npmCmd `
            -ArgumentList "run dev -- --host 0.0.0.0 --port 5173 --strictPort" `
            -WorkingDirectory "$RepoRoot\frontend" `
            -WindowStyle Hidden
    }

    for ($i = 1; $i -le 15; $i++) {
        try {
            $null = Invoke-RestMethod -Uri "http://localhost:5170/api/health" -TimeoutSec 2
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }
}

function Show-Status {
    $netInfo = Get-ActiveNetworkInfo
    $lanIp = $netInfo.IPAddress
    $ifAlias = $netInfo.InterfaceAlias
    $envMap = Read-DotEnv (Join-Path $RepoRoot ".env")
    $dbPort = if ($envMap.ContainsKey('DB_PORT') -and $envMap['DB_PORT']) { [int]$envMap['DB_PORT'] } else { 3306 }

    Write-Host "=== SITUACAO DOS SERVICOS (CONTAINERS DOCKER) ==="
    docker compose ps

    Write-Host "`n=== SITUACAO DAS PORTAS E INTERFACES DE ESCUTA ==="
    $servicePorts = @(
        @{ Port = $dbPort; Name = "MySQL 8.4 (Loopback)" },
        @{ Port = 9000;    Name = "MinIO S3 API (Loopback)" },
        @{ Port = 9001;    Name = "MinIO Console (Loopback)" },
        @{ Port = 5170;    Name = "Backend API (LAN/Local)" },
        @{ Port = 5173;    Name = "Frontend Vite (LAN/Local)" }
    )
    foreach ($item in $servicePorts) {
        $p = $item.Port
        $conns = @(Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
        if ($conns.Count -gt 0) {
            $addrs = ($conns | Select-Object -ExpandProperty LocalAddress -Unique) -join ", "
            $procId = $conns[0].OwningProcess
            Write-Host ("Porta {0,-5} ({1,-25}): ATIVA (PID {2,-6} | Escuta: {3})" -f $p, $item.Name, $procId, $addrs)
        } else {
            Write-Host ("Porta {0,-5} ({1,-25}): INATIVA" -f $p, $item.Name)
        }
    }

    $localHealthStatus = "INDISPONIVEL"
    $lanHealthStatus = "INDISPONIVEL"
    try {
        $hLocal = Invoke-RestMethod -Uri "http://localhost:5170/api/health" -TimeoutSec 3
        $localHealthStatus = "OK ($($hLocal | ConvertTo-Json -Compress))"
    } catch {}
    try {
        $hLan = Invoke-RestMethod -Uri "http://${lanIp}:5170/api/health" -TimeoutSec 3
        $lanHealthStatus = "OK ($($hLan | ConvertTo-Json -Compress))"
    } catch {}

    Write-Host "`n=== ENDERECOS DE ACESSO (LOCAL E LAN) ==="
    Write-Host ("IP LAN Detectado          : {0} (Interface: {1})" -f $lanIp, $ifAlias)
    Write-Host ("Endereco Local do Frontend: http://localhost:5173")
    Write-Host ("Endereco LAN do Frontend  : http://{0}:5173" -f $lanIp)
    Write-Host ("Endereco Local da API     : http://localhost:5170 (Health: {0})" -f $localHealthStatus)
    Write-Host ("Endereco LAN da API       : http://{0}:5170 (Health: {1})" -f $lanIp, $lanHealthStatus)

    $fw = Test-FirewallLanRules
    Write-Host "`n=== FIREWALL DO WINDOWS (PORTAS 5170 / 5173) ==="
    Write-Host $fw.Detail
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
        dotnet run --project "$RepoRoot\backend\Sge.Api.csproj" -- seed-dev
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
        Start-AppProcesses
        Show-Status
    }
    'restart' {
        & $PSCommandPath stop
        & $PSCommandPath start
    }
}
