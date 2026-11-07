namespace Sge.Api.Pedidos;

/// <summary>Situações gravadas em pedidos.status e os rótulos exibidos pelo front-end.</summary>
public static class StatusPedido
{
    public const string Pendente = "pendente";
    public const string EmSeparacao = "em_separacao";
    public const string ProntoRetirada = "pronto_retirada";
    public const string Atendido = "atendido";
    public const string Cancelado = "cancelado";

    /// <summary>"Atendido Parcialmente" é derivado: algum item entregue abaixo do solicitado.</summary>
    public static string Rotulo(string status, bool entregaParcial = false) => status switch
    {
        Pendente => "Pendente",
        EmSeparacao => "Em Separação",
        ProntoRetirada => "Pronto para Retirada",
        Atendido => entregaParcial ? "Atendido Parcialmente" : "Atendido",
        Cancelado => "Cancelado",
        _ => status
    };
}

// ---------- Requisição (contrato de pedidoService.criarPedido) ----------

public sealed record CriarPedidoItemRequest(int ProdutoId, decimal Quantidade);

public sealed record CriarPedidoRequest(
    string? Urgencia,
    string? Justificativa,
    int? SolicitanteId,
    string? Usuario,
    List<CriarPedidoItemRequest>? Itens);

// ---------- Resposta (mesmo formato que o front já consome) ----------

public sealed record PedidoItemDto(
    int ProdutoId,
    string MaterialNome,
    decimal Quantidade,
    string Unidade,
    decimal? QuantidadeAtendida);

public sealed record PedidoDto(
    int Id,
    int? UsuarioId,
    string Usuario,
    string Setor,
    string Data,
    DateTime DataIso,
    string Material,
    decimal Quantidade,
    IReadOnlyList<PedidoItemDto> Materiais,
    IReadOnlyList<PedidoItemDto> Itens,
    string Prioridade,
    bool Urgente,
    string Urgencia,
    string Status,
    string? Justificativa);
