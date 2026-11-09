using System.Buffers.Binary;
using System.Collections.Concurrent;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Sge.Api.Infrastructure;
using Sge.Api.Infrastructure.Armazenamento;
using SkiaSharp;

namespace Sge.Api.Tests;

public sealed class ProcessadorImagemTests
{
    private readonly ProcessadorImagemService _processador = new();

    // =========================================================================
    // 1. Compressão de imagens JPEG
    // =========================================================================
    [Fact]
    public async Task ComprimirJpeg_AltaQualidade_ReduzTamanhoMantendoDimensoes()
    {
        var bytesOriginais = GerarImagemJpegRuidosa(largura: 1600, altura: 1200, qualidade: 100);
        await using var fluxoEntrada = new MemoryStream(bytesOriginais);

        await using var validado = await _processador.ProcessarFotoAsync(fluxoEntrada, "material_lote.jpg");
        var bytesOtimizados = await LerBytesAsync(validado);

        Assert.Equal("image/jpeg", validado.TipoMime);
        Assert.Equal(".jpg", validado.Extensao);
        Assert.Equal("material_lote.jpg", validado.NomeOriginal);
        Assert.True(validado.TamanhoBytes < bytesOriginais.LongLength,
            $"Esperava redução de tamanho, mas original={bytesOriginais.LongLength} e otimizado={validado.TamanhoBytes}.");

        using var codec = SKCodec.Create(new MemoryStream(bytesOtimizados));
        Assert.NotNull(codec);
        Assert.Equal(SKEncodedImageFormat.Jpeg, codec.EncodedFormat);
        Assert.Equal(1600, codec.Info.Width);
        Assert.Equal(1200, codec.Info.Height);
    }

    // =========================================================================
    // 2. Compressão e preservação de transparência em PNG (e conversão se opaco)
    // =========================================================================
    [Fact]
    public async Task ProcessarPng_ComTransparencia_PreservaFormatoPngECanalAlfa()
    {
        var bytesPngTransparente = GerarImagemPng(largura: 600, altura: 400, comTransparencia: true);
        await using var fluxo = new MemoryStream(bytesPngTransparente);

        await using var validado = await _processador.ProcessarFotoAsync(fluxo, "etiqueta_transparente.png");
        var bytesSaida = await LerBytesAsync(validado);

        Assert.Equal("image/png", validado.TipoMime);
        Assert.Equal(".png", validado.Extensao);
        Assert.Equal("etiqueta_transparente.png", validado.NomeOriginal);

        using var bitmap = SKBitmap.Decode(bytesSaida);
        Assert.NotNull(bitmap);
        Assert.Equal(600, bitmap.Width);
        Assert.Equal(400, bitmap.Height);

        // Canto superior esquerdo foi desenhado totalmente transparente (Alpha = 0)
        Assert.Equal(0, bitmap.GetPixel(10, 10).Alpha);
        // Centro foi desenhado com semitransparência (Alpha = 128)
        Assert.InRange(bitmap.GetPixel(300, 200).Alpha, 120, 136);
        // Canto inferior direito foi desenhado opaco (Alpha = 255)
        Assert.Equal(255, bitmap.GetPixel(590, 390).Alpha);
    }

    [Fact]
    public async Task ProcessarPng_TotalmenteOpaco_ConverteParaJpegEAtualizaExtensao()
    {
        var bytesPngOpaco = GerarImagemPng(largura: 1000, altura: 800, comTransparencia: false);
        await using var fluxo = new MemoryStream(bytesPngOpaco);

        await using var validado = await _processador.ProcessarFotoAsync(fluxo, "foto_camera.png");
        var bytesSaida = await LerBytesAsync(validado);

        Assert.Equal("image/jpeg", validado.TipoMime);
        Assert.Equal(".jpg", validado.Extensao);
        Assert.Equal("foto_camera.jpg", validado.NomeOriginal);
        Assert.True(validado.TamanhoBytes < bytesPngOpaco.LongLength);

        using var codec = SKCodec.Create(new MemoryStream(bytesSaida));
        Assert.NotNull(codec);
        Assert.Equal(SKEncodedImageFormat.Jpeg, codec.EncodedFormat);
        Assert.Equal(1000, codec.Info.Width);
        Assert.Equal(800, codec.Info.Height);
    }

    [Fact]
    public async Task ProcessarWebp_ComTransparencia_PreservaWebpECanalAlfa()
    {
        var bytesWebpTransparente = GerarImagemWebp(largura: 400, altura: 300, comTransparencia: true);
        await using var fluxo = new MemoryStream(bytesWebpTransparente);

        await using var validado = await _processador.ProcessarFotoAsync(fluxo, "selo.webp");
        var bytesSaida = await LerBytesAsync(validado);

        Assert.Equal("image/webp", validado.TipoMime);
        Assert.Equal(".webp", validado.Extensao);
        Assert.Equal("selo.webp", validado.NomeOriginal);

        using var bitmap = SKBitmap.Decode(bytesSaida);
        Assert.NotNull(bitmap);
        Assert.Equal(0, bitmap.GetPixel(10, 10).Alpha);
        Assert.Equal(255, bitmap.GetPixel(390, 290).Alpha);
    }

    // =========================================================================
    // 3. Redimensionamento proporcional de imagens acima de 1920 pixels
    // =========================================================================
    [Theory]
    [InlineData(3840, 2160, 1920, 1080)]
    [InlineData(1800, 3600, 960, 1920)]
    [InlineData(2500, 2500, 1920, 1920)]
    public async Task RedimensionarImagem_AcimaDe1920Pixels_PreservaProporcaoOriginal(
        int larguraOriginal, int alturaOriginal, int larguraEsperada, int alturaEsperada)
    {
        var bytes = GerarImagemJpegSimples(larguraOriginal, alturaOriginal, SKColors.SteelBlue);
        await using var fluxo = new MemoryStream(bytes);

        await using var validado = await _processador.ProcessarFotoAsync(fluxo, "alta_resolucao.jpg");
        var bytesSaida = await LerBytesAsync(validado);

        using var codec = SKCodec.Create(new MemoryStream(bytesSaida));
        Assert.NotNull(codec);
        Assert.Equal(larguraEsperada, codec.Info.Width);
        Assert.Equal(alturaEsperada, codec.Info.Height);
    }

    // =========================================================================
    // 4. Preservação das dimensões de imagens menores ou iguais a 1920 pixels
    // =========================================================================
    [Theory]
    [InlineData(320, 240)]
    [InlineData(800, 600)]
    [InlineData(1920, 1080)]
    [InlineData(1080, 1920)]
    public async Task PreservarDimensoes_ImagensMenoresOuIguaisA1920_NaoAmplia(int largura, int altura)
    {
        var bytes = GerarImagemJpegSimples(largura, altura, SKColors.DarkOliveGreen);
        await using var fluxo = new MemoryStream(bytes);

        await using var validado = await _processador.ProcessarFotoAsync(fluxo, "pequena.jpg");
        var bytesSaida = await LerBytesAsync(validado);

        using var codec = SKCodec.Create(new MemoryStream(bytesSaida));
        Assert.NotNull(codec);
        Assert.Equal(largura, codec.Info.Width);
        Assert.Equal(altura, codec.Info.Height);
    }

    // =========================================================================
    // 5. Correção de orientação EXIF antes de remover metadados
    // =========================================================================
    [Fact]
    public async Task CorrigirOrientacaoExif_RightTop90Graus_RotacionaPixelsERemoveTagOrientacao()
    {
        // Imagem bruta 200x100 com metade esquerda vermelha e metade direita azul.
        // Com orientação EXIF 6 (RightTop = 90 graus horário), a imagem corrigida deve ter 100x200,
        // com o topo vermelho e a base azul.
        var jpegBruto = GerarImagemBicolorHorizontalJpeg(largura: 200, altura: 100);
        var jpegComExif = InserirSegmentoExifJpeg(jpegBruto, orientacaoExif: 6, comentarioAdicional: "Camera Institucional SGE");

        using (var codecAntes = SKCodec.Create(new MemoryStream(jpegComExif)))
        {
            Assert.NotNull(codecAntes);
            Assert.Equal(SKEncodedOrigin.RightTop, codecAntes.EncodedOrigin);
            Assert.Equal(200, codecAntes.Info.Width);
            Assert.Equal(100, codecAntes.Info.Height);
        }

        await using var fluxo = new MemoryStream(jpegComExif);
        await using var validado = await _processador.ProcessarFotoAsync(fluxo, "foto_celular_vertical.jpg");
        var bytesSaida = await LerBytesAsync(validado);

        using var codecDepois = SKCodec.Create(new MemoryStream(bytesSaida));
        Assert.NotNull(codecDepois);
        Assert.Equal(SKEncodedOrigin.TopLeft, codecDepois.EncodedOrigin);
        Assert.Equal(100, codecDepois.Info.Width);
        Assert.Equal(200, codecDepois.Info.Height);

        using var bitmapDepois = SKBitmap.Decode(bytesSaida);
        Assert.NotNull(bitmapDepois);
        var corTopo = bitmapDepois.GetPixel(50, 25);
        var corBase = bitmapDepois.GetPixel(50, 175);

        // Topo deve ser predominantemente vermelho; base deve ser predominantemente azul.
        Assert.True(corTopo.Red > 200 && corTopo.Blue < 50, $"Esperava vermelho no topo, obteve R={corTopo.Red}, B={corTopo.Blue}.");
        Assert.True(corBase.Blue > 200 && corBase.Red < 50, $"Esperava azul na base, obteve R={corBase.Red}, B={corBase.Blue}.");
    }

    // =========================================================================
    // 6. Remoção de metadados EXIF e informações desnecessárias
    // =========================================================================
    [Fact]
    public async Task RemoverMetadados_ExifEComentariosJpeg_EliminaMarcadoresApp1ECom()
    {
        var marcadorSecreto = "METADADO_EXIF_CONFIDENCIAL_GPS_12345";
        var comentarioSecreto = "COMENTARIO_JPEG_DESNECESSARIO_67890";

        var jpegBase = GerarImagemJpegSimples(400, 300, SKColors.Coral);
        var jpegComMetadados = InserirSegmentoExifJpeg(jpegBase, orientacaoExif: 1, comentarioAdicional: marcadorSecreto);
        jpegComMetadados = InserirSegmentoComentarioJpeg(jpegComMetadados, comentarioSecreto);

        Assert.Contains(marcadorSecreto, Encoding.ASCII.GetString(jpegComMetadados));
        Assert.Contains(comentarioSecreto, Encoding.ASCII.GetString(jpegComMetadados));

        await using var fluxo = new MemoryStream(jpegComMetadados);
        await using var validado = await _processador.ProcessarFotoAsync(fluxo, "com_exif.jpg");
        var bytesLimpos = await LerBytesAsync(validado);
        var textoSaida = Encoding.ASCII.GetString(bytesLimpos);

        Assert.DoesNotContain(marcadorSecreto, textoSaida);
        Assert.DoesNotContain(comentarioSecreto, textoSaida);
        Assert.False(ContemSegmentoJpeg(bytesLimpos, 0xE1), "O arquivo JPEG otimizado não deve conter segmento APP1 (EXIF).");
        Assert.False(ContemSegmentoJpeg(bytesLimpos, 0xFE), "O arquivo JPEG otimizado não deve conter segmento COM (comentário).");
    }

    // =========================================================================
    // 7. Preservação de arquivos que não sejam imagens
    // =========================================================================
    [Theory]
    [InlineData("nota_fiscal.pdf", "application/pdf", "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF")]
    [InlineData("nfe_432611.xml", "application/xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><nfeProc><NFe/></nfeProc>")]
    [InlineData("comprovante.txt", "text/plain", "Comprovante textual de entrega de materiais SGE.")]
    public async Task PreservarArquivosNaoImagem_MantemConteudoHashTamanhoETipoIntactos(
        string nomeArquivo, string mimeEsperado, string conteudoTexto)
    {
        var bytesOriginais = Encoding.UTF8.GetBytes(conteudoTexto);
        var hashEsperado = Convert.ToHexStringLower(SHA256.HashData(bytesOriginais));

        var armazenamento = new ArmazenamentoEmMemoria(_processador);
        await using var fluxo = new MemoryStream(bytesOriginais);

        await using var validado = await armazenamento.ValidarAnexoAsync(fluxo, nomeArquivo, mimeEsperado, CancellationToken.None);
        var bytesArmazenados = await LerBytesAsync(validado);

        Assert.Equal(nomeArquivo, validado.NomeOriginal);
        Assert.Equal(Path.GetExtension(nomeArquivo), validado.Extensao);
        Assert.Equal(mimeEsperado, validado.TipoMime);
        Assert.Equal(bytesOriginais.LongLength, validado.TamanhoBytes);
        Assert.Equal(hashEsperado, validado.Sha256);
        Assert.Equal(bytesOriginais, bytesArmazenados);
    }

    // =========================================================================
    // 8. Tratamento de arquivos inválidos, corrompidos, falsificados e excessivos
    // =========================================================================
    [Fact]
    public async Task RejeitarArquivosInvalidos_Vazio_LancaBadRequest()
    {
        await using var vazio = new MemoryStream([]);
        var ex = await Assert.ThrowsAsync<ApiException>(() =>
            _processador.ProcessarFotoAsync(vazio, "vazia.jpg"));
        Assert.Equal(400, ex.Status);
    }

    [Fact]
    public async Task RejeitarArquivosInvalidos_TextoFalsificadoComoJpeg_LancaUnsupportedMediaType()
    {
        var bytesFalsos = Encoding.UTF8.GetBytes("Este arquivo nao e uma imagem real");
        await using var fluxo = new MemoryStream(bytesFalsos);

        // Mesmo que o cliente envie Content-Type image/jpeg e extensão .jpg, deve ser barrado pela assinatura binária.
        var ex = await Assert.ThrowsAsync<ApiException>(() =>
            _processador.ProcessarAnexoAsync(fluxo, "falsa.jpg", "image/jpeg"));
        Assert.Equal(415, ex.Status);
    }

    [Fact]
    public async Task RejeitarArquivosInvalidos_JpegCorrompidoOuTruncado_LancaUnsupportedMediaType()
    {
        // Assinatura JPEG válida (FF D8 FF E0) seguida de bytes inválidos/truncados
        byte[] jpegCorrompido = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, (byte)'J', (byte)'F', (byte)'I', (byte)'F', 0x00, 0x01, 0x02, 0x03];
        await using var fluxo = new MemoryStream(jpegCorrompido);

        var ex = await Assert.ThrowsAsync<ApiException>(() =>
            _processador.ProcessarFotoAsync(fluxo, "corrompida.jpg"));
        Assert.Equal(415, ex.Status);
    }

    [Fact]
    public async Task RejeitarArquivosInvalidos_ExtensaoDivergenteDaAssinatura_LancaUnsupportedMediaType()
    {
        var bytesPng = GerarImagemPng(100, 100, comTransparencia: false);
        await using var fluxo = new MemoryStream(bytesPng);

        var ex = await Assert.ThrowsAsync<ApiException>(() =>
            _processador.ProcessarFotoAsync(fluxo, "disfarcada.jpg"));
        Assert.Equal(415, ex.Status);
    }

    [Fact]
    public async Task RejeitarArquivosInvalidos_DimensoesExcessivasNoCabecalho_ProtegeMemoriaComErro422()
    {
        // Monta um cabeçalho PNG sintético declarando 25000 x 25000 pixels no IHDR (> 16384 limite)
        var pngGigante = GerarCabecalhoPngComDimensoes(25000, 25000);
        await using var fluxo = new MemoryStream(pngGigante);

        var ex = await Assert.ThrowsAsync<ApiException>(() =>
            _processador.ProcessarFotoAsync(fluxo, "bomba_descompressao.png"));
        Assert.Contains(ex.Status, new[] { 415, 422 });
    }

    [Fact]
    public async Task RejeitarArquivosInvalidos_AcimaDoLimiteDe10MB_LancaPayloadTooLarge()
    {
        var tamanhoExcedente = (int)ArmazenamentoArquivosBase.TamanhoMaximoBytes + 1024;
        var buffer = new byte[tamanhoExcedente];
        buffer[0] = 0xFF;
        buffer[1] = 0xD8;
        buffer[2] = 0xFF;

        await using var fluxo = new MemoryStream(buffer);
        var ex = await Assert.ThrowsAsync<ApiException>(() =>
            _processador.ProcessarFotoAsync(fluxo, "pesada.jpg"));
        Assert.Equal(413, ex.Status);
    }

    // =========================================================================
    // 9. Compatibilidade do upload otimizado com o MinIO (em memória e via SDK S3)
    // =========================================================================
    [Fact]
    public async Task IntegracaoArmazenamento_EnvioELeituraViaMinioS3_ArmazenaVersaoOtimizadaEPreservaLegados()
    {
        var objetosS3 = new ConcurrentDictionary<string, (byte[] Bytes, string ContentType, long ContentLength)>();

        var builder = WebApplication.CreateSlimBuilder();
        builder.WebHost.UseKestrel(o => o.Listen(IPAddress.Loopback, 0));
        builder.Logging.ClearProviders();
        await using var app = builder.Build();

        app.MapPut("/{bucket}/{**chave}", async (HttpContext ctx, string bucket, string chave) =>
        {
            using var ms = new MemoryStream();
            await ctx.Request.Body.CopyToAsync(ms);
            var conteudo = ms.ToArray();
            objetosS3[$"{bucket}/{chave}"] = (
                conteudo,
                ctx.Request.ContentType ?? string.Empty,
                ctx.Request.ContentLength ?? conteudo.LongLength);
            ctx.Response.Headers.ETag = "\"etag-teste\"";
            return Results.Ok();
        });

        app.MapGet("/{bucket}/{**chave}", (HttpContext ctx, string bucket, string chave) =>
        {
            if (!objetosS3.TryGetValue($"{bucket}/{chave}", out var obj))
                return Results.NotFound();
            return Results.Bytes(obj.Bytes, obj.ContentType);
        });

        await app.StartAsync();
        var enderecoS3 = app.Urls.Single();

        // Objeto antigo já armazenado no MinIO antes da funcionalidade (ex.: PNG opaco não convertido)
        var bytesLegado = GerarImagemPng(500, 400, comTransparencia: false);
        var chaveLegada = "recebimentos/1/legado-antigo.png";
        objetosS3[$"sge-documentos/{chaveLegada}"] = (bytesLegado, "image/png", bytesLegado.LongLength);

        var opcoes = new ArmazenamentoOpcoes(
            Endpoint: enderecoS3,
            Bucket: "sge-documentos",
            Regiao: "us-east-1",
            ForcarPathStyle: true,
            ChaveAcesso: "sge_api_key",
            Segredo: "sge_api_secret");

        using var minio = new ArmazenamentoMinio(opcoes, _processador, NullLogger<ArmazenamentoMinio>.Instance);

        // 1) Novo envio: PNG opaco 2400x1800 deve ser redimensionado para 1920x1440 e convertido para JPEG
        var pngOriginal = GerarImagemPng(2400, 1800, comTransparencia: false);
        await using var fluxoUpload = new MemoryStream(pngOriginal);
        await using var validado = await minio.ValidarFotoAsync(fluxoUpload, "lote_novo.png", CancellationToken.None);

        var chaveNova = ArmazenamentoArquivosBase.GerarChave("recebimentos", 42, validado.Extensao);
        await minio.EnviarAsync(chaveNova, validado, CancellationToken.None);

        Assert.EndsWith(".jpg", chaveNova);
        Assert.True(objetosS3.TryGetValue($"sge-documentos/{chaveNova}", out var armazenadoNoMinio));
        Assert.Equal("image/jpeg", armazenadoNoMinio.ContentType);
        Assert.Equal(validado.TamanhoBytes, armazenadoNoMinio.ContentLength);
        Assert.Equal(validado.TamanhoBytes, armazenadoNoMinio.Bytes.LongLength);

        await using (var fluxoBaixado = await minio.AbrirAsync(chaveNova, CancellationToken.None))
        {
            using var msBaixado = new MemoryStream();
            await fluxoBaixado.CopyToAsync(msBaixado);
            var bytesBaixados = msBaixado.ToArray();
            Assert.Equal(validado.Sha256, Convert.ToHexStringLower(SHA256.HashData(bytesBaixados)));

            using var codec = SKCodec.Create(new MemoryStream(bytesBaixados));
            Assert.NotNull(codec);
            Assert.Equal(1920, codec.Info.Width);
            Assert.Equal(1440, codec.Info.Height);
        }

        // 2) Anexo antigo: deve continuar sendo recuperado sem qualquer alteração ou erro
        await using (var fluxoLegado = await minio.AbrirAsync(chaveLegada, CancellationToken.None))
        {
            using var msLegado = new MemoryStream();
            await fluxoLegado.CopyToAsync(msLegado);
            Assert.Equal(bytesLegado, msLegado.ToArray());
        }

        await app.StopAsync();
    }

    // =========================================================================
    // 10. Consistência entre tamanho, extensão, nome, SHA-256 e Content-Type
    // =========================================================================
    [Fact]
    public async Task GarantirConsistencia_MetadadosEArquivoTemporario_CorrespondemAoConteudoFinal()
    {
        var pngOpaco = GerarImagemPng(2200, 1100, comTransparencia: false);
        await using var fluxo = new MemoryStream(pngOpaco);

        var validado = await _processador.ProcessarFotoAsync(fluxo, "comprovante_entrega.PNG");
        byte[] bytesReais;
        await using (var leitura = validado.AbrirLeitura())
        {
            using var ms = new MemoryStream();
            await leitura.CopyToAsync(ms);
            bytesReais = ms.ToArray();
        }

        var shaCalculado = Convert.ToHexStringLower(SHA256.HashData(bytesReais));

        Assert.Equal(".jpg", validado.Extensao);
        Assert.Equal("comprovante_entrega.jpg", validado.NomeOriginal);
        Assert.Equal(validado.Extensao, Path.GetExtension(validado.NomeOriginal));
        Assert.Equal("image/jpeg", validado.TipoMime);
        Assert.Equal(bytesReais.LongLength, validado.TamanhoBytes);
        Assert.Equal(shaCalculado, validado.Sha256);

        await validado.DisposeAsync();
        Assert.Throws<FileNotFoundException>(() => validado.AbrirLeitura());
    }

    // =========================================================================
    // Utilitários de geração de imagens e segmentos para os testes
    // =========================================================================
    private static async Task<byte[]> LerBytesAsync(ArquivoValidado arquivo)
    {
        await using var leitura = arquivo.AbrirLeitura();
        using var ms = new MemoryStream();
        await leitura.CopyToAsync(ms);
        return ms.ToArray();
    }

    private static byte[] GerarImagemJpegSimples(int largura, int altura, SKColor cor)
    {
        using var bitmap = new SKBitmap(new SKImageInfo(largura, altura, SKColorType.Rgba8888, SKAlphaType.Opaque));
        using (var canvas = new SKCanvas(bitmap))
        {
            canvas.Clear(cor);
        }
        using var imagem = SKImage.FromBitmap(bitmap);
        using var dados = imagem.Encode(SKEncodedImageFormat.Jpeg, 95);
        return dados.ToArray();
    }

    private static byte[] GerarImagemJpegRuidosa(int largura, int altura, int qualidade)
    {
        using var bitmap = new SKBitmap(new SKImageInfo(largura, altura, SKColorType.Rgba8888, SKAlphaType.Opaque));
        var span = bitmap.GetPixelSpan();
        var rng = new Random(42);
        rng.NextBytes(span);
        for (var i = 3; i < span.Length; i += 4)
            span[i] = 255;

        using var imagem = SKImage.FromBitmap(bitmap);
        using var dados = imagem.Encode(SKEncodedImageFormat.Jpeg, qualidade);
        return dados.ToArray();
    }

    private static byte[] GerarImagemBicolorHorizontalJpeg(int largura, int altura)
    {
        using var bitmap = new SKBitmap(new SKImageInfo(largura, altura, SKColorType.Rgba8888, SKAlphaType.Opaque));
        using (var canvas = new SKCanvas(bitmap))
        {
            using var pinturaEsq = new SKPaint { Color = new SKColor(255, 0, 0) };
            using var pinturaDir = new SKPaint { Color = new SKColor(0, 0, 255) };
            canvas.DrawRect(0, 0, largura / 2f, altura, pinturaEsq);
            canvas.DrawRect(largura / 2f, 0, largura / 2f, altura, pinturaDir);
        }
        using var imagem = SKImage.FromBitmap(bitmap);
        using var dados = imagem.Encode(SKEncodedImageFormat.Jpeg, 100);
        return dados.ToArray();
    }

    private static byte[] GerarImagemPng(int largura, int altura, bool comTransparencia)
    {
        var alphaType = comTransparencia ? SKAlphaType.Premul : SKAlphaType.Opaque;
        using var bitmap = new SKBitmap(new SKImageInfo(largura, altura, SKColorType.Rgba8888, alphaType));
        using (var canvas = new SKCanvas(bitmap))
        {
            if (comTransparencia)
            {
                canvas.Clear(SKColors.Transparent);
                using var pinturaSemi = new SKPaint { Color = new SKColor(20, 140, 220, 128) };
                canvas.DrawRect(largura / 4f, altura / 4f, largura / 2f, altura / 2f, pinturaSemi);
                using var pinturaOpaca = new SKPaint { Color = new SKColor(30, 200, 80, 255) };
                canvas.DrawRect(largura * 0.75f, altura * 0.75f, largura * 0.25f, altura * 0.25f, pinturaOpaca);
            }
            else
            {
                var span = bitmap.GetPixelSpan();
                for (var y = 0; y < altura; y++)
                {
                    for (var x = 0; x < largura; x++)
                    {
                        var idx = (y * largura + x) * 4;
                        var hash = ((x * 2654435761u) ^ (y * 2246822519u)) >> 16;
                        span[idx] = (byte)((x + hash) & 0xFF);
                        span[idx + 1] = (byte)((y + (hash >> 3)) & 0xFF);
                        span[idx + 2] = (byte)(((x ^ y) + (hash >> 6)) & 0xFF);
                        span[idx + 3] = 255;
                    }
                }
            }
        }
        using var imagem = SKImage.FromBitmap(bitmap);
        using var dados = imagem.Encode(SKEncodedImageFormat.Png, 100);
        return dados.ToArray();
    }

    private static byte[] GerarImagemWebp(int largura, int altura, bool comTransparencia)
    {
        var alphaType = comTransparencia ? SKAlphaType.Premul : SKAlphaType.Opaque;
        using var bitmap = new SKBitmap(new SKImageInfo(largura, altura, SKColorType.Rgba8888, alphaType));
        using (var canvas = new SKCanvas(bitmap))
        {
            canvas.Clear(comTransparencia ? SKColors.Transparent : new SKColor(100, 50, 150, 255));
            using var pinturaOpaca = new SKPaint { Color = new SKColor(250, 120, 40, 255) };
            canvas.DrawRect(largura / 2f, altura / 2f, largura / 2f, altura / 2f, pinturaOpaca);
        }
        using var imagem = SKImage.FromBitmap(bitmap);
        using var dados = imagem.Encode(SKEncodedImageFormat.Webp, 90);
        return dados.ToArray();
    }

    /// <summary>
    /// Insere um segmento EXIF APP1 (0xFFE1) válido logo após o SOI (0xFFD8) de um JPEG,
    /// definindo a tag TIFF Orientation (0x0112) e uma tag ImageDescription (0x010E).
    /// </summary>
    private static byte[] InserirSegmentoExifJpeg(byte[] jpegOriginal, ushort orientacaoExif, string comentarioAdicional)
    {
        var bytesTexto = Encoding.ASCII.GetBytes(comentarioAdicional + "\0");
        // Estrutura TIFF little-endian ("II", 0x002A, offset IFD0 = 8)
        // IFD0 com 2 entradas (12 bytes cada) + 4 bytes next IFD (0) + texto ASCII
        var tamanhoTiff = 8 + 2 + (2 * 12) + 4 + bytesTexto.Length;
        var payloadApp1 = new byte[6 + tamanhoTiff];
        Encoding.ASCII.GetBytes("Exif\0\0").CopyTo(payloadApp1, 0);

        var tiff = payloadApp1.AsSpan(6);
        tiff[0] = (byte)'I';
        tiff[1] = (byte)'I';
        BinaryPrimitives.WriteUInt16LittleEndian(tiff[2..], 0x002A);
        BinaryPrimitives.WriteUInt32LittleEndian(tiff[4..], 8);
        BinaryPrimitives.WriteUInt16LittleEndian(tiff[8..], 2); // 2 entradas no IFD0

        // Entrada 1: ImageDescription (0x010E), tipo ASCII (2)
        var entrada1 = tiff[10..];
        BinaryPrimitives.WriteUInt16LittleEndian(entrada1[0..], 0x010E);
        BinaryPrimitives.WriteUInt16LittleEndian(entrada1[2..], 2);
        BinaryPrimitives.WriteUInt32LittleEndian(entrada1[4..], (uint)bytesTexto.Length);
        BinaryPrimitives.WriteUInt32LittleEndian(entrada1[8..], 38); // offset após IFD0

        // Entrada 2: Orientation (0x0112), tipo SHORT (3), count 1, valor = orientacaoExif
        var entrada2 = tiff[22..];
        BinaryPrimitives.WriteUInt16LittleEndian(entrada2[0..], 0x0112);
        BinaryPrimitives.WriteUInt16LittleEndian(entrada2[2..], 3);
        BinaryPrimitives.WriteUInt32LittleEndian(entrada2[4..], 1);
        BinaryPrimitives.WriteUInt16LittleEndian(entrada2[8..], orientacaoExif);
        BinaryPrimitives.WriteUInt16LittleEndian(entrada2[10..], 0);

        // Next IFD offset = 0
        BinaryPrimitives.WriteUInt32LittleEndian(tiff[34..], 0);
        bytesTexto.CopyTo(tiff[38..]);

        var tamanhoSegmento = (ushort)(payloadApp1.Length + 2);
        using var ms = new MemoryStream();
        ms.Write(jpegOriginal, 0, 2); // FF D8
        ms.WriteByte(0xFF);
        ms.WriteByte(0xE1); // APP1
        ms.WriteByte((byte)(tamanhoSegmento >> 8));
        ms.WriteByte((byte)(tamanhoSegmento & 0xFF));
        ms.Write(payloadApp1);
        ms.Write(jpegOriginal, 2, jpegOriginal.Length - 2);
        return ms.ToArray();
    }

    private static byte[] InserirSegmentoComentarioJpeg(byte[] jpegOriginal, string comentario)
    {
        var bytesComentario = Encoding.ASCII.GetBytes(comentario);
        var tamanhoSegmento = (ushort)(bytesComentario.Length + 2);
        using var ms = new MemoryStream();
        ms.Write(jpegOriginal, 0, 2);
        ms.WriteByte(0xFF);
        ms.WriteByte(0xFE); // COM
        ms.WriteByte((byte)(tamanhoSegmento >> 8));
        ms.WriteByte((byte)(tamanhoSegmento & 0xFF));
        ms.Write(bytesComentario);
        ms.Write(jpegOriginal, 2, jpegOriginal.Length - 2);
        return ms.ToArray();
    }

    private static bool ContemSegmentoJpeg(ReadOnlySpan<byte> jpeg, byte marcadorEsperado)
    {
        if (jpeg.Length < 4 || jpeg[0] != 0xFF || jpeg[1] != 0xD8)
            return false;

        var pos = 2;
        while (pos + 1 < jpeg.Length)
        {
            if (jpeg[pos] != 0xFF)
                break;

            var marcador = jpeg[pos + 1];
            if (marcador == marcadorEsperado)
                return true;

            // SOS (FF DA) ou EOI (FF D9) encerram os cabeçalhos de metadados
            if (marcador is 0xDA or 0xD9)
                break;

            if (pos + 3 >= jpeg.Length)
                break;

            var tamanho = BinaryPrimitives.ReadUInt16BigEndian(jpeg.Slice(pos + 2, 2));
            if (tamanho < 2)
                break;

            pos += 2 + tamanho;
        }

        return false;
    }

    private static byte[] GerarCabecalhoPngComDimensoes(int largura, int altura)
    {
        var basePng = GerarImagemPng(16, 16, comTransparencia: false);
        // No PNG, o chunk IHDR começa no offset 8: [length:4][type:4="IHDR"][width:4][height:4]
        BinaryPrimitives.WriteInt32BigEndian(basePng.AsSpan(16, 4), largura);
        BinaryPrimitives.WriteInt32BigEndian(basePng.AsSpan(20, 4), altura);
        return basePng;
    }
}
