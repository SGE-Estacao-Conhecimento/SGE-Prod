using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;

namespace Sge.Api.Patrimonios;

[ApiController]
[Route("api/patrimonios")]
[Authorize(Roles = Perfis.Equipe)]
public sealed class PatrimoniosController(PatrimonioService service) : ControllerBase
{
    // ---------- Catálogo ----------
    [HttpGet("catalogo")]
    public Task<IReadOnlyList<PatrimonioCatalogoDto>> ListarCatalogo([FromQuery] string? categoria = null)
        => service.ListarCatalogoAsync(categoria);

    [HttpPost("catalogo")]
    [Authorize(Roles = Perfis.Admin)]
    public async Task<ActionResult<PatrimonioCatalogoDto>> CriarCatalogo(SalvarPatrimonioCatalogoRequest req)
    {
        var criado = await service.SalvarCatalogoAsync(null, req);
        return StatusCode(StatusCodes.Status201Created, criado);
    }

    [HttpPut("catalogo/{id:int}")]
    [Authorize(Roles = Perfis.Admin)]
    public Task<PatrimonioCatalogoDto> AtualizarCatalogo(int id, SalvarPatrimonioCatalogoRequest req)
        => service.SalvarCatalogoAsync(id, req);

    // ---------- Exemplares Físicos (Tombamentos) ----------
    [HttpGet("itens")]
    public Task<IReadOnlyList<PatrimonioItemDto>> ListarItens(
        [FromQuery] int? ambienteId = null,
        [FromQuery] bool semAmbiente = false,
        [FromQuery] string? busca = null,
        [FromQuery] string? categoria = null,
        [FromQuery] string? status = null)
        => service.ListarItensAsync(ambienteId, semAmbiente, busca, categoria, status);

    [HttpGet("itens/{id:int}")]
    public Task<PatrimonioItemDto> ObterItem(int id)
        => service.ObterItemPorIdAsync(id);

    [HttpPost("itens")]
    [Authorize(Roles = Perfis.Admin)]
    public async Task<ActionResult<PatrimonioItemDto>> CriarItem(SalvarPatrimonioItemRequest req)
    {
        var criado = await service.SalvarItemAsync(null, req);
        return StatusCode(StatusCodes.Status201Created, criado);
    }

    [HttpPut("itens/{id:int}")]
    [Authorize(Roles = Perfis.Admin)]
    public Task<PatrimonioItemDto> AtualizarItem(int id, SalvarPatrimonioItemRequest req)
        => service.SalvarItemAsync(id, req);

    [HttpPatch("itens/{id:int}/transferir")]
    [Authorize(Roles = Perfis.Admin)]
    public async Task<IActionResult> TransferirItem(int id, TransferirItemRequest req)
    {
        await service.TransferirAsync(id, req);
        return NoContent();
    }

    [HttpDelete("itens/{id:int}")]
    [Authorize(Roles = Perfis.Admin)]
    public async Task<IActionResult> BaixarItem(int id)
    {
        await service.BaixarItemAsync(id);
        return NoContent();
    }
}

