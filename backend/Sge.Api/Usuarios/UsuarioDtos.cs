namespace Sge.Api.Usuarios;

/// <summary>
/// Usuário no formato lido pelo front (usuarioService.listar). Perfil no vocabulário do front
/// ('admin' | 'almoxarife' | 'usuario'). O CPF não é enviado nesta listagem (uso do almoxarifado);
/// o cadastro completo pertence ao Módulo Administração.
/// </summary>
public sealed record UsuarioDto(
    int Id,
    string Nome,
    string Email,
    string Perfil,
    string Setor,
    bool Ativo,
    string? Celular,
    string Inicial,
    string DataCadastro);
