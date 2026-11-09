namespace Sge.Api.Infrastructure.Armazenamento;

/// <summary>
/// Etapas comuns a qualquer destino de arquivos (guia-minIO-conexao-sql.md, seção 7):
/// validação de extensão, conteúdo e tamanho; otimização e compressão de imagens via
/// <see cref="ProcessadorImagemService"/>; SHA-256 calculado no servidor; chave estável
/// gerada pela API (nunca a partir de caminhos do cliente); falha do destino convertida em erro
/// recuperável. Só o envio e a leitura do objeto ficam com as implementações (método modelo).
/// </summary>
public abstract class ArmazenamentoArquivosBase(ILogger logger, ProcessadorImagemService? processadorImagem = null)
{
    /// <summary>Limite por arquivo. Fotos de celular costumam ficar abaixo de 8 MB.</summary>
    public const long TamanhoMaximoBytes = 10 * 1024 * 1024;

    private readonly ProcessadorImagemService _processadorImagem = processadorImagem ?? new ProcessadorImagemService();

    /// <summary>
    /// Valida, corrige orientação EXIF, remove metadados, redimensiona (máx. 1920px) e comprime a foto
    /// antes do envio ao armazenamento, calculando o SHA-256 e o tamanho final no servidor.
    /// </summary>
    public Task<ArquivoValidado> ValidarFotoAsync(Stream conteudo, string? nomeOriginal, CancellationToken ct) =>
        _processadorImagem.ProcessarFotoAsync(conteudo, nomeOriginal, ct);

    /// <summary>
    /// Processa um anexo geral: se for imagem suportada, otimiza e comprime; se não for imagem,
    /// preserva o arquivo original intacto com seu tamanho, extensão, Content-Type e SHA-256.
    /// </summary>
    public Task<ArquivoValidado> ValidarAnexoAsync(
        Stream conteudo, string? nomeOriginal, string? tipoMimeInformado, CancellationToken ct) =>
        _processadorImagem.ProcessarAnexoAsync(conteudo, nomeOriginal, tipoMimeInformado, ct);

    /// <summary>Chave estável do objeto, montada só com dados controlados pela API.</summary>
    public static string GerarChave(string pasta, int registroId, string extensao) =>
        $"{pasta}/{registroId}/{Guid.NewGuid():N}{extensao}";

    public async Task EnviarAsync(string chave, ArquivoValidado arquivo, CancellationToken ct)
    {
        try
        {
            await using var leitura = arquivo.AbrirLeitura();
            await EnviarObjetoAsync(chave, leitura, arquivo.TipoMime, arquivo.TamanhoBytes, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            logger.LogError(ex, "Falha ao enviar o objeto {Chave} ao armazenamento.", chave);
            throw new ApiException(503, "O armazenamento de arquivos está indisponível. Tente enviar novamente.");
        }
    }

    public async Task<Stream> AbrirAsync(string chave, CancellationToken ct)
    {
        try
        {
            return await AbrirObjetoAsync(chave, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            logger.LogError(ex, "Falha ao ler o objeto {Chave} do armazenamento.", chave);
            throw new ApiException(503, "O armazenamento de arquivos está indisponível. Tente novamente.");
        }
    }

    protected abstract Task EnviarObjetoAsync(string chave, Stream conteudo, string tipoMime, long tamanhoBytes, CancellationToken ct);

    protected abstract Task<Stream> AbrirObjetoAsync(string chave, CancellationToken ct);
}
