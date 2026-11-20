using Sge.Api.Infrastructure;

namespace Sge.Api.Dashboard;

public interface IPrevisoesEstoqueRepository
{
    Task<PrevisaoEstoqueModel?> ObterPorProdutoIdAsync(int produtoId, CancellationToken ct = default);
    Task<IReadOnlyList<PrevisaoEstoqueModel>> ObterTodasAsync(CancellationToken ct = default);
    Task SalvarAsync(PrevisaoEstoqueModel previsao, CancellationToken ct = default);
    Task SalvarAsync(Transacao t, PrevisaoEstoqueModel previsao, CancellationToken ct = default);
}
