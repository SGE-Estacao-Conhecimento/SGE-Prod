using Sge.Api.Common;

namespace Sge.Api.Dashboard;

/// <summary>
/// Motor puro de calculo preditivo de consumo e previsao de estoque.
/// Totalmente desacoplado de operacoes de I/O, bancos de dados ou relogios de sistema.
/// </summary>
public static class PrevisaoEstoqueCalculador
{
    private static readonly int[] PesosPeriodos = [1, 1, 2, 2, 3, 4];
    private static readonly string[] RotulosPeriodos = ["Mes -5", "Mes -4", "Mes -3", "Mes -2", "Mes -1", "Mes Atual"];
    private const int TotalDiasPorPeriodo = 30;
    private const int QuantidadePeriodos = 6;
    private const int SomaPesos = 13;
    private const string VersaoAtual = "v1.0-iqr";

    public static ResultadoPrevisaoEstoque Calcular(ParametrosCalculoPrevisao parametros)
    {
        ArgumentNullException.ThrowIfNull(parametros);
        return Calcular(
            parametros.ProdutoId,
            parametros.SaldoAtual,
            parametros.EstoqueMinimo,
            parametros.DataReferencia,
            parametros.Historico180Dias
        );
    }

    public static ResultadoPrevisaoEstoque Calcular(
        int produtoId,
        decimal saldoAtual,
        decimal estoqueMinimo,
        DateTime dataReferencia,
        IReadOnlyList<ConsumoDiarioHistorico>? historico180Dias)
    {
        var refDate = DateOnly.FromDateTime(dataReferencia);
        var historicoFim = dataReferencia;
        var historicoInicio = dataReferencia.AddDays(-TotalDiasPorPeriodo * QuantidadePeriodos);

        // 1. Agrupar consumos diarios por data dentro da janela de 180 dias
        var consumoPorDia = new Dictionary<DateOnly, decimal>();
        if (historico180Dias is not null)
        {
            foreach (var item in historico180Dias)
            {
                var delta = refDate.DayNumber - item.Data.DayNumber;
                if (delta >= 0 && delta <= 180 && item.Quantidade > 0)
                {
                    consumoPorDia[item.Data] = consumoPorDia.GetValueOrDefault(item.Data) + item.Quantidade;
                }
            }
        }

        // 2. Expurgo de outliers via IQR (limite = Mediana + 2.5 * IQR)
        var consumosValidos = consumoPorDia.Values
            .Where(v => v > 0)
            .Select(v => (double)v)
            .OrderBy(v => v)
            .ToList();

        double? limiteOutlier = null;
        if (consumosValidos.Count >= 2)
        {
            var q1 = Estatistica.Percentil(consumosValidos, 0.25) ?? 0.0;
            var q3 = Estatistica.Percentil(consumosValidos, 0.75) ?? 0.0;
            var mediana = Estatistica.Mediana(consumosValidos) ?? 0.0;
            var iqr = q3 - q1;
            limiteOutlier = mediana + 2.5 * iqr;
        }

        // 3. Particionar em 6 periodos de 30 dias com atenuacao de outliers
        var detalhePeriodos = new List<PeriodoHistoricoConsumoDto>(QuantidadePeriodos);
        var consumoAtenuadoPorPeriodo = new decimal[QuantidadePeriodos];

        for (int i = 0; i < QuantidadePeriodos; i++)
        {
            // i = 0 (P1: -179 a -150), ..., i = 5 (P6: -29 a 0)
            var diasFimOffset = (QuantidadePeriodos - 1 - i) * TotalDiasPorPeriodo;
            var diasInicioOffset = diasFimOffset + TotalDiasPorPeriodo - 1;

            var dataInicio = refDate.AddDays(-diasInicioOffset);
            var dataFim = refDate.AddDays(-diasFimOffset);

            decimal qtdConsumidaPeriodo = 0m;
            decimal qtdAtenuadaPeriodo = 0m;
            int outliersPeriodo = 0;

            foreach (var (data, qtd) in consumoPorDia)
            {
                var delta = refDate.DayNumber - data.DayNumber;
                // Mapeia o dia para o periodo correspondente
                var pertenceAoPeriodo = (i == 0 && delta >= 150 && delta <= 180) ||
                                       (i > 0 && delta >= diasFimOffset && delta <= diasInicioOffset);

                if (pertenceAoPeriodo)
                {
                    qtdConsumidaPeriodo += qtd;
                    if (limiteOutlier.HasValue && (double)qtd > limiteOutlier.Value)
                    {
                        qtdAtenuadaPeriodo += (decimal)limiteOutlier.Value;
                        outliersPeriodo++;
                    }
                    else
                    {
                        qtdAtenuadaPeriodo += qtd;
                    }
                }
            }

            var taxaDiaria = Math.Round(qtdAtenuadaPeriodo / TotalDiasPorPeriodo, 4);
            consumoAtenuadoPorPeriodo[i] = qtdAtenuadaPeriodo;

            detalhePeriodos.Add(new PeriodoHistoricoConsumoDto(
                PeriodoRotulo: RotulosPeriodos[i],
                DataInicio: dataInicio,
                DataFim: dataFim,
                QuantidadeConsumida: qtdConsumidaPeriodo,
                Peso: PesosPeriodos[i],
                TaxaDiaria: taxaDiaria,
                OutliersAtenuados: outliersPeriodo
            ));
        }

        // 4. Calculo do Consumo Medio Diario Ponderado (CMD)
        decimal somaPonderada = 0m;
        for (int i = 0; i < QuantidadePeriodos; i++)
        {
            somaPonderada += detalhePeriodos[i].TaxaDiaria * PesosPeriodos[i];
        }
        var cmdPonderado = Math.Round(somaPonderada / SomaPesos, 4);

        // 5. Inatividade e Cobertura
        var consumoTotal180 = detalhePeriodos.Sum(p => p.QuantidadeConsumida);
        var consumoUltimos60Dias = detalhePeriodos[4].QuantidadeConsumida + detalhePeriodos[5].QuantidadeConsumida;

        double? diasCobertura = null;
        double? diasCoberturaMinimo = null;
        DateTime? dataPrevistaEstoqueMinimo = null;
        DateTime? dataPrevistaRuptura = null;
        StatusRisco nivelRisco;

        if (saldoAtual <= 0)
        {
            // Ruptura imediata
            nivelRisco = StatusRisco.Critico;
            diasCobertura = 0.0;
            diasCoberturaMinimo = 0.0;
            dataPrevistaRuptura = dataReferencia;
            dataPrevistaEstoqueMinimo = dataReferencia;
        }
        else if (consumoTotal180 == 0)
        {
            // Sem nenhum consumo no historico de 180 dias
            nivelRisco = StatusRisco.SemDadosSuficientes;
        }
        else if (consumoUltimos60Dias == 0)
        {
            // Sem consumo nos ultimos 60 dias (P5 e P6 vazios) com saldo positivo
            nivelRisco = StatusRisco.SemConsumoRecente;
        }
        else
        {
            if (cmdPonderado > 0)
            {
                var maxDiasAdicionaveis = (DateTime.MaxValue - dataReferencia).TotalDays;

                // Calculo de Estoque Minimo
                if (saldoAtual <= estoqueMinimo)
                {
                    diasCoberturaMinimo = 0.0;
                    dataPrevistaEstoqueMinimo = dataReferencia;
                }
                else
                {
                    var diasMinExatos = (double)((saldoAtual - estoqueMinimo) / cmdPonderado);
                    diasCoberturaMinimo = Math.Round(diasMinExatos, 1);
                    dataPrevistaEstoqueMinimo = diasMinExatos >= maxDiasAdicionaveis
                        ? DateTime.MaxValue
                        : dataReferencia.AddDays(diasMinExatos);
                }

                // Calculo de Ruptura
                var diasRupExatos = (double)(saldoAtual / cmdPonderado);
                diasCobertura = Math.Round(diasRupExatos, 1);
                dataPrevistaRuptura = diasRupExatos >= maxDiasAdicionaveis
                    ? DateTime.MaxValue
                    : dataReferencia.AddDays(diasRupExatos);

                // Matriz de Risco
                if (diasRupExatos <= 7.0)
                {
                    nivelRisco = StatusRisco.Critico;
                }
                else if (saldoAtual <= estoqueMinimo || (diasCoberturaMinimo.HasValue && diasCoberturaMinimo.Value <= 7.0) || diasRupExatos <= 15.0)
                {
                    nivelRisco = StatusRisco.AltoRisco;
                }
                else if ((diasCoberturaMinimo.HasValue && diasCoberturaMinimo.Value <= 15.0) || diasRupExatos <= 30.0)
                {
                    nivelRisco = StatusRisco.Atencao;
                }
                else
                {
                    nivelRisco = StatusRisco.Estavel;
                }
            }
            else
            {
                nivelRisco = saldoAtual <= estoqueMinimo ? StatusRisco.AltoRisco : StatusRisco.Estavel;
            }
        }

        // 6. Confianca e CV (Coeficiente de Variacao)
        NivelConfianca confianca;
        decimal? scoreConfianca = null;

        if (saldoAtual <= 0)
        {
            confianca = NivelConfianca.Baixa;
            scoreConfianca = 0.0m;
        }
        else if (consumoTotal180 == 0)
        {
            confianca = NivelConfianca.Baixa;
            scoreConfianca = null;
        }
        else
        {
            var dataMaisAntiga = consumoPorDia.Keys.Min();
            var duracaoDias = refDate.DayNumber - dataMaisAntiga.DayNumber;
            var periodosAtivos = detalhePeriodos.Count(p => p.QuantidadeConsumida > 0);

            var taxas = detalhePeriodos.Select(p => (double)p.TaxaDiaria).ToList();
            var mediaTaxas = taxas.Average();
            double cv = 0.0;
            if (mediaTaxas > 0)
            {
                var variancia = taxas.Sum(t => Math.Pow(t - mediaTaxas, 2)) / taxas.Count;
                var desvioPadrao = Math.Sqrt(variancia);
                cv = desvioPadrao / mediaTaxas;
            }

            if (duracaoDias < 30 || periodosAtivos <= 1 || cv >= 1.0)
            {
                confianca = NivelConfianca.Baixa;
            }
            else if (duracaoDias >= 90 && periodosAtivos >= 4 && cv < 0.5)
            {
                confianca = NivelConfianca.Alta;
            }
            else
            {
                confianca = NivelConfianca.Media;
            }

            var fatorCv = Math.Clamp(1.0 - cv * 0.5, 0.0, 1.0);
            var fatorPeriodos = (double)periodosAtivos / QuantidadePeriodos;
            var fatorDuracao = Math.Clamp((double)duracaoDias / 180.0, 0.2, 1.0);
            var scoreBruto = (fatorCv * 0.5 + fatorPeriodos * 0.3 + fatorDuracao * 0.2) * 100.0;

            scoreConfianca = confianca switch
            {
                NivelConfianca.Alta => Math.Round((decimal)Math.Clamp(scoreBruto, 75.0, 100.0), 2),
                NivelConfianca.Media => Math.Round((decimal)Math.Clamp(scoreBruto, 45.0, 74.9), 2),
                _ => Math.Round((decimal)Math.Clamp(scoreBruto, 5.0, 44.9), 2)
            };
        }

        // 7. Tendencia de Consumo (Recente P5..P6 vs Historico P1..P4)
        TendenciaConsumo tendencia;
        var taxaRecente = (detalhePeriodos[4].TaxaDiaria + detalhePeriodos[5].TaxaDiaria) / 2m;
        var taxaHistorica = (detalhePeriodos[0].TaxaDiaria + detalhePeriodos[1].TaxaDiaria +
                            detalhePeriodos[2].TaxaDiaria + detalhePeriodos[3].TaxaDiaria) / 4m;

        if (taxaHistorica == 0 && taxaRecente > 0)
        {
            tendencia = TendenciaConsumo.Crescente;
        }
        else if (taxaHistorica == 0 && taxaRecente == 0)
        {
            tendencia = TendenciaConsumo.Estavel;
        }
        else if (taxaHistorica > 0 && taxaRecente == 0)
        {
            tendencia = TendenciaConsumo.Decrescente;
        }
        else
        {
            var razao = (double)(taxaRecente / taxaHistorica);
            if (razao > 1.15)
                tendencia = TendenciaConsumo.Crescente;
            else if (razao < 0.85)
                tendencia = TendenciaConsumo.Decrescente;
            else
                tendencia = TendenciaConsumo.Estavel;
        }

        // 8. Projecao Linear de Saldo
        var projecaoSaldo = new List<PontoProjecaoSaldoDto>();
        if (cmdPonderado <= 0 || saldoAtual <= 0 ||
            nivelRisco is StatusRisco.SemConsumoRecente or StatusRisco.SemDadosSuficientes)
        {
            projecaoSaldo.Add(new PontoProjecaoSaldoDto(
                Dia: 0,
                Data: refDate,
                SaldoProjetado: Math.Max(0m, saldoAtual),
                EhEstoqueMinimo: saldoAtual <= estoqueMinimo,
                EhRuptura: saldoAtual <= 0
            ));
        }
        else
        {
            var diasRupturaExatos = (double)(saldoAtual / cmdPonderado);
            var diasRupturaTeto = (int)Math.Ceiling(diasRupturaExatos);
            var diasMinimoExatos = saldoAtual <= estoqueMinimo ? 0.0 : (double)((saldoAtual - estoqueMinimo) / cmdPonderado);
            var diaMinimoMarcador = (int)Math.Ceiling(diasMinimoExatos);

            var limiteDias = Math.Min(diasRupturaTeto, 180);

            for (int d = 0; d <= limiteDias; d++)
            {
                var dataProjetada = refDate.AddDays(d);
                var saldo = Math.Max(0m, Math.Round(saldoAtual - (decimal)d * cmdPonderado, 2));

                var ehMinimo = (saldoAtual <= estoqueMinimo && d == 0) || (saldoAtual > estoqueMinimo && d == diaMinimoMarcador);
                var ehRuptura = (d == diasRupturaTeto) || (saldo == 0m);

                projecaoSaldo.Add(new PontoProjecaoSaldoDto(
                    Dia: d,
                    Data: dataProjetada,
                    SaldoProjetado: saldo,
                    EhEstoqueMinimo: ehMinimo,
                    EhRuptura: ehRuptura
                ));

                if (saldo == 0m)
                    break;
            }
        }

        return new ResultadoPrevisaoEstoque(
            ProdutoId: produtoId,
            EstoqueConsiderado: saldoAtual,
            EstoqueMinimoConsiderado: estoqueMinimo,
            ConsumoDiarioPonderado: cmdPonderado,
            DiasCobertura: diasCobertura,
            DiasCoberturaMinimo: diasCoberturaMinimo,
            DataPrevistaEstoqueMinimo: dataPrevistaEstoqueMinimo,
            DataPrevistaRuptura: dataPrevistaRuptura,
            NivelRisco: nivelRisco,
            Confianca: confianca,
            ScoreConfianca: scoreConfianca,
            TendenciaConsumo: tendencia,
            HistoricoInicio: historicoInicio,
            HistoricoFim: historicoFim,
            CalculadoEm: dataReferencia,
            VersaoAlgoritmo: VersaoAtual,
            DetalhePeriodos: detalhePeriodos,
            ProjecaoSaldo: projecaoSaldo
        );
    }
}
