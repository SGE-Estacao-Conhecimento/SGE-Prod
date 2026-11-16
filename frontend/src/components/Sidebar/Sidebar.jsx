import React, { useState } from 'react';
import { motion } from 'motion/react';
import './Sidebar.css';

/**
 * Ícones reutilizáveis da navegação institucional
 */
const ICONS = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  home: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  consumo: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  patrimonio: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  ambientes: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  pedidos: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  usuarios: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  relatorios: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
};

/**
 * Agrupamentos de navegação semânticos específicos por perfil
 */
const adminNavGroups = [
  {
    id: 'inicio',
    label: 'Início',
    items: [
      {
        id: 'dashboard',
        label: 'Início',
        icon: ICONS.dashboard
      }
    ]
  },
  {
    id: 'materiais_bens',
    label: 'Materiais & Bens',
    items: [
      {
        id: 'consumo',
        label: 'Consumo',
        badgeKey: 'estoqueCritico',
        badgeType: 'danger',
        badgeTitle: 'materiais em estoque crítico',
        icon: ICONS.consumo
      },
      {
        id: 'patrimonio',
        label: 'Patrimônio',
        icon: ICONS.patrimonio
      },
      {
        id: 'ambientes',
        label: 'Ambientes',
        icon: ICONS.ambientes
      }
    ]
  },
  {
    id: 'administracao',
    label: 'Administração',
    items: [
      {
        id: 'pedidos',
        label: 'Pedidos',
        badgeKey: 'pedidosPendentes',
        badgeType: 'amber',
        badgeTitle: 'solicitações de patrimônio aguardando parecer',
        icon: ICONS.pedidos
      },
      {
        id: 'usuarios',
        label: 'Usuários',
        badgeKey: 'totalUsuarios',
        badgeType: 'neutral',
        badgeTitle: 'usuários cadastrados',
        icon: ICONS.usuarios
      },
      {
        id: 'relatorios',
        label: 'Relatórios',
        icon: ICONS.relatorios
      }
    ]
  }
];

const almoxarifeNavGroups = [
  {
    id: 'materiais_bens',
    label: 'Materiais & Bens',
    items: [
      {
        id: 'consumo',
        label: 'Consumo',
        badgeKey: 'estoqueCritico',
        badgeType: 'danger',
        badgeTitle: 'materiais em estoque crítico',
        icon: ICONS.consumo
      },
      {
        id: 'patrimonio',
        label: 'Patrimônio',
        icon: ICONS.patrimonio
      }
    ]
  },
  {
    id: 'operacao',
    label: 'Operação',
    items: [
      {
        id: 'pedidos',
        label: 'Pedidos',
        badgeKey: 'pedidosPendentes',
        badgeType: 'amber',
        badgeTitle: 'pedidos aguardando separação',
        icon: ICONS.pedidos
      },
      {
        id: 'relatorios',
        label: 'Relatórios',
        icon: ICONS.relatorios
      }
    ]
  }
];

const usuarioNavGroups = [
  {
    id: 'navegacao',
    label: 'Navegação',
    items: [
      {
        id: 'inicio',
        label: 'Início',
        icon: ICONS.home
      },
      {
        id: 'pedidos',
        label: 'Meus Pedidos',
        badgeKey: 'pedidosPendentes',
        badgeType: 'amber',
        badgeTitle: 'pedidos em andamento',
        icon: ICONS.pedidos
      }
    ]
  }
];

const ROLE_CONFIG = {
  admin: {
    brandRole: 'Administração',
    defaultName: 'Administrador',
    defaultInitial: 'A',
    groups: adminNavGroups,
    storageKey: 'sge_admin_sidebar_collapsed',
    indicatorId: 'adminSidebarIndicator'
  },
  almoxarife: {
    brandRole: 'Almoxarifado',
    defaultName: 'Almoxarife',
    defaultInitial: 'AL',
    groups: almoxarifeNavGroups,
    storageKey: 'sge_almoxarife_sidebar_collapsed',
    indicatorId: 'almoxarifeSidebarIndicator'
  },
  usuario: {
    brandRole: 'Solicitante',
    defaultName: 'Usuário',
    defaultInitial: 'U',
    groups: usuarioNavGroups,
    storageKey: 'sge_usuario_sidebar_collapsed',
    indicatorId: 'usuarioSidebarIndicator'
  }
};

const Sidebar = ({
  role = 'admin',
  activeItem,
  onNavigate,
  onLogout,
  user,
  isOpen,
  onClose,
  counts = {}
}) => {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.admin;

  // Estado de recolhimento da sidebar com persistência local independente por perfil
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(config.storageKey) === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(config.storageKey, String(next));
      } catch {}
      return next;
    });
  };

  const handleItemClick = (id) => {
    onNavigate(id);
    if (onClose) onClose();
  };

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''} ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
        {/* Cabeçalho Institucional com Marca e Botão de Recolher */}
        <div className="sidebar__brand">
          <div className="sidebar__brand-logo-wrap">
            <div className="sidebar__logo" title="Sistema de Gestão Escolar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            {!isCollapsed && (
              <div className="sidebar__brand-text">
                <span className="sidebar__brand-name">SGE</span>
                <span className="sidebar__brand-role">{config.brandRole}</span>
              </div>
            )}
          </div>

          {/* Botão de Fechar no Mobile (quando drawer aberto) */}
          {onClose && (
            <button
              type="button"
              className="sidebar__close-btn"
              onClick={onClose}
              aria-label="Fechar menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          {/* Botão de Alternar Modo Recolhido (Desktop) */}
          <button
            type="button"
            className="sidebar__collapse-toggle-btn"
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            aria-label={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {isCollapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
        </div>

        {/* Navegação Estruturada por Tópicos */}
        <nav className="sidebar__nav">
          {config.groups.map((group, groupIdx) => (
            <div key={group.id} className="sidebar__section">
              {groupIdx > 0 && isCollapsed && (
                <div className="sidebar__section-divider" aria-hidden="true" />
              )}
              {!isCollapsed && (
                <span className="sidebar__section-title">
                  {group.label}
                </span>
              )}
              <ul className="sidebar__section-list">
                {group.items.map((item) => {
                  const isActive = activeItem === item.id || (item.id === 'consumo' && activeItem === 'estoque');
                  const badgeVal = item.badgeKey ? counts[item.badgeKey] : 0;
                  const hasBadge = badgeVal > 0;

                  return (
                    <li key={item.id}>
                      <motion.button
                        id={`nav-${role}-${item.id}`}
                        className={`sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''} ${isCollapsed ? 'sidebar__nav-item--collapsed' : ''}`}
                        onClick={() => handleItemClick(item.id)}
                        title={item.label}
                        aria-label={item.label}
                        whileHover={{ x: isCollapsed ? 0 : 2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="sidebar__nav-icon">{item.icon}</span>
                        {!isCollapsed && (
                          <span className="sidebar__nav-label">{item.label}</span>
                        )}

                        {/* Badges Dinâmicos de Notificação */}
                        {hasBadge && (
                          <span
                            className={`sidebar__badge sidebar__badge--${item.badgeType} ${isCollapsed ? 'sidebar__badge--collapsed' : ''}`}
                            title={`${badgeVal} ${item.badgeTitle}`}
                          >
                            {!isCollapsed ? badgeVal : ''}
                          </span>
                        )}

                        {isActive && (
                          <motion.span
                            layoutId={config.indicatorId}
                            className="sidebar__nav-indicator"
                            transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                          />
                        )}
                      </motion.button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Rodapé da Conta: Acesso Centralizado a Meu Perfil e Botão Sair com recolhimento */}
        <div className={`sidebar__footer ${isCollapsed ? 'sidebar__footer--collapsed' : ''}`}>
          <div
            className={`sidebar__user-block ${activeItem === 'perfil' ? 'sidebar__user-block--active' : ''}`}
            onClick={() => handleItemClick('perfil')}
            title={`${user?.nome || user?.identifier || config.defaultName} (Clique para ver Meu Perfil)`}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleItemClick('perfil');
              }
            }}
          >
            <div className="sidebar__user-avatar">
              {(user?.nome || user?.identifier || config.defaultInitial).charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="sidebar__user-info">
                <span className="sidebar__user-name">{user?.nome || user?.identifier || config.defaultName}</span>
                <span className="sidebar__user-role">Meu Perfil</span>
              </div>
            )}
          </div>
          {onLogout && (
            <motion.button
              id={`sidebar-${role}-logout-btn`}
              className="sidebar-logout-action"
              onClick={onLogout}
              title="Sair do sistema"
              aria-label="Sair da conta"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </motion.button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
