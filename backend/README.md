# SGE - Back-end (API)

API em ASP.NET Core (.NET 10) que atende o front-end do SGE usando o banco MySQL
definido em `database/init/01_schema.sql`.

Padrões de arquitetura e organização: ver [`PADROES_DESENVOLVIMENTO.md`](../PADROES_DESENVOLVIMENTO.md)
(leitura obrigatória antes de cada módulo).

## Estrutura

```
backend/Sge.Api/
  Program.cs            Configuração: banco, autenticação, CORS, erros, limites de login
  Infrastructure/       Conexão, transação, erros, datas, números, RepositorioBase
    Armazenamento/      Fotos no MinIO: validação, SHA-256 e chave na base; envio pelo SDK S3
  Auth/                 Login (e-mail ou CPF), token JWT, perfis, alteração de senha
  Materiais/            Catálogo, cadastro e edição de materiais
  Estoque/              Saldo e histórico: entrada manual, balanço, listagem de movimentações
  Favoritos/            Favoritos do usuário
  Pedidos/              Pedidos do usuário e atendimento pelo almoxarifado (entrega com baixa)
  Remessas/             Recebimento em lote e doações, com fotos obrigatórias
  Usuarios/             Lista de usuários; cadastro, edição, status e exclusão (administração)
  Setores/              Setores ativos para o cadastro de usuários
  Dashboard/            Indicadores da tela inicial da administração
  Notificacoes/         Avisos derivados do histórico de pedidos (pedido_logs)
  DevSeed/              Carga de dados de teste (somente desenvolvimento)
```

Cada pasta reúne o controller (rotas), o service (regras), o repository (SQL com Dapper) e os formatos de resposta.
O SQL fica explícito no código; o banco continua sendo criado pelo script do projeto.

## Configuração

Nenhum segredo fica no repositório. Informe por variáveis de ambiente:

| Variável | Exemplo | Obrigatória |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | `Server=127.0.0.1;Port=3306;Database=sge;User ID=sge_app;Password=...` | Sim |
| `Jwt__Key` | texto aleatório com 32 caracteres ou mais | Sim |
| `Cors__Origens__0` | `http://localhost:5173` (padrão já configurado) | Não |
| `ASPNETCORE_ENVIRONMENT` | `Development` | Não |
| `S3_ENDPOINT` | `http://minio:9000` (no Docker) ou `http://localhost:9000` | Sim |
| `S3_BUCKET` | `sge-documentos` | Sim |
| `S3_REGION` | `us-east-1` (padrão) | Não |
| `S3_FORCE_PATH_STYLE` | `true` (padrão) | Não |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | conta exclusiva da API no MinIO (nunca a de administrador) | Sim |

A API não inicia se a conexão, a chave do token ou o armazenamento estiverem ausentes.
O bucket é criado pela infraestrutura (`minio-init` do `compose.yml`), não pela API.
Usar a conta `sge_app` (sem permissão de alterar tabelas), nunca `root`.

## Como executar

```bash
cd backend/Sge.Api
dotnet run --launch-profile http        # API em http://localhost:5170
```

Dados de teste (somente em banco vazio e com `ASPNETCORE_ENVIRONMENT=Development`):

```bash
SGE_SEED_SENHA="senha-de-teste" dotnet run -- seed-dev
```

Cria os setores, os 8 usuários e os 13 materiais de `frontend/src/data/demoData.js`.
Todos os usuários recebem a senha informada; os CPFs são fictícios (`00000000001` a `00000000008`).

Para o front usar a API, crie `frontend/.env` com `VITE_API_BASE_URL=http://localhost:5170`
(veja `frontend/.env.example`). Sem essa variável o front continua no modo simulado.

## Endpoints implementados (Módulo 1 - Usuário)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | público | Login por e-mail ou CPF; devolve dados do usuário e token |
| POST | `/api/auth/logout` | público | Encerramento (o front apaga o token) |
| POST | `/api/auth/alterar-senha` | logado | Confere a senha atual e grava a nova (mínimo de 6 caracteres) |
| POST | `/api/password-reset/request` e `/confirm` | público | Responde 501: depende de serviço de e-mail ainda não definido |
| GET | `/api/materiais?apenasAtivos=true` | logado | Catálogo; inativos só para a equipe |
| GET | `/api/favoritos` | logado | IDs favoritados pelo usuário |
| PUT | `/api/favoritos/{produtoId}` | logado | Marca ou desmarca o favorito |
| GET | `/api/pedidos/meus` | logado | Pedidos do usuário logado |
| POST | `/api/pedidos` | logado | Cria pedido em lote; a equipe pode informar `solicitanteId` |
| DELETE | `/api/pedidos/{id}` | logado | Cancela pedido pendente do próprio usuário |
| GET | `/api/notificacoes` | logado | Avisos dos pedidos do usuário |
| GET | `/api/health` | público | Verificação de funcionamento |

## Endpoints implementados (Módulo 2 - Almoxarife)

"Equipe" = perfis almoxarifado e admin.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/pedidos?status=` | equipe | Fila de pedidos (filtro opcional pela situação) |
| PATCH | `/api/pedidos/{id}/status` | equipe | Esteira: Novos, Separação, Prontos, Entrega; recusa com motivo. Na entrega, baixa de estoque na mesma transação |
| POST | `/api/materiais` | equipe | Cadastro; o saldo inicial vira movimentação "Saldo inicial cadastrado" |
| PUT | `/api/materiais/{id}` | equipe | Edição dos dados cadastrais (o saldo não muda por aqui) |
| GET | `/api/movimentacoes?tipo=&produtoId=` | equipe | Histórico de estoque |
| POST | `/api/movimentacoes` | equipe | Entrada manual (gravada como ajuste de entrada); saídas avulsas são recusadas |
| POST | `/api/movimentacoes/ajuste` | equipe | Balanço: define o novo saldo e registra a diferença |
| GET | `/api/remessas` | equipe | Recebimentos e doações |
| POST | `/api/remessas` | equipe | Cria o recebimento em preparação (repetível pelo `identificadorOperacao`) |
| POST | `/api/remessas/{id}/fotos` | equipe | Envia uma foto (multipart, campo `arquivo`; JPG/PNG/WEBP até 10 MB; até 10 por recebimento) |
| POST | `/api/remessas/{id}/confirmar` | equipe | Confirma (exige foto) e dá entrada no estoque, uma única vez |
| GET | `/api/remessas/{id}/fotos/{anexoId}` | equipe | Exibe a foto (transmitida pela API) |
| GET | `/api/usuarios` | equipe | Lista de usuários, somente leitura (sem CPF) |

## Endpoints implementados (Módulo 3 - Administração)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/usuarios` | equipe | Lista de usuários; o CPF só é enviado à administração |
| POST | `/api/usuarios` | admin | Cadastro (CPF obrigatório, e-mail opcional, senha com 8 caracteres ou mais) |
| PUT | `/api/usuarios/{id}` | admin | Edição; senha em branco mantém a atual |
| PATCH | `/api/usuarios/{id}/status` | admin | Ativa ou desativa a conta |
| DELETE | `/api/usuarios/{id}` | admin | "Excluir": desativa a conta, preservando o histórico |
| DELETE | `/api/materiais/{id}` | admin | "Excluir": retira o material do catálogo, preservando o histórico |
| GET | `/api/setores` | equipe | Setores ativos |
| GET | `/api/dashboard` | admin | Indicadores da tela inicial |

O sistema recusa (409) qualquer alteração que deixe nenhum administrador ativo.

## Scripts para bancos existentes

Bancos criados antes de 07/11/2026 precisam, nesta ordem, de:

1. `database/alteracoes/2026-11-07_produtos_bem_duravel.sql`
2. `database/alteracoes/2026-11-07_usuarios_email_opcional.sql`

Erros seguem sempre o formato `{ "message": "...", "errors": { ... } }`.
