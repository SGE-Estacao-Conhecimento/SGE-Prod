using System.Globalization;
using Dapper;
using Sge.Api.Common;
using Sge.Api.Infrastructure;

namespace Sge.Api.Dashboard;

/// <summary>
/// Repositorio de metricas executivas e operacionais do Dashboard.
/// Premissa critica de fuso: DbConnectionFactory define 'SET time_zone = +00:00',
/// garantindo que data_pedido e data_log (TIMESTAMP) sejam retornados em UTC,
/// compativeis com data_atendimento (DATETIME gravado em UTC).
/// </summary>
public sealed class DashboardRepository(DbConnectionFactory db) : RepositorioBase(db), IDashboardRepository
{
    /// <summary>
    /// Indicadores legados da tela inicial da administracao.
    /// </summary>
    public async Task<DashboardDto> ObterAsync(CancellationToken ct = default)
    {
        await using var con = await AbrirAsync(ct);
        return await con.QuerySingleAsync<DashboardDto>(new CommandDefinition("""
            SELECT
              (SELECT COUNT(*) FROM produtos WHERE ativo = TRUE) AS TotalProdutos,
              (SELECT COUNT(*) FROM produtos WHERE ativo = TRUE AND quantidade <= quantidade_minima) AS ProdutosEstoqueBaixo,
              (SELECT COUNT(*) FROM pedidos WHERE status = 'pendente') AS PedidosPendentes,
              (SELECT COUNT(*) FROM usuarios) AS TotalUsuarios
            """, cancellationToken: ct));
    }

    /// <summary>
    /// Executa as consultas analiticas e preditivas para a janela informada.
    /// </summary>
    public async Task<DashboardAnalyticsResponseDto> CalcularAnalyticsAsync(int janelaDias, CancellationToken ct = default)
    {
        var dataReferencia = DateTime.UtcNow;
        var desde = dataReferencia.AddDays(-janelaDias);

        await using var con = await AbrirAsync(ct);

        // 1. Leitura das previsoes de estoque persistidas para materiais ativos de consumo
        const string sqlPrevisoes = """
            SELECT p.produto_id        AS ProdutoId,
                   p.nome              AS Nome,
                   p.quantidade        AS EstoqueAtual,
                   p.quantidade_minima AS EstoqueMinimo,
                   p.unidade_medida    AS UnidadeMedida,
                   pe.consumo_diario_ponderado AS ConsumoDiarioPonderado,
                   pe.dias_cobertura   AS DiasCobertura,
                   pe.data_prevista_ruptura AS DataPrevistaRuptura,
                   pe.data_prevista_estoque_minimo AS DataPrevistaEstoqueMinimo,
                   pe.nivel_risco      AS NivelRisco,
                   pe.confianca        AS Confianca,
                   pe.tendencia_consumo AS TendenciaConsumo
              FROM produtos p
              LEFT JOIN previsoes_estoque pe ON pe.produto_id = p.produto_id
             WHERE p.ativo = TRUE
               AND p.bem_duravel = FALSE;
            """;

        var produtos = (await con.QueryAsync<ProdutoPrevisaoRow>(
            new CommandDefinition(sqlPrevisoes, cancellationToken: ct))).AsList();

        var coberturasAtivas = new List<double>();
        var itensEmRisco = 0;

        var criticos = new List<PrevisaoEsgotamentoDto>();
        var altoRiscoOuAlerta = new List<PrevisaoEsgotamentoDto>();
        var atencao = new List<PrevisaoEsgotamentoDto>();
        var semGiroOuInativo = new List<PrevisaoEsgotamentoDto>();
        var estaveis = new List<PrevisaoEsgotamentoDto>();

        foreach (var prod in produtos)
        {
            var cmd = Math.Round(prod.ConsumoDiarioPonderado ?? 0m, 1);
            StatusRisco status;
            NivelConfianca confianca;
            double? diasCobertura = null;
            DateTime? dataRupturaUtc = null;

            if (prod.EstoqueAtual <= 0)
            {
                status = StatusRisco.Critico;
                confianca = NivelConfianca.Baixa;
                diasCobertura = null;
                dataRupturaUtc = null;
            }
            else if (!string.IsNullOrEmpty(prod.NivelRisco))
            {
                status = prod.NivelRisco.ParaStatusRisco();
                confianca = prod.Confianca.ParaNivelConfianca();
                diasCobertura = prod.DiasCobertura.HasValue ? (double)prod.DiasCobertura.Value : null;
                dataRupturaUtc = prod.DataPrevistaRuptura.HasValue
                    ? DateTime.SpecifyKind(prod.DataPrevistaRuptura.Value, DateTimeKind.Utc)
                    : null;
            }
            else
            {
                status = StatusRisco.SemDadosSuficientes;
                confianca = NivelConfianca.Baixa;
                diasCobertura = null;
                dataRupturaUtc = null;
            }

            if (status is StatusRisco.Critico or StatusRisco.AltoRisco or StatusRisco.Alerta)
                itensEmRisco++;

            if (cmd > 0 && prod.EstoqueAtual > 0 && diasCobertura.HasValue)
                coberturasAtivas.Add(diasCobertura.Value);

            var dto = new PrevisaoEsgotamentoDto(
                prod.ProdutoId,
                prod.Nome,
                prod.EstoqueAtual,
                prod.EstoqueMinimo,
                string.IsNullOrWhiteSpace(prod.UnidadeMedida) ? "UN" : prod.UnidadeMedida,
                cmd,
                diasCobertura,
                dataRupturaUtc,
                status,
                confianca
            );

            switch (status)
            {
                case StatusRisco.Critico:
                    criticos.Add(dto);
                    break;
                case StatusRisco.AltoRisco or StatusRisco.Alerta:
                    altoRiscoOuAlerta.Add(dto);
                    break;
                case StatusRisco.Atencao:
                    atencao.Add(dto);
                    break;
                case StatusRisco.SemConsumoRecente or StatusRisco.SemDadosSuficientes or StatusRisco.SemGiro:
                    semGiroOuInativo.Add(dto);
                    break;
                default:
                    estaveis.Add(dto);
                    break;
            }
        }

        var medCobertura = Estatistica.Mediana(coberturasAtivas);
        double? diasMedianaCoberturaAtiva = medCobertura.HasValue ? Math.Round(medCobertura.Value, 1) : null;

        var criticosOrdenados = criticos
            .OrderBy(p => p.EstoqueAtual <= 0 ? 0 : 1)
            .ThenBy(p => p.DiasCobertura ?? double.MaxValue)
            .ThenBy(p => p.ProdutoId);

        var altoRiscoOrdenados = altoRiscoOuAlerta
            .OrderBy(p => p.DiasCobertura ?? double.MaxValue)
            .ThenBy(p => p.ProdutoId);

        var atencaoOrdenados = atencao
            .OrderBy(p => p.DiasCobertura ?? double.MaxValue)
            .ThenBy(p => p.ProdutoId);

        var semGiroOrdenados = semGiroOuInativo
            .OrderByDescending(p => p.EstoqueAtual)
            .ThenBy(p => p.ProdutoId);

        var estaveisOrdenados = estaveis
            .OrderBy(p => p.DiasCobertura ?? double.MaxValue)
            .ThenBy(p => p.ProdutoId);

        var previsoesEsgotamento = criticosOrdenados
            .Concat(altoRiscoOrdenados)
            .Concat(atencaoOrdenados)
            .Concat(semGiroOrdenados)
            .Concat(estaveisOrdenados)
            .ToList();

        // 2. Taxa de atendimento integral (pedidos atendidos onde todos os itens foram integralmente entregues)
        const string sqlIntegral = """
            SELECT ped.pedido_id AS PedidoId,
                   MIN(CASE WHEN COALESCE(pi.quantidade_entregue, pi.quantidade_solicitada) >= pi.quantidade_solicitada THEN 1 ELSE 0 END) AS Integral
              FROM pedidos ped
              JOIN pedido_itens pi ON pi.pedido_id = ped.pedido_id
             WHERE ped.status = 'atendido'
               AND ped.data_atendimento >= @desde
             GROUP BY ped.pedido_id;
            """;

        var pedidosIntegral = (await con.QueryAsync<(int PedidoId, long Integral)>(
            new CommandDefinition(sqlIntegral, new { desde }, cancellationToken: ct))).AsList();

        double? taxaAtendimentoIntegral = null;
        if (pedidosIntegral.Count > 0)
        {
            var integrais = pedidosIntegral.Count(p => p.Integral == 1L);
            taxaAtendimentoIntegral = Math.Round((double)integrais / pedidosIntegral.Count * 100.0, 1);
        }

        // 3. Demanda por setor na janela selecionada
        const string sqlDemandaSetores = """
            SELECT s.setor_id AS SetorId,
                   s.nome     AS NomeSetor,
                   COUNT(DISTINCT ped.pedido_id) AS TotalPedidosAtendidos,
                   COUNT(DISTINCT pi.produto_id) AS TotalItensDistintos
              FROM pedidos ped
              JOIN setores s       ON s.setor_id = ped.setor_id
              JOIN pedido_itens pi ON pi.pedido_id = ped.pedido_id
             WHERE ped.status = 'atendido'
               AND ped.data_atendimento >= @desde
             GROUP BY s.setor_id, s.nome
             ORDER BY TotalPedidosAtendidos DESC, s.setor_id ASC;
            """;

        var setores = (await con.QueryAsync<SetorDemandaRow>(
            new CommandDefinition(sqlDemandaSetores, new { desde }, cancellationToken: ct))).AsList();

        var totalPedidosGeral = setores.Sum(s => s.TotalPedidosAtendidos);
        var demandaSetores = setores.Select(s => new DemandaSetorDto(
            s.SetorId,
            s.NomeSetor,
            (int)s.TotalPedidosAtendidos,
            (int)s.TotalItensDistintos,
            totalPedidosGeral > 0 ? Math.Round((double)s.TotalPedidosAtendidos / totalPedidosGeral * 100.0, 1) : 0.0
        )).ToList();

        // 4. Eficiencia Operacional (Etapas WMS e Ciclo de Atendimento)
        const string sqlPedidosAtendidos = """
            SELECT ped.pedido_id        AS PedidoId,
                   ped.data_pedido      AS DataPedido,
                   ped.data_atendimento AS DataAtendimento
              FROM pedidos ped
             WHERE ped.status = 'atendido'
               AND ped.data_atendimento >= @desde;
            """;

        const string sqlPedidoLogs = """
            SELECT pl.pedido_id   AS PedidoId,
                   pl.status_novo AS StatusNovo,
                   pl.data_log    AS DataLog
              FROM pedido_logs pl
              JOIN pedidos ped ON ped.pedido_id = pl.pedido_id
             WHERE ped.status = 'atendido'
               AND ped.data_atendimento >= @desde
               AND pl.status_novo IN ('em_separacao', 'pronto_retirada')
             ORDER BY pl.pedido_id, pl.data_log ASC;
            """;

        var pedidosWms = (await con.QueryAsync<PedidoAtendidoRow>(
            new CommandDefinition(sqlPedidosAtendidos, new { desde }, cancellationToken: ct))).AsList();

        var logsWms = (await con.QueryAsync<PedidoLogRow>(
            new CommandDefinition(sqlPedidoLogs, new { desde }, cancellationToken: ct))).AsList();

        var logsPorPedido = logsWms
            .GroupBy(l => l.PedidoId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var cicloDuracoes = new List<double>();
        var almoxarifadoDuracoes = new List<double>();
        var etapa1Duracoes = new List<double>();
        var etapa2Duracoes = new List<double>();
        var etapa3Duracoes = new List<double>();

        foreach (var ped in pedidosWms)
        {
            if (ped.DataAtendimento is not { } dataAtendimento)
                continue;

            var dataPedido = ped.DataPedido;
            var duracaoCiclo = (dataAtendimento - dataPedido).TotalHours;
            if (duracaoCiclo > 0)
                cicloDuracoes.Add(duracaoCiclo);

            logsPorPedido.TryGetValue(ped.PedidoId, out var logs);
            var logSeparacao = logs?.FirstOrDefault(l => l.StatusNovo == "em_separacao");
            var logPronto = logs?.FirstOrDefault(l => l.StatusNovo == "pronto_retirada");

            // Etapa 1: data_pedido ate o primeiro log em_separacao
            if (logSeparacao is not null)
            {
                var d1 = (logSeparacao.DataLog - dataPedido).TotalHours;
                if (d1 > 0)
                    etapa1Duracoes.Add(d1);
            }

            // Etapa 2: primeiro log em_separacao ate o primeiro log pronto_retirada
            if (logSeparacao is not null && logPronto is not null)
            {
                var d2 = (logPronto.DataLog - logSeparacao.DataLog).TotalHours;
                if (d2 > 0)
                    etapa2Duracoes.Add(d2);
            }

            // Etapa 3: primeiro log pronto_retirada ate data_atendimento
            if (logPronto is not null)
            {
                var d3 = (dataAtendimento - logPronto.DataLog).TotalHours;
                if (d3 > 0)
                    etapa3Duracoes.Add(d3);
            }

            // Almoxarifado: duracao combinada de fila e separacao por pedido (apenas se ambas ocorreram)
            if (logSeparacao is not null && logPronto is not null)
            {
                var dFila = (logSeparacao.DataLog - dataPedido).TotalHours;
                var dSep = (logPronto.DataLog - logSeparacao.DataLog).TotalHours;
                if (dFila > 0 && dSep > 0)
                    almoxarifadoDuracoes.Add(dFila + dSep);
            }
        }

        var medCiclo = Estatistica.Mediana(cicloDuracoes);
        double? tempoMedianoCicloHoras = medCiclo.HasValue ? Math.Round(medCiclo.Value, 1) : null;

        var p90Ciclo = Estatistica.Percentil(cicloDuracoes.OrderBy(x => x).ToList(), 0.9);
        double? tempoP90CicloHoras = p90Ciclo.HasValue ? Math.Round(p90Ciclo.Value, 1) : null;

        var medAlmox = Estatistica.Mediana(almoxarifadoDuracoes);
        double? tempoMedianoAlmoxarifadoHoras = medAlmox.HasValue ? Math.Round(medAlmox.Value, 1) : null;

        var medE1 = Estatistica.Mediana(etapa1Duracoes);
        var medE2 = Estatistica.Mediana(etapa2Duracoes);
        var medE3 = Estatistica.Mediana(etapa3Duracoes);

        double? t1 = medE1.HasValue ? Math.Round(medE1.Value, 1) : null;
        double? t2 = medE2.HasValue ? Math.Round(medE2.Value, 1) : null;
        double? t3 = medE3.HasValue ? Math.Round(medE3.Value, 1) : null;

        double somaMedianasEtapas = (t1 ?? 0) + (t2 ?? 0) + (t3 ?? 0);

        double? pct1 = (somaMedianasEtapas > 0 && t1.HasValue) ? Math.Round(t1.Value / somaMedianasEtapas * 100.0, 1) : null;
        double? pct2 = (somaMedianasEtapas > 0 && t2.HasValue) ? Math.Round(t2.Value / somaMedianasEtapas * 100.0, 1) : null;
        double? pct3 = (somaMedianasEtapas > 0 && t3.HasValue) ? Math.Round(t3.Value / somaMedianasEtapas * 100.0, 1) : null;

        var etapasWms = new List<EtapaWmsDto>
        {
            new("aguardando_separacao", "Aguardando Separação", "Almoxarifado (Fila)", t1, pct1),
            new("em_separacao", "Em Separação", "Almoxarife (Montagem)", t2, pct2),
            new("aguardando_retirada", "Aguardando Retirada", "Setor Solicitante (Balcão)", t3, pct3)
        };

        // 5. Tendencia semanal (serie fixa de 8 semanas ISO)
        var anoAtual = ISOWeek.GetYear(dataReferencia);
        var semanaAtual = ISOWeek.GetWeekOfYear(dataReferencia);
        var segundaSemanaAtual = ISOWeek.ToDateTime(anoAtual, semanaAtual, DayOfWeek.Monday);
        var inicioOitoSemanas = segundaSemanaAtual.AddDays(-7 * 7);

        const string sqlTendencia = """
            SELECT YEARWEEK(ped.data_atendimento, 3) AS AnoSemana,
                   COUNT(*) AS Total
              FROM pedidos ped
             WHERE ped.status = 'atendido'
               AND ped.data_atendimento >= @inicioOitoSemanas
             GROUP BY YEARWEEK(ped.data_atendimento, 3);
            """;

        var rowsTendencia = (await con.QueryAsync<(long AnoSemana, long Total)>(
            new CommandDefinition(sqlTendencia, new { inicioOitoSemanas }, cancellationToken: ct))).AsList();

        var dictTendencia = rowsTendencia.ToDictionary(r => r.AnoSemana, r => (int)r.Total);

        var tendenciaSemanal = new List<TendenciaSemanalDto>();
        for (int i = 7; i >= 0; i--)
        {
            var seg = segundaSemanaAtual.AddDays(-i * 7);
            var y = ISOWeek.GetYear(seg);
            var w = ISOWeek.GetWeekOfYear(seg);
            long chave = y * 100L + w;
            var total = dictTendencia.TryGetValue(chave, out var c) ? c : 0;
            var semanaRotulo = $"Sem {w}";
            var dataInicio = DateOnly.FromDateTime(seg);
            var parcial = (i == 0);

            tendenciaSemanal.Add(new TendenciaSemanalDto(semanaRotulo, dataInicio, total, parcial));
        }

        var kpis = new DashboardKpisDto(
            DiasMedianaCoberturaAtiva: diasMedianaCoberturaAtiva,
            ItensEmRisco: itensEmRisco,
            TempoMedianoAlmoxarifadoHoras: tempoMedianoAlmoxarifadoHoras,
            TempoMedianoCicloHoras: tempoMedianoCicloHoras,
            TempoP90CicloHoras: tempoP90CicloHoras,
            TaxaAtendimentoIntegral: taxaAtendimentoIntegral
        );

        return new DashboardAnalyticsResponseDto(
            GeradoEm: DateTime.SpecifyKind(dataReferencia, DateTimeKind.Utc),
            JanelaDias: janelaDias,
            Kpis: kpis,
            PrevisoesEsgotamento: previsoesEsgotamento,
            DemandaSetores: demandaSetores,
            EtapasWms: etapasWms,
            TendenciaSemanal: tendenciaSemanal
        );
    }

    private sealed record ProdutoPrevisaoRow(
        int ProdutoId,
        string Nome,
        decimal EstoqueAtual,
        decimal EstoqueMinimo,
        string? UnidadeMedida,
        decimal? ConsumoDiarioPonderado,
        decimal? DiasCobertura,
        DateTime? DataPrevistaRuptura,
        DateTime? DataPrevistaEstoqueMinimo,
        string? NivelRisco,
        string? Confianca,
        string? TendenciaConsumo
    );

    private sealed record SetorDemandaRow(
        int SetorId,
        string NomeSetor,
        long TotalPedidosAtendidos,
        long TotalItensDistintos
    );

    private sealed record PedidoAtendidoRow(
        int PedidoId,
        DateTime DataPedido,
        DateTime? DataAtendimento
    );

    private sealed record PedidoLogRow(
        int PedidoId,
        string StatusNovo,
        DateTime DataLog
    );
}
