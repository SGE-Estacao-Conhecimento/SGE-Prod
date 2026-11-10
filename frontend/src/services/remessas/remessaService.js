import { request, API_BASE_URL, getStoredToken } from '../api/client';

export const listarRemessas = () => request('/api/remessas');

/**
 * Carrega uma foto anexada ao recebimento via endpoint autenticado e retorna um Blob URL.
 * O componente consumidor deve chamar URL.revokeObjectURL ao descartar a visualização.
 */
export const obterFotoBlobUrl = async (recebimentoId, anexoId) => {
  const token = getStoredToken();
  const resp = await fetch(`${API_BASE_URL}/api/remessas/${recebimentoId}/fotos/${anexoId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!resp.ok) {
    throw new Error(`Erro ${resp.status} ao carregar comprovante.`);
  }
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
};

/**
 * Registra um recebimento em lote/doação em três etapas, como exige o back-end:
 * 1) cria o recebimento em preparação; 2) envia cada foto do material; 3) confirma (entrada no estoque).
 * `identificadorOperacao` identifica o rascunho: repetir após uma falha reaproveita o mesmo recebimento.
 */
export const criarRemessa = async ({ fotos = [], identificadorOperacao, ...remessa }) => {
  const criada = await request('/api/remessas', {
    method: 'POST',
    body: JSON.stringify({ ...remessa, identificadorOperacao })
  });

  // Se houver fotos (remessas normais), envia cada uma; em complementos sem foto, avança direto para a confirmação.
  if (fotos && fotos.length > 0) {
    const jaEnviadas = new Set((criada?.fotos || []).map(f => `${f.nomeOriginal}|${f.tamanhoBytes}`));
    for (const foto of fotos) {
      if (jaEnviadas.has(`${foto.name}|${foto.size}`)) continue;
      const formulario = new FormData();
      formulario.append('arquivo', foto, foto.name);
      await request(`/api/remessas/${criada.id}/fotos`, { method: 'POST', body: formulario });
    }
  }

  return request(`/api/remessas/${criada.id}/confirmar`, { method: 'POST' });
};

export const remessaService = {
  listar: listarRemessas,
  criar: criarRemessa,
  obterFotoBlobUrl
};
