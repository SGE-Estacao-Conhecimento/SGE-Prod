namespace Sge.Api.Dashboard;

/// <summary>
/// Mapeamento da tabela previsoes_estoque (cardinalidade 1:1 por produto).
/// </summary>
public sealed class PrevisaoEstoqueModel
{
    public int ProdutoId { get; set; }
    public decimal EstoqueConsiderado { get; set; }
    public decimal EstoqueMinimoConsiderado { get; set; }
    public decimal ConsumoDiarioPonderado { get; set; }
    public decimal? DiasCobertura { get; set; }
    public decimal? DiasCoberturaMinimo { get; set; }
    public DateTime? DataPrevistaEstoqueMinimo { get; set; }
    public DateTime? DataPrevistaRuptura { get; set; }
    public string NivelRisco { get; set; } = string.Empty;
    public string Confianca { get; set; } = string.Empty;
    public decimal? ScoreConfianca { get; set; }
    public string TendenciaConsumo { get; set; } = "estavel";
    public DateTime HistoricoInicio { get; set; }
    public DateTime HistoricoFim { get; set; }
    public DateTime CalculadoEm { get; set; }
    public string VersaoAlgoritmo { get; set; } = "1.0";
}

/// <summary>
/// Mapeamento da tabela fila_recalculo_previsao para recálculo incremental assíncrono.
/// </summary>
public sealed class ItemFilaRecalculo
{
    public int ProdutoId { get; set; }
    public long VersaoPendente { get; set; }
    public DateTime SolicitadoEm { get; set; }
    public int Tentativas { get; set; }
    public DateTime ProximaTentativaEm { get; set; }
    public DateTime? BloqueadoAte { get; set; }
    public string? UltimoErro { get; set; }
}
