# SGE - Back-end (API)

API em ASP.NET Core (.NET 10) que atende o front-end do SGE usando o banco MySQL
definido em `database/init/01_schema.sql`.

Padrões de arquitetura e organização: ver [`PADROES_DESENVOLVIMENTO.md`](../PADROES_DESENVOLVIMENTO.md)
(leitura obrigatória antes de cada módulo).

## Estrutura

```
backend/Sge.Api/
  Program.cs            Configuração: banco, autenticação, CORS, erros, limites de login
  Infrastructure/       Conexão com o banco, tratamento de erros, datas e números
  Auth/                 Login (e-mail ou CPF), token JWT, perfis, alteração de senha
  Materiais/            Catálogo de materiais
  Favoritos/            Favoritos do usuário
  Pedidos/              Criação, listagem e cancelamento de pedidos
  Notificacoes/         Avisos derivados do histórico de pedidos (pedido_logs)
  DevSeed/              Carga de dados de teste (somente desenvolvimento)
```

Cada pasta reúne o controller (rotas), o acesso ao banco (SQL com Dapper) e os formatos de resposta.
O SQL fica explícito no código; o banco continua sendo criado pelo script do projeto.

## Configuração

Nenhum segredo fica no repositório. Informe por variáveis de ambiente:

| Variável | Exemplo | Obrigatória |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | `Server=127.0.0.1;Port=3306;Database=sge;User ID=sge_app;Password=...` | Sim |
| `Jwt__Key` | texto aleatório com 32 caracteres ou mais | Sim |
| `Cors__Origens__0` | `http://localhost:5173` (padrão já configurado) | Não |
| `ASPNETCORE_ENVIRONMENT` | `Development` | Não |

A API não inicia se a conexão ou a chave do token estiverem ausentes.
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

Erros seguem sempre o formato `{ "message": "...", "errors": { ... } }`.
