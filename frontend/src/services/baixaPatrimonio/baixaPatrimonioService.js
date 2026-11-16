import { request, API_BASE_URL, getStoredToken } from '../api/client';

export const listarPedidosBaixa = (status) => {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/api/baixa-patrimonio${query}`);
};

export const obterPedidoBaixa = (id) => request(`/api/baixa-patrimonio/${id}`);

export const solicitarBaixa = async ({ itemId, motivo, justificativa, fotos = [] }) => {
  const formData = new FormData();
  formData.append('itemId', itemId);
  formData.append('motivo', motivo);
  formData.append('justificativa', justificativa);

  fotos.forEach((foto) => {
    formData.append('fotos', foto, foto.name);
  });

  return request('/api/baixa-patrimonio', {
    method: 'POST',
    body: formData
  });
};

export const aprovarBaixa = (id, parecer = null) => {
  return request(`/api/baixa-patrimonio/${id}/aprovar`, {
    method: 'POST',
    body: JSON.stringify({ parecer: parecer || null })
  });
};

export const recusarBaixa = (id, parecer) => {
  return request(`/api/baixa-patrimonio/${id}/recusar`, {
    method: 'POST',
    body: JSON.stringify({ parecer })
  });
};

export const obterFotoBlobUrl = async (pedidoId, anexoId) => {
  const token = getStoredToken();
  const resp = await fetch(`${API_BASE_URL}/api/baixa-patrimonio/${pedidoId}/foto/${anexoId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!resp.ok) {
    throw new Error(`Erro ${resp.status} ao carregar imagem da baixa.`);
  }

  const blob = await resp.blob();
  return URL.createObjectURL(blob);
};

export const baixaPatrimonioService = {
  listar: listarPedidosBaixa,
  obter: obterPedidoBaixa,
  solicitar: solicitarBaixa,
  aprovar: aprovarBaixa,
  recusar: recusarBaixa,
  obterFotoBlobUrl
};
