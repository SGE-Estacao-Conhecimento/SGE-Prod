using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Sge.Api.Notificacoes;

/// <summary>
/// Endpoints REST para central de notificações e badges de contagem do usuário logado.
/// Suporta IDs numéricos do novo schema e identificadores transitórios de log ("log-X").
/// </summary>
[ApiController]
[Authorize]
[Route("api/notificacoes")]
public sealed class NotificacoesController(NotificacaoService service) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<NotificacaoDto>> Listar(CancellationToken ct) =>
        service.ListarAsync(User, ct);

    [HttpGet("contagem")]
    public Task<NotificacaoContadorDto> Contagem(CancellationToken ct) =>
        service.ObterContadorAsync(User, ct);

    [HttpPatch("{id}/lida")]
    public async Task<IActionResult> MarcarLida([FromRoute] string id, CancellationToken ct)
    {
        var numId = ExtrairId(id);
        if (numId <= 0) return Ok(new { message = "Notificação transitória marcada como lida." });
        var sucesso = await service.MarcarComoLidaAsync(numId, User, ct);
        return Ok(new { message = "Notificação marcada como lida.", alterado = sucesso });
    }

    [HttpPost("marcar-todas-lidas")]
    public async Task<IActionResult> MarcarTodasLidas(CancellationToken ct)
    {
        var total = await service.MarcarTodasComoLidasAsync(User, ct);
        return Ok(new { totalAtualizado = total });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Excluir([FromRoute] string id, CancellationToken ct)
    {
        var numId = ExtrairId(id);
        if (numId <= 0) return Ok(new { message = "Notificação transitória removida da exibição." });
        var sucesso = await service.ExcluirAsync(numId, User, ct);
        return Ok(new { message = "Notificação excluída com sucesso.", alterado = sucesso });
    }

    private static long ExtrairId(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return 0;
        if (long.TryParse(raw, out var n)) return n;
        if (raw.StartsWith("log-", StringComparison.OrdinalIgnoreCase) &&
            long.TryParse(raw.AsSpan(4), out var logId)) return logId;
        var match = Regex.Match(raw, @"\d+");
        return match.Success && long.TryParse(match.Value, out var val) ? val : 0;
    }
}
