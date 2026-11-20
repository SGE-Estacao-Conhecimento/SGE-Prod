using Dapper;
using Sge.Api.Infrastructure;

namespace Sge.Api.Dashboard;

public sealed class FilaRecalculoRepository(DbConnectionFactory db) : RepositorioBase(db), IFilaRecalculoRepository
{
    private const string SqlEnfileirar = """
        INSERT INTO fila_recalculo_previsao (
            produto_id,
            versao_pendente,
            solicitado_em,
            tentativas,
            proxima_tentativa_em,
            bloqueado_ate,
            ultimo_erro
        ) VALUES (
            @produtoId,
            1,
            UTC_TIMESTAMP(6),
            0,
            UTC_TIMESTAMP(6),
            NULL,
            NULL
        ) ON DUPLICATE KEY UPDATE
            versao_pendente = versao_pendente + 1,
            solicitado_em = UTC_TIMESTAMP(6),
            proxima_tentativa_em = UTC_TIMESTAMP(6),
            bloqueado_ate = NULL;
        """;

    public Task EnfileirarAsync(Transacao t, int produtoId, CancellationToken ct = default)
    {
        return t.Conexao.ExecuteAsync(SqlEnfileirar, new { produtoId }, t.Tx);
    }

    public async Task EnfileirarAsync(int produtoId, CancellationToken ct = default)
    {
        await using var con = await AbrirAsync(ct);
        await con.ExecuteAsync(SqlEnfileirar, new { produtoId });
    }

    public async Task<IReadOnlyList<ItemFilaRecalculo>> ReivindicarLoteAsync(
        int limite,
        TimeSpan tempoLock,
        CancellationToken ct = default)
    {
        if (limite <= 0) return [];

        var segundosLock = Math.Max(1, (int)tempoLock.TotalSeconds);

        await using var con = await AbrirAsync(ct);
        await using var tx = await con.BeginTransactionAsync(ct);

        var sqlSelect = """
            SELECT produto_id,
                   versao_pendente,
                   solicitado_em,
                   tentativas,
                   proxima_tentativa_em,
                   bloqueado_ate,
                   ultimo_erro
              FROM fila_recalculo_previsao
             WHERE (bloqueado_ate IS NULL OR bloqueado_ate < UTC_TIMESTAMP(6))
               AND proxima_tentativa_em <= UTC_TIMESTAMP(6)
             ORDER BY proxima_tentativa_em ASC
             LIMIT @limite
               FOR UPDATE SKIP LOCKED;
            """;

        var items = (await con.QueryAsync<ItemFilaRecalculo>(sqlSelect, new { limite }, tx)).ToList();
        if (items.Count > 0)
        {
            var ids = items.Select(i => i.ProdutoId).ToList();
            var sqlUpdate = """
                UPDATE fila_recalculo_previsao
                   SET bloqueado_ate = DATE_ADD(UTC_TIMESTAMP(6), INTERVAL @segundosLock SECOND)
                 WHERE produto_id IN @ids;
                """;
            await con.ExecuteAsync(sqlUpdate, new { segundosLock, ids }, tx);
        }

        await tx.CommitAsync(ct);
        return items;
    }

    public async Task<bool> ConcluirAsync(int produtoId, long versaoCapturada, CancellationToken ct = default)
    {
        await using var con = await AbrirAsync(ct);
        var afetadas = await con.ExecuteAsync("""
            DELETE FROM fila_recalculo_previsao
             WHERE produto_id = @produtoId
               AND versao_pendente = @versaoCapturada;
            """, new { produtoId, versaoCapturada });
        return afetadas > 0;
    }

    public async Task RegistrarFalhaAsync(int produtoId, string erro, CancellationToken ct = default)
    {
        var erroTruncado = erro?.Length > 4000 ? erro[..4000] : erro;
        await using var con = await AbrirAsync(ct);
        await con.ExecuteAsync("""
            UPDATE fila_recalculo_previsao
               SET tentativas = tentativas + 1,
                   proxima_tentativa_em = DATE_ADD(UTC_TIMESTAMP(6), INTERVAL LEAST(3600, POW(2, LEAST(tentativas + 1, 8)) * 10) SECOND),
                   bloqueado_ate = NULL,
                   ultimo_erro = @erroTruncado
             WHERE produto_id = @produtoId;
            """, new { produtoId, erroTruncado });
    }

    public async Task SemearMateriaisSemPrevisaoAsync(int limite, CancellationToken ct = default)
    {
        if (limite <= 0) return;

        await using var con = await AbrirAsync(ct);
        await con.ExecuteAsync("""
            INSERT IGNORE INTO fila_recalculo_previsao (
                produto_id,
                versao_pendente,
                solicitado_em,
                tentativas,
                proxima_tentativa_em,
                bloqueado_ate,
                ultimo_erro
            )
            SELECT p.produto_id,
                   1,
                   UTC_TIMESTAMP(6),
                   0,
                   UTC_TIMESTAMP(6),
                   NULL,
                   NULL
              FROM produtos p
              LEFT JOIN previsoes_estoque pe ON pe.produto_id = p.produto_id
              LEFT JOIN fila_recalculo_previsao f ON f.produto_id = p.produto_id
             WHERE pe.produto_id IS NULL
               AND f.produto_id IS NULL
               AND p.ativo = TRUE
               AND p.bem_duravel = FALSE
             ORDER BY p.produto_id ASC
             LIMIT @limite;
            """, new { limite });
    }
}
