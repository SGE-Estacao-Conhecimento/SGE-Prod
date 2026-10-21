import { request } from '../api/client';

export const listarFavoritos = () => request('/api/favoritos');
export const alternarFavorito = (produtoId) => request(`/api/favoritos/${produtoId}`, { method: 'PUT' });

export const favoritoService = { listar: listarFavoritos, alternar: alternarFavorito };
