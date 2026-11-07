using System.Security.Cryptography;

namespace Sge.Api.Infrastructure.Armazenamento;

/// <summary>
/// Etapas comuns a qualquer destino de arquivos (guia-minIO-conexao-sql.md, seção 7):
/// validação de extensão, conteúdo e tamanho; SHA-256 calculado no servidor; chave estável
/// gerada pela API (nunca a partir de caminhos do cliente); falha do destino convertida em erro
/// recuperável. Só o envio e a leitura do objeto ficam com as implementações (método modelo).
/// </summary>
public abstract class ArmazenamentoArquivosBase(ILogger logger)
{
    /// <summary>Limite por arquivo. Fotos de celular costumam ficar abaixo de 8 MB.</summary>
    public const long TamanhoMaximoBytes = 10 * 1024 * 1024;

    private sealed record TipoPermitido(string Mime, Func<byte[], bool> Assinatura);

    /// <summary>Fotos do material aceitas no recebimento. O tipo é conferido pelo conteúdo, não pelo navegador.</summary>
    private static readonly Dictionary<string, TipoPermitido> TiposFoto = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = new("image/jpeg", b => b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF),
        [".jpeg"] = new("image/jpeg", b => b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF),
        [".png"] = new("image/png", b => b.Length >= 8 && b.AsSpan(0, 8).SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })),
        [".webp"] = new("image/webp", b => b.Length >= 12
            && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
            && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P')
    };

    /// <summary>
    /// Copia o envio para um temporário (em fluxo, sem carregar tudo na memória), calculando o
    /// SHA-256 e conferindo tamanho e assinatura do conteúdo.
    /// </summary>
    public async Task<ArquivoValidado> ValidarFotoAsync(Stream conteudo, string? nomeOriginal, CancellationToken ct)
    {
        var nome = Path.GetFileName(nomeOriginal ?? string.Empty);
        if (nome.Length > 255) nome = nome[^255..];
        var extensao = Path.GetExtension(nome).ToLowerInvariant();
        if (!TiposFoto.TryGetValue(extensao, out var tipo))
            throw new ApiException(415, "Envie fotos nos formatos JPG, PNG ou WEBP.");

        var temporario = Path.Combine(Path.GetTempPath(), $"sge-upload-{Guid.NewGuid():N}.tmp");
        try
        {
            long total = 0;
            var inicio = new byte[12];
            var lidosInicio = 0;
            using var sha = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            await using (var destino = new FileStream(temporario, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            {
                var buffer = new byte[81920];
                int lidos;
                while ((lidos = await conteudo.ReadAsync(buffer, ct)) > 0)
                {
                    total += lidos;
                    if (total > TamanhoMaximoBytes)
                        throw new ApiException(413, $"Cada foto pode ter no máximo {TamanhoMaximoBytes / (1024 * 1024)} MB.");
                    if (lidosInicio < inicio.Length)
                    {
                        var copiar = Math.Min(inicio.Length - lidosInicio, lidos);
                        Array.Copy(buffer, 0, inicio, lidosInicio, copiar);
                        lidosInicio += copiar;
                    }
                    sha.AppendData(buffer, 0, lidos);
                    await destino.WriteAsync(buffer.AsMemory(0, lidos), ct);
                }
            }

            if (total == 0)
                throw ApiException.BadRequest("A foto enviada está vazia.");
            if (!tipo.Assinatura(inicio[..lidosInicio]))
                throw new ApiException(415, "O conteúdo do arquivo não corresponde a uma imagem JPG, PNG ou WEBP.");

            var hash = Convert.ToHexStringLower(sha.GetHashAndReset());
            return new ArquivoValidado(temporario, nome, extensao, tipo.Mime, total, hash);
        }
        catch
        {
            try { File.Delete(temporario); } catch (IOException) { }
            throw;
        }
    }

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
