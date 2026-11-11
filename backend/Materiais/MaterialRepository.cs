using Dapper;
using Sge.Api.Infrastructure;

namespace Sge.Api.Materiais;

public sealed class MaterialRepository(DbConnectionFactory db) : RepositorioBase(db)
{
    public sealed record DadosMaterial(
        string Codigo, string Nome, string? Categoria, string Unidade, decimal EstoqueMinimo,
        string Complexo, string? Localizacao, string? Descricao, bool BemDuravel, bool PermiteFracao);

    private const string SelectMateriais = """
        SELECT produto_id AS id, codigo, nome, categoria, unidade_medida AS unidade, complexo, permite_fracao, bem_duravel,
               quantidade, quantidade_minima AS estoque_minimo, localizacao, descricao, ativo
          FROM produtos
        """;

    public async Task<IReadOnlyList<MaterialDto>> ListarAsync(bool apenasAtivos, bool incluirPatrimonio = true)
    {
        var filtros = new List<string>();
        if (apenasAtivos) filtros.Add("ativo = TRUE");
        if (!incluirPatrimonio) filtros.Add("bem_duravel = FALSE");
        var where = filtros.Count > 0 ? " WHERE " + string.Join(" AND ", filtros) : string.Empty;

        await using var con = await AbrirAsync();
        var lista = await con.QueryAsync<MaterialDto>(SelectMateriais + where + " ORDER BY nome");
        return lista.Select(Normalizar).ToList();
    }

    public async Task<MaterialDto?> ObterAsync(Transacao t, int produtoId)
    {
        var material = await t.Conexao.QuerySingleOrDefaultAsync<MaterialDto>(
            SelectMateriais + " WHERE produto_id = @produtoId", new { produtoId }, t.Tx);
        return material is null ? null : Normalizar(material);
    }

    /// <summary>Insere o material com saldo zero; o saldo inicial entra pelo histórico de estoque.</summary>
    public async Task<int> InserirAsync(Transacao t, DadosMaterial m) =>
        await t.Conexao.ExecuteScalarAsync<int>("""
            INSERT INTO produtos (codigo, nome, categoria, unidade_medida, complexo, localizacao, descricao,
                                  permite_fracao, bem_duravel, quantidade, quantidade_minima)
            VALUES (@Codigo, @Nome, @Categoria, @Unidade, @Complexo, @Localizacao, @Descricao,
                    @PermiteFracao, @BemDuravel, 0, @EstoqueMinimo);
            SELECT LAST_INSERT_ID();
            """, m, t.Tx);

    public Task DefinirCodigoAsync(Transacao t, int produtoId, string codigo) =>
        t.Conexao.ExecuteAsync("UPDATE produtos SET codigo = @codigo WHERE produto_id = @produtoId",
            new { produtoId, codigo }, t.Tx);

    /// <summary>Atualiza os dados cadastrais. O saldo não muda aqui: só por movimentações.</summary>
    public async Task<bool> AtualizarAsync(Transacao t, int produtoId, DadosMaterial m) =>
        await t.Conexao.ExecuteAsync("""
            UPDATE produtos
               SET codigo = @Codigo, nome = @Nome, categoria = @Categoria, unidade_medida = @Unidade,
                   complexo = @Complexo, localizacao = @Localizacao, descricao = @Descricao, permite_fracao = @PermiteFracao,
                   bem_duravel = @BemDuravel, quantidade_minima = @EstoqueMinimo
             WHERE produto_id = @produtoId
            """, new { produtoId, m.Codigo, m.Nome, m.Categoria, m.Unidade, m.Complexo, m.Localizacao, m.Descricao,
                       m.PermiteFracao, m.BemDuravel, m.EstoqueMinimo }, t.Tx) > 0;

    /// <summary>Retira o material do catálogo sem apagar o histórico. Devolve se o material existe.</summary>
    public async Task<bool> DesativarAsync(Transacao t, int produtoId) =>
        await t.Conexao.ExecuteAsync("UPDATE produtos SET ativo = FALSE WHERE produto_id = @produtoId",
            new { produtoId }, t.Tx) > 0 || await t.Conexao.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM produtos WHERE produto_id = @produtoId", new { produtoId }, t.Tx) > 0;

    private static MaterialDto Normalizar(MaterialDto m)
    {
        m.Quantidade = Numeros.Normalizar(m.Quantidade);
        m.EstoqueMinimo = Numeros.Normalizar(m.EstoqueMinimo);
        return m;
    }
}
