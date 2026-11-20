using Dapper;
using Sge.Api.Infrastructure;

namespace Sge.Api.Dashboard;

public sealed class PrevisoesEstoqueRepository(DbConnectionFactory db) : RepositorioBase(db), IPrevisoesEstoqueRepository
{
    private const string SqlSelectColunas = """
        SELECT produto_id,
               estoque_considerado,
               estoque_minimo_considerado,
               consumo_diario_ponderado,
               dias_cobertura,
               dias_cobertura_minimo,
               data_prevista_estoque_minimo,
               data_prevista_ruptura,
               nivel_risco,
               confianca,
               score_confianca,
               tendencia_consumo,
               historico_inicio,
               historico_fim,
               calculado_em,
               versao_algoritmo
          FROM previsoes_estoque
        """;

    private const string SqlUpsert = """
        INSERT INTO previsoes_estoque (
            produto_id,
            estoque_considerado,
            estoque_minimo_considerado,
            consumo_diario_ponderado,
            dias_cobertura,
            dias_cobertura_minimo,
            data_prevista_estoque_minimo,
            data_prevista_ruptura,
            nivel_risco,
            confianca,
            score_confianca,
            tendencia_consumo,
            historico_inicio,
            historico_fim,
            calculado_em,
            versao_algoritmo
        ) VALUES (
            @ProdutoId,
            @EstoqueConsiderado,
            @EstoqueMinimoConsiderado,
            @ConsumoDiarioPonderado,
            @DiasCobertura,
            @DiasCoberturaMinimo,
            @DataPrevistaEstoqueMinimo,
            @DataPrevistaRuptura,
            @NivelRisco,
            @Confianca,
            @ScoreConfianca,
            @TendenciaConsumo,
            @HistoricoInicio,
            @HistoricoFim,
            @CalculadoEm,
            @VersaoAlgoritmo
        ) ON DUPLICATE KEY UPDATE
            estoque_considerado = @EstoqueConsiderado,
            estoque_minimo_considerado = @EstoqueMinimoConsiderado,
            consumo_diario_ponderado = @ConsumoDiarioPonderado,
            dias_cobertura = @DiasCobertura,
            dias_cobertura_minimo = @DiasCoberturaMinimo,
            data_prevista_estoque_minimo = @DataPrevistaEstoqueMinimo,
            data_prevista_ruptura = @DataPrevistaRuptura,
            nivel_risco = @NivelRisco,
            confianca = @Confianca,
            score_confianca = @ScoreConfianca,
            tendencia_consumo = @TendenciaConsumo,
            historico_inicio = @HistoricoInicio,
            historico_fim = @HistoricoFim,
            calculado_em = @CalculadoEm,
            versao_algoritmo = @VersaoAlgoritmo;
        """;

    public async Task<PrevisaoEstoqueModel?> ObterPorProdutoIdAsync(int produtoId, CancellationToken ct = default)
    {
        await using var con = await AbrirAsync(ct);
        var sql = $"{SqlSelectColunas} WHERE produto_id = @produtoId LIMIT 1;";
        return await con.QuerySingleOrDefaultAsync<PrevisaoEstoqueModel>(sql, new { produtoId });
    }

    public async Task<IReadOnlyList<PrevisaoEstoqueModel>> ObterTodasAsync(CancellationToken ct = default)
    {
        await using var con = await AbrirAsync(ct);
        var sql = $"{SqlSelectColunas} ORDER BY produto_id ASC;";
        var linhas = await con.QueryAsync<PrevisaoEstoqueModel>(sql);
        return linhas.ToList();
    }

    public async Task SalvarAsync(PrevisaoEstoqueModel previsao, CancellationToken ct = default)
    {
        await using var con = await AbrirAsync(ct);
        await con.ExecuteAsync(SqlUpsert, previsao);
    }

    public Task SalvarAsync(Transacao t, PrevisaoEstoqueModel previsao, CancellationToken ct = default)
    {
        return t.Conexao.ExecuteAsync(SqlUpsert, previsao, t.Tx);
    }
}
