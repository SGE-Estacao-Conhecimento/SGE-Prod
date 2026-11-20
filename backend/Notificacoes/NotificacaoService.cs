using System.Data.Common;
using System.Security.Claims;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;
using Sge.Api.Pedidos;

namespace Sge.Api.Notificacoes;

/// <summary>
/// Regras de negócio e mediação do ciclo de vida das notificações do sistema.
/// Responsável por formatar mensagens no padrão SGE e persistir eventos operacionais.
/// </summary>
public sealed class NotificacaoService(NotificacaoRepository repo, AppClock relogio)
{
    private const int LimitePadrao = 50;

    public async Task<IReadOnlyList<NotificacaoDto>> ListarAsync(ClaimsPrincipal usuario, CancellationToken ct = default)
    {
        var usuarioId = usuario.UsuarioId();
        var linhas = await repo.ListarPorUsuarioAsync(usuarioId, LimitePadrao, ct);

        return linhas.Select(l =>
        {
            var dataUtc = AppClock.ComoUtc(l.CriadaEm);
            var tempoFormatado = FormatarTempoRelativo(dataUtc);
            int? pedidoId = ExtrairPedidoId(l.LinkAcao);

            return new NotificacaoDto(
                l.NotificacaoId,
                pedidoId,
                l.Titulo,
                l.Mensagem,
                l.Tipo,
                l.Categoria,
                l.LinkAcao,
                l.TextoAcao,
                tempoFormatado,
                l.Lida,
                dataUtc
            );
        }).ToList();
    }

    public async Task<NotificacaoContadorDto> ObterContadorAsync(ClaimsPrincipal usuario, CancellationToken ct = default)
    {
        var usuarioId = usuario.UsuarioId();
        var naoLidas = await repo.ContarNaoLidasAsync(usuarioId, ct);
        return new NotificacaoContadorDto(naoLidas);
    }

    public async Task<bool> MarcarComoLidaAsync(long notificacaoId, ClaimsPrincipal usuario, CancellationToken ct = default)
    {
        var usuarioId = usuario.UsuarioId();
        return await repo.MarcarComoLidaAsync(notificacaoId, usuarioId, ct);
    }

    public async Task<int> MarcarTodasComoLidasAsync(ClaimsPrincipal usuario, CancellationToken ct = default)
    {
        var usuarioId = usuario.UsuarioId();
        return await repo.MarcarTodasComoLidasAsync(usuarioId, ct);
    }

    public async Task<bool> ExcluirAsync(long notificacaoId, ClaimsPrincipal usuario, CancellationToken ct = default)
    {
        var usuarioId = usuario.UsuarioId();
        return await repo.ExcluirAsync(notificacaoId, usuarioId, ct);
    }

    // ---------- Disparadores de Eventos Operacionais ----------

    /// <summary>
    /// Notifica a equipe do Almoxarifado sobre um novo pedido criado por funcionário.
    /// </summary>
    public async Task NotificarNovoPedidoAlmoxarifadoAsync(
        int pedidoId,
        string solicitanteNome,
        string setor,
        string urgencia,
        string resumoItens,
        DbConnection? con = null,
        DbTransaction? tx = null)
    {
        var isUrgente = urgencia.Equals("alta", StringComparison.OrdinalIgnoreCase);
        var tipo = isUrgente ? "urgente" : "info";
        var titulo = isUrgente ? $"Pedido Urgente #{pedidoId} Recebido" : $"Novo Pedido #{pedidoId} Registrado";
        var mensagem = $"{solicitanteNome} ({setor}) solicitou: {resumoItens}.";
        var linkAcao = $"/pedidos?id={pedidoId}";
        var textoAcao = "Iniciar Separação";

        await repo.InserirParaPerfilAsync(
            Perfis.Almoxarifado,
            "pedido",
            tipo,
            titulo,
            mensagem,
            linkAcao,
            textoAcao,
            con,
            tx
        );
    }

    /// <summary>
    /// Notifica a Administração sobre um novo pedido de patrimônio (bem durável) que exige deliberação prévia.
    /// </summary>
    public async Task NotificarNovoPedidoPatrimonioAdminAsync(
        int pedidoId,
        string solicitanteNome,
        string setor,
        string resumoItens,
        DbConnection? con = null,
        DbTransaction? tx = null)
    {
        var titulo = $"Pedido de Patrimônio #{pedidoId} Pendente";
        var mensagem = $"{solicitanteNome} ({setor}) solicitou bens permanentes: {resumoItens}. Deliberação administrativa necessária.";
        var linkAcao = $"/pedidos?id={pedidoId}&tab=novos";
        var textoAcao = "Deliberar Pedido";

        await repo.InserirParaPerfilAsync(
            Perfis.Admin,
            "patrimonio",
            "alerta",
            titulo,
            mensagem,
            linkAcao,
            textoAcao,
            con,
            tx
        );
    }

    /// <summary>
    /// Notifica o solicitante sobre a alteração de status do seu pedido (em separação, pronto para retirada, entregue, cancelado).
    /// </summary>
    public async Task NotificarStatusPedidoSolicitanteAsync(
        int pedidoId,
        int funcionarioSolicitanteId,
        string statusNovo,
        string? mensagemAlmoxarife = null,
        DbConnection? con = null,
        DbTransaction? tx = null)
    {
        var usuarioId = await repo.ObterUsuarioIdPorFuncionarioAsync(funcionarioSolicitanteId);
        if (usuarioId is null) return;

        var (titulo, mensagem, tipo, textoAcao) = statusNovo switch
        {
            StatusPedido.EmSeparacao => (
                $"Pedido #{pedidoId} em Separação",
                string.IsNullOrWhiteSpace(mensagemAlmoxarife)
                    ? "Seus itens estão sendo conferidos e separados pela equipe do almoxarifado."
                    : mensagemAlmoxarife,
                "info",
                "Ver Detalhes"
            ),
            StatusPedido.ProntoRetirada => (
                $"Pedido #{pedidoId} Pronto para Retirada",
                string.IsNullOrWhiteSpace(mensagemAlmoxarife)
                    ? "Todos os itens estão disponíveis no balcão do Almoxarifado Central. Apresente o número para retirar."
                    : mensagemAlmoxarife,
                "sucesso",
                "Ver Código"
            ),
            StatusPedido.Atendido => (
                $"Pedido #{pedidoId} Entregue",
                string.IsNullOrWhiteSpace(mensagemAlmoxarife)
                    ? "Retirada concluída no almoxarifado com sucesso."
                    : mensagemAlmoxarife,
                "sucesso",
                "Ver Histórico"
            ),
            StatusPedido.Cancelado => (
                $"Pedido #{pedidoId} Cancelado",
                string.IsNullOrWhiteSpace(mensagemAlmoxarife)
                    ? "O pedido foi cancelado ou recusado pela administração/almoxarifado."
                    : $"Motivo: {mensagemAlmoxarife}",
                "alerta",
                "Ver Motivo"
            ),
            _ => (
                $"Pedido #{pedidoId} Atualizado",
                string.IsNullOrWhiteSpace(mensagemAlmoxarife)
                    ? $"Situação alterada para {StatusPedido.Rotulo(statusNovo)}."
                    : mensagemAlmoxarife,
                "info",
                "Ver Detalhes"
            )
        };

        var linkAcao = $"/pedidos?id={pedidoId}";

        await repo.InserirAsync(
            usuarioId.Value,
            Perfis.Funcionario,
            "pedido",
            tipo,
            titulo,
            mensagem,
            linkAcao,
            textoAcao,
            con,
            tx
        );
    }

    /// <summary>
    /// Notifica o Administrador sobre uma nova solicitação de baixa de patrimônio registrada pelo almoxarife.
    /// </summary>
    public async Task NotificarSolicitacaoBaixaAdminAsync(
        int pedidoBaixaId,
        string numeroPatrimonio,
        string nomePatrimonio,
        string solicitanteNome,
        string motivoRotulo,
        DbConnection? con = null,
        DbTransaction? tx = null)
    {
        var titulo = $"Solicitação de Baixa: {numeroPatrimonio}";
        var mensagem = $"{solicitanteNome} solicitou baixa de \"{nomePatrimonio}\" por {motivoRotulo}. Fotos e laudo anexados.";
        var linkAcao = $"/pedidos?baixaId={pedidoBaixaId}&tab=baixas";
        var textoAcao = "Inspecionar Laudo";

        await repo.InserirParaPerfilAsync(
            Perfis.Admin,
            "patrimonio",
            "urgente",
            titulo,
            mensagem,
            linkAcao,
            textoAcao,
            con,
            tx
        );
    }

    /// <summary>
    /// Notifica o solicitante da baixa (geralmente o almoxarife) sobre o parecer emitido pela administração.
    /// </summary>
    public async Task NotificarParecerBaixaAsync(
        int usuarioSolicitanteId,
        string numeroPatrimonio,
        string nomePatrimonio,
        bool aprovado,
        string? parecer,
        DbConnection? con = null,
        DbTransaction? tx = null)
    {
        var titulo = aprovado
            ? $"Baixa Aprovada: {numeroPatrimonio}"
            : $"Baixa Recusada: {numeroPatrimonio}";
        var tipo = aprovado ? "sucesso" : "alerta";
        var mensagem = aprovado
            ? $"A baixa definitiva de \"{nomePatrimonio}\" foi aprovada pela administração. O bem foi desativado do acervo."
            : $"A baixa de \"{nomePatrimonio}\" foi indeferida pela administração. Parecer: {parecer ?? "Não informado"}.";
        var linkAcao = "/patrimonio";
        var textoAcao = "Ver Inventário";

        await repo.InserirAsync(
            usuarioSolicitanteId,
            Perfis.Almoxarifado,
            "patrimonio",
            tipo,
            titulo,
            mensagem,
            linkAcao,
            textoAcao,
            con,
            tx
        );
    }

    // ---------- Utilitários de Formatação ----------

    private string FormatarTempoRelativo(DateTime dataUtc)
    {
        var local = relogio.ParaLocal(dataUtc);
        var agoraLocal = relogio.ParaLocal(DateTime.UtcNow);
        var diferenca = agoraLocal - local;

        if (diferenca.TotalMinutes < 1) return "Agora mesmo";
        if (diferenca.TotalMinutes < 60) return $"Há {(int)diferenca.TotalMinutes} min";
        if (diferenca.TotalHours < 24 && local.Date == agoraLocal.Date)
            return $"Hoje às {local:HH:mm}";
        if (diferenca.TotalDays < 2 && local.Date == agoraLocal.Date.AddDays(-1))
            return $"Ontem às {local:HH:mm}";

        return local.ToString("dd/MM/yyyy HH:mm");
    }

    private static int? ExtrairPedidoId(string? link)
    {
        if (string.IsNullOrWhiteSpace(link)) return null;
        var match = System.Text.RegularExpressions.Regex.Match(link, @"(?:id=)(\d+)");
        return match.Success && int.TryParse(match.Groups[1].Value, out var id) ? id : null;
    }
}
