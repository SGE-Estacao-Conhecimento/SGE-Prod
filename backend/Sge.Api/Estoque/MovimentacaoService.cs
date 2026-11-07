using System.Security.Claims;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.Estoque;

/// <summary>Regras da entrada manual e do balanço (ajuste de saldo) feitos pelo almoxarifado.</summary>
public sealed class MovimentacaoService(DbConnectionFactory db, EstoqueRepository estoque)
{
    private const int MaxMotivo = 255;

    /// <summary>
    /// Entrada manual da tela "Movimentar". Saídas não são aceitas aqui: o banco só registra
    /// saída vinculada ao item de um pedido entregue.
    /// </summary>
    public async Task<MovimentacaoDto> RegistrarAsync(RegistrarMovimentacaoRequest req, ClaimsPrincipal usuario)
    {
        var tipo = (req.Tipo ?? string.Empty).Trim().ToLowerInvariant();
        if (tipo == "saida")
            throw new ApiException(422, "Saídas de estoque são registradas pela entrega de pedidos.");
        if (tipo == "ajuste")
            throw new ApiException(422, "Use o balanço de estoque para ajustar o saldo.");
        if (tipo != "entrada")
            throw ApiException.BadRequest("Tipo de movimentação inválido. Use 'entrada'.");
        if (req.Quantidade <= 0)
            throw ApiException.BadRequest("A quantidade deve ser maior que zero.");

        var observacao = string.IsNullOrWhiteSpace(req.Observacao) ? null : req.Observacao.Trim();
        var motivo = observacao is null
            ? TipoMovimentacao.MotivoEntradaManual
            : TipoMovimentacao.PrefixoEntradaManual + observacao;
        if (motivo.Length > MaxMotivo)
            throw ApiException.BadRequest($"A observação pode ter no máximo {MaxMotivo - TipoMovimentacao.PrefixoEntradaManual.Length} caracteres.");

        await using var t = await Transacao.IniciarAsync(db);
        var produto = await ObterProdutoAsync(t, req.ProdutoId);
        ValidarFracao(produto, req.Quantidade);

        var saldo = await estoque.CreditarAsync(t, produto.ProdutoId, req.Quantidade);
        var id = await estoque.RegistrarAsync(t, new EstoqueRepository.NovaMovimentacao(
            produto.ProdutoId, TipoMovimentacao.Ajuste, "entrada", req.Quantidade, saldo, usuario.UsuarioId(), motivo));
        var dto = await estoque.ObterAsync(t, id);
        await t.ConfirmarAsync();
        return dto;
    }

    /// <summary>Balanço físico: define o novo saldo e registra a diferença como ajuste com motivo.</summary>
    public async Task<MovimentacaoDto> AjustarAsync(AjustarEstoqueRequest req, ClaimsPrincipal usuario)
    {
        if (req.NovoSaldo is not { } novoSaldo || novoSaldo < 0)
            throw ApiException.BadRequest("Informe o novo saldo (zero ou maior).");

        var motivoInformado = string.IsNullOrWhiteSpace(req.Motivo) ? null : req.Motivo.Trim();
        var motivo = motivoInformado is null
            ? TipoMovimentacao.MotivoAjustePadrao
            : TipoMovimentacao.PrefixoAjuste + motivoInformado;
        if (motivo.Length > MaxMotivo)
            throw ApiException.BadRequest($"O motivo pode ter no máximo {MaxMotivo - TipoMovimentacao.PrefixoAjuste.Length} caracteres.");

        await using var t = await Transacao.IniciarAsync(db);
        var produto = await ObterProdutoAsync(t, req.ProdutoId);
        ValidarFracao(produto, novoSaldo);

        var diferenca = novoSaldo - produto.Quantidade;
        if (diferenca == 0)
            throw new ApiException(422, "O novo saldo é igual ao saldo atual. Nenhum ajuste foi registrado.");

        await estoque.DefinirSaldoAsync(t, produto.ProdutoId, novoSaldo);
        var id = await estoque.RegistrarAsync(t, new EstoqueRepository.NovaMovimentacao(
            produto.ProdutoId, TipoMovimentacao.Ajuste, diferenca > 0 ? "entrada" : "saida",
            Math.Abs(diferenca), novoSaldo, usuario.UsuarioId(), motivo));
        var dto = await estoque.ObterAsync(t, id);
        await t.ConfirmarAsync();
        return dto;
    }

    private async Task<EstoqueRepository.ProdutoSaldo> ObterProdutoAsync(Transacao t, int produtoId)
    {
        var produtos = await estoque.BloquearAsync(t, [produtoId]);
        return produtos.GetValueOrDefault(produtoId) ?? throw ApiException.NotFound("Material não encontrado.");
    }

    private static void ValidarFracao(EstoqueRepository.ProdutoSaldo produto, decimal quantidade)
    {
        if (!produto.PermiteFracao && quantidade != decimal.Truncate(quantidade))
            throw new ApiException(422, $"O material {produto.Nome} só aceita quantidades inteiras.");
    }
}
