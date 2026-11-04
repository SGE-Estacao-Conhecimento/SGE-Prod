# SGE — Banco, conexões e integração de documentos

## Objetivo e estado atual

Orientar a implementação do backend C# quanto ao banco MySQL, às regras de estoque e à futura integração com o Cloudflare R2.

O MySQL e a API serão executados em containers na VPS. Fotos e documentos ficarão em um bucket privado no R2, externo à VPS. O bucket ainda não foi criado porque o acesso à conta do projeto está pendente.

Os exemplos de SQL e configuração discutidos ainda não foram executados nem validados neste ambiente. Recebimentos, documentos, estornos e alguns vínculos descritos abaixo ainda precisam ser consolidados no schema. Este documento distingue essas necessidades do modelo já esboçado; não pressupõe que tudo esteja implementado.

## Conexão da API com o MySQL

Dentro da rede do Docker Compose, a API deve acessar:

| Parâmetro | Valor definido |
|---|---|
| Servidor | `db`, nome do serviço MySQL no Compose |
| Porta interna | `3306` |
| Banco | `sge` |
| Usuário inicial | `sge_app` |
| Senha | Fornecida pelo ambiente, nunca pelo código |

Dentro do container da API, `localhost` aponta para a própria API, não para o MySQL. Portanto, usar `db` como servidor. Ferramentas executadas na própria máquina podem usar a porta publicada em `127.0.0.1`, se essa publicação estiver habilitada. O MySQL não deve ter acesso público.

O Compose fornecerá `ConnectionStrings__DefaultConnection`. O ASP.NET Core interpreta esse nome como `ConnectionStrings:DefaultConnection`; o backend precisa ler essa conexão ao configurar o acesso ao banco.

Usar o construtor de conexão do driver ao montar conexões a partir de parâmetros separados, para tratar corretamente caracteres especiais nas senhas. Não registrar strings de conexão ou segredos nos logs.

### Variáveis de configuração

| Variável | Destino e função |
|---|---|
| `DB_PASSWORD` | Segredo usado pelo Compose para preencher a senha da aplicação |
| `DB_ROOT_PASSWORD` | Segredo administrativo do MySQL, diferente da senha da aplicação |
| `MYSQL_DATABASE` | Inicialização do MySQL: `sge` |
| `MYSQL_USER` | Inicialização do MySQL: `sge_app` |
| `MYSQL_PASSWORD` | Inicialização do MySQL: recebe `DB_PASSWORD` |
| `MYSQL_ROOT_PASSWORD` | Inicialização do MySQL: recebe `DB_ROOT_PASSWORD` |
| `ConnectionStrings__DefaultConnection` | Conexão entregue ao container da API |

O `.env` fornece valores para interpolação do Compose; isso não injeta automaticamente todas as variáveis nos containers. Cada serviço deve receber explicitamente apenas sua configuração necessária.

As variáveis de inicialização da imagem MySQL criam banco e contas somente com o diretório de dados vazio. Alterar a senha no ambiente não modifica uma conta existente. Antes de produção, separar a conta usada pela aplicação da conta usada para migrações e restringir seus privilégios. A API não deve usar root.

O provedor MySQL, o Entity Framework e a versão do .NET precisam ter compatibilidade confirmada. O backend deve lidar com indisponibilidade transitória do banco; a ordem de inicialização dos containers não substitui esse tratamento.

## Cadastros principais

| Tabela | Responsabilidade |
|---|---|
| `setor` | Cadastro único dos setores |
| `funcionarios` | Pessoas envolvidas nas operações, vinculadas ao setor |
| `usuarios` | Contas de acesso, e-mail único, hash de senha, perfil e vínculo com funcionário |
| `produtos` | Código único, nome, unidade de controle, saldo, mínimo e situação ativa |

Padronizar a chave de funcionário como `funcionario_id`. A referência de setor em funcionários deve apontar para `setor(setor_id)`.

Desativar funcionários, usuários e produtos com histórico em vez de excluí-los. A mudança de setor de um funcionário não deve modificar relatórios históricos: registrar o setor da operação quando essa informação for necessária.

### Pessoas envolvidas e autoria

Cada movimentação precisa distinguir:

- `funcionario_entrega_id`: pessoa que entregou o material.
- `funcionario_recebe_id`: pessoa que recebeu o material.
- `usuario_registro_id`: conta autenticada que registrou a operação.

O backend deve obter a autoria da identidade autenticada, sem confiar em um identificador de autor enviado livremente pelo cliente. Selecionar um funcionário não comprova que ele confirmou a operação. Se houver dupla confirmação, registrar separadamente o usuário e o horário de cada confirmação.

Compras e doações podem envolver uma contraparte externa. Não criar um funcionário fictício para representar fornecedor ou doador; representar a origem externa de forma própria.

### Quantidades e unidades

Usar unidade de controle consistente por produto e decimal exato para quantidades fracionadas, com a mesma precisão em produtos e movimentações. Não usar ponto flutuante para quantidades ou valores financeiros.

Se uma caixa contém 12 unidades e a distribuição ocorre individualmente, converter o recebimento para 12 unidades. Registrar o saldo inicial por uma entrada, para que seja possível reconstruir o saldo pelo histórico.