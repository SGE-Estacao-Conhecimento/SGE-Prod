import { request } from '../api/client';

export const listarMateriais = (apenasAtivos = true) =>
  request(`/api/materiais?apenasAtivos=${apenasAtivos}`);

const toPayload = (material) => ({
  codigo: material.codigo || null,
  nome: material.nome,
  categoria: material.categoria || null,
  unidade: material.unidade,
  quantidadeInicial: Number(material.quantidade ?? 0),
  estoqueMinimo: Number(material.estoqueMinimo ?? 0),
  localizacao: material.localizacao || null,
  descricao: material.descricao || null,
  bemDuravel: material.bemDuravel === undefined ? undefined : !!material.bemDuravel,
  permiteFracao:
    material.permiteFracao === undefined && material.permite_fracao === undefined
      ? undefined
      : Boolean(material.permiteFracao ?? material.permite_fracao)
});

export const criarMaterial = (material) =>
  request('/api/materiais', {
    method: 'POST',
    body: JSON.stringify(toPayload(material))
  });

export const editarMaterial = (id, material) =>
  request(`/api/materiais/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toPayload(material))
  });

export const excluirMaterial = (id) =>
  request(`/api/materiais/${id}`, { method: 'DELETE' });

export const materialService = {
  listar: listarMateriais,
  criar: criarMaterial,
  editar: editarMaterial,
  excluir: excluirMaterial
};
