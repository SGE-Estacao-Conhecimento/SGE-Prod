using Sge.Api.Infrastructure;

namespace Sge.Api.Dashboard;

public interface IFilaRecalculoRepository
{
    Task EnfileirarAsync(Transacao t, int produtoId, CancellationToken ct = default);
    Task EnfileirarAsync(int produtoId, CancellationToken ct = default);
    Task<IReadOnlyList<ItemFilaRecalculo>> ReivindicarLoteAsync(int limite, TimeSpan tempoLock, CancellationToken ct = default);
    Task<bool> ConcluirAsync(int produtoId, long versaoCapturada, CancellationToken ct = default);
    Task RegistrarFalhaAsync(int produtoId, string erro, CancellationToken ct = default);
    Task SemearMateriaisSemPrevisaoAsync(int limite, CancellationToken ct = default);
}
