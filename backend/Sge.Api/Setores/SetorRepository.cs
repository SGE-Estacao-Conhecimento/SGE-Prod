using Dapper;
using Sge.Api.Infrastructure;

namespace Sge.Api.Setores;

public sealed class SetorRepository(DbConnectionFactory db) : RepositorioBase(db)
{
    /// <summary>Nomes dos setores ativos (mesmo formato do modo simulado: lista de textos).</summary>
    public async Task<IReadOnlyList<string>> ListarAtivosAsync()
    {
        await using var con = await AbrirAsync();
        return (await con.QueryAsync<string>("SELECT nome FROM setores WHERE ativo = TRUE ORDER BY nome")).ToList();
    }
}
