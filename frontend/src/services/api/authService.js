import { request } from './client';

const normalizeRole = (role) => {
  if (role === 'almoxarifado' || role === 'almoxarife') return 'almoxarife';
  if (role === 'funcionario' || role === 'usuario') return 'usuario';
  return role || 'admin';
};

export const login = async ({ email, senha, rememberMe = false, role = 'admin' }) => {
  const usuario = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha, lembrar: rememberMe, role })
  });

  const usuarioNormalizado = {
    ...usuario,
    role: normalizeRole(usuario.role || role),
    identifier: usuario.email || usuario.identifier || email,
    rememberMe
  };

  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem('sge_user', JSON.stringify(usuarioNormalizado));
  return usuarioNormalizado;
};

export const logout = () => request('/api/auth/logout', { method: 'POST' });

export const getStoredUser = () => {
  const raw = localStorage.getItem('sge_user') || sessionStorage.getItem('sge_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export const solicitarRedefinicao = (email) => request('/api/password-reset/request', {
  method: 'POST', body: JSON.stringify({ email })
});

export { normalizeRole };
