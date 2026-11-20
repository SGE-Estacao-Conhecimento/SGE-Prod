using System.Security.Claims;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;
using Sge.Api.Infrastructure.Armazenamento;
using Sge.Api.Notificacoes;

namespace Sge.Api.BaixaPatrimonio;

public sealed class BaixaPatrimonioService(
    DbConnectionFactory db,
    BaixaPatrimonioRepository repo,
    ArmazenamentoArquivosBase armazenamento,
    NotificacaoService notificacoes)
{
    private static readonly HashSet<string> MotivosValidos = new(StringComparer.OrdinalIgnoreCase)
    {
        "avaria_irreparavel", "sucata", "obsolescencia", "furto_extravio", "outro"
    };

    private const int MaxFotos = 5;

    // ---------- Consulta ----------

    public Task<IReadOnlyList<PedidoBaixaDto>> ListarAsync(string? status)
        => repo.ListarAsync(status);

    public async Task<PedidoBaixaDto> ObterPorIdAsync(int id)
    {
        var dto = await repo.ObterPorIdAsync(id);
        return dto ?? throw ApiException.NotFound("Pedido de baixa não encontrado.");
    }

    // ---------- Solicitação ----------

    public async Task<PedidoBaixaDto> SolicitarAsync(
        int itemId,
        string? motivoRaw,
        string? justificativaRaw,
        IFormFileCollection fotos,
        ClaimsPrincipal usuario,
        CancellationToken ct)
    {
        var motivo = string.IsNullOrWhiteSpace(motivoRaw) ? null : motivoRaw.Trim().ToLowerInvariant();
        if (motivo is null || !MotivosValidos.Contains(motivo))
            throw ApiException.BadRequest("Selecione um motivo válido para a baixa.");

        var justificativa = string.IsNullOrWhiteSpace(justificativaRaw) ? null : justificativaRaw.Trim();
        if (justificativa is null)
            throw ApiException.BadRequest("Informe a justificativa da solicitação de baixa.");
        if (justificativa.Length > 2000)
            throw ApiException.BadRequest("A justificativa pode ter no máximo 2000 caracteres.");

        if (fotos.Count == 0)
            throw ApiException.BadRequest("Envie ao menos uma foto do bem para justificar a solicitação de baixa.");
        if (fotos.Count > MaxFotos)
            throw ApiException.BadRequest($"Envie no máximo {MaxFotos} fotos por solicitação de baixa.");

        int pedidoId;
        await using (var t = await Transacao.IniciarAsync(db, ct))
        {
            var statusItem = await repo.StatusItemAsync(t.Conexao, t.Tx, itemId);
            if (statusItem is null)
                throw ApiException.NotFound("Item de patrimônio não encontrado.");
            if (statusItem == "baixado")
                throw ApiException.Conflict("Este bem já foi baixado do acervo patrimonial.");
            if (statusItem == "aguardando_baixa")
                throw ApiException.Conflict("Já existe uma solicitação de baixa pendente para este bem.");

            if (await repo.ExistePedidoPendenteParaItemAsync(itemId))
                throw ApiException.Conflict("Já existe uma solicitação de baixa pendente para este bem.");

            var solicitanteId = usuario.UsuarioId();
            pedidoId = await repo.CriarPedidoAsync(t.Conexao, t.Tx, itemId, solicitanteId, motivo, justificativa);
            await repo.MarcarItemAguardandoBaixaAsync(t.Conexao, t.Tx, itemId);
            await t.ConfirmarAsync(ct);
        }

        // Envio das fotos fora da transação de banco (padrão do guia MinIO).
        foreach (var foto in fotos)
        {
            if (foto.Length == 0) continue;
            await using var stream = foto.OpenReadStream();
            await using var validado = await armazenamento.ValidarFotoAsync(stream, foto.FileName, ct);
            var chave = ArmazenamentoArquivosBase.GerarChave("baixa-patrimonio", pedidoId, validado.Extensao);
            await armazenamento.EnviarAsync(chave, validado, ct);
            await repo.RegistrarAnexoAsync(new BaixaPatrimonioRepository.NovoAnexo(
                pedidoId, chave, validado.NomeOriginal, validado.TipoMime, validado.TamanhoBytes, validado.Sha256,
                usuario.UsuarioId()));
        }

        var criado = (await repo.ObterPorIdAsync(pedidoId))!;

        try
        {
            var solicitanteNome = usuario.FindFirst("name")?.Value ?? "Almoxarife";
            await notificacoes.NotificarSolicitacaoBaixaAdminAsync(
                pedidoId,
                criado.NumeroPatrimonio,
                criado.NomePatrimonio,
                solicitanteNome,
                criado.Motivo
            );
        }
        catch
        {
            // Falha na notificação não reverte a solicitação gravada
        }

        return criado;
    }

    // ---------- Aprovação ----------

    public async Task<PedidoBaixaDto> AprovarAsync(int pedidoBaixaId, string? parecer, ClaimsPrincipal usuario)
    {
        var parecerLimpo = string.IsNullOrWhiteSpace(parecer) ? null : parecer.Trim();
        var deliberadorId = usuario.UsuarioId();

        var itemId = await repo.ObterItemIdDoPedidoAsync(pedidoBaixaId)
            ?? throw ApiException.NotFound("Pedido de baixa não encontrado.");

        await using var t = await Transacao.IniciarAsync(db);
        var ok = await repo.AprovarAsync(t, pedidoBaixaId, deliberadorId, parecerLimpo);
        if (!ok) throw ApiException.Conflict("O pedido de baixa não está mais em estado pendente.");
        await repo.BaixarItemAsync(t, itemId);
        await t.ConfirmarAsync();

        var deliberado = (await repo.ObterPorIdAsync(pedidoBaixaId))!;

        try
        {
            await notificacoes.NotificarParecerBaixaAsync(
                deliberado.SolicitanteId,
                deliberado.NumeroPatrimonio,
                deliberado.NomePatrimonio,
                true,
                parecerLimpo
            );
        }
        catch
        {
            // Falha na notificação não desfaz a aprovação
        }

        return deliberado;
    }

    // ---------- Recusa ----------

    public async Task<PedidoBaixaDto> RecusarAsync(int pedidoBaixaId, string? parecer, ClaimsPrincipal usuario)
    {
        var parecerLimpo = string.IsNullOrWhiteSpace(parecer) ? null : parecer.Trim();
        if (parecerLimpo is null)
            throw ApiException.BadRequest("Informe o parecer de recusa da solicitação.");

        var deliberadorId = usuario.UsuarioId();

        var itemId = await repo.ObterItemIdDoPedidoAsync(pedidoBaixaId)
            ?? throw ApiException.NotFound("Pedido de baixa não encontrado.");

        await using var t = await Transacao.IniciarAsync(db);
        var ok = await repo.RecusarAsync(t, pedidoBaixaId, deliberadorId, parecerLimpo);
        if (!ok) throw ApiException.Conflict("O pedido de baixa não está mais em estado pendente.");
        await repo.RestaurarItemAtivoAsync(t, itemId);
        await t.ConfirmarAsync();

        var deliberado = (await repo.ObterPorIdAsync(pedidoBaixaId))!;

        try
        {
            await notificacoes.NotificarParecerBaixaAsync(
                deliberado.SolicitanteId,
                deliberado.NumeroPatrimonio,
                deliberado.NomePatrimonio,
                false,
                parecerLimpo
            );
        }
        catch
        {
            // Falha na notificação não desfaz a recusa
        }

        return deliberado;
    }

    // ---------- Foto (stream) ----------

    public async Task<(Stream Conteudo, string TipoMime, string Nome)> AbrirFotoAsync(
        int pedidoBaixaId, int anexoId, CancellationToken ct)
    {
        var anexo = await repo.ObterAnexoAsync(pedidoBaixaId, anexoId)
            ?? throw ApiException.NotFound("Foto não encontrada.");
        return (await armazenamento.AbrirAsync(anexo.R2Chave, ct), anexo.TipoMime, anexo.NomeOriginal ?? "foto");
    }
}
