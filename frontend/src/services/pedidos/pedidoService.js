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
    ? pedido.itens.map(item => ({
        produtoId: item.produtoId || item.id,
        materialNome: item.materialNome || item.nome || item.material,
        quantidade: item.quantidade,
        unidade: item.unidade || 'UN',
        itensPorEmbalagem: item.itensPorEmbalagem
      }))
    : [{
        produtoId: pedido.produtoId,
        materialNome: pedido.materialNome || pedido.nome || pedido.material,
        quantidade: pedido.quantidade,
        unidade: pedido.unidade || 'UN',
        itensPorEmbalagem: pedido.itensPorEmbalagem
      }];

  return request('/api/pedidos', {
    method: 'POST',
    body: JSON.stringify({
      urgencia: mapUrgencia(pedido),
      justificativa: pedido.justificativa || null,
      itens
    })
  });
};

export const atualizarStatusPedido = (id, status, extras = {}) =>
  request(`/api/pedidos/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...extras })
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
