using MySqlConnector;

namespace Sge.Api.Infrastructure;

/// <summary>
/// Base dos repositórios (PADROES_DESENVOLVIMENTO.md, seção 5): somente abertura de conexão
/// (já em UTC) e execução de gravações em transação. Não contém consultas nem regras de domínio.
/// </summary>
public abstract class RepositorioBase(DbConnectionFactory db)
{
    protected Task<MySqlConnection> AbrirAsync(CancellationToken ct = default) => db.AbrirAsync(ct);

    /// <summary>Executa a gravação numa transação própria: confirma ao final ou desfaz em caso de erro.</summary>
    protected async Task<T> EmTransacaoAsync<T>(Func<MySqlConnection, MySqlTransaction, Task<T>> operacao,
        CancellationToken ct = default)
    {
        await using var con = await db.AbrirAsync(ct);
        await using var tx = await con.BeginTransactionAsync(ct);
        var resultado = await operacao(con, tx);
        await tx.CommitAsync(ct);
        return resultado;
    }
}
