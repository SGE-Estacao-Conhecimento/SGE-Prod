using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Sge.Api.Infrastructure;

namespace Sge.Api.Auth;

/// <summary>Corpo enviado por authService.login: o campo "email" carrega e-mail ou CPF.</summary>
public sealed record LoginRequest(string? Email, string? Senha, bool Lembrar = false);

public sealed record LoginResponse(
    int Id,
    string Nome,
    string? Email,
    string Identifier,
    string Role,
    string Setor,
    string Token,
    DateTime ExpiraEm,
    bool PrecisaTrocarSenha = false);

public sealed record AlterarSenhaRequest(string? SenhaAtual, string? NovaSenha, bool Lembrar = false);

public sealed record AtualizarEmailRequest(string? Email, string? SenhaAtual);

public sealed record AtualizarEmailResponse(string Email, string Identifier);

[ApiController]
[Route("api/auth")]
public sealed class AuthController(AuthRepository repo, PasswordService senhas, TokenService tokens) : ControllerBase
{
    private static readonly ApiException CredenciaisInvalidas = new(401, "E-mail/CPF ou senha inválidos.");

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<LoginResponse> Login(LoginRequest req)
    {
        var identificador = (req.Email ?? string.Empty).Trim();
        var senha = req.Senha ?? string.Empty;
        if (identificador.Length == 0 || senha.Length == 0)
            throw ApiException.BadRequest("Informe o e-mail ou CPF e a senha.");

        var cpf = new string(identificador.Where(char.IsDigit).ToArray());
        var usuario = !identificador.Contains('@') && cpf.Length == 11
            ? await repo.BuscarPorCpfAsync(cpf)
            : await repo.BuscarPorEmailAsync(identificador);

        if (usuario is null)
        {
            senhas.SimularVerificacao(senha);
            throw CredenciaisInvalidas;
        }

        var resultado = senhas.Verificar(usuario.SenhaHash, senha);
        if (resultado == PasswordVerificationResult.Failed)
            throw CredenciaisInvalidas;

        if (!usuario.Ativo || !usuario.FuncionarioAtivo)
            throw ApiException.Forbidden("Conta inativa. Procure a administração.");

        if (resultado == PasswordVerificationResult.SuccessRehashNeeded)
            await repo.RehashSenhaAsync(usuario.UsuarioId, senhas.Hash(senha));

        await repo.RegistrarLoginAsync(usuario.UsuarioId);
        var (token, expiraEm) = tokens.Gerar(usuario, req.Lembrar);

        // Sem e-mail (opcional), a tela identifica o usuário pelo nome.
        return new LoginResponse(usuario.UsuarioId, usuario.Nome, usuario.Email, usuario.Email ?? usuario.Nome,
            Perfis.ParaFront(usuario.Perfil), usuario.Setor, token, expiraEm, usuario.TrocaSenhaObrigatoria);
    }

    /// <summary>O token é sem estado: o encerramento da sessão é feito no front, apagando o token.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    public NoContentResult Logout() => NoContent();

    [HttpPost("alterar-senha")]
    public async Task<ActionResult<LoginResponse>> AlterarSenha(AlterarSenhaRequest req)
    {
        var atual = req.SenhaAtual ?? string.Empty;
        var nova = req.NovaSenha ?? string.Empty;
        if (atual.Length == 0)
            throw ApiException.BadRequest("Informe sua senha atual para autorizar a alteração.");
        if (nova.Trim().Length == 0)
            throw ApiException.BadRequest("Informe a nova senha desejada.");
        if (nova.Length < PasswordService.TamanhoMinimo || nova.Length > PasswordService.TamanhoMaximo)
            throw ApiException.BadRequest($"A nova senha deve possuir entre {PasswordService.TamanhoMinimo} e {PasswordService.TamanhoMaximo} caracteres.");
        if (string.Equals(nova, atual, StringComparison.Ordinal))
            throw ApiException.BadRequest("A nova senha deve ser diferente da senha atual.");

        var usuario = await repo.BuscarPorIdAsync(User.UsuarioId()) ?? throw new ApiException(401, "Sessão inválida.");
        if (senhas.Verificar(usuario.SenhaHash, atual) == PasswordVerificationResult.Failed)
            throw ApiException.BadRequest("A senha atual não confere.");

        await repo.AtualizarSenhaAsync(usuario.UsuarioId, senhas.Hash(nova));
        usuario.TrocaSenhaObrigatoria = false;
        var (token, expiraEm) = tokens.Gerar(usuario, req.Lembrar);

        return Ok(new LoginResponse(
            usuario.UsuarioId,
            usuario.Nome,
            usuario.Email,
            usuario.Email ?? usuario.Nome,
            Perfis.ParaFront(usuario.Perfil),
            usuario.Setor,
            token,
            expiraEm,
            PrecisaTrocarSenha: false));
    }

    [HttpPatch("email")]
    public async Task<ActionResult<AtualizarEmailResponse>> AtualizarEmail(AtualizarEmailRequest req)
    {
        var email = (req.Email ?? string.Empty).Trim().ToLowerInvariant();
        var senhaAtual = req.SenhaAtual ?? string.Empty;

        if (email.Length == 0)
        {
            throw ApiException.BadRequest("Informe o e-mail desejado.",
                new Dictionary<string, string[]> { ["email"] = ["Informe o e-mail desejado."] });
        }
        if (email.Length > 150 || !Validadores.EmailValido(email))
        {
            throw ApiException.BadRequest("Informe um e-mail válido.",
                new Dictionary<string, string[]> { ["email"] = ["Informe um e-mail válido."] });
        }
        if (senhaAtual.Length == 0)
        {
            throw ApiException.BadRequest("Informe sua senha atual para confirmar a alteração.",
                new Dictionary<string, string[]> { ["senhaAtual"] = ["Informe sua senha atual para confirmar a alteração."] });
        }

        var usuario = await repo.BuscarPorIdAsync(User.UsuarioId()) ?? throw new ApiException(401, "Sessão inválida.");
        if (senhas.Verificar(usuario.SenhaHash, senhaAtual) == PasswordVerificationResult.Failed)
        {
            throw ApiException.BadRequest("A senha atual não confere.",
                new Dictionary<string, string[]> { ["senhaAtual"] = ["A senha atual não confere."] });
        }

        if (await repo.EmailEmUsoAsync(email, usuario.UsuarioId))
        {
            throw new ApiException(409, "Já existe um usuário com este e-mail.",
                new Dictionary<string, string[]> { ["email"] = ["E-mail já cadastrado."] });
        }

        await repo.AtualizarEmailAsync(usuario.UsuarioId, email);
        return Ok(new AtualizarEmailResponse(email, email));
    }
}

/// <summary>
/// Recuperação de senha por e-mail: depende de um serviço de envio de e-mail ainda não definido.
/// Responde 501 com mensagem clara em vez de simular sucesso.
/// </summary>
[ApiController]
[Route("api/password-reset")]
[AllowAnonymous]
public sealed class PasswordResetController : ControllerBase
{
    private static ApiException Indisponivel() =>
        new(501, "A recuperação de senha por e-mail ainda não está disponível. Procure a administração.");

    [HttpPost("request")]
    public IActionResult Solicitar() => throw Indisponivel();

    [HttpPost("confirm")]
    public IActionResult Confirmar() => throw Indisponivel();
}
