import { request } from '../api/client';
export const listarRemessas = () => request('/api/remessas');
export const criarRemessa = (remessa) => request('/api/remessas', { method: 'POST', body: JSON.stringify(remessa) });
export const remessaService = { listar: listarRemessas, criar: criarRemessa };
