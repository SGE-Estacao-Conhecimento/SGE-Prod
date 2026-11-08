using Dapper;
using Sge.Api.Infrastructure;
using Sge.Api.Remessas;

namespace Sge.Api.Estoque;

/// <summary>Saldo dos materiais (produtos.quantidade) e histórico (movimentacoes_estoque).</summary>
public sealed class EstoqueRepository(DbConnectionFactory db) : RepositorioBase(db)
{
    public sealed class ProdutoSaldo
    {
        public int ProdutoId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public decimal Quantidade { get; set; }
        public bool PermiteFracao { get; set; }
        public bool BemDuravel { get; set; }
        public bool Ativo { get; set; }
    }

    public sealed record NovaMovimentacao(
        int ProdutoId, string Tipo, string Sentido, decimal Quantidade, decimal SaldoApos, int UsuarioId,
        string? Motivo, int? RecebimentoItemId = null, int? PedidoItemId = null);

    private sealed class MovimentacaoLinha
    {
        public long MovimentacaoId { get; set; }
        public int ProdutoId { get; set; }
        public string ProdutoNome { get; set; } = string.Empty;
        public string Tipo { get; set; } = string.Empty;
        public string Sentido { get; set; } = string.Empty;
        public decimal Quantidade { get; set; }
        public decimal SaldoApos { get; set; }
        public string? Motivo { get; set; }
        public DateTime DataMovimentacao { get; set; }
        public string ResponsavelNome { get; set; } = string.Empty;
        public int? PedidoId { get; set; }
        public int? RecebimentoId { get; set; }
        public DateTime? RecebimentoData { get; set; }
    }

    /// <summary>
    /// Bloqueia as linhas dos materiais até o fim da transação (sempre na mesma ordem, para
    /// evitar travamento entre operações simultâneas).
    /// </summary>
    public async Task<Dictionary<int, ProdutoSaldo>> BloquearAsync(Transacao t, IEnumerable<int> produtoIds)
    {
        var ids = produtoIds.Distinct().OrderBy(id => id).ToList();
        if (ids.Count == 0) return [];
        var linhas = await t.Conexao.QueryAsync<ProdutoSaldo>("""
            SELECT produto_id, nome, quantidade, permite_fracao, bem_duravel, ativo
              FROM produtos
             WHERE produto_id IN @ids
             ORDER BY produto_id
               FOR UPDATE
            """, new { ids }, t.Tx);
        return linhas.ToDictionary(p => p.ProdutoId);
    }

    /// <summary>Retira do saldo somente se houver quantidade suficiente. Devolve o novo saldo ou null.</summary>
    public async Task<decimal?> DebitarAsync(Transacao t, int produtoId, decimal quantidade)
    {
        var afetadas = await t.Conexao.ExecuteAsync(
            "UPDATE produtos SET quantidade = quantidade - @quantidade WHERE produto_id = @produtoId AND quantidade >= @quantidade",
            new { produtoId, quantidade }, t.Tx);
        return afetadas == 0 ? null : await SaldoAsync(t, produtoId);
    }

    public async Task<decimal> CreditarAsync(Transacao t, int produtoId, decimal quantidade)
    {
        await t.Conexao.ExecuteAsync(
            "UPDATE produtos SET quantidade = quantidade + @quantidade WHERE produto_id = @produtoId",
            new { produtoId, quantidade }, t.Tx);
        return await SaldoAsync(t, produtoId);
    }

    public Task DefinirSaldoAsync(Transacao t, int produtoId, decimal saldo) =>
        t.Conexao.ExecuteAsync("UPDATE produtos SET quantidade = @saldo WHERE produto_id = @produtoId",
            new { produtoId, saldo }, t.Tx);

    public async Task<long> RegistrarAsync(Transacao t, NovaMovimentacao m) =>
        await t.Conexao.ExecuteScalarAsync<long>("""
            INSERT INTO movimentacoes_estoque (produto_id, tipo, sentido, quantidade, saldo_apos,
                                               recebimento_item_id, pedido_item_id, usuario_id, motivo)
            VALUES (@ProdutoId, @Tipo, @Sentido, @Quantidade, @SaldoApos,
                    @RecebimentoItemId, @PedidoItemId, @UsuarioId, @Motivo);
            SELECT LAST_INSERT_ID();
            """, m, t.Tx);

    public async Task<IReadOnlyList<MovimentacaoDto>> ListarAsync(string? tipoFront, int? produtoId, int limite)
    {
        await using var con = await AbrirAsync();
        var linhas = await con.QueryAsync<MovimentacaoLinha>("""
            SELECT m.movimentacao_id, m.produto_id, p.nome AS produto_nome, m.tipo, m.sentido, m.quantidade,
                   m.saldo_apos, m.motivo, m.data_movimentacao, f.nome AS responsavel_nome,
                   pi.pedido_id, ri.recebimento_id, r.data_registro AS recebimento_data
              FROM movimentacoes_estoque m
              JOIN produtos p ON p.produto_id = m.produto_id
              JOIN usuarios u ON u.usuario_id = m.usuario_id
              JOIN funcionarios f ON f.funcionario_id = u.funcionario_id
              LEFT JOIN pedido_itens pi ON pi.pedido_item_id = m.pedido_item_id
              LEFT JOIN recebimento_itens ri ON ri.recebimento_item_id = m.recebimento_item_id
              LEFT JOIN recebimentos r ON r.recebimento_id = ri.recebimento_id
             WHERE (@produtoId IS NULL OR m.produto_id = @produtoId)
             ORDER BY m.data_movimentacao DESC, m.movimentacao_id DESC
             LIMIT @limite
            """, new { produtoId, limite });

        return linhas
            .Select(Montar)
            .Where(m => string.IsNullOrEmpty(tipoFront) || m.Tipo == tipoFront)
            .ToList();
    }

    public async Task<MovimentacaoDto> ObterAsync(Transacao t, long movimentacaoId)
    {
        var linha = await t.Conexao.QuerySingleAsync<MovimentacaoLinha>("""
            SELECT m.movimentacao_id, m.produto_id, p.nome AS produto_nome, m.tipo, m.sentido, m.quantidade,
                   m.saldo_apos, m.motivo, m.data_movimentacao, f.nome AS responsavel_nome,
                   NULL AS pedido_id, NULL AS recebimento_id, NULL AS recebimento_data
              FROM movimentacoes_estoque m
              JOIN produtos p ON p.produto_id = m.produto_id
              JOIN usuarios u ON u.usuario_id = m.usuario_id
              JOIN funcionarios f ON f.funcionario_id = u.funcionario_id
             WHERE m.movimentacao_id = @movimentacaoId
            """, new { movimentacaoId }, t.Tx);
        return Montar(linha);
    }

    private Task<decimal> SaldoAsync(Transacao t, int produtoId) =>
        t.Conexao.ExecuteScalarAsync<decimal>("SELECT quantidade FROM produtos WHERE produto_id = @produtoId",
            new { produtoId }, t.Tx);

    private static MovimentacaoDto Montar(MovimentacaoLinha l)
    {
        var observacao = l.Motivo ?? l.Tipo switch
        {
            TipoMovimentacao.SaidaPedido when l.PedidoId is { } pedido => $"Atendimento do Pedido #{pedido}",
            TipoMovimentacao.EntradaRecebimento when l.RecebimentoId is { } rec =>
                $"Remessa {NumeroRemessa.Formatar(rec, l.RecebimentoData ?? l.DataMovimentacao)} recebida",
            _ => "Movimentação registrada"
        };

        return new MovimentacaoDto(
            l.MovimentacaoId, l.ProdutoId, l.ProdutoNome,
            TipoMovimentacao.ParaFront(l.Tipo, l.Sentido, l.Motivo),
            Numeros.Normalizar(l.Quantidade), Numeros.Normalizar(l.SaldoApos),
            AppClock.ComoUtc(l.DataMovimentacao), l.ResponsavelNome, observacao);
    }
}
