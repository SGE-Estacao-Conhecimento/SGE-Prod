using Dapper;
using Sge.Api.Infrastructure;

namespace Sge.Api.Patrimonios;

public sealed class PatrimonioRepository(DbConnectionFactory db) : RepositorioBase(db)
{
    public async Task<IReadOnlyList<PatrimonioCatalogoDto>> ListarCatalogoAsync(string? categoria = null)
    {
        await using var con = await AbrirAsync();
        var sql = """
            SELECT p.patrimonio_id AS Id,
                   p.nome AS Nome,
                   p.categoria AS Categoria,
                   p.marca AS Marca,
                   p.modelo AS Modelo,
                   p.descricao AS Descricao,
                   p.ativo AS Ativo,
                   COALESCE(COUNT(CASE WHEN pi.status != 'baixado' THEN pi.item_id END), 0) AS TotalExemplares
              FROM patrimonios p
              LEFT JOIN patrimonio_itens pi ON pi.patrimonio_id = p.patrimonio_id
             WHERE p.ativo = TRUE
               AND (@categoria IS NULL OR p.categoria = @categoria)
             GROUP BY p.patrimonio_id, p.nome, p.categoria, p.marca, p.modelo, p.descricao, p.ativo
             ORDER BY p.nome
            """;
        var res = await con.QueryAsync<PatrimonioCatalogoDto>(sql, new { categoria });
        return res.ToList();
    }

    public async Task<PatrimonioCatalogoDto?> ObterCatalogoPorIdAsync(int id)
    {
        await using var con = await AbrirAsync();
        var sql = """
            SELECT p.patrimonio_id AS Id,
                   p.nome AS Nome,
                   p.categoria AS Categoria,
                   p.marca AS Marca,
                   p.modelo AS Modelo,
                   p.descricao AS Descricao,
                   p.ativo AS Ativo,
                   COALESCE(COUNT(CASE WHEN pi.status != 'baixado' THEN pi.item_id END), 0) AS TotalExemplares
              FROM patrimonios p
              LEFT JOIN patrimonio_itens pi ON pi.patrimonio_id = p.patrimonio_id
             WHERE p.patrimonio_id = @id
             GROUP BY p.patrimonio_id, p.nome, p.categoria, p.marca, p.modelo, p.descricao, p.ativo
            """;
        return await con.QuerySingleOrDefaultAsync<PatrimonioCatalogoDto>(sql, new { id });
    }

    public async Task<int> CriarCatalogoAsync(string nome, string categoria, string? marca, string? modelo, string? descricao)
    {
        await using var con = await AbrirAsync();
        return await con.QuerySingleAsync<int>(
            """
            INSERT INTO patrimonios (nome, categoria, marca, modelo, descricao, ativo)
            VALUES (@nome, @categoria, @marca, @modelo, @descricao, TRUE);
            SELECT LAST_INSERT_ID();
            """,
            new { nome, categoria, marca, modelo, descricao });
    }

    public async Task<bool> AtualizarCatalogoAsync(int id, string nome, string categoria, string? marca, string? modelo, string? descricao)
    {
        await using var con = await AbrirAsync();
        var rows = await con.ExecuteAsync(
            """
            UPDATE patrimonios
               SET nome = @nome,
                   categoria = @categoria,
                   marca = @marca,
                   modelo = @modelo,
                   descricao = @descricao
             WHERE patrimonio_id = @id
            """,
            new { id, nome, categoria, marca, modelo, descricao });
        return rows > 0;
    }

    public async Task<IReadOnlyList<PatrimonioItemDto>> ListarItensAsync(
        int? ambienteId = null,
        bool semAmbiente = false,
        string? busca = null,
        string? categoria = null,
        string? status = null)
    {
        await using var con = await AbrirAsync();
        var sql = """
            SELECT pi.item_id AS Id,
                   pi.patrimonio_id AS PatrimonioId,
                   p.nome AS NomePatrimonio,
                   p.categoria AS Categoria,
                   p.marca AS Marca,
                   p.modelo AS Modelo,
                   pi.numero_patrimonio AS NumeroPatrimonio,
                   pi.numero_serie AS NumeroSerie,
                   pi.ambiente_id AS AmbienteId,
                   a.nome AS NomeAmbiente,
                   pi.responsavel_usuario_id AS ResponsavelId,
                   u.nome AS NomeResponsavel,
                   pi.estado_conservacao AS EstadoConservacao,
                   pi.status AS Status,
                   DATE_FORMAT(pi.data_aquisicao, '%d/%m/%Y') AS DataAquisicao,
                   pi.observacoes AS Observacoes,
                   DATE_FORMAT(pi.data_cadastro, '%d/%m/%Y') AS DataCadastro
              FROM patrimonio_itens pi
              JOIN patrimonios p ON p.patrimonio_id = pi.patrimonio_id
              LEFT JOIN ambientes a ON a.ambiente_id = pi.ambiente_id
              LEFT JOIN usuarios u ON u.usuario_id = pi.responsavel_usuario_id
             WHERE (@ambienteId IS NULL OR pi.ambiente_id = @ambienteId)
               AND (@semAmbiente = FALSE OR pi.ambiente_id IS NULL)
               AND (@categoria IS NULL OR p.categoria = @categoria)
               AND (@status IS NULL OR pi.status = @status)
               AND (@busca IS NULL OR (
                    p.nome LIKE CONCAT('%', @busca, '%')
                 OR pi.numero_patrimonio LIKE CONCAT('%', @busca, '%')
                 OR pi.numero_serie LIKE CONCAT('%', @busca, '%')
                 OR u.nome LIKE CONCAT('%', @busca, '%')
                 OR a.nome LIKE CONCAT('%', @busca, '%')
               ))
             ORDER BY pi.data_cadastro DESC, pi.item_id DESC
            """;
        var res = await con.QueryAsync<PatrimonioItemDto>(sql, new {
            ambienteId = semAmbiente ? null : ambienteId,
            semAmbiente,
            categoria,
            status,
            busca = string.IsNullOrWhiteSpace(busca) ? null : busca.Trim()
        });
        return res.ToList();
    }

    public async Task<PatrimonioItemDto?> ObterItemPorIdAsync(int id)
    {
        await using var con = await AbrirAsync();
        var sql = """
            SELECT pi.item_id AS Id,
                   pi.patrimonio_id AS PatrimonioId,
                   p.nome AS NomePatrimonio,
                   p.categoria AS Categoria,
                   p.marca AS Marca,
                   p.modelo AS Modelo,
                   pi.numero_patrimonio AS NumeroPatrimonio,
                   pi.numero_serie AS NumeroSerie,
                   pi.ambiente_id AS AmbienteId,
                   a.nome AS NomeAmbiente,
                   pi.responsavel_usuario_id AS ResponsavelId,
                   u.nome AS NomeResponsavel,
                   pi.estado_conservacao AS EstadoConservacao,
                   pi.status AS Status,
                   DATE_FORMAT(pi.data_aquisicao, '%d/%m/%Y') AS DataAquisicao,
                   pi.observacoes AS Observacoes,
                   DATE_FORMAT(pi.data_cadastro, '%d/%m/%Y') AS DataCadastro
              FROM patrimonio_itens pi
              JOIN patrimonios p ON p.patrimonio_id = pi.patrimonio_id
              LEFT JOIN ambientes a ON a.ambiente_id = pi.ambiente_id
              LEFT JOIN usuarios u ON u.usuario_id = pi.responsavel_usuario_id
             WHERE pi.item_id = @id
            """;
        return await con.QuerySingleOrDefaultAsync<PatrimonioItemDto>(sql, new { id });
    }

    public async Task<bool> ExisteNumeroPatrimonioAsync(string numeroPatrimonio, int? ignorarItemId = null)
    {
        await using var con = await AbrirAsync();
        var count = await con.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM patrimonio_itens WHERE numero_patrimonio = @numeroPatrimonio AND (@ignorarItemId IS NULL OR item_id <> @ignorarItemId)",
            new { numeroPatrimonio, ignorarItemId });
        return count > 0;
    }

    public async Task<int> CriarItemAsync(
        int patrimonioId,
        string numeroPatrimonio,
        string? numeroSerie,
        int? ambienteId,
        int? responsavelUsuarioId,
        string estadoConservacao,
        string status,
        DateTime? dataAquisicao,
        string? observacoes)
    {
        await using var con = await AbrirAsync();
        return await con.QuerySingleAsync<int>(
            """
            INSERT INTO patrimonio_itens (
                patrimonio_id, numero_patrimonio, numero_serie, ambiente_id,
                responsavel_usuario_id, estado_conservacao, status,
                data_aquisicao, observacoes
            ) VALUES (
                @patrimonioId, @numeroPatrimonio, @numeroSerie, @ambienteId,
                @responsavelUsuarioId, @estadoConservacao, @status,
                @dataAquisicao, @observacoes
            );
            SELECT LAST_INSERT_ID();
            """,
            new {
                patrimonioId,
                numeroPatrimonio,
                numeroSerie,
                ambienteId,
                responsavelUsuarioId,
                estadoConservacao,
                status,
                dataAquisicao,
                observacoes
            });
    }

    public async Task<bool> AtualizarItemAsync(
        int id,
        string numeroPatrimonio,
        string? numeroSerie,
        int? ambienteId,
        int? responsavelUsuarioId,
        string estadoConservacao,
        string status,
        DateTime? dataAquisicao,
        string? observacoes)
    {
        await using var con = await AbrirAsync();
        var rows = await con.ExecuteAsync(
            """
            UPDATE patrimonio_itens
               SET numero_patrimonio = @numeroPatrimonio,
                   numero_serie = @numeroSerie,
                   ambiente_id = @ambienteId,
                   responsavel_usuario_id = @responsavelUsuarioId,
                   estado_conservacao = @estadoConservacao,
                   status = @status,
                   data_aquisicao = @dataAquisicao,
                   observacoes = @observacoes
             WHERE item_id = @id
            """,
            new {
                id,
                numeroPatrimonio,
                numeroSerie,
                ambienteId,
                responsavelUsuarioId,
                estadoConservacao,
                status,
                dataAquisicao,
                observacoes
            });
        return rows > 0;
    }

    public async Task<bool> TransferirItemAsync(int id, int? novoAmbienteId, int? novoResponsavelId, string? observacoes)
    {
        await using var con = await AbrirAsync();
        var rows = await con.ExecuteAsync(
            """
            UPDATE patrimonio_itens
               SET ambiente_id = @novoAmbienteId,
                   responsavel_usuario_id = @novoResponsavelId,
                   observacoes = COALESCE(@observacoes, observacoes)
             WHERE item_id = @id
            """,
            new { id, novoAmbienteId, novoResponsavelId, observacoes });
        return rows > 0;
    }

    public async Task<bool> BaixarItemAsync(int id)
    {
        await using var con = await AbrirAsync();
        var rows = await con.ExecuteAsync(
            "UPDATE patrimonio_itens SET status = 'baixado' WHERE item_id = @id",
            new { id });
        return rows > 0;
    }
}

