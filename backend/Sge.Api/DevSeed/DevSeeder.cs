using Dapper;
using MySqlConnector;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.DevSeed;

/// <summary>
/// Inicialização e reset do ambiente local de desenvolvimento:
/// - Garante de forma idempotente apenas o usuário administrador inicial (login: admin / senha: admin).
/// - Não cadastra setores, materiais, funcionários, almoxarifes, pedidos, movimentações ou remessas fictícias.
/// - Permite reset explícito do banco local (dotnet run -- reset-dev --confirm) preservando estrutura, FKs e triggers.
/// </summary>
public sealed class DevSeeder(DbConnectionFactory db, PasswordService senhas, ILogger<DevSeeder> logger)
{
    public const string LoginAdminInicial = "admin";
    public const string SenhaAdminInicial = "admin";

    public async Task ExecutarAsync()
    {
        await using var con = await db.AbrirAsync();
        await GarantirColunaFuncionarioOpcionalAsync(con);

        var adminExistenteId = await con.ExecuteScalarAsync<int?>(
            "SELECT usuario_id FROM usuarios WHERE email = @login LIMIT 1",
            new { login = LoginAdminInicial });

        if (adminExistenteId is not null)
        {
            logger.LogInformation("Usuário administrador inicial ('{Login}') já existe (id={Id}). Nenhuma alteração realizada.",
                LoginAdminInicial, adminExistenteId.Value);
            return;
        }

        var hash = senhas.Hash(SenhaAdminInicial);
        var id = await con.ExecuteScalarAsync<int>("""
            INSERT INTO usuarios (funcionario_id, email, senha_hash, perfil, ativo)
            VALUES (NULL, @login, @hash, @perfil, TRUE);
            SELECT LAST_INSERT_ID();
            """, new { login = LoginAdminInicial, hash, perfil = Perfis.Admin });

        logger.LogInformation("Usuário administrador inicial criado com sucesso (id={Id}, login='{Login}', perfil='{Perfil}').",
            id, LoginAdminInicial, Perfis.Admin);
    }

    public async Task ResetarAmbienteLocalAsync()
    {
        await using var con = await db.AbrirAsync();
        ValidarBancoLocal(con);
        await GarantirColunaFuncionarioOpcionalAsync(con);

        // Tabelas-filhas sem referências externas (TRUNCATE limpa e reinicia AUTO_INCREMENT sem disparar trigger BEFORE DELETE de pedido_logs)
        await con.ExecuteAsync("TRUNCATE TABLE pedido_logs;");
        await con.ExecuteAsync("TRUNCATE TABLE favoritos;");
        await con.ExecuteAsync("TRUNCATE TABLE recebimento_anexos;");

        // Limpeza em ordem reversa de dependência de chaves estrangeiras
        await con.ExecuteAsync("UPDATE movimentacoes_estoque SET movimentacao_estornada_id = NULL;");
        await con.ExecuteAsync("DELETE FROM movimentacoes_estoque; ALTER TABLE movimentacoes_estoque AUTO_INCREMENT = 1;");
        await con.ExecuteAsync("DELETE FROM pedido_itens; ALTER TABLE pedido_itens AUTO_INCREMENT = 1;");
        await con.ExecuteAsync("DELETE FROM pedidos; ALTER TABLE pedidos AUTO_INCREMENT = 1;");
        await con.ExecuteAsync("DELETE FROM documentos_recebimento; ALTER TABLE documentos_recebimento AUTO_INCREMENT = 1;");
        await con.ExecuteAsync("DELETE FROM recebimento_itens; ALTER TABLE recebimento_itens AUTO_INCREMENT = 1;");
        await con.ExecuteAsync("DELETE FROM recebimentos; ALTER TABLE recebimentos AUTO_INCREMENT = 1;");
        await con.ExecuteAsync("DELETE FROM produtos; ALTER TABLE produtos AUTO_INCREMENT = 1;");
        await con.ExecuteAsync("DELETE FROM usuarios; ALTER TABLE usuarios AUTO_INCREMENT = 1;");
        await con.ExecuteAsync("DELETE FROM funcionarios; ALTER TABLE funcionarios AUTO_INCREMENT = 1;");
        await con.ExecuteAsync("DELETE FROM setores; ALTER TABLE setores AUTO_INCREMENT = 1;");

        logger.LogInformation("Dados do banco local removidos preservando tabelas, índices, constraints e triggers.");

        await ExecutarAsync();
    }

    private static async Task GarantirColunaFuncionarioOpcionalAsync(MySqlConnection con)
    {
        var isNullable = await con.ExecuteScalarAsync<string?>("""
            SELECT IS_NULLABLE
              FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'usuarios'
               AND COLUMN_NAME = 'funcionario_id'
            """);
        if (string.Equals(isNullable, "NO", StringComparison.OrdinalIgnoreCase))
        {
            await con.ExecuteAsync("ALTER TABLE usuarios MODIFY COLUMN funcionario_id INT NULL;");
        }
    }

    private static void ValidarBancoLocal(MySqlConnection con)
    {
        var csb = new MySqlConnectionStringBuilder(con.ConnectionString);
        var host = (csb.Server ?? string.Empty).Trim().ToLowerInvariant();
        if (host is not ("127.0.0.1" or "localhost" or "::1" or "db"))
            throw new InvalidOperationException(
                $"Reset bloqueado por segurança: o servidor de banco '{csb.Server}' não é um ambiente local (127.0.0.1 / localhost).");
    }
}
