namespace Sge.Api.Remessas;

/// <summary>Número exibido da remessa (ex.: REM-2026-007), derivado do id e do ano do registro.</summary>
public static class NumeroRemessa
{
    public static string Formatar(int recebimentoId, DateTime dataUtc) => $"REM-{dataUtc.Year}-{recebimentoId:000}";
}

/// <summary>Origem da entrada: valores da tela ('doacao' | 'compra_nf' | 'outros') e do banco.</summary>
public static class OrigemRemessa
{
    public static string? ParaBanco(string? valor) => (valor ?? string.Empty).Trim().ToLowerInvariant() switch
    {
        "doacao" => "doacao",
        "compra_nf" or "compra" => "compra",
        "outros" or "outro" => "outro",
        _ => null
    };

    public static string ParaFront(string valor) => valor switch
    {
        "compra" => "compra_nf",
        "outro" => "outros",
        _ => valor
    };
}

public static class StatusRemessa
{
    public const string Preparacao = "preparacao";
    public const string Confirmado = "confirmado";
    public const string Cancelado = "cancelado";

    public static string Rotulo(string status) => status switch
    {
        Preparacao => "Em preparação",
        Confirmado => "Concluído",
        Cancelado => "Cancelado",
        _ => status
    };
}

// ---------- Requisição (modal "Receber em Lote / Doação") ----------

public sealed record RemessaItemRequest(int MaterialId, decimal QtdRecebida);

/// <summary>
/// IdentificadorOperacao (UUID gerado pela tela para cada rascunho) torna o envio repetível:
/// uma nova tentativa após falha reaproveita o recebimento em preparação, sem duplicar.
/// </summary>
public sealed record CriarRemessaRequest(
    string? IdentificadorOperacao,
    string? TipoOrigem,
    string? DocumentoDoador,
    string? Observacao,
    List<RemessaItemRequest>? Itens,
    int? RecebimentoOrigemId = null);

// ---------- Resposta (mesmo formato do modo simulado) ----------

public sealed record RemessaItemDto(int MaterialId, string MaterialNome, decimal Quantidade, string Unidade);

public sealed record RemessaAnexoDto(int Id, string NomeOriginal, string TipoMime, long TamanhoBytes, string Status);

public sealed record RemessaDto(
    int Id,
    string NumeroRemessa,
    string TipoOrigem,
    string DocumentoDoador,
    IReadOnlyList<RemessaItemDto> Itens,
    int? MaterialId,
    string MaterialNome,
    decimal Quantidade,
    string Fornecedor,
    string RecebidoPor,
    string DataEnvio,
    DateTime Data,
    string Status,
    string? Observacao,
    IReadOnlyList<RemessaAnexoDto> Fotos,
    int? RecebimentoOrigemId = null);
