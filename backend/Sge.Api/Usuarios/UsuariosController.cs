using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;

namespace Sge.Api.Usuarios;

/// <summary>
/// Somente leitura: o almoxarifado usa a lista para registrar pedidos em nome de outra pessoa
/// e consultar o contato do solicitante. Cadastro e edição ficam no Módulo Administração.
/// </summary>
[ApiController]
[Route("api/usuarios")]
[Authorize(Roles = Perfis.Equipe)]
public sealed class UsuariosController(UsuarioRepository repo) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<UsuarioDto>> Listar() => repo.ListarAsync();
}
