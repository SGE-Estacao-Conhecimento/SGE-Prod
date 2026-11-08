using Dapper;
using Sge.Api.Infrastructure;

namespace Sge.Api.Setores;

public sealed class SetorRepository(DbConnectionFactory db) : RepositorioBase(db)
{
    /// <summary>Nomes dos setores ativos (lista de textos ordenada alfabeticamente).</summary>
    public async Task<IReadOnlyList<string>> ListarAtivosAsync()
    {
        await using var con = await AbrirAsync();
        return (await con.QueryAsync<string>("SELECT nome FROM setores WHERE ativo = TRUE ORDER BY nome")).ToList();
    }

    public async Task CriarAsync(string nome)
    {
        await using var con = await AbrirAsync();
        var existente = await con.QuerySingleOrDefaultAsync<(int Id, bool Ativo)?>(
            "SELECT setor_id AS Id, ativo AS Ativo FROM setores WHERE nome = @nome LIMIT 1", new { nome });
        if (existente is { } s)
        {
            if (s.Ativo)
                throw ApiException.Conflict($"O setor \"{nome}\" já está cadastrado.");
            await con.ExecuteAsync("UPDATE setores SET ativo = TRUE WHERE setor_id = @Id", new { s.Id });
            return;
        }
        await con.ExecuteAsync("INSERT INTO setores (nome, ativo) VALUES (@nome, TRUE)", new { nome });
    }
}
