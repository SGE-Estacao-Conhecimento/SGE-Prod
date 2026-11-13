using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;

namespace Sge.Api.Ambientes;

[ApiController]
[Route("api/ambientes")]
[Authorize(Roles = Perfis.Equipe)]
public sealed class AmbientesController(AmbienteService service) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<AmbienteDto>> Listar([FromQuery] bool apenasAtivos = false)
        => service.ListarAsync(apenasAtivos);

    [HttpGet("{id:int}")]
    public Task<AmbienteDto> Obter(int id) => service.ObterPorIdAsync(id);

    [HttpPost]
    [Authorize(Roles = Perfis.Admin)]
    public async Task<ActionResult<AmbienteDto>> Criar(SalvarAmbienteRequest req)
    {
        var criado = await service.SalvarAsync(null, req);
        return StatusCode(StatusCodes.Status201Created, criado);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = Perfis.Admin)]
    public Task<AmbienteDto> Atualizar(int id, SalvarAmbienteRequest req)
        => service.SalvarAsync(id, req);

    [HttpPatch("{id:int}/status")]
    [Authorize(Roles = Perfis.Admin)]
    public async Task<IActionResult> AlternarStatus(int id)
    {
        await service.AlternarStatusAsync(id);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Perfis.Admin)]
    public async Task<IActionResult> Excluir(int id)
    {
        await service.ExcluirAsync(id);
        return NoContent();
    }
}

