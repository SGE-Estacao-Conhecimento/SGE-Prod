using System.Data.Common;
using Dapper;
using MySqlConnector;
using Sge.Api.Infrastructure;

namespace Sge.Api.Dashboard;

public sealed class PrevisaoEstoqueService(
    DbConnectionFactory db,
    IPrevisoesEstoqueRepository previsoesRepo,
    IFilaRecalculoRepository filaRepo) : IPrevisaoEstoqueService
{
    private sealed record ProdutoDados(
        int ProdutoId,
        string Nome,
        decimal Quantidade,
        decimal QuantidadeMinima,
        string? UnidadeMedida,
        bool Ativo,
        bool BemDuravel
    );

    private const string SqlObterProduto = """
        SELECT produto_id,
               nome,
               quantidade,
               quantidade_minima,
               unidade_medida,
               ativo,
               bem_duravel
          FROM produtos
         WHERE produto_id = @produtoId
         LIMIT 1;
        """;

    private const string SqlHistoricoConsumo = """
        SELECT DATE(data_movimentacao) AS data,
               SUM(quantidade) AS quantidade
          FROM movimentacoes_estoque
         WHERE produto_id = @produtoId
           AND sentido = 'saida'
           AND tipo = 'saida_pedido'
           AND data_movimentacao >= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 180 DAY)
         GROUP BY DATE(data_movimentacao)
         ORDER BY DATE(data_movimentacao) ASC;
        """;

    private const string SqlVerificarFilaPendente = """
        SELECT COUNT(1)
          FROM fila_recalculo_previsao
         WHERE produto_id = @produtoId;
        """;

    public async Task<ResultadoPrevisaoEstoque?> CalcularEAtualizarAsync(int produtoId, CancellationToken ct = default)
    {
        await using var con = await db.AbrirAsync(ct);

        var produto = await con.QuerySingleOrDefaultAsync<ProdutoDados>(SqlObterProduto, new { produtoId });
        if (produto is null)
            return null;

        var historico = await ObterHistoricoConsumoAsync(con, produtoId);

        var resultado = PrevisaoEstoqueCalculador.Calcular(
            produtoId: produto.ProdutoId,
            saldoAtual: produto.Quantidade,
            estoqueMinimo: produto.QuantidadeMinima,
            dataReferencia: DateTime.UtcNow,
            historico180Dias: historico
        );

        var model = new PrevisaoEstoqueModel
        {
            ProdutoId = resultado.ProdutoId,
            EstoqueConsiderado = resultado.EstoqueConsiderado,
            EstoqueMinimoConsiderado = resultado.EstoqueMinimoConsiderado,
            ConsumoDiarioPonderado = resultado.ConsumoDiarioPonderado,
            DiasCobertura = ConverterParaDecimal(resultado.DiasCobertura),
            DiasCoberturaMinimo = ConverterParaDecimal(resultado.DiasCoberturaMinimo),
            DataPrevistaEstoqueMinimo = resultado.DataPrevistaEstoqueMinimo,
            DataPrevistaRuptura = resultado.DataPrevistaRuptura,
            NivelRisco = resultado.NivelRisco.ParaValorBanco(),
            Confianca = resultado.Confianca.ParaValorBanco(),
            ScoreConfianca = resultado.ScoreConfianca,
            TendenciaConsumo = resultado.TendenciaConsumo.ParaValorBanco(),
            HistoricoInicio = resultado.HistoricoInicio,
            HistoricoFim = resultado.HistoricoFim,
            CalculadoEm = resultado.CalculadoEm,
            VersaoAlgoritmo = resultado.VersaoAlgoritmo
        };

        await previsoesRepo.SalvarAsync(model, ct);

        return resultado;
    }

    public async Task<PrevisaoMaterialDetalheDto?> ObterDetalheAsync(int produtoId, CancellationToken ct = default)
    {
        await using var con = await db.AbrirAsync(ct);

        var produto = await con.QuerySingleOrDefaultAsync<ProdutoDados>(SqlObterProduto, new { produtoId });
        if (produto is null)
            return null;

        var pendenteCount = await con.ExecuteScalarAsync<int>(SqlVerificarFilaPendente, new { produtoId });
        var recalculoPendente = pendenteCount > 0;

        var historico = await ObterHistoricoConsumoAsync(con, produtoId);

        var resultado = PrevisaoEstoqueCalculador.Calcular(
            produtoId: produto.ProdutoId,
            saldoAtual: produto.Quantidade,
            estoqueMinimo: produto.QuantidadeMinima,
            dataReferencia: DateTime.UtcNow,
            historico180Dias: historico
        );

        return new PrevisaoMaterialDetalheDto(
            ProdutoId: produto.ProdutoId,
            Nome: produto.Nome,
            EstoqueAtual: produto.Quantidade,
            EstoqueMinimo: produto.QuantidadeMinima,
            UnidadeMedida: string.IsNullOrWhiteSpace(produto.UnidadeMedida) ? "un" : produto.UnidadeMedida,
            ConsumoDiarioPonderado: resultado.ConsumoDiarioPonderado,
            DiasCobertura: resultado.DiasCobertura,
            DataPrevistaEstoqueMinimo: resultado.DataPrevistaEstoqueMinimo,
            DataPrevistaRuptura: resultado.DataPrevistaRuptura,
            StatusRisco: resultado.NivelRisco,
            NivelConfianca: resultado.Confianca,
            TendenciaConsumo: resultado.TendenciaConsumo,
            CalculadoEm: resultado.CalculadoEm,
            VersaoAlgoritmo: resultado.VersaoAlgoritmo,
            RecalculoPendente: recalculoPendente,
            HistoricoConsumo180Dias: resultado.DetalhePeriodos,
            ProjecaoSaldo: resultado.ProjecaoSaldo
        );
    }

    public Task SolicitarRecalculoAsync(int produtoId, CancellationToken ct = default)
    {
        return filaRepo.EnfileirarAsync(produtoId, ct);
    }

    private static async Task<IReadOnlyList<ConsumoDiarioHistorico>> ObterHistoricoConsumoAsync(
        MySqlConnection con,
        int produtoId)
    {
        var linhas = await con.QueryAsync(SqlHistoricoConsumo, new { produtoId });
        var historico = new List<ConsumoDiarioHistorico>();

        foreach (var row in linhas)
        {
            var dict = (IDictionary<string, object>)row;
            if (!dict.TryGetValue("data", out var rawData) || rawData is null || rawData is DBNull)
                continue;

            if (!dict.TryGetValue("quantidade", out var rawQtd) || rawQtd is null || rawQtd is DBNull)
                continue;

            DateOnly dataOnly = rawData switch
            {
                DateOnly d => d,
                DateTime dt => DateOnly.FromDateTime(dt),
                string s when DateOnly.TryParse(s, out var parsed) => parsed,
                _ => DateOnly.FromDateTime(Convert.ToDateTime(rawData))
            };

            var qtd = Convert.ToDecimal(rawQtd);
            historico.Add(new ConsumoDiarioHistorico(dataOnly, qtd));
        }

        return historico;
    }

    public static decimal? ConverterParaDecimal(double? valor)
    {
        if (!valor.HasValue || double.IsNaN(valor.Value) || double.IsInfinity(valor.Value))
            return null;

        if (valor.Value < 0)
            return 0m;

        if (valor.Value > 99999999.99)
            return 99999999.99m;

        return (decimal)Math.Round(valor.Value, 2);
    }
}

public static class PrevisaoEnumExtensions
{
    public static string ParaValorBanco(this StatusRisco status) => status switch
    {
        StatusRisco.Critico => "critico",
        StatusRisco.Alerta => "alerta",
        StatusRisco.AltoRisco => "alto_risco",
        StatusRisco.Atencao => "atencao",
        StatusRisco.Estavel => "estavel",
        StatusRisco.SemConsumoRecente => "sem_consumo_recente",
        StatusRisco.SemDadosSuficientes => "sem_dados_suficientes",
        StatusRisco.SemGiro => "sem_giro",
        _ => "estavel"
    };

    public static string ParaValorBanco(this NivelConfianca confianca) => confianca switch
    {
        NivelConfianca.Alta => "alta",
        NivelConfianca.Media => "media",
        NivelConfianca.Baixa => "baixa",
        _ => "baixa"
    };

    public static string ParaValorBanco(this TendenciaConsumo tendencia) => tendencia switch
    {
        TendenciaConsumo.Crescente => "crescente",
        TendenciaConsumo.Estavel => "estavel",
        TendenciaConsumo.Decrescente => "decrescente",
        _ => "estavel"
    };

    public static StatusRisco ParaStatusRisco(this string? valor) => valor switch
    {
        "critico" => StatusRisco.Critico,
        "alerta" => StatusRisco.Alerta,
        "alto_risco" => StatusRisco.AltoRisco,
        "atencao" => StatusRisco.Atencao,
        "estavel" => StatusRisco.Estavel,
        "sem_consumo_recente" => StatusRisco.SemConsumoRecente,
        "sem_dados_suficientes" => StatusRisco.SemDadosSuficientes,
        "sem_giro" => StatusRisco.SemGiro,
        _ => StatusRisco.Estavel
    };

    public static NivelConfianca ParaNivelConfianca(this string? valor) => valor switch
    {
        "alta" => NivelConfianca.Alta,
        "media" => NivelConfianca.Media,
        "baixa" => NivelConfianca.Baixa,
        _ => NivelConfianca.Baixa
    };

    public static TendenciaConsumo ParaTendenciaConsumo(this string? valor) => valor switch
    {
        "crescente" => TendenciaConsumo.Crescente,
        "estavel" => TendenciaConsumo.Estavel,
        "decrescente" => TendenciaConsumo.Decrescente,
        _ => TendenciaConsumo.Estavel
    };
}
