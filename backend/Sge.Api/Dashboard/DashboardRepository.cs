using Dapper;
using Sge.Api.Infrastructure;

namespace Sge.Api.Dashboard;

public sealed class DashboardRepository(DbConnectionFactory db) : RepositorioBase(db)
{
    /// <summary>
    /// Mesmos critérios do modo simulado: materiais do catálogo (ativos), estoque baixo quando o saldo
    /// é menor ou igual ao mínimo, pedidos pendentes e total de usuários cadastrados.
    /// </summary>
    public async Task<DashboardDto> ObterAsync()
    {
        await using var con = await AbrirAsync();
        return await con.QuerySingleAsync<DashboardDto>("""
            SELECT
              (SELECT COUNT(*) FROM produtos WHERE ativo = TRUE) AS TotalProdutos,
              (SELECT COUNT(*) FROM produtos WHERE ativo = TRUE AND quantidade <= quantidade_minima) AS ProdutosEstoqueBaixo,
              (SELECT COUNT(*) FROM pedidos WHERE status = 'pendente') AS PedidosPendentes,
              (SELECT COUNT(*) FROM usuarios) AS TotalUsuarios
            """);
    }
}
