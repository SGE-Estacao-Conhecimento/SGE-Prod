/**
 * Endereço da API real.
 * Utiliza VITE_API_BASE_URL (padrão: http://localhost:5170) e resolve automaticamente
 * o hostname/IP pelo qual o frontend foi acessado na rede local (LAN), sem exigir IP fixo.
 */
const rawApiBaseUrl = (
  import.meta.env?.VITE_API_BASE_URL ||
  globalThis.process?.env?.VITE_API_BASE_URL ||
  'http://localhost:5170'
).trim().replace(/\/+$/, '');

const resolveApiBaseUrl = (configuredUrl) => {
  const effectiveUrl = configuredUrl || 'http://localhost:5170';
  const hasWindowHost = typeof window !== 'undefined' && Boolean(window.location?.hostname);
  const currentHost = hasWindowHost ? window.location.hostname : 'localhost';
  const currentProtocol = (hasWindowHost && window.location?.protocol) ? window.location.protocol : 'http:';

  if (effectiveUrl.toLowerCase() === 'auto') {
    return `${currentProtocol}//${currentHost}:5170`;
  }
  if (!hasWindowHost || currentHost === 'localhost' || currentHost === '127.0.0.1') {
    return effectiveUrl;
  }
  return effectiveUrl.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/i, `$1${currentHost}`);
};

export const API_BASE_URL = resolveApiBaseUrl(rawApiBaseUrl);
export const USA_API = true;

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
  return localToken || sessionToken || null;
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

export const request = async (path, options = {}) => httpRequest(path, options);
