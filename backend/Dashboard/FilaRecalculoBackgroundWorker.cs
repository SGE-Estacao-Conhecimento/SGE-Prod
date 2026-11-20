using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Sge.Api.Dashboard;

public sealed class FilaRecalculoBackgroundWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<FilaRecalculoBackgroundWorker> logger) : BackgroundService
{
    public const int LimiteLotePadrao = 20;
    public static readonly TimeSpan TempoLockPadrao = TimeSpan.FromMinutes(2);
    public static readonly TimeSpan IntervaloSemeaduraPadrao = TimeSpan.FromMinutes(1);
    public static readonly TimeSpan AtrasoQuandoVazioPadrao = TimeSpan.FromSeconds(5);
    public const int LimiteSemeaduraPadrao = 100;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("FilaRecalculoBackgroundWorker iniciado.");
        var ultimaSemeadura = DateTime.MinValue;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var filaRepo = scope.ServiceProvider.GetRequiredService<IFilaRecalculoRepository>();
                var previsaoService = scope.ServiceProvider.GetRequiredService<IPrevisaoEstoqueService>();

                if (DateTime.UtcNow - ultimaSemeadura >= IntervaloSemeaduraPadrao)
                {
                    try
                    {
                        await filaRepo.SemearMateriaisSemPrevisaoAsync(LimiteSemeaduraPadrao, stoppingToken);
                        ultimaSemeadura = DateTime.UtcNow;
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        break;
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "Erro ao semear materiais sem previsao na fila.");
                    }
                }

                var processados = await ProcessarLoteAsync(filaRepo, previsaoService, stoppingToken);
                if (processados == 0)
                {
                    await Task.Delay(AtrasoQuandoVazioPadrao, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Erro no ciclo do worker FilaRecalculoBackgroundWorker.");
                try
                {
                    await Task.Delay(AtrasoQuandoVazioPadrao, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
            }
        }

        logger.LogInformation("FilaRecalculoBackgroundWorker finalizado.");
    }

    public async Task<int> ProcessarLoteAsync(
        IFilaRecalculoRepository filaRepo,
        IPrevisaoEstoqueService previsaoService,
        CancellationToken ct = default)
    {
        var lote = await filaRepo.ReivindicarLoteAsync(LimiteLotePadrao, TempoLockPadrao, ct);
        if (lote.Count == 0) return 0;

        var concluidos = 0;
        foreach (var item in lote)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                await previsaoService.CalcularEAtualizarAsync(item.ProdutoId, ct);
                var concluido = await filaRepo.ConcluirAsync(item.ProdutoId, item.VersaoPendente, ct);
                if (concluido)
                {
                    concluidos++;
                }
                else
                {
                    logger.LogWarning(
                        "Item da fila para produto_id {ProdutoId} nao foi concluido: versao_pendente foi alterada concorrentemente (versao processada: {VersaoCapturada}).",
                        item.ProdutoId, item.VersaoPendente);
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Erro ao processar recalculo de previsao para produto_id {ProdutoId}", item.ProdutoId);
                try
                {
                    await filaRepo.RegistrarFalhaAsync(item.ProdutoId, ex.Message, ct);
                }
                catch (Exception exFalha)
                {
                    logger.LogError(exFalha, "Erro ao registrar falha na fila para produto_id {ProdutoId}", item.ProdutoId);
                }
            }
        }

        return lote.Count;
    }
}

public static class BackoffCalculador
{
    public static TimeSpan CalcularProximoIntervalo(int tentativas)
    {
        var expoente = Math.Min(tentativas + 1, 8);
        var segundos = Math.Min(3600, (int)Math.Pow(2, expoente) * 10);
        return TimeSpan.FromSeconds(segundos);
    }
}
