
### 6.5 Persistência após recriação

Depois de enviar o texto fictício:

```bash
docker compose up -d --force-recreate minio
```

Aguardar saúde HTTP 200 e ler o objeto:

```bash
docker compose run --rm --no-deps --entrypoint /bin/sh minio-init -ec '
mc alias set teste http://minio:9000 "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
mc cat teste/sge-documentos/testes/verificacao.txt
'
```

Esperado: Teste SGE. Isso valida persistência no volume nomeado, não proteção contra perda da máquina.

## 7. Conexão apropriada do backend C#

Usar um cliente S3 compatível, por exemplo AWSSDK.S3, com versão fixada no projeto. Verificar os requisitos específicos da versão escolhida e testar uploads simples e multipart. Não desabilitar TLS ou verificações de integridade para contornar erros.

### Configuração esperada

| Variável fornecida à API | Valor dentro do Docker |
|---|---|
| S3_ENDPOINT | http://minio:9000 |
| S3_BUCKET | sge-documentos |
| S3_REGION | us-east-1 |
| S3_FORCE_PATH_STYLE | true |
| S3_ACCESS_KEY_ID | Conta exclusiva da API, obtida do ambiente |
| S3_SECRET_ACCESS_KEY | Segredo dessa conta, obtido do ambiente |

No SDK, mapear endpoint para ServiceURL, habilitar ForcePathStyle e usar região de assinatura us-east-1. As credenciais devem ser explícitas da conta S3 da API; não usar MINIO_ROOT_USER/MINIO_ROOT_PASSWORD.

Se o backend for executado diretamente no terminal do Codespaces, fora do Docker, usar http://localhost:9000 em vez de http://minio:9000. O hostname minio só é resolvido dentro da rede Docker compartilhada. A configuração deve permitir essa troca sem alterar regras de negócio.

A API deve:

1. Validar configuração ao iniciar sem revelar segredos nos erros.
2. Compartilhar/reutilizar o cliente do SDK conforme orientação da biblioteca, em vez de recriá-lo por arquivo.
3. Implementar cancelamento, limites de tamanho, tempos de espera e tratamento de indisponibilidade.
4. Validar extensão, conteúdo e formato de arquivo; não confiar só no MIME enviado pelo navegador.
5. Calcular SHA-256 no servidor. Não assumir que ETag é sempre um hash MD5, principalmente em multipart.
6. Transmitir arquivos em fluxo, evitando carregar uploads grandes inteiramente em memória.
7. Não gerar chaves a partir de caminhos arbitrários fornecidos pelo cliente.

O bucket deve ser criado pelo processo de infraestrutura, não em cada upload. Um armazenamento indisponível deve produzir erro recuperável, nunca simulação de upload bem-sucedido.

### Download pelo usuário

Nesta fase, o frontend chama a API autenticada. A API verifica permissão sobre o recebimento/documento e transmite o arquivo do MinIO ao usuário. Não devolver uma URL contendo minio:9000: esse hostname não é acessível pelo navegador externo.

URLs temporárias externas exigiriam um endpoint HTTPS alcançável e configuração de assinatura apropriada, ainda não preparada. O backend não deve aceitar bucket/chave arbitrários do cliente para baixar documentos de terceiros.

O console administrativo não é a interface dos usuários do SGE. Não expor MinIO ou console publicamente no Codespaces; manter encaminhamento de portas com visibilidade Private.

## 8. MySQL e vínculo dos arquivos

Dentro do Docker, conectar ao servidor db, porta 3306, banco sge, conta sge_app. Fora do Docker, quando a porta estiver publicada, conectar a 127.0.0.1:3306.

O backend pode receber `ConnectionStrings__DefaultConnection`, que o ASP.NET Core interpreta como ConnectionStrings:DefaultConnection. Configurar explicitamente esse valor no serviço da API. Não usar root na aplicação; separar permissões de migração das permissões de operação. Trabalhar com datas em UTC.

No MySQL, registrar pelo menos:

- ID do anexo, bucket e chave estável do objeto.
- Nome original, tipo validado, tamanho e SHA-256.
- Usuário autenticado responsável e data do envio.
- Situação: pendente, disponível ou falho.
- Vínculos explícitos com recebimento, documento ou movimentação.

Relacionamentos definidos no planejamento:

```text
recebimentos → recebimento_anexos → anexos → objeto no MinIO
recebimentos → documentos_recebimento → documento_anexos → anexos
movimentacoes → movimentacao_anexos → anexos
```

Adaptar os nomes ao schema consolidado do projeto, sem duplicar modelos. Chaves estrangeiras verificam registros no MySQL, não a existência física de arquivos no MinIO. Guardar chave, não URL temporária.

### Regra obrigatória de recebimento

Todo recebimento confirmado deve ter pelo menos uma foto ou documento com arquivo disponível. Nota fiscal não é obrigatória em todos os casos, inclusive doações. Apenas preencher número ou descrição de uma nota sem arquivo não satisfaz essa regra.

O recebimento pode ficar em preparação enquanto o comprovante é enviado. Depois de confirmado, não permitir desvincular ou inutilizar seu último comprovante válido.

Fluxo recomendado:

1. Autorizar o usuário e criar recebimento em preparação.
2. Registrar anexo pendente com chave única e vínculo autorizado.
3. Enviar arquivo ao MinIO e verificar resultado/integridade.
4. Marcar anexo como disponível no MySQL.
5. Na confirmação, bloquear o recebimento e coordenar mudanças nos vínculos sob o mesmo protocolo de bloqueio; conferir ao menos um comprovante disponível, itens e permissões.
6. Confirmar recebimento, criar entrada de estoque uma única vez e atualizar saldo/histórico na mesma transação MySQL.

Não manter uma transação de banco aberta durante todo o upload. MinIO e MySQL não compartilham transação distribuída: prever falha após upload, objetos sem vínculo e registros pendentes. Repetições precisam de idempotência e reconciliação. Não presumir que a conta da API poderá excluir objetos órfãos; essa operação exige processo administrativo separado e autorizado.

Manter os originais PDF/XML. Conversões, miniaturas e OCR são derivados. Exclusão de metadados não apaga automaticamente o arquivo; exclusão do arquivo fora da API também não atualiza o banco. Implementar verificações periódicas de consistência.

## 9. Pendências de validação do backend

Ainda não foram demonstrados nesta etapa:

- Upload/download pela API C# e resposta a erros do SDK.
- Vínculo persistido no MySQL e autorização por usuário/operação.
- Bloqueio de confirmação sem comprovante e proteção do último anexo válido.
- Recuperação quando upload funciona mas gravação do banco falha, e vice-versa.
- Idempotência de confirmações e lançamentos de estoque.
- Concorrência em retiradas, devoluções e estornos.
- Tratamento de arquivos grandes, limites e falhas durante multipart.
- Restauração de backup coordenado de banco e objetos.

## 10. Encerramento e futura VPS

Para parar sem apagar dados: `docker compose stop minio`.

`docker compose down` remove containers/rede e preserva volumes nomeados. **Não usar `docker compose down -v` para solucionar problemas: ele apaga os volumes.**

Persistência do Codespaces depende do ciclo de vida desse ambiente; sua exclusão pode eliminar os dados locais. Não tratá-lo como backup ou armazenamento definitivo.

Na futura VPS será necessário revisar recursos, arquitetura da máquina, imagens/commits, domínio, HTTPS, firewall, credenciais, atualização, monitoramento e backup externo. MySQL, S3 e console administrativo não devem ficar abertos publicamente. Validar restauração antes de documentos reais.

Este guia documenta o ambiente de testes e o contrato esperado para o backend; não declara a aplicação pronta para produção.
