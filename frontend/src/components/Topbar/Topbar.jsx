import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BottomSheetModal } from '../common';
import './Topbar.css';

const Topbar = ({
  title,
  onToggleSidebar,
  onLogout,
  notificacoes = [],
  onMarcarLida,
  onLimparNotificacoes,
  onExcluirNotificacao,
  onNavigateToPedido
}) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [filtroAba, setFiltroAba] = useState('todas');
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const notifRef = useRef(null);

  // Responsividade: sincronizado com o breakpoint de 768px da barra inferior mobile (BottomNav)
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fecha o dropdown desktop ao clicar fora ou apertar Escape
  useEffect(() => {
    if (isMobile) return undefined;

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
  }, [isNotifOpen, isMobile]);

  const unreadCount = notificacoes.filter((n) => !n.lida).length;

  const notificacoesFiltradas = useMemo(() => {
    return notificacoes.filter((n) => {
      if (filtroAba === 'nao_lidas') return !n.lida;
      return true;
    });
  }, [notificacoes, filtroAba]);

  // Clique único no card: marca como lida e direciona para o recurso
  const handleCardClick = (item) => {
    if (onMarcarLida && !item.lida) {
      onMarcarLida(item.id);
    }
    if (onNavigateToPedido) {
      if (item.pedidoId) {
        onNavigateToPedido(item.pedidoId, item.linkAcao);
        setIsNotifOpen(false);
        return;
      }
      if (item.linkAcao) {
        const match = item.linkAcao.match(/(?:id=)(\d+)/);
        const pedidoId = match && match[1] ? Number(match[1]) : null;
        onNavigateToPedido(pedidoId, item.linkAcao);
        setIsNotifOpen(false);
        return;
      }
    }
    setIsNotifOpen(false);
  };

  const renderNotificacaoIcon = (notif) => {
    if (notif.tipo === 'urgente') {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    }
    if (notif.tipo === 'sucesso') {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    }
    if (notif.tipo === 'alerta') {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    }
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    );
  };

  const renderCorpoNotificacoes = () => (
    <div className="notif-center-wrapper">
      {/* Abas Tradicionais: Todas e Não Lidas */}
      <div className="notif-filter-tabs" role="tablist" aria-label="Filtrar notificações">
        <button
          type="button"
          role="tab"
          aria-selected={filtroAba === 'todas'}
          className={`notif-filter-tab ${filtroAba === 'todas' ? 'notif-filter-tab--active' : ''}`}
          onClick={() => setFiltroAba('todas')}
        >
          Todas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filtroAba === 'nao_lidas'}
          className={`notif-filter-tab ${filtroAba === 'nao_lidas' ? 'notif-filter-tab--active' : ''}`}
          onClick={() => setFiltroAba('nao_lidas')}
        >
          Não lidas {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      {/* Lista Tradicional de Notificações */}
      <div className="notif-list-container">
        {notificacoesFiltradas.length === 0 ? (
          <div className="notif-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="notif-empty__title">Nenhuma notificação</p>
            <span className="notif-empty__desc">
              {filtroAba === 'nao_lidas'
                ? 'Todas as notificações já foram lidas.'
                : 'Você não possui notificações no momento.'}
            </span>
          </div>
        ) : (
          notificacoesFiltradas.map((notif) => (
            <div
              key={notif.id}
              className={`notif-card ${!notif.lida ? 'notif-card--unread' : ''}`}
              onClick={() => handleCardClick(notif)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCardClick(notif);
                }
              }}
            >
              <div className={`notif-card__icon notif-card__icon--${notif.tipo || 'info'}`}>
                {renderNotificacaoIcon(notif)}
              </div>

              <div className="notif-card__content">
                <div className="notif-card__header">
                  <strong className="notif-card__title">{notif.titulo}</strong>
                  <span className="notif-card__time">{notif.tempo || 'Hoje'}</span>
                </div>
                <p className="notif-card__desc">{notif.mensagem}</p>
              </div>

              <div className="notif-card__meta">
                {!notif.lida && <span className="notif-unread-dot" title="Não lida" />}
                {onExcluirNotificacao && (
                  <button
                    type="button"
                    className="notif-card__btn-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExcluirNotificacao(notif.id);
                    }}
                    title="Dispensar notificação"
                    aria-label="Dispensar notificação"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <header className={`topbar ${isNotifOpen ? 'topbar--notif-open' : ''}`}>
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
            onClick={() => setIsNotifOpen((prev) => !prev)}
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

          {/* Painel Desktop Popover (quando > 600px) */}
          {!isMobile && (
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
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>

                  <div className="topbar__notif-body">
                    {renderCorpoNotificacoes()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Painel Mobile em BottomSheetModal (quando <= 768px, delimitado pela barra inferior) */}
          {isMobile && (
            <BottomSheetModal
              isOpen={isNotifOpen}
              onClose={() => setIsNotifOpen(false)}
              title="Notificações"
              subtitle={unreadCount > 0 ? `${unreadCount} não lidas` : 'Atualizado'}
              maxWidth="480px"
              className="notif-bottom-sheet"
              backdropClassName="notif-modal-backdrop"
              zIndex={998}
              headerAction={
                unreadCount > 0 && onLimparNotificacoes ? (
                  <button
                    type="button"
                    className="notif-clear-btn"
                    onClick={onLimparNotificacoes}
                  >
                    Marcar todas lidas
                  </button>
                ) : null
              }
            >
              <div className="notif-bottom-sheet-content">
                {renderCorpoNotificacoes()}
              </div>
            </BottomSheetModal>
          )}
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
