namespace Sge.Api.BaixaPatrimonio;

// ---------- Requisições ----------

public sealed record SolicitarBaixaRequest
{
    public int ItemId { get; init; }
    public string? Motivo { get; init; }
    public string? Justificativa { get; init; }
}

public sealed record DeliberarBaixaRequest
{
    public string? Parecer { get; init; }
}

// ---------- Respostas ----------

public sealed record PedidoBaixaDto
{
    public int Id { get; init; }
    public int ItemId { get; init; }
    public string NumeroPatrimonio { get; init; } = string.Empty;
    public string NomePatrimonio { get; init; } = string.Empty;
    public string? NomeAmbiente { get; init; }
    public string? NomeResponsavel { get; init; }
    public int SolicitanteId { get; init; }
    public string NomeSolicitante { get; init; } = string.Empty;
    public string Motivo { get; init; } = string.Empty;
    public string Justificativa { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public int? DeliberacaoId { get; init; }
    public string? NomeDeliberador { get; init; }
    public string? ParecerAdministracao { get; init; }
    public string DataSolicitacao { get; init; } = string.Empty;
    public string? DataDeliberacao { get; init; }
    public IReadOnlyList<AnexoBaixaDto> Anexos { get; init; } = [];
}

public sealed record AnexoBaixaDto
{
    public int AnexoId { get; init; }
    public string? NomeOriginal { get; init; }
    public string TipoMime { get; init; } = string.Empty;
    public long TamanhoBytes { get; init; }
}
