# SGE-Prod — Sistema de Gestão e Estoque (Estação Conhecimento)

Guia operacional para configuração, inicialização, execução e manutenção do ambiente 100% local do SGE-Prod.

---

## 1. Arquitetura Local

O ambiente local do SGE é composto por quatro serviços integrados:

- **Frontend:** React 19 + Vite (`http://localhost:5173`)
- **Backend:** ASP.NET Core (`http://localhost:5170`)
- **Banco de Dados:** MySQL 8.4 em contêiner Docker (`127.0.0.1:3307` -> `3306`, volume `sge_db_data`)
- **Armazenamento de Objetos (S3):** MinIO em contêiner Docker (`http://127.0.0.1:9000` API S3 e `http://127.0.0.1:9001` Console Web, volume `sge_minio_data`)

---

## 2. Pré-requisitos

1. **Docker Desktop** (com WSL 2 habilitado no Windows)
2. **.NET SDK** (compatível com o projeto `backend/Sge.Api`)
3. **Node.js** (v20+ ou v24+) e `npm`
4. **PowerShell** (Windows)

---

## 3. Configuração Inicial e Variáveis de Ambiente

### 3.1. Raiz do Repositório (`.env`)

Copie o arquivo `.env.example` para `.env` na raiz do repositório (o arquivo `.env` é ignorado pelo Git):

```env
DB_PORT=3307
DB_PASSWORD=<senha_usuario_sge_app>
DB_ROOT_PASSWORD=<senha_root_mysql>

MINIO_ROOT_USER=sge_admin
MINIO_ROOT_PASSWORD=<senha_admin_minio>

S3_ACCESS_KEY_ID=sge_backend
S3_SECRET_ACCESS_KEY=<segredo_32_caracteres_da_api>

JWT_KEY=<chave_assinatura_jwt_minimo_32_caracteres>
SGE_SEED_SENHA=SgeDevLocal2026!
```

> **Nota sobre a porta do MySQL (`DB_PORT`):** Caso a máquina local já possua o serviço nativo `MySQL80` do Windows ocupando a porta `3306`, utilize `DB_PORT=3307` no `.env` para evitar conflito de porta sem interromper o serviço local do Windows.

### 3.2. Backend (`backend/Sge.Api`)

O backend lê suas configurações obrigatórias via `dotnet user-secrets` (em ambiente `Development`) ou variáveis de ambiente:

- `ConnectionStrings:DefaultConnection`: `Server=127.0.0.1;Port=3307;Database=sge;User=sge_app;Password=<DB_PASSWORD>;`
- `Jwt:Key`: Chave de assinatura JWT com pelo menos 32 caracteres
- `S3_ENDPOINT`: `http://127.0.0.1:9000`
- `S3_BUCKET`: `sge-documentos`
- `S3_REGION`: `us-east-1`
- `S3_FORCE_PATH_STYLE`: `true`
- `S3_ACCESS_KEY_ID`: `sge_backend`
- `S3_SECRET_ACCESS_KEY`: `<S3_SECRET_ACCESS_KEY>`

### 3.3. Frontend (`frontend/.env`)

O arquivo `frontend/.env` (ignorado pelo Git) ativa o modo conectado à API real:

```env
VITE_API_BASE_URL=http://localhost:5170
```

Para utilizar o modo simulado (standalone em memória no navegador), basta deixar `VITE_API_BASE_URL=` vazio.

---

## 4. Comandos de Inicialização e Operação Diária

O repositório inclui o script utilitário `scripts/sge-local.ps1` para gerenciar a infraestrutura local:

### 4.1. Iniciar Infraestrutura (Docker, MySQL e MinIO)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sge-local.ps1 start
```

### 4.2. Verificar Estado dos Contêineres e Portas

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sge-local.ps1 status
```

### 4.3. Executar o Seeder de Desenvolvimento (`seed-dev`)

Com o banco recém-criado e vazio, popule os setores, funcionários, usuários, materiais e saldos iniciais:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sge-local.ps1 seed
```

Ou diretamente via CLI do .NET:

```powershell
$env:SGE_SEED_SENHA="SgeDevLocal2026!"
dotnet run --project backend/Sge.Api/Sge.Api.csproj -- seed-dev
```

### 4.4. Iniciar Backend e Frontend

Em dois terminais separados:

**Terminal 1 — Backend API (`http://localhost:5170`):**
```powershell
cd backend/Sge.Api
dotnet run --urls "http://localhost:5170"
```

**Terminal 2 — Frontend Vite (`http://localhost:5173`):**
```powershell
cd frontend
npm run dev
```

### 4.5. Parar e Reiniciar Sem Perder Dados

- **Parar serviços preservando volumes:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\sge-local.ps1 stop
  ```
- **Reiniciar serviços:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\sge-local.ps1 restart
  ```

> **Importante:** Nunca utilize `docker compose down -v` caso deseje preservar os dados do banco e as fotografias das remessas armazenadas no MinIO.

---

## 5. Endereços Locais de Acesso

| Componente | Endereço Local | Observação |
| :--- | :--- | :--- |
| **Frontend (Aplicação Web)** | `http://localhost:5173` | Interface React para Usuário, Almoxarife e Administração |
| **Backend (API REST)** | `http://localhost:5170` | Endpoints `/api/*` |
| **Healthcheck da API** | `http://localhost:5170/api/health` | Retorna `{"status":"ok"}` |
| **MinIO API (S3)** | `http://127.0.0.1:9000` | Bucket privado `sge-documentos` |
| **MinIO Console Web** | `http://127.0.0.1:9001` | Painel administrativo do MinIO |
| **MySQL 8.4 (Docker)** | `127.0.0.1:3307` | Banco `sge` (usuário da aplicação: `sge_app`) |

---

## 6. Credenciais de Desenvolvimento (Seeder)

Após executar o `seed-dev`, todos os usuários de teste utilizam a senha definida em `SGE_SEED_SENHA` (padrão local: `SgeDevLocal2026!`) e podem autenticar por **e-mail** ou **CPF**:

| Perfil | Nome | E-mail | CPF de Teste | Setor |
| :--- | :--- | :--- | :--- | :--- |
| **Administrativo** (`admin`) | Arthur Vequi | `arthur.vequi@estacao.org.br` | `00000000007` | Diretoria / TI |
| **Almoxarifado** (`almoxarifado`) | Ana Beatriz | `ana.beatriz@estacao.org.br` | `00000000006` | Almoxarifado Central |
| **Solicitante** (`funcionario`) | Carlos Silva | `carlos.silva@estacao.org.br` | `00000000001` | Educação Infantil |
| **Solicitante** (`funcionario`) | Mariana Costa | `mariana.costa@estacao.org.br` | `00000000002` | Ensino Fundamental |
| **Solicitante** (`funcionario`) | Roberto Souza | `roberto.souza@estacao.org.br` | `00000000003` | Coordenação |

---

## 7. Preservação e Backup dos Dados Locais

### 7.1. Volumes Docker Persistentes

- `sge_db_data`: Armazena os arquivos de dados do MySQL 8.4 (`/var/lib/mysql`).
- `sge_minio_data`: Armazena os buckets e objetos enviados ao MinIO (`/data`).

### 7.2. Realizar Backup do Banco de Dados MySQL

```powershell
docker exec sge-db-1 sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -u root --routines --triggers --single-transaction sge' > backup_sge_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql
```

### 7.3. Realizar Backup dos Objetos do MinIO

```powershell
docker run --rm --volumes-from sge-minio-1 -v "${PWD}:/backup" debian:bookworm-slim tar czf /backup/backup_minio_data.tar.gz /data
```
