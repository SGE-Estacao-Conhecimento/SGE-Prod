# Padrões de Desenvolvimento do Back-end - SGE

Referência obrigatória para todo o back-end (`backend`). Vale para os três módulos,
na ordem definida: **1. Usuário, 2. Almoxarife, 3. Administração**.

Ao iniciar um módulo:

1. Ler este documento.
2. Seguir os padrões abaixo.
3. Registrar na seção 9 qualquer exceção, com justificativa.
4. Atualizar este documento se alguma decisão estrutural mudar.

O início de cada módulo é autorizado pelo responsável do projeto, um módulo de cada vez.

---

## 1. Diretriz geral

Aplicar SOLID de forma **consciente e proporcional** ao tamanho do sistema. O objetivo é um back-end
organizado, modular e fácil de manter. Abstrações, interfaces e camadas só existem quando trazem
benefício concreto; nunca apenas para "cumprir" um princípio.

Na dúvida entre uma solução simples e uma mais elaborada, escolher a simples e registrar o motivo.

## 2. Estrutura de pastas

Organização por domínio (uma pasta por assunto), com as mesmas peças em todos os módulos:

```
backend/
  Program.cs                 Registro de serviços e pipeline HTTP
  Infrastructure/            Itens transversais: conexão, erros, datas, números, classes-base
  <Dominio>/                 Ex.: Pedidos, Materiais, Favoritos, Recebimentos, Usuarios
    <Dominio>Controller.cs   Rotas HTTP
    <Dominio>Service.cs      Regras de negócio (quando houver regra)
    <Dominio>Repository.cs   Acesso ao banco (SQL)
    <Dominio>Dtos.cs         Formatos de requisição e resposta (records)
  DevSeed/                   Dados de teste (somente desenvolvimento)
```

- **Uma classe pública por arquivo.** Exceção: os records de DTO de um domínio ficam juntos em `<Dominio>Dtos.cs`.
- Nomes de classes, métodos e mensagens em português, seguindo o vocabulário do sistema.
- Um domínio só cria `Service` se houver regra de negócio. Consultas simples vão direto do controller ao repository.

## 3. Responsabilidade de cada camada

| Camada | Faz | Não faz |
|---|---|---|
| **Controller** | Recebe a requisição, lê o usuário logado, chama service ou repository, devolve a resposta e o status HTTP | Regra de negócio, SQL, montagem de transação |
| **Service** | Regras de negócio e validações: quem pode fazer o quê, situações permitidas, quantidades, coordenação entre repositórios | SQL, detalhes de HTTP |
| **Repository** | SQL (leitura e gravação), mapeamento para DTOs, transações das próprias gravações | Regra de negócio, decisões de permissão, mensagens de regra |
| **DTOs** | Formato dos dados trocados com o front | Lógica |
| **Infrastructure** | Conexão, tratamento de erros, conversão de datas e números, classes-base | Qualquer coisa específica de um domínio |

**Exemplos de fronteira:**
- "Somente pedidos pendentes podem ser cancelados" é regra: fica no **service**.
- O `UPDATE ... WHERE status = 'pendente'` que executa o cancelamento fica no **repository**.
- O repository informa o resultado (por exemplo, quantas linhas foram afetadas) e o service decide a mensagem.

## 4. SOLID aplicado ao projeto

| Princípio | Regra no SGE |
|---|---|
| **SRP** (responsabilidade única) | Cada classe com um único motivo para mudar (seção 3). Arquivos não misturam controller, regra e SQL. |
| **OCP** (aberto/fechado) | Extensão só com necessidade real. Listas fixas e pequenas (situações do pedido, perfis) continuam com `switch` ou constantes. Não criar uma classe por valor de lista. |
| **LSP** (substituição) | Toda classe derivada precisa funcionar onde a base é esperada: não pode lançar "não suportado", pular validações da base nem mudar o significado dos métodos herdados. |
| **ISP** (interfaces enxutas) | Interfaces pequenas e específicas (ex.: `IEnvioEmail` com um único propósito). Nada de contratos genéricos como "IServico". |
| **DIP** (inversão de dependência) | Abstração para **serviços externos** e componentes com mais de uma implementação real ou de teste (armazenamento de arquivos, e-mail). Repositórios e services do próprio sistema são injetados como classes concretas. |

## 5. Interfaces ou classes abstratas

| Situação | Usar |
|---|---|
| Só há contrato; as implementações não compartilham código | **Interface** |
| Há etapas, validações ou comportamentos comuns a todas as implementações | **Classe abstrata** |
| Há uma única implementação e nenhum benefício de teste ou substituição | **Classe concreta** (sem abstração) |
| A "base" juntaria funções sem relação entre si | Nenhuma: usar classes auxiliares por composição |

### Casos já definidos

**Armazenamento de arquivos (MinIO). Classe abstrata `ArmazenamentoArquivosBase` e `ProcessadorImagemService`.**
- A base executa as etapas exigidas pelo `guia-minIO-conexao-sql.md`, iguais para qualquer destino, apoiada pelo `ProcessadorImagemService`:
  - validação de extensão, assinatura binária (magic bytes) e tamanho;
  - otimização automática de imagens (correção de orientação EXIF, remoção de metadados, redimensionamento proporcional limitado a 1920px sem ampliação, compressão JPEG a 80% para imagens opacas e preservação de formato/canal alfa para PNG e WebP com transparência) e preservação intacta de arquivos que não sejam imagens;
  - cálculo do SHA-256 e do tamanho final no servidor após o processamento;
  - geração de uma chave estável do objeto, nunca a partir de caminhos enviados pelo cliente.
- Só o envio e a leitura do objeto ficam abstratos ("método modelo").
- Implementações: `ArmazenamentoMinio` (real) e `ArmazenamentoEmMemoria` (em `backend.Tests/` para testes automatizados). Ambas herdam as mesmas validações (LSP).

**Envio de e-mail. Interface `IEnvioEmail`.**
- Contrato pequeno (enviar mensagem), sem código compartilhado entre o provedor real e o de teste.
- Usada pela recuperação de senha quando o serviço de e-mail for definido.

**Repositórios. Classe-base `RepositorioBase` (em `Infrastructure/`).**
- Contém somente:
  - abertura de conexão (já em UTC);
  - um auxiliar para executar gravações em transação.
- **Não contém** consultas, regras de negócio nem métodos de um domínio específico.
- Herdar dela é opcional para repositórios só de leitura.

### Operações que envolvem mais de um repositório

Quando uma regra de negócio exige gravar em vários repositórios de forma atômica (ex.: atender pedido = mudar a situação + registrar movimentações + atualizar saldo):
- o service abre a transação pelo auxiliar de infraestrutura e a repassa explicitamente aos métodos dos repositórios envolvidos;
- verificações que precisam de leitura consistente devem virar condições no próprio SQL (ex.: `UPDATE produtos SET quantidade = quantidade - @q WHERE produto_id = @id AND quantidade >= @q`), e o repository devolve o resultado para o service decidir.

Isso **não** é um Unit of Work genérico: é a passagem explícita da transação, usada só nesses casos.

## 6. O que evitar

- SQL dentro de services quando a operação pertence ao repository.
- Controllers com regra de negócio ou acesso ao banco.
- Classes com várias responsabilidades e arquivos com várias classes públicas (exceto DTOs).
- Interfaces com uma única implementação sem benefício concreto.
- Classes-base que concentrem funções sem relação entre si; herança só para reaproveitar um método.
- Repositório genérico (`Repository<T>`), Unit of Work genérico, MediatR, CQRS, AutoMapper ou camadas adicionais sem justificativa registrada na seção 9.
- ORM gerando ou alterando tabelas: o banco é definido por `database/init/01_schema.sql`.

## 7. Convenções já adotadas (manter em todos os módulos)

| Tema | Padrão |
|---|---|
| Acesso a dados | SQL explícito com Dapper + MySqlConnector; colunas `snake_case` mapeadas automaticamente |
| Conexão | `DbConnectionFactory`; toda conexão em UTC; conta `sge_app` (sem permissão de alterar tabelas) |
| Erros | `ApiException` para erros esperados; resposta sempre `{ "message", "errors" }`; erros do banco (regras, duplicidade, chaves) convertidos em mensagens legíveis pelo `ApiExceptionHandler` |
| Autenticação | JWT; todo endpoint exige login por padrão; públicos marcados com `[AllowAnonymous]` |
| Autorização | Perfil lido do token (valores do banco: `admin`, `almoxarifado`, `funcionario`); permissões verificadas no service ou com `[Authorize(Roles = ...)]` |
| Contrato com o front | Rotas e campos já usados pelos serviços do front (`frontend/src/services`); perfis no vocabulário do front (`admin`, `almoxarife`, `usuario`); tradução feita pela API |
| Datas | Gravadas e lidas em UTC; exibidas em America/Sao_Paulo (`AppClock`) |
| Quantidades | `decimal`; zeros à direita removidos nas respostas (`Numeros`) |
| Transações | Gravações relacionadas sempre na mesma transação (ex.: pedido + itens + histórico) |
| Histórico | `pedido_logs` só recebe inclusões; toda mudança de situação de pedido gera um registro |
| Configuração | Segredos só por variáveis de ambiente; a API não inicia sem as configurações obrigatórias |
| Front-end | Modo simulado continua como padrão; a API é usada quando `VITE_API_BASE_URL` está definida |

## 8. Processo por módulo

1. Aguardar a autorização explícita para iniciar o módulo.
2. Consultar este documento e o `backend/README.md`.
3. Mapear as telas e os serviços do front do módulo (o front é a referência de comportamento).
4. Levar para decisão da equipe, antes de implementar, as questões de regra de negócio ou de estrutura do banco.
5. Implementar por etapas, testando cada etapa contra um MySQL real:
   - testes de API;
   - serviços do front executados contra a API;
   - modo simulado continua funcionando.
6. Atualizar o `backend/README.md` (endpoints) e este documento, se algo estrutural mudou.
7. Gerar o relatório do módulo em PDF no padrão dos anteriores.
8. Aguardar autorização para o próximo módulo.

## 9. Situação atual e registro de exceções

### Pontos do Módulo 1 fora do padrão (pendentes de autorização para ajuste)

O Módulo 1 foi implementado antes deste documento. Estes pontos não seguem a seção 3 ou a seção 2 e
serão ajustados somente com autorização, de preferência antes do Módulo 2. Nenhum comportamento muda.

| Ponto | Desvio | Ajuste previsto |
|---|---|---|
| `Pedidos/PedidoService.cs` | Contém SQL (consulta do solicitante e dos materiais, gravação do pedido, itens e histórico) | Mover o SQL para `PedidoRepository`; service fica só com as regras |
| `Favoritos/FavoritosController.cs` | Junta repository e controller; o repository decide "material não encontrado" | Separar os arquivos; a verificação vira regra num service ou no controller |
| `Notificacoes/NotificacoesController.cs` | Junta DTO, service e controller | Separar os arquivos |
| `Auth/AuthController.cs` | Junta DTOs, `AuthController` e `PasswordResetController` | Separar os arquivos |
| Repositórios do Módulo 1 (`AuthRepository`, `FavoritoRepository`, `PedidoRepository`) | Abrem conexão diretamente, sem `RepositorioBase` | Passar a herdar de `RepositorioBase` |
| `PedidoService.RegistrarLogAsync` | Repete o SQL do histórico que agora existe em `PedidoRepository.RegistrarLogAsync` | Usar o método do repository ao mover o SQL do service |

Resolvidos no Módulo 2 (por necessidade do próprio módulo):
- `Materiais/MateriaisController.cs` separado em `MaterialDtos.cs`, `MaterialRepository.cs`, `MaterialService.cs` e `MateriaisController.cs` (o cadastro e a edição precisavam ser acrescentados).
- `RepositorioBase` criada em `Infrastructure/` e usada pelos repositórios novos e pelo `MaterialRepository`.
- `Transacao` criada em `Infrastructure/` para a passagem explícita da transação entre repositórios (seção 5).

### Exceções aprovadas

| Data | Exceção | Justificativa |
|---|---|---|
| 07/11/2026 | O `RemessaService` só é registrado quando o armazenamento está configurado | Permite rodar `seed-dev` sem as variáveis S3; a API normal não inicia sem elas |
| 09/11/2026 | Adição do pacote `SkiaSharp` em `Sge.Api.csproj` e criação do projeto `backend.Tests/Sge.Api.Tests.csproj` (xUnit) | Aprovado para processamento e compressão de imagens no servidor e verificação automatizada dos cenários de imagem e armazenamento |

### Histórico de decisões

| Data | Decisão |
|---|---|
| 06/11/2026 | Adoção de SOLID proporcional como padrão do back-end, com interfaces para contratos sem código comum e classes abstratas para etapas compartilhadas (este documento). |
| 06/11/2026 | Notificações do Usuário derivadas de `pedido_logs`, sem tabela própria, até a equipe decidir quem recebe cada aviso. |
| 07/11/2026 | Recebimento em lote exige foto do material, enviada ao MinIO antes da confirmação; a entrada no estoque ocorre só na confirmação. |
| 07/11/2026 | Entrada manual da tela "Movimentar" gravada como ajuste de entrada com motivo ("Entrada manual: ..."), exibida como entrada. |
| 07/11/2026 | Na entrega do pedido, quem retirou é registrado como o próprio solicitante (a tela não pergunta). |
| 07/11/2026 | Coluna `produtos.bem_duravel`: bens duráveis são entregues sem baixa de saldo. |
| 07/11/2026 | A baixa de estoque da entrega passou do front para a API, na mesma transação da mudança de situação (exigência de `movimentacoes_estoque`, que vincula a saída ao item do pedido). |
| 07/11/2026 | E-mail do usuário opcional (`usuarios.email` aceita vazio e continua único); quem não tem e-mail entra pelo CPF. |
| 07/11/2026 | "Excluir" usuário ou material = desativar. O histórico (pedidos, movimentações, recebimentos) nunca é apagado. |
| 07/11/2026 | O sistema não pode ficar sem administrador ativo: desativar, excluir ou trocar o perfil do último administrador é recusado. |
| 07/11/2026 | Senha com no mínimo 8 caracteres no cadastro, na edição e na troca de senha. |
| 07/11/2026 | Operações que bloqueiam vários registros o fazem sempre na mesma ordem (ex.: administradores ativos antes do usuário alterado), para evitar travamento entre operações simultâneas. |
| 09/11/2026 | Otimização automática de imagens antes do envio ao MinIO (`ProcessadorImagemService` com SkiaSharp): redimensionamento proporcional acima de 1920px, correção de orientação EXIF, remoção de metadados, compressão JPEG 80% para imagens opacas e preservação de PNG/WebP quando houver transparência. |
