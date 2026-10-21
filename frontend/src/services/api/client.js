import { mockStore } from './mockDataStore';

export const API_BASE_URL = '';

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const getStoredToken = () =>
  localStorage.getItem('sge_token') || sessionStorage.getItem('sge_token') || 'mock_token';

export const clearStoredAuth = () => {
  localStorage.removeItem('sge_token');
  localStorage.removeItem('sge_user');
  sessionStorage.removeItem('sge_token');
  sessionStorage.removeItem('sge_user');
};

/**
 * Cliente de requisição mock 100% autônomo (desacoplado de backend).
 * Garante que o frontend funcione perfeitamente em modo standalone
 * ao ser movido para qualquer outro repositório.
 */
export const request = async (path, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};
  const [pathname, search] = path.split('?');
  const params = new URLSearchParams(search || '');

  // Pequeno delay para emular resposta assíncrona ultra rápida
  await new Promise(resolve => setTimeout(resolve, 30));

  // --- AUTENTICAÇÃO ---
  if (pathname === '/api/auth/login') {
    return mockStore.login(body);
  }
  if (pathname === '/api/auth/logout') {
    return mockStore.logout();
  }
  if (pathname === '/api/password-reset/request') {
    return { message: 'Instruções para redefinição enviadas para seu e-mail!' };
  }
  if (pathname === '/api/password-reset/confirm') {
    return { message: 'Senha redefinida com sucesso!' };
  }

  // --- MATERIAIS ---
  if (pathname === '/api/materiais') {
    if (method === 'GET') {
      const apenasAtivos = params.get('apenasAtivos') !== 'false';
      return mockStore.getMateriais(apenasAtivos);
    }
    if (method === 'POST') {
      return mockStore.createMaterial(body);
    }
  }
  const matchMaterialId = pathname.match(/^\/api\/materiais\/(\d+)$/);
  if (matchMaterialId) {
    const id = matchMaterialId[1];
    if (method === 'PUT') return mockStore.updateMaterial(id, body);
    if (method === 'DELETE') return mockStore.deleteMaterial(id);
  }

  // --- PEDIDOS ---
  if (pathname === '/api/pedidos/meus') {
    return mockStore.getMeusPedidos();
  }
  if (pathname === '/api/pedidos') {
    if (method === 'GET') {
      return mockStore.getPedidos(params.get('status') || '');
    }
    if (method === 'POST') {
      return mockStore.createPedido(body);
    }
  }
  const matchPedidoStatus = pathname.match(/^\/api\/pedidos\/(\d+)\/status$/);
  if (matchPedidoStatus) {
    return mockStore.updateStatusPedido(matchPedidoStatus[1], body.status);
  }
  const matchPedidoId = pathname.match(/^\/api\/pedidos\/(\d+)$/);
  if (matchPedidoId) {
    if (method === 'DELETE') return mockStore.cancelPedido(matchPedidoId[1]);
  }

  // --- USUARIOS ---
  if (pathname === '/api/usuarios') {
    if (method === 'GET') return mockStore.getUsuarios();
    if (method === 'POST') return mockStore.createUsuario(body);
  }
  const matchUsuarioStatus = pathname.match(/^\/api\/usuarios\/(\d+)\/status$/);
  if (matchUsuarioStatus) {
    return mockStore.toggleStatusUsuario(matchUsuarioStatus[1]);
  }
  const matchUsuarioId = pathname.match(/^\/api\/usuarios\/(\d+)$/);
  if (matchUsuarioId) {
    if (method === 'PUT') return mockStore.updateUsuario(matchUsuarioId[1], body);
    if (method === 'DELETE') return mockStore.deleteUsuario(matchUsuarioId[1]);
  }

  // --- MOVIMENTAÇÕES ---
  if (pathname === '/api/movimentacoes/ajuste') {
    return mockStore.ajustarEstoque(body);
  }
  if (pathname === '/api/movimentacoes') {
    if (method === 'GET') {
      const objParams = {};
      params.forEach((val, key) => { objParams[key] = val; });
      return mockStore.getMovimentacoes(objParams);
    }
    if (method === 'POST') {
      return mockStore.registrarMovimentacao(body);
    }
  }

  // --- DASHBOARD ---
  if (pathname === '/api/dashboard') {
    return mockStore.getDashboard();
  }

  // --- FAVORITOS ---
  if (pathname === '/api/favoritos') {
    if (method === 'GET') return mockStore.getFavoritos();
  }
  const matchFavoritoId = pathname.match(/^\/api\/favoritos\/(\d+)$/);
  if (matchFavoritoId) {
    return mockStore.toggleFavorito(matchFavoritoId[1]);
  }

  // --- NOTIFICAÇÕES ---
  if (pathname === '/api/notificacoes') {
    return mockStore.getNotificacoes();
  }

  // --- REMESSAS ---
  if (pathname === '/api/remessas') {
    if (method === 'GET') return mockStore.getRemessas();
    if (method === 'POST') return mockStore.createRemessa(body);
  }

  // --- SETORES ---
  if (pathname === '/api/setores') {
    if (method === 'GET') return mockStore.getSetores();
    if (method === 'POST') return mockStore.createSetor(body.nome);
  }

  // Fallback seguro para qualquer outro endpoint
  return [];
};
