using Dapper;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.Usuarios;

public sealed class UsuarioRepository(DbConnectionFactory db, AppClock relogio) : RepositorioBase(db)
{
    private sealed class UsuarioLinha
    {
        public int UsuarioId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Perfil { get; set; } = string.Empty;
        public string Setor { get; set; } = string.Empty;
        public bool Ativo { get; set; }
        public string? Celular { get; set; }
        public DateTime DataCriacao { get; set; }
    }

    public async Task<IReadOnlyList<UsuarioDto>> ListarAsync()
    {
        await using var con = await AbrirAsync();
        var linhas = await con.QueryAsync<UsuarioLinha>("""
            SELECT u.usuario_id, f.nome, u.email, u.perfil, s.nome AS setor,
                   (u.ativo AND f.ativo) AS ativo, f.celular, u.data_criacao
              FROM usuarios u
              JOIN funcionarios f ON f.funcionario_id = u.funcionario_id
              JOIN setores s ON s.setor_id = f.setor_id
             ORDER BY f.nome
            """);

        return linhas.Select(u => new UsuarioDto(
            u.UsuarioId, u.Nome, u.Email, Perfis.ParaFront(u.Perfil), u.Setor, u.Ativo, u.Celular,
            u.Nome.Trim().Length > 0 ? u.Nome.Trim()[..1].ToUpperInvariant() : "U",
            relogio.DataCurta(u.DataCriacao))).ToList();
    }
}
