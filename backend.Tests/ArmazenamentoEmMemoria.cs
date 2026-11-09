using System.Collections.Concurrent;
using Microsoft.Extensions.Logging.Abstractions;
using Sge.Api.Infrastructure.Armazenamento;

namespace Sge.Api.Tests;

/// <summary>
/// Implementação em memória de <see cref="ArmazenamentoArquivosBase"/> prevista em
/// PADROES_DESENVOLVIMENTO.md (seção 5) para testes automatizados sem dependência externa.
/// </summary>
public sealed class ArmazenamentoEmMemoria(ProcessadorImagemService? processador = null)
    : ArmazenamentoArquivosBase(NullLogger.Instance, processador)
{
    public sealed record ObjetoArmazenado(byte[] Conteudo, string TipoMime, long TamanhoInformado);

    private readonly ConcurrentDictionary<string, ObjetoArmazenado> _objetos = new(StringComparer.Ordinal);

    public IReadOnlyDictionary<string, ObjetoArmazenado> Objetos => _objetos;

    public void InserirObjetoLegado(string chave, byte[] conteudo, string tipoMime) =>
        _objetos[chave] = new ObjetoArmazenado([.. conteudo], tipoMime, conteudo.LongLength);

    protected override async Task EnviarObjetoAsync(
        string chave, Stream conteudo, string tipoMime, long tamanhoBytes, CancellationToken ct)
    {
        using var memoria = new MemoryStream();
        await conteudo.CopyToAsync(memoria, ct);
        var bytes = memoria.ToArray();

        if (bytes.LongLength != tamanhoBytes)
            throw new InvalidOperationException("O tamanho informado no envio difere do tamanho real do fluxo.");

        _objetos[chave] = new ObjetoArmazenado(bytes, tipoMime, tamanhoBytes);
    }

    protected override Task<Stream> AbrirObjetoAsync(string chave, CancellationToken ct)
    {
        if (!_objetos.TryGetValue(chave, out var objeto))
            throw new FileNotFoundException($"Objeto não encontrado: {chave}");

        Stream fluxo = new MemoryStream(objeto.Conteudo, writable: false);
        return Task.FromResult(fluxo);
    }
}

