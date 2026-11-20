import { request } from '../api/client';

const STORAGE_LIDAS_KEY = 'sge_notificacoes_lidas';
const STORAGE_EXCLUIDAS_KEY = 'sge_notificacoes_excluidas';

let cacheUltimosIds = [];

const obterConjuntoStorage = (chave) => {
  try {
    const raw = localStorage.getItem(chave);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
};

const salvarConjuntoStorage = (chave, set) => {
  try {
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(chave, JSON.stringify(arr));
  } catch {
    // Falha silenciosa de quota em localStorage
  }
};

export const listarNotificacoes = async () => {
  const lidas = obterConjuntoStorage(STORAGE_LIDAS_KEY);
  const excluidas = obterConjuntoStorage(STORAGE_EXCLUIDAS_KEY);

  let dados = [];
  try {
    dados = await request('/api/notificacoes');
  } catch {
    dados = [];
  }

  if (!Array.isArray(dados)) return [];

  cacheUltimosIds = dados.map((n) => String(n.id));

  return dados
    .filter((n) => !excluidas.has(String(n.id)))
    .map((n) => ({
      ...n,
      lida: Boolean(n.lida || lidas.has(String(n.id)))
    }));
};

export const obterContagemNotificacoes = async () => {
  try {
    const lista = await listarNotificacoes();
    const naoLidas = lista.filter((n) => !n.lida).length;
    return { naoLidas };
  } catch {
    return { naoLidas: 0 };
  }
};

export const marcarNotificacaoComoLida = async (id) => {
  if (id != null) {
    const lidas = obterConjuntoStorage(STORAGE_LIDAS_KEY);
    lidas.add(String(id));
    salvarConjuntoStorage(STORAGE_LIDAS_KEY, lidas);
  }

  // Notificações legadas/transitórias derivadas de logs (ex.: "log-31") são mantidas apenas em tela
  if (typeof id === 'string' && id.startsWith('log-')) {
    return { success: true, localOnly: true };
  }
  try {
    return await request(`/api/notificacoes/${id}/lida`, { method: 'PATCH' });
  } catch {
    return { success: true };
  }
};

export const marcarTodasComoLidas = async (ids = []) => {
  const lidas = obterConjuntoStorage(STORAGE_LIDAS_KEY);
  const listaAlvo = Array.isArray(ids) && ids.length > 0 ? ids.map(String) : cacheUltimosIds;

  listaAlvo.forEach((id) => lidas.add(String(id)));
  salvarConjuntoStorage(STORAGE_LIDAS_KEY, lidas);

  try {
    return await request('/api/notificacoes/marcar-todas-lidas', { method: 'POST' });
  } catch {
    return { success: true };
  }
};

export const excluirNotificacao = async (id) => {
  if (id != null) {
    const excluidas = obterConjuntoStorage(STORAGE_EXCLUIDAS_KEY);
    excluidas.add(String(id));
    salvarConjuntoStorage(STORAGE_EXCLUIDAS_KEY, excluidas);
  }

  // Notificações legadas/transitórias são excluídas da visão localmente
  if (typeof id === 'string' && id.startsWith('log-')) {
    return { success: true, localOnly: true };
  }
  try {
    return await request(`/api/notificacoes/${id}`, { method: 'DELETE' });
  } catch {
    return { success: true };
  }
};

export const notificacaoService = {
  listar: listarNotificacoes,
  obterContagem: obterContagemNotificacoes,
  marcarLida: marcarNotificacaoComoLida,
  marcarTodasLidas: marcarTodasComoLidas,
  excluir: excluirNotificacao
};
