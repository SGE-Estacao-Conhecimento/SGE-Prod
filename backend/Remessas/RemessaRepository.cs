using Dapper;
using Sge.Api.Infrastructure;

namespace Sge.Api.Remessas;

/// <summary>Recebimentos (remessas e doações), seus itens e fotos (recebimento_anexos).</summary>
public sealed class RemessaRepository(DbConnectionFactory db, AppClock relogio) : RepositorioBase(db)
{
    public sealed record NovaRemessa(
        string IdentificadorOperacao, string TipoOrigem, string OrigemNome, int FuncionarioRecebeId,
        int UsuarioRegistroId, string? Observacao, IReadOnlyList<RemessaItemRequest> Itens,
        int? RecebimentoOrigemId = null);

    public sealed record NovoAnexo(
        int RecebimentoId, string Chave, string NomeOriginal, string TipoMime, long TamanhoBytes, string Sha256, int UsuarioEnvioId);

    public sealed class RemessaBloqueada
    {
        public int RecebimentoId { get; set; }
        public string Status { get; set; } = string.Empty;
        public int? RecebimentoOrigemId { get; set; }
    }

    public sealed class ItemRecebido
    {
        public int RecebimentoItemId { get; set; }
        public int ProdutoId { get; set; }
        public decimal Quantidade { get; set; }
    }

    public sealed class AnexoArquivo
    {
        public string R2Chave { get; set; } = string.Empty;
        public string? NomeOriginal { get; set; }
        public string TipoMime { get; set; } = string.Empty;
    }

    private sealed class RemessaLinha
    {
        public int RecebimentoId { get; set; }
        public int? RecebimentoOrigemId { get; set; }
        public string TipoOrigem { get; set; } = string.Empty;
        public string OrigemNome { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? Observacao { get; set; }
        public DateTime DataRecebimento { get; set; }
        public DateTime DataRegistro { get; set; }
        public string RecebidoPor { get; set; } = string.Empty;
    }

    private sealed class ItemLinha
    {
        public int RecebimentoId { get; set; }
        public int ProdutoId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string UnidadeMedida { get; set; } = string.Empty;
        public decimal Quantidade { get; set; }
    }

    private sealed class AnexoLinha
    {
        public int AnexoId { get; set; }
        public int RecebimentoId { get; set; }
        public string? NomeOriginal { get; set; }
        public string TipoMime { get; set; } = string.Empty;
        public long TamanhoBytes { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    private const string SelectRemessas = """
        SELECT r.recebimento_id, r.recebimento_origem_id, r.tipo_origem, r.origem_nome, r.status, r.observacao,
               r.data_recebimento, r.data_registro, f.nome AS recebido_por
          FROM recebimentos r
          JOIN funcionarios f ON f.funcionario_id = r.funcionario_recebe_id
        """;

    public async Task<IReadOnlyList<RemessaDto>> ListarAsync(int limite)
    {
        await using var con = await AbrirAsync();
        var linhas = (await con.QueryAsync<RemessaLinha>(
            SelectRemessas + " ORDER BY r.data_registro DESC, r.recebimento_id DESC LIMIT @limite", new { limite })).ToList();
        return await MontarAsync(new ConexaoLeitura(con, null), linhas);
    }

    public async Task<RemessaDto?> ObterAsync(int recebimentoId)
    {
        await using var con = await AbrirAsync();
        var linhas = (await con.QueryAsync<RemessaLinha>(
            SelectRemessas + " WHERE r.recebimento_id = @recebimentoId", new { recebimentoId })).ToList();
        return (await MontarAsync(new ConexaoLeitura(con, null), linhas)).FirstOrDefault();
    }

    public async Task<RemessaDto?> ObterAsync(Transacao t, int recebimentoId)
    {
        var linhas = (await t.Conexao.QueryAsync<RemessaLinha>(
            SelectRemessas + " WHERE r.recebimento_id = @recebimentoId", new { recebimentoId }, t.Tx)).ToList();
        return (await MontarAsync(new ConexaoLeitura(t.Conexao, t.Tx), linhas)).FirstOrDefault();
    }

    public async Task<int?> BuscarPorOperacaoAsync(string identificadorOperacao)
    {
        await using var con = await AbrirAsync();
        return await con.ExecuteScalarAsync<int?>(
            "SELECT recebimento_id FROM recebimentos WHERE identificador_operacao = @identificadorOperacao",
            new { identificadorOperacao });
    }

    public async Task<int?> ObterFuncionarioParaRecebimentoAsync(int usuarioId)
    {
        await using var con = await AbrirAsync();
        return await con.ExecuteScalarAsync<int?>("""
            SELECT COALESCE(
                u.funcionario_id,
                (SELECT f.funcionario_id FROM funcionarios f WHERE f.ativo = TRUE ORDER BY f.funcionario_id LIMIT 1)
            )
            FROM usuarios u
            WHERE u.usuario_id = @usuarioId AND u.ativo = TRUE
            """, new { usuarioId });
    }

    /// <summary>Cria o recebimento em preparação com os itens (sem entrada no estoque).</summary>
    public Task<int> CriarAsync(NovaRemessa r) => EmTransacaoAsync(async (con, tx) =>
    {
        var id = await con.ExecuteScalarAsync<int>("""
            INSERT INTO recebimentos (identificador_operacao, recebimento_origem_id, tipo_origem, origem_nome, funcionario_recebe_id,
                                      usuario_registro_id, data_recebimento, observacao, status)
            VALUES (@IdentificadorOperacao, @RecebimentoOrigemId, @TipoOrigem, @OrigemNome, @FuncionarioRecebeId,
                    @UsuarioRegistroId, UTC_TIMESTAMP(6), @Observacao, 'preparacao');
            SELECT LAST_INSERT_ID();
            """, r, tx);
        await con.ExecuteAsync(
            "INSERT INTO recebimento_itens (recebimento_id, produto_id, quantidade) VALUES (@id, @MaterialId, @QtdRecebida)",
            r.Itens.Select(i => new { id, i.MaterialId, i.QtdRecebida }), tx);
        return id;
    });

    public async Task<string?> StatusAsync(int recebimentoId)
    {
        await using var con = await AbrirAsync();
        return await con.ExecuteScalarAsync<string?>(
            "SELECT status FROM recebimentos WHERE recebimento_id = @recebimentoId", new { recebimentoId });
    }

    public async Task<int> ContarFotosAsync(int recebimentoId)
    {
        await using var con = await AbrirAsync();
        return await con.ExecuteScalarAsync<int>("""
            SELECT COUNT(*) FROM recebimento_anexos
             WHERE recebimento_id = @recebimentoId AND categoria = 'foto_material' AND status <> 'removido'
            """, new { recebimentoId });
    }

    /// <summary>Registra o anexo como pendente antes do envio do arquivo (guia do MinIO, seção 8).</summary>
    public async Task<int> RegistrarAnexoPendenteAsync(NovoAnexo a)
    {
        await using var con = await AbrirAsync();
        return await con.ExecuteScalarAsync<int>("""
            INSERT INTO recebimento_anexos (recebimento_id, categoria, r2_chave, nome_original, tipo_mime,
                                            tamanho_bytes, sha256, status, usuario_envio_id)
            VALUES (@RecebimentoId, 'foto_material', @Chave, @NomeOriginal, @TipoMime,
                    @TamanhoBytes, @Sha256, 'pendente', @UsuarioEnvioId);
            SELECT LAST_INSERT_ID();
            """, a);
    }

    public async Task MarcarAnexoDisponivelAsync(int anexoId)
    {
        await using var con = await AbrirAsync();
        await con.ExecuteAsync("""
            UPDATE recebimento_anexos SET status = 'confirmado', data_confirmacao_upload = UTC_TIMESTAMP(6)
             WHERE anexo_id = @anexoId AND status = 'pendente'
            """, new { anexoId });
    }

    public async Task<AnexoArquivo?> ObterAnexoDisponivelAsync(int recebimentoId, int anexoId)
    {
        await using var con = await AbrirAsync();
        return await con.QuerySingleOrDefaultAsync<AnexoArquivo>("""
            SELECT a.r2_chave, a.nome_original, a.tipo_mime
              FROM recebimento_anexos a
              JOIN recebimentos r ON r.recebimento_id = @recebimentoId
             WHERE a.anexo_id = @anexoId
               AND (a.recebimento_id = @recebimentoId OR a.recebimento_id = r.recebimento_origem_id)
               AND a.status = 'confirmado'
            """, new { recebimentoId, anexoId });
    }

    // ---------- Confirmação (transação aberta pelo service) ----------

    public Task<RemessaBloqueada?> BloquearAsync(Transacao t, int recebimentoId) =>
        t.Conexao.QuerySingleOrDefaultAsync<RemessaBloqueada>(
            "SELECT recebimento_id, status, recebimento_origem_id FROM recebimentos WHERE recebimento_id = @recebimentoId FOR UPDATE",
            new { recebimentoId }, t.Tx);

    public Task<int> ContarFotosDisponiveisAsync(Transacao t, int recebimentoId) =>
        t.Conexao.ExecuteScalarAsync<int>("""
            SELECT COUNT(*) FROM recebimento_anexos
             WHERE recebimento_id = @recebimentoId AND categoria = 'foto_material' AND status = 'confirmado'
            """, new { recebimentoId }, t.Tx);

    public async Task<IReadOnlyList<ItemRecebido>> ItensAsync(Transacao t, int recebimentoId) =>
        (await t.Conexao.QueryAsync<ItemRecebido>(
            "SELECT recebimento_item_id, produto_id, quantidade FROM recebimento_itens WHERE recebimento_id = @recebimentoId ORDER BY recebimento_item_id",
            new { recebimentoId }, t.Tx)).ToList();

    /// <summary>Confirma o recebimento. O trigger do banco recusa a confirmação sem foto disponível.</summary>
    public async Task<bool> ConfirmarAsync(Transacao t, int recebimentoId, int usuarioId) =>
        await t.Conexao.ExecuteAsync("""
            UPDATE recebimentos
               SET status = 'confirmado', usuario_confirmacao_id = @usuarioId, data_confirmacao = UTC_TIMESTAMP(6)
             WHERE recebimento_id = @recebimentoId AND status = 'preparacao'
            """, new { recebimentoId, usuarioId }, t.Tx) > 0;

    // ---------- Montagem da resposta ----------

    private sealed record ConexaoLeitura(MySqlConnector.MySqlConnection Con, MySqlConnector.MySqlTransaction? Tx);

    private async Task<IReadOnlyList<RemessaDto>> MontarAsync(ConexaoLeitura c, List<RemessaLinha> linhas)
    {
        if (linhas.Count == 0) return [];
        var ids = linhas.Select(l => l.RecebimentoId).ToList();

        var itens = (await c.Con.QueryAsync<ItemLinha>("""
            SELECT ri.recebimento_id, ri.produto_id, p.nome, p.unidade_medida, ri.quantidade
              FROM recebimento_itens ri
              JOIN produtos p ON p.produto_id = ri.produto_id
             WHERE ri.recebimento_id IN @ids
             ORDER BY ri.recebimento_item_id
            """, new { ids }, c.Tx)).ToLookup(i => i.RecebimentoId);

        var idsAnexos = ids
            .Concat(linhas.Where(l => l.RecebimentoOrigemId is not null).Select(l => l.RecebimentoOrigemId!.Value))
            .Distinct()
            .ToList();

        var anexos = (await c.Con.QueryAsync<AnexoLinha>("""
            SELECT anexo_id, recebimento_id, nome_original, tipo_mime, tamanho_bytes, status
              FROM recebimento_anexos
             WHERE recebimento_id IN @idsAnexos AND categoria = 'foto_material' AND status <> 'removido'
             ORDER BY anexo_id
            """, new { idsAnexos }, c.Tx)).ToLookup(a => a.RecebimentoId);

        return linhas.Select(l =>
        {
            var lista = itens[l.RecebimentoId]
                .Select(i => new RemessaItemDto(i.ProdutoId, i.Nome, Numeros.Normalizar(i.Quantidade), i.UnidadeMedida))
                .ToList();
            var dataRegistro = AppClock.ComoUtc(l.DataRegistro);
            var fotosLista = (anexos[l.RecebimentoId].Any()
                ? anexos[l.RecebimentoId]
                : (l.RecebimentoOrigemId is not null ? anexos[l.RecebimentoOrigemId.Value] : Enumerable.Empty<AnexoLinha>()))
                .Select(a => new RemessaAnexoDto(a.AnexoId, a.NomeOriginal ?? "foto", a.TipoMime, a.TamanhoBytes,
                    a.Status == "confirmado" ? "disponivel" : a.Status, a.RecebimentoId))
                .ToList();

            return new RemessaDto(
                Id: l.RecebimentoId,
                NumeroRemessa: NumeroRemessa.Formatar(l.RecebimentoId, dataRegistro),
                TipoOrigem: OrigemRemessa.ParaFront(l.TipoOrigem),
                DocumentoDoador: l.OrigemNome,
                Itens: lista,
                MaterialId: lista.Count == 1 ? lista[0].MaterialId : null,
                MaterialNome: string.Join(", ", lista.Select(i => i.MaterialNome)),
                Quantidade: lista.Sum(i => i.Quantidade),
                Fornecedor: l.OrigemNome,
                RecebidoPor: l.RecebidoPor,
                DataEnvio: relogio.ParaLocal(AppClock.ComoUtc(l.DataRecebimento)).ToString("yyyy-MM-dd"),
                Data: AppClock.ComoUtc(l.DataRecebimento),
                Status: StatusRemessa.Rotulo(l.Status),
                Observacao: l.Observacao,
                Fotos: fotosLista,
                RecebimentoOrigemId: l.RecebimentoOrigemId);
        }).ToList();
    }
}
