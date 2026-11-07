using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;

namespace Sge.Api.Estoque;

/// <summary>Histórico e movimentações de estoque. Restrito à equipe (almoxarifado e administração).</summary>
[ApiController]
[Route("api/movimentacoes")]
[Authorize(Roles = Perfis.Equipe)]
public sealed class MovimentacoesController(EstoqueRepository repo, MovimentacaoService service) : ControllerBase
{
    private const int Limite = 1000;

    [HttpGet]
    public Task<IReadOnlyList<MovimentacaoDto>> Listar([FromQuery] string? tipo, [FromQuery] int? produtoId) =>
        repo.ListarAsync(string.IsNullOrWhiteSpace(tipo) ? null : tipo.Trim().ToLowerInvariant(), produtoId, Limite);

    [HttpPost]
    public async Task<ActionResult<MovimentacaoDto>> Registrar(RegistrarMovimentacaoRequest req) =>
        StatusCode(StatusCodes.Status201Created, await service.RegistrarAsync(req, User));

    [HttpPost("ajuste")]
    public async Task<ActionResult<MovimentacaoDto>> Ajustar(AjustarEstoqueRequest req) =>
        StatusCode(StatusCodes.Status201Created, await service.AjustarAsync(req, User));
}
