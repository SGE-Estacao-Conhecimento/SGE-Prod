using System.Security.Claims;
using Sge.Api.Auth;
using Sge.Api.Estoque;
using Sge.Api.Infrastructure;
using Sge.Api.Infrastructure.Armazenamento;

namespace Sge.Api.Remessas;

/// <summary>
/// Recebimento em lote ou doação, no fluxo do guia-minIO-conexao-sql.md (seção 8):
/// 1) cria o recebimento em preparação; 2) envia as fotos (anexo pendente -> arquivo -> disponível);
/// 3) confirma, conferindo a foto, e dá entrada no estoque uma única vez, na mesma transação.
/// </summary>
public sealed class RemessaService(
    DbConnectionFactory db, RemessaRepository remessas, EstoqueRepository estoque, ArmazenamentoArquivosBase armazenamento)
{
    private const int MaxItens = 100;
    private const int MaxFotos = 10;
    private const int MaxOrigem = 200;
    private const int MaxObservacao = 2000;

    public async Task<(RemessaDto Remessa, bool Criada)> CriarAsync(CriarRemessaRequest req, ClaimsPrincipal usuario)
    {
        var operacao = Guid.TryParse(req.IdentificadorOperacao, out var guid) ? guid.ToString() : Guid.NewGuid().ToString();

        // Repetição do mesmo rascunho (ex.: falha no envio da foto): devolve o recebimento já criado.
        if (await remessas.BuscarPorOperacaoAsync(operacao) is { } existente)
            return ((await remessas.ObterAsync(existente))!, false);

        var tipoOrigem = OrigemRemessa.ParaBanco(req.TipoOrigem)
            ?? throw ApiException.BadRequest("Natureza da entrada inválida. Use doação, compra/NF ou outra entrada.");
        var origem = string.IsNullOrWhiteSpace(req.DocumentoDoador) ? null : req.DocumentoDoador.Trim();
        if (origem is null)
            throw ApiException.BadRequest("Informe a identificação da origem (doador, nota fiscal ou referência da entrada).");
        if (origem.Length > MaxOrigem)
            throw ApiException.BadRequest($"A identificação da origem pode ter no máximo {MaxOrigem} caracteres.");
        var observacao = string.IsNullOrWhiteSpace(req.Observacao) ? null : req.Observacao.Trim();
        if (observacao?.Length > MaxObservacao)
            throw ApiException.BadRequest($"A observação pode ter no máximo {MaxObservacao} caracteres.");

        var itens = req.Itens ?? [];
        if (itens.Count == 0)
            throw ApiException.BadRequest("Selecione ao menos um material para confirmar o recebimento.");
        if (itens.Count > MaxItens)
            throw ApiException.BadRequest($"Um recebimento pode ter no máximo {MaxItens} materiais.");
        if (itens.Any(i => i.QtdRecebida <= 0))
            throw ApiException.BadRequest("As quantidades recebidas devem ser maiores que zero.");
        if (itens.GroupBy(i => i.MaterialId).Any(g => g.Count() > 1))
            throw ApiException.BadRequest("O mesmo material aparece mais de uma vez no recebimento.");

        await using (var t = await Transacao.IniciarAsync(db))
        {
            var produtos = await estoque.BloquearAsync(t, itens.Select(i => i.MaterialId));
            foreach (var item in itens)
            {
                if (!produtos.TryGetValue(item.MaterialId, out var produto))
                    throw new ApiException(422, $"O material {item.MaterialId} não existe.");
                if (!produto.PermiteFracao && item.QtdRecebida != decimal.Truncate(item.QtdRecebida))
                    throw new ApiException(422, $"O material {produto.Nome} só aceita quantidades inteiras.");
            }
        }

        var id = await remessas.CriarAsync(new RemessaRepository.NovaRemessa(
            operacao, tipoOrigem, origem, usuario.FuncionarioId(), usuario.UsuarioId(), observacao, itens));
        return ((await remessas.ObterAsync(id))!, true);
    }

    public async Task<RemessaDto> EnviarFotoAsync(int recebimentoId, IFormFile? arquivo, ClaimsPrincipal usuario, CancellationToken ct)
    {
        if (arquivo is null || arquivo.Length == 0)
            throw ApiException.BadRequest("Selecione uma foto do material.");

        var status = await remessas.StatusAsync(recebimentoId) ?? throw ApiException.NotFound("Recebimento não encontrado.");
        if (status != StatusRemessa.Preparacao)
            throw ApiException.Conflict("Fotos só podem ser enviadas enquanto o recebimento está em preparação.");
        if (await remessas.ContarFotosAsync(recebimentoId) >= MaxFotos)
            throw ApiException.BadRequest($"Cada recebimento pode ter no máximo {MaxFotos} fotos.");

        await using var stream = arquivo.OpenReadStream();
        await using var validado = await armazenamento.ValidarFotoAsync(stream, arquivo.FileName, ct);

        var chave = ArmazenamentoArquivosBase.GerarChave("recebimentos", recebimentoId, validado.Extensao);
        var anexoId = await remessas.RegistrarAnexoPendenteAsync(new RemessaRepository.NovoAnexo(
            recebimentoId, chave, validado.NomeOriginal, validado.TipoMime, validado.TamanhoBytes, validado.Sha256,
            usuario.UsuarioId()));

        // Sem transação aberta durante o envio. Se falhar, o anexo continua pendente e não conta como foto.
        await armazenamento.EnviarAsync(chave, validado, ct);
        await remessas.MarcarAnexoDisponivelAsync(anexoId);

        return (await remessas.ObterAsync(recebimentoId))!;
    }

    public async Task<RemessaDto> ConfirmarAsync(int recebimentoId, ClaimsPrincipal usuario)
    {
        await using var t = await Transacao.IniciarAsync(db);
        var remessa = await remessas.BloquearAsync(t, recebimentoId) ?? throw ApiException.NotFound("Recebimento não encontrado.");

        // Confirmação repetida não gera nova entrada no estoque.
        if (remessa.Status == StatusRemessa.Confirmado)
            return (await remessas.ObterAsync(t, recebimentoId))!;
        if (remessa.Status != StatusRemessa.Preparacao)
            throw ApiException.Conflict("Este recebimento foi cancelado e não pode ser confirmado.");
        if (await remessas.ContarFotosDisponiveisAsync(t, recebimentoId) == 0)
            throw new ApiException(422, "Envie ao menos uma foto do material antes de confirmar o recebimento.");

        var itens = await remessas.ItensAsync(t, recebimentoId);
        if (!await remessas.ConfirmarAsync(t, recebimentoId, usuario.UsuarioId()))
            throw ApiException.Conflict("O recebimento foi alterado por outra pessoa. Atualize a tela.");

        await estoque.BloquearAsync(t, itens.Select(i => i.ProdutoId));
        foreach (var item in itens)
        {
            var saldo = await estoque.CreditarAsync(t, item.ProdutoId, item.Quantidade);
            await estoque.RegistrarAsync(t, new EstoqueRepository.NovaMovimentacao(
                item.ProdutoId, TipoMovimentacao.EntradaRecebimento, "entrada", item.Quantidade, saldo,
                usuario.UsuarioId(), Motivo: null, RecebimentoItemId: item.RecebimentoItemId));
        }

        var confirmada = await remessas.ObterAsync(t, recebimentoId);
        await t.ConfirmarAsync();
        return confirmada!;
    }

    public async Task<(Stream Conteudo, string TipoMime, string Nome)> AbrirFotoAsync(int recebimentoId, int anexoId, CancellationToken ct)
    {
        var anexo = await remessas.ObterAnexoDisponivelAsync(recebimentoId, anexoId)
            ?? throw ApiException.NotFound("Foto não encontrada.");
        return (await armazenamento.AbrirAsync(anexo.R2Chave, ct), anexo.TipoMime, anexo.NomeOriginal ?? "foto");
    }
}
