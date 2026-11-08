using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;
using Sge.Api.Pedidos;

namespace Sge.Api.Notificacoes;

public sealed record NotificacaoDto(
    string Id, int PedidoId, string Titulo, string Mensagem, string Tipo, string Tempo, bool Lida, DateTime Data);

/// <summary>
/// Notificações derivadas do histórico de pedidos (pedido_logs), sem tabela própria.
/// Títulos, mensagens e tipos reproduzem os que o front gerava no modo simulado.
/// O estado "lida" continua controlado apenas na tela (decisão pendente da equipe).
/// </summary>
public sealed class NotificacaoService(DbConnectionFactory db, PedidoRepository pedidos, AppClock relogio)
{
    private const int Limite = 50;

    private sealed class LogLinha
    {
        public long LogId { get; set; }
        public int PedidoId { get; set; }
        public string? StatusAnterior { get; set; }
        public string StatusNovo { get; set; } = string.Empty;
        public string? Descricao { get; set; }
        public DateTime DataLog { get; set; }
        public string Urgencia { get; set; } = string.Empty;
    }

    public async Task<IReadOnlyList<NotificacaoDto>> ListarAsync(ClaimsPrincipal usuario)
    {
        // Avisos para a equipe (admin/almoxarifado) dependem de decisão da equipe sobre quem recebe cada aviso.
        if (usuario.EhEquipe()) return [];

        await using var con = await db.AbrirAsync();
        var logs = (await con.QueryAsync<LogLinha>("""
            SELECT l.log_id, l.pedido_id, l.status_anterior, l.status_novo, l.descricao, l.data_log, p.urgencia
              FROM pedido_logs l
              JOIN pedidos p ON p.pedido_id = l.pedido_id
             WHERE p.funcionario_solicitante_id = @funcionarioId
             ORDER BY l.data_log DESC, l.log_id DESC
             LIMIT @Limite
            """, new { funcionarioId = usuario.FuncionarioId(), Limite })).ToList();

        var itens = await pedidos.ItensPorPedidoAsync(con, logs.Select(l => l.PedidoId).Distinct().ToList());
        return logs.Select(l => Montar(l, PedidoRepository.Resumo(itens.GetValueOrDefault(l.PedidoId) ?? []))).ToList();
    }

    private NotificacaoDto Montar(LogLinha log, string resumo)
    {
        var id = log.PedidoId;
        var (titulo, mensagem, tipo) = log.StatusNovo switch
        {
            StatusPedido.Pendente when log.StatusAnterior is null => log.Urgencia == "alta"
                ? ("Pedido Urgente Registrado", $"{resumo} enviado para o almoxarifado.", "urgente")
                : ($"Pedido #{id} Criado", $"{resumo} enviado para o almoxarifado.", "info"),
            StatusPedido.ProntoRetirada => ($"Pedido #{id} Pronto para Retirada!", MensagemOuPadrao(log), "urgente"),
            StatusPedido.Atendido => ($"Pedido #{id} Entregue", MensagemOuPadrao(log), "sucesso"),
            _ => ($"Pedido #{id} Atualizado", MensagemOuPadrao(log), "info")
        };

        var data = AppClock.ComoUtc(log.DataLog);
        return new NotificacaoDto($"log-{log.LogId}", id, titulo, mensagem, tipo,
            relogio.ParaLocal(data).ToString("dd/MM/yyyy HH:mm"), false, data);
    }

    /// <summary>Descrição registrada na mudança (ex.: mensagem do almoxarife) ou texto padrão.</summary>
    private static string MensagemOuPadrao(LogLinha log) =>
        string.IsNullOrWhiteSpace(log.Descricao)
            ? $"Situação alterada para: {StatusPedido.Rotulo(log.StatusNovo)}."
            : log.Descricao;
}

[ApiController]
[Route("api/notificacoes")]
public sealed class NotificacoesController(NotificacaoService service) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<NotificacaoDto>> Listar() => service.ListarAsync(User);
}
