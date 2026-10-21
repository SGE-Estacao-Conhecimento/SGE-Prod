import React, { useState, useMemo } from 'react';
import NovoPedidoModal from './NovoPedidoModal';
import UserHistoryDrawer from './UserHistoryDrawer';
import './PedidosView.css';

/**
 * PedidosView
 * Módulo de Gestão Central de Pedidos (RF-003)
 * Props esperadas do backend (C# / MySQL):
 * @param {Array} pedidos - Lista de pedidos [{ id, usuario, setor, data, prioridade, status, justificativa, itens: [], materiais: [] }]
 * @param {Array} materiaisDisponiveis - Lista de materiais para seleção no cadastro
 * @param {Array} setoresDisponiveis - Lista de setores
 * @param {Array} usuariosDisponiveis - Lista de usuários
 * @param {Function} onSave - Callback chamado ao cadastrar ou atualizar pedido
 * @param {Function} onDelete - Callback chamado ao excluir um pedido
 * @param {Function} onUpdateStatus - Callback chamado ao alterar status
 */
const PedidosView = ({
  pedidos: initialPedidosProp,
  materiaisDisponiveis = [],
  setoresDisponiveis = [],
  usuariosDisponiveis = [],
  onSave,
  onUpdateStatus
}) => {
  // Estado local sincronizado com props do backend
  const [pedidos, setPedidos] = useState(initialPedidosProp || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPrioridade, setSelectedPrioridade] = useState('');
  const [selectedSetor, setSelectedSetor] = useState('');
  const [expandedPedidoId, setExpandedPedidoId] = useState(null);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleToggleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Notificação de feedback após ação rápida
  const [feedbackToast, setFeedbackToast] = useState(null);

  // Controle da Gaveta de Histórico do Solicitante
  const [drawerUser, setDrawerUser] = useState(null);

  // Controle do Modal de Novo/Editar Pedido
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState(null);

  // Sincroniza se novas props vierem do backend
  React.useEffect(() => {
    if (initialPedidosProp) {
      setPedidos(initialPedidosProp);
    }
  }, [initialPedidosProp]);

  // Setores disponíveis para filtro rápido
  const availableSetores = useMemo(() => {
    const list = new Set(['Educação Infantil', 'Ensino Fundamental', 'Coordenação', 'Apoio / Limpeza']);
    pedidos.forEach(p => {
      if (p.setor) list.add(p.setor);
    });
    setoresDisponiveis.forEach(s => {
      if (typeof s === 'string') list.add(s);
      else if (s && s.nome) list.add(s.nome);
    });
    return Array.from(list);
  }, [pedidos, setoresDisponiveis]);

  // Estatísticas calculadas dinamicamente
  const stats = useMemo(() => {
    const total = pedidos.length;
    const pendentes = pedidos.filter(p => (p.status || '').toLowerCase() === 'pendente').length;
    const atendidos = pedidos.filter(p => (p.status || '').toLowerCase() === 'atendido').length;
    const urgentes = pedidos.filter(p => p.urgente || p.prioridade === 'Urgente').length;
    return { total, pendentes, atendidos, urgentes };
  }, [pedidos]);

  // Filtragem em tempo real (Setor, Solicitante, ID, Material, Status e Prioridade)
  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      const term = searchTerm.toLowerCase().trim();
      const idMatch = String(p.id).toLowerCase().includes(term);
      const usuarioMatch = p.usuario ? p.usuario.toLowerCase().includes(term) : false;
      const setorMatch = p.setor ? p.setor.toLowerCase().includes(term) : false;
      const materiaisMatch = p.materiais
        ? p.materiais.some(m => (typeof m === 'string' ? m : m.materialNome || m.nome || '').toLowerCase().includes(term))
        : false;

      const matchSearch = !searchTerm || idMatch || usuarioMatch || setorMatch || materiaisMatch;
      const matchStatus = !selectedStatus || p.status === selectedStatus;
      const matchPrioridade = !selectedPrioridade || p.prioridade === selectedPrioridade;
      const matchSetor = !selectedSetor || p.setor === selectedSetor;

      return matchSearch && matchStatus && matchPrioridade && matchSetor;
    });

    return [...filtrados].sort((a, b) => {
      let result = 0;
      if (sortField === 'usuario') {
        result = (a.usuario || '').localeCompare(b.usuario || '', 'pt-BR');
      } else if (sortField === 'id') {
        result = (Number(a.id) || 0) - (Number(b.id) || 0);
      }
      return sortDirection === 'asc' ? result : -result;
    });
  }, [pedidos, searchTerm, selectedStatus, selectedPrioridade, selectedSetor, sortField, sortDirection]);

  const handleOpenNewModal = () => {
    setEditingPedido(null);
    setIsModalOpen(true);
  };

  // Alteração de status com feedback visual imediato
  const handleStatusChange = async (id, newStatus, customMessage) => {
    const defaultMsg =
      newStatus === 'Cancelado'
        ? `Pedido #${id} foi recusado.`
        : newStatus === 'Atendido'
        ? `Pedido #${id} marcado como atendido/entregue!`
        : `Pedido #${id} atualizado para "${newStatus}".`;

    try {
      if (onUpdateStatus) {
        await onUpdateStatus(id, newStatus);
      } else {
        setPedidos(prev => prev.map(p => (p.id === id ? { ...p, status: newStatus } : p)));
      }
      triggerToast(customMessage || defaultMsg, newStatus === 'Cancelado' ? 'danger' : 'success');
    } catch {
      triggerToast(`Não foi possível concluir a alteração do pedido #${id}.`, 'danger');
    }
  };

  const triggerToast = (message, type = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => {
      setFeedbackToast(null);
    }, 3800);
  };

  const handleSavePedido = (pedidoData) => {
    if (onSave) {
      onSave(pedidoData);
    } else {
      if (editingPedido) {
        setPedidos(prev => prev.map(p => (p.id === pedidoData.id ? pedidoData : p)));
      } else {
        setPedidos(prev => [pedidoData, ...prev]);
      }
    }
    triggerToast(`Pedido #${pedidoData.id || ''} salvo com sucesso!`, 'success');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Atendido':
        return <span className="status-badge status-badge--success">Atendido</span>;
      case 'Cancelado':
        return <span className="status-badge status-badge--danger">Cancelado</span>;
      case 'Em Separação':
        return <span className="status-badge status-badge--info">Em Separação</span>;
      case 'Pronto p/ Retirada':
        return <span className="status-badge status-badge--ready">Pronto p/ Retirada</span>;
      case 'Pendente':
      default:
        return <span className="status-badge status-badge--warning">Pendente</span>;
    }
  };

  const getPrioridadeBadge = (prioridade, isUrgent) => {
    if (isUrgent || prioridade === 'Urgente') {
      return (
        <span className="pedido-badge-urgente">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          URGENTE
        </span>
      );
    }

    switch (prioridade) {
      case 'Alta':
        return <span className="prioridade-badge prioridade-badge--alta">Alta</span>;
      case 'Normal':
      default:
        return <span className="prioridade-badge prioridade-badge--normal">Normal</span>;
    }
  };

  return (
    <div className="pedidos-container">
      {/* Toast Flutuante de Feedback */}
      {feedbackToast && (
        <div className={`pedidos-toast pedidos-toast--${feedbackToast.type}`}>
          <div className="pedidos-toast__icon">
            {feedbackToast.type === 'danger' ? 'Erro' : 'Concluído'}
          </div>
          <span>{feedbackToast.message}</span>
          <button
            type="button"
            className="pedidos-toast__close"
            onClick={() => setFeedbackToast(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Header & Ações Principais */}
      <div className="pedidos-header">
        <div>
          <h1 className="pedidos-title">Gestão Central de Pedidos</h1>
          <p className="pedidos-subtitle">
            Acompanhe, aprove e despache requisições de materiais com fluxo rápido de 1 clique.
          </p>
        </div>
        <button id="btn-novo-pedido-modulo" className="btn-novo-pedido" onClick={handleOpenNewModal}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Novo Pedido
        </button>
      </div>

      {/* Cards de Resumo Interativos */}
      <div className="pedidos-kpis" role="region" aria-label="Filtros rápidos por indicador">
        <div
          className={`pedidos-kpi-card ${!selectedStatus && !selectedPrioridade ? 'pedidos-kpi-card--active' : ''}`}
          onClick={() => { setSelectedStatus(''); setSelectedPrioridade(''); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedStatus(''); setSelectedPrioridade(''); } }}
          title="Clique para ver todos os pedidos"
        >
          <div className="pedidos-kpi-icon pedidos-kpi-icon--total">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <span className="pedidos-kpi-label">Total no Semestre</span>
            <div className="pedidos-kpi-val">{stats.total}</div>
          </div>
        </div>

        <div
          className={`pedidos-kpi-card ${selectedStatus === 'Pendente' ? 'pedidos-kpi-card--active-warning' : ''}`}
          onClick={() => {
            setSelectedPrioridade('');
            setSelectedStatus(prev => prev === 'Pendente' ? '' : 'Pendente');
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setSelectedPrioridade('');
              setSelectedStatus(prev => prev === 'Pendente' ? '' : 'Pendente');
            }
          }}
          title="Clique para filtrar pedidos aguardando aprovação"
        >
          <div className="pedidos-kpi-icon pedidos-kpi-icon--warning">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
          </div>
          <div>
            <span className="pedidos-kpi-label">Aguardando Aprovação</span>
            <div className="pedidos-kpi-val text-warning">{stats.pendentes}</div>
          </div>
        </div>

        <div
          className={`pedidos-kpi-card ${selectedPrioridade === 'Urgente' ? 'pedidos-kpi-card--active-urgente' : ''}`}
          onClick={() => {
            setSelectedStatus('');
            setSelectedPrioridade(prev => prev === 'Urgente' ? '' : 'Urgente');
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setSelectedStatus('');
              setSelectedPrioridade(prev => prev === 'Urgente' ? '' : 'Urgente');
            }
          }}
          title="Clique para filtrar pedidos com prioridade urgente"
        >
          <div className="pedidos-kpi-icon pedidos-kpi-icon--urgente">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <span className="pedidos-kpi-label">Prioridade Urgente</span>
            <div className="pedidos-kpi-val text-urgente">{stats.urgentes}</div>
          </div>
        </div>

        <div
          className={`pedidos-kpi-card ${selectedStatus === 'Atendido' ? 'pedidos-kpi-card--active-success' : ''}`}
          onClick={() => {
            setSelectedPrioridade('');
            setSelectedStatus(prev => prev === 'Atendido' ? '' : 'Atendido');
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setSelectedPrioridade('');
              setSelectedStatus(prev => prev === 'Atendido' ? '' : 'Atendido');
            }
          }}
          title="Clique para filtrar pedidos atendidos e entregues"
        >
          <div className="pedidos-kpi-icon pedidos-kpi-icon--success">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <span className="pedidos-kpi-label">Atendidos / Entregues</span>
            <div className="pedidos-kpi-val text-success">{stats.atendidos}</div>
          </div>
        </div>
      </div>

      {/* Chips de Filtro Rápido por Setor */}
      <div className="pedidos-sector-chips-bar">
        <span className="pedidos-sector-chips-label">Filtrar por Setor:</span>
        <div className="pedidos-sector-chips-list">
          <button
            type="button"
            className={`sector-chip ${!selectedSetor ? 'sector-chip--active' : ''}`}
            onClick={() => setSelectedSetor('')}
          >
            Todos os Setores ({pedidos.length})
          </button>
          {availableSetores.map(setor => {
            const count = pedidos.filter(p => p.setor === setor).length;
            return (
              <button
                key={setor}
                type="button"
                className={`sector-chip ${selectedSetor === setor ? 'sector-chip--active' : ''}`}
                onClick={() => setSelectedSetor(selectedSetor === setor ? '' : setor)}
              >
                {setor} {count > 0 && <span className="sector-chip-count">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="pedidos-filter-bar">
        <div className="pedidos-search-wrap">
          <svg className="pedidos-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="pedidos-search-input"
            placeholder="Buscar por solicitante, setor, ID ou material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="pedidos-clear-search" onClick={() => setSearchTerm('')}>
              ×
            </button>
          )}
        </div>

        <div className="pedidos-filters-right">
          <select
            className="pedidos-select-filter"
            value={selectedSetor}
            onChange={(e) => setSelectedSetor(e.target.value)}
          >
            <option value="">Todos os Setores</option>
            {availableSetores.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            className="pedidos-select-filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">Todos os Status</option>
            <option value="Pendente">Pendente</option>
            <option value="Em Separação">Em Separação</option>
            <option value="Pronto p/ Retirada">Pronto p/ Retirada</option>
            <option value="Atendido">Atendido</option>
            <option value="Cancelado">Cancelado</option>
          </select>

          <select
            className="pedidos-select-filter"
            value={selectedPrioridade}
            onChange={(e) => setSelectedPrioridade(e.target.value)}
          >
            <option value="">Todas as Prioridades</option>
            <option value="Urgente">Apenas Urgentes</option>
            <option value="Alta">Alta</option>
            <option value="Normal">Normal</option>
          </select>
        </div>
      </div>

      {/* Tabela de Pedidos com Destaque de Urgência e Ações Rápidas */}
      <div className="pedidos-table-card">
        {filteredPedidos.length > 0 ? (
          <div className="pedidos-table-wrapper">
            <table className="pedidos-table-main">
              <thead>
                <tr>
                  <th
                    style={{ width: '95px', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleToggleSort('id')}
                    title="Clique para ordenar por número"
                  >
                    Nº Pedido {sortField === 'id' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleToggleSort('usuario')}
                    title="Clique para ordenar em ordem alfabética (A-Z / Z-A)"
                  >
                    Solicitante {sortField === 'usuario' ? (sortDirection === 'asc' ? '↑ (A-Z)' : '↓ (Z-A)') : '⇅'}
                  </th>
                  <th style={{ width: '100px' }}>Data</th>
                  <th style={{ width: '125px' }}>Prioridade</th>
                  <th style={{ width: '130px' }}>Status</th>
                  <th style={{ width: '220px' }}>Ações Rápidas (1 Clique)</th>
                </tr>
              </thead>
              <tbody>
                {filteredPedidos.map(pedido => {
                  const isUrgent = pedido.urgente || pedido.prioridade === 'Urgente';
                  const isPendente = (pedido.status || '').toLowerCase() === 'pendente';
                  const isSeparacao = pedido.status === 'Em Separação';
                  const isPronto = pedido.status === 'Pronto p/ Retirada';
                  const isAtendido = pedido.status === 'Atendido';
                  const isCancelado = pedido.status === 'Cancelado';

                  return (
                    <React.Fragment key={pedido.id}>
                    <tr
                      onClick={(event) => {
                        if (event.target.closest('button')) return;
                        setExpandedPedidoId(current => current === pedido.id ? null : pedido.id);
                      }}
                      aria-expanded={expandedPedidoId === pedido.id}
                      className={`pedidos-table-row ${isUrgent ? 'pedidos-table-row--urgente' : ''}`}
                    >
                      {/* SKU / ID */}
                      <td>
                        <div className="sku-cell">
                          <span className={`pedido-sku-badge ${isUrgent ? 'pedido-sku-badge--urgente' : ''}`}>
                            #{pedido.id}
                          </span>
                        </div>
                      </td>

                      {/* Solicitante Clicável (Abre Gaveta de Histórico) */}
                      <td>
                        <button
                          type="button"
                          className="solicitante-cell-btn"
                          onClick={() => setDrawerUser({ nome: pedido.usuario, setor: pedido.setor })}
                          title={`Clique para abrir prontuário e histórico semestral de ${pedido.usuario}`}
                        >
                          <div className={`solicitante-avatar ${isUrgent ? 'solicitante-avatar--urgente' : ''}`}>
                            {pedido.usuario ? pedido.usuario.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="solicitante-info">
                            <div className="solicitante-name-row">
                              <span className="solicitante-name">{pedido.usuario || 'Não informado'}</span>
                              <span className="solicitante-history-tag">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                                Histórico
                              </span>
                            </div>
                          </div>
                        </button>
                      </td>

                      {/* Data */}
                      <td>
                        <span className="data-text">{pedido.data || '—'}</span>
                      </td>

                      {/* Prioridade com Destaque de Urgência */}
                      <td>{getPrioridadeBadge(pedido.prioridade, isUrgent)}</td>

                      {/* Status Atual */}
                      <td>
                        <div className="status-dropdown-wrap">
                          {getStatusBadge(pedido.status)}
                        </div>
                      </td>

                      {/* Ações Rápidas em 1 Clique */}
                      <td>
                        <div className="quick-actions-bar">
                          {isPendente && (
                            <>
                              <button
                                type="button"
                                className="btn-quick-action btn-quick-action--approve"
                                onClick={() =>
                                  handleStatusChange(pedido.id, 'Em Separação', `Pedido #${pedido.id} aprovado! Em separação.`)
                                }
                                title="Aprovar solicitação e iniciar separação no estoque"
                              >
                              Aprovar
                              </button>
                              <button
                                type="button"
                                className="btn-quick-action btn-quick-action--ready"
                                onClick={() =>
                                  handleStatusChange(pedido.id, 'Pronto p/ Retirada', `Pedido #${pedido.id} liberado para retirada!`)
                                }
                                title="Liberar diretamente para retirada na recepção"
                              >
                                Liberar
                              </button>
                              <button
                                type="button"
                                className="btn-quick-action btn-quick-action--reject"
                                onClick={() =>
                                  handleStatusChange(pedido.id, 'Cancelado', `Pedido #${pedido.id} recusado.`)
                                }
                                title="Recusar requisição"
                              >
                              Recusar
                              </button>
                            </>
                          )}

                          {isSeparacao && (
                            <>
                              <button
                                type="button"
                                className="btn-quick-action btn-quick-action--ready"
                                onClick={() =>
                                  handleStatusChange(pedido.id, 'Pronto p/ Retirada', `Pedido #${pedido.id} pronto para retirada!`)
                                }
                                title="Concluir separação e avisar solicitante"
                              >
                                Liberar Retirada
                              </button>
                              <button
                                type="button"
                                className="btn-quick-action btn-quick-action--reject"
                                onClick={() => handleStatusChange(pedido.id, 'Cancelado')}
                                title="Cancelar separação"
                              >
                              Fechar
                              </button>
                            </>
                          )}

                          {isPronto && (
                            <button
                              type="button"
                              className="btn-quick-action btn-quick-action--finish"
                              onClick={() =>
                                handleStatusChange(pedido.id, 'Atendido', `Pedido #${pedido.id} entregue ao solicitante!`)
                              }
                              title="Confirmar entrega e finalizar requisição"
                            >
                              Concluir Entrega
                            </button>
                          )}

                          {isAtendido && (
                            <div className="quick-action-status-box">
                              <span className="quick-action-status-tag text-success">Concluído</span>
                              <button
                                type="button"
                                className="btn-quick-action btn-quick-action--neutral"
                                onClick={() => handleStatusChange(pedido.id, 'Pendente', `Pedido #${pedido.id} reaberto.`)}
                                title="Reabrir este pedido como pendente"
                              >
                                Reabrir
                              </button>
                            </div>
                          )}

                          {isCancelado && (
                            <div className="quick-action-status-box">
                              <span className="quick-action-status-tag text-danger">Recusado</span>
                              <button
                                type="button"
                                className="btn-quick-action btn-quick-action--neutral"
                                onClick={() => handleStatusChange(pedido.id, 'Pendente', `Pedido #${pedido.id} reativado.`)}
                                title="Reativar requisição"
                              >
                                Reativar
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                    </tr>
                    {expandedPedidoId === pedido.id && (
                      <tr className="pedido-details-row">
                        <td colSpan="6">
                          <div className="pedido-details-panel">
                            <div>
                              <span className="pedido-details-label">Setor</span>
                              <strong>{pedido.setor || 'Geral'}</strong>
                            </div>
                            <div className="pedido-details-justificativa">
                              <span className="pedido-details-label">Justificativa</span>
                              <span>{pedido.justificativa || 'Nenhuma justificativa informada.'}</span>
                            </div>
                            <div className="pedido-details-materiais">
                              <span className="pedido-details-label">Materiais solicitados</span>
                              <div className="pedidos-materiais-list">
                                {pedido.itens?.length > 0 ? pedido.itens.map((it, idx) => (
                                  <span key={idx} className="pedido-mat-chip">{it.materialNome} <strong>({it.quantidade} {it.unidade})</strong></span>
                                )) : pedido.materiais?.length > 0 ? pedido.materiais.map((m, idx) => (
                                  <span key={idx} className="pedido-mat-chip">{typeof m === 'string' ? m : `${m.materialNome || m.nome} (${m.quantidade} ${m.unidade || 'UN'})`}</span>
                                )) : (
                                  <span className="pedido-mat-chip">{pedido.material || 'Material diverso'} ({pedido.quantidade || 1})</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="pedidos-empty-state">
            <div className="empty-icon">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10,9 9,9 8,9" />
              </svg>
            </div>
            <h4>Nenhum pedido encontrado</h4>
            <p>
              {searchTerm || selectedStatus || selectedPrioridade || selectedSetor
                ? 'Nenhum pedido corresponde aos filtros e buscas selecionados.'
                : 'Não há requisições registradas no sistema até o momento.'}
            </p>
            {searchTerm || selectedStatus || selectedPrioridade || selectedSetor ? (
              <button
                className="btn-clear-filters"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedStatus('');
                  setSelectedPrioridade('');
                  setSelectedSetor('');
                }}
              >
                Limpar Todos os Filtros
              </button>
            ) : (
              <button className="btn-novo-pedido" onClick={handleOpenNewModal}>
                + Registrar Primeiro Pedido
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição */}
      <NovoPedidoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePedido}
        initialData={editingPedido}
        materiaisDisponiveis={materiaisDisponiveis}
        usuariosDisponiveis={usuariosDisponiveis}
      />

      {/* Gaveta Lateral de Histórico Semestral do Solicitante */}
      <UserHistoryDrawer
        isOpen={!!drawerUser}
        onClose={() => setDrawerUser(null)}
        userName={drawerUser?.nome}
        userSector={drawerUser?.setor}
        usuarios={usuariosDisponiveis}
        pedidos={pedidos}
        onFilterUserInTable={(name) => {
          setSearchTerm(name);
          setDrawerUser(null);
        }}
        onUpdateStatus={handleStatusChange}
      />
    </div>
  );
};

export default PedidosView;
