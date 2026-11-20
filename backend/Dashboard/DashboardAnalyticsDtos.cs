using System.Text.Json.Serialization;

namespace Sge.Api.Dashboard;

public sealed record DashboardKpisDto(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] double? DiasMedianaCoberturaAtiva,
    int ItensEmRisco,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] double? TempoMedianoAlmoxarifadoHoras,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] double? TempoMedianoCicloHoras,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] double? TempoP90CicloHoras,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] double? TaxaAtendimentoIntegral
);

public sealed record PrevisaoEsgotamentoDto(
    int ProdutoId,
    string Nome,
    decimal EstoqueAtual,
    decimal EstoqueMinimo,
    string UnidadeMedida,
    decimal ConsumoDiarioMedio,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] double? DiasCobertura,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] DateTime? DataPrevistaRuptura,
    StatusRisco StatusRisco,
    NivelConfianca NivelConfianca
);

public sealed record DemandaSetorDto(
    int SetorId,
    string NomeSetor,
    int TotalPedidosAtendidos,
    int TotalItensDistintos,
    double PercentualDemanda
);

public sealed record EtapaWmsDto(
    string EtapaId,
    string EtapaRotulo,
    string Responsabilidade,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] double? TempoMedianoHoras,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] double? PercentualDoCiclo
);

public sealed record TendenciaSemanalDto(
    string SemanaRotulo,
    DateOnly DataInicio,
    int PedidosAtendidos,
    bool Parcial
);

public sealed record DashboardAnalyticsResponseDto(
    DateTime GeradoEm,
    int JanelaDias,
    DashboardKpisDto Kpis,
    IReadOnlyList<PrevisaoEsgotamentoDto> PrevisoesEsgotamento,
    IReadOnlyList<DemandaSetorDto> DemandaSetores,
    IReadOnlyList<EtapaWmsDto> EtapasWms,
    IReadOnlyList<TendenciaSemanalDto> TendenciaSemanal
);
