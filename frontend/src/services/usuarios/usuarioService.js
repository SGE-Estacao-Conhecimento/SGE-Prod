import { request } from '../api/client';
import { limparCpf } from '../../utils/cpf';

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

// Contrato da API usa o vocabulário de papéis do front ('admin' | 'almoxarife' | 'usuario').
// A tradução para o ENUM do banco ('almoxarifado' | 'funcionario') é responsabilidade do back-end;
// na leitura, roleParaPerfil já aceita os dois formatos.
const perfilParaRole = (perfil) => ({
  Administrativo: 'admin',
  Almoxarifado: 'almoxarife',
  Usuário: 'usuario'
}[perfil] || perfil);

const somenteDigitos = (valor) => limparCpf(valor) || null;

export const criarUsuario = async (usuario) => normalizarUsuario(await request('/api/usuarios', {
  method: 'POST',
  body: JSON.stringify({
    nome: usuario.nome,
    cpf: somenteDigitos(usuario.cpf),
    email: usuario.email,
    perfil: perfilParaRole(usuario.perfil),
    setor: usuario.setor,
    celular: usuario.celular || null,
    ativo: true
  })
}));

export const editarUsuario = async (usuario) => normalizarUsuario(await request(`/api/usuarios/${usuario.id}`, {
  method: 'PUT',
  body: JSON.stringify({
    nome: usuario.nome,
    cpf: somenteDigitos(usuario.cpf),
    email: usuario.email,
    perfil: perfilParaRole(usuario.perfil),
    setor: usuario.setor,
    celular: usuario.celular || null,
    ativo: usuario.ativo
  })
}));

export const alternarStatusUsuario = async (id) =>
  normalizarUsuario(await request(`/api/usuarios/${id}/status`, { method: 'PATCH' }));

export const resetarSenhaUsuario = async (id) =>
  normalizarUsuario(await request(`/api/usuarios/${id}/resetar-senha`, { method: 'POST' }));

// "Excluir" desativa a conta (o histórico de pedidos e movimentações é preservado).
export const removerUsuario = async (id) =>
  normalizarUsuario(await request(`/api/usuarios/${id}`, { method: 'DELETE' }));

export const usuarioService = {
  listar: listarUsuarios,
  criar: criarUsuario,
  editar: editarUsuario,
  alternarStatus: alternarStatusUsuario,
  resetarSenha: resetarSenhaUsuario,
  remover: removerUsuario
};
