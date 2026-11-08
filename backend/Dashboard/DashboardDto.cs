namespace Sge.Api.Dashboard;

/// <summary>Indicadores da tela inicial da administração (contrato de dashboardService.obter).</summary>
public sealed record DashboardDto(long TotalProdutos, long ProdutosEstoqueBaixo, long PedidosPendentes, long TotalUsuarios);
