import { request } from '../api/client';

export const obterDashboard = () => request('/api/dashboard');

export const dashboardService = { obter: obterDashboard };
