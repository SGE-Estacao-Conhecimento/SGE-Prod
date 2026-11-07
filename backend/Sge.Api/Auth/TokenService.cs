using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Sge.Api.Auth;

public sealed class JwtOptions
{
    public string Key { get; set; } = string.Empty;
    public string Issuer { get; set; } = "sge-api";
    public string Audience { get; set; } = "sge-frontend";
    public int ExpiracaoHoras { get; set; } = 8;
    public int ExpiracaoLembrarDias { get; set; } = 7;

    public SymmetricSecurityKey ChaveAssinatura() => new(Encoding.UTF8.GetBytes(Key));
}

public sealed class TokenService(JwtOptions options)
{
    public (string Token, DateTime ExpiraEm) Gerar(UsuarioAutenticacao usuario, bool lembrar)
    {
        var expira = lembrar
            ? DateTime.UtcNow.AddDays(options.ExpiracaoLembrarDias)
            : DateTime.UtcNow.AddHours(options.ExpiracaoHoras);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, usuario.UsuarioId.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim("name", usuario.Nome),
            new Claim("role", usuario.Perfil),
            new Claim(UsuarioAtual.ClaimFuncionario, usuario.FuncionarioId.ToString())
        };

        var token = new JwtSecurityToken(
            issuer: options.Issuer,
            audience: options.Audience,
            claims: claims,
            expires: expira,
            signingCredentials: new SigningCredentials(options.ChaveAssinatura(), SecurityAlgorithms.HmacSha256));

        return (new JwtSecurityTokenHandler().WriteToken(token), expira);
    }
}
