import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SegmentedTabs, StatusBadge, BottomSheetModal } from '../common';
import NovoPedidoModal from './NovoPedidoModal';
import './PedidosView.css';

/**
 * Motivos pré-definidos para recusa rápida de pedidos no almoxarifado
 */
const MOTIVOS_RECUSA = [
  'Estoque físico divergente ou saldo zerado',
  'Material avariado ou com validade expirada',
  'Solicitação duplicada no sistema',
  'Setor solicitante informou cancelamento',
  'Outro motivo'
];

/**
 * Chips rápidos para mensagem de retirada do almoxarife
 */
const ATALHOS_MENSAGEM_PRONTO = [
  'Disponível para retirada no balcão principal',
  'Separado na Caixa 01 do almoxarifado',
  'Separado na Caixa 02 do almoxarifado',
  'Favor retirar até as 17h no almoxarifado central'
];

/**
 * Normaliza o status de um pedido para a aba correspondente da esteira WMS
 */
const getAbaDoPedido = (status) => {
  const st = String(status || '').toLowerCase().trim();
  if (st === 'em separação' || st === 'em separacao' || st === 'separação' || st === 'separacao') return 'separacao';
  if (st === 'pronto p/ retirada' || st === 'pronto para retirada' || st === 'pronto') return 'prontos';
  if (
    st === 'atendido' ||
    st === 'atendido parcialmente' ||
    st === 'entregue' ||
    st === 'concluído' ||
    st === 'concluido' ||
    st === 'cancelado' ||
    st === 'recusado'
  ) {
    return 'historico';
  }
  return 'novos';
};

/**
 * Mapeia o status textual para o código aceito pelo StatusBadge padrão
 */
const getStatusBadgeCode = (status) => {
  const st = String(status || '').toLowerCase().trim();
  if (st === 'em separação' || st === 'em separacao' || st === 'separação' || st === 'separacao') return 'em-separacao';
  if (st === 'pronto p/ retirada' || st === 'pronto para retirada' || st === 'pronto') return 'pronto';
  if (st === 'atendido parcialmente') return 'atendido-parcialmente';
  if (st === 'atendido' || st === 'entregue' || st === 'concluído' || st === 'concluido') return 'entregue';
  if (st === 'cancelado' || st === 'recusado') return 'cancelado';
  return 'pendente';
};

/**
 * Formata data de validade ISO (YYYY-MM-DD) para formato curto (DD/MM/AA)
 */
const formatarDataValidadeCurta = (dataISO) => {
  if (!dataISO) return '';
  const partes = String(dataISO).split('T')[0].split('-');
  if (partes.length !== 3) return String(dataISO);
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano.slice(-2)}`;
};

/**
 * Calcula o status de validade (vencido, atencao <= 60d, valido)
 */
const getStatusValidade = (dataISO) => {
  if (!dataISO) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataVal = new Date(dataISO);
  dataVal.setHours(0, 0, 0, 0);
  const diffDias = Math.ceil((dataVal - hoje) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return { tipo: 'vencido', label: 'Vencido' };
  if (diffDias <= 60) return { tipo: 'atencao', label: `Vence em ${diffDias}d` };
  return { tipo: 'valido', label: 'Válido' };
};

/**
 * Normaliza os itens de um pedido (suporta caderneta de lote e modelo legado de 1 item)
 */
const normalizarItensPedido = (pedido) => {
  if (!pedido) return [];
  if (Array.isArray(pedido.itens) && pedido.itens.length > 0) {
    return pedido.itens.map((it, idx) => ({
      key: `it-${it.produtoId || it.id || idx}`,
      produtoId: it.produtoId || it.id || it.materialId,
      materialNome: it.materialNome || it.nome || it.material || 'Material Solicitado',
      quantidade: Number(it.quantidade) || 1,
      quantidadeAtendida: it.quantidadeAtendida !== undefined ? Number(it.quantidadeAtendida) : undefined,
      statusItem: it.statusItem,
      unidade: it.unidade || 'UN',
      itensPorEmbalagem: it.itensPorEmbalagem
    }));
  }
  if (Array.isArray(pedido.materiais) && pedido.materiais.length > 0) {
    return pedido.materiais.map((it, idx) => {
      if (typeof it === 'string') {
        return {
          key: `mat-${idx}`,
          produtoId: null,
          materialNome: it,
          quantidade: 1,
          unidade: 'UN'
        };
      }
      return {
        key: `mat-${it.produtoId || it.id || idx}`,
        produtoId: it.produtoId || it.id || it.materialId,
        materialNome: it.materialNome || it.nome || it.material || 'Material',
        quantidade: Number(it.quantidade) || 1,
        quantidadeAtendida: it.quantidadeAtendida !== undefined ? Number(it.quantidadeAtendida) : undefined,
        statusItem: it.statusItem,
        unidade: it.unidade || 'UN'
      };
    });
  }
  if (pedido.material || pedido.materialNome) {
    return [{
      key: 'single-0',
      produtoId: pedido.produtoId || pedido.materialId,
      materialNome: pedido.material || pedido.materialNome,
      quantidade: Number(pedido.quantidade) || 1,
      quantidadeAtendida: pedido.quantidadeAtendida !== undefined ? Number(pedido.quantidadeAtendida) : undefined,
      statusItem: pedido.statusItem,
      unidade: pedido.unidade || 'UN'
    }];
  }
  return [];
};

/**
 * Localiza o material correspondente no estoque ativo para puxar saldo e WMS
 */
const encontrarMaterialCorrespondente = (itemPedido, listaMateriais = []) => {
  if (!itemPedido || !Array.isArray(listaMateriais)) return null;
  if (itemPedido.produtoId) {
    const porId = listaMateriais.find(m => Number(m.id) === Number(itemPedido.produtoId));
    if (porId) return porId;
  }
  const nomeTerm = String(itemPedido.materialNome || '').toLowerCase().trim();
  if (nomeTerm) {
    const porNome = listaMateriais.find(m => String(m.nome || '').toLowerCase().trim() === nomeTerm);
    if (porNome) return porNome;
  }
  return null;
};

/**
 * Calcula o semáforo de disponibilidade do estoque para o pedido
 */
const calcularDisponibilidadePedido = (pedido, listaMateriais) => {
  const itens = normalizarItensPedido(pedido);
  if (itens.length === 0) {
    return { tipo: 'disponivel', label: 'Estoque Disponível', classe: 'disponivel' };
  }

  let totalItens = itens.length;
  let itensComSaldoTotal = 0;
  let itensComAlgumSaldo = 0;

  for (const it of itens) {
    const mat = encontrarMaterialCorrespondente(it, listaMateriais);
    const qtdPedida = Number(it.quantidade) || 1;
    const saldoEstoque = mat ? Number(mat.quantidade) || 0 : 0;

    if (saldoEstoque >= qtdPedida) {
      itensComSaldoTotal++;
      itensComAlgumSaldo++;
    } else if (saldoEstoque > 0) {
      itensComAlgumSaldo++;
    }
  }

  if (itensComSaldoTotal === totalItens) {
    return { tipo: 'disponivel', label: 'Estoque Disponível', classe: 'disponivel' };
  }
  if (itensComAlgumSaldo > 0) {
    return { tipo: 'parcial', label: 'Saldo Parcial', classe: 'parcial' };
  }
  return { tipo: 'indisponivel', label: 'Sem Estoque', classe: 'indisponivel' };
};

/**
 * Módulo de Separação e Atendimento de Pedidos do Almoxarife (WMS Flow)
 */
const PedidosView = ({
  pedidos: initialPedidosProp = [],
  materiais = [],
  materiaisDisponiveis = [],
  setoresDisponiveis = [],
  usuariosDisponiveis = [],
  onSave,
  onUpdateStatus,
  onConfirmarEntrega
}) => {
  const [pedidos, setPedidos] = useState(initialPedidosProp || []);
  const listaMateriais = materiais && materiais.length > 0 ? materiais : materiaisDisponiveis;

  // Aba ativa na esteira de trabalho: 'novos' | 'separacao' | 'prontos' | 'historico'
  const [abaAtiva, setAbaAtiva] = useState('novos');

  // Filtros de busca rápida
  const [busca, setBusca] = useState('');
  const [apenasUrgentes, setApenasUrgentes] = useState(false);
  const [setorSelecionado, setSetorSelecionado] = useState('');

  // Checklist interativo de picking por pedido
  const [itensSeparados, setItensSeparados] = useState({});

  // Controle de expansão de lista de itens no card
  const [expandedCards, setExpandedCards] = useState({});

  // Modais de apoio
  const [isNovoPedidoModalOpen, setIsNovoPedidoModalOpen] = useState(false);

  // Modal de Recusa
  const [recusaModalPedido, setRecusaModalPedido] = useState(null);
  const [motivoRecusa, setMotivoRecusa] = useState(MOTIVOS_RECUSA[0]);
  const [obsRecusa, setObsRecusa] = useState('');

  // Modal de Pronto para Retirada (com mensagem do Almoxarife)
  const [prontoModalPedido, setProntoModalPedido] = useState(null);
  const [mensagemPronto, setMensagemPronto] = useState('');

  // Toast tátil de feedback
  const [feedbackToast, setFeedbackToast] = useState(null);

  // Sincroniza pedidos quando atualizados externamente
  useEffect(() => {
    if (initialPedidosProp) {
      setPedidos(initialPedidosProp);
    }
  }, [initialPedidosProp]);

  const exibirToast = (mensagem, tipo = 'sucesso') => {
    setFeedbackToast({ mensagem, tipo });
    setTimeout(() => {
      setFeedbackToast(null);
    }, 3800);
  };

  // Setores disponíveis para filtro rápido
  const setoresDisponiveisLista = useMemo(() => {
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

  // Contagem dinâmica para os badges das abas
  const contagemPorAba = useMemo(() => {
    const counts = { novos: 0, separacao: 0, prontos: 0, historico: 0 };
    pedidos.forEach(p => {
      const aba = getAbaDoPedido(p.status);
      if (counts[aba] !== undefined) {
        counts[aba]++;
      }
    });
    return counts;
  }, [pedidos]);

  // Total de pedidos urgentes pendentes de atendimento
  const totalUrgentes = useMemo(() => {
    return pedidos.filter(p => {
      const aba = getAbaDoPedido(p.status);
      const isUrgent = p.urgente || String(p.prioridade).toLowerCase() === 'urgente';
      return isUrgent && aba !== 'historico';
    }).length;
  }, [pedidos]);

  // Abas do SegmentedTabs (Aba 'Separação' com 9 caracteres perfeitamente simétrica)
  const tabsConfig = useMemo(() => [
    { id: 'novos', label: 'Novos', badge: contagemPorAba.novos || undefined },
    { id: 'separacao', label: 'Separação', badge: contagemPorAba.separacao || undefined },
    { id: 'prontos', label: 'Prontos', badge: contagemPorAba.prontos || undefined },
    { id: 'historico', label: 'Histórico', badge: contagemPorAba.historico || undefined }
  ], [contagemPorAba]);

  // Mapeamento de ramal por usuário para exibição rápida no card sem gaveta
  const mapaRamais = useMemo(() => {
    const map = {};
    (usuariosDisponiveis || []).forEach(u => {
      if (u.nome) {
        map[u.nome.toLowerCase().trim()] = u.ramal || u.celular || null;
      }
    });
    return map;
  }, [usuariosDisponiveis]);

  // Filtragem dos pedidos para a aba ativa
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(pedido => {
      const abaPedido = getAbaDoPedido(pedido.status);
      if (abaPedido !== abaAtiva) return false;

      const isUrgent = pedido.urgente || String(pedido.prioridade).toLowerCase() === 'urgente';
      if (apenasUrgentes && !isUrgent) return false;

      if (setorSelecionado && pedido.setor !== setorSelecionado) return false;

      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        const idMatch = String(pedido.id).toLowerCase().includes(termo);
        const usuarioMatch = pedido.usuario ? pedido.usuario.toLowerCase().includes(termo) : false;
        const setorMatch = pedido.setor ? pedido.setor.toLowerCase().includes(termo) : false;
        const justMatch = pedido.justificativa ? pedido.justificativa.toLowerCase().includes(termo) : false;
        const itens = normalizarItensPedido(pedido);
        const materialMatch = itens.some(it => it.materialNome.toLowerCase().includes(termo));

        if (!idMatch && !usuarioMatch && !setorMatch && !justMatch && !materialMatch) {
          return false;
        }
      }

      return true;
    });
  }, [pedidos, abaAtiva, apenasUrgentes, setorSelecionado, busca]);

  // Alterna o checklist de um item na etapa de separação
  const handleToggleItemSeparado = (pedidoId, itemKey) => {
    setItensSeparados(prev => {
      const pedidoChecks = { ...(prev[pedidoId] || {}) };
      pedidoChecks[itemKey] = !pedidoChecks[itemKey];
      return { ...prev, [pedidoId]: pedidoChecks };
    });
  };

  // Alterna expansão de itens do card
  const handleToggleExpandCard = (pedidoId) => {
    setExpandedCards(prev => ({ ...prev, [pedidoId]: !prev[pedidoId] }));
  };

  // Transição rápida de status (1 clique)
  const handleMudarStatus = async (pedidoId, novoStatus, msgSucesso, extras = {}) => {
    try {
      if (onUpdateStatus) {
        await onUpdateStatus(pedidoId, novoStatus, extras);
      }
      setPedidos(prev =>
        prev.map(p => (p.id === pedidoId ? { ...p, status: novoStatus, ...extras } : p))
      );
      exibirToast(
        msgSucesso || `Pedido #${pedidoId} movido para "${novoStatus}".`,
        'sucesso'
      );
    } catch {
      exibirToast(`Não foi possível alterar o status do pedido #${pedidoId}.`, 'erro');
    }
  };

  // Abre o modal para marcar como "Pronto para Retirada" com mensagem opcional
  const handleAbrirProntoModal = (pedido) => {
    setProntoModalPedido(pedido);
    setMensagemPronto(pedido.mensagemAlmoxarife || '');
  };

  // Confirmação de "Pronto para Retirada" com mensagem salva no pedido
  const handleConfirmarProntoModal = async () => {
    if (!prontoModalPedido) return;
    const pedidoId = prontoModalPedido.id;
    const msg = mensagemPronto.trim();

    await handleMudarStatus(
      pedidoId,
      'Pronto p/ Retirada',
      `Pedido #${pedidoId} pronto para retirada na bancada!`,
      { mensagemAlmoxarife: msg || null }
    );

    setProntoModalPedido(null);
    setMensagemPronto('');
  };

  // Confirmação de Entrega com baixa física proporcional e registro fiel de itens
  const handleConfirmarEntrega = async (pedido) => {
    const itensOriginais = normalizarItensPedido(pedido);

    let temAlgumFaltando = false;
    const itensAtualizados = itensOriginais.map(it => {
      const mat = encontrarMaterialCorrespondente(it, listaMateriais);
      const saldo = mat ? Number(mat.quantidade) || 0 : 0;
      const qtdPedida = Number(it.quantidade) || 1;
      const qtdEntregue = Math.min(saldo, qtdPedida);

      if (qtdEntregue < qtdPedida) {
        temAlgumFaltando = true;
      }

      return {
        ...it,
        quantidadeAtendida: qtdEntregue,
        statusItem: qtdEntregue >= qtdPedida ? 'entregue' : (qtdEntregue > 0 ? 'parcial' : 'sem_estoque')
      };
    });

    const statusFinal = temAlgumFaltando ? 'Atendido Parcialmente' : 'Atendido';

    const pedidoParaEntrega = {
      ...pedido,
      status: statusFinal,
      itens: itensAtualizados,
      dataEntrega: new Date().toLocaleDateString('pt-BR')
    };

    try {
      if (onConfirmarEntrega) {
        await onConfirmarEntrega(pedidoParaEntrega);
      } else if (onUpdateStatus) {
        await onUpdateStatus(pedido.id, statusFinal, { itens: itensAtualizados, status: statusFinal });
      }

      setPedidos(prev =>
        prev.map(p => (p.id === pedido.id ? pedidoParaEntrega : p))
      );

      if (temAlgumFaltando) {
        exibirToast(`Pedido #${pedido.id} entregue parcialmente. Itens sem estoque foram sinalizados.`, 'aviso');
      } else {
        exibirToast(`Pedido #${pedido.id} entregue com sucesso! Baixa de estoque registrada.`, 'sucesso');
      }
    } catch {
      exibirToast(`Erro ao confirmar a entrega do pedido #${pedido.id}.`, 'erro');
    }
  };

  // Abertura do modal de recusa
  const handleAbrirRecusaModal = (pedido) => {
    setRecusaModalPedido(pedido);
    setMotivoRecusa(MOTIVOS_RECUSA[0]);
    setObsRecusa('');
  };

  // Confirmação de recusa com justificativa
  const handleConfirmarRecusa = async () => {
    if (!recusaModalPedido) return;
    const pedidoId = recusaModalPedido.id;
    const motivoFinal = obsRecusa.trim()
      ? `${motivoRecusa}: ${obsRecusa.trim()}`
      : motivoRecusa;

    try {
      if (onUpdateStatus) {
        await onUpdateStatus(pedidoId, 'Cancelado', { motivoCancelamento: motivoFinal });
      }
      setPedidos(prev =>
        prev.map(p =>
          p.id === pedidoId ? { ...p, status: 'Cancelado', motivoCancelamento: motivoFinal } : p
        )
      );
      exibirToast(`Pedido #${pedidoId} recusado (${motivoRecusa}).`, 'aviso');
    } catch {
      exibirToast(`Erro ao recusar o pedido #${pedidoId}.`, 'erro');
    } finally {
      setRecusaModalPedido(null);
    }
  };

  return (
    <div className="atendimento-container">
      {/* Toast Flutuante de Feedback */}
      {feedbackToast && (
        <div className={`atendimento-toast atendimento-toast--${feedbackToast.tipo}`} role="status">
          <div className="atendimento-toast__icon">
            {feedbackToast.tipo === 'erro' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <span className="atendimento-toast__msg">{feedbackToast.mensagem}</span>
          <button
            type="button"
            className="atendimento-toast__close"
            onClick={() => setFeedbackToast(null)}
            aria-label="Fechar notificação"
          >
            ×
          </button>
        </div>
      )}

      {/* Navegação por Abas da Esteira WMS (SegmentedTabs) */}
      <div className="atendimento-tabs-wrap">
        <SegmentedTabs
          tabs={tabsConfig}
          activeTab={abaAtiva}
          onChange={(novaAba) => setAbaAtiva(novaAba)}
          layoutId="atendimentoWmsTabs"
          size="md"
          className="atendimento-segmented-tabs"
          ariaLabel="Fases do Atendimento de Pedidos"
        />
      </div>

      {/* Barra de Busca e Filtros Rápidos */}
      <div className="atendimento-filter-bar">
        <div className="atendimento-search-wrap">
          <svg className="atendimento-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="atendimento-search-input"
            placeholder="Buscar por solicitante, setor, nº do pedido ou material..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button
              type="button"
              className="atendimento-clear-search"
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
            >
              ×
            </button>
          )}
        </div>

        <div className="atendimento-filter-actions">
          {/* Chip de Filtro de Urgência */}
          <button
            type="button"
            className={`atendimento-chip-urgente ${apenasUrgentes ? 'atendimento-chip-urgente--active' : ''}`}
            onClick={() => setApenasUrgentes(prev => !prev)}
            title="Exibir somente pedidos urgentes"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span>Urgentes</span>
            {totalUrgentes > 0 && <span className="atendimento-chip-urgente__count">{totalUrgentes}</span>}
          </button>

          {/* Filtro por Setor */}
          <select
            className="atendimento-select-setor"
            value={setorSelecionado}
            onChange={(e) => setSetorSelecionado(e.target.value)}
            aria-label="Filtrar por setor solicitante"
          >
            <option value="">Todos os Setores</option>
            {setoresDisponiveisLista.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Cards da Esteira WMS */}
      <div className="atendimento-cards-list">
        {pedidosFiltrados.length === 0 ? (
          <div className="sge-empty-state">
            <div className="sge-empty-state__icon-wrap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                {abaAtiva === 'novos' && (
                  <>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </>
                )}
                {abaAtiva === 'separacao' && (
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                )}
                {abaAtiva === 'prontos' && (
                  <>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </>
                )}
                {abaAtiva === 'historico' && (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </>
                )}
              </svg>
            </div>
            <h4 className="sge-empty-state__title">
              {abaAtiva === 'novos' && 'Nenhum pedido novo aguardando triagem'}
              {abaAtiva === 'separacao' && 'Nenhum pedido em separação física no momento'}
              {abaAtiva === 'prontos' && 'Nenhum pedido pronto para retirada na bancada'}
              {abaAtiva === 'historico' && 'Nenhum pedido arquivado no histórico'}
            </h4>
            <p className="sge-empty-state__desc">
              {busca || apenasUrgentes || setorSelecionado
                ? 'Tente remover os filtros de busca ou setor para visualizar mais pedidos.'
                : abaAtiva === 'novos'
                ? 'Novas solicitações enviadas pelos professores e colaboradores surgirão automaticamente aqui.'
                : 'Os pedidos avançam pelas etapas conforme a conferência e despacho forem realizados.'}
            </p>
            {(busca || apenasUrgentes || setorSelecionado) && (
              <button
                type="button"
                className="sge-empty-state__btn"
                onClick={() => {
                  setBusca('');
                  setApenasUrgentes(false);
                  setSetorSelecionado('');
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {pedidosFiltrados.map((pedido) => {
              const itens = normalizarItensPedido(pedido);
              const isUrgent = pedido.urgente || String(pedido.prioridade).toLowerCase() === 'urgente';
              const disponibilidade = calcularDisponibilidadePedido(pedido, listaMateriais);
              const statusBadgeCode = getStatusBadgeCode(pedido.status);
              const isExpanded = !!expandedCards[pedido.id];
              const itensVisiveis = isExpanded ? itens : (itens.length <= 3 ? itens : itens.slice(0, 3));
              const itensOcultosCount = itens.length > 3 ? itens.length - 3 : 0;
              const ramal = mapaRamais[pedido.usuario?.toLowerCase()?.trim()] || null;

              return (
                <motion.div
                  key={pedido.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className={`atendimento-card ${
                    isUrgent ? 'atendimento-card--urgente' : ''
                  }`}
                >
                  {/* Número do Pedido Fixo no Canto Superior Direito (PC e Mobile) */}
                  <span className="atendimento-card__id-badge" title={`Identificador do Pedido #${pedido.id}`}>
                    #{pedido.id}
                  </span>

                  {/* Cabeçalho do Card (Identificação Limpa sem Gaveta de Prontuário) */}
                  <div className="atendimento-card__header">
                    <div className="atendimento-card__solicitante-info">
                      <div className={`atendimento-card__avatar ${isUrgent ? 'atendimento-card__avatar--urgente' : ''}`}>
                        {pedido.usuario ? pedido.usuario.trim().charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="atendimento-card__solicitante-meta">
                        <span className="atendimento-card__nome">{pedido.usuario || 'Usuário Solicitante'}</span>
                        <span className="atendimento-card__setor-text">
                          {pedido.setor || 'Geral'}{ramal ? ` • Ramal ${ramal}` : ''} • {pedido.data || 'Hoje'}
                        </span>
                      </div>
                    </div>

                    {/* Lado Direito do Cabeçalho: Badges de Estado e Triagem */}
                    <div className="atendimento-card__header-right">
                      <div className="atendimento-card__badges-group">
                        {isUrgent && (
                          <span className="atendimento-badge-urgente">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                            URGENTE
                          </span>
                        )}

                        {/* Semáforo de Estoque inteligente (Apenas em Novos e Separação para apoio de triagem) */}
                        {(abaAtiva === 'novos' || abaAtiva === 'separacao') && (
                          <span className={`estoque-semaforo-badge estoque-semaforo-badge--${disponibilidade.classe}`}>
                            <span className="estoque-semaforo-dot" />
                            {disponibilidade.label}
                          </span>
                        )}

                        {/* StatusBadge APENAS no Histórico (onde convivem entregas parciais, integrais e cancelamentos) */}
                        {abaAtiva === 'historico' && (
                          <StatusBadge status={statusBadgeCode} size="sm" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Justificativa / Observação do Solicitante */}
                  {pedido.justificativa && (
                    <div className="atendimento-card__justificativa">
                      <span className="atendimento-card__justificativa-label">Finalidade:</span>
                      <span className="atendimento-card__justificativa-text">
                        "{pedido.justificativa}"
                      </span>
                    </div>
                  )}

                  {/* Mensagem / Orientações do Almoxarifado (se definida) */}
                  {pedido.mensagemAlmoxarife && (
                    <div className="atendimento-card__instrucoes-almox">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <strong>Instruções do Balcão:</strong>
                      <span>"{pedido.mensagemAlmoxarife}"</span>
                    </div>
                  )}

                  {/* Lista de Itens do Pedido com Endereçamento WMS (Sanfona e Visual Padronizado com o Usuário) */}
                  <div className="atendimento-card__items-container">
                    <div className="atendimento-card__itens-list">
                      {itensVisiveis.map((it, idx) => {
                        const mat = encontrarMaterialCorrespondente(it, listaMateriais);
                        const qtdPedida = Number(it.quantidade) || 1;
                        const saldoEstoque = mat ? Number(mat.quantidade) || 0 : 0;
                        const temSaldo = saldoEstoque >= qtdPedida;
                        const itemKey = it.key || `item-${idx}`;
                        const isSeparado = !!itensSeparados[pedido.id]?.[itemKey];
                        const isFalta = !temSaldo || (it.quantidadeAtendida !== undefined && it.quantidadeAtendida === 0);

                        return (
                          <div
                            key={itemKey}
                            className={`atendimento-item-row ${
                              abaAtiva === 'separacao' && isSeparado ? 'atendimento-item-row--checked' : ''
                            } ${isFalta ? 'atendimento-item-row--sem-saldo' : ''}`}
                          >
                            {/* Indicador / Ação na esquerda do item dependendo da fase */}
                            {abaAtiva === 'separacao' ? (
                              /* Checkbox tátil de Picking na aba "Separação" */
                              <label
                                className="picking-checkbox-wrap"
                                title={isSeparado ? 'Desmarcar conferência' : 'Marcar material coletado da prateleira'}
                              >
                                <input
                                  type="checkbox"
                                  className="picking-checkbox-input"
                                  checked={isSeparado}
                                  onChange={() => handleToggleItemSeparado(pedido.id, itemKey)}
                                />
                                <span className="picking-checkbox-custom">
                                  {isSeparado && (
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  )}
                                </span>
                              </label>
                            ) : abaAtiva === 'prontos' ? (
                              /* Símbolo V (✓) ou X (✕) na aba "Prontos" */
                              temSaldo ? (
                                <span className="atendimento-item-status-icon atendimento-item-status-icon--ok" title="Item conferido e pronto para retirada">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </span>
                              ) : (
                                <span className="atendimento-item-status-icon atendimento-item-status-icon--falta" title="Item sem saldo em estoque">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </span>
                              )
                            ) : abaAtiva === 'historico' ? (
                              /* Símbolo V (✓) ou X (✕) no Histórico */
                              it.quantidadeAtendida !== undefined ? (
                                it.quantidadeAtendida > 0 ? (
                                  <span className="atendimento-item-status-icon atendimento-item-status-icon--ok" title="Item entregue ao solicitante">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  </span>
                                ) : (
                                  <span className="atendimento-item-status-icon atendimento-item-status-icon--falta" title="Item não atendido (sem saldo)">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  </span>
                                )
                              ) : pedido.status === 'Cancelado' ? (
                                <span className="atendimento-item-status-icon atendimento-item-status-icon--falta" title="Pedido cancelado">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </span>
                              ) : (
                                <span className="atendimento-item-status-icon atendimento-item-status-icon--ok" title="Item entregue">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </span>
                              )
                            ) : (
                              /* Bullet na aba "Novos" (Triagem) */
                              <span className={`atendimento-item-bullet ${!temSaldo ? 'atendimento-item-bullet--falta' : ''}`} title={temSaldo ? 'Material com saldo disponível' : 'Material sem saldo em estoque'}>
                                {!temSaldo ? (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                ) : (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                  </svg>
                                )}
                              </span>
                            )}

                            <div className="atendimento-item-info">
                              {/* Nome do Material + Quantidade Pedida vs Saldo */}
                              <div className="atendimento-item-top">
                                <span className="atendimento-item-nome">
                                  {it.materialNome}
                                </span>

                                <div className="atendimento-item-qtd-wrap">
                                  {/* Se já estiver no histórico, exibe a quantidade real entregue */}
                                  {it.quantidadeAtendida !== undefined ? (
                                    <span className={`atendimento-item-entregue-tag ${it.quantidadeAtendida < qtdPedida ? 'entregue-tag--parcial' : 'entregue-tag--ok'}`}>
                                      {it.quantidadeAtendida === 0
                                        ? `0 de ${qtdPedida} (Sem Estoque)`
                                        : `${it.quantidadeAtendida} de ${qtdPedida} entregues`}
                                    </span>
                                  ) : (
                                    <>
                                      <span className="atendimento-item-qtd-pedida">
                                        <strong>{qtdPedida}</strong> {it.unidade}
                                      </span>
                                      {mat && (
                                        <span className={`atendimento-item-saldo-pill ${temSaldo ? 'saldo-pill--ok' : 'saldo-pill--baixo'}`}>
                                          {saldoEstoque > 0 ? `Estoque: ${saldoEstoque}` : 'Sem estoque'}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Endereçamento Físico WMS (Modelo 2) */}
                              {mat && (
                                <div className="atendimento-item-wms">
                                  <div className="atendimento-item-wms__macro" title={`Complexo: ${mat.complexo || 'Almoxarifado Central'}`}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M3 21h18" />
                                      <path d="M5 21V7l8-4v18" />
                                      <path d="M19 21V11l-6-4" />
                                    </svg>
                                    <span>{mat.complexo || 'Almoxarifado Central'}</span>
                                  </div>

                                  <div className="atendimento-item-wms__micro">
                                    {mat.locacao && (
                                      <span className="wms-badge wms-badge--locacao" title={`Locação: ${mat.locacao}`}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                          <path d="m7.5 4.27 9 5.15" />
                                          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                                        </svg>
                                        <span>{mat.locacao}</span>
                                      </span>
                                    )}

                                    {mat.localizacao && (
                                      <span className="wms-badge wms-badge--localizacao" title={`Localização: ${mat.localizacao}`}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                                          <circle cx="12" cy="10" r="3" />
                                        </svg>
                                        <span>{mat.localizacao}</span>
                                      </span>
                                    )}

                                    {mat.dataValidade && (
                                      <span
                                        className={`validade-pill validade-pill--${getStatusValidade(mat.dataValidade)?.tipo || 'valido'}`}
                                        title={`Validade do item: ${mat.dataValidade}`}
                                      >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                          <line x1="16" y1="2" x2="16" y2="6" />
                                          <line x1="8" y1="2" x2="8" y2="6" />
                                        </svg>
                                        <span>Val: {formatarDataValidadeCurta(mat.dataValidade)}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Botão de Sanfona para Expandir/Recolher quando houver mais de 2 itens (Igual ao Usuário) */}
                    {itensOcultosCount > 0 && (
                      <button
                        type="button"
                        className="atendimento-card__expand-btn"
                        onClick={() => handleToggleExpandCard(pedido.id)}
                        aria-expanded={isExpanded}
                      >
                        <span>
                          {isExpanded
                            ? 'Recolher lista de materiais'
                            : `+ ${itensOcultosCount} outros ${itensOcultosCount === 1 ? 'material' : 'materiais'} no lote (ver todos)`}
                        </span>
                        <svg
                          className={`atendimento-card__expand-icon ${isExpanded ? 'atendimento-card__expand-icon--open' : ''}`}
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

                  {/* Rodapé de Ações de 1 Clique */}
                  <div className="atendimento-card__actions">
                    {/* Fase 1: Novos / Triagem */}
                    {abaAtiva === 'novos' && (
                      <div className="atendimento-actions-row">
                        <button
                          type="button"
                          className="atendimento-btn atendimento-btn--recusar"
                          onClick={() => handleAbrirRecusaModal(pedido)}
                        >
                          Recusar Pedido
                        </button>
                        <button
                          type="button"
                          className="atendimento-btn atendimento-btn--primary"
                          onClick={() => handleMudarStatus(pedido.id, 'Em Separação')}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                          </svg>
                          Iniciar Separação
                        </button>
                      </div>
                    )}

                    {/* Fase 2: Separação / Picking */}
                    {abaAtiva === 'separacao' && (
                      <div className="atendimento-actions-row">
                        <button
                          type="button"
                          className="atendimento-btn atendimento-btn--secondary"
                          onClick={() => handleMudarStatus(pedido.id, 'Pendente', `Pedido #${pedido.id} retornado para Novos.`)}
                        >
                          Voltar p/ Triagem
                        </button>
                        <button
                          type="button"
                          className="atendimento-btn atendimento-btn--primary"
                          onClick={() => handleAbrirProntoModal(pedido)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Pronto para Retirada
                        </button>
                      </div>
                    )}

                    {/* Fase 3: Prontos para Retirada / Balcão */}
                    {abaAtiva === 'prontos' && (
                      <div className="atendimento-actions-row">
                        <button
                          type="button"
                          className="atendimento-btn atendimento-btn--secondary"
                          onClick={() => handleMudarStatus(pedido.id, 'Em Separação', `Pedido #${pedido.id} voltou para conferência.`)}
                        >
                          Voltar p/ Separação
                        </button>
                        <button
                          type="button"
                          className="atendimento-btn atendimento-btn--success"
                          onClick={() => handleConfirmarEntrega(pedido)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Confirmar Entrega (Baixa Estoque)
                        </button>
                      </div>
                    )}

                    {/* Fase 4: Histórico */}
                    {abaAtiva === 'historico' && (
                      <div className="atendimento-actions-row atendimento-actions-row--historico">
                        <div className="atendimento-historico-badge">
                          {pedido.status === 'Cancelado' ? (
                            <span className="historico-tag historico-tag--cancelado">
                              ❌ Recusado / Cancelado
                              {pedido.motivoCancelamento && ` • ${pedido.motivoCancelamento}`}
                            </span>
                          ) : pedido.status === 'Atendido Parcialmente' ? (
                            <span className="historico-tag historico-tag--parcial">
                              ⚠️ Entregue Parcialmente (Saldo Insuficiente em Itens)
                            </span>
                          ) : (
                            <span className="historico-tag historico-tag--entregue">
                              ✅ Entregue e Baixado do Estoque
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Modal para Notificar "Pronto para Retirada" com Instruções (Modal Flutuante) */}
      {prontoModalPedido && (
        <BottomSheetModal
          isOpen={!!prontoModalPedido}
          onClose={() => setProntoModalPedido(null)}
          title={`Pedido #${prontoModalPedido.id} Pronto para Retirada`}
          subtitle={`Solicitante: ${prontoModalPedido.usuario} (${prontoModalPedido.setor})`}
          maxWidth="500px"
          variant="dialog"
          footer={
            <div className="atendimento-modal-footer">
              <button
                type="button"
                className="modal-btn-secondary"
                onClick={() => {
                  setMensagemPronto('');
                  handleConfirmarProntoModal();
                }}
              >
                Concluir sem Mensagem
              </button>
              <button
                type="button"
                className="modal-btn-primary"
                onClick={handleConfirmarProntoModal}
              >
                Confirmar e Notificar
              </button>
            </div>
          }
        >
          <div className="pronto-modal-content">
            <p className="pronto-modal-desc">
              Deseja incluir alguma instrução de retirada para o solicitante?
            </p>

            <div className="pronto-atalhos-chips">
              {ATALHOS_MENSAGEM_PRONTO.map(txt => (
                <button
                  key={txt}
                  type="button"
                  className={`pronto-chip-btn ${mensagemPronto === txt ? 'pronto-chip-btn--active' : ''}`}
                  onClick={() => setMensagemPronto(txt)}
                >
                  {txt}
                </button>
              ))}
            </div>

            <div className="pronto-textarea-wrap">
              <label className="pronto-label">Mensagem / Observação do Almoxarifado:</label>
              <textarea
                className="pronto-textarea"
                rows={3}
                placeholder="Ex: Deixado na Caixa 01 do balcão central. Retirar até as 17h..."
                value={mensagemPronto}
                onChange={(e) => setMensagemPronto(e.target.value)}
              />
            </div>
          </div>
        </BottomSheetModal>
      )}

      {/* Modal de Recusa com Motivo Operacional (Modal Flutuante) */}
      {recusaModalPedido && (
        <BottomSheetModal
          isOpen={!!recusaModalPedido}
          onClose={() => setRecusaModalPedido(null)}
          title={`Recusar Pedido #${recusaModalPedido.id}`}
          subtitle={`Solicitante: ${recusaModalPedido.usuario} (${recusaModalPedido.setor})`}
          maxWidth="480px"
          variant="dialog"
          footer={
            <div className="recusa-modal__footer">
              <button
                type="button"
                className="recusa-btn-voltar"
                onClick={() => setRecusaModalPedido(null)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="recusa-btn-confirmar"
                onClick={handleConfirmarRecusa}
              >
                Confirmar Recusa
              </button>
            </div>
          }
        >
          <div className="recusa-modal__body">
            <label className="recusa-label">Motivo da recusa:</label>
            <div className="recusa-options">
              {MOTIVOS_RECUSA.map((m) => (
                <label
                  key={m}
                  className={`recusa-radio-card ${motivoRecusa === m ? 'recusa-radio-card--selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="motivoRecusaAlmoxarife"
                    value={m}
                    checked={motivoRecusa === m}
                    onChange={() => setMotivoRecusa(m)}
                  />
                  <span>{m}</span>
                </label>
              ))}
            </div>

            <div className="recusa-obs-group">
              <label className="recusa-label" htmlFor="recusa-obs-input">
                Observações adicionais (opcional):
              </label>
              <textarea
                id="recusa-obs-input"
                className="recusa-obs-textarea"
                rows={3}
                placeholder="Ex: Novo lote com previsão de chegada na próxima terça-feira..."
                value={obsRecusa}
                onChange={(e) => setObsRecusa(e.target.value)}
              />
            </div>
          </div>
        </BottomSheetModal>
      )}

      {/* Modal de Criação de Novo Pedido pelo Almoxarife (Padronizado) */}
      <NovoPedidoModal
        isOpen={isNovoPedidoModalOpen}
        onClose={() => setIsNovoPedidoModalOpen(false)}
        materiaisDisponiveis={listaMateriais}
        usuariosDisponiveis={usuariosDisponiveis}
        onSave={(novo) => {
          if (onSave) {
            onSave(novo);
          } else {
            setPedidos(prev => [novo, ...prev]);
          }
          exibirToast(`Pedido #${novo.id || ''} cadastrado com sucesso!`, 'sucesso');
        }}
      />
    </div>
  );
};

export default PedidosView;
