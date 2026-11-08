using MySqlConnector;

namespace Sge.Api.Infrastructure;

/// <summary>
/// Abre conexões com o MySQL. Cada conexão trabalha em UTC, independentemente
/// do fuso configurado no servidor (o schema grava datas em UTC).
/// </summary>
public sealed class DbConnectionFactory(string connectionString)
{
    public async Task<MySqlConnection> AbrirAsync(CancellationToken ct = default)
    {
        var conexao = new MySqlConnection(connectionString);
        await conexao.OpenAsync(ct);
        await using var cmd = new MySqlCommand("SET time_zone = '+00:00'", conexao);
        await cmd.ExecuteNonQueryAsync(ct);
        return conexao;
    }
}
