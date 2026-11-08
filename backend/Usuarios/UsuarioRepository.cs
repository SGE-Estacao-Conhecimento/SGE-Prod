using Dapper;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.Usuarios;

/// <summary>Usuários (usuarios) e seus dados de funcionário (funcionarios).</summary>
public sealed class UsuarioRepository(DbConnectionFactory db, AppClock relogio) : RepositorioBase(db)
{
    public sealed record DadosUsuario(
        string Nome, string Cpf, string? Email, string Perfil, int SetorId, string? Celular, bool Ativo);

    public sealed class UsuarioAtual
    {
        public int UsuarioId { get; set; }
        public int FuncionarioId { get; set; }
        public string Perfil { get; set; } = string.Empty;
        public bool Ativo { get; set; }
    }

    private sealed class UsuarioLinha
    {
        public int UsuarioId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string? Cpf { get; set; }
        public string? Email { get; set; }
        public string Perfil { get; set; } = string.Empty;
        public string Setor { get; set; } = string.Empty;
        public bool Ativo { get; set; }
        public string? Celular { get; set; }
        public DateTime DataCriacao { get; set; }
    }

    private const string SelectUsuarios = """
        SELECT u.usuario_id, f.nome, f.cpf, u.email, u.perfil, s.nome AS setor,
               (u.ativo AND f.ativo) AS ativo, f.celular, u.data_criacao
          FROM usuarios u
          JOIN funcionarios f ON f.funcionario_id = u.funcionario_id
          JOIN setores s ON s.setor_id = f.setor_id
        """;

    public async Task<IReadOnlyList<UsuarioDto>> ListarAsync()
    {
        await using var con = await AbrirAsync();
        var linhas = await con.QueryAsync<UsuarioLinha>(SelectUsuarios + " ORDER BY f.nome");
        return linhas.Select(Montar).ToList();
    }

    public async Task<UsuarioDto?> ObterAsync(Transacao t, int usuarioId)
    {
        var linha = await t.Conexao.QuerySingleOrDefaultAsync<UsuarioLinha>(
            SelectUsuarios + " WHERE u.usuario_id = @usuarioId", new { usuarioId }, t.Tx);
        return linha is null ? null : Montar(linha);
    }

    /// <summary>Bloqueia o usuário para alteração. "Ativo" considera usuário e funcionário.</summary>
    public Task<UsuarioAtual?> BloquearAsync(Transacao t, int usuarioId) =>
        t.Conexao.QuerySingleOrDefaultAsync<UsuarioAtual>("""
            SELECT u.usuario_id, u.funcionario_id, u.perfil, (u.ativo AND f.ativo) AS ativo
              FROM usuarios u JOIN funcionarios f ON f.funcionario_id = u.funcionario_id
             WHERE u.usuario_id = @usuarioId
               FOR UPDATE
            """, new { usuarioId }, t.Tx);

    /// <summary>
    /// Administradores ativos, com as linhas bloqueadas até o fim da transação: duas alterações
    /// simultâneas não conseguem, juntas, deixar o sistema sem administrador.
    /// </summary>
    public async Task<IReadOnlyList<int>> BloquearAdministradoresAtivosAsync(Transacao t) =>
        (await t.Conexao.QueryAsync<int>("""
            SELECT u.usuario_id
              FROM usuarios u JOIN funcionarios f ON f.funcionario_id = u.funcionario_id
             WHERE u.perfil = 'admin' AND u.ativo = TRUE AND f.ativo = TRUE
             ORDER BY u.usuario_id
               FOR UPDATE
            """, transaction: t.Tx)).ToList();

    public Task<int?> SetorAtivoPorNomeAsync(Transacao t, string nome) =>
        t.Conexao.ExecuteScalarAsync<int?>(
            "SELECT setor_id FROM setores WHERE nome = @nome AND ativo = TRUE", new { nome }, t.Tx);

    public async Task<bool> CpfEmUsoAsync(Transacao t, string cpf, int? excetoUsuarioId) =>
        await t.Conexao.ExecuteScalarAsync<int>("""
            SELECT COUNT(*) FROM funcionarios f LEFT JOIN usuarios u ON u.funcionario_id = f.funcionario_id
             WHERE f.cpf = @cpf AND (@excetoUsuarioId IS NULL OR u.usuario_id IS NULL OR u.usuario_id <> @excetoUsuarioId)
            """, new { cpf, excetoUsuarioId }, t.Tx) > 0;

    public async Task<bool> EmailEmUsoAsync(Transacao t, string email, int? excetoUsuarioId) =>
        await t.Conexao.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM usuarios WHERE email = @email AND (@excetoUsuarioId IS NULL OR usuario_id <> @excetoUsuarioId)",
            new { email, excetoUsuarioId }, t.Tx) > 0;

    public async Task<int> InserirAsync(Transacao t, DadosUsuario d, string senhaHash)
    {
        var funcionarioId = await t.Conexao.ExecuteScalarAsync<int>("""
            INSERT INTO funcionarios (nome, setor_id, cpf, celular, ativo)
            VALUES (@Nome, @SetorId, @Cpf, @Celular, @Ativo);
            SELECT LAST_INSERT_ID();
            """, d, t.Tx);
        return await t.Conexao.ExecuteScalarAsync<int>("""
            INSERT INTO usuarios (funcionario_id, email, senha_hash, perfil, ativo)
            VALUES (@funcionarioId, @Email, @senhaHash, @Perfil, @Ativo);
            SELECT LAST_INSERT_ID();
            """, new { funcionarioId, d.Email, senhaHash, d.Perfil, d.Ativo }, t.Tx);
    }

    public async Task AtualizarAsync(Transacao t, UsuarioAtual atual, DadosUsuario d)
    {
        await t.Conexao.ExecuteAsync("""
            UPDATE funcionarios SET nome = @Nome, setor_id = @SetorId, cpf = @Cpf, celular = @Celular, ativo = @Ativo
             WHERE funcionario_id = @funcionarioId
            """, new { d.Nome, d.SetorId, d.Cpf, d.Celular, d.Ativo, funcionarioId = atual.FuncionarioId }, t.Tx);
        await t.Conexao.ExecuteAsync(
            "UPDATE usuarios SET email = @Email, perfil = @Perfil, ativo = @Ativo WHERE usuario_id = @usuarioId",
            new { d.Email, d.Perfil, d.Ativo, usuarioId = atual.UsuarioId }, t.Tx);
    }

    public Task DefinirSenhaAsync(Transacao t, int usuarioId, string senhaHash) =>
        t.Conexao.ExecuteAsync("UPDATE usuarios SET senha_hash = @senhaHash WHERE usuario_id = @usuarioId",
            new { usuarioId, senhaHash }, t.Tx);

    /// <summary>Ativa ou desativa usuário e funcionário juntos (na tela é um único status).</summary>
    public async Task DefinirAtivoAsync(Transacao t, UsuarioAtual atual, bool ativo)
    {
        await t.Conexao.ExecuteAsync("UPDATE usuarios SET ativo = @ativo WHERE usuario_id = @id",
            new { ativo, id = atual.UsuarioId }, t.Tx);
        await t.Conexao.ExecuteAsync("UPDATE funcionarios SET ativo = @ativo WHERE funcionario_id = @id",
            new { ativo, id = atual.FuncionarioId }, t.Tx);
    }

    private UsuarioDto Montar(UsuarioLinha u) => new(
        u.UsuarioId, u.Nome, u.Cpf, u.Email, Perfis.ParaFront(u.Perfil), u.Setor, u.Ativo, u.Celular,
        u.Nome.Trim().Length > 0 ? u.Nome.Trim()[..1].ToUpperInvariant() : "U",
        relogio.DataCurta(u.DataCriacao));
}
