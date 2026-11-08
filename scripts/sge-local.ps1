param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'seed', 'reset')]
    [string]$Action = 'status',

    [Parameter()]
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
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

$DotnetBinCandidates = @(
    "$env:ProgramFiles\dotnet",
    "$env:USERPROFILE\.dotnet"
)
foreach ($candidate in $DotnetBinCandidates) {
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
    foreach ($line in Get-Content $Path -Encoding UTF8) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
        $idx = $trimmed.IndexOf('=')
        if ($idx -gt 0) {
            $k = $trimmed.Substring(0, $idx).Trim()
            $v = $trimmed.Substring($idx + 1).Trim()
            if ($v.StartsWith('#')) {
                $v = ''
            } elseif ($v -match '^(.*?)\s+#.*$') {
                $v = $Matches[1].Trim()
            }
            if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
                $v = $v.Substring(1, $v.Length - 2)
            }
            $map[$k] = $v
        }
    }
    return $map
}

function Set-DotEnvValue([string]$Path, [string]$Key, [string]$Value) {
    $lines = if (Test-Path $Path) { @(Get-Content $Path -Encoding UTF8) } else { @() }
    $updated = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*$([regex]::Escape($Key))\s*=") {
            $lines[$i] = "$Key=$Value"
            $updated = $true
            break
        }
    }
    if (-not $updated) {
        $lines += "$Key=$Value"
    }
    Set-Content -Path $Path -Value $lines -Encoding UTF8
}

function Test-DockerInstalled {
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    return ($null -ne $dockerCmd)
}

function Test-DockerEngine {
    if (-not (Test-DockerInstalled)) { return $false }
    cmd /c "docker info >nul 2>&1"
    return ($LASTEXITCODE -eq 0)
}

function Get-ContainerHealthStatus([string]$ContainerName) {
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" $ContainerName 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $out) { return "missing" }
        return ($out | Select-Object -First 1).ToString().Trim()
    } catch {
        return "missing"
    } finally {
        $ErrorActionPreference = $prevEAP
    }
}

function Get-ContainerExitState([string]$ContainerName) {
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & docker inspect --format "{{.State.Status}}:{{.State.ExitCode}}" $ContainerName 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $out) { return "missing:-1" }
        return ($out | Select-Object -First 1).ToString().Trim()
    } catch {
        return "missing:-1"
    } finally {
        $ErrorActionPreference = $prevEAP
    }
}

function Ensure-DockerRunning {
    Write-Host "[SGE] Verificando instalacao do Docker..."
    if (-not (Test-DockerInstalled)) {
        throw "O Docker nao esta instalado ou nao foi encontrado neste computador. Instale o Docker Desktop para Windows e tente novamente."
    }

    Write-Host "[SGE] Verificando se o Docker Desktop esta em execucao..."
    if (Test-DockerEngine) {
        Write-Host "[SGE] Docker Desktop em execucao e operacional."
        return
    }

    if (-not $DockerDesktopExe -or -not (Test-Path $DockerDesktopExe)) {
        throw "O Docker Engine nao esta em execucao e o executavel do Docker Desktop nao foi localizado automaticamente. Inicie o Docker Desktop manualmente e tente novamente."
    }

    Write-Host "[SGE] Docker Desktop fechado. Iniciando o Docker Desktop automaticamente..."
    Start-Process -FilePath $DockerDesktopExe

    $maxSeconds = 120
    $intervalSeconds = 2
    $maxAttempts = [int]($maxSeconds / $intervalSeconds)

    for ($i = 1; $i -le $maxAttempts; $i++) {
        Start-Sleep -Seconds $intervalSeconds
        if (Test-DockerEngine) {
            Write-Host "[SGE] Docker Engine pronto e operacional."
            return
        }
        $elapsed = $i * $intervalSeconds
        if ($elapsed % 10 -eq 0) {
            Write-Host "[SGE] Aguardando o Docker Desktop ficar operacional... (${elapsed}s / ${maxSeconds}s)"
        }
    }

    throw "Tempo limite esgotado (${maxSeconds} segundos) aguardando a inicializacao do Docker Desktop. Verifique se o Docker Desktop abriu corretamente e se o WSL 2 esta ativo."
}

function Ensure-ValidDotEnv {
    $envPath = Join-Path $RepoRoot ".env"
    $examplePath = Join-Path $RepoRoot ".env.example"

    if (-not (Test-Path $envPath)) {
        if (Test-Path $examplePath) {
            Write-Host "[SGE] Criando arquivo .env a partir de .env.example..."
            Copy-Item -Path $examplePath -Destination $envPath
        } else {
            throw "Arquivo .env nao encontrado na raiz do projeto."
        }
    }

    $envMap = Read-DotEnv $envPath

    if (-not $envMap.ContainsKey('DB_PASSWORD') -or [string]::IsNullOrWhiteSpace($envMap['DB_PASSWORD'])) {
        Write-Host "[SGE] Definindo DB_PASSWORD padrao local no arquivo .env..."
        Set-DotEnvValue $envPath 'DB_PASSWORD' '123456'
        $envMap['DB_PASSWORD'] = '123456'
    }

    if (-not $envMap.ContainsKey('DB_ROOT_PASSWORD') -or [string]::IsNullOrWhiteSpace($envMap['DB_ROOT_PASSWORD'])) {
        Write-Host "[SGE] Definindo DB_ROOT_PASSWORD padrao local no arquivo .env..."
        Set-DotEnvValue $envPath 'DB_ROOT_PASSWORD' '123456'
        $envMap['DB_ROOT_PASSWORD'] = '123456'
    }

    if (-not $envMap.ContainsKey('MINIO_ROOT_USER') -or [string]::IsNullOrWhiteSpace($envMap['MINIO_ROOT_USER'])) {
        Set-DotEnvValue $envPath 'MINIO_ROOT_USER' 'sge_admin'
        $envMap['MINIO_ROOT_USER'] = 'sge_admin'
    }

    if (-not $envMap.ContainsKey('MINIO_ROOT_PASSWORD') -or $envMap['MINIO_ROOT_PASSWORD'].Length -lt 8) {
        Write-Host "[SGE] Ajustando MINIO_ROOT_PASSWORD no arquivo .env (MinIO exige minimo de 8 caracteres)..."
        Set-DotEnvValue $envPath 'MINIO_ROOT_PASSWORD' 'SgeMinioAdmin2026!'
        $envMap['MINIO_ROOT_PASSWORD'] = 'SgeMinioAdmin2026!'
    }

    if (-not $envMap.ContainsKey('S3_ACCESS_KEY_ID') -or [string]::IsNullOrWhiteSpace($envMap['S3_ACCESS_KEY_ID'])) {
        Set-DotEnvValue $envPath 'S3_ACCESS_KEY_ID' 'sge_backend'
        $envMap['S3_ACCESS_KEY_ID'] = 'sge_backend'
    }

    if (-not $envMap.ContainsKey('S3_SECRET_ACCESS_KEY') -or $envMap['S3_SECRET_ACCESS_KEY'].Length -lt 32) {
        Write-Host "[SGE] Configurando S3_SECRET_ACCESS_KEY (32 caracteres) no arquivo .env..."
        Set-DotEnvValue $envPath 'S3_SECRET_ACCESS_KEY' 'sge_local_s3_secret_key_2026_32c'
        $envMap['S3_SECRET_ACCESS_KEY'] = 'sge_local_s3_secret_key_2026_32c'
    }

    $configuredPort = if ($envMap.ContainsKey('DB_PORT') -and $envMap['DB_PORT']) { [int]$envMap['DB_PORT'] } else { 3306 }
    $portListeners = @(Get-NetTCPConnection -LocalPort $configuredPort -State Listen -ErrorAction SilentlyContinue)
    if ($portListeners.Count -gt 0) {
        $hasHostMysqlConflict = $false
        foreach ($listener in $portListeners) {
            $proc = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
            if ($proc -and $proc.ProcessName -match '^mysqld$') {
                $hasHostMysqlConflict = $true
                break
            }
        }
        if ($hasHostMysqlConflict -and $configuredPort -eq 3306) {
            Write-Host "[SGE] A porta 3306 esta ocupada pelo servico MySQL nativo do Windows (mysqld). Ajustando DB_PORT=3307 no .env..."
            Set-DotEnvValue $envPath 'DB_PORT' '3307'
            $envMap['DB_PORT'] = '3307'
        }
    }

    return $envMap
}

function Sync-BackendConfig {
    $envMap = Ensure-ValidDotEnv
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

function Test-BackendHealth {
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:5170/api/health" -TimeoutSec 3 -ErrorAction Stop
        return ($null -ne $resp -and $resp.status -eq 'ok')
    } catch {
        return $false
    }
}

function Test-FrontendHealth {
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        return ($resp.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Start-AppProcesses([bool]$DatabaseRecreated = $false) {
    Ensure-FrontendEnv

    $dotnetCmd = Get-Command dotnet -ErrorAction SilentlyContinue
    if (-not $dotnetCmd) {
        throw "O .NET SDK (dotnet) nao foi encontrado neste computador. Instale o .NET SDK para iniciar o Backend."
    }

    $npmCmdObj = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npmCmdObj) {
        throw "O Node.js / npm nao foi encontrado neste computador. Instale o Node.js para iniciar o Frontend."
    }
    $npmCmd = $npmCmdObj.Source

    $dllPath = Join-Path $RepoRoot "backend\Sge.Api\bin\Debug\net10.0\Sge.Api.dll"
    if (-not (Test-Path $dllPath)) {
        Write-Host "[SGE] Compilando Backend ASP.NET Core (primeira execucao, aguarde)..."
        $buildExit = 1
        for ($attempt = 1; $attempt -le 3; $attempt++) {
            $prevEAP = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            & dotnet build "$RepoRoot\backend\Sge.Api\Sge.Api.csproj" -c Debug -m:1 /nodeReuse:false --nologo -v quiet
            $buildExit = $LASTEXITCODE
            $ErrorActionPreference = $prevEAP
            if ($buildExit -eq 0 -or (Test-Path $dllPath)) {
                $buildExit = 0
                break
            }
            Start-Sleep -Seconds 2
        }
        if ($buildExit -ne 0) {
            throw "Falha ao compilar o Backend ASP.NET Core."
        }
    }

    $vitePackagePath = Join-Path $RepoRoot "frontend\node_modules\vite"
    if (-not (Test-Path $vitePackagePath)) {
        Write-Host "[SGE] Instalando dependencias do Frontend (primeira execucao, aguarde)..."
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & $npmCmd install --prefix "$RepoRoot\frontend" --no-audit --no-fund
        $npmExit = $LASTEXITCODE
        $ErrorActionPreference = $prevEAP
        if ($npmExit -ne 0) {
            throw "Falha ao instalar as dependencias do Frontend com npm install."
        }
    }

    if ($DatabaseRecreated) {
        $existingApiConns = @(Get-NetTCPConnection -LocalPort 5170 -State Listen -ErrorAction SilentlyContinue)
        foreach ($c in $existingApiConns) {
            if ($c.OwningProcess -gt 0) {
                cmd /c "taskkill /F /T /PID $($c.OwningProcess) >nul 2>&1"
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Seconds 1
    }

    $apiConn = Get-NetTCPConnection -LocalPort 5170 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $apiConn) {
        Write-Host "[SGE] Iniciando Backend ASP.NET Core em 0.0.0.0:5170..."
        Start-Process -FilePath "dotnet" `
            -ArgumentList "run --no-build --project `"$RepoRoot\backend\Sge.Api\Sge.Api.csproj`" --urls `"http://0.0.0.0:5170`"" `
            -WorkingDirectory "$RepoRoot\backend\Sge.Api" `
            -WindowStyle Hidden
    } else {
        Write-Host "[SGE] Backend ASP.NET Core ja esta em execucao na porta 5170. Verificando usuario inicial 'admin'..."
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        & dotnet run --no-build --project "$RepoRoot\backend\Sge.Api\Sge.Api.csproj" -- seed-dev > $null 2>&1
        $ErrorActionPreference = $prevEAP
    }

    $feConn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $feConn) {
        Write-Host "[SGE] Iniciando Frontend Vite em 0.0.0.0:5173..."
        Start-Process -FilePath $npmCmd `
            -ArgumentList "run dev -- --host 0.0.0.0 --port 5173 --strictPort" `
            -WorkingDirectory "$RepoRoot\frontend" `
            -WindowStyle Hidden
    } else {
        Write-Host "[SGE] Frontend Vite ja esta em execucao na porta 5173."
    }

    Write-Host "[SGE] Aguardando disponibilidade do Backend (http://127.0.0.1:5170/api/health)..."
    $backendReady = $false
    for ($i = 1; $i -le 45; $i++) {
        if (Test-BackendHealth) {
            $backendReady = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $backendReady) {
        throw "Tempo limite esgotado aguardando o Backend ficar disponivel em http://127.0.0.1:5170/api/health."
    }
    Write-Host "[SGE] Backend disponivel e saudavel."

    Write-Host "[SGE] Aguardando disponibilidade do Frontend (http://127.0.0.1:5173)..."
    $frontendReady = $false
    for ($i = 1; $i -le 45; $i++) {
        if (Test-FrontendHealth) {
            $frontendReady = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $frontendReady) {
        throw "Tempo limite esgotado aguardando o Frontend ficar disponivel em http://127.0.0.1:5173."
    }
    Write-Host "[SGE] Frontend disponivel em http://localhost:5173."
}

function Show-Status {
    $netInfo = Get-ActiveNetworkInfo
    $lanIp = $netInfo.IPAddress
    $ifAlias = $netInfo.InterfaceAlias
    $envMap = Read-DotEnv (Join-Path $RepoRoot ".env")
    $dbPort = if ($envMap.ContainsKey('DB_PORT') -and $envMap['DB_PORT']) { [int]$envMap['DB_PORT'] } else { 3306 }

    Write-Host "`n=== SITUACAO DOS SERVICOS (CONTAINERS DOCKER) ==="
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & docker compose ps
    $ErrorActionPreference = $prevEAP

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
        $hLocal = Invoke-RestMethod -Uri "http://127.0.0.1:5170/api/health" -TimeoutSec 3
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
        $conns = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
        $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $pids) {
            if ($procId -gt 0) {
                Write-Host "[SGE] Encerrando processo na porta $port (PID $procId)..."
                cmd /c "taskkill /F /T /PID $procId >nul 2>&1"
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

try {
    switch ($Action) {
        'status' {
            Ensure-DockerRunning
            Show-Status
        }
        'seed' {
            Ensure-DockerRunning
            Sync-BackendConfig
            Write-Host "[SGE] Garantindo usuario administrador inicial ('admin') de forma idempotente..."
            $dllPath = Join-Path $RepoRoot "backend\Sge.Api\bin\Debug\net10.0\Sge.Api.dll"
            $prevEAP = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            if (Test-Path $dllPath) {
                & dotnet run --no-build --project "$RepoRoot\backend\Sge.Api\Sge.Api.csproj" -- seed-dev
            } else {
                & dotnet run --project "$RepoRoot\backend\Sge.Api\Sge.Api.csproj" -- seed-dev
            }
            $seedExit = $LASTEXITCODE
            $ErrorActionPreference = $prevEAP
            if ($seedExit -ne 0) {
                throw "Falha ao garantir o usuario administrador inicial ('admin')."
            }
        }
        'reset' {
            Ensure-DockerRunning
            Sync-BackendConfig
            if ($env:ASPNETCORE_ENVIRONMENT -ne 'Development') {
                throw "O comando reset funciona exclusivamente em ambiente de desenvolvimento local (ASPNETCORE_ENVIRONMENT=Development)."
            }
            if (-not $Force) {
                Write-Warning "ATENCAO: Esta operacao apagara TODOS os dados do banco local (sge) e TODOS os objetos do bucket local MinIO (sge-documentos), mantendo apenas o usuario 'admin'."
                $confirm = Read-Host "Digite 'SIM' para confirmar a execucao"
                if ($confirm -cne 'SIM') {
                    Write-Host "[SGE] Operacao de reset cancelada pelo usuario."
                    return
                }
            }
            Write-Host "[SGE] Garantindo que MySQL e MinIO locais estao ativos..."
            $prevEAP = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            & docker compose up -d db minio
            $upExit = $LASTEXITCODE
            $ErrorActionPreference = $prevEAP
            if ($upExit -ne 0) {
                throw "Falha ao iniciar containers db e minio para o reset."
            }
            for ($i = 1; $i -le 60; $i++) {
                $status = Get-ContainerHealthStatus "sge-db-1"
                if ($status -eq "healthy") { break }
                Start-Sleep -Seconds 2
            }
            Write-Host "[SGE] Limpando banco de dados local e recriando exclusivamente o usuario 'admin'..."
            $dllPath = Join-Path $RepoRoot "backend\Sge.Api\bin\Debug\net10.0\Sge.Api.dll"
            $prevEAP = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            if (Test-Path $dllPath) {
                & dotnet run --no-build --project "$RepoRoot\backend\Sge.Api\Sge.Api.csproj" -- reset-dev --confirm
            } else {
                & dotnet run --project "$RepoRoot\backend\Sge.Api\Sge.Api.csproj" -- reset-dev --confirm
            }
            $resetExit = $LASTEXITCODE
            $ErrorActionPreference = $prevEAP
            if ($resetExit -ne 0) {
                throw "Falha ao executar reset-dev no banco de dados local."
            }
            Write-Host "[SGE] Limpando todos os objetos do bucket local MinIO (sge-documentos)..."
            $prevEAP = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            & docker compose run --rm --entrypoint /bin/sh minio-init -ec 'mc alias set sge http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc rm --recursive --force sge/sge-documentos/ >/dev/null 2>&1 || true'
            $ErrorActionPreference = $prevEAP
            Write-Host "[SGE] Reset completo do ambiente local concluido com sucesso (apenas 'admin' cadastrado e bucket MinIO vazio)."
        }
        'stop' {
            Stop-AppProcesses
            if (Test-DockerEngine) {
                Write-Host "[SGE] Parando containers do SGE via Docker Compose (volumes e dados preservados)..."
                $prevEAP = $ErrorActionPreference
                $ErrorActionPreference = 'Continue'
                & docker compose stop
                $stopExit = $LASTEXITCODE
                $ErrorActionPreference = $prevEAP
                if ($stopExit -ne 0) {
                    throw "Falha ao parar os containers do SGE via Docker Compose."
                }
            } else {
                Write-Host "[SGE] Docker Desktop nao esta em execucao (containers ja estao parados)."
            }
            Write-Host "[SGE] Servicos do SGE encerrados com sucesso. Todos os volumes e dados foram preservados."
        }
        'start' {
            Ensure-DockerRunning
            Sync-BackendConfig

            $dbBefore = Get-ContainerHealthStatus "sge-db-1"
            $wasDbMissing = ($dbBefore -eq "missing")

            Write-Host "[SGE] Subindo MySQL e MinIO via Docker Compose..."
            $prevEAP = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            & docker compose up -d db minio minio-init
            $upExit = $LASTEXITCODE
            $ErrorActionPreference = $prevEAP
            if ($upExit -ne 0) {
                throw "Falha ao iniciar os servicos Docker Compose (db, minio, minio-init)."
            }

            Write-Host "[SGE] Aguardando o banco de dados MySQL ficar saudavel..."
            $dbHealthy = $false
            for ($i = 1; $i -le 90; $i++) {
                $status = Get-ContainerHealthStatus "sge-db-1"
                if ($status -eq "healthy") {
                    $dbHealthy = $true
                    break
                }
                if ($status -eq "unhealthy") {
                    throw "O container MySQL (sge-db-1) reportou estado 'unhealthy'. Verifique os logs com 'docker logs sge-db-1'."
                }
                Start-Sleep -Seconds 2
                if (($i * 2) % 10 -eq 0) {
                    Write-Host "[SGE] Aguardando healthcheck do MySQL... ($($i * 2)s / 180s)"
                }
            }
            if (-not $dbHealthy) {
                throw "Tempo limite esgotado aguardando o banco de dados MySQL (sge-db-1) ficar saudavel."
            }
            Write-Host "[SGE] Banco de dados MySQL pronto e saudavel."

            Write-Host "[SGE] Verificando inicializacao do armazenamento MinIO..."
            $minioReady = $false
            for ($i = 1; $i -le 45; $i++) {
                $initState = Get-ContainerExitState "sge-minio-init-1"
                if ($initState -eq "exited:0") {
                    $minioReady = $true
                    break
                }
                if ($initState -match "^exited:([1-9]\d*)$") {
                    throw "Falha na configuracao do bucket MinIO (container sge-minio-init-1 encerrou com codigo $($Matches[1]))."
                }
                Start-Sleep -Seconds 2
            }
            if (-not $minioReady) {
                throw "Tempo limite esgotado aguardando a configuracao do bucket MinIO (sge-minio-init-1)."
            }
            Write-Host "[SGE] Armazenamento MinIO pronto e configurado."

            Start-AppProcesses -DatabaseRecreated:$wasDbMissing
            Show-Status
        }
        'restart' {
            & $PSCommandPath stop
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            & $PSCommandPath start
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
    }
} catch {
    Write-Host "`n[ERRO] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
