using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.Setores;

public sealed record CriarSetorRequest(string? Nome);

/// <summary>Setores para o cadastro de usuários.</summary>
[ApiController]
[Route("api/setores")]
[Authorize(Roles = Perfis.Equipe)]
public sealed class SetoresController(SetorRepository repo) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<string>> Listar() => repo.ListarAtivosAsync();

    [HttpPost]
    [Authorize(Roles = Perfis.Admin)]
    public async Task<ActionResult<IReadOnlyList<string>>> Criar(CriarSetorRequest req)
    {
        var nome = string.IsNullOrWhiteSpace(req.Nome) ? null : req.Nome.Trim();
        if (nome is null)
            throw ApiException.BadRequest("Informe o nome do setor.");
        if (nome.Length > 100)
            throw ApiException.BadRequest("O nome do setor pode ter no máximo 100 caracteres.");

        await repo.CriarAsync(nome);
        var setores = await repo.ListarAtivosAsync();
        return StatusCode(StatusCodes.Status201Created, setores);
    }
}
