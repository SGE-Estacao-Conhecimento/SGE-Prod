namespace Sge.Api.Dashboard;

public interface IPrevisaoEstoqueService
{
    Task<ResultadoPrevisaoEstoque?> CalcularEAtualizarAsync(int produtoId, CancellationToken ct = default);
    Task<PrevisaoMaterialDetalheDto?> ObterDetalheAsync(int produtoId, CancellationToken ct = default);
    Task SolicitarRecalculoAsync(int produtoId, CancellationToken ct = default);
}
