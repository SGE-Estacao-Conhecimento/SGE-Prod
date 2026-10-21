import { request } from '../api/client';

export const listarPedidos = (status = '') => {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/api/pedidos${query}`);
};

export const listarMeusPedidos = () => request('/api/pedidos/meus');

const mapUrgencia = (pedido) => {
  if (pedido.urgente) return 'alta';
  const prioridade = String(pedido.prioridade || '').toLowerCase();
  return prioridade === 'urgente' || prioridade === 'alta' ? 'alta' : 'normal';
};

/**
 * Cria um pedido. Aceita lote (`itens: [{ produtoId, quantidade }]`)
 * ou o formato legado de item único (`produtoId` + `quantidade`).
 */
export const criarPedido = (pedido) => {
  const itens = Array.isArray(pedido.itens) && pedido.itens.length > 0
    ? pedido.itens.map(item => ({ produtoId: item.produtoId, quantidade: item.quantidade }))
    : [{ produtoId: pedido.produtoId, quantidade: pedido.quantidade }];

  return request('/api/pedidos', {
    method: 'POST',
    body: JSON.stringify({
      urgencia: mapUrgencia(pedido),
      justificativa: pedido.justificativa || null,
      itens
    })
  });
};

export const atualizarStatusPedido = (id, status) =>
  request(`/api/pedidos/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });

export const cancelarPedido = (id) =>
  request(`/api/pedidos/${id}`, { method: 'DELETE' });

export const pedidoService = {
  listar: listarPedidos,
  listarMeus: listarMeusPedidos,
  criar: criarPedido,
  atualizarStatus: atualizarStatusPedido,
  cancelar: cancelarPedido
};
