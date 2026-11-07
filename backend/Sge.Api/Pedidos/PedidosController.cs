using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;

namespace Sge.Api.Pedidos;

[ApiController]
[Route("api/pedidos")]
public sealed class PedidosController(PedidoRepository repo, PedidoService service) : ControllerBase
{
    /// <summary>Pedidos em que o usuário logado é o solicitante.</summary>
    [HttpGet("meus")]
    public Task<IReadOnlyList<PedidoDto>> Meus() => repo.ListarPorSolicitanteAsync(User.FuncionarioId());

    [HttpPost]
    public async Task<ActionResult<PedidoDto>> Criar(CriarPedidoRequest req)
    {
        var pedido = await service.CriarAsync(req, User);
        return StatusCode(StatusCodes.Status201Created, pedido);
    }

    /// <summary>Cancela o pedido (contrato de pedidoService.cancelar).</summary>
    [HttpDelete("{id:int}")]
    public Task<PedidoDto> Cancelar(int id) => service.CancelarAsync(id, User);
}
