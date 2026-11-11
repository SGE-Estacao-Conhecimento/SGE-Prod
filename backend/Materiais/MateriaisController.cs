using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;

namespace Sge.Api.Materiais;

[ApiController]
[Route("api/materiais")]
public sealed class MateriaisController(MaterialRepository repo, MaterialService service) : ControllerBase
{
    /// <summary>
    /// Catálogo. Materiais inativos só são listados para a equipe (admin/almoxarifado);
    /// para o perfil Usuário o filtro de ativos é sempre aplicado.
    /// </summary>
    [HttpGet]
    public Task<IReadOnlyList<MaterialDto>> Listar([FromQuery] bool apenasAtivos = true) =>
        repo.ListarAsync(apenasAtivos || !User.EhEquipe(), incluirPatrimonio: User.EhEquipe());

    [HttpPost]
    [Authorize(Roles = Perfis.Equipe)]
    public async Task<ActionResult<MaterialDto>> Criar(SalvarMaterialRequest req) =>
        StatusCode(StatusCodes.Status201Created, await service.CriarAsync(req, User));

    [HttpPut("{id:int}")]
    [Authorize(Roles = Perfis.Equipe)]
    public Task<MaterialDto> Editar(int id, SalvarMaterialRequest req) => service.EditarAsync(id, req);

    /// <summary>"Excluir material": retira do catálogo, preservando o histórico. Somente administração.</summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = Perfis.Admin)]
    public Task<MaterialDto> Remover(int id) => service.RemoverAsync(id);
}
