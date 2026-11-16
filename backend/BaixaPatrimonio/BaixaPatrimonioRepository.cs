using Dapper;
using MySqlConnector;
using Sge.Api.Infrastructure;

namespace Sge.Api.BaixaPatrimonio;

public sealed class BaixaPatrimonioRepository(DbConnectionFactory db) : RepositorioBase(db)
{
    // ---------- Records internos ----------

    public sealed record NovoAnexo(
        int PedidoBaixaId,
        string Chave,
        string? NomeOriginal,
        string TipoMime,
        long TamanhoBytes,
        string Sha256,
        int UsuarioEnvioId);

    public sealed class AnexoArquivo
    {
        public string R2Chave { get; set; } = string.Empty;
        public string? NomeOriginal { get; set; }
        public string TipoMime { get; set; } = string.Empty;
    }

    private sealed class PedidoLinha
    {
        public int Id { get; set; }
        public int ItemId { get; set; }
        public string NumeroPatrimonio { get; set; } = string.Empty;
        public string NomePatrimonio { get; set; } = string.Empty;
        public string? NomeAmbiente { get; set; }
        public string? NomeResponsavel { get; set; }
        public int SolicitanteId { get; set; }
        public string NomeSolicitante { get; set; } = string.Empty;
        public string Motivo { get; set; } = string.Empty;
        public string Justificativa { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int? DeliberacaoId { get; set; }
        public string? NomeDeliberador { get; set; }
        public string? ParecerAdministracao { get; set; }
        public string DataSolicitacao { get; set; } = string.Empty;
        public string? DataDeliberacao { get; set; }
    }

    private sealed class AnexoLinha
    {
        public int AnexoId { get; set; }
        public int PedidoBaixaId { get; set; }
        public string? NomeOriginal { get; set; }
        public string TipoMime { get; set; } = string.Empty;
        public long TamanhoBytes { get; set; }
    }

    private const string SelectPedido = """
        SELECT pb.pedido_baixa_id AS Id,
               pb.item_id AS ItemId,
               pi.numero_patrimonio AS NumeroPatrimonio,
               p.nome AS NomePatrimonio,
               a.nome AS NomeAmbiente,
               COALESCE(fr.nome, ur.email) AS NomeResponsavel,
               pb.usuario_solicitante_id AS SolicitanteId,
               COALESCE(fs.nome, usl.email) AS NomeSolicitante,
               pb.motivo AS Motivo,
               pb.justificativa AS Justificativa,
               pb.status AS Status,
               pb.usuario_deliberacao_id AS DeliberacaoId,
               COALESCE(fd.nome, ud.email) AS NomeDeliberador,
               pb.parecer_administracao AS ParecerAdministracao,
               DATE_FORMAT(CONVERT_TZ(pb.data_solicitacao, '+00:00', @@session.time_zone), '%d/%m/%Y %H:%i') AS DataSolicitacao,
               CASE WHEN pb.data_deliberacao IS NOT NULL
                    THEN DATE_FORMAT(CONVERT_TZ(pb.data_deliberacao, '+00:00', @@session.time_zone), '%d/%m/%Y %H:%i')
                    ELSE NULL END AS DataDeliberacao
          FROM pedidos_baixa_patrimonio pb
          JOIN patrimonio_itens pi ON pi.item_id = pb.item_id
          JOIN patrimonios p ON p.patrimonio_id = pi.patrimonio_id
          LEFT JOIN ambientes a ON a.ambiente_id = pi.ambiente_id
          LEFT JOIN usuarios ur ON ur.usuario_id = pi.responsavel_usuario_id
          LEFT JOIN funcionarios fr ON fr.funcionario_id = ur.funcionario_id
          JOIN usuarios usl ON usl.usuario_id = pb.usuario_solicitante_id
          LEFT JOIN funcionarios fs ON fs.funcionario_id = usl.funcionario_id
          LEFT JOIN usuarios ud ON ud.usuario_id = pb.usuario_deliberacao_id
          LEFT JOIN funcionarios fd ON fd.funcionario_id = ud.funcionario_id
        """;

    // ---------- Leitura ----------

    public async Task<IReadOnlyList<PedidoBaixaDto>> ListarAsync(string? status = null)
    {
        await using var con = await AbrirAsync();
        var linhas = (await con.QueryAsync<PedidoLinha>(
            SelectPedido + " WHERE (@status IS NULL OR pb.status = @status) ORDER BY pb.data_solicitacao DESC, pb.pedido_baixa_id DESC",
            new { status })).ToList();
        return await MontarAsync(con, null, linhas);
    }

    public async Task<PedidoBaixaDto?> ObterPorIdAsync(int id)
    {
        await using var con = await AbrirAsync();
        var linhas = (await con.QueryAsync<PedidoLinha>(
            SelectPedido + " WHERE pb.pedido_baixa_id = @id", new { id })).ToList();
        var lista = await MontarAsync(con, null, linhas);
        return lista.Count > 0 ? lista[0] : null;
    }

    public async Task<bool> ExistePedidoPendenteParaItemAsync(int itemId)
    {
        await using var con = await AbrirAsync();
        var count = await con.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM pedidos_baixa_patrimonio WHERE item_id = @itemId AND status = 'pendente'",
            new { itemId });
        return count > 0;
    }

    public async Task<string?> StatusItemAsync(MySqlConnection con, MySqlTransaction tx, int itemId)
    {
        return await con.ExecuteScalarAsync<string?>(
            "SELECT status FROM patrimonio_itens WHERE item_id = @itemId FOR UPDATE",
            new { itemId }, tx);
    }

    // ---------- Gravação (Solicitação) ----------

    public async Task<int> CriarPedidoAsync(MySqlConnection con, MySqlTransaction tx,
        int itemId, int solicitanteId, string motivo, string justificativa)
    {
        return await con.ExecuteScalarAsync<int>("""
            INSERT INTO pedidos_baixa_patrimonio (item_id, usuario_solicitante_id, motivo, justificativa, status)
            VALUES (@itemId, @solicitanteId, @motivo, @justificativa, 'pendente');
            SELECT LAST_INSERT_ID();
            """,
            new { itemId, solicitanteId, motivo, justificativa }, tx);
    }

    public async Task MarcarItemAguardandoBaixaAsync(MySqlConnection con, MySqlTransaction tx, int itemId)
    {
        await con.ExecuteAsync(
            "UPDATE patrimonio_itens SET status = 'aguardando_baixa' WHERE item_id = @itemId",
            new { itemId }, tx);
    }

    public async Task<int> RegistrarAnexoAsync(NovoAnexo a)
    {
        await using var con = await AbrirAsync();
        return await con.ExecuteScalarAsync<int>("""
            INSERT INTO pedido_baixa_anexos (pedido_baixa_id, r2_chave, nome_original, tipo_mime, tamanho_bytes, sha256, usuario_envio_id)
            VALUES (@PedidoBaixaId, @Chave, @NomeOriginal, @TipoMime, @TamanhoBytes, @Sha256, @UsuarioEnvioId);
            SELECT LAST_INSERT_ID();
            """, a);
    }

    public async Task<AnexoArquivo?> ObterAnexoAsync(int pedidoBaixaId, int anexoId)
    {
        await using var con = await AbrirAsync();
        return await con.QuerySingleOrDefaultAsync<AnexoArquivo>("""
            SELECT r2_chave AS R2Chave, nome_original AS NomeOriginal, tipo_mime AS TipoMime
              FROM pedido_baixa_anexos
             WHERE pedido_baixa_id = @pedidoBaixaId AND anexo_id = @anexoId
            """,
            new { pedidoBaixaId, anexoId });
    }

    // ---------- Aprovação / Recusa (service abre a transação) ----------

    public async Task<int?> ObterItemIdDoPedidoAsync(int pedidoBaixaId)
    {
        await using var con = await AbrirAsync();
        return await con.ExecuteScalarAsync<int?>(
            "SELECT item_id FROM pedidos_baixa_patrimonio WHERE pedido_baixa_id = @pedidoBaixaId",
            new { pedidoBaixaId });
    }

    public async Task<bool> AprovarAsync(Transacao t, int pedidoBaixaId, int deliberadorId, string? parecer)
    {
        var rows = await t.Conexao.ExecuteAsync("""
            UPDATE pedidos_baixa_patrimonio
               SET status = 'aprovado',
                   usuario_deliberacao_id = @deliberadorId,
                   parecer_administracao = @parecer,
                   data_deliberacao = UTC_TIMESTAMP(6)
             WHERE pedido_baixa_id = @pedidoBaixaId AND status = 'pendente'
            """,
            new { pedidoBaixaId, deliberadorId, parecer }, t.Tx);
        return rows > 0;
    }

    public async Task BaixarItemAsync(Transacao t, int itemId)
    {
        await t.Conexao.ExecuteAsync(
            "UPDATE patrimonio_itens SET status = 'baixado' WHERE item_id = @itemId",
            new { itemId }, t.Tx);
    }

    public async Task<bool> RecusarAsync(Transacao t, int pedidoBaixaId, int deliberadorId, string? parecer)
    {
        var rows = await t.Conexao.ExecuteAsync("""
            UPDATE pedidos_baixa_patrimonio
               SET status = 'recusado',
                   usuario_deliberacao_id = @deliberadorId,
                   parecer_administracao = @parecer,
                   data_deliberacao = UTC_TIMESTAMP(6)
             WHERE pedido_baixa_id = @pedidoBaixaId AND status = 'pendente'
            """,
            new { pedidoBaixaId, deliberadorId, parecer }, t.Tx);
        return rows > 0;
    }

    public async Task RestaurarItemAtivoAsync(Transacao t, int itemId)
    {
        await t.Conexao.ExecuteAsync(
            "UPDATE patrimonio_itens SET status = 'ativo' WHERE item_id = @itemId AND status = 'aguardando_baixa'",
            new { itemId }, t.Tx);
    }

    // ---------- Auxiliar ----------

    private static async Task<List<PedidoBaixaDto>> MontarAsync(MySqlConnection con, MySqlTransaction? tx, List<PedidoLinha> linhas)
    {
        if (linhas.Count == 0) return [];

        var ids = linhas.Select(l => l.Id).ToArray();
        var sqlAnexos = """
            SELECT anexo_id AS AnexoId, pedido_baixa_id AS PedidoBaixaId, nome_original AS NomeOriginal,
                   tipo_mime AS TipoMime, tamanho_bytes AS TamanhoBytes
              FROM pedido_baixa_anexos
             WHERE pedido_baixa_id IN @ids
             ORDER BY anexo_id
            """;

        IEnumerable<AnexoLinha> anexoLinhas = tx is null
            ? await con.QueryAsync<AnexoLinha>(sqlAnexos, new { ids })
            : await con.QueryAsync<AnexoLinha>(sqlAnexos, new { ids }, tx);

        var porPedido = anexoLinhas.GroupBy(a => a.PedidoBaixaId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<AnexoBaixaDto>)g.Select(a => new AnexoBaixaDto
            {
                AnexoId = a.AnexoId,
                NomeOriginal = a.NomeOriginal,
                TipoMime = a.TipoMime,
                TamanhoBytes = a.TamanhoBytes
            }).ToList());

        return linhas.Select(l => new PedidoBaixaDto
        {
            Id = l.Id,
            ItemId = l.ItemId,
            NumeroPatrimonio = l.NumeroPatrimonio,
            NomePatrimonio = l.NomePatrimonio,
            NomeAmbiente = l.NomeAmbiente,
            NomeResponsavel = l.NomeResponsavel,
            SolicitanteId = l.SolicitanteId,
            NomeSolicitante = l.NomeSolicitante,
            Motivo = l.Motivo,
            Justificativa = l.Justificativa,
            Status = l.Status,
            DeliberacaoId = l.DeliberacaoId,
            NomeDeliberador = l.NomeDeliberador,
            ParecerAdministracao = l.ParecerAdministracao,
            DataSolicitacao = l.DataSolicitacao,
            DataDeliberacao = l.DataDeliberacao,
            Anexos = porPedido.TryGetValue(l.Id, out var anx) ? anx : []
        }).ToList();
    }
}
