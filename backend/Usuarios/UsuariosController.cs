using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;

namespace Sge.Api.Usuarios;

/// <summary>
/// Leitura para a equipe (o almoxarifado escolhe o solicitante; sem CPF).
/// Cadastro, edição, status e exclusão são exclusivos da administração.
/// </summary>
[ApiController]
[Route("api/usuarios")]
[Authorize(Roles = Perfis.Equipe)]
public sealed class UsuariosController(UsuarioService service) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<UsuarioDto>> Listar() => service.ListarAsync(User);

    [HttpPost]
    [Authorize(Roles = Perfis.Admin)]
    public async Task<ActionResult<UsuarioDto>> Criar(SalvarUsuarioRequest req) =>
        StatusCode(StatusCodes.Status201Created, await service.CriarAsync(req));

    [HttpPut("{id:int}")]
    [Authorize(Roles = Perfis.Admin)]
    public Task<UsuarioDto> Editar(int id, SalvarUsuarioRequest req) => service.EditarAsync(id, req);

    [HttpPatch("{id:int}/status")]
    [Authorize(Roles = Perfis.Admin)]
    public Task<UsuarioDto> AlternarStatus(int id) => service.AlternarStatusAsync(id);

    [HttpPost("{id:int}/resetar-senha")]
    [Authorize(Roles = Perfis.Admin)]
    public Task<UsuarioDto> ResetarSenha(int id) => service.ResetarSenhaAsync(id);

    /// <summary>"Excluir usuário": desativa a conta, preservando o histórico.</summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = Perfis.Admin)]
    public Task<UsuarioDto> Remover(int id) => service.RemoverAsync(id);
}
