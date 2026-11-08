# Workspace Rules: SGE-Prod

## 1. Regras Invioláveis

1. **Proibição de emojis.** É proibido usar emojis ou símbolos Unicode
   decorativos (incluindo setas, checks e marcas equivalentes) em código,
   componentes React, textos de interface, rótulos, botões, badges, modais,
   toasts, comentários, logs, mensagens de commit e documentação. Representação
   gráfica deve usar apenas SVG inline, componentes do design system ou texto limpo.
2. **Padrões do back-end.** Todo desenvolvimento em `backend/` segue
   `PADROES_DESENVOLVIMENTO.md`. Consulte-o antes de iniciar qualquer módulo
   ou funcionalidade nova, registre exceções com justificativa e atualize-o
   quando uma decisão estrutural mudar.
3. **Autorização para escopo novo.** Os módulos Usuário, Almoxarife e
   Administração já possuem implementação no back-end. Novos módulos ou
   funcionalidades de grande porte só são iniciados com autorização explícita,
   um de cada vez.
4. **Segredos.** Nunca versionar, imprimir em log ou expor em interface
   credenciais, tokens, chaves ou dados pessoais. Segredos vêm de variáveis
   de ambiente ou `dotnet user-secrets`. Não crie arquivos `appsettings*.json`
   com valores sensíveis, e não grave valores em `appsettings.json`
   (as chaves `ConnectionStrings:DefaultConnection` e `Jwt:Key` ficam vazias).

## 2. Fonte da Verdade

Ordem de precedência para o estado atual do sistema:

1. Scripts SQL (`database/init/01_schema.sql` e `database/alteracoes/`)
2. Código-fonte e arquivos de configuração/manifestos
3. Documentação (`PADROES_DESENVOLVIMENTO.md`, Obsidian Brain)

Diretrizes:
- Não presuma que a documentação está atualizada; verifique a implementação.
- Não invente funcionalidades, estruturas ou decisões técnicas sem
  fundamento no projeto.
- Ao encontrar divergência entre documentação e implementação, a implementação
  define o estado atual e a documentação deve ser corrigida.
- Exceção: se a divergência parecer um bug (o código contradiz a intenção
  documentada ou o comportamento esperado), reporte antes de atualizar a
  documentação. Não normalize erros por escrito.
- Decisões aprovadas e ainda não implementadas devem constar como
  "planejadas", nunca como funcionalidades existentes.

## 3. Postura Analítica

- Julgue decisões de arquitetura, fluxo e interface de forma técnica e
  imparcial. Não concorde por padrão: aponte prós, contras, heurísticas de
  usabilidade violadas e riscos operacionais.
- O rigor é proporcional ao impacto. Ajustes triviais dispensam análise
  formal; mudanças de arquitetura, fluxo ou dados exigem a análise antes
  de implementar.
- Após apresentar a crítica, se o desenvolvedor mantiver a decisão, implemente-a
  conforme solicitado e registre o risco conhecido. Não insista nem
  reimplemente por conta própria.
- Discordância deve ser fundamentada. Não critique por obrigação.

## 4. Antes de Implementar

1. Inspecione o código existente antes de escrever qualquer coisa.
2. Procure componentes, serviços, repositórios, utilitários, hooks e
   dependências já existentes.
3. Prefira estender implementações existentes a duplicar funcionalidade.
4. Siga os padrões arquiteturais e convenções de nomenclatura estabelecidos.
5. Evite novas dependências e abstrações sem necessidade comprovada. Toda
   dependência nova deve ser justificada e aprovada.
6. Considere o impacto da mudança no restante da aplicação.
7. Resolva o problema atual de forma simples e sustentável. Não otimize
   nem generalize para requisitos hipotéticos.

## 5. Planejamento

Uma mudança é **média ou grande** quando ocorre qualquer um destes casos:
toca mais de um módulo, altera schema do banco, muda contrato de API,
altera autenticação/autorização (JWT, perfis), ou afeta mais de ~5 arquivos.

Nesses casos, antes de codificar:
- Analise a arquitetura atual e liste módulos e dependências afetados.
- Identifique conflitos e lógica duplicada.
- Avalie compatibilidade retroativa.
- Apresente o plano com os trade-offs e aguarde aprovação.

Mudanças pequenas podem ser implementadas diretamente.

## 6. Qualidade de Código

- Mantenha a lógica de negócio separada da apresentação.
- Preserve a separação de responsabilidades existente no back-end
  (controllers, services, repositories, DTOs).
- Reutilize validação e tratamento de erros existentes (por exemplo,
  `ApiException`).
- Mantenha contratos de API consistentes entre back-end e front-end.
- Todo SQL deve ser parametrizado (parâmetros do Dapper). Nunca concatenar
  ou interpolar entrada externa em string SQL.
- Não introduza warnings novos de lint ou de compilação (incluindo nulidade
  em C#). Não corrija warnings antigos fora do escopo da tarefa.
- O projeto não possui infraestrutura de testes (front-end e back-end). Não
  adicione frameworks de teste (Vitest, xUnit etc.) sem aprovação explícita;
  contam como dependência nova (seção 4).
- Atualize a documentação quando a arquitetura mudar.

## 7. Banco de Dados (MySQL, Dapper, sem ferramenta de migration)

Estrutura:
- `database/init/01_schema.sql`: schema consolidado, executado automaticamente
  no primeiro boot do container MySQL (volume em `compose.yml`).
- `database/alteracoes/`: scripts para bancos já existentes, nomeados
  `YYYY-MM-DD_descricao_em_snake_case.sql`.

Regras:
- Examine `01_schema.sql` e o histórico de `database/alteracoes/` antes de
  qualquer mudança de schema.
- Toda mudança de schema exige duas coisas, sempre juntas: atualizar
  `01_schema.sql` (para bancos novos) e criar um script novo em
  `database/alteracoes/` (para bancos existentes).
- Nunca edite scripts de `database/alteracoes/` já existentes.
- O cabeçalho do script deve informar a quem se aplica, se altera dados
  existentes e que deve ser executado com conta de migração (nunca com
  `sge_app`).
- O agente não aplica scripts no banco sem autorização explícita; apenas
  cria o arquivo e descreve como aplicá-lo.
- Alterações destrutivas (drop, mudança de tipo, perda de dados) exigem
  confirmação explícita e estratégia de reversão descrita no script.

## 8. Verificação Final

Antes de concluir uma tarefa:
- Verifique duplicação de funcionalidade e consistência arquitetural.
- Confirme que funcionalidades existentes continuam funcionando.
- Registre decisões arquiteturais importantes na documentação.

Front-end (rodar em `frontend/`):
- `npm run lint` (obrigatório; sem warnings novos)
- `npm run build` (obrigatório; confirma que o projeto compila)

Back-end (rodar em `backend/`, projeto único `Sge.Api.csproj`, sem `.sln`):
- `dotnet build` (obrigatório; exige SDK .NET 10; o compilador C# já valida
  os tipos)

Limitações conhecidas:
- Não existem testes automatizados em nenhuma camada. Não existe `npm test`
  nem projeto de testes .NET; não tente executar `dotnet test` nem presuma
  que passou.
- O front-end é JavaScript puro e não possui typecheck. O build confirma
  apenas que o código compila, não a integridade de contratos de dados.
- A verificação funcional é manual: descreva o que foi conferido e como
  (endpoint, tela, fluxo, caso de borda).
- Não use `dev`, `preview` ou `start` como verificação; são comandos de
  execução e mantêm o terminal ocupado.

**Nunca afirme que lint, build ou qualquer verificação passou sem tê-la
executado.** Se algo não foi executado ou não pôde ser verificado, diga
explicitamente.

## 9. Escopo e Comunicação

- Altere apenas o que a tarefa exige. Refatorações ou correções fora do escopo
  devem ser sugeridas, não aplicadas.
- Idioma: português do Brasil para textos de interface, mensagens da API,
  mensagens de commit, documentação e nomes de domínio (classes, tabelas e
  colunas em snake_case). Infraestrutura técnica segue o padrão existente
  em inglês (por exemplo, `DbConnectionFactory`, `ApiException`).
- Commits seguem o padrão já usado no repositório: prefixo convencional
  (`feat:`, `fix:`, `docs:`) seguido de descrição em português.
- Ao concluir, informe: o que foi alterado, o que foi verificado, o que não
  foi verificado e riscos remanescentes.