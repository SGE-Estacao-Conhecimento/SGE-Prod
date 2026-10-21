import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import './Topbar.css';

const Topbar = ({
  title,
  onToggleSidebar,
  onLogout,
  notificacoes = [],
  onMarcarLida,
  onLimparNotificacoes,
  onNavigateToPedido
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsNotifOpen(false);
    };
    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isNotifOpen]);

  const unreadCount = notificacoes.filter(n => !n.lida).length;

  const handleNotificationClick = (item) => {
    if (onMarcarLida) onMarcarLida(item.id);
    if (onNavigateToPedido && item.pedidoId) {
      onNavigateToPedido(item.pedidoId);
    }
    setIsNotifOpen(false);
  };

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button
          id="mobile-sidebar-toggle"
          type="button"
          className="topbar__menu-btn"
          onClick={onToggleSidebar}
          aria-label="Abrir menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="topbar__title">{title}</h1>
      </div>

      <div className="topbar__right">
        {/* Central de Notificações - Sininho com Alerta */}
        <div className="topbar__notif-wrap" ref={notifRef}>
          <motion.button
            id="topbar-notif-btn"
            type="button"
            className={`topbar__notif-btn ${isNotifOpen ? 'topbar__notif-btn--active' : ''}`}
            onClick={() => setIsNotifOpen(prev => !prev)}
            aria-label="Notificações"
            aria-expanded={isNotifOpen}
            aria-controls="notification-popover"
            title="Ver notificações"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="topbar__notif-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </motion.button>

          {/* Painel Popover de Notificações */}
          <AnimatePresence>
            {isNotifOpen && (
              <motion.div
                id="notification-popover"
                className="topbar__notif-popover"
                role="region"
                aria-label="Central de notificações"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="topbar__notif-header">
                  <div className="notif-header-title">
                    <span>Notificações</span>
                    {unreadCount > 0 && (
                      <span className="notif-unread-pill">{unreadCount} novas</span>
                    )}
                  </div>
                  {unreadCount > 0 && onLimparNotificacoes && (
                    <button
                      type="button"
                      className="notif-clear-btn"
                      onClick={onLimparNotificacoes}
                    >
                      Marcar lidas
                    </button>
                  )}
                </div>

                <div className="topbar__notif-body">
                  {notificacoes.length === 0 ? (
                    <div className="notif-empty">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      <p>Nenhuma notificação por enquanto</p>
                    </div>
                  ) : (
                    notificacoes.map((notif) => (
                      <div
                        key={notif.id}
                        className={`notif-item ${!notif.lida ? 'notif-item--unread' : ''}`}
                        onClick={() => handleNotificationClick(notif)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleNotificationClick(notif);
                          }
                        }}
                      >
                        <div className={`notif-item__icon notif-item__icon--${notif.tipo || 'info'}`}>
                          {notif.tipo === 'urgente' ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                          ) : notif.tipo === 'sucesso' ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                            </svg>
                          )}
                        </div>
                        <div className="notif-item__content">
                          <div className="notif-item__top">
                            <strong className="notif-item__title">{notif.titulo}</strong>
                            <span className="notif-item__time">{notif.tempo || 'Hoje'}</span>
                          </div>
                          <p className="notif-item__desc">{notif.mensagem}</p>
                        </div>
                        {!notif.lida && <span className="notif-unread-dot" />}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {onLogout && (
          <button
            id="topbar-logout-btn"
            type="button"
            className="topbar__logout-btn"
            onClick={onLogout}
            title="Sair da conta"
            aria-label="Sair da conta"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
};

export default Topbar;
