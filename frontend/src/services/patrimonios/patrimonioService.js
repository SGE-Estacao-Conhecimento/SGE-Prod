import { request } from '../api/client';

export const listarCatalogoPatrimonio = (categoria = '') =>
  request(`/api/patrimonios/catalogo${categoria ? `?categoria=${encodeURIComponent(categoria)}` : ''}`);

export const criarCatalogoPatrimonio = (dados) =>
  request('/api/patrimonios/catalogo', {
    method: 'POST',
    body: JSON.stringify(dados)
  });

export const atualizarCatalogoPatrimonio = (id, dados) =>
  request(`/api/patrimonios/catalogo/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados)
  });

export const listarItensPatrimonio = (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.ambienteId) params.append('ambienteId', filtros.ambienteId);
  if (filtros.semAmbiente) params.append('semAmbiente', 'true');
  if (filtros.busca) params.append('busca', filtros.busca);
  if (filtros.categoria) params.append('categoria', filtros.categoria);
  if (filtros.status) params.append('status', filtros.status);

  const qs = params.toString();
  return request(`/api/patrimonios/itens${qs ? `?${qs}` : ''}`);
};

export const criarItemPatrimonio = (dados) =>
  request('/api/patrimonios/itens', {
    method: 'POST',
    body: JSON.stringify(dados)
  });

export const atualizarItemPatrimonio = (id, dados) =>
  request(`/api/patrimonios/itens/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados)
  });

export const transferirItemPatrimonio = (id, dados) =>
  request(`/api/patrimonios/itens/${id}/transferir`, {
    method: 'PATCH',
    body: JSON.stringify(dados)
  });

export const baixarItemPatrimonio = (id) =>
  request(`/api/patrimonios/itens/${id}`, {
    method: 'DELETE'
  });

export const patrimonioService = {
  listarCatalogo: listarCatalogoPatrimonio,
  criarCatalogo: criarCatalogoPatrimonio,
  atualizarCatalogo: atualizarCatalogoPatrimonio,
  listarItens: listarItensPatrimonio,
  criarItem: criarItemPatrimonio,
  atualizarItem: atualizarItemPatrimonio,
  transferirItem: transferirItemPatrimonio,
  baixarItem: baixarItemPatrimonio
};

