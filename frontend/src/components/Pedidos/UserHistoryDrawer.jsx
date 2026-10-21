import React, { useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './UserHistoryDrawer.css';
import { useDialogAccessibility } from '../common';

/**
 * UserHistoryDrawer
 * Gaveta lateral deslizante com histórico de requisições do colaborador no semestre.
 */
const UserHistoryDrawer = ({
  isOpen,
  onClose,
  userName,
  userSector,
  usuarios = [],
  pedidos = [],
  onFilterUserInTable,
  onUpdateStatus
}) => {
  const dialogRef = useDialogAccessibility({ isOpen, onClose });

  // Bloquear scroll do body quando a gaveta estiver aberta
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Localizar os dados cadastrais do usuário
  const userProfile = useMemo(() => {
    if (!userName) return null;
    const found = usuarios.find(
      u => (u.nome || '').toLowerCase().trim() === userName.toLowerCase().trim()
    );
    if (found) return found;

    return {
      nome: userName,
      setor: userSector || 'Setor não informado',
      email: null,
      perfil: 'Solicitante',
      ramal: null,
      dataCadastro: null
    };
  }, [userName, userSector, usuarios]);

  // Filtrar pedidos deste usuário no semestre
  const userPedidos = useMemo(() => {
    if (!userName) return [];
    return pedidos
      .filter(p => (p.usuario || '').toLowerCase().trim() === userName.toLowerCase().trim())
      .sort((a, b) => (b.id || 0) - (a.id || 0));
  }, [pedidos, userName]);

  // Métricas do usuário no semestre
  const metrics = useMemo(() => {
    const totalPedidos = userPedidos.length;
    const pendentes = userPedidos.filter(p => (p.status || '').toLowerCase() === 'pendente').length;
    const atendidos = userPedidos.filter(p => (p.status || '').toLowerCase() === 'atendido').length;
    const urgentes = userPedidos.filter(p => p.urgente || p.prioridade === 'Urgente').length;

    let totalItens = 0;
    userPedidos.forEach(p => {
      if (p.itens && p.itens.length > 0) {
        totalItens += p.itens.reduce((acc, it) => acc + (Number(it.quantidade) || 1), 0);
      } else if (p.materiais && p.materiais.length > 0) {
        totalItens += p.materiais.reduce((acc, m) => acc + (typeof m === 'object' ? (Number(m.quantidade) || 1) : 1), 0);
      } else {
        totalItens += Number(p.quantidade) || 1;
      }
    });

    return { totalPedidos, pendentes, atendidos, urgentes, totalItens };
  }, [userPedidos]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Atendido':
        return <span className="drawer-badge drawer-badge--success">Atendido</span>;
      case 'Cancelado':
        return <span className="drawer-badge drawer-badge--danger">Recusado</span>;
      case 'Em Separação':
        return <span className="drawer-badge drawer-badge--info">Em Separação</span>;
      case 'Pronto p/ Retirada':
        return <span className="drawer-badge drawer-badge--ready">Pronto p/ Retirada</span>;
      case 'Pendente':
      default:
        return <span className="drawer-badge drawer-badge--warning">Pendente</span>;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="drawer-overlay-root">
          {/* Backdrop Escurecido com Blur */}
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />

          {/* Painel Lateral Deslizante */}
          <motion.aside
            ref={dialogRef}
            className="drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Histórico de Requisições de ${userName}`}
            tabIndex={-1}
          >
            {/* Header da Gaveta */}
            <div className="drawer-header">
              <div className="drawer-header__title-group">
                <span className="drawer-subtitle">Prontuário de Requisições</span>
                <h2 className="drawer-title">Histórico do Solicitante</h2>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={onClose}
                title="Fechar histórico (Esc)"
                aria-label="Fechar histórico"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Corpo com Scroll */}
            <div className="drawer-body">
              {/* Card do Perfil do Usuário */}
              <div className="drawer-user-card">
                <div className="drawer-user-avatar">
                  {userName ? userName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="drawer-user-details">
                  <h3 className="drawer-user-name">{userName}</h3>
                  <div className="drawer-user-tags">
                    <span className="drawer-user-sector-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                      </svg>
                      {userProfile?.setor || userSector}
                    </span>
                    <span className="drawer-user-role-badge">
                      {userProfile?.perfil || 'Docente'}
                    </span>
                  </div>
                  <div className="drawer-user-meta">
                    <span title="E-mail institucional">{userProfile?.email}</span>
                    {userProfile?.ramal && userProfile.ramal !== '—' && (
                      <span title="Ramal interno">Ramal {userProfile.ramal}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* KPIs de Consumo no Semestre */}
              <div className="drawer-kpis-grid">
                <div className="drawer-kpi-item">
                  <span className="drawer-kpi-label">Pedidos no Semestre</span>
                  <div className="drawer-kpi-val">{metrics.totalPedidos}</div>
                </div>
                <div className="drawer-kpi-item">
                  <span className="drawer-kpi-label">Itens Entregues</span>
                  <div className="drawer-kpi-val drawer-kpi-val--accent">{metrics.totalItens}</div>
                </div>
                <div className="drawer-kpi-item">
                  <span className="drawer-kpi-label">Atendidos</span>
                  <div className="drawer-kpi-val drawer-kpi-val--success">{metrics.atendidos}</div>
                </div>
                <div className="drawer-kpi-item">
                  <span className="drawer-kpi-label">Pendentes</span>
                  <div className="drawer-kpi-val drawer-kpi-val--warning">{metrics.pendentes}</div>
                </div>
              </div>

              {/* Botão de Atalho para Filtrar na Tabela */}
              {onFilterUserInTable && (
                <button
                  type="button"
                  className="drawer-filter-btn"
                  onClick={() => {
                    onFilterUserInTable(userName);
                    onClose();
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  Filtrar pedidos deste solicitante na tabela principal
                </button>
              )}

              {/* Linha do Tempo de Requisições */}
              <div className="drawer-timeline-section">
                <div className="drawer-timeline-header">
                  <h4>Requisições Registradas ({userPedidos.length})</h4>
                  <span className="drawer-timeline-badge">Histórico disponível</span>
                </div>

                {userPedidos.length > 0 ? (
                  <div className="drawer-timeline-list">
                    {userPedidos.map((pedido) => {
                      const isUrgent = pedido.urgente || pedido.prioridade === 'Urgente';
                      return (
                        <div
                          key={pedido.id}
                          className={`drawer-order-card ${isUrgent ? 'drawer-order-card--urgent' : ''}`}
                        >
                          <div className="drawer-order-header">
                            <div className="drawer-order-id-wrap">
                              <span className="drawer-order-sku">#{pedido.id}</span>
                              <span className="drawer-order-date">{pedido.data}</span>
                            </div>
                            <div className="drawer-order-badges">
                              {isUrgent && (
                                <span className="drawer-urgent-badge">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                                  </svg>
                                  URGENTE
                                </span>
                              )}
                              {getStatusBadge(pedido.status)}
                            </div>
                          </div>

                          {/* Materiais Solicitados */}
                          <div className="drawer-order-materials">
                            <span className="drawer-order-materials-label">Materiais solicitados:</span>
                            <div className="drawer-order-chips">
                              {pedido.itens && pedido.itens.length > 0 ? (
                                pedido.itens.map((it, idx) => (
                                  <span key={idx} className="drawer-mat-chip">
                                    {it.materialNome} <strong>({it.quantidade} {it.unidade})</strong>
                                  </span>
                                ))
                              ) : pedido.materiais && pedido.materiais.length > 0 ? (
                                pedido.materiais.map((m, idx) => (
                                  <span key={idx} className="drawer-mat-chip">
                                    {typeof m === 'string' ? m : `${m.materialNome || m.nome} (${m.quantidade} ${m.unidade || 'UN'})`}
                                  </span>
                                ))
                              ) : (
                                <span className="drawer-mat-chip">{pedido.material || 'Material diverso'} ({pedido.quantidade || 1})</span>
                              )}
                            </div>
                          </div>

                          {/* Justificativa */}
                          {pedido.justificativa && (
                            <div className="drawer-order-justificativa">
                              <strong>Finalidade pedagógica:</strong>
                              <p>"{pedido.justificativa}"</p>
                            </div>
                          )}

                          {/* Ações Rápidas na Gaveta se Pendente */}
                          {pedido.status === 'Pendente' && onUpdateStatus && (
                            <div className="drawer-order-actions">
                              <button
                                type="button"
                                className="drawer-btn-quick drawer-btn-quick--approve"
                                onClick={() => onUpdateStatus(pedido.id, 'Em Separação')}
                              >
                                Aprovar e Separar
                              </button>
                              <button
                                type="button"
                                className="drawer-btn-quick drawer-btn-quick--ready"
                                onClick={() => onUpdateStatus(pedido.id, 'Pronto p/ Retirada')}
                              >
                                Liberar Retirada
                              </button>
                              <button
                                type="button"
                                className="drawer-btn-quick drawer-btn-quick--reject"
                                onClick={() => onUpdateStatus(pedido.id, 'Cancelado')}
                              >
                                Recusar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="drawer-empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p>Nenhuma requisição registrada para este usuário no semestre atual.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé da Gaveta */}
            <div className="drawer-footer">
              <span className="drawer-footer-note">Sistema de Gestão Escolar (SGE) • Almoxarifado</span>
              <button type="button" className="drawer-footer-btn" onClick={onClose}>
                Fechar
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

export default UserHistoryDrawer;
