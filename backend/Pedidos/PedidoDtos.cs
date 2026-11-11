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

    /// <summary>
    /// Situação enviada pelo front (rótulo da tela ou valor do banco) convertida para o valor do banco.
    /// "Atendido Parcialmente" vira "atendido": a entrega parcial é derivada das quantidades.
    /// </summary>
    public static string? DoFront(string? valor) =>
        (valor ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "pendente" => Pendente,
            "em separação" or "em separacao" or "em_separacao" => EmSeparacao,
            "pronto p/ retirada" or "pronto para retirada" or "pronto" or "pronto_retirada" => ProntoRetirada,
            "atendido" or "atendido parcialmente" or "entregue" => Atendido,
            "cancelado" or "recusado" => Cancelado,
            _ => null
        };
}

// ---------- Requisição (contrato de pedidoService.criarPedido) ----------

public sealed record CriarPedidoItemRequest(int ProdutoId, decimal Quantidade);

public sealed record CriarPedidoRequest(
    string? Urgencia,
    string? Justificativa,
    int? SolicitanteId,
    string? Usuario,
    List<CriarPedidoItemRequest>? Itens,
    bool? EntregaImediata = null);

// ---------- Resposta (mesmo formato que o front já consome) ----------

public sealed record PedidoItemDto(
    int ProdutoId,
    string MaterialNome,
    decimal Quantidade,
    string Unidade,
    decimal? QuantidadeAtendida,
    bool BemDuravel = false);

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
    string? Justificativa,
    string? MensagemAlmoxarife = null,
    string? MotivoCancelamento = null,
    string? DataEntrega = null,
    string TipoPedido = "consumo",
    bool AguardandoAprovacaoAdmin = false);

// ---------- Atendimento pelo almoxarifado (contrato de pedidoService.atualizarStatus) ----------

/// <summary>Quantidade entregue de cada material, enviada na confirmação da entrega.</summary>
public sealed record ItemAtendimentoRequest(int? ProdutoId, decimal? QuantidadeAtendida);

public sealed record AtualizarStatusPedidoRequest(
    string? Status,
    string? MensagemAlmoxarife,
    string? MotivoCancelamento,
    List<ItemAtendimentoRequest>? Itens);
