using System.Security.Claims;
using Sge.Api.Auth;
using Sge.Api.Estoque;
using Sge.Api.Infrastructure;

namespace Sge.Api.Pedidos;

/// <summary>Regras de criação e cancelamento de pedidos.</summary>
public sealed class PedidoService(DbConnectionFactory db, PedidoRepository repo, EstoqueRepository estoque)
{
    private const int MaxItens = 100;
    private const int MaxJustificativa = 2000;

    public async Task<PedidoDto> CriarAsync(CriarPedidoRequest req, ClaimsPrincipal usuario)
    {
        var itens = ValidarItens(req.Itens);
        var urgencia = (req.Urgencia ?? "normal").Trim().ToLowerInvariant();
        if (urgencia is not ("normal" or "alta"))
            throw ApiException.BadRequest("Urgência inválida. Use 'normal' ou 'alta'.");
        var justificativa = string.IsNullOrWhiteSpace(req.Justificativa) ? null : req.Justificativa.Trim();
        if (justificativa?.Length > MaxJustificativa)
            throw ApiException.BadRequest($"A justificativa pode ter no máximo {MaxJustificativa} caracteres.");

        await using var t = await Transacao.IniciarAsync(db);

        // Solicitante: o próprio usuário logado ou, para a equipe, um usuário cadastrado escolhido na tela.
        var solicitanteUsuarioId = usuario.UsuarioId();
        if (usuario.EhEquipe() && req.SolicitanteId is { } escolhido)
            solicitanteUsuarioId = escolhido;
        else if (usuario.EhEquipe() && !string.IsNullOrWhiteSpace(req.Usuario) && req.SolicitanteId is null)
            throw new ApiException(422, "O solicitante precisa ser um usuário cadastrado no sistema.");

        var solicitante = await repo.ObterSolicitantePorUsuarioAsync(t, solicitanteUsuarioId);
        if (solicitante is null && usuario.EhEquipe() && req.SolicitanteId is null)
            solicitante = await repo.ObterPrimeiroFuncionarioAtivoAsync(t);
        if (solicitante is null)
            throw ApiException.NotFound("Solicitante não encontrado.");
        if (!solicitante.Ativo)
            throw new ApiException(422, "O solicitante está inativo.");

        // Materiais: bloqueia em ordem determinística para evitar deadlock caso haja baixa imediata.
        var produtos = await estoque.BloquearAsync(t, itens.Select(i => i.ProdutoId));
        foreach (var item in itens)
        {
            if (!produtos.TryGetValue(item.ProdutoId, out var produto) || !produto.Ativo)
                throw new ApiException(422, $"O material {item.ProdutoId} não existe ou está inativo.");
            if (!produto.PermiteFracao && item.Quantidade != decimal.Truncate(item.Quantidade))
                throw new ApiException(422, $"O material {produto.Nome} só aceita quantidades inteiras.");
        }

        var temPatrimonio = itens.Any(i => produtos[i.ProdutoId].BemDuravel);
        var temConsumo = itens.Any(i => !produtos[i.ProdutoId].BemDuravel);
        if (temPatrimonio && temConsumo)
            throw new ApiException(422, "Não é permitido misturar materiais de consumo e patrimônio no mesmo pedido.");
        if (temPatrimonio && !usuario.EhEquipe())
            throw new ApiException(403, "Somente o almoxarifado ou o administrativo podem solicitar patrimônio.");

        var ehAlmoxarife = usuario.Perfil() == Perfis.Almoxarifado;
        if (req.EntregaImediata == true && !ehAlmoxarife)
            throw new ApiException(403, "Somente o almoxarifado pode realizar baixa direta na criação do pedido.");
        if (req.EntregaImediata == true && temPatrimonio)
            throw new ApiException(422, "Pedidos de patrimônio exigem autorização do administrativo antes da separação.");

        var entregaImediata = ehAlmoxarife && !temPatrimonio && (req.EntregaImediata ?? true);
        var usuarioId = usuario.UsuarioId();
        int pedidoId;

        if (entregaImediata)
        {
            pedidoId = await repo.InserirPedidoAsync(
                t,
                solicitante.FuncionarioId,
                solicitante.SetorId,
                usuarioId,
                StatusPedido.Atendido,
                urgencia,
                justificativa,
                usuarioAtendimentoId: usuarioId,
                funcionarioRecebeId: solicitante.FuncionarioId);

            foreach (var item in itens)
            {
                var produto = produtos[item.ProdutoId];
                var saldo = await estoque.DebitarAsync(t, item.ProdutoId, item.Quantidade)
                    ?? throw ApiException.Conflict(
                        $"Saldo insuficiente de {produto.Nome}: disponível {Numeros.Texto(produto.Quantidade)}.");

                var pedidoItemId = await repo.InserirPedidoItemAsync(
                    t, pedidoId, item.ProdutoId, item.Quantidade, item.Quantidade);

                await estoque.RegistrarAsync(t, new EstoqueRepository.NovaMovimentacao(
                    item.ProdutoId, TipoMovimentacao.SaidaPedido, "saida", item.Quantidade, saldo, usuarioId,
                    Motivo: justificativa, PedidoItemId: pedidoItemId));
                produto.Quantidade = saldo;
            }

            await repo.RegistrarLogAsync(t, pedidoId, null, StatusPedido.Atendido, usuarioId,
                "Pedido de consumo entregue diretamente com baixa no estoque.");
        }
        else
        {
            pedidoId = await repo.InserirPedidoAsync(
                t,
                solicitante.FuncionarioId,
                solicitante.SetorId,
                usuarioId,
                StatusPedido.Pendente,
                urgencia,
                justificativa);

            foreach (var item in itens)
                await repo.InserirPedidoItemAsync(t, pedidoId, item.ProdutoId, item.Quantidade);

            var logInicial = temPatrimonio
                ? "Pedido de patrimônio criado. Aguardando autorização do administrativo."
                : "Pedido criado.";
            await repo.RegistrarLogAsync(t, pedidoId, null, StatusPedido.Pendente, usuarioId, logInicial);
        }

        var criado = await repo.ObterAsync(t, pedidoId);
        await t.ConfirmarAsync();
        return criado!;
    }

    /// <summary>
    /// Cancelamento pelo solicitante. Segue a tela "Meus pedidos": só pedidos pendentes
    /// (aguardando separação) podem ser cancelados.
    /// </summary>
    public async Task<PedidoDto> CancelarAsync(int pedidoId, ClaimsPrincipal usuario)
    {
        await using var t = await Transacao.IniciarAsync(db);

        var pedido = await repo.BloquearAsync(t, pedidoId);
        if (pedido is null || (!usuario.EhEquipe() && pedido.FuncionarioSolicitanteId != usuario.FuncionarioId()))
            throw ApiException.NotFound("Pedido não encontrado.");
        if (pedido.Status != StatusPedido.Pendente)
            throw ApiException.Conflict("Somente pedidos pendentes podem ser cancelados.");

        await repo.MudarStatusAsync(t, pedidoId, StatusPedido.Pendente, StatusPedido.Cancelado);
        await repo.RegistrarLogAsync(t, pedidoId, pedido.Status, StatusPedido.Cancelado, usuario.UsuarioId(),
            "Cancelado pelo solicitante.");

        var atualizado = await repo.ObterAsync(t, pedidoId);
        await t.ConfirmarAsync();
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
}
