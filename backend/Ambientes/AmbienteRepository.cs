using Dapper;
using Sge.Api.Infrastructure;

namespace Sge.Api.Ambientes;

public sealed class AmbienteRepository(DbConnectionFactory db) : RepositorioBase(db)
{
    public async Task<IReadOnlyList<AmbienteDto>> ListarTodosAsync(bool apenasAtivos = false)
    {
        await using var con = await AbrirAsync();
        var sql = """
            SELECT a.ambiente_id AS Id,
                   a.nome AS Nome,
                   a.setor AS Setor,
                   a.descricao AS Descricao,
                   a.ativo AS Ativo,
                   COALESCE(COUNT(CASE WHEN pi.status != 'baixado' THEN pi.item_id END), 0) AS TotalPatrimonios
              FROM ambientes a
              LEFT JOIN patrimonio_itens pi ON pi.ambiente_id = a.ambiente_id
             WHERE (@apenasAtivos = FALSE OR a.ativo = TRUE)
             GROUP BY a.ambiente_id, a.nome, a.setor, a.descricao, a.ativo
             ORDER BY a.nome
            """;
        var res = await con.QueryAsync<AmbienteDto>(sql, new { apenasAtivos });
        return res.ToList();
    }

    public async Task<AmbienteDto?> ObterPorIdAsync(int id)
    {
        await using var con = await AbrirAsync();
        var sql = """
            SELECT a.ambiente_id AS Id,
                   a.nome AS Nome,
                   a.setor AS Setor,
                   a.descricao AS Descricao,
                   a.ativo AS Ativo,
                   COALESCE(COUNT(CASE WHEN pi.status != 'baixado' THEN pi.item_id END), 0) AS TotalPatrimonios
              FROM ambientes a
              LEFT JOIN patrimonio_itens pi ON pi.ambiente_id = a.ambiente_id
             WHERE a.ambiente_id = @id
             GROUP BY a.ambiente_id, a.nome, a.setor, a.descricao, a.ativo
            """;
        return await con.QuerySingleOrDefaultAsync<AmbienteDto>(sql, new { id });
    }

    public async Task<int> CriarAsync(string nome, string? setor, string? descricao)
    {
        await using var con = await AbrirAsync();
        var existente = await con.QuerySingleOrDefaultAsync<(int Id, bool Ativo)?>(
            "SELECT ambiente_id AS Id, ativo AS Ativo FROM ambientes WHERE nome = @nome LIMIT 1",
            new { nome });

        if (existente is { } e)
        {
            if (e.Ativo)
                throw ApiException.Conflict($"O ambiente \"{nome}\" já está cadastrado.");

            await con.ExecuteAsync(
                "UPDATE ambientes SET ativo = TRUE, setor = @setor, descricao = @descricao WHERE ambiente_id = @Id",
                new { e.Id, setor, descricao });
            return e.Id;
        }

        return await con.QuerySingleAsync<int>(
            """
            INSERT INTO ambientes (nome, setor, descricao, ativo)
            VALUES (@nome, @setor, @descricao, TRUE);
            SELECT LAST_INSERT_ID();
            """,
            new { nome, setor, descricao });
    }

    public async Task<bool> AtualizarAsync(int id, string nome, string? setor, string? descricao)
    {
        await using var con = await AbrirAsync();
        var duplicado = await con.QuerySingleOrDefaultAsync<int?>(
            "SELECT ambiente_id FROM ambientes WHERE nome = @nome AND ambiente_id <> @id LIMIT 1",
            new { nome, id });
        if (duplicado is not null)
            throw ApiException.Conflict($"Já existe outro ambiente com o nome \"{nome}\".");

        var rows = await con.ExecuteAsync(
            "UPDATE ambientes SET nome = @nome, setor = @setor, descricao = @descricao WHERE ambiente_id = @id",
            new { id, nome, setor, descricao });
        return rows > 0;
    }

    public async Task<bool> AlternarStatusAsync(int id)
    {
        await using var con = await AbrirAsync();
        var rows = await con.ExecuteAsync(
            "UPDATE ambientes SET ativo = NOT ativo WHERE ambiente_id = @id",
            new { id });
        return rows > 0;
    }

    public async Task<bool> ExcluirAsync(int id)
    {
        await using var con = await AbrirAsync();
        var rows = await con.ExecuteAsync(
            "UPDATE ambientes SET ativo = FALSE WHERE ambiente_id = @id",
            new { id });
        return rows > 0;
    }
}

