using Dapper;
using Sge.Api.Infrastructure;

namespace Sge.Api.Auth;

public sealed class UsuarioAutenticacao
{
    public int UsuarioId { get; set; }
    public int FuncionarioId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string SenhaHash { get; set; } = string.Empty;
    public string Perfil { get; set; } = string.Empty;
    public bool Ativo { get; set; }
    public bool FuncionarioAtivo { get; set; }
    public string Setor { get; set; } = string.Empty;
}

public sealed class AuthRepository(DbConnectionFactory db)
{
    private const string SelectBase = """
        SELECT u.usuario_id, u.funcionario_id, f.nome, u.email, u.senha_hash, u.perfil,
               u.ativo, f.ativo AS funcionario_ativo, s.nome AS setor
          FROM usuarios u
          JOIN funcionarios f ON f.funcionario_id = u.funcionario_id
          JOIN setores s ON s.setor_id = f.setor_id
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

    public async Task AtualizarSenhaAsync(int usuarioId, string senhaHash)
    {
        await using var con = await db.AbrirAsync();
        await con.ExecuteAsync(
            "UPDATE usuarios SET senha_hash = @senhaHash WHERE usuario_id = @usuarioId", new { usuarioId, senhaHash });
    }
}
