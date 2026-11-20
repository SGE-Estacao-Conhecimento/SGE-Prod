namespace Sge.Api.Dashboard;

public interface IDashboardRepository
{
    Task<DashboardDto> ObterAsync(CancellationToken ct = default);
    Task<DashboardAnalyticsResponseDto> CalcularAnalyticsAsync(int janelaDias, CancellationToken ct = default);
}
