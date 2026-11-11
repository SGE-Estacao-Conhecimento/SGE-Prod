using System.Security.Claims;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.Usuarios;

/// <summary>
/// Gerenciamento de usuários pela administração (tela "Gerenciamento de Usuários").
/// Decisões: e-mail opcional e autogerenciável no perfil; excluir = desativar (o histórico é preservado);
/// o sistema não pode ficar sem administrador ativo; CPF validado matematicamente e imutável após cadastrado;
/// senha inicial/reset = 6 primeiros dígitos do CPF com troca obrigatória no próximo acesso (mínimo de 8 caracteres para senhas escolhidas pelo usuário).
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
        await using var t = await Transacao.IniciarAsync(db);
        var dados = await ValidarAsync(t, req, usuarioId: null, ativoAtual: true);

        var senhaInicial = dados.Cpf[..6];
        var id = await usuarios.InserirAsync(t, dados, senhas.Hash(senhaInicial));
        var criado = await usuarios.ObterAsync(t, id);
        await t.ConfirmarAsync();
        return criado!;
    }

    public async Task<UsuarioDto> EditarAsync(int usuarioId, SalvarUsuarioRequest req)
    {
        await using var t = await Transacao.IniciarAsync(db);
        var (atual, administradores) = await BloquearAsync(t, usuarioId);

        var cpfAtual = Validadores.SomenteDigitos(atual.Cpf);
        var cpfEnviado = Validadores.SomenteDigitos(req.Cpf);
        if (cpfAtual.Length > 0)
        {
            if (cpfEnviado.Length > 0 && !string.Equals(cpfAtual, cpfEnviado, StringComparison.Ordinal))
            {
                throw new ApiException(422, "Não é permitido alterar o CPF após o cadastro.",
                    new Dictionary<string, string[]> { ["cpf"] = ["O CPF não pode ser alterado após o cadastro."] });
            }
            req = req with { Cpf = cpfAtual };
        }

        var dados = await ValidarAsync(t, req, usuarioId, atual.Ativo);

        GarantirAdministradorAtivo(atual, administradores, dados.Perfil, dados.Ativo);
        await usuarios.AtualizarAsync(t, atual, dados);

        var editado = await usuarios.ObterAsync(t, usuarioId);
        await t.ConfirmarAsync();
        return editado!;
    }

    public async Task<UsuarioDto> ResetarSenhaAsync(int usuarioId)
    {
        await using var t = await Transacao.IniciarAsync(db);
        var atual = await usuarios.BloquearAsync(t, usuarioId) ?? throw ApiException.NotFound("Usuário não encontrado.");
        var cpf = Validadores.SomenteDigitos(atual.Cpf);
        if (!Validadores.CpfValido(cpf))
            throw new ApiException(422, "Este usuário não possui um CPF válido cadastrado para redefinir a senha.");

        await usuarios.DefinirSenhaAsync(t, usuarioId, senhas.Hash(cpf[..6]), trocaSenhaObrigatoria: true);
        var dto = await usuarios.ObterAsync(t, usuarioId);
        await t.ConfirmarAsync();
        return dto!;
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

        var cpf = Validadores.SomenteDigitos(req.Cpf);
        if (cpf.Length == 0) erros["cpf"] = ["CPF é obrigatório."];
        else if (cpf.Length != 11) erros["cpf"] = ["CPF deve conter 11 dígitos."];
        else if (!Validadores.CpfValido(cpf)) erros["cpf"] = ["CPF inválido."];

        var email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim().ToLowerInvariant();
        if (email is not null && (email.Length > 150 || !Validadores.EmailValido(email, aceitarLoginAdmin: usuarioId is not null)))
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

        var ativo = usuarioId is null ? true : (req.Ativo ?? ativoAtual);
        return new UsuarioRepository.DadosUsuario(nome!, cpf, email, perfil!, setorId, celular, ativo);
    }
}
