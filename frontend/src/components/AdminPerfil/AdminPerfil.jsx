import React from 'react';
import { StatCard, AlterarSenhaCard } from '../common';
import './AdminPerfil.css';
import '../UsuarioPerfil/UsuarioPerfil.css';

/**
 * AdminPerfil — Visualização de perfil para o módulo Administrativo do SGE.
 * Inclui cartão de identificação, atalhos operacionais rápidos, alteração de senha e logout.
 *
 * @param {Object} props
 * @param {Object} props.user - Objeto com os dados do usuário autenticado
 * @param {Function} [props.onLogout] - Manipulador de logout
 * @param {Function} [props.onNavigate] - Manipulador de navegação entre seções administrativas
 */
const AdminPerfil = ({ user, onLogout, onNavigate }) => {
  const nomeUsuario = user?.nome || user?.identifier || 'Administrador';
  const inicial = nomeUsuario.charAt(0).toUpperCase();

  return (
    <div className="admin-perfil-view">
      {/* Card Principal de Identificação do Administrador */}
      <div className="admin-perfil-header-card">
        <div className="admin-perfil-avatar">
          {inicial}
        </div>
        <div className="admin-perfil-info">
          <h2 className="admin-perfil-nome">{nomeUsuario}</h2>
          <span className="admin-perfil-cargo">Administrador Geral / Gestor do Sistema</span>
          <div className="admin-perfil-meta">
            <span className="admin-perfil-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              {user?.setor ? `Setor: ${user.setor}` : 'Setor: Diretoria / TI'}
            </span>
            {user?.email && (
              <span className="admin-perfil-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                {user.email}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Atalhos Rápidos Operacionais para o Administrador */}
      <div className="admin-perfil-stats-grid">
        <StatCard
          value="Estoque"
          label="Materiais"
          variant="accent"
          onClick={() => onNavigate && onNavigate('estoque')}
        />
        <StatCard
          value="Usuários"
          label="Gerenciamento"
          variant="default"
          onClick={() => onNavigate && onNavigate('usuarios')}
        />
        <StatCard
          value="Pedidos"
          label="Requisições"
          variant="warning"
          onClick={() => onNavigate && onNavigate('pedidos')}
        />
        <StatCard
          value="Relatórios"
          label="Métricas"
          variant="success"
          onClick={() => onNavigate && onNavigate('relatorios')}
        />
      </div>

      {/* Módulo de Segurança: Alterar Senha com Confirmação e Esqueceu a Senha */}
      <AlterarSenhaCard user={user} />

      {/* Botão de Logout */}
      {onLogout && (
        <div className="perfil-logout-wrap">
          <button
            type="button"
            className="btn-perfil-logout"
            onClick={onLogout}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair da Conta Administrativa
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminPerfil;
