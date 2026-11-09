namespace Sge.Api.Infrastructure.Armazenamento;

/// <summary>
/// Arquivo recebido do cliente já validado (tipo, conteúdo e tamanho) e com SHA-256 calculado
/// no servidor. O conteúdo fica num arquivo temporário, apagado ao descartar.
/// </summary>
public sealed class ArquivoValidado : IAsyncDisposable
{
    private readonly string _caminhoTemporario;

    internal ArquivoValidado(string caminhoTemporario, string nomeOriginal, string extensao,
        string tipoMime, long tamanhoBytes, string sha256)
    {
        _caminhoTemporario = caminhoTemporario;
        NomeOriginal = nomeOriginal;
        Extensao = extensao;
        TipoMime = tipoMime;
        TamanhoBytes = tamanhoBytes;
        Sha256 = sha256;
    }

    public string NomeOriginal { get; }
    public string Extensao { get; }
    public string TipoMime { get; }
    public long TamanhoBytes { get; }
    public string Sha256 { get; }

    public Stream AbrirLeitura() =>
        new FileStream(_caminhoTemporario, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);

    public ValueTask DisposeAsync()
    {
        try { File.Delete(_caminhoTemporario); } catch (IOException) { /* temporário do sistema; limpeza posterior */ }
        return ValueTask.CompletedTask;
    }
}
