using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;

namespace Sge.Api.Dashboard;

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = Perfis.Admin)]
public sealed class DashboardController(DashboardRepository repo) : ControllerBase
{
    [HttpGet]
    public Task<DashboardDto> Obter() => repo.ObterAsync();
}
