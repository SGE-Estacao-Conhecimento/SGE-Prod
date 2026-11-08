using Dapper;
using MySqlConnector;
using Sge.Api.Infrastructure;

namespace Sge.Api.Pedidos;

/// <summary>Leitura de pedidos já no formato do front-end.</summary>
public sealed class PedidoRepository(DbConnectionFactory db, AppClock relogio)
{
    private sealed class PedidoLinha
    {
        public int PedidoId { get; set; }
        public string Status { get; set; } = string.Empty;
        public string Urgencia { get; set; } = string.Empty;
        public string? Observacao { get; set; }
        public DateTime DataPedido { get; set; }
        public string SolicitanteNome { get; set; } = string.Empty;
        public int? SolicitanteUsuarioId { get; set; }
        public string SetorNome { get; set; } = string.Empty;
        public DateTime? DataAtendimento { get; set; }
    }

    private sealed class LogLinha
    {
        public int PedidoId { get; set; }
        public string StatusNovo { get; set; } = string.Empty;
        public string? Descricao { get; set; }
    }

    public sealed class ItemParaAtendimento
    {
        public int PedidoItemId { get; set; }
        public int ProdutoId { get; set; }
        public decimal QuantidadeSolicitada { get; set; }
    }

    public sealed class PedidoBloqueado
    {
        public string Status { get; set; } = string.Empty;
        public int FuncionarioSolicitanteId { get; set; }
    }

    private sealed class ItemLinha
    {
        public int PedidoId { get; set; }
        public int ProdutoId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string UnidadeMedida { get; set; } = string.Empty;
        public decimal QuantidadeSolicitada { get; set; }
        public decimal? QuantidadeEntregue { get; set; }
    }

    private const string SelectPedidos = """
        SELECT p.pedido_id, p.status, p.urgencia, p.observacao, p.data_pedido, p.data_atendimento,
               f.nome AS solicitante_nome, us.usuario_id AS solicitante_usuario_id, s.nome AS setor_nome
          FROM pedidos p
          JOIN funcionarios f ON f.funcionario_id = p.funcionario_solicitante_id
          JOIN setores s ON s.setor_id = p.setor_id
          LEFT JOIN usuarios us ON us.funcionario_id = f.funcionario_id
        """;

    public async Task<IReadOnlyList<PedidoDto>> ListarPorSolicitanteAsync(int funcionarioId)
    {
        await using var con = await db.AbrirAsync();
        var linhas = await con.QueryAsync<PedidoLinha>(
            SelectPedidos + " WHERE p.funcionario_solicitante_id = @funcionarioId ORDER BY p.data_pedido DESC, p.pedido_id DESC",
            new { funcionarioId });
        return await MontarAsync(con, linhas.ToList(), null);
    }

    /// <summary>Todos os pedidos (fila do almoxarifado), opcionalmente filtrados pela situação do banco.</summary>
    public async Task<IReadOnlyList<PedidoDto>> ListarAsync(string? status)
    {
        await using var con = await db.AbrirAsync();
        var linhas = await con.QueryAsync<PedidoLinha>(
            SelectPedidos + (status is null ? string.Empty : " WHERE p.status = @status") +
            " ORDER BY p.data_pedido DESC, p.pedido_id DESC", new { status });
        return await MontarAsync(con, linhas.ToList(), null);
    }

    public Task<PedidoDto?> ObterAsync(Transacao t, int pedidoId) => ObterAsync(pedidoId, t.Conexao, t.Tx);

    // ---------- Gravações do atendimento (transação aberta pelo service) ----------

    public Task<PedidoBloqueado?> BloquearAsync(Transacao t, int pedidoId) =>
        t.Conexao.QuerySingleOrDefaultAsync<PedidoBloqueado>(
            "SELECT status, funcionario_solicitante_id FROM pedidos WHERE pedido_id = @pedidoId FOR UPDATE",
            new { pedidoId }, t.Tx);

    /// <summary>Muda a situação somente se ainda estiver na situação esperada. Devolve se alterou.</summary>
    public async Task<bool> MudarStatusAsync(Transacao t, int pedidoId, string de, string para) =>
        await t.Conexao.ExecuteAsync(
            "UPDATE pedidos SET status = @para WHERE pedido_id = @pedidoId AND status = @de",
            new { pedidoId, de, para }, t.Tx) > 0;

    public async Task<IReadOnlyList<ItemParaAtendimento>> ItensParaAtendimentoAsync(Transacao t, int pedidoId) =>
        (await t.Conexao.QueryAsync<ItemParaAtendimento>(
            "SELECT pedido_item_id, produto_id, quantidade_solicitada FROM pedido_itens WHERE pedido_id = @pedidoId ORDER BY pedido_item_id",
            new { pedidoId }, t.Tx)).ToList();

    public Task RegistrarEntregaItemAsync(Transacao t, int pedidoItemId, decimal quantidadeEntregue) =>
        t.Conexao.ExecuteAsync(
            "UPDATE pedido_itens SET quantidade_entregue = @quantidadeEntregue WHERE pedido_item_id = @pedidoItemId",
            new { pedidoItemId, quantidadeEntregue }, t.Tx);

    public async Task<bool> RegistrarAtendimentoAsync(Transacao t, int pedidoId, int usuarioAtendimentoId, int funcionarioRecebeId) =>
        await t.Conexao.ExecuteAsync("""
            UPDATE pedidos
               SET status = 'atendido', usuario_atendimento_id = @usuarioAtendimentoId,
                   funcionario_recebe_id = @funcionarioRecebeId, data_atendimento = UTC_TIMESTAMP(6)
             WHERE pedido_id = @pedidoId AND status = 'pronto_retirada'
            """, new { pedidoId, usuarioAtendimentoId, funcionarioRecebeId }, t.Tx) > 0;

    /// <summary>Histórico do pedido (pedido_logs só recebe inclusões).</summary>
    public Task RegistrarLogAsync(Transacao t, int pedidoId, string? anterior, string novo, int usuarioId, string? descricao) =>
        t.Conexao.ExecuteAsync("""
            INSERT INTO pedido_logs (pedido_id, status_anterior, status_novo, usuario_id, descricao)
            VALUES (@pedidoId, @anterior, @novo, @usuarioId, @descricao)
            """, new { pedidoId, anterior, novo, usuarioId, descricao }, t.Tx);

    public async Task<PedidoDto?> ObterAsync(int pedidoId, MySqlConnection? con = null, MySqlTransaction? tx = null)
    {
        if (con is null)
        {
            await using var nova = await db.AbrirAsync();
            return await ObterAsync(pedidoId, nova);
        }
        var linhas = (await con.QueryAsync<PedidoLinha>(SelectPedidos + " WHERE p.pedido_id = @pedidoId", new { pedidoId }, tx)).ToList();
        return (await MontarAsync(con, linhas, tx)).FirstOrDefault();
    }

    /// <summary>Itens de vários pedidos (usado também para montar notificações).</summary>
    public async Task<Dictionary<int, List<PedidoItemDto>>> ItensPorPedidoAsync(
        MySqlConnection con, IReadOnlyCollection<int> pedidoIds, MySqlTransaction? tx = null)
    {
        if (pedidoIds.Count == 0) return [];
        var itens = await con.QueryAsync<ItemLinha>("""
            SELECT pi.pedido_id, pi.produto_id, pr.nome, pr.unidade_medida,
                   pi.quantidade_solicitada, pi.quantidade_entregue
              FROM pedido_itens pi
              JOIN produtos pr ON pr.produto_id = pi.produto_id
             WHERE pi.pedido_id IN @pedidoIds
             ORDER BY pi.pedido_item_id
            """, new { pedidoIds }, tx);

        return itens
            .GroupBy(i => i.PedidoId)
            .ToDictionary(g => g.Key, g => g.Select(i => new PedidoItemDto(
                i.ProdutoId, i.Nome, Numeros.Normalizar(i.QuantidadeSolicitada), i.UnidadeMedida,
                Numeros.Normalizar(i.QuantidadeEntregue))).ToList());
    }

    /// <summary>Resumo textual dos materiais, igual ao montado pelo front-end.</summary>
    public static string Resumo(IReadOnlyList<PedidoItemDto> itens) => itens.Count switch
    {
        0 => string.Empty,
        1 => itens[0].MaterialNome,
        _ => string.Join(", ", itens.Select(i => $"{i.MaterialNome} ({Numeros.Texto(i.Quantidade)} {i.Unidade})"))
    };

    private async Task<IReadOnlyList<PedidoDto>> MontarAsync(MySqlConnection con, List<PedidoLinha> linhas, MySqlTransaction? tx)
    {
        var ids = linhas.Select(l => l.PedidoId).ToList();
        var itensPorPedido = await ItensPorPedidoAsync(con, ids, tx);

        // Última mensagem de retirada e último motivo de cancelamento registrados no histórico.
        List<LogLinha> logs = ids.Count == 0 ? [] :(await con.QueryAsync<LogLinha>("""
            SELECT pedido_id, status_novo, descricao
              FROM pedido_logs
             WHERE pedido_id IN @ids AND status_novo IN ('pronto_retirada', 'cancelado') AND descricao IS NOT NULL
             ORDER BY log_id
            """, new { ids }, tx)).ToList();
        string? UltimaDescricao(int pedidoId, string status) =>
            logs.LastOrDefault(g => g.PedidoId == pedidoId && g.StatusNovo == status)?.Descricao;

        return linhas.Select(l =>
        {
            var itens = itensPorPedido.GetValueOrDefault(l.PedidoId) ?? [];
            var parcial = l.Status == StatusPedido.Atendido &&
                          itens.Any(i => i.QuantidadeAtendida is { } entregue && entregue < i.Quantidade);
            var urgente = l.Urgencia == "alta";

            return new PedidoDto(
                Id: l.PedidoId,
                UsuarioId: l.SolicitanteUsuarioId,
                Usuario: l.SolicitanteNome,
                Setor: l.SetorNome,
                Data: relogio.DataCurta(l.DataPedido),
                DataIso: AppClock.ComoUtc(l.DataPedido),
                Material: Resumo(itens),
                Quantidade: itens.Sum(i => i.Quantidade),
                Materiais: itens,
                Itens: itens,
                Prioridade: urgente ? "Urgente" : "Normal",
                Urgente: urgente,
                Urgencia: l.Urgencia,
                Status: StatusPedido.Rotulo(l.Status, parcial),
                Justificativa: l.Observacao,
                MensagemAlmoxarife: l.Status is StatusPedido.ProntoRetirada or StatusPedido.Atendido
                    ? UltimaDescricao(l.PedidoId, StatusPedido.ProntoRetirada) : null,
                MotivoCancelamento: l.Status == StatusPedido.Cancelado ? UltimaDescricao(l.PedidoId, StatusPedido.Cancelado) : null,
                DataEntrega: l.DataAtendimento is { } entrega ? relogio.DataCurta(entrega) : null);
        }).ToList();
    }
}
