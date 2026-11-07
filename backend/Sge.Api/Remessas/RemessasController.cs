using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;
using Sge.Api.Infrastructure.Armazenamento;

namespace Sge.Api.Remessas;

/// <summary>Recebimentos em lote e doações. Restrito à equipe (almoxarifado e administração).</summary>
[ApiController]
[Route("api/remessas")]
[Authorize(Roles = Perfis.Equipe)]
public sealed class RemessasController(RemessaRepository repo, RemessaService service) : ControllerBase
{
    private const int Limite = 500;

    [HttpGet]
    public Task<IReadOnlyList<RemessaDto>> Listar() => repo.ListarAsync(Limite);

    /// <summary>Cria o recebimento em preparação (ainda sem entrada no estoque).</summary>
    [HttpPost]
    public async Task<ActionResult<RemessaDto>> Criar(CriarRemessaRequest req)
    {
        var (remessa, criada) = await service.CriarAsync(req, User);
        return criada ? StatusCode(StatusCodes.Status201Created, remessa) : Ok(remessa);
    }

    /// <summary>Envia uma foto do material (multipart, campo "arquivo").</summary>
    [HttpPost("{id:int}/fotos")]
    [RequestSizeLimit(ArmazenamentoArquivosBase.TamanhoMaximoBytes + 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = ArmazenamentoArquivosBase.TamanhoMaximoBytes + 1024 * 1024)]
    public Task<RemessaDto> EnviarFoto(int id, IFormFile? arquivo, CancellationToken ct) =>
        service.EnviarFotoAsync(id, arquivo, User, ct);

    /// <summary>Confirma o recebimento e dá entrada no estoque.</summary>
    [HttpPost("{id:int}/confirmar")]
    public Task<RemessaDto> Confirmar(int id) => service.ConfirmarAsync(id, User);

    /// <summary>Exibe uma foto do recebimento. A API transmite o arquivo; o endereço do armazenamento não é exposto.</summary>
    [HttpGet("{id:int}/fotos/{anexoId:int}")]
    public async Task<IActionResult> AbrirFoto(int id, int anexoId, CancellationToken ct)
    {
        var (conteudo, tipoMime, nome) = await service.AbrirFotoAsync(id, anexoId, ct);
        return File(conteudo, tipoMime, nome);
    }
}
