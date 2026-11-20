using System.Text.Json.Serialization;

namespace Sge.Api.Dashboard;

/// <summary>
/// Representa o consumo diario agregado de um produto em uma data especifica.
/// </summary>
public sealed record ConsumoDiarioHistorico
{
    public DateOnly Data { get; init; }
    public decimal Quantidade { get; init; }

    public ConsumoDiarioHistorico() { }

    public ConsumoDiarioHistorico(DateOnly data, decimal quantidade)
    {
        Data = data;
        Quantidade = quantidade;
    }

    public ConsumoDiarioHistorico(DateTime data, decimal quantidade)
    {
        Data = DateOnly.FromDateTime(data);
        Quantidade = quantidade;
    }
}

/// <summary>
/// Parametros de entrada para o calculador puro de previsao preditiva de estoque.
/// </summary>
public sealed record ParametrosCalculoPrevisao(
    int ProdutoId,
    decimal SaldoAtual,
    decimal EstoqueMinimo,
    DateTime DataReferencia,
    IReadOnlyList<ConsumoDiarioHistorico> Historico180Dias
);

/// <summary>
/// Detalhamento de cada um dos 6 periodos de 30 dias que compoem o historico de 180 dias.
/// </summary>
public sealed record PeriodoHistoricoConsumoDto(
    string PeriodoRotulo,
    DateOnly DataInicio,
    DateOnly DataFim,
    decimal QuantidadeConsumida,
    int Peso,
    decimal TaxaDiaria,
    int OutliersAtenuados
);

/// <summary>
/// Ponto na curva de projecao linear de saldo de estoque ate zero ou limite configurado.
/// </summary>
public sealed record PontoProjecaoSaldoDto(
    int Dia,
    DateOnly Data,
    decimal SaldoProjetado,
    bool EhEstoqueMinimo,
    bool EhRuptura
);

/// <summary>
/// Resultado consolidado do calculador preditivo de estoque.
/// </summary>
public sealed record ResultadoPrevisaoEstoque(
    int ProdutoId,
    decimal EstoqueConsiderado,
    decimal EstoqueMinimoConsiderado,
    decimal ConsumoDiarioPonderado,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] double? DiasCobertura,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] double? DiasCoberturaMinimo,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] DateTime? DataPrevistaEstoqueMinimo,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] DateTime? DataPrevistaRuptura,
    StatusRisco NivelRisco,
    NivelConfianca Confianca,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] decimal? ScoreConfianca,
    TendenciaConsumo TendenciaConsumo,
    DateTime HistoricoInicio,
    DateTime HistoricoFim,
    DateTime CalculadoEm,
    string VersaoAlgoritmo,
    IReadOnlyList<PeriodoHistoricoConsumoDto> DetalhePeriodos,
    IReadOnlyList<PontoProjecaoSaldoDto> ProjecaoSaldo
);

/// <summary>
/// Contrato de resposta para detalhamento individual do material sob demanda.
/// </summary>
public sealed record PrevisaoMaterialDetalheDto(
    int ProdutoId,
    string Nome,
    decimal EstoqueAtual,
    decimal EstoqueMinimo,
    string UnidadeMedida,
    decimal ConsumoDiarioPonderado,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] double? DiasCobertura,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] DateTime? DataPrevistaEstoqueMinimo,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.Never)] DateTime? DataPrevistaRuptura,
    StatusRisco StatusRisco,
    NivelConfianca NivelConfianca,
    TendenciaConsumo TendenciaConsumo,
    DateTime CalculadoEm,
    string VersaoAlgoritmo,
    bool RecalculoPendente,
    IReadOnlyList<PeriodoHistoricoConsumoDto> HistoricoConsumo180Dias,
    IReadOnlyList<PontoProjecaoSaldoDto> ProjecaoSaldo
);
