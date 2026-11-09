namespace Sge.Api.Materiais;

/// <summary>
/// Material no formato usado pelo front-end. Campos que ainda não existem no banco
/// (validade, itens por embalagem) não são enviados: o front aplica os próprios valores padrão.
/// </summary>
public sealed class MaterialDto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string? Categoria { get; set; }
    public string Unidade { get; set; } = string.Empty;
    public string Complexo { get; set; } = "Almoxarifado Central";
    public bool PermiteFracao { get; set; }
    public bool BemDuravel { get; set; }
    public decimal Quantidade { get; set; }
    public decimal EstoqueMinimo { get; set; }
    public string? Localizacao { get; set; }
    public string? Descricao { get; set; }
    public bool Ativo { get; set; }
}

/// <summary>Cadastro e edição (contrato de materialService.toPayload).</summary>
public sealed record SalvarMaterialRequest(
    string? Codigo,
    string? Nome,
    string? Categoria,
    string? Unidade,
    decimal? QuantidadeInicial,
    decimal? EstoqueMinimo,
    string? Complexo,
    string? Localizacao,
    string? Descricao,
    bool? BemDuravel,
    bool? PermiteFracao);
