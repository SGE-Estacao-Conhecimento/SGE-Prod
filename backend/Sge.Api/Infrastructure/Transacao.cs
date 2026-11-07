using MySqlConnector;

namespace Sge.Api.Infrastructure;

/// <summary>
/// Conexão com transação aberta, usada por services que coordenam gravações em mais de um
/// repositório (PADROES_DESENVOLVIMENTO.md, seção 5). A transação é repassada explicitamente
/// aos métodos dos repositórios; não é um Unit of Work genérico.
/// </summary>
public sealed class Transacao : IAsyncDisposable
{
    private Transacao(MySqlConnection conexao, MySqlTransaction tx)
    {
        Conexao = conexao;
        Tx = tx;
    }

    public MySqlConnection Conexao { get; }
    public MySqlTransaction Tx { get; }

    public static async Task<Transacao> IniciarAsync(DbConnectionFactory db, CancellationToken ct = default)
    {
        var con = await db.AbrirAsync(ct);
        try
        {
            return new Transacao(con, await con.BeginTransactionAsync(ct));
        }
        catch
        {
            await con.DisposeAsync();
            throw;
        }
    }

    public Task ConfirmarAsync(CancellationToken ct = default) => Tx.CommitAsync(ct);

    /// <summary>Sem confirmação, a transação é desfeita ao descartar.</summary>
    public async ValueTask DisposeAsync()
    {
        await Tx.DisposeAsync();
        await Conexao.DisposeAsync();
    }
}
