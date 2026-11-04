# SGE — Armazenamento de testes e integração com o backend

## 1. Escopo e estado atual

Este é exclusivamente um ambiente de testes no GitHub Codespaces, no projeto SGE-Prod. Ainda não existe VPS implantada. Usar arquivos fictícios, sem dados pessoais ou documentos reais da instituição.

O armazenamento foi compilado do código oficial do MinIO e testado pelo responsável pelo projeto. Os resultados abaixo foram relatados no terminal do Codespaces; não representam uma validação completa do backend ou de produção.

Arquitetura planejada:

```text
Frontend → API C# → MySQL: registros, responsáveis e vínculos
                 → MinIO: arquivos privados
```

O navegador não recebe as credenciais S3 nem acessa o banco. O backend é responsável pela autorização e pela associação entre arquivos e operações de negócio.

## 2. Serviços e imagens

| Serviço | Função |
|---|---|
| db | MySQL 8.4; armazenamento dos dados estruturados |
| minio | Servidor S3 privado, com volume minio_data |
| minio-init | Tarefa administrativa que cria o bucket e a conta da API; termina após executar |
| api | Quando implementada: autenticação, regras do negócio, acesso a banco e arquivos |

O Compose entregue diretamente no chat contém db, minio e minio-init. Uma versão anterior também contém api no perfil app. Conferir o arquivo real antes de tentar subir a API; não pressupor que o backend já existe.

Imagens:

- MySQL: mysql:8.4.
- MinIO: sge/minio:local, construída por infra/minio/Dockerfile.
- Cliente mc: sge/minio-mc:local, construída por infra/minio-mc/Dockerfile.

Os builds usam código oficial fixado nos commits:

- MinIO: 7aac2a2c5b7c882e68c1ce017d8256be2feea27f.
- mc: 77f82e18b5401a65958f1619df6ebb994634bd88.

Não dependem das imagens minio/*:latest ou quay.io/minio/*:latest que falharam durante a preparação. A primeira compilação exige rede para imagens-base, GitHub e módulos Go; pode levar vários minutos. Manter validação TLS e de módulos. Não usar --no-cache sem motivo.

## 3. Configuração privada

O .env ao lado do Compose deve conter os nomes abaixo. Valores vazios são apenas o modelo, não uma configuração executável:

```dotenv
DB_PASSWORD=
DB_ROOT_PASSWORD=
MINIO_ROOT_USER=sge_admin
MINIO_ROOT_PASSWORD=
S3_ACCESS_KEY_ID=sge_backend
S3_SECRET_ACCESS_KEY=
```

Regras:

- Preencher as quatro senhas com valores fortes e diferentes. Para gerar uma, executar `openssl rand -hex 24`; repetir para cada senha.
- Usuário administrativo e conta da API devem ser diferentes.
- O MinIO exige usuário administrativo com pelo menos 3 caracteres e senha com pelo menos 8; para o projeto, usar senhas aleatórias longas. A chave curta `123` foi rejeitada durante os testes.
- Não versionar .env, não copiar para imagens e não enviar credenciais em mensagens ou logs.
- O .env é lido pelo Compose para interpolação; a API só recebe variáveis explicitamente mapeadas em seu serviço. Um processo C# iniciado fora do Docker não carrega esse arquivo automaticamente.
- Variáveis exportadas no terminal podem sobrescrever o .env. Se a correção não surtir efeito, conferir presença/comprimento e precedência sem imprimir valores.
- Alterar variáveis de inicialização do MySQL não altera as senhas de um banco já inicializado.

## 4. Como iniciar corretamente

Executar os comandos na pasta que contém compose.yml e .env.

### Validar e construir

```bash
docker compose config --quiet
docker compose --progress plain build minio
docker compose --progress plain build minio-init
```

O modo plain mostra a etapa real caso haja demora. A compilação do servidor observada levou cerca de 6 minutos e 21 segundos, sem que isso estabeleça um tempo garantido para outros ambientes.

### Iniciar o servidor e criar o bucket

```bash
docker compose up -d --no-build minio
curl -I http://localhost:9000/minio/health/live
docker compose run --rm --no-deps minio-init
```

Se a saúde ainda não responder, aguardar alguns segundos e verificar os logs antes de executar o inicializador.

Resultados esperados:

- Saúde: HTTP 200.
- Inicializador: mensagem de bucket privado e usuário da API configurados, com código de saída zero.

O comando run usa um container temporário removido ao terminar. Por isso, ele não precisa aparecer depois em `docker compose ps -a`. Caso o inicializador seja iniciado por up, ele deve aparecer encerrado com código zero.

A versão do Compose usada pelo responsável rejeitou --no-build em `docker compose run`. Não usar essa opção nos comandos run deste guia. O --no-build acima é usado somente com up.