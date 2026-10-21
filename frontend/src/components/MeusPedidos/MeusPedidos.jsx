import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StatusBadge, BottomSheetModal, SortLoopButton } from '../common';
import './MeusPedidos.css';

const OPCOES_ORDENACAO_PEDIDOS = [
  { id: 'alfabetica-asc', label: 'Nome (A - Z)' },
  { id: 'alfabetica-desc', label: 'Nome (Z - A)' },
  { id: 'recente', label: 'Mais recentes' }
];

/**
 * MeusPedidos - Visualização Clean & Mobile-First dos Pedidos do Usuário
 * Dois filtros principais:
 *  - Pendentes: Solicitações em andamento / aguardando separação
 *  - Concluídos: Pedidos atendidos / entregues ou cancelados (histórico)
 */
const MeusPedidos = ({
  pedidos: initialPedidosProp = [],
  onCancelarPedido,
  onNavigateToEstoque,
  onPedirNovamente
}) => {
  const [pedidos, setPedidos] = useState(initialPedidosProp || []);
  const [statusFilter, setStatusFilter] = useState('pendente'); // 'pendente' | 'concluido' | 'todos'
  const [searchTerm, setSearchTerm] = useState('');
  const [cancelModalPedido, setCancelModalPedido] = useState(null);
  const [cancelandoPedido, setCancelandoPedido] = useState(false);
  const [reorderModalPedido, setReorderModalPedido] = useState(null);
  const [reordenandoPedido, setReordenandoPedido] = useState(false);
  const [toastFeedback, setToastFeedback] = useState(null);
  const [ordenacao, setOrdenacao] = useState('alfabetica-asc');

  // Alterna o modo de ordenação dos pedidos em loop
  const handleCiclarOrdenacao = () => {
    const currentIndex = OPCOES_ORDENACAO_PEDIDOS.findIndex(op => op.id === ordenacao);
    const nextIndex = (currentIndex + 1) % OPCOES_ORDENACAO_PEDIDOS.length;
    setOrdenacao(OPCOES_ORDENACAO_PEDIDOS[nextIndex].id);
  };

  const ordenacaoAtual = useMemo(() => {
    return OPCOES_ORDENACAO_PEDIDOS.find(op => op.id === ordenacao) || OPCOES_ORDENACAO_PEDIDOS[0];
  }, [ordenacao]);

  // Extrai nome do material do pedido para ordenação alfabética consistente
  const getNomeMaterialPedido = (p) => {
    if (Array.isArray(p.itens) && p.itens.length > 0) {
      return p.itens[0]?.materialNome || p.itens[0]?.nome || '';
    }
    if (Array.isArray(p.materiais) && p.materiais.length > 0) {
      const first = p.materiais[0];
      return typeof first === 'string' ? first : first?.materialNome || first?.nome || '';
    }
    return p.material || '';
  };

  // Sincroniza estado com as props
  React.useEffect(() => {
    if (initialPedidosProp) {
      setPedidos(initialPedidosProp);
    }
  }, [initialPedidosProp]);

  // Extrai lista uniforme de materiais/itens de um pedido (suporta item único ou pedido em lote)
  const getItensPedido = (p) => {
    if (!p) return [];
    if (Array.isArray(p.itens) && p.itens.length > 0) {
      return p.itens.map(it => ({
        materialNome: it.materialNome || it.nome,
        quantidade: it.quantidade || 1,
        unidade: it.unidade || 'UN',
        produtoId: it.produtoId
      }));
    }
    if (Array.isArray(p.materiais) && p.materiais.length > 0) {
      return p.materiais.map(m => typeof m === 'string' ? { materialNome: m, quantidade: 1, unidade: 'UN' } : {
        materialNome: m.materialNome || m.nome,
        quantidade: m.quantidade || 1,
        unidade: m.unidade || 'UN',
        produtoId: m.produtoId
      });
    }
    return [{
      materialNome: p.material || 'Material Solicitado',
      quantidade: p.quantidade || 1,
      unidade: p.unidade || 'UN',
      produtoId: p.produtoId
    }];
  };

  // Identifica o último pedido atendido pelo almoxarifado
  const ultimoPedidoAtendido = useMemo(() => {
    const atendidos = pedidos.filter(p => {
      const s = (p.status || '').toLowerCase();
      return s === 'atendido' || s === 'entregue';
    });
    if (atendidos.length === 0) return null;
    return [...atendidos].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0];
  }, [pedidos]);

  // Confirmação e geração do novo pedido com os exatos mesmos itens
  const handleConfirmarPedirNovamente = async () => {
    if (!reorderModalPedido || reordenandoPedido) return;
    setReordenandoPedido(true);

    try {
      const itensOriginais = getItensPedido(reorderModalPedido);
      const resumoMaterial = itensOriginais.length === 1
        ? itensOriginais[0].materialNome
        : itensOriginais.map(m => `${m.materialNome} (${m.quantidade} ${m.unidade})`).join(', ');

      const totalQtd = itensOriginais.reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);
      const unidadePadrao = itensOriginais[0]?.unidade || 'UN';

      let novoId;
      if (onPedirNovamente) {
        const criado = await onPedirNovamente({
          material: resumoMaterial,
          quantidade: totalQtd,
          unidade: unidadePadrao,
          itens: itensOriginais,
          materiais: itensOriginais,
          justificativa: `Re-solicitação idêntica ao Pedido #${reorderModalPedido.id}`,
          prioridade: reorderModalPedido.prioridade || 'Normal',
          urgente: !!reorderModalPedido.urgente
        });
        novoId = criado?.id;
      } else {
        novoId = Math.max(...pedidos.map(p => p.id), 100) + 1;
        const novo = {
          id: novoId,
          data: new Date().toLocaleDateString('pt-BR'),
          material: resumoMaterial,
          quantidade: totalQtd,
          materiais: itensOriginais,
          itens: itensOriginais,
          justificativa: `Re-solicitação idêntica ao Pedido #${reorderModalPedido.id}`,
          prioridade: reorderModalPedido.prioridade || 'Normal',
          urgente: !!reorderModalPedido.urgente,
          status: 'Pendente'
        };
        setPedidos(prev => [novo, ...prev]);
      }

      setStatusFilter('pendente');
      setReorderModalPedido(null);

      const detalheTexto = itensOriginais.length === 1
        ? `${itensOriginais[0].quantidade} ${itensOriginais[0].unidade} de "${itensOriginais[0].materialNome}" enviado para a fila.`
        : `${itensOriginais.length} materiais enviados para a fila do almoxarifado.`;

      setToastFeedback({
        id: novoId || reorderModalPedido.id,
        titulo: `Pedido #${novoId || ''} gerado novamente!`,
        detalhe: detalheTexto
      });

      setTimeout(() => {
        setToastFeedback(null);
      }, 4500);
    } catch (error) {
      setToastFeedback({
        id: `err-${Date.now()}`,
        titulo: 'Erro ao repetir pedido',
        detalhe: error?.message || 'Tente novamente mais tarde.'
      });
      setTimeout(() => setToastFeedback(null), 4500);
    } finally {
      setReordenandoPedido(false);
    }
  };

  // Contadores dinâmicos
  const contadores = useMemo(() => {
    const pendentes = pedidos.filter(p => {
      const s = (p.status || '').toLowerCase();
      return s === 'pendente' || s === 'em separação' || s === 'pronto';
    }).length;

    const concluidos = pedidos.filter(p => {
      const s = (p.status || '').toLowerCase();
      return s === 'atendido' || s === 'entregue' || s === 'cancelado' || s === 'recusado';
    }).length;

    return { pendentes, concluidos, total: pedidos.length };
  }, [pedidos]);

  // Filtragem dos pedidos
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(p => {
      const s = (p.status || '').toLowerCase();
      const isPendente = s === 'pendente' || s === 'em separação' || s === 'pronto';
      const isConcluido = s === 'atendido' || s === 'entregue' || s === 'cancelado' || s === 'recusado';

      if (statusFilter === 'pendente' && !isPendente) return false;
      if (statusFilter === 'concluido' && !isConcluido) return false;

      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      const idMatch = String(p.id || '').toLowerCase().includes(term);
      const matMatch = p.materiais
        ? p.materiais.some(m => (typeof m === 'string' ? m : m.materialNome || m.nome || '').toLowerCase().includes(term))
        : (p.material || '').toLowerCase().includes(term);
      const justMatch = (p.justificativa || '').toLowerCase().includes(term);

      return idMatch || matMatch || justMatch;
    });

    return [...filtrados].sort((a, b) => {
      if (ordenacao === 'alfabetica-asc') {
        const nomeA = getNomeMaterialPedido(a);
        const nomeB = getNomeMaterialPedido(b);
        return nomeA.localeCompare(nomeB, 'pt-BR');
      }
      if (ordenacao === 'alfabetica-desc') {
        const nomeA = getNomeMaterialPedido(a);
        const nomeB = getNomeMaterialPedido(b);
        return nomeB.localeCompare(nomeA, 'pt-BR');
      }
      // 'recente' (padrão decrescente por ID / data)
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }, [pedidos, statusFilter, searchTerm, ordenacao]);

  // Confirmar cancelamento
  const handleConfirmCancel = async () => {
    if (!cancelModalPedido) return;

    const pedidoId = cancelModalPedido.id;
    if (cancelandoPedido) return;
    setCancelandoPedido(true);
    try {
      if (onCancelarPedido) {
        await onCancelarPedido(pedidoId);
      }

      setPedidos(prev => prev.map(p => (
        p.id === pedidoId ? { ...p, status: 'Cancelado' } : p
      )));
      setToastFeedback({
        id: `cancel-${pedidoId}`,
        titulo: `Pedido #${pedidoId} cancelado`,
        detalhe: 'A solicitação foi removida da fila de separação.'
      });
      setTimeout(() => setToastFeedback(null), 4500);
      setCancelModalPedido(null);
    } catch (error) {
      setToastFeedback({
        id: `cancel-error-${pedidoId}`,
        titulo: `Não foi possível cancelar o Pedido #${pedidoId}`,
        detalhe: error?.message || 'Verifique se o pedido ainda está pendente.'
      });
      setTimeout(() => setToastFeedback(null), 5000);
    } finally {
      setCancelandoPedido(false);
    }
  };

  return (
    <div className="meus-pedidos-container">
      {/* Toast flutuante de feedback de Pedir Novamente */}
      <AnimatePresence>
        {toastFeedback && (
          <motion.div
            className="meus-pedidos__toast"
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
          >
            <div className="meus-pedidos__toast-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="meus-pedidos__toast-text">
              <strong>{toastFeedback.titulo}</strong>
              <span>{toastFeedback.detalhe}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI: Último Pedido Atendido */}
      {ultimoPedidoAtendido && (
        <div className="kpi-ultimo-atendido-card">
          <div className="kpi-ultimo-atendido__left">
            <div className="kpi-ultimo-atendido__badge-row">
              <span className="kpi-ultimo-atendido__tag">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Último Pedido Atendido
              </span>
              <span className="kpi-ultimo-atendido__meta">
                #{ultimoPedidoAtendido.id} • {ultimoPedidoAtendido.data || 'Atendido'}
              </span>
            </div>

            <div className="kpi-ultimo-atendido__items-preview">
              {(() => {
                const itens = getItensPedido(ultimoPedidoAtendido);
                if (itens.length === 1) {
                  return (
                    <span className="kpi-ultimo-atendido__material-destaque">
                      <strong>{itens[0].materialNome || itens[0].nome}</strong>
                      <span className="kpi-ultimo-atendido__qtd">({itens[0].quantidade} {itens[0].unidade || 'UN'})</span>
                    </span>
                  );
                }
                return (
                  <div className="kpi-ultimo-atendido__multi-items">
                    <span className="kpi-ultimo-atendido__material-destaque">
                      <strong>{itens.length} materiais:</strong> {itens.map(it => `${it.materialNome || it.nome} (${it.quantidade} ${it.unidade || 'UN'})`).join(', ')}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="kpi-ultimo-atendido__action">
            <motion.button
              type="button"
              className="btn-kpi-pedir-novamente"
              onClick={() => setReorderModalPedido(ultimoPedidoAtendido)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              title={`Pedir de novo os materiais do Pedido #${ultimoPedidoAtendido.id}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Pedir de novo</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* Segmented Control de 2 Filtros: Pendentes e Concluídos com Motion Capsule */}
      <div className="pedidos-segmented-control" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === 'pendente'}
          className={`segmented-btn ${statusFilter === 'pendente' ? 'segmented-btn--active' : ''}`}
          onClick={() => setStatusFilter('pendente')}
        >
          {statusFilter === 'pendente' && (
            <motion.div
              layoutId="meusPedidosSegmentedIndicator"
              className="segmented-btn__indicator"
              transition={{ type: "spring", stiffness: 450, damping: 35 }}
            />
          )}
          <span className="segmented-btn__label">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Pendentes
            {contadores.pendentes > 0 && (
              <span className="segmented-badge">{contadores.pendentes}</span>
            )}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={statusFilter === 'concluido'}
          className={`segmented-btn ${statusFilter === 'concluido' ? 'segmented-btn--active' : ''}`}
          onClick={() => setStatusFilter('concluido')}
        >
          {statusFilter === 'concluido' && (
            <motion.div
              layoutId="meusPedidosSegmentedIndicator"
              className="segmented-btn__indicator"
              transition={{ type: "spring", stiffness: 450, damping: 35 }}
            />
          )}
          <span className="segmented-btn__label">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Concluídos
            {contadores.concluidos > 0 && (
              <span className="segmented-badge segmented-badge--concluido">{contadores.concluidos}</span>
            )}
          </span>
        </button>
      </div>

      {/* Barra de Busca rápida e Ordenação (visível quando há pedidos) */}
      {pedidos.length > 0 && (
        <div className="meus-pedidos__toolbar">
          <div className="meus-pedidos__search-wrap">
            <svg className="meus-pedidos__search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="search-pedidos-input"
              type="text"
              className="meus-pedidos__search-input"
              placeholder="Buscar por material ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="meus-pedidos__clear-btn"
                onClick={() => setSearchTerm('')}
                aria-label="Limpar busca"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <div className="meus-pedidos__meta-bar">
            <span className="meus-pedidos__count">
              {pedidosFiltrados.length === 1 ? '1 pedido' : `${pedidosFiltrados.length} pedidos`}
            </span>
            <SortLoopButton
              currentLabel={ordenacaoAtual.label}
              onToggleSort={handleCiclarOrdenacao}
              title={`Ordenado por: ${ordenacaoAtual.label}. Toque para alternar.`}
            />
          </div>
        </div>
      )}

      {/* Lista de Pedidos com Transição Limpa em Bloco por Aba (Opção A) */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={statusFilter}
          className="pedidos-list"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
        >
          {pedidosFiltrados.length === 0 ? (
            <div className="pedidos-empty-state">
              <div className="empty-state-icon">
                {statusFilter === 'pendente' ? (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
              </div>
              <h3 className="empty-state-title">
                {searchTerm
                  ? 'Nenhum pedido encontrado'
                  : statusFilter === 'pendente'
                  ? 'Nenhum pedido pendente'
                  : 'Nenhum pedido no histórico'}
              </h3>
              <p className="empty-state-desc">
                {searchTerm
                  ? 'Tente buscar por outro nome ou limpe a busca.'
                  : statusFilter === 'pendente'
                  ? 'Você não tem solicitações em andamento no momento.'
                  : 'Os pedidos que você já retirou ou cancelou aparecerão aqui.'}
              </p>

              {statusFilter === 'pendente' && onNavigateToEstoque && (
                <button
                  type="button"
                  className="btn-ir-estoque"
                  onClick={onNavigateToEstoque}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  </svg>
                  Consultar Estoque de Materiais
                </button>
              )}
            </div>
          ) : (
            pedidosFiltrados.map((pedido) => {
              const statusNorm = (pedido.status || '').toLowerCase();
              const isPendente = statusNorm === 'pendente' || statusNorm === 'em separação';
              const isPronto = statusNorm === 'pronto';
              const isCancelado = statusNorm === 'cancelado';
              const isUrgente = (pedido.prioridade || '').toLowerCase() === 'urgente' || !!pedido.urgente;

              return (
                <div
                  key={pedido.id}
                  className={`pedido-card ${isPendente ? 'pedido-card--pendente' : ''} ${isPronto ? 'pedido-card--pronto' : ''} ${isCancelado ? 'pedido-card--cancelado' : ''} ${isUrgente ? 'pedido-card--urgente' : ''}`}
                >
                  {/* Linha Superior: Status, Urgência e Metadados */}
                  <div className="pedido-card__header">
                    <div className="pedido-card__header-badges">
                      <StatusBadge status={pedido.status} />
                      {isUrgente && (
                        <StatusBadge status="urgente" />
                      )}
                    </div>
                    <span className="pedido-card__meta">
                      #{pedido.id} • {pedido.data || 'Hoje'}
                    </span>
                  </div>

                  {/* Materiais Solicitados */}
                  <div className="pedido-card__items">
                    {pedido.materiais && pedido.materiais.length > 0 ? (
                      pedido.materiais.map((mat, idx) => (
                        <div key={idx} className="pedido-item-row">
                          <span className="pedido-item-bullet">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                            </svg>
                          </span>
                          <span className="pedido-item-nome">
                            {typeof mat === 'string' ? mat : mat.materialNome || mat.nome}
                          </span>
                          <span className="pedido-item-qtd">
                            {typeof mat === 'object' && mat.quantidade ? `${mat.quantidade} ${mat.unidade || 'UN'}` : ''}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="pedido-item-row">
                        <span className="pedido-item-bullet">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                            </svg>
                          </span>
                        <span className="pedido-item-nome">{pedido.material || 'Material Solicitado'}</span>
                        <span className="pedido-item-qtd">
                          {pedido.quantidade ? `${pedido.quantidade} ${pedido.unidade || 'UN'}` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Justificativa (se informada) */}
                  {pedido.justificativa && (
                    <div className="pedido-card__justificativa">
                      <span className="justificativa-label">Finalidade:</span> {pedido.justificativa}
                    </div>
                  )}

                  {/* Destaque para retirada pronta */}
                  {isPronto && (
                    <div className="pedido-card__alerta-retirada">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>Disponível para retirada no <strong>Almoxarifado Central (Prédio A)</strong></span>
                    </div>
                  )}

                  {/* Rodapé com Ações do Pedido */}
                  <div className="pedido-card__footer">
                    {isPendente ? (
                      <button
                        type="button"
                        className="btn-cancelar-solicitacao"
                        onClick={() => setCancelModalPedido(pedido)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        Cancelar Pedido
                      </button>
                    ) : (
                      <motion.button
                        type="button"
                        className="btn-pedir-novamente"
                        onClick={() => setReorderModalPedido(pedido)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        title="Solicitar novamente este material com confirmação"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                        </svg>
                        Pedir Novamente
                      </motion.button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modal / Bottom Sheet Universal de Confirmação de Cancelamento (A Geral do SGE) */}
      <BottomSheetModal
        isOpen={!!cancelModalPedido}
        onClose={() => setCancelModalPedido(null)}
        className="cancel-order-modal"
        title={cancelModalPedido ? `Cancelar Pedido #${cancelModalPedido.id}?` : ''}
        subtitle="Confirmação de Cancelamento"
        footer={
          <div className="cancel-modal-actions" style={{ display: 'flex', width: '100%', gap: '10px' }}>
            <motion.button
              type="button"
              className="btn-cancel-modal-voltar"
              onClick={() => setCancelModalPedido(null)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              Manter Pedido
            </motion.button>
            <motion.button
              type="button"
              className="btn-cancel-modal-confirmar"
              disabled={cancelandoPedido}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleConfirmCancel();
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {cancelandoPedido ? 'Cancelando...' : 'Sim, Cancelar'}
            </motion.button>
          </div>
        }
      >
        {cancelModalPedido && (
          <div className="cancel-modal-content" style={{ textAlign: 'center', padding: '4px 0 12px' }}>
            <div className="cancel-modal-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>

            <div className="cancel-modal-item-preview">
              <strong>{cancelModalPedido.materiais?.[0]?.materialNome || cancelModalPedido.material || 'Material'}</strong>
              <span>{cancelModalPedido.quantidade ? `${cancelModalPedido.quantidade} ${cancelModalPedido.unidade || 'UN'}` : ''}</span>
            </div>

            <p className="cancel-modal-desc">
              Esta solicitação será removida da fila de separação do almoxarifado. Esta ação não poderá ser desfeita.
            </p>
          </div>
        )}
      </BottomSheetModal>

      {/* Modal / Bottom Sheet de Confirmação para Pedir de Novo (A Geral do SGE) */}
      <BottomSheetModal
        isOpen={!!reorderModalPedido}
        onClose={() => setReorderModalPedido(null)}
        className="reorder-confirm-modal"
        title={reorderModalPedido ? `Repetir Pedido #${reorderModalPedido.id}?` : ''}
        subtitle="Confirmação de Re-solicitação"
        footer={
          <div className="cancel-modal-actions" style={{ display: 'flex', width: '100%', gap: '10px' }}>
            <motion.button
              type="button"
              className="btn-cancel-modal-voltar"
              onClick={() => setReorderModalPedido(null)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              Cancelar
            </motion.button>
            <motion.button
              type="button"
              className="btn-reorder-modal-confirmar"
              disabled={reordenandoPedido}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleConfirmarPedirNovamente();
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {reordenandoPedido ? 'Gerando pedido...' : 'Confirmar e Pedir'}
            </motion.button>
          </div>
        }
      >
        {reorderModalPedido && (
          <div className="reorder-modal-content">
            <div className="reorder-modal-icon-badge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
            </div>
            <p className="reorder-modal-desc">
              Um novo pedido será gerado para o almoxarifado com os <strong>exatos mesmos materiais</strong> do Pedido #{reorderModalPedido.id}:
            </p>
            <div className="reorder-modal-items-box">
              {getItensPedido(reorderModalPedido).map((it, idx) => (
                <div key={idx} className="reorder-modal-item-row">
                  <span className="reorder-modal-item-bullet">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                  </span>
                  <span className="reorder-modal-item-nome">{it.materialNome || it.nome}</span>
                  <span className="reorder-modal-item-qtd">{it.quantidade} {it.unidade || 'UN'}</span>
                </div>
              ))}
            </div>
            {reorderModalPedido.justificativa && (
              <p className="reorder-modal-justificativa-hint">
                <span className="justificativa-label">Finalidade original:</span> {reorderModalPedido.justificativa}
              </p>
            )}
          </div>
        )}
      </BottomSheetModal>
    </div>
  );
};

export default MeusPedidos;
