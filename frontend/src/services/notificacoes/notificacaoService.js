import { request } from '../api/client';
export const listarNotificacoes = () => request('/api/notificacoes');
export const notificacaoService = { listar: listarNotificacoes };
