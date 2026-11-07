using Microsoft.AspNetCore.Identity;

namespace Sge.Api.Auth;

/// <summary>
/// Hash de senhas com o algoritmo padrão do ASP.NET Core Identity (PBKDF2 com salt).
/// </summary>
public sealed class PasswordService
{
    public const int TamanhoMinimo = 6; // mesma regra da tela "Alterar senha"
    public const int TamanhoMaximo = 128;

    private static readonly object Dono = new();
    private readonly PasswordHasher<object> _hasher = new();
    private readonly string _hashFicticio;

    public PasswordService() => _hashFicticio = _hasher.HashPassword(Dono, Guid.NewGuid().ToString());

    public string Hash(string senha) => _hasher.HashPassword(Dono, senha);

    public PasswordVerificationResult Verificar(string hash, string senha) =>
        _hasher.VerifyHashedPassword(Dono, hash, senha);

    /// <summary>Gasta o mesmo tempo de uma verificação real quando o usuário não existe.</summary>
    public void SimularVerificacao(string senha) => _hasher.VerifyHashedPassword(Dono, _hashFicticio, senha);
}
