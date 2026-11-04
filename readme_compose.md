# Compose do SGE com MinIO

API e frontend não foram implementados por este pacote.

## Preparar

1. Coloque compose.yml na raiz do projeto e copie .env.example para .env, sem sobrescrever valores privados existentes.
2. Preencha quatro senhas diferentes e fortes: DB_PASSWORD, DB_ROOT_PASSWORD, MINIO_ROOT_PASSWORD e S3_SECRET_ACCESS_KEY. Mantenha o usuário da API diferente do administrador.
3. Inclua .env no .gitignore e exclua-o dos contextos de build. Nunca publique a saída completa de docker compose config: ela pode revelar segredos. Use config --quiet.
4. Valide: `docker compose config --quiet`.
5. Suba a base: `docker compose up -d`. Confira `docker compose ps -a` e `docker compose logs minio-init`.

O inicializador cria sge-documentos privado e configura a conta da API com leitura/escrita nesse bucket, sem exclusão de objetos ou administração. O estado final esperado para minio-init é Exited (0); ele é uma tarefa de configuração, não um servidor.

O MySQL inicia vazio. Aplicar o schema validado ou migrações separadamente; este Compose não monta automaticamente scripts que possam estar ausentes. Inicialização de usuários do MySQL só ocorre em volume vazio. Trocar variáveis não troca senhas de contas já existentes.

## Backend

O perfil app evita tentar construir um backend ainda ausente. Quando backend/Dockerfile e o projeto existirem, use `docker compose --profile app up -d --build`.

A API usa db:3306 e http://minio:9000. Configurar o SDK S3 com região us-east-1 e ForcePathStyle=true. Os nomes S3_* são um contrato de configuração e precisam ser lidos pelo código C#. Credenciais administrativas não são fornecidas à API.

URLs assinadas com hostname minio não abrem no navegador externo. Nesta base, enviar/baixar arquivos através da API, que verifica autorização e transmite o conteúdo. URLs externas assinadas exigirão endpoint HTTPS e configuração próprios, ainda não implementados.

Não gerar caminhos a partir de nomes de arquivos sem validação: usar identificadores únicos e guardar a chave no MySQL. A conta da API pode sobrescrever objetos com PutObject; evitar reutilizar chaves. Política privada e ausência de DeleteObject não substituem backup nem armazenamento imutável.

## Acesso administrativo e publicação

Acessos locais: MySQL 127.0.0.1:3306, S3 127.0.0.1:9000 e console 127.0.0.1:9001, se a versão da imagem disponibilizar console. A configuração pode ser administrada por mc mesmo sem console completo.

Na VPS, use túnel SSH para administração. Exemplo: `ssh -L 9001:127.0.0.1:9001 usuario@servidor`. Não abrir essas portas publicamente. Frontend e proxy HTTPS ainda não estão incluídos porque seus arquivos de publicação não foram definidos. A API também fica restrita ao host até configurar esse proxy.

As imagens MinIO/mc usam latest como ponto inicial. Fixar tags ou digests após validar disponibilidade, manutenção, funcionalidades e compatibilidade na arquitetura da VPS; a validação YAML não valida imagens nem o serviço em execução.

## Dados e recuperação

Volumes mysql_data e minio_data preservam dados ao recriar containers. `docker compose down` preserva volumes; `docker compose down -v` apaga-os. Manter backup externo coordenado de banco e objetos e testar restauração. Não usar dados reais antes de definir isso.

O nome do projeto Compose é sge. Antes de iniciar em uma máquina com implantação anterior chamada sge, conferir volumes e serviços existentes para evitar reutilização involuntária ou conflitos de portas. Não executar sobre produção sem revisar.
