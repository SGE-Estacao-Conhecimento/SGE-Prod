using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;

namespace Sge.Api.BaixaPatrimonio;

[ApiController]
[Route("api/baixa-patrimonio")]
[Authorize(Roles = Perfis.Equipe)]
public sealed class BaixaPatrimonioController(BaixaPatrimonioService service) : ControllerBase
{
    // ---------- Listagem (equipe: admin/almoxarife) ----------

    [HttpGet]
    public Task<IReadOnlyList<PedidoBaixaDto>> Listar([FromQuery] string? status = null)
        => service.ListarAsync(status);

    // ---------- Detalhe ----------

    [HttpGet("{id:int}")]
    public Task<PedidoBaixaDto> Obter(int id)
        => service.ObterPorIdAsync(id);

    // ---------- Solicitação (qualquer membro da equipe) ----------

    [HttpPost]
    public async Task<ActionResult<PedidoBaixaDto>> Solicitar(
        [FromForm] int itemId,
        [FromForm] string? motivo,
        [FromForm] string? justificativa,
        CancellationToken ct)
    {
        var fotos = Request.Form.Files;
        var criado = await service.SolicitarAsync(itemId, motivo, justificativa, fotos, User, ct);
        return StatusCode(StatusCodes.Status201Created, criado);
    }

    // ---------- Aprovação e Recusa (somente admin) ----------

    [HttpPost("{id:int}/aprovar")]
    [Authorize(Roles = Perfis.Admin)]
    public Task<PedidoBaixaDto> Aprovar(int id, DeliberarBaixaRequest req)
        => service.AprovarAsync(id, req.Parecer, User);

    [HttpPost("{id:int}/recusar")]
    [Authorize(Roles = Perfis.Admin)]
    public Task<PedidoBaixaDto> Recusar(int id, DeliberarBaixaRequest req)
        => service.RecusarAsync(id, req.Parecer, User);

    // ---------- Foto (stream via proxy) ----------

    [HttpGet("{id:int}/foto/{anexoId:int}")]
    public async Task<IActionResult> AbrirFoto(int id, int anexoId, CancellationToken ct)
    {
        var (conteudo, tipoMime, nome) = await service.AbrirFotoAsync(id, anexoId, ct);
        return File(conteudo, tipoMime, nome);
    }
}
