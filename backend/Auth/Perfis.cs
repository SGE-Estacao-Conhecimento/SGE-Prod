using System.Security.Claims;
using Sge.Api.Infrastructure;

namespace Sge.Api.Auth;

/// <summary>
/// Perfis gravados em usuarios.perfil e sua tradução para o vocabulário do front-end.
/// O contrato da API usa os nomes do front ('admin' | 'almoxarife' | 'usuario');
/// as políticas de autorização usam os valores do banco.
/// </summary>
public static class Perfis
{
    public const string Admin = "admin";
    public const string Almoxarifado = "almoxarifado";
    public const string Funcionario = "funcionario";

    /// <summary>Perfis da equipe interna (podem agir em nome de outros funcionários).</summary>
    public const string Equipe = Admin + "," + Almoxarifado;

    public static string ParaFront(string perfilBanco) => perfilBanco switch
    {
        Admin => "admin",
        Almoxarifado => "almoxarife",
        _ => "usuario"
    };

    /// <summary>Perfil enviado pelo front (vocabulário do front, rótulo da tela ou valor do banco) para o valor do banco.</summary>
    public static string? DoFront(string? perfil) => (perfil ?? string.Empty).Trim().ToLowerInvariant() switch
    {
        "admin" or "administrativo" => Admin,
        "almoxarife" or "almoxarifado" => Almoxarifado,
        "usuario" or "usuário" or "funcionario" => Funcionario,
        _ => null
    };
}

/// <summary>Dados do usuário autenticado extraídos do token.</summary>
public static class UsuarioAtual
{
    public const string ClaimFuncionario = "fid";
    public const string ClaimTrocaSenhaObrigatoria = "pwd_reset";

    public static int UsuarioId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue("sub"), out var id) ? id : throw new ApiException(401, "Sessão inválida.");

    public static int FuncionarioId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue(ClaimFuncionario), out var id) ? id : throw new ApiException(401, "Sessão inválida.");

    public static string Perfil(this ClaimsPrincipal user) => user.FindFirstValue("role") ?? string.Empty;

    public static bool EhEquipe(this ClaimsPrincipal user) =>
        user.Perfil() is Perfis.Admin or Perfis.Almoxarifado;
}
