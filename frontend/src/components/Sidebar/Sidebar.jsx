import React from 'react';
import { motion } from 'motion/react';
import './Sidebar.css';

const navItems = [
  { id: 'dashboard', label: 'Início', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )},
  { id: 'estoque', label: 'Estoque', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  )},
  { id: 'usuarios', label: 'Usuários', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )},
  { id: 'pedidos', label: 'Pedidos', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>
    </svg>
  )},
  { id: 'relatorios', label: 'Relatórios', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )},
  { id: 'perfil', label: 'Meu Perfil', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )},
];

const Sidebar = ({
  activeItem,
  onNavigate,
  onLogout,
  user,
  isOpen,
  onClose,
  counts = {}
}) => {
  const handleItemClick = (id) => {
    onNavigate(id);
    if (onClose) onClose();
  };

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <div className="sidebar__logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <span className="sidebar__brand-name">Sistema</span>
          {onClose && (
            <button
              type="button"
              className="sidebar__close-btn"
              onClick={onClose}
              aria-label="Fechar menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <nav className="sidebar__nav">
          <ul>
            {navItems.map(item => (
              <li key={item.id}>
                <motion.button
                  id={`nav-${item.id}`}
                  className={`sidebar__nav-item ${activeItem === item.id ? 'sidebar__nav-item--active' : ''}`}
                  onClick={() => handleItemClick(item.id)}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="sidebar__nav-icon">{item.icon}</span>
                  <span className="sidebar__nav-label">{item.label}</span>

                  {/* Badges Dinâmicos com Contadores em Tempo Real */}
                  {item.id === 'pedidos' && counts.pedidosPendentes > 0 && (
                    <span className="sidebar__badge sidebar__badge--amber" title={`${counts.pedidosPendentes} pedidos aguardando atendimento`}>
                      {counts.pedidosPendentes}
                    </span>
                  )}
                  {item.id === 'estoque' && counts.estoqueCritico > 0 && (
                    <span className="sidebar__badge sidebar__badge--danger" title={`${counts.estoqueCritico} materiais em estoque crítico`}>
                      {counts.estoqueCritico}
                    </span>
                  )}
                  {item.id === 'usuarios' && counts.totalUsuarios > 0 && (
                    <span className="sidebar__badge sidebar__badge--neutral" title={`${counts.totalUsuarios} usuários cadastrados`}>
                      {counts.totalUsuarios}
                    </span>
                  )}

                  {activeItem === item.id && (
                    <motion.span
                      layoutId="adminSidebarIndicator"
                      className="sidebar__nav-indicator"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                </motion.button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar__footer">
          <div
            className="sidebar__user-block"
            onClick={() => handleItemClick('perfil')}
            title="Acessar Meu Perfil"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, cursor: 'pointer' }}
          >
            <div className="sidebar__user-avatar">
              {(user?.nome || user?.identifier || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">{user?.nome || user?.identifier || 'Administrador'}</span>
              <span className="sidebar__user-role">Admin</span>
            </div>
          </div>
          {onLogout && (
            <motion.button
              id="sidebar-admin-logout-btn"
              className="sidebar-logout-action"
              onClick={onLogout}
              title="Sair"
              aria-label="Sair da conta"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
