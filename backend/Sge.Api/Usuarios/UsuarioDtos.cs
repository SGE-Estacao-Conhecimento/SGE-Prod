namespace Sge.Api.Usuarios;

/// <summary>
/// Usuário no formato lido pelo front (usuarioService). Perfil no vocabulário do front
/// ('admin' | 'almoxarife' | 'usuario'). O CPF só é enviado à administração.
/// </summary>
public sealed record UsuarioDto(
    int Id,
    string Nome,
    string? Cpf,
    string? Email,
    string Perfil,
    string Setor,
    bool Ativo,
    string? Celular,
    string Inicial,
    string DataCadastro);

/// <summary>Cadastro e edição (contrato de usuarioService.criar/editar).</summary>
public sealed record SalvarUsuarioRequest(
    string? Nome,
    string? Cpf,
    string? Email,
    string? Senha,
    string? Perfil,
    string? Setor,
    string? Celular,
    bool? Ativo);
