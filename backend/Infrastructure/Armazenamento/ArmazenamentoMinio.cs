using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace Sge.Api.Infrastructure.Armazenamento;

/// <summary>
/// Envio e leitura de objetos no MinIO (bucket privado) pelo SDK S3. O cliente é único
/// (singleton) e reutilizado, conforme orientação da biblioteca.
/// </summary>
public sealed class ArmazenamentoMinio : ArmazenamentoArquivosBase, IDisposable
{
    private readonly AmazonS3Client _cliente;
    private readonly string _bucket;

    public ArmazenamentoMinio(ArmazenamentoOpcoes opcoes, ILogger<ArmazenamentoMinio> logger) : base(logger)
    {
        _bucket = opcoes.Bucket;
        _cliente = new AmazonS3Client(
            new BasicAWSCredentials(opcoes.ChaveAcesso, opcoes.Segredo),
            new AmazonS3Config
            {
                ServiceURL = opcoes.Endpoint,
                ForcePathStyle = opcoes.ForcarPathStyle,
                AuthenticationRegion = opcoes.Regiao,
                Timeout = TimeSpan.FromSeconds(60),
                MaxErrorRetry = 2,
                // Checksums adicionais só quando a operação exigir (compatibilidade com MinIO);
                // a integridade é garantida pelo SHA-256 calculado pela API.
                RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
                ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED
            });
    }

    protected override async Task EnviarObjetoAsync(string chave, Stream conteudo, string tipoMime, long tamanhoBytes, CancellationToken ct)
    {
        var requisicao = new PutObjectRequest
        {
            BucketName = _bucket,
            Key = chave,
            InputStream = conteudo,
            ContentType = tipoMime,
            AutoCloseStream = false,
            UseChunkEncoding = false
        };
        requisicao.Headers.ContentLength = tamanhoBytes;
        await _cliente.PutObjectAsync(requisicao, ct);
    }

    protected override async Task<Stream> AbrirObjetoAsync(string chave, CancellationToken ct)
    {
        var resposta = await _cliente.GetObjectAsync(_bucket, chave, ct);
        return resposta.ResponseStream;
    }

    public void Dispose() => _cliente.Dispose();
}
