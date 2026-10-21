import { request } from '../api/client';

const roleParaPerfil = (role) => ({
  admin: 'Administrativo',
  almoxarife: 'Almoxarifado',
  almoxarifado: 'Almoxarifado',
  usuario: 'Usuário',
  funcionario: 'Usuário'
}[role] || role);

const normalizarUsuario = (usuario) => ({
  ...usuario,
  perfil: roleParaPerfil(usuario.perfil)
});

export const listarUsuarios = async () =>
  (await request('/api/usuarios')).map(normalizarUsuario);

const perfilParaRole = (perfil) => ({
  Administrativo: 'admin',
  Almoxarifado: 'almoxarife',
  Usuário: 'usuario'
}[perfil] || perfil);

export const criarUsuario = async (usuario) => normalizarUsuario(await request('/api/usuarios', {
  method: 'POST',
  body: JSON.stringify({
    nome: usuario.nome,
    email: usuario.email,
    senha: usuario.senha,
    perfil: perfilParaRole(usuario.perfil),
    setor: usuario.setor,
    celular: usuario.celular || null
  })
}));

export const editarUsuario = async (usuario) => normalizarUsuario(await request(`/api/usuarios/${usuario.id}`, {
  method: 'PUT',
  body: JSON.stringify({
    nome: usuario.nome,
    email: usuario.email,
    perfil: perfilParaRole(usuario.perfil),
    setor: usuario.setor,
    senha: usuario.senha || null,
    celular: usuario.celular || null,
    ativo: usuario.ativo
  })
}));

export const alternarStatusUsuario = (id) =>
  request(`/api/usuarios/${id}/status`, { method: 'PATCH' });

export const removerUsuario = (id) =>
  request(`/api/usuarios/${id}`, { method: 'DELETE' });

export const usuarioService = {
  listar: listarUsuarios,
  criar: criarUsuario,
  editar: editarUsuario,
  alternarStatus: alternarStatusUsuario,
  remover: removerUsuario
};
