namespace Sge.Api.Notificacoes;

/// <summary>
/// DTO de leitura de notificação retornado para a interface do usuário.
/// </summary>
public sealed record NotificacaoDto(
    long Id,
    int? PedidoId,
    string Titulo,
    string Mensagem,
    string Tipo,
    string Categoria,
    string? LinkAcao,
    string? TextoAcao,
    string Tempo,
    bool Lida,
    DateTime Data);

/// <summary>
/// Resumo com a contagem rápida de pendências não lidas para o badge.
/// </summary>
public sealed record NotificacaoContadorDto(int NaoLidas);
