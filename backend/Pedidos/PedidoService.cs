using System.Security.Claims;
using Dapper;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.Pedidos;

/// <summary>Regras de criação e cancelamento de pedidos.</summary>
public sealed class PedidoService(DbConnectionFactory db, PedidoRepository repo)
{
    private const int MaxItens = 100;
    private const int MaxJustificativa = 2000;

    private sealed class Solicitante
    {
        public int FuncionarioId { get; set; }
        public int SetorId { get; set; }
        public bool Ativo { get; set; }
    }

    private sealed class ProdutoLinha
    {
        public int ProdutoId { get; set; }
        public bool PermiteFracao { get; set; }
        public bool Ativo { get; set; }
    }

    public async Task<PedidoDto> CriarAsync(CriarPedidoRequest req, ClaimsPrincipal usuario)
    {
        var itens = ValidarItens(req.Itens);
        var urgencia = (req.Urgencia ?? "normal").Trim().ToLowerInvariant();
        if (urgencia is not ("normal" or "alta"))
            throw ApiException.BadRequest("Urgência inválida. Use 'normal' ou 'alta'.");
        var justificativa = string.IsNullOrWhiteSpace(req.Justificativa) ? null : req.Justificativa.Trim();
        if (justificativa?.Length > MaxJustificativa)
            throw ApiException.BadRequest($"A justificativa pode ter no máximo {MaxJustificativa} caracteres.");

        await using var con = await db.AbrirAsync();
        await using var tx = await con.BeginTransactionAsync();

        // Solicitante: o próprio usuário logado ou, para a equipe, um usuário cadastrado escolhido na tela.
        var solicitanteUsuarioId = usuario.UsuarioId();
        if (usuario.EhEquipe() && req.SolicitanteId is { } escolhido)
            solicitanteUsuarioId = escolhido;
        else if (usuario.EhEquipe() && !string.IsNullOrWhiteSpace(req.Usuario) && req.SolicitanteId is null)
            throw new ApiException(422, "O solicitante precisa ser um usuário cadastrado no sistema.");

        var solicitante = await con.QuerySingleOrDefaultAsync<Solicitante>("""
            SELECT f.funcionario_id, f.setor_id, (u.ativo AND f.ativo) AS ativo
              FROM usuarios u JOIN funcionarios f ON f.funcionario_id = u.funcionario_id
             WHERE u.usuario_id = @id
            """, new { id = solicitanteUsuarioId }, tx);
        if (solicitante is null && usuario.EhEquipe() && req.SolicitanteId is null)
        {
            solicitante = await con.QuerySingleOrDefaultAsync<Solicitante>("""
                SELECT f.funcionario_id, f.setor_id, f.ativo AS ativo
                  FROM funcionarios f
                 WHERE f.ativo = TRUE
                 ORDER BY f.funcionario_id
                 LIMIT 1
                """, transaction: tx);
        }
        if (solicitante is null)
            throw ApiException.NotFound("Solicitante não encontrado.");
        if (!solicitante.Ativo)
            throw new ApiException(422, "O solicitante está inativo.");

        // Materiais: precisam existir, estar ativos e respeitar a regra de fração.
        var produtos = (await con.QueryAsync<ProdutoLinha>(
                "SELECT produto_id, permite_fracao, ativo FROM produtos WHERE produto_id IN @ids",
                new { ids = itens.Select(i => i.ProdutoId).ToList() }, tx))
            .ToDictionary(p => p.ProdutoId);
        foreach (var item in itens)
        {
            if (!produtos.TryGetValue(item.ProdutoId, out var produto) || !produto.Ativo)
                throw new ApiException(422, $"O material {item.ProdutoId} não existe ou está inativo.");
            if (!produto.PermiteFracao && item.Quantidade != decimal.Truncate(item.Quantidade))
                throw new ApiException(422, $"O material {item.ProdutoId} só aceita quantidades inteiras.");
        }

        var pedidoId = await con.ExecuteScalarAsync<int>("""
            INSERT INTO pedidos (identificador_operacao, funcionario_solicitante_id, setor_id,
                                 usuario_solicitacao_id, status, urgencia, observacao)
            VALUES (@operacao, @funcionarioId, @setorId, @usuarioId, 'pendente', @urgencia, @justificativa);
            SELECT LAST_INSERT_ID();
            """, new
        {
            operacao = Guid.NewGuid().ToString(),
            funcionarioId = solicitante.FuncionarioId,
            setorId = solicitante.SetorId,
            usuarioId = usuario.UsuarioId(),
            urgencia,
            justificativa
        }, tx);

        await con.ExecuteAsync(
            "INSERT INTO pedido_itens (pedido_id, produto_id, quantidade_solicitada) VALUES (@pedidoId, @ProdutoId, @Quantidade)",
            itens.Select(i => new { pedidoId, i.ProdutoId, i.Quantidade }), tx);

        await RegistrarLogAsync(con, tx, pedidoId, null, StatusPedido.Pendente, usuario.UsuarioId(), "Pedido criado.");

        var criado = await repo.ObterAsync(pedidoId, con, tx);
        await tx.CommitAsync();
        return criado!;
    }

    /// <summary>
    /// Cancelamento pelo solicitante. Segue a tela "Meus pedidos": só pedidos pendentes
    /// (aguardando separação) podem ser cancelados.
    /// </summary>
    public async Task<PedidoDto> CancelarAsync(int pedidoId, ClaimsPrincipal usuario)
    {
        await using var con = await db.AbrirAsync();
        await using var tx = await con.BeginTransactionAsync();

        var pedido = await con.QuerySingleOrDefaultAsync<(string Status, int FuncionarioId)>(
            "SELECT status, funcionario_solicitante_id FROM pedidos WHERE pedido_id = @pedidoId FOR UPDATE",
            new { pedidoId }, tx);
        if (pedido == default || (!usuario.EhEquipe() && pedido.FuncionarioId != usuario.FuncionarioId()))
            throw ApiException.NotFound("Pedido não encontrado.");
        if (pedido.Status != StatusPedido.Pendente)
            throw ApiException.Conflict("Somente pedidos pendentes podem ser cancelados.");

        await con.ExecuteAsync("UPDATE pedidos SET status = 'cancelado' WHERE pedido_id = @pedidoId", new { pedidoId }, tx);
        await RegistrarLogAsync(con, tx, pedidoId, pedido.Status, StatusPedido.Cancelado, usuario.UsuarioId(),
            "Cancelado pelo solicitante.");

        var atualizado = await repo.ObterAsync(pedidoId, con, tx);
        await tx.CommitAsync();
        return atualizado!;
    }

    private static List<CriarPedidoItemRequest> ValidarItens(List<CriarPedidoItemRequest>? itens)
    {
        if (itens is null || itens.Count == 0)
            throw ApiException.BadRequest("Adicione pelo menos 1 material ao pedido.");
        if (itens.Count > MaxItens)
            throw ApiException.BadRequest($"Um pedido pode ter no máximo {MaxItens} materiais.");
        if (itens.Any(i => i.ProdutoId <= 0))
            throw ApiException.BadRequest("Todos os itens precisam de um material válido.");
        if (itens.Any(i => i.Quantidade <= 0))
            throw ApiException.BadRequest("As quantidades devem ser maiores que zero.");
        if (itens.GroupBy(i => i.ProdutoId).Any(g => g.Count() > 1))
            throw ApiException.BadRequest("O mesmo material aparece mais de uma vez no pedido.");
        return itens;
    }

    private static Task RegistrarLogAsync(MySqlConnector.MySqlConnection con, MySqlConnector.MySqlTransaction tx,
        int pedidoId, string? anterior, string novo, int usuarioId, string descricao) =>
        con.ExecuteAsync("""
            INSERT INTO pedido_logs (pedido_id, status_anterior, status_novo, usuario_id, descricao)
            VALUES (@pedidoId, @anterior, @novo, @usuarioId, @descricao)
            """, new { pedidoId, anterior, novo, usuarioId, descricao }, tx);
}
