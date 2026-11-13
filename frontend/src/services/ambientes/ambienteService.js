import { request } from '../api/client';

export const listarAmbientes = (apenasAtivos = false) =>
  request(`/api/ambientes?apenasAtivos=${apenasAtivos}`);

export const criarAmbiente = (dados) =>
  request('/api/ambientes', {
    method: 'POST',
    body: JSON.stringify(dados)
  });

export const atualizarAmbiente = (id, dados) =>
  request(`/api/ambientes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados)
  });

export const alternarStatusAmbiente = (id) =>
  request(`/api/ambientes/${id}/status`, {
    method: 'PATCH'
  });

export const excluirAmbiente = (id) =>
  request(`/api/ambientes/${id}`, {
    method: 'DELETE'
  });

export const ambienteService = {
  listar: listarAmbientes,
  criar: criarAmbiente,
  atualizar: atualizarAmbiente,
  alternarStatus: alternarStatusAmbiente,
  excluir: excluirAmbiente
};

