using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.Dashboard;

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = Perfis.Admin)]
public sealed class DashboardController(
    IDashboardRepository repo,
    IPrevisaoEstoqueService previsaoService,
    IMemoryCache cache) : ControllerBase
{
    private static readonly SemaphoreSlim _semaphore = new(1, 1);

    [HttpGet]
    public Task<DashboardDto> Obter(CancellationToken ct = default) => repo.ObterAsync(ct);

    [HttpGet("materiais/{produtoId:int}/previsao")]
    public async Task<IActionResult> ObterPrevisaoMaterial(
        [FromRoute] int produtoId,
        CancellationToken ct = default)
    {
        if (produtoId <= 0)
            return BadRequest(new ErrorResponse("Identificador do material inválido."));

        var detalhe = await previsaoService.ObterDetalheAsync(produtoId, ct);
        if (detalhe is null)
            return NotFound(new ErrorResponse("Material não encontrado ou inativo."));

        return Ok(detalhe);
    }

    [HttpGet("analytics")]
    public async Task<IActionResult> ObterAnalytics(
        [FromQuery] int janelaDias = 30,
        [FromQuery] bool forcar = false,
        CancellationToken ct = default)
    {
        if (janelaDias is not (7 or 15 or 30 or 60))
            return BadRequest(new { mensagem = "Parâmetro janelaDias inválido. Valores permitidos: 7, 15, 30, 60." });

        var cacheKey = $"dashboard_analytics_{janelaDias}";
        var rateLimitKey = $"dashboard_analytics_rate_limit_{janelaDias}";

        if (!forcar && cache.TryGetValue(cacheKey, out DashboardAnalyticsResponseDto? emCache))
            return Ok(emCache);

        await _semaphore.WaitAsync(ct);
        try
        {
            if (forcar)
            {
                if (cache.TryGetValue(rateLimitKey, out DateTimeOffset expiraEm))
                {
                    var restante = Math.Max(1, (int)Math.Ceiling((expiraEm - DateTimeOffset.UtcNow).TotalSeconds));
                    Response.Headers.RetryAfter = restante.ToString();
                    return StatusCode(StatusCodes.Status429TooManyRequests,
                        new { mensagem = "Aguarde antes de solicitar nova atualização forçada.", retryAfter = restante });
                }
            }
            else if (cache.TryGetValue(cacheKey, out DashboardAnalyticsResponseDto? duploCheck))
            {
                return Ok(duploCheck);
            }

            var dados = await repo.CalcularAnalyticsAsync(janelaDias, ct);

            if (forcar)
                cache.Set(rateLimitKey, DateTimeOffset.UtcNow.AddSeconds(20), TimeSpan.FromSeconds(20));

            cache.Set(cacheKey, dados, TimeSpan.FromMinutes(3));
            return Ok(dados);
        }
        finally
        {
            _semaphore.Release();
        }
    }
}
