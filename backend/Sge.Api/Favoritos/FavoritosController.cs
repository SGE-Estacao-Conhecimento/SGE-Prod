using Dapper;
using Microsoft.AspNetCore.Mvc;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.Favoritos;

public sealed class FavoritoRepository(DbConnectionFactory db)
{
    private const string SqlListar =
        "SELECT produto_id FROM favoritos WHERE usuario_id = @usuarioId ORDER BY data_criacao";

    public async Task<IReadOnlyList<int>> ListarAsync(int usuarioId)
    {
        await using var con = await db.AbrirAsync();
        return (await con.QueryAsync<int>(SqlListar, new { usuarioId })).ToList();
    }

    /// <summary>Marca ou desmarca o favorito e devolve a lista atualizada.</summary>
    public async Task<IReadOnlyList<int>> AlternarAsync(int usuarioId, int produtoId)
    {
        await using var con = await db.AbrirAsync();
        await using var tx = await con.BeginTransactionAsync();

        var existeProduto = await con.ExecuteScalarAsync<bool>(
            "SELECT EXISTS(SELECT 1 FROM produtos WHERE produto_id = @produtoId)", new { produtoId }, tx);
        if (!existeProduto)
            throw ApiException.NotFound("Material não encontrado.");

        var removidos = await con.ExecuteAsync(
            "DELETE FROM favoritos WHERE usuario_id = @usuarioId AND produto_id = @produtoId",
            new { usuarioId, produtoId }, tx);
        if (removidos == 0)
            await con.ExecuteAsync(
                "INSERT IGNORE INTO favoritos (usuario_id, produto_id) VALUES (@usuarioId, @produtoId)",
                new { usuarioId, produtoId }, tx);

        var lista = (await con.QueryAsync<int>(SqlListar, new { usuarioId }, tx)).ToList();
        await tx.CommitAsync();
        return lista;
    }
}

[ApiController]
[Route("api/favoritos")]
public sealed class FavoritosController(FavoritoRepository repo) : ControllerBase
{
    /// <summary>IDs dos materiais favoritados pelo usuário logado.</summary>
    [HttpGet]
    public Task<IReadOnlyList<int>> Listar() => repo.ListarAsync(User.UsuarioId());

    /// <summary>Alterna o favorito (contrato de favoritoService.alternar).</summary>
    [HttpPut("{produtoId:int}")]
    public Task<IReadOnlyList<int>> Alternar(int produtoId) => repo.AlternarAsync(User.UsuarioId(), produtoId);
}
