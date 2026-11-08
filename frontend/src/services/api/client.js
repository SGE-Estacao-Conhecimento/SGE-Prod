import { mockStore } from './mockDataStore';

/**
 * Endereço da API real. Vazio = modo standalone (dados simulados no navegador).
 * Defina VITE_API_BASE_URL no .env do front (ex.: http://localhost:5170) para usar o back-end.
 */
export const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL ||
  globalThis.process?.env?.VITE_API_BASE_URL ||
  ''
).replace(/\/+$/, '');
export const USA_API = API_BASE_URL !== '';

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Converte um erro (ApiError ou genérico) em mensagem legível para a interface,
 * diferenciando falhas de conectividade (status 0), permissão (401/403), 404 e erros internos (500).
 */
export const formatarErroApi = (erro, mensagemPadrao = 'Ocorreu um erro ao comunicar com o servidor.') => {
  if (!erro) return mensagemPadrao;
  if (erro.status === 0) {
    return 'Servidor indisponível. Verifique sua conexão com a rede ou se a API está em execução.';
  }
  if (erro.status === 401) {
    return 'Sessão expirada ou não autorizada. Faça login novamente.';
  }
  if (erro.status === 403) {
    return 'Seu perfil de usuário não tem permissão para acessar estes dados.';
  }
  if (erro.status === 404) {
    return 'Os dados solicitados não foram encontrados no servidor.';
  }
  if (erro.status >= 500) {
    return 'Erro interno no servidor ao processar a requisição. Tente novamente mais tarde.';
  }
  return erro.message || mensagemPadrao;
};

export const getStoredToken = () => {
  const localToken = typeof localStorage !== 'undefined' ? localStorage.getItem('sge_token') : null;
  const sessionToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('sge_token') : null;
  return localToken || sessionToken || 'mock_token';
};

export const clearStoredAuth = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('sge_token');
    localStorage.removeItem('sge_user');
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('sge_token');
    sessionStorage.removeItem('sge_user');
  }
};

const ROTAS_PUBLICAS = ['/api/auth/login', '/api/auth/logout', '/api/password-reset/request', '/api/password-reset/confirm'];

/** Requisição HTTP para a API real, com token e erros no formato { message }. */
const httpRequest = async (path, options = {}) => {
  const token =
    (typeof localStorage !== 'undefined' && localStorage.getItem('sge_token')) ||
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('sge_token')) ||
    null;
  // Envio de arquivos (FormData): o navegador define o Content-Type com o boundary do multipart.
  const ehFormulario = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = { ...(ehFormulario ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let resposta;
  try {
    resposta = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', 0);
  }

  const texto = await resposta.text();
  let dados = null;
  if (texto) {
    try { dados = JSON.parse(texto); } catch { dados = null; }
  }

  if (!resposta.ok) {
    // Sessão expirada ou inválida: volta para a tela de login.
    if (resposta.status === 401 && !ROTAS_PUBLICAS.includes(path.split('?')[0])) {
      clearStoredAuth();
      if (typeof window !== 'undefined' && window.location?.reload) {
        window.location.reload();
      }
    }
    throw new ApiError(dados?.message || `Erro ${resposta.status} ao comunicar com o servidor.`, resposta.status, dados?.errors || null);
  }

  return dados;
};

export const request = async (path, options = {}) => {
  if (USA_API) return httpRequest(path, options);
  return mockRequest(path, options);
};

/**
 * Cliente de requisição mock 100% autônomo (desacoplado de backend).
 * Garante que o frontend funcione perfeitamente em modo standalone
 * ao ser movido para qualquer outro repositório.
 */
const mockRequest = async (path, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const body = typeof options.body === 'string' && options.body ? JSON.parse(options.body) : {};
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
  if (pathname === '/api/auth/alterar-senha') {
    return null;
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
    return mockStore.updateStatusPedido(matchPedidoStatus[1], body.status, body);
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
  // Modo simulado: as fotos ficam só na tela e a remessa já é concluída na criação.
  const matchRemessaEtapa = pathname.match(/^\/api\/remessas\/(\d+)\/(fotos|confirmar)$/);
  if (matchRemessaEtapa) {
    return mockStore.getRemessa(matchRemessaEtapa[1]);
  }

  // --- SETORES ---
  if (pathname === '/api/setores') {
    if (method === 'GET') return mockStore.getSetores();
    if (method === 'POST') return mockStore.createSetor(body.nome);
  }

  // Fallback seguro para qualquer outro endpoint
  return [];
};
