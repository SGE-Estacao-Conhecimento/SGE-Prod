import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StatusBadge, BottomSheetModal, SortLoopButton, SegmentedTabs } from '../common';
import { DEMO_MATERIAIS } from '../../data/demoData';
import './MeusPedidos.css';

const OPCOES_ORDENACAO_PEDIDOS = [
  { id: 'recente', label: 'Mais recentes' },
  { id: 'antigo', label: 'Mais antigos' },
  { id: 'alfabetica-asc', label: 'Nome (A - Z)' }
];

/**
 * MeusPedidos — Gestão e Visualização de Pedidos do Usuário (SGE)
 * 
 * - Estrutura de Lote / Caderneta: suporta pedidos com múltiplos materiais.
 * - Sanfona Opção B: exibe os 2 primeiros materiais e colapsa os demais com expansão suave.
 * - Ciclo de Status Completo: Aguardando Separação, Em Separação, Pronto para Retirada, 
 *   Parcialmente Disponível, Entregue, Estoque Insuficiente e Cancelado.
 * - Ações Duplas: 'Repetir Pedido' e 'Adicionar à Caderneta'.
 */
const MeusPedidos = ({
  pedidos: initialPedidosProp = [],
  user,
  onCancelarPedido,
  onNavigateToEstoque,
  onPedirNovamente
}) => {
  const [pedidos, setPedidos] = useState(initialPedidosProp || []);
  const [statusFilter, setStatusFilter] = useState('andamento'); // 'andamento' | 'historico' | 'todos'
  const [searchTerm, setSearchTerm] = useState('');
  const [ordenacao, setOrdenacao] = useState('recente');
  const [expandedPedidos, setExpandedPedidos] = useState({});
  const [cancelModalPedido, setCancelModalPedido] = useState(null);
  const [cancelandoPedido, setCancelandoPedido] = useState(false);
  const [reorderModalPedido, setReorderModalPedido] = useState(null);
  const [reordenandoPedido, setReordenandoPedido] = useState(false);
  const [toastFeedback, setToastFeedback] = useState(null);

  // Sincroniza estado com as props
  React.useEffect(() => {
    if (initialPedidosProp) {
      setPedidos(initialPedidosProp);
    }
  }, [initialPedidosProp]);

  // Alterna o modo de ordenação em loop
  const handleCiclarOrdenacao = () => {
    const currentIndex = OPCOES_ORDENACAO_PEDIDOS.findIndex(op => op.id === ordenacao);
    const nextIndex = (currentIndex + 1) % OPCOES_ORDENACAO_PEDIDOS.length;
    setOrdenacao(OPCOES_ORDENACAO_PEDIDOS[nextIndex].id);
  };

  const ordenacaoAtual = useMemo(() => {
    return OPCOES_ORDENACAO_PEDIDOS.find(op => op.id === ordenacao) || OPCOES_ORDENACAO_PEDIDOS[0];
  }, [ordenacao]);

  // Alterna o estado de expansão de materiais de um pedido
  const toggleExpand = useCallback((pedidoId) => {
    setExpandedPedidos(prev => ({
      ...prev,
      [pedidoId]: !prev[pedidoId]
    }));
  }, []);

  // Normalização do status do pedido
  const normalizarStatus = (status = '') => {
    const s = String(status).toLowerCase().trim();
    if (s.includes('insuficiente') || s.includes('falta') || s.includes('recusad')) return 'estoque-insuficiente';
    if (s === 'atendido-parcialmente' || s === 'atendido parcialmente' || s.includes('atendido parc')) return 'atendido-parcialmente';
    if (s.includes('parcial')) return 'parcialmente-disponivel';
    if (s.includes('pronto')) return 'pronto';
    if (s.includes('separ')) return 'em-separacao';
    if (s.includes('pendent') || s.includes('aguard')) return 'aguardando-separacao';
    if (s.includes('atendid') || s.includes('entreg') || s.includes('conclui')) return 'entregue';
    if (s.includes('cancel')) return 'cancelado';
    return s || 'aguardando-separacao';
  };

  const isStatusAndamento = (status) => {
    const norm = normalizarStatus(status);
    return norm === 'aguardando-separacao' || norm === 'em-separacao' || norm === 'pronto' || norm === 'parcialmente-disponivel';
  };

  const isStatusHistorico = (status) => {
    const norm = normalizarStatus(status);
    return norm === 'entregue' || norm === 'atendido-parcialmente' || norm === 'estoque-insuficiente' || norm === 'cancelado';
  };

  // Extrai lista uniforme de materiais/itens de um pedido (suporta item único ou lote da caderneta)
  const getItensPedido = (p) => {
    if (!p) return [];

    const resolverNome = (it) => {
      const nome = it?.materialNome || it?.nome || it?.material;
      if (nome && String(nome).trim() && nome !== 'undefined') return nome;
      const id = it?.produtoId || it?.id;
      if (id) {
        const mat = DEMO_MATERIAIS.find(m => Number(m.id) === Number(id));
        if (mat?.nome) return mat.nome;
      }
      return 'Material Solicitado';
    };

    const resolverUnidade = (it) => {
      const unid = it?.unidade;
      if (unid && String(unid).trim() && unid !== 'undefined') return unid;
      const id = it?.produtoId || it?.id;
      if (id) {
        const mat = DEMO_MATERIAIS.find(m => Number(m.id) === Number(id));
        if (mat?.unidade) return mat.unidade;
      }
      return 'UN';
    };

    if (Array.isArray(p.itens) && p.itens.length > 0) {
      return p.itens.map(it => ({
        materialNome: resolverNome(it),
        quantidade: it.quantidade || 1,
        unidade: resolverUnidade(it),
        produtoId: it.produtoId || it.id,
        disponivel: it.disponivel !== false && it.status !== 'falta',
        quantidadeAtendida: it.quantidadeAtendida
      }));
    }
    if (Array.isArray(p.materiais) && p.materiais.length > 0) {
      return p.materiais.map(m => typeof m === 'string' ? { materialNome: m, quantidade: 1, unidade: 'UN', disponivel: true } : {
        materialNome: resolverNome(m),
        quantidade: m.quantidade || 1,
        unidade: resolverUnidade(m),
        produtoId: m.produtoId || m.id,
        disponivel: m.disponivel !== false && m.status !== 'falta',
        quantidadeAtendida: m.quantidadeAtendida
      });
    }
    return [{
      materialNome: p.material || 'Material Solicitado',
      quantidade: p.quantidade || 1,
      unidade: p.unidade || 'UN',
      produtoId: p.produtoId,
      disponivel: true,
      quantidadeAtendida: p.quantidadeAtendida
    }];
  };

  // Extrai nome principal para ordenação alfabética
  const getNomeMaterialPedido = (p) => {
    const itens = getItensPedido(p);
    return itens[0]?.materialNome || p.material || '';
  };

  // Métricas rápidas no topo
  const metricas = useMemo(() => {
    let emAndamento = 0;
    let prontosRetirada = 0;
    let concluidos = 0;

    pedidos.forEach(p => {
      const norm = normalizarStatus(p.status);
      if (isStatusAndamento(p.status)) emAndamento++;
      if (norm === 'pronto' || norm === 'parcialmente-disponivel') prontosRetirada++;
      if (norm === 'entregue' || norm === 'atendido-parcialmente') concluidos++;
    });

    const historico = pedidos.length - emAndamento;
    return { emAndamento, prontosRetirada, concluidos, historico, total: pedidos.length };
  }, [pedidos]);

  // Adicionar materiais de um pedido diretamente à Caderneta
  const handleAdicionarACaderneta = (pedidoAlvo) => {
    const itens = getItensPedido(pedidoAlvo);
    if (itens.length === 0) return;

    const userKey = user?.matricula || user?.email || user?.id || user?.identifier || 'usuario';
    const storageKey = `sge_caderneta_${userKey}`;

    try {
      const saved = localStorage.getItem(storageKey);
      const cadernetaAtual = saved ? JSON.parse(saved) : [];

      let novosAdicionados = 0;
      let novaCaderneta = [...cadernetaAtual];

      itens.forEach(it => {
        const idItem = it.produtoId || it.materialNome;
        const idx = novaCaderneta.findIndex(c => (c.id && it.produtoId && c.id === it.produtoId) || c.nome === it.materialNome);
        if (idx >= 0) {
          novaCaderneta[idx].quantidade += Number(it.quantidade) || 1;
        } else {
          novaCaderneta.push({
            id: it.produtoId || Date.now() + Math.random(),
            nome: it.materialNome,
            unidade: it.unidade || 'UN',
            quantidade: Number(it.quantidade) || 1
          });
          novosAdicionados++;
        }
      });

      localStorage.setItem(storageKey, JSON.stringify(novaCaderneta));

      setToastFeedback({
        id: `caderneta-${pedidoAlvo.id}`,
        titulo: 'Itens adicionados à sua Caderneta!',
        detalhe: `${itens.length} ${itens.length === 1 ? 'material inserido' : 'materiais inseridos'}. Acesse o Catálogo para enviar.`,
        tipo: 'sucesso',
        acao: onNavigateToEstoque ? {
          label: 'Abrir Catálogo',
          onClick: onNavigateToEstoque
        } : null
      });

      setTimeout(() => setToastFeedback(null), 5000);
    } catch {
      setToastFeedback({
        id: `err-caderneta-${Date.now()}`,
        titulo: 'Não foi possível salvar na caderneta',
        detalhe: 'Tente novamente.',
        tipo: 'erro'
      });
      setTimeout(() => setToastFeedback(null), 4000);
    }
  };

  // Confirmação e geração do novo pedido com os exatos mesmos itens
  const handleConfirmarPedirNovamente = async () => {
    if (!reorderModalPedido || reordenandoPedido) return;
    setReordenandoPedido(true);

    try {
      const itensOriginais = getItensPedido(reorderModalPedido);
      const totalQtd = itensOriginais.reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);
      const unidadePadrao = itensOriginais[0]?.unidade || 'UN';

      let novoId;
      if (onPedirNovamente) {
        const criado = await onPedirNovamente({
          material: itensOriginais.map(m => m.materialNome).join(', '),
          quantidade: totalQtd,
          unidade: unidadePadrao,
          itens: itensOriginais,
          materiais: itensOriginais,
          justificativa: `Repetição do Pedido #${reorderModalPedido.id}: ${reorderModalPedido.justificativa || 'Uso contínuo'}`,
          prioridade: reorderModalPedido.prioridade || 'Normal',
          urgente: !!reorderModalPedido.urgente
        });
        novoId = criado?.id;
      } else {
        novoId = Math.max(...pedidos.map(p => Number(p.id) || 0), 100) + 1;
        const novo = {
          id: novoId,
          data: new Date().toLocaleDateString('pt-BR'),
          material: itensOriginais.map(m => m.materialNome).join(', '),
          quantidade: totalQtd,
          materiais: itensOriginais,
          itens: itensOriginais,
          justificativa: `Repetição do Pedido #${reorderModalPedido.id}`,
          prioridade: reorderModalPedido.prioridade || 'Normal',
          urgente: !!reorderModalPedido.urgente,
          status: 'Aguardando Separação'
        };
        setPedidos(prev => [novo, ...prev]);
      }

      setStatusFilter('andamento');
      setReorderModalPedido(null);

      setToastFeedback({
        id: novoId || reorderModalPedido.id,
        titulo: `Pedido #${novoId || ''} enviado com sucesso!`,
        detalhe: `${itensOriginais.length} ${itensOriginais.length === 1 ? 'material enviado' : 'materiais enviados'} para o almoxarifado.`,
        tipo: 'sucesso'
      });

      setTimeout(() => setToastFeedback(null), 4500);
    } catch (error) {
      setToastFeedback({
        id: `err-${Date.now()}`,
        titulo: 'Erro ao repetir pedido',
        detalhe: error?.message || 'Tente novamente mais tarde.',
        tipo: 'erro'
      });
      setTimeout(() => setToastFeedback(null), 4500);
    } finally {
      setReordenandoPedido(false);
    }
  };

  // Confirmação de cancelamento
  const handleConfirmCancel = async () => {
    if (!cancelModalPedido || cancelandoPedido) return;
    const pedidoId = cancelModalPedido.id;
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
        detalhe: 'A solicitação foi removida da fila de atendimento.',
        tipo: 'aviso'
      });

      setTimeout(() => setToastFeedback(null), 4500);
      setCancelModalPedido(null);
    } catch (error) {
      setToastFeedback({
        id: `cancel-error-${pedidoId}`,
        titulo: `Não foi possível cancelar o Pedido #${pedidoId}`,
        detalhe: error?.message || 'Verifique se o pedido ainda está na fila inicial.',
        tipo: 'erro'
      });
      setTimeout(() => setToastFeedback(null), 5000);
    } finally {
      setCancelandoPedido(false);
    }
  };

  // Filtragem e ordenação dos pedidos
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(p => {
      const isAndamento = isStatusAndamento(p.status);
      const isHistorico = isStatusHistorico(p.status);

      if (statusFilter === 'andamento' && !isAndamento) return false;
      if (statusFilter === 'historico' && !isHistorico) return false;

      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      const idMatch = String(p.id || '').toLowerCase().includes(term);
      const justMatch = (p.justificativa || '').toLowerCase().includes(term);
      const itens = getItensPedido(p);
      const materialMatch = itens.some(it => (it.materialNome || '').toLowerCase().includes(term));

      return idMatch || materialMatch || justMatch;
    }).sort((a, b) => {
      if (ordenacao === 'alfabetica-asc') {
        const nomeA = getNomeMaterialPedido(a);
        const nomeB = getNomeMaterialPedido(b);
        return nomeA.localeCompare(nomeB, 'pt-BR');
      }
      if (ordenacao === 'antigo') {
        return (Number(a.id) || 0) - (Number(b.id) || 0);
      }
      // 'recente' (padrão)
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }, [pedidos, statusFilter, searchTerm, ordenacao]);

  return (
    <div className="meus-pedidos-container">
      {/* Toast flutuante de feedback */}
      <AnimatePresence>
        {toastFeedback && (
          <motion.div
            className={`sge-toast meus-pedidos__toast ${toastFeedback.tipo === 'erro' ? 'sge-toast--erro' : toastFeedback.tipo === 'aviso' ? 'sge-toast--aviso' : 'sge-toast--sucesso'}`}
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
          >
            <div className="meus-pedidos__toast-icon">
              {toastFeedback.tipo === 'erro' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              ) : toastFeedback.tipo === 'aviso' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div className="meus-pedidos__toast-content">
              <span className="meus-pedidos__toast-title">{toastFeedback.titulo}</span>
              <span className="meus-pedidos__toast-desc">{toastFeedback.detalhe}</span>
              {toastFeedback.acao && (
                <button
                  type="button"
                  className="meus-pedidos__toast-btn"
                  onClick={() => {
                    setToastFeedback(null);
                    toastFeedback.acao.onClick();
                  }}
                >
                  {toastFeedback.acao.label} &rarr;
                </button>
              )}
            </div>
            <button
              type="button"
              className="meus-pedidos__toast-close"
              onClick={() => setToastFeedback(null)}
              aria-label="Fechar notificação"
            >
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Abas Padronizadas: Em Andamento vs Histórico */}
      <div className="meus-pedidos__tabs-container">
        <SegmentedTabs
          tabs={[
            {
              id: 'andamento',
              label: 'Em Andamento',
              badge: metricas.emAndamento > 0 ? metricas.emAndamento : undefined,
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              )
            },
            {
              id: 'historico',
              label: 'Histórico',
              badge: metricas.historico > 0 ? metricas.historico : undefined,
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )
            }
          ]}
          activeTab={statusFilter}
          onChange={setStatusFilter}
          layoutId="meusPedidosSegmentedIndicator"
        />
      </div>

      {/* Barra de Busca rápida e Ordenação */}
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
            placeholder="Buscar por número, material ou justificativa..."
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

      {/* Lista de Pedidos */}
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
            <div className="sge-empty-state pedidos-empty-state">
              <div className="sge-empty-state__icon-wrap empty-state-icon">
                {statusFilter === 'andamento' ? (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
              </div>
              <h3 className="sge-empty-state__title empty-state-title">
                {searchTerm
                  ? 'Nenhum pedido encontrado'
                  : statusFilter === 'andamento'
                  ? 'Nenhum pedido em andamento'
                  : 'Nenhum pedido no histórico'}
              </h3>
              <p className="sge-empty-state__desc empty-state-desc">
                {searchTerm
                  ? 'Tente buscar por outro número de pedido ou nome de material.'
                  : statusFilter === 'andamento'
                  ? 'Você não possui pedidos na fila ou aguardando retirada no momento.'
                  : 'Os pedidos concluídos ou cancelados aparecerão aqui.'}
              </p>

              {statusFilter === 'andamento' && onNavigateToEstoque && (
                <button
                  type="button"
                  className="sge-empty-state__btn btn-ir-estoque"
                  onClick={onNavigateToEstoque}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  </svg>
                  Consultar Catálogo e Fazer Pedido
                </button>
              )}
            </div>
          ) : (
            pedidosFiltrados.map((pedido) => {
              const statusNorm = normalizarStatus(pedido.status);
              const itens = getItensPedido(pedido);
              const totalVolumes = itens.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0);
              const isUrgente = (pedido.prioridade || '').toLowerCase() === 'urgente' || !!pedido.urgente;
              const isPronto = statusNorm === 'pronto';
              const isParcial = statusNorm === 'parcialmente-disponivel';
              const isPendente = statusNorm === 'aguardando-separacao';
              const isCancelado = statusNorm === 'cancelado';
              const isEstoqueInsuficiente = statusNorm === 'estoque-insuficiente';
              const isExpanded = !!expandedPedidos[pedido.id];

              // Mostra até 3 itens juntos; colapsa apenas quando houver mais de 3
              const itensVisiveis = isExpanded ? itens : (itens.length <= 3 ? itens : itens.slice(0, 3));
              const itensOcultosCount = itens.length > 3 ? itens.length - 3 : 0;

              return (
                <div
                  key={pedido.id}
                  className={`pedido-card ${isPendente ? 'pedido-card--pendente' : ''} ${isPronto ? 'pedido-card--pronto' : ''} ${isParcial ? 'pedido-card--parcial' : ''} ${isCancelado ? 'pedido-card--cancelado' : ''} ${isEstoqueInsuficiente ? 'pedido-card--insuficiente' : ''} ${isUrgente ? 'pedido-card--urgente' : ''}`}
                >
                  {/* Linha Superior: Badges de Estado, Urgência e Metadados */}
                  <div className="pedido-card__header">
                    <div className="pedido-card__header-badges">
                      <StatusBadge status={statusNorm} />
                      {isUrgente && (
                        <StatusBadge status="urgente" />
                      )}
                    </div>
                    <div className="pedido-card__meta-wrap">
                      <span className="pedido-card__meta-id">#{pedido.id}</span>
                      <span className="pedido-card__meta-sep">•</span>
                      <span className="pedido-card__meta-data">{pedido.data || 'Hoje'}</span>
                      <span className="pedido-card__resumo-pill">
                        {itens.length} {itens.length === 1 ? 'material' : 'materiais'} ({totalVolumes} {totalVolumes === 1 ? 'vol.' : 'vols.'})
                      </span>
                    </div>
                  </div>

                  {/* Banner de Aviso de Retirada (quando pronto ou parcialmente disponível) */}
                  {(isPronto || isParcial) && (
                    <div className={`pedido-card__alerta-retirada ${isParcial ? 'pedido-card__alerta-retirada--parcial' : ''}`}>
                      <div className="alerta-retirada-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </div>
                      <div className="alerta-retirada-text">
                        <strong>
                          {isParcial
                            ? 'Materiais disponíveis para retirada parcial'
                            : 'Todos os materiais prontos para retirada'}
                        </strong>
                        <span>Retirar no <strong>Almoxarifado Central (Prédio A)</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Instruções / Mensagem do Almoxarife ao Solicitante */}
                  {pedido.mensagemAlmoxarife && (
                    <div className="pedido-card__mensagem-almoxarife">
                      <div className="mensagem-almoxarife-header">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span className="mensagem-almoxarife-title">Instruções do Balcão de Retirada:</span>
                      </div>
                      <p className="mensagem-almoxarife-corpo">"{pedido.mensagemAlmoxarife}"</p>
                    </div>
                  )}

                  {/* Banner de Estoque Insuficiente (quando nenhum item pôde ser atendido) */}
                  {isEstoqueInsuficiente && (
                    <div className="pedido-card__alerta-insuficiente">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>
                        <strong>Estoque Insuficiente:</strong> {pedido.observacaoAlmoxarife || 'Os itens solicitados encontram-se temporariamente sem saldo no estoque do almoxarifado.'}
                      </span>
                    </div>
                  )}

                  {/* Lista de Materiais do Lote (Sanfona Opção B) */}
                  <div className="pedido-card__items-container">
                    <div className="pedido-card__items-list">
                      {itensVisiveis.map((item, idx) => {
                        const isItemSemSaldo = item.quantidadeAtendida === 0;
                        const isItemParcial = item.quantidadeAtendida !== undefined && item.quantidadeAtendida > 0 && item.quantidadeAtendida < item.quantidade;
                        const isItemAtendidoTotal = item.quantidadeAtendida !== undefined && item.quantidadeAtendida >= item.quantidade;

                        return (
                          <div
                            key={`${pedido.id}-item-${idx}`}
                            className={`pedido-item-row ${isParcial && !item.disponivel ? 'pedido-item-row--falta' : ''} ${isItemSemSaldo ? 'pedido-item-row--sem-saldo' : ''}`}
                          >
                            <div className="pedido-item-main">
                              <span className={`pedido-item-bullet ${isItemSemSaldo ? 'pedido-item-bullet--sem-saldo' : ''}`}>
                                {isItemSemSaldo ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                  </svg>
                                )}
                              </span>
                              <span className={`pedido-item-nome ${isItemSemSaldo ? 'pedido-item-nome--sem-saldo' : ''}`}>
                                {item.materialNome}
                              </span>
                            </div>

                            <div className="pedido-item-meta">
                              {/* Quando há registro de quantidade atendida (baixa no almoxarifado) */}
                              {item.quantidadeAtendida !== undefined ? (
                                <span className={`pedido-item-tag ${isItemSemSaldo ? 'pedido-item-tag--sem-saldo' : isItemParcial ? 'pedido-item-tag--parcial' : 'pedido-item-tag--entregue'}`}>
                                  {isItemSemSaldo
                                    ? `0 de ${item.quantidade} (Sem Estoque)`
                                    : isItemParcial
                                    ? `${item.quantidadeAtendida} de ${item.quantidade} ${item.unidade || 'UN'} entregues`
                                    : `${item.quantidade} ${item.unidade || 'UN'} ✓`}
                                </span>
                              ) : (
                                <>
                                  {/* Tags de status individual quando o pedido tem itens mistos */}
                                  {isParcial && (
                                    item.disponivel ? (
                                      <span className="pedido-item-tag pedido-item-tag--disponivel" title="Material separado e pronto">
                                        Disponível
                                      </span>
                                    ) : (
                                      <span className="pedido-item-tag pedido-item-tag--falta" title="Material em falta no estoque">
                                        Em Falta
                                      </span>
                                    )
                                  )}
                                  <span className="pedido-item-qtd">
                                    {item.quantidade} {item.unidade || 'UN'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Botão de Sanfona para Expandir/Recolher quando houver mais de 2 itens */}
                    {itensOcultosCount > 0 && (
                      <button
                        type="button"
                        className="pedido-card__expand-btn"
                        onClick={() => toggleExpand(pedido.id)}
                        aria-expanded={isExpanded}
                      >
                        <span>
                          {isExpanded
                            ? 'Recolher lista de materiais'
                            : `+ ${itensOcultosCount} outros ${itensOcultosCount === 1 ? 'material' : 'materiais'} no lote (ver todos)`}
                        </span>
                        <svg
                          className={`pedido-card__expand-icon ${isExpanded ? 'pedido-card__expand-icon--open' : ''}`}
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Justificativa / Finalidade informada */}
                  {pedido.justificativa && (
                    <div className="pedido-card__justificativa">
                      <div className="justificativa-header">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                        </svg>
                        <span className="justificativa-label">Finalidade informada:</span>
                      </div>
                      <p className="justificativa-texto">{pedido.justificativa}</p>
                    </div>
                  )}

                  {/* Rodapé com Ações do Pedido */}
                  <div className="pedido-card__footer">
                    {isPendente ? (
                      <button
                        type="button"
                        className="btn-cancelar-solicitacao"
                        onClick={() => setCancelModalPedido(pedido)}
                        title="Cancelar esta solicitação da fila"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        Cancelar Pedido
                      </button>
                    ) : (
                      <div className="pedido-card__footer-actions">
                        {/* Botão de Adicionar itens à Caderneta */}
                        <button
                          type="button"
                          className="btn-adicionar-caderneta"
                          onClick={() => handleAdicionarACaderneta(pedido)}
                          title="Inserir estes materiais na sua Caderneta para editar ou complementar"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                            <path d="M9 12h6" />
                            <path d="M9 16h6" />
                          </svg>
                          Adicionar à Caderneta
                        </button>

                        {/* Botão de Repetir Pedido Idêntico */}
                        <motion.button
                          type="button"
                          className="btn-pedir-novamente"
                          onClick={() => setReorderModalPedido(pedido)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.96 }}
                          title="Fazer um novo pedido idêntico a este de uma vez"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                          </svg>
                          Repetir Pedido
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modal / Dialog de Confirmação de Cancelamento (Modal Flutuante) */}
      <BottomSheetModal
        isOpen={!!cancelModalPedido}
        onClose={() => setCancelModalPedido(null)}
        className="cancel-order-modal"
        title={cancelModalPedido ? `Cancelar Pedido #${cancelModalPedido.id}?` : ''}
        subtitle="Confirmação de Cancelamento"
        variant="dialog"
        maxWidth="440px"
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
              onClick={handleConfirmCancel}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {cancelandoPedido ? 'Cancelando...' : 'Sim, Cancelar'}
            </motion.button>
          </div>
        }
      >
        <div className="cancel-modal-body">
          <p className="cancel-modal-desc">
            Esta solicitação será removida da fila de atendimento do almoxarifado. Esta ação não poderá ser desfeita.
          </p>
          {cancelModalPedido && (
            <div className="cancel-modal-pedido-info">
              <span className="cancel-modal-meta">
                Pedido <strong>#{cancelModalPedido.id}</strong> • {getItensPedido(cancelModalPedido).length} {getItensPedido(cancelModalPedido).length === 1 ? 'material' : 'materiais'}
              </span>
            </div>
          )}
        </div>
      </BottomSheetModal>

      {/* Modal / Dialog de Confirmação de Repetir Pedido (Modal Flutuante) */}
      <BottomSheetModal
        isOpen={!!reorderModalPedido}
        onClose={() => setReorderModalPedido(null)}
        className="reorder-order-modal"
        title={reorderModalPedido ? `Repetir Pedido #${reorderModalPedido.id}?` : ''}
        subtitle="Nova Solicitação Idêntica"
        variant="dialog"
        maxWidth="460px"
        footer={
          <div className="reorder-modal-actions" style={{ display: 'flex', width: '100%', gap: '10px' }}>
            <motion.button
              type="button"
              className="btn-reorder-modal-voltar"
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
              onClick={handleConfirmarPedirNovamente}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {reordenandoPedido ? 'Enviando...' : 'Confirmar e Enviar'}
            </motion.button>
          </div>
        }
      >
        <div className="reorder-modal-body">
          <p className="reorder-modal-desc">
            Uma nova solicitação será gerada com os exatos mesmos materiais e enviada para a fila do almoxarifado:
          </p>
          {reorderModalPedido && (
            <div className="reorder-modal-itens-list">
              {getItensPedido(reorderModalPedido).map((it, idx) => (
                <div key={idx} className="reorder-modal-item">
                  <span className="reorder-item-nome">{it.materialNome}</span>
                  <span className="reorder-item-qtd">{it.quantidade} {it.unidade || 'UN'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </BottomSheetModal>
    </div>
  );
};

export default MeusPedidos;
