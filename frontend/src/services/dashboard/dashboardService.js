import { request } from '../api/client';

export const obterDashboard = () => request('/api/dashboard');

export async function obterAnalytics(janelaDias = 30, forcar = false, signal) {
  return request(`/api/dashboard/analytics?janelaDias=${janelaDias}&forcar=${forcar}`, { signal });
}

export async function obterPrevisaoMaterial(produtoId, signal) {
  if (!produtoId || Number(produtoId) <= 0) {
    throw new Error('Identificador do produto é obrigatório.');
  }
  return request(`/api/dashboard/materiais/${produtoId}/previsao`, { signal });
}

export const dashboardService = {
  obter: obterDashboard,
  obterAnalytics,
  obterPrevisaoMaterial
};

export default dashboardService;
