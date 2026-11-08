namespace Sge.Api.Estoque;

/// <summary>
/// Tipos gravados em movimentacoes_estoque.tipo e motivos padrão usados pela API.
/// O banco só aceita entrada vinda de recebimento ou registrada como ajuste com motivo;
/// a entrada manual da tela "Movimentar" é gravada como ajuste de entrada (decisão de 07/11/2026).
/// </summary>
public static class TipoMovimentacao
{
    public const string EntradaRecebimento = "entrada_recebimento";
    public const string SaidaPedido = "saida_pedido";
    public const string Estorno = "estorno";
    public const string Ajuste = "ajuste";

    public const string MotivoEntradaManual = "Entrada manual avulsa";
    public const string PrefixoEntradaManual = "Entrada manual: ";
    public const string MotivoSaldoInicial = "Saldo inicial cadastrado";
    public const string MotivoAjustePadrao = "Ajuste de inventário físico";
    public const string PrefixoAjuste = "Ajuste de inventário: ";

    /// <summary>Tipo exibido pelo front ('entrada' | 'saida' | 'ajuste').</summary>
    public static string ParaFront(string tipo, string sentido, string? motivo) => tipo switch
    {
        EntradaRecebimento => "entrada",
        SaidaPedido => "saida",
        Ajuste when sentido == "entrada" && motivo is not null
            && (motivo.StartsWith("Entrada manual", StringComparison.Ordinal)
                || motivo.StartsWith("Saldo inicial", StringComparison.Ordinal)) => "entrada",
        _ => "ajuste"
    };
}

// ---------- Requisições (contrato de movimentacaoService) ----------

public sealed record RegistrarMovimentacaoRequest(int ProdutoId, string? Tipo, decimal Quantidade, string? Observacao);

public sealed record AjustarEstoqueRequest(int ProdutoId, decimal? NovoSaldo, string? Motivo);

// ---------- Resposta (mesmo formato do modo simulado) ----------

public sealed record MovimentacaoDto(
    long Id,
    int ProdutoId,
    string ProdutoNome,
    string Tipo,
    decimal Quantidade,
    decimal SaldoApos,
    DateTime Data,
    string FuncionarioNome,
    string Observacao);
