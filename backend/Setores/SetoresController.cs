using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;

namespace Sge.Api.Setores;

/// <summary>Setores para o cadastro de usuários. O cadastro de setores não existe nas telas.</summary>
[ApiController]
[Route("api/setores")]
[Authorize(Roles = Perfis.Equipe)]
public sealed class SetoresController(SetorRepository repo) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<string>> Listar() => repo.ListarAtivosAsync();
}
