using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.Pedidos;

[ApiController]
[Route("api/pedidos")]
public sealed class PedidosController(PedidoRepository repo, PedidoService service, AtendimentoPedidoService atendimento)
    : ControllerBase
{
    /// <summary>Fila completa de pedidos (almoxarifado e administração). Filtro opcional pela situação.</summary>
    [HttpGet]
    [Authorize(Roles = Perfis.Equipe)]
    public Task<IReadOnlyList<PedidoDto>> Listar([FromQuery] string? status)
    {
        string? filtro = null;
        if (!string.IsNullOrWhiteSpace(status))
            filtro = StatusPedido.DoFront(status) ?? throw ApiException.BadRequest("Situação do pedido inválida.");
        return repo.ListarAsync(filtro);
    }

    /// <summary>Pedidos em que o usuário logado é o solicitante.</summary>
    [HttpGet("meus")]
    public Task<IReadOnlyList<PedidoDto>> Meus() => repo.ListarPorSolicitanteAsync(User.FuncionarioId());

    [HttpPost]
    public async Task<ActionResult<PedidoDto>> Criar(CriarPedidoRequest req)
    {
        var pedido = await service.CriarAsync(req, User);
        return StatusCode(StatusCodes.Status201Created, pedido);
    }

    /// <summary>Mudança de situação pelo almoxarifado, incluindo a entrega com baixa de estoque.</summary>
    [HttpPatch("{id:int}/status")]
    [Authorize(Roles = Perfis.Equipe)]
    public Task<PedidoDto> AtualizarStatus(int id, AtualizarStatusPedidoRequest req) =>
        atendimento.AtualizarStatusAsync(id, req, User);

    /// <summary>Cancela o pedido (contrato de pedidoService.cancelar).</summary>
    [HttpDelete("{id:int}")]
    public Task<PedidoDto> Cancelar(int id) => service.CancelarAsync(id, User);
}
