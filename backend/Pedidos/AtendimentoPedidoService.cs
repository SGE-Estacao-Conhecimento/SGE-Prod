using System.Security.Claims;
using Sge.Api.Auth;
using Sge.Api.Estoque;
using Sge.Api.Infrastructure;

namespace Sge.Api.Pedidos;

/// <summary>
/// Atendimento de pedidos pelo almoxarifado, seguindo a esteira da tela "Separação e Pedidos":
/// Novos (pendente) -> Separação -> Prontos (retirada) -> Entregue, com volta de etapa e recusa.
/// A baixa de estoque da entrega acontece aqui, na mesma transação da mudança de situação.
/// </summary>
public sealed class AtendimentoPedidoService(DbConnectionFactory db, PedidoRepository pedidos, EstoqueRepository estoque)
{
    private const int MaxDescricao = 500;

    /// <summary>Mudanças permitidas: exatamente os botões disponíveis em cada aba da tela.</summary>
    private static readonly Dictionary<string, string[]> Transicoes = new()
    {
        [StatusPedido.Pendente] = [StatusPedido.EmSeparacao, StatusPedido.Cancelado],
        [StatusPedido.EmSeparacao] = [StatusPedido.Pendente, StatusPedido.ProntoRetirada],
        [StatusPedido.ProntoRetirada] = [StatusPedido.EmSeparacao, StatusPedido.Atendido]
    };

    public async Task<PedidoDto> AtualizarStatusAsync(int pedidoId, AtualizarStatusPedidoRequest req, ClaimsPrincipal usuario)
    {
        var novo = StatusPedido.DoFront(req.Status)
            ?? throw ApiException.BadRequest("Situação do pedido inválida.");

        await using var t = await Transacao.IniciarAsync(db);
        var pedido = await pedidos.BloquearAsync(t, pedidoId) ?? throw ApiException.NotFound("Pedido não encontrado.");

        if (pedido.Status == novo)
            throw ApiException.Conflict($"O pedido já está em \"{StatusPedido.Rotulo(novo)}\".");
        if (!Transicoes.TryGetValue(pedido.Status, out var permitidas) || !permitidas.Contains(novo))
            throw ApiException.Conflict(
                $"Não é possível mudar o pedido de \"{StatusPedido.Rotulo(pedido.Status)}\" para \"{StatusPedido.Rotulo(novo)}\".");

        var usuarioId = usuario.UsuarioId();
        if (novo == StatusPedido.Atendido)
        {
            var descricao = await EntregarAsync(t, pedidoId, pedido, req.Itens, usuarioId);
            await pedidos.RegistrarLogAsync(t, pedidoId, pedido.Status, novo, usuarioId, descricao);
        }
        else
        {
            var descricao = novo switch
            {
                StatusPedido.Cancelado => Texto(req.MotivoCancelamento, "O motivo da recusa") ?? "Recusado pelo almoxarifado.",
                StatusPedido.ProntoRetirada => Texto(req.MensagemAlmoxarife, "A mensagem de retirada"),
                _ => null
            };
            if (!await pedidos.MudarStatusAsync(t, pedidoId, pedido.Status, novo))
                throw ApiException.Conflict("O pedido foi alterado por outra pessoa. Atualize a tela.");
            await pedidos.RegistrarLogAsync(t, pedidoId, pedido.Status, novo, usuarioId, descricao);
        }

        var atualizado = await pedidos.ObterAsync(t, pedidoId);
        await t.ConfirmarAsync();
        return atualizado!;
    }

    /// <summary>
    /// Registra a quantidade entregue de cada item e dá baixa no estoque (exceto bens duráveis).
    /// Quem retirou: o próprio solicitante (decisão de 07/11/2026; a tela não pergunta).
    /// </summary>
    private async Task<string> EntregarAsync(Transacao t, int pedidoId, PedidoRepository.PedidoBloqueado pedido,
        List<ItemAtendimentoRequest>? informados, int usuarioId)
    {
        var itens = await pedidos.ItensParaAtendimentoAsync(t, pedidoId);
        var entregues = (informados ?? [])
            .Where(i => i.ProdutoId is not null)
            .GroupBy(i => i.ProdutoId!.Value)
            .ToDictionary(g => g.Key, g => g.Last().QuantidadeAtendida);

        var produtos = await estoque.BloquearAsync(t, itens.Select(i => i.ProdutoId));
        var parcial = false;

        foreach (var item in itens)
        {
            var produto = produtos[item.ProdutoId];
            if (!entregues.TryGetValue(item.ProdutoId, out var informado) || informado is not { } quantidade)
                throw ApiException.BadRequest($"Informe a quantidade entregue de {produto.Nome}.");
            if (quantidade < 0 || quantidade > item.QuantidadeSolicitada)
                throw ApiException.BadRequest(
                    $"A quantidade entregue de {produto.Nome} deve estar entre 0 e {Numeros.Texto(item.QuantidadeSolicitada)}.");
            if (!produto.PermiteFracao && quantidade != decimal.Truncate(quantidade))
                throw new ApiException(422, $"O material {produto.Nome} só aceita quantidades inteiras.");

            if (quantidade > 0 && !produto.BemDuravel)
            {
                var saldo = await estoque.DebitarAsync(t, item.ProdutoId, quantidade)
                    ?? throw ApiException.Conflict(
                        $"Saldo insuficiente de {produto.Nome}: disponível {Numeros.Texto(produto.Quantidade)}.");
                await estoque.RegistrarAsync(t, new EstoqueRepository.NovaMovimentacao(
                    item.ProdutoId, TipoMovimentacao.SaidaPedido, "saida", quantidade, saldo, usuarioId,
                    Motivo: null, PedidoItemId: item.PedidoItemId));
                produto.Quantidade = saldo;
            }

            await pedidos.RegistrarEntregaItemAsync(t, item.PedidoItemId, quantidade);
            if (quantidade < item.QuantidadeSolicitada) parcial = true;
        }

        if (!await pedidos.RegistrarAtendimentoAsync(t, pedidoId, usuarioId, pedido.FuncionarioSolicitanteId))
            throw ApiException.Conflict("O pedido foi alterado por outra pessoa. Atualize a tela.");

        return parcial
            ? "Pedido entregue parcialmente. Itens sem estoque foram sinalizados."
            : "Pedido entregue.";
    }

    private static string? Texto(string? valor, string rotulo)
    {
        var texto = string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();
        if (texto?.Length > MaxDescricao)
            throw ApiException.BadRequest($"{rotulo} pode ter no máximo {MaxDescricao} caracteres.");
        return texto;
    }
}
