using Dapper;
using MySqlConnector;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.DevSeed;

/// <summary>
/// Inicialização e reset do ambiente local de desenvolvimento:
/// - Garante de forma idempotente os usuários padrões iniciais:
///   * admin (login: admin / senha: admin / perfil: admin)
///   * almoxarife (login: almoxarife / senha: almoxarife / perfil: almoxarifado)
///   * usuario (login: usuario / senha: usuario / perfil: funcionario)
/// - Permite reset explícito do banco local (dotnet run -- reset-dev --confirm) preservando estrutura, FKs e triggers.
/// </summary>
public sealed class DevSeeder(DbConnectionFactory db, PasswordService senhas, ILogger<DevSeeder> logger)
{
    public const string LoginAdminInicial = "admin";
    public const string SenhaAdminInicial = "admin";

    public const string LoginAlmoxarifeInicial = "almoxarife";
    public const string SenhaAlmoxarifeInicial = "almoxarife";

    public const string LoginUsuarioInicial = "usuario";
    public const string SenhaUsuarioInicial = "usuario";

    public async Task ExecutarAsync()
    {
        await using var con = await db.AbrirAsync();
        await GarantirColunaFuncionarioOpcionalAsync(con);
        await GarantirColunaBemDuravelAsync(con);
        await GarantirColunaComplexoAsync(con);
        await GarantirColunaRecebimentoOrigemAsync(con);
        await GarantirColunaTrocaSenhaObrigatoriaAsync(con);

        var setorAdminId = await ObterOuCriarSetorAsync(con, "Administração");
        var setorAlmoxarifadoId = await ObterOuCriarSetorAsync(con, "Almoxarifado");
        var setorGeralId = await ObterOuCriarSetorAsync(con, "Geral");

        await GarantirUsuarioAsync(con, LoginAdminInicial, SenhaAdminInicial, Perfis.Admin, "Administrador", setorAdminId);
        await GarantirUsuarioAsync(con, LoginAlmoxarifeInicial, SenhaAlmoxarifeInicial, Perfis.Almoxarifado, "Almoxarife", setorAlmoxarifadoId);
        await GarantirUsuarioAsync(con, LoginUsuarioInicial, SenhaUsuarioInicial, Perfis.Funcionario, "Usuário", setorGeralId);
    }

    private async Task GarantirUsuarioAsync(
        MySqlConnection con,
        string login,
        string senha,
        string perfil,
        string nomeFuncionario,
        int setorId)
    {
        var usuarioExistente = await con.QuerySingleOrDefaultAsync<UsuarioSeedInfo>("""
            SELECT u.usuario_id AS UsuarioId,
                   u.funcionario_id AS FuncionarioId,
                   u.perfil AS Perfil,
                   u.ativo AS Ativo
              FROM usuarios u
             WHERE u.email = @login
             LIMIT 1
            """, new { login });

        if (usuarioExistente is not null)
        {
            if (usuarioExistente.FuncionarioId is null or 0)
            {
                var funcionarioId = await con.ExecuteScalarAsync<int>("""
                    INSERT INTO funcionarios (nome, setor_id, cpf, celular, ativo)
                    VALUES (@nomeFuncionario, @setorId, NULL, NULL, TRUE);
                    SELECT LAST_INSERT_ID();
                    """, new { nomeFuncionario, setorId });

                await con.ExecuteAsync(
                    "UPDATE usuarios SET funcionario_id = @funcionarioId WHERE usuario_id = @usuarioId",
                    new { funcionarioId, usuarioId = usuarioExistente.UsuarioId });

                logger.LogInformation("Funcionário '{Nome}' vinculado ao usuário existente '{Login}' (id={Id}).",
                    nomeFuncionario, login, usuarioExistente.UsuarioId);
            }
            else
            {
                logger.LogInformation("Usuário inicial '{Login}' já existe (id={Id}, perfil={Perfil}).",
                    login, usuarioExistente.UsuarioId, usuarioExistente.Perfil);
            }
            return;
        }

        var novoFuncionarioId = await con.ExecuteScalarAsync<int>("""
            INSERT INTO funcionarios (nome, setor_id, cpf, celular, ativo)
            VALUES (@nomeFuncionario, @setorId, NULL, NULL, TRUE);
            SELECT LAST_INSERT_ID();
            """, new { nomeFuncionario, setorId });

        var hash = senhas.Hash(senha);
        var id = await con.ExecuteScalarAsync<int>("""
            INSERT INTO usuarios (funcionario_id, email, senha_hash, perfil, ativo)
            VALUES (@novoFuncionarioId, @login, @hash, @perfil, TRUE);
            SELECT LAST_INSERT_ID();
            """, new { novoFuncionarioId, login, hash, perfil });

        logger.LogInformation("Usuário inicial criado com sucesso (id={Id}, login='{Login}', perfil='{Perfil}', funcionário='{Nome}').",
            id, login, perfil, nomeFuncionario);
    }

    private static async Task<int> ObterOuCriarSetorAsync(MySqlConnection con, string nome)
    {
        var id = await con.ExecuteScalarAsync<int?>(
            "SELECT setor_id FROM setores WHERE nome = @nome LIMIT 1", new { nome });

        if (id is not null)
            return id.Value;

        return await con.ExecuteScalarAsync<int>("""
            INSERT INTO setores (nome, ativo) VALUES (@nome, TRUE);
            SELECT LAST_INSERT_ID();
            """, new { nome });
    }

    public async Task ResetarAmbienteLocalAsync()
    {
        await using var con = await db.AbrirAsync();
        ValidarBancoLocal(con);
        await GarantirColunaFuncionarioOpcionalAsync(con);
        await GarantirColunaBemDuravelAsync(con);
        await GarantirColunaComplexoAsync(con);
        await GarantirColunaRecebimentoOrigemAsync(con);
        await GarantirColunaTrocaSenhaObrigatoriaAsync(con);

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

    private static async Task GarantirColunaBemDuravelAsync(MySqlConnection con)
    {
        var existe = await con.ExecuteScalarAsync<int>("""
            SELECT COUNT(*)
              FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'produtos'
               AND COLUMN_NAME = 'bem_duravel'
            """);
        if (existe == 0)
        {
            await con.ExecuteAsync("""
                ALTER TABLE produtos
                    ADD COLUMN bem_duravel BOOLEAN NOT NULL DEFAULT FALSE AFTER permite_fracao;
                """);
        }
    }

    private static async Task GarantirColunaTrocaSenhaObrigatoriaAsync(MySqlConnection con)
    {
        var existe = await con.ExecuteScalarAsync<int>("""
            SELECT COUNT(*)
              FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'usuarios'
               AND COLUMN_NAME = 'troca_senha_obrigatoria'
            """);
        if (existe == 0)
        {
            await con.ExecuteAsync("""
                ALTER TABLE usuarios
                    ADD COLUMN troca_senha_obrigatoria BOOLEAN NOT NULL DEFAULT FALSE AFTER ativo;
                """);
        }
    }

    private static async Task GarantirColunaComplexoAsync(MySqlConnection con)
    {
        var existe = await con.ExecuteScalarAsync<int>("""
            SELECT COUNT(*)
              FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'produtos'
               AND COLUMN_NAME = 'complexo'
            """);
        if (existe == 0)
        {
            await con.ExecuteAsync("""
                ALTER TABLE produtos
                    ADD COLUMN complexo VARCHAR(100) NOT NULL DEFAULT 'Almoxarifado Central' AFTER unidade_medida;
                """);
        }
    }

    private static async Task GarantirColunaRecebimentoOrigemAsync(MySqlConnection con)
    {
        var existe = await con.ExecuteScalarAsync<int>("""
            SELECT COUNT(*)
              FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'recebimentos'
               AND COLUMN_NAME = 'recebimento_origem_id'
            """);
        if (existe == 0)
        {
            await con.ExecuteAsync("""
                ALTER TABLE recebimentos
                    ADD COLUMN recebimento_origem_id INT NULL AFTER identificador_operacao,
                    ADD CONSTRAINT fk_recebimentos_origem FOREIGN KEY (recebimento_origem_id) REFERENCES recebimentos(recebimento_id) ON DELETE RESTRICT,
                    ADD INDEX idx_recebimento_origem (recebimento_origem_id);
                """);
        }

        var existeTrigger = await con.ExecuteScalarAsync<int>("""
            SELECT COUNT(*)
              FROM INFORMATION_SCHEMA.TRIGGERS
             WHERE TRIGGER_SCHEMA = DATABASE()
               AND TRIGGER_NAME = 'trg_recebimentos_exige_foto'
            """);
        if (existeTrigger == 0)
        {
            await con.ExecuteAsync("""
                CREATE TRIGGER trg_recebimentos_exige_foto
                BEFORE UPDATE ON recebimentos
                FOR EACH ROW
                BEGIN
                    IF NEW.status = 'confirmado' AND OLD.status <> 'confirmado' THEN
                        IF NOT EXISTS (
                            SELECT 1 FROM recebimento_anexos
                             WHERE (recebimento_id = OLD.recebimento_id
                                    OR (OLD.recebimento_origem_id IS NOT NULL AND recebimento_id = OLD.recebimento_origem_id))
                               AND categoria = 'foto_material'
                               AND status = 'confirmado'
                        ) THEN
                            SIGNAL SQLSTATE '45000'
                                SET MESSAGE_TEXT = 'Recebimento exige ao menos uma foto do material confirmada.';
                        END IF;
                    END IF;
                END;
                """);
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

    private sealed record UsuarioSeedInfo(int UsuarioId, int? FuncionarioId, string Perfil, bool Ativo);
}
