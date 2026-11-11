using Dapper;
using Sge.Api.Infrastructure;

namespace Sge.Api.Auth;

public sealed class UsuarioAutenticacao
{
    public int UsuarioId { get; set; }
    public int FuncionarioId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string SenhaHash { get; set; } = string.Empty;
    public string Perfil { get; set; } = string.Empty;
    public bool Ativo { get; set; }
    public bool TrocaSenhaObrigatoria { get; set; }
    public bool FuncionarioAtivo { get; set; }
    public string Setor { get; set; } = string.Empty;
}

public sealed class AuthRepository(DbConnectionFactory db)
{
    private const string SelectBase = """
        SELECT u.usuario_id,
               COALESCE(u.funcionario_id, 0) AS funcionario_id,
               COALESCE(f.nome, 'Administrador') AS nome,
               u.email,
               u.senha_hash,
               u.perfil,
               u.ativo,
               u.troca_senha_obrigatoria,
               COALESCE(f.ativo, TRUE) AS funcionario_ativo,
               COALESCE(s.nome, 'Administração') AS setor
          FROM usuarios u
          LEFT JOIN funcionarios f ON f.funcionario_id = u.funcionario_id
          LEFT JOIN setores s ON s.setor_id = f.setor_id
        """;

    public async Task<UsuarioAutenticacao?> BuscarPorEmailAsync(string email)
    {
        await using var con = await db.AbrirAsync();
        return await con.QuerySingleOrDefaultAsync<UsuarioAutenticacao>(
            SelectBase + " WHERE u.email = @email", new { email });
    }

    public async Task<UsuarioAutenticacao?> BuscarPorCpfAsync(string cpf)
    {
        await using var con = await db.AbrirAsync();
        return await con.QuerySingleOrDefaultAsync<UsuarioAutenticacao>(
            SelectBase + " WHERE f.cpf = @cpf", new { cpf });
    }

    public async Task<UsuarioAutenticacao?> BuscarPorIdAsync(int usuarioId)
    {
        await using var con = await db.AbrirAsync();
        return await con.QuerySingleOrDefaultAsync<UsuarioAutenticacao>(
            SelectBase + " WHERE u.usuario_id = @usuarioId", new { usuarioId });
    }

    public async Task RegistrarLoginAsync(int usuarioId)
    {
        await using var con = await db.AbrirAsync();
        await con.ExecuteAsync(
            "UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP(6) WHERE usuario_id = @usuarioId", new { usuarioId });
    }

    public async Task RehashSenhaAsync(int usuarioId, string senhaHash)
    {
        await using var con = await db.AbrirAsync();
        await con.ExecuteAsync(
            "UPDATE usuarios SET senha_hash = @senhaHash WHERE usuario_id = @usuarioId", new { usuarioId, senhaHash });
    }

    public async Task AtualizarSenhaAsync(int usuarioId, string senhaHash)
    {
        await using var con = await db.AbrirAsync();
        await con.ExecuteAsync(
            "UPDATE usuarios SET senha_hash = @senhaHash, troca_senha_obrigatoria = FALSE WHERE usuario_id = @usuarioId",
            new { usuarioId, senhaHash });
    }

    public async Task<bool> EmailEmUsoAsync(string email, int excetoUsuarioId)
    {
        await using var con = await db.AbrirAsync();
        return await con.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM usuarios WHERE email = @email AND usuario_id <> @excetoUsuarioId",
            new { email, excetoUsuarioId }) > 0;
    }

    public async Task AtualizarEmailAsync(int usuarioId, string email)
    {
        await using var con = await db.AbrirAsync();
        await con.ExecuteAsync(
            "UPDATE usuarios SET email = @email WHERE usuario_id = @usuarioId", new { usuarioId, email });
    }
}
