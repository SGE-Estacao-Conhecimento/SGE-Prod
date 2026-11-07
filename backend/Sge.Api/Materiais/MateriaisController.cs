using Dapper;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.Materiais;

/// <summary>
/// Material no formato usado pelo front-end. Campos que ainda não existem no banco
/// (complexo, locação, validade, bem durável, itens por embalagem) não são enviados:
/// o front aplica os próprios valores padrão.
/// </summary>
public sealed class MaterialDto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string? Categoria { get; set; }
    public string Unidade { get; set; } = string.Empty;
    public bool PermiteFracao { get; set; }
    public decimal Quantidade { get; set; }
    public decimal EstoqueMinimo { get; set; }
    public string? Localizacao { get; set; }
    public string? Descricao { get; set; }
    public bool Ativo { get; set; }
}

public sealed class MaterialRepository(DbConnectionFactory db)
{
    public async Task<IReadOnlyList<MaterialDto>> ListarAsync(bool apenasAtivos)
    {
        await using var con = await db.AbrirAsync();
        var lista = await con.QueryAsync<MaterialDto>($"""
            SELECT produto_id AS id, codigo, nome, categoria, unidade_medida AS unidade, permite_fracao,
                   quantidade, quantidade_minima AS estoque_minimo, localizacao, descricao, ativo
              FROM produtos
             {(apenasAtivos ? "WHERE ativo = TRUE" : string.Empty)}
             ORDER BY nome
            """);
        return lista.Select(m =>
        {
            m.Quantidade = Numeros.Normalizar(m.Quantidade);
            m.EstoqueMinimo = Numeros.Normalizar(m.EstoqueMinimo);
            return m;
        }).ToList();
    }
}

[ApiController]
[Route("api/materiais")]
public sealed class MateriaisController(MaterialRepository repo) : ControllerBase
{
    /// <summary>
    /// Catálogo. Materiais inativos só são listados para a equipe (admin/almoxarifado);
    /// para o perfil Usuário o filtro de ativos é sempre aplicado.
    /// </summary>
    [HttpGet]
    public Task<IReadOnlyList<MaterialDto>> Listar([FromQuery] bool apenasAtivos = true) =>
        repo.ListarAsync(apenasAtivos || !User.EhEquipe());
}
