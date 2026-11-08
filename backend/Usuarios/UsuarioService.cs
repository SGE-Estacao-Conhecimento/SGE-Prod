using System.Net.Mail;
using System.Security.Claims;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.Usuarios;

/// <summary>
/// Gerenciamento de usuários pela administração (tela "Gerenciamento de Usuários").
/// Decisões de 07/11/2026: e-mail opcional; excluir = desativar (o histórico é preservado);
/// o sistema não pode ficar sem nenhum administrador ativo; senha com no mínimo 8 caracteres.
/// </summary>
public sealed class UsuarioService(DbConnectionFactory db, UsuarioRepository usuarios, PasswordService senhas)
{
    /// <summary>A administração vê o CPF (busca e edição); o almoxarifado recebe a lista sem CPF.</summary>
    public async Task<IReadOnlyList<UsuarioDto>> ListarAsync(ClaimsPrincipal usuario)
    {
        var lista = await usuarios.ListarAsync();
        return usuario.Perfil() == Perfis.Admin ? lista : lista.Select(u => u with { Cpf = null }).ToList();
    }

    public async Task<UsuarioDto> CriarAsync(SalvarUsuarioRequest req)
    {
        var senha = req.Senha ?? string.Empty;
        if (senha.Length == 0)
            throw ApiException.BadRequest("A senha de acesso é obrigatória no cadastro.",
                new Dictionary<string, string[]> { ["senha"] = ["A senha de acesso é obrigatória no cadastro."] });
        ValidarSenha(senha);

        await using var t = await Transacao.IniciarAsync(db);
        var dados = await ValidarAsync(t, req, usuarioId: null, ativoAtual: true);

        var id = await usuarios.InserirAsync(t, dados, senhas.Hash(senha));
        var criado = await usuarios.ObterAsync(t, id);
        await t.ConfirmarAsync();
        return criado!;
    }

    public async Task<UsuarioDto> EditarAsync(int usuarioId, SalvarUsuarioRequest req)
    {
        var novaSenha = string.IsNullOrEmpty(req.Senha) ? null : req.Senha;
        if (novaSenha is not null) ValidarSenha(novaSenha);

        await using var t = await Transacao.IniciarAsync(db);
        var (atual, administradores) = await BloquearAsync(t, usuarioId);
        var dados = await ValidarAsync(t, req, usuarioId, atual.Ativo);

        GarantirAdministradorAtivo(atual, administradores, dados.Perfil, dados.Ativo);
        await usuarios.AtualizarAsync(t, atual, dados);
        if (novaSenha is not null)
            await usuarios.DefinirSenhaAsync(t, usuarioId, senhas.Hash(novaSenha));

        var editado = await usuarios.ObterAsync(t, usuarioId);
        await t.ConfirmarAsync();
        return editado!;
    }

    /// <summary>Alterna entre ativo e inativo (botão de status da tabela).</summary>
    public async Task<UsuarioDto> AlternarStatusAsync(int usuarioId)
    {
        await using var t = await Transacao.IniciarAsync(db);
        var (atual, administradores) = await BloquearAsync(t, usuarioId);
        return await DefinirAtivoAsync(t, atual, administradores, !atual.Ativo);
    }

    /// <summary>"Excluir usuário": desativa a conta. Pedidos e movimentações continuam no histórico.</summary>
    public async Task<UsuarioDto> RemoverAsync(int usuarioId)
    {
        await using var t = await Transacao.IniciarAsync(db);
        var (atual, administradores) = await BloquearAsync(t, usuarioId);
        return await DefinirAtivoAsync(t, atual, administradores, false);
    }

    /// <summary>
    /// Bloqueia primeiro os administradores ativos (sempre na mesma ordem) e depois o usuário alterado.
    /// A ordem fixa evita travamento mútuo entre duas alterações simultâneas.
    /// </summary>
    private async Task<(UsuarioRepository.UsuarioAtual Atual, IReadOnlyList<int> Administradores)> BloquearAsync(Transacao t, int usuarioId)
    {
        var administradores = await usuarios.BloquearAdministradoresAtivosAsync(t);
        var atual = await usuarios.BloquearAsync(t, usuarioId) ?? throw ApiException.NotFound("Usuário não encontrado.");
        return (atual, administradores);
    }

    private async Task<UsuarioDto> DefinirAtivoAsync(Transacao t, UsuarioRepository.UsuarioAtual atual, IReadOnlyList<int> administradores, bool ativo)
    {
        GarantirAdministradorAtivo(atual, administradores, atual.Perfil, ativo);
        await usuarios.DefinirAtivoAsync(t, atual, ativo);
        var dto = await usuarios.ObterAsync(t, atual.UsuarioId);
        await t.ConfirmarAsync();
        return dto!;
    }

    /// <summary>Recusa a alteração que deixaria o sistema sem nenhum administrador ativo.</summary>
    private static void GarantirAdministradorAtivo(UsuarioRepository.UsuarioAtual atual, IReadOnlyList<int> administradores,
        string novoPerfil, bool novoAtivo)
    {
        var deixaDeSerAdminAtivo = atual.Perfil == Perfis.Admin && atual.Ativo && (novoPerfil != Perfis.Admin || !novoAtivo);
        if (!deixaDeSerAdminAtivo) return;

        if (administradores.All(id => id == atual.UsuarioId))
            throw ApiException.Conflict(
                "O sistema precisa de pelo menos um administrador ativo. Cadastre ou ative outro administrador antes desta alteração.");
    }

    private async Task<UsuarioRepository.DadosUsuario> ValidarAsync(
        Transacao t, SalvarUsuarioRequest req, int? usuarioId, bool ativoAtual)
    {
        var erros = new Dictionary<string, string[]>();

        var nome = string.IsNullOrWhiteSpace(req.Nome) ? null : req.Nome.Trim();
        if (nome is null) erros["nome"] = ["Nome completo é obrigatório."];
        else if (nome.Length > 100) erros["nome"] = ["O nome pode ter no máximo 100 caracteres."];

        var cpf = new string((req.Cpf ?? string.Empty).Where(char.IsDigit).ToArray());
        if (cpf.Length == 0) erros["cpf"] = ["CPF é obrigatório."];
        else if (cpf.Length != 11) erros["cpf"] = ["CPF deve conter 11 dígitos."];

        var email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim().ToLowerInvariant();
        if (email is not null && (email.Length > 150 || !EmailValido(email)))
            erros["email"] = ["Informe um e-mail válido."];

        var perfil = Perfis.DoFront(req.Perfil);
        if (perfil is null) erros["perfil"] = ["Perfil de acesso inválido."];

        var setorNome = string.IsNullOrWhiteSpace(req.Setor) ? null : req.Setor.Trim();
        if (setorNome is null) erros["setor"] = ["Informe o setor."];

        var celular = string.IsNullOrWhiteSpace(req.Celular) ? null : req.Celular.Trim();
        if (celular?.Length > 20) erros["celular"] = ["O celular pode ter no máximo 20 caracteres."];

        if (erros.Count > 0)
            throw ApiException.BadRequest(erros.First().Value[0], erros);

        var setorId = await usuarios.SetorAtivoPorNomeAsync(t, setorNome!)
            ?? throw new ApiException(422, $"O setor \"{setorNome}\" não está cadastrado.",
                new Dictionary<string, string[]> { ["setor"] = ["Setor não cadastrado."] });
        if (await usuarios.CpfEmUsoAsync(t, cpf, usuarioId))
            throw new ApiException(409, "Já existe um usuário com este CPF.",
                new Dictionary<string, string[]> { ["cpf"] = ["CPF já cadastrado."] });
        if (email is not null && await usuarios.EmailEmUsoAsync(t, email, usuarioId))
            throw new ApiException(409, "Já existe um usuário com este e-mail.",
                new Dictionary<string, string[]> { ["email"] = ["E-mail já cadastrado."] });

        return new UsuarioRepository.DadosUsuario(nome!, cpf, email, perfil!, setorId, celular, req.Ativo ?? ativoAtual);
    }

    private static void ValidarSenha(string senha)
    {
        if (senha.Length < PasswordService.TamanhoMinimo || senha.Length > PasswordService.TamanhoMaximo)
            throw ApiException.BadRequest(
                $"A senha deve possuir entre {PasswordService.TamanhoMinimo} e {PasswordService.TamanhoMaximo} caracteres.",
                new Dictionary<string, string[]> { ["senha"] = [$"Mínimo de {PasswordService.TamanhoMinimo} caracteres."] });
    }

    private static bool EmailValido(string email) =>
        MailAddress.TryCreate(email, out var endereco) && endereco.Address == email && email.Contains('.');
}
