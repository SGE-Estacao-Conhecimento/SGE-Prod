import { request } from '../api/client';

export const listarMovimentacoes = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  return request(`/api/movimentacoes${query.toString() ? `?${query}` : ''}`);
};

export const registrarMovimentacao = ({ produtoId, tipo, quantidade, observacao }) =>
  request('/api/movimentacoes', {
    method: 'POST',
    body: JSON.stringify({ produtoId, tipo, quantidade, observacao, fotosUrl: [], tipoFoto: 'outro' })
  });

export const ajustarEstoque = ({ produtoId, novoSaldo, motivo }) =>
  request('/api/movimentacoes/ajuste', {
    method: 'POST',
    body: JSON.stringify({ produtoId, novoSaldo, motivo })
  });

export const movimentacaoService = {
  listar: listarMovimentacoes,
  registrar: registrarMovimentacao,
  ajustar: ajustarEstoque
};
