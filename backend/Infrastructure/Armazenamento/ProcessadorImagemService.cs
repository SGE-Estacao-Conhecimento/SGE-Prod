using System.Runtime.InteropServices;
using System.Security.Cryptography;
using SkiaSharp;

namespace Sge.Api.Infrastructure.Armazenamento;

/// <summary>
/// Serviço independente de validação, normalização de orientação EXIF, remoção de metadados,
/// redimensionamento proporcional e compressão de imagens antes do envio ao armazenamento.
/// </summary>
public sealed class ProcessadorImagemService
{
    public const int DimensaoMaximaPixels = 1920;
    public const int QualidadeJpeg = 80;
    public const int DimensaoMaximaEntradaPixels = 16384;
    public const long TotalMaximoPixelsEntrada = 64_000_000L;

    private static readonly byte[] AssinaturaPng = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    private static readonly HashSet<string> ExtensoesImagemSuportadas = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    private static readonly HashSet<string> ExtensoesImagemConhecidas = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".heic", ".heif", ".avif", ".ico", ".svg"
    };

    private static readonly Dictionary<string, string> MimePadraoNaoImagem = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf",
        [".xml"] = "application/xml",
        [".txt"] = "text/plain",
        [".csv"] = "text/csv",
        [".json"] = "application/json"
    };

    /// <summary>
    /// Recebe um fluxo de imagem (JPG, PNG ou WEBP), valida limites de tamanho e assinatura binária,
    /// corrige orientação EXIF, remove metadados, redimensiona acima de 1920px e comprime preservando transparência.
    /// </summary>
    public Task<ArquivoValidado> ProcessarFotoAsync(Stream conteudo, string? nomeOriginal, CancellationToken ct = default) =>
        ProcessarInternoAsync(conteudo, nomeOriginal, tipoMimeInformado: null, exigirImagem: true, ct);

    /// <summary>
    /// Recebe um anexo qualquer: se for imagem suportada, otimiza e comprime; se não for imagem,
    /// preserva o arquivo original intacto com seu tamanho, extensão, Content-Type e SHA-256.
    /// </summary>
    public Task<ArquivoValidado> ProcessarAnexoAsync(
        Stream conteudo, string? nomeOriginal, string? tipoMimeInformado, CancellationToken ct = default) =>
        ProcessarInternoAsync(conteudo, nomeOriginal, tipoMimeInformado, exigirImagem: false, ct);

    private async Task<ArquivoValidado> ProcessarInternoAsync(
        Stream conteudo, string? nomeOriginal, string? tipoMimeInformado, bool exigirImagem, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(conteudo);

        var nome = NormalizarNome(nomeOriginal);
        var extensao = Path.GetExtension(nome).ToLowerInvariant();

        if (exigirImagem && !ExtensoesImagemSuportadas.Contains(extensao))
            throw new ApiException(415, "Envie fotos nos formatos JPG, PNG ou WEBP.");

        var temporarioEntrada = Path.Combine(Path.GetTempPath(), $"sge-upload-{Guid.NewGuid():N}.tmp");
        try
        {
            long total = 0;
            var inicio = new byte[12];
            var lidosInicio = 0;
            using var shaOriginal = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);

            await using (var destino = new FileStream(
                temporarioEntrada, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            {
                var buffer = new byte[81920];
                int lidos;
                while ((lidos = await conteudo.ReadAsync(buffer, ct)) > 0)
                {
                    total += lidos;
                    if (total > ArmazenamentoArquivosBase.TamanhoMaximoBytes)
                        throw new ApiException(413, $"Cada arquivo pode ter no máximo {ArmazenamentoArquivosBase.TamanhoMaximoBytes / (1024 * 1024)} MB.");

                    if (lidosInicio < inicio.Length)
                    {
                        var copiar = Math.Min(inicio.Length - lidosInicio, lidos);
                        Array.Copy(buffer, 0, inicio, lidosInicio, copiar);
                        lidosInicio += copiar;
                    }

                    shaOriginal.AppendData(buffer, 0, lidos);
                    await destino.WriteAsync(buffer.AsMemory(0, lidos), ct);
                }
            }

            if (total == 0)
                throw ApiException.BadRequest(exigirImagem ? "A foto enviada está vazia." : "O arquivo enviado está vazio.");

            var cabecalho = inicio.AsSpan(0, lidosInicio);
            var formatoAssinatura = DetectarFormatoSuportado(cabecalho);
            var pareceImagem = exigirImagem
                || formatoAssinatura is not null
                || PossuiAssinaturaOutraImagem(cabecalho)
                || ExtensoesImagemConhecidas.Contains(extensao)
                || (tipoMimeInformado?.Trim().StartsWith("image/", StringComparison.OrdinalIgnoreCase) ?? false);

            if (!pareceImagem)
            {
                var hashOriginal = Convert.ToHexStringLower(shaOriginal.GetHashAndReset());
                var mimeFinal = ResolverMimeNaoImagem(extensao, tipoMimeInformado);
                return new ArquivoValidado(temporarioEntrada, nome, extensao, mimeFinal, total, hashOriginal);
            }

            if (formatoAssinatura is null || !ExtensaoCompativelComFormato(extensao, formatoAssinatura.Value))
                throw new ApiException(415, "O conteúdo do arquivo não corresponde a uma imagem JPG, PNG ou WEBP.");

            var processado = OtimizarArquivoImagem(temporarioEntrada, nome, extensao, formatoAssinatura.Value, ct);
            ExcluirSilenciosamente(temporarioEntrada);
            return processado;
        }
        catch
        {
            ExcluirSilenciosamente(temporarioEntrada);
            throw;
        }
    }

    private static ArquivoValidado OtimizarArquivoImagem(
        string caminhoEntrada, string nomeOriginal, string extensaoOriginal, SKEncodedImageFormat formatoEsperado, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        using var fluxoEntrada = new FileStream(caminhoEntrada, FileMode.Open, FileAccess.Read, FileShare.Read);
        using var codec = SKCodec.Create(fluxoEntrada)
            ?? throw new ApiException(415, "O arquivo de imagem é inválido ou está corrompido.");

        if (codec.EncodedFormat != formatoEsperado)
            throw new ApiException(415, "O conteúdo do arquivo não corresponde ao formato de imagem esperado.");

        var infoOriginal = codec.Info;
        if (infoOriginal.Width <= 0 || infoOriginal.Height <= 0)
            throw new ApiException(415, "O arquivo de imagem possui dimensões inválidas.");

        if (infoOriginal.Width > DimensaoMaximaEntradaPixels
            || infoOriginal.Height > DimensaoMaximaEntradaPixels
            || (long)infoOriginal.Width * infoOriginal.Height > TotalMaximoPixelsEntrada)
        {
            throw new ApiException(422, $"As dimensões da imagem excedem o limite máximo de {DimensaoMaximaEntradaPixels} pixels.");
        }

        var alphaDecodificacao = infoOriginal.AlphaType == SKAlphaType.Opaque
            ? SKAlphaType.Opaque
            : SKAlphaType.Premul;
        var infoDecodificacao = new SKImageInfo(infoOriginal.Width, infoOriginal.Height, SKColorType.Rgba8888, alphaDecodificacao);

        using var bitmapBruto = new SKBitmap(infoDecodificacao);
        var PonteiroPixels = bitmapBruto.GetPixels();
        if (PonteiroPixels == IntPtr.Zero)
            throw new ApiException(422, "Não foi possível alocar memória para processar a imagem.");

        var resultado = codec.GetPixels(infoDecodificacao, PonteiroPixels);
        if (resultado != SKCodecResult.Success)
            throw new ApiException(415, "O arquivo de imagem está truncado ou corrompido.");

        ct.ThrowIfCancellationRequested();

        var possuiTransparencia = infoOriginal.AlphaType != SKAlphaType.Opaque && ContemPixelsTransparentes(bitmapBruto);

        using var bitmapOrientado = AplicarOrientacao(bitmapBruto, codec.EncodedOrigin);
        var atual = bitmapOrientado ?? bitmapBruto;

        var (larguraFinal, alturaFinal) = CalcularDimensoesFinais(atual.Width, atual.Height);
        using var bitmapRedimensionado = (larguraFinal != atual.Width || alturaFinal != atual.Height)
            ? atual.Resize(
                new SKImageInfo(larguraFinal, alturaFinal, atual.ColorType, atual.AlphaType),
                new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear))
            : null;

        if ((larguraFinal != atual.Width || alturaFinal != atual.Height) && bitmapRedimensionado is null)
            throw new ApiException(422, "Não foi possível redimensionar a imagem enviada.");

        var bitmapFinal = bitmapRedimensionado ?? atual;

        var (formatoSaida, qualidade, extensaoSaida, tipoMimeSaida) = DefinirFormatoSaida(
            formatoEsperado, extensaoOriginal, possuiTransparencia);

        using var imagemFinal = SKImage.FromBitmap(bitmapFinal);
        using var dadosCodificados = imagemFinal.Encode(formatoSaida, qualidade)
            ?? throw new ApiException(422, "Não foi possível comprimir a imagem enviada.");

        if (dadosCodificados.Size <= 0)
            throw new ApiException(422, "O processamento da imagem gerou um arquivo vazio.");

        var nomeFinal = AtualizarExtensaoNome(nomeOriginal, extensaoOriginal, extensaoSaida);
        var temporarioSaida = Path.Combine(Path.GetTempPath(), $"sge-img-{Guid.NewGuid():N}.tmp");
        try
        {
            var bytesSaida = dadosCodificados.AsSpan();
            var hashSaida = Convert.ToHexStringLower(SHA256.HashData(bytesSaida));

            using (var destino = new FileStream(temporarioSaida, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                destino.Write(bytesSaida);
            }

            return new ArquivoValidado(temporarioSaida, nomeFinal, extensaoSaida, tipoMimeSaida, dadosCodificados.Size, hashSaida);
        }
        catch
        {
            ExcluirSilenciosamente(temporarioSaida);
            throw;
        }
    }

    private static (SKEncodedImageFormat Formato, int Qualidade, string Extensao, string TipoMime) DefinirFormatoSaida(
        SKEncodedImageFormat formatoEntrada, string extensaoOriginal, bool possuiTransparencia)
    {
        if (possuiTransparencia)
        {
            return formatoEntrada switch
            {
                SKEncodedImageFormat.Png => (SKEncodedImageFormat.Png, 100, ".png", "image/png"),
                SKEncodedImageFormat.Webp => (SKEncodedImageFormat.Webp, QualidadeJpeg, ".webp", "image/webp"),
                _ => (SKEncodedImageFormat.Png, 100, ".png", "image/png")
            };
        }

        var extensaoJpeg = extensaoOriginal is ".jpg" or ".jpeg" ? extensaoOriginal : ".jpg";
        return (SKEncodedImageFormat.Jpeg, QualidadeJpeg, extensaoJpeg, "image/jpeg");
    }

    private static (int Largura, int Altura) CalcularDimensoesFinais(int largura, int altura)
    {
        if (largura <= DimensaoMaximaPixels && altura <= DimensaoMaximaPixels)
            return (largura, altura);

        var escala = Math.Min((double)DimensaoMaximaPixels / largura, (double)DimensaoMaximaPixels / altura);
        var novaLargura = Math.Max(1, (int)Math.Round(largura * escala));
        var novaAltura = Math.Max(1, (int)Math.Round(altura * escala));
        return (novaLargura, novaAltura);
    }

    /// <summary>
    /// Corrige a orientação dos pixels conforme o metadado EXIF (SKEncodedOrigin).
    /// Retorna null quando a imagem já está na orientação padrão (TopLeft).
    /// </summary>
    private static SKBitmap? AplicarOrientacao(SKBitmap origem, SKEncodedOrigin orientacao)
    {
        if (orientacao is SKEncodedOrigin.TopLeft or SKEncodedOrigin.Default)
            return null;

        var largura = origem.Width;
        var altura = origem.Height;
        var trocaEixos = orientacao is SKEncodedOrigin.LeftTop
            or SKEncodedOrigin.RightTop
            or SKEncodedOrigin.RightBottom
            or SKEncodedOrigin.LeftBottom;

        var larguraDestino = trocaEixos ? altura : largura;
        var alturaDestino = trocaEixos ? largura : altura;

        var destino = new SKBitmap(new SKImageInfo(larguraDestino, alturaDestino, origem.ColorType, origem.AlphaType));
        var pixelsOrigem = MemoryMarshal.Cast<byte, uint>(origem.GetPixelSpan());
        var pixelsDestino = MemoryMarshal.Cast<byte, uint>(destino.GetPixelSpan());

        for (var y = 0; y < altura; y++)
        {
            var linhaOrigem = y * largura;
            for (var x = 0; x < largura; x++)
            {
                var cor = pixelsOrigem[linhaOrigem + x];
                var indiceDestino = orientacao switch
                {
                    SKEncodedOrigin.TopRight => y * larguraDestino + (largura - 1 - x),
                    SKEncodedOrigin.BottomRight => (altura - 1 - y) * larguraDestino + (largura - 1 - x),
                    SKEncodedOrigin.BottomLeft => (altura - 1 - y) * larguraDestino + x,
                    SKEncodedOrigin.LeftTop => x * larguraDestino + y,
                    SKEncodedOrigin.RightTop => x * larguraDestino + (altura - 1 - y),
                    SKEncodedOrigin.RightBottom => (largura - 1 - x) * larguraDestino + (altura - 1 - y),
                    SKEncodedOrigin.LeftBottom => (largura - 1 - x) * larguraDestino + y,
                    _ => y * larguraDestino + x
                };
                pixelsDestino[indiceDestino] = cor;
            }
        }

        return destino;
    }

    private static bool ContemPixelsTransparentes(SKBitmap bitmap)
    {
        var bytes = bitmap.GetPixelSpan();
        for (var i = 3; i < bytes.Length; i += 4)
        {
            if (bytes[i] < 255)
                return true;
        }
        return false;
    }

    private static SKEncodedImageFormat? DetectarFormatoSuportado(ReadOnlySpan<byte> cabecalho)
    {
        if (cabecalho.Length >= 3 && cabecalho[0] == 0xFF && cabecalho[1] == 0xD8 && cabecalho[2] == 0xFF)
            return SKEncodedImageFormat.Jpeg;

        if (cabecalho.Length >= 8 && cabecalho[..8].SequenceEqual(AssinaturaPng))
            return SKEncodedImageFormat.Png;

        if (cabecalho.Length >= 12
            && cabecalho[0] == 'R' && cabecalho[1] == 'I' && cabecalho[2] == 'F' && cabecalho[3] == 'F'
            && cabecalho[8] == 'W' && cabecalho[9] == 'E' && cabecalho[10] == 'B' && cabecalho[11] == 'P')
        {
            return SKEncodedImageFormat.Webp;
        }

        return null;
    }

    private static bool PossuiAssinaturaOutraImagem(ReadOnlySpan<byte> cabecalho)
    {
        // GIF87a / GIF89a
        if (cabecalho.Length >= 6
            && cabecalho[0] == 'G' && cabecalho[1] == 'I' && cabecalho[2] == 'F' && cabecalho[3] == '8'
            && (cabecalho[4] == '7' || cabecalho[4] == '9') && cabecalho[5] == 'a')
        {
            return true;
        }

        // BMP ("BM")
        if (cabecalho.Length >= 2 && cabecalho[0] == 'B' && cabecalho[1] == 'M')
            return true;

        // TIFF (little-endian II*\0 ou big-endian MM\0*)
        if (cabecalho.Length >= 4
            && ((cabecalho[0] == 'I' && cabecalho[1] == 'I' && cabecalho[2] == 0x2A && cabecalho[3] == 0x00)
                || (cabecalho[0] == 'M' && cabecalho[1] == 'M' && cabecalho[2] == 0x00 && cabecalho[3] == 0x2A)))
        {
            return true;
        }

        return false;
    }

    private static bool ExtensaoCompativelComFormato(string extensao, SKEncodedImageFormat formato)
    {
        if (string.IsNullOrEmpty(extensao) || !ExtensoesImagemSuportadas.Contains(extensao))
            return true;

        return formato switch
        {
            SKEncodedImageFormat.Jpeg => extensao is ".jpg" or ".jpeg",
            SKEncodedImageFormat.Png => extensao is ".png",
            SKEncodedImageFormat.Webp => extensao is ".webp",
            _ => false
        };
    }

    private static string NormalizarNome(string? nomeOriginal)
    {
        var nome = Path.GetFileName(nomeOriginal ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(nome))
            nome = "arquivo";
        if (nome.Length > 255)
            nome = nome[^255..];
        return nome;
    }

    private static string AtualizarExtensaoNome(string nomeOriginal, string extensaoOriginal, string extensaoSaida)
    {
        if (string.Equals(extensaoOriginal, extensaoSaida, StringComparison.OrdinalIgnoreCase))
            return nomeOriginal;

        var alterado = Path.ChangeExtension(nomeOriginal, extensaoSaida);
        return alterado.Length > 255 ? alterado[^255..] : alterado;
    }

    private static string ResolverMimeNaoImagem(string extensao, string? tipoMimeInformado)
    {
        if (MimePadraoNaoImagem.TryGetValue(extensao, out var mimeConhecido))
            return mimeConhecido;

        if (!string.IsNullOrWhiteSpace(tipoMimeInformado)
            && !tipoMimeInformado.Trim().StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            return tipoMimeInformado.Trim();
        }

        return "application/octet-stream";
    }

    private static void ExcluirSilenciosamente(string caminho)
    {
        try { File.Delete(caminho); } catch (IOException) { }
    }
}
