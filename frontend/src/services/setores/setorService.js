import { request } from '../api/client';

export const listarSetores = () => request('/api/setores');

export const criarSetor = (nome) => request('/api/setores', {
  method: 'POST',
  body: JSON.stringify({ nome })
});

export const setorService = { listar: listarSetores, criar: criarSetor };
