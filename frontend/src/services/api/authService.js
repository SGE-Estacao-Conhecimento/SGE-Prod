import { request } from './client';

const normalizeRole = (role) => {
  if (role === 'almoxarifado' || role === 'almoxarife') return 'almoxarife';
  if (role === 'funcionario' || role === 'usuario') return 'usuario';
  return role || 'admin';
};

export const getStoredUser = () => {
  const raw = localStorage.getItem('sge_user') || sessionStorage.getItem('sge_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export const salvarSessaoAuth = (dadosLogin, fallbackRemember = false) => {
  const anterior = getStoredUser();
  const rememberMe = Boolean(fallbackRemember ?? anterior?.rememberMe);
  const { token, ...dadosUsuario } = dadosLogin;
  const usuarioNormalizado = {
    ...dadosUsuario,
    role: normalizeRole(dadosLogin.role || anterior?.role),
    identifier: dadosLogin.email || dadosLogin.identifier || anterior?.identifier || '',
    precisaTrocarSenha: Boolean(dadosLogin.precisaTrocarSenha),
    rememberMe
  };

  const ativo = rememberMe ? localStorage : sessionStorage;
  const inativo = rememberMe ? sessionStorage : localStorage;
  inativo.removeItem('sge_token');
  inativo.removeItem('sge_user');

  if (token) ativo.setItem('sge_token', token);
  ativo.setItem('sge_user', JSON.stringify(usuarioNormalizado));
  return usuarioNormalizado;
};

export const atualizarUsuarioLocal = (atualizacoes) => {
  const atual = getStoredUser();
  if (!atual) return null;
  const atualizado = { ...atual, ...atualizacoes };
  const emLocal = Boolean(localStorage.getItem('sge_user') || localStorage.getItem('sge_token'));
  const storage = (emLocal || atual.rememberMe) ? localStorage : sessionStorage;
  storage.setItem('sge_user', JSON.stringify(atualizado));
  return atualizado;
};

export const login = async ({ email, senha, rememberMe = false, role = 'admin' }) => {
  const usuario = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha, lembrar: rememberMe, role })
  });

  return salvarSessaoAuth({
    ...usuario,
    role: normalizeRole(usuario.role || role),
    identifier: usuario.email || usuario.identifier || email
  }, rememberMe);
};

export const logout = () => request('/api/auth/logout', { method: 'POST' });

export const alterarSenha = async ({ senhaAtual, novaSenha, lembrar }) => {
  const rememberMe = Boolean(lembrar ?? getStoredUser()?.rememberMe);
  const res = await request('/api/auth/alterar-senha', {
    method: 'POST',
    body: JSON.stringify({ senhaAtual, novaSenha, lembrar: rememberMe })
  });
  if (res?.token) {
    return salvarSessaoAuth(res, rememberMe);
  }
  return res;
};

export const atualizarEmail = async ({ email, senhaAtual }) => {
  const res = await request('/api/auth/email', {
    method: 'PATCH',
    body: JSON.stringify({ email, senhaAtual })
  });
  if (res?.email) {
    atualizarUsuarioLocal({
      email: res.email,
      identifier: res.identifier || res.email
    });
  }
  return res;
};

export const solicitarRedefinicao = (email) => request('/api/password-reset/request', {
  method: 'POST', body: JSON.stringify({ email })
});

export { normalizeRole };
