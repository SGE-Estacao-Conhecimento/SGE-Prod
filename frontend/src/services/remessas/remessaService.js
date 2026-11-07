import { request } from '../api/client';

export const listarRemessas = () => request('/api/remessas');

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

  // Em uma nova tentativa, fotos já enviadas não são repetidas (mesmo nome e tamanho).
  const jaEnviadas = new Set((criada?.fotos || []).map(f => `${f.nomeOriginal}|${f.tamanhoBytes}`));
  for (const foto of fotos) {
    if (jaEnviadas.has(`${foto.name}|${foto.size}`)) continue;
    const formulario = new FormData();
    formulario.append('arquivo', foto, foto.name);
    await request(`/api/remessas/${criada.id}/fotos`, { method: 'POST', body: formulario });
  }

  return request(`/api/remessas/${criada.id}/confirmar`, { method: 'POST' });
};

export const remessaService = { listar: listarRemessas, criar: criarRemessa };
