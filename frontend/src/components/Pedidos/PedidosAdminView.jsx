import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StatusBadge, BottomSheetModal } from '../common';
import NovoPedidoModal from './NovoPedidoModal';
import { pedidoService } from '../../services/pedidos/pedidoService';
import './PedidosAdminView.css';

/**
 * Motivos pré-definidos para recusa de solicitações de patrimônio pela administração
 */
const MOTIVOS_RECUSA_PATRIMONIO = [
  'Indisponibilidade orçamentária para nova aquisição',
  'Necessidade de realocação interna de item existente',
  'Setor já possui cota de bens permanentes atingida',
  'Equipamento em avaliação técnica de viabilidade',
  'Solicitação duplicada no sistema'
];

/**
 * Normaliza e identifica se o pedido é de patrimônio (bem durável)
 */
const ehPedidoPatrimonio = (pedido) => {
  if (!pedido) return false;
  if (pedido.tipoPedido === 'patrimonio') return true;
  if (pedido.aguardandoAprovacaoAdmin) return true;
  if (Array.isArray(pedido.itens) && pedido.itens.some((i) => i.bemDuravel)) return true;
  if (Array.isArray(pedido.materiais) && pedido.materiais.some((i) => i.bemDuravel)) return true;
  return false;
};

/**
 * Mapeia o status do pedido para a chave do StatusBadge padrão
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
 * Identifica a etapa atual da esteira de triagem e atendimento do pedido,
 * gerando dados tanto para a tag rápida na tabela quanto para o stepper na ficha.
 */
const obterInfoEtapaTriagem = (pedido) => {
  if (!pedido) {
    return {
      etapaAtual: 1,
      rotuloTabela: 'Solicitação',
      detalhe: '',
      etapas: []
    };
  }

  const ehPatri = ehPedidoPatrimonio(pedido);
  const st = String(pedido.status || '').toLowerCase().trim();
  const isCancelado = st === 'cancelado' || st === 'recusado';
  const isPendente = st === 'pendente';
  const isSeparacao = st === 'em separação' || st === 'em separacao' || st === 'separação' || st === 'separacao';
  const isPronto = st === 'pronto p/ retirada' || st === 'pronto para retirada' || st === 'pronto';
  const isAtendido = st === 'atendido' || st === 'atendido parcialmente' || st === 'entregue' || st === 'concluído' || st === 'concluido';

  let etapaAtual = 1;
  let rotuloTabela = 'Etapa 1/5: Solicitação';
  let detalhe = 'Solicitação registrada no sistema';

  if (isCancelado) {
    etapaAtual = 0;
    rotuloTabela = 'Encerrado (Recusado)';
    detalhe = pedido.motivoCancelamento ? `Recusado: ${pedido.motivoCancelamento}` : 'Solicitação cancelada ou recusada';
  } else if (isPendente) {
    etapaAtual = 2;
    rotuloTabela = ehPatri ? 'Etapa 2/5: Triagem Admin' : 'Etapa 2/5: Triagem Almox.';
    detalhe = ehPatri ? 'Aguardando deliberação da administração' : 'Aguardando início de separação pelo almoxarifado';
  } else if (isSeparacao) {
    etapaAtual = 3;
    rotuloTabela = 'Etapa 3/5: Em Separação';
    detalhe = 'Itens em conferência e separação física no almoxarifado';
  } else if (isPronto) {
    etapaAtual = 4;
    rotuloTabela = 'Etapa 4/5: Pronto Retirada';
    detalhe = 'Itens separados aguardando retirada no balcão';
  } else if (isAtendido) {
    etapaAtual = 5;
    rotuloTabela = 'Etapa 5/5: Concluído';
    detalhe = 'Pedido entregue ao solicitante e estoque atualizado';
  }

  const etapas = [
    {
      id: 'solicitacao',
      nome: 'Solicitação',
      descricao: pedido.data ? `Criado em ${pedido.data}` : 'Registrado',
      estado: 'concluido'
    },
    {
      id: 'triagem',
      nome: ehPatri ? 'Triagem Admin' : 'Triagem Operacional',
      descricao: isCancelado && isPendente
        ? 'Recusado na triagem'
        : isPendente
        ? (ehPatri ? 'Aguardando parecer da administração' : 'Na fila de separação')
        : (ehPatri ? 'Autorizado pela administração' : 'Liberado para atendimento'),
      estado: isCancelado && isPendente
        ? 'cancelado'
        : isPendente
        ? 'ativo'
        : 'concluido'
    },
    {
      id: 'separacao',
      nome: 'Separação Física',
      descricao: isCancelado && !isSeparacao && !isPronto && !isAtendido
        ? 'Cancelado'
        : isSeparacao
        ? 'Em conferência no estoque'
        : (isPronto || isAtendido)
        ? 'Itens conferidos'
        : 'Aguardando início',
      estado: isSeparacao
        ? 'ativo'
        : (isPronto || isAtendido)
        ? 'concluido'
        : isCancelado
        ? 'cancelado'
        : 'pendente'
    },
    {
      id: 'pronto',
      nome: 'Pronto Retirada',
      descricao: isPronto
        ? 'Disponível no balcão'
        : isAtendido
        ? 'Retirado'
        : 'Pendente',
      estado: isPronto
        ? 'ativo'
        : isAtendido
        ? 'concluido'
        : isCancelado
        ? 'cancelado'
        : 'pendente'
    },
    {
      id: 'concluido',
      nome: 'Entrega & Baixa',
      descricao: isAtendido
        ? (pedido.dataEntrega ? `Entregue em ${pedido.dataEntrega}` : 'Entregue e concluído')
        : isCancelado
        ? 'Não entregue'
        : 'Pendente',
      estado: isAtendido
        ? 'concluido'
        : isCancelado
        ? 'cancelado'
        : 'pendente'
    }
  ];

  return { etapaAtual, rotuloTabela, detalhe, etapas };
};

/**
 * Painel de Governança, Autorização e Auditoria de Pedidos (Administração)
 *
 * Arquitetura de Viewport 100% Estável (Zero Cumulative Layout Shift):
 * - Altura constante preenchendo a área disponível sem scroll na página externa.
 * - Barra de topo unificada: alternância de abas de trabalho + busca + botão "+ Novo Pedido de Patrimônio".
 * - Aba "Aguardando Autorização": fila de parecer de bens duráveis em tabela densa.
 * - Aba "Todos os Pedidos": visão de auditoria institucional em modo leitura.
 */
const PedidosAdminView = ({
  pedidos = [],
  onAutorizar,
  onRecusar,
  onNovoPedido,
  usuariosDisponiveis = [],
  materiaisDisponiveis = []
}) => {
  // Aba ativa: 'autorizacoes' | 'todos'
  const [abaAtiva, setAbaAtiva] = useState('autorizacoes');

  // Filtros de busca e visualização
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'patrimonio' | 'consumo'
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Modais e gavetas
  const [isNovoPedidoPatrimonioOpen, setIsNovoPedidoPatrimonioOpen] = useState(false);
  const [pedidoFicha, setPedidoFicha] = useState(null);
  const [fichaHistorico, setFichaHistorico] = useState([]);
  const [fichaLoading, setFichaLoading] = useState(false);

  // Estado de autorização e recusa
  const [processandoId, setProcessandoId] = useState(null);
  const [pedidoRecusa, setPedidoRecusa] = useState(null);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [motivoCustomizado, setMotivoCustomizado] = useState('');

  // Notificação de feedback local
  const [feedback, setFeedback] = useState(null);

  // Solicitações de patrimônio aguardando parecer do Administrador
  const pendentesPatrimonio = useMemo(() => {
    return pedidos.filter((p) => {
      const isPatrimonio = ehPedidoPatrimonio(p);
      const isPendente = String(p.status || '').toLowerCase().trim() === 'pendente';
      return isPatrimonio && isPendente;
    });
  }, [pedidos]);

  // Lista filtrada da aba "Aguardando Autorização"
  const autorizacoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return pendentesPatrimonio;

    return pendentesPatrimonio.filter((p) => {
      const numPedido = `#${p.id}`.toLowerCase();
      const solicitante = String(p.usuario || '').toLowerCase();
      const setor = String(p.setor || '').toLowerCase();
      const justificativa = String(p.justificativa || '').toLowerCase();
      const itensTexto = Array.isArray(p.itens)
        ? p.itens.map((i) => i.materialNome || i.nome || '').join(' ').toLowerCase()
        : '';

      return (
        numPedido.includes(termo) ||
        solicitante.includes(termo) ||
        setor.includes(termo) ||
        justificativa.includes(termo) ||
        itensTexto.includes(termo)
      );
    });
  }, [pendentesPatrimonio, busca]);

  // Lista filtrada da aba "Todos os Pedidos"
  const todosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return pedidos.filter((p) => {
      const isPatrimonio = ehPedidoPatrimonio(p);
      if (filtroTipo === 'patrimonio' && !isPatrimonio) return false;
      if (filtroTipo === 'consumo' && isPatrimonio) return false;

      const st = String(p.status || '').toLowerCase().trim();
      if (filtroStatus === 'pendente' && st !== 'pendente') return false;
      if (filtroStatus === 'em_separacao' && !st.includes('separ')) return false;
      if (filtroStatus === 'pronto' && !st.includes('pronto')) return false;
      if (filtroStatus === 'atendido' && !st.includes('atendido') && !st.includes('entregue')) return false;
      if (filtroStatus === 'cancelado' && !st.includes('cancelado') && !st.includes('recusado')) return false;

      if (!termo) return true;
      const numPedido = `#${p.id}`.toLowerCase();
      const solicitante = String(p.usuario || '').toLowerCase();
      const setor = String(p.setor || '').toLowerCase();
      const material = String(p.material || '').toLowerCase();
      const itensTexto = Array.isArray(p.itens)
        ? p.itens.map((i) => i.materialNome || i.nome || '').join(' ').toLowerCase()
        : '';

      return (
        numPedido.includes(termo) ||
        solicitante.includes(termo) ||
        setor.includes(termo) ||
        material.includes(termo) ||
        itensTexto.includes(termo)
      );
    });
  }, [pedidos, busca, filtroTipo, filtroStatus]);

  // Abre e fecha ficha de detalhes
  const handleAbrirFicha = (pedido) => {
    setFichaHistorico([]);
    setFichaLoading(true);
    setPedidoFicha(pedido);
  };

  const handleFecharFicha = () => {
    setPedidoFicha(null);
    setFichaHistorico([]);
    setFichaLoading(false);
  };

  // Carrega histórico quando abre a ficha do pedido ou quando o status muda
  useEffect(() => {
    if (!pedidoFicha?.id) return;

    let active = true;
    pedidoService
      .obterHistorico(pedidoFicha.id)
      .then((data) => {
        if (!active) return;
        const lista = Array.isArray(data) ? data : [];
        if (lista.length > 0) {
          setFichaHistorico(lista);
        } else {
          // Marco inicial de auditoria padrão para pedidos legados ou sementes sem logs no banco
          const ehPatri = ehPedidoPatrimonio(pedidoFicha);
          setFichaHistorico([
            {
              id: `legado-${pedidoFicha.id}`,
              statusNovo: pedidoFicha.status || 'Pendente',
              dataHora: pedidoFicha.data || 'Registrado',
              usuarioNome: pedidoFicha.usuario || 'Solicitante',
              descricao: ehPatri
                ? 'Solicitação de patrimônio cadastrada no sistema institucional.'
                : 'Solicitação de material criada e encaminhada para triagem.'
            }
          ]);
        }
      })
      .catch(() => {
        if (!active) return;
        const ehPatri = ehPedidoPatrimonio(pedidoFicha);
        setFichaHistorico([
          {
            id: `contingencia-${pedidoFicha.id}`,
            statusNovo: pedidoFicha.status || 'Pendente',
            dataHora: pedidoFicha.data || 'Registrado',
            usuarioNome: pedidoFicha.usuario || 'Solicitante',
            descricao: ehPatri
              ? 'Solicitação de patrimônio registrada.'
              : 'Solicitação de material registrada.'
          }
        ]);
      })
      .finally(() => {
        if (active) setFichaLoading(false);
      });

    return () => {
      active = false;
    };
  }, [pedidoFicha]);

  const dispararFeedback = (texto, tipo = 'success') => {
    setFeedback({ texto, tipo });
    window.setTimeout(() => setFeedback(null), 4000);
  };

  // Autorização de solicitação de patrimônio
  const handleConfirmarAutorizacao = async (pedidoId) => {
    if (processandoId) return;
    setProcessandoId(pedidoId);
    try {
      const sucesso = await onAutorizar(pedidoId);
      if (sucesso) {
        dispararFeedback(`Solicitação #${pedidoId} autorizada com sucesso! Encaminhada para separação no almoxarifado.`);
        if (pedidoFicha?.id === pedidoId) {
          setPedidoFicha(prev => (prev ? { ...prev, status: 'Em Separação' } : null));
        }
      }
    } finally {
      setProcessandoId(null);
    }
  };

  // Iniciar fluxo de recusa
  const handleAbrirRecusa = (pedido) => {
    setPedidoRecusa(pedido);
    setMotivoRecusa(MOTIVOS_RECUSA_PATRIMONIO[0]);
    setMotivoCustomizado('');
  };

  // Confirmar recusa
  const handleConfirmarRecusa = async () => {
    if (!pedidoRecusa || processandoId) return;
    const motivoFinal = motivoCustomizado.trim() || motivoRecusa;
    if (!motivoFinal) {
      alert('Por favor, informe ou selecione a justificativa da recusa.');
      return;
    }

    const id = pedidoRecusa.id;
    setProcessandoId(id);
    try {
      const sucesso = await onRecusar(id, motivoFinal);
      if (sucesso) {
        dispararFeedback(`Solicitação #${id} recusada. O solicitante foi notificado.`, 'info');
        setPedidoRecusa(null);
        if (pedidoFicha?.id === id) {
          setPedidoFicha(prev => (prev ? { ...prev, status: 'Cancelado', motivoCancelamento: motivoFinal } : null));
        }
      }
    } finally {
      setProcessandoId(null);
    }
  };

  return (
    <div className="pedidos-admin">
      {/* Banner de Feedback Flutuante */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`pedidos-admin__feedback pedidos-admin__feedback--${feedback.tipo}`}
            role="status"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{feedback.texto}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de Trabalho Unificada (Fixed Header - Abas, Filtros e Ação) */}
      <div className="pedidos-admin__toolbar">
        {/* Abas de Trabalho Segmentadas */}
        <div className="pedidos-admin__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === 'autorizacoes'}
            className={`pedidos-admin__tab ${abaAtiva === 'autorizacoes' ? 'pedidos-admin__tab--ativa' : ''}`}
            onClick={() => setAbaAtiva('autorizacoes')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Aguardando Autorização</span>
            {pendentesPatrimonio.length > 0 ? (
              <span className="pedidos-admin__tab-badge pedidos-admin__tab-badge--amber">
                {pendentesPatrimonio.length}
              </span>
            ) : (
              <span className="pedidos-admin__tab-badge pedidos-admin__tab-badge--zero">0</span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={abaAtiva === 'todos'}
            className={`pedidos-admin__tab ${abaAtiva === 'todos' ? 'pedidos-admin__tab--ativa' : ''}`}
            onClick={() => setAbaAtiva('todos')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span>Todos os Pedidos</span>
            <span className="pedidos-admin__tab-badge pedidos-admin__tab-badge--neutral">
              {pedidos.length}
            </span>
          </button>
        </div>

        {/* Controles da Direita: Busca, Filtros Condicionais e Botão Primário */}
        <div className="pedidos-admin__controls">
          <div className="pedidos-admin__busca-wrap">
            <svg className="pedidos-admin__busca-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="pedidos-admin__busca-input"
              placeholder={abaAtiva === 'autorizacoes' ? 'Buscar solicitações pendentes...' : 'Buscar por nº, solicitante, setor...'}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar pedidos"
            />
            {busca && (
              <button
                type="button"
                className="pedidos-admin__busca-limpar"
                onClick={() => setBusca('')}
                aria-label="Limpar busca"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Filtros específicos da aba "Todos os Pedidos" */}
          {abaAtiva === 'todos' && (
            <>
              <select
                className="pedidos-admin__select"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                aria-label="Filtrar por tipo"
              >
                <option value="todos">Todos os Tipos</option>
                <option value="patrimonio">Apenas Patrimônio</option>
                <option value="consumo">Apenas Consumo</option>
              </select>

              <select
                className="pedidos-admin__select"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                aria-label="Filtrar por situação"
              >
                <option value="todos">Todas as Situações</option>
                <option value="pendente">Pendente</option>
                <option value="em_separacao">Em Separação</option>
                <option value="pronto">Pronto para Retirada</option>
                <option value="atendido">Atendido / Entregue</option>
                <option value="cancelado">Cancelado / Recusado</option>
              </select>
            </>
          )}

          {/* Botão de Ação Primária: Novo Pedido de Patrimônio */}
          {onNovoPedido && (
            <button
              type="button"
              className="pedidos-admin__btn-novo-patrimonio"
              onClick={() => setIsNovoPedidoPatrimonioOpen(true)}
              title="Cadastrar nova solicitação de patrimônio com autorização imediata"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
              <span>Novo Pedido de Patrimônio</span>
            </button>
          )}
        </div>
      </div>

      {/* Workspace Principal com Altura Fixa e Scroll Interno */}
      <div className="pedidos-admin__workspace">
        <div className="pedidos-admin__tabela-scroll">
          {abaAtiva === 'autorizacoes' ? (
            /* ================= TABELA DE AUTORIZAÇÕES DE PATRIMÔNIO ================= */
            <table className="pedidos-admin__tabela">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '75px' }}>Nº</th>
                  <th scope="col" style={{ width: '95px' }}>Data</th>
                  <th scope="col" style={{ width: '210px' }}>Solicitante & Setor</th>
                  <th scope="col" style={{ width: '230px' }}>Bens Solicitados</th>
                  <th scope="col">Justificativa</th>
                  <th scope="col" style={{ width: '225px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {autorizacoesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="pedidos-admin__empty-row">
                      <div className="pedidos-admin__empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Nenhuma solicitação de patrimônio aguardando parecer. Todas as autorizações estão em dia.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  autorizacoesFiltradas.map((pedido) => {
                    const isUrgente = pedido.urgente || String(pedido.prioridade).toLowerCase() === 'urgente';
                    const isCarregando = processandoId === pedido.id;

                    return (
                      <tr
                        key={pedido.id}
                        className="pedidos-admin__linha"
                        onClick={() => handleAbrirFicha(pedido)}
                        title="Clique na linha para ver a ficha completa"
                      >
                        <td className="pedidos-admin__celula-id">
                          <div className="pedidos-admin__id-wrap">
                            <span className="pedidos-admin__numero-id">#{pedido.id}</span>
                            {isUrgente && (
                              <span
                                className="pedidos-admin__ponto-urgente"
                                title="Prioridade Urgente"
                                aria-label="Urgente"
                              />
                            )}
                          </div>
                        </td>
                        <td className="pedidos-admin__celula-data">{pedido.data}</td>
                        <td className="pedidos-admin__celula-solicitante">
                          <div className="pedidos-admin__solicitante-wrap">
                            <span className="pedidos-admin__texto-solicitante" title={pedido.usuario}>{pedido.usuario}</span>
                            <span className="pedidos-admin__texto-setor" title={pedido.setor}>{pedido.setor}</span>
                          </div>
                        </td>
                        <td className="pedidos-admin__celula-itens">
                          <div className="pedidos-admin__itens-pills-wrap">
                            {(pedido.itens || []).map((it, idx) => (
                              <span key={idx} className="pedidos-admin__item-chip">
                                <strong className="pedidos-admin__item-chip-qtd">{it.quantidade}x</strong>
                                <span className="pedidos-admin__item-chip-nome">{it.materialNome || it.nome}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="pedidos-admin__celula-justificativa">
                          <span className="pedidos-admin__justificativa-preview" title={pedido.justificativa || 'Sem justificativa informada'}>
                            {pedido.justificativa ? `"${pedido.justificativa}"` : '—'}
                          </span>
                        </td>
                        <td className="pedidos-admin__celula-acoes" style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div className="pedidos-admin__row-actions">
                            <button
                              type="button"
                              className="pedidos-admin__btn-row-recusar"
                              onClick={() => handleAbrirRecusa(pedido)}
                              disabled={isCarregando}
                              title="Recusar solicitação"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                              <span>Recusar</span>
                            </button>

                            <button
                              type="button"
                              className="pedidos-admin__btn-row-autorizar"
                              onClick={() => handleConfirmarAutorizacao(pedido.id)}
                              disabled={isCarregando}
                              title="Autorizar e liberar para o almoxarifado"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span>{isCarregando ? '...' : 'Autorizar'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* ================= TABELA GERAL DE AUDITORIA ================= */
            <table className="pedidos-admin__tabela">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '75px' }}>Nº</th>
                  <th scope="col" style={{ width: '95px' }}>Data</th>
                  <th scope="col" style={{ width: '120px' }}>Tipo</th>
                  <th scope="col" style={{ width: '210px' }}>Solicitante & Setor</th>
                  <th scope="col">Resumo dos Materiais</th>
                  <th scope="col" style={{ width: '190px' }}>Situação & Etapa</th>
                  <th scope="col" style={{ width: '36px', textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {todosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="pedidos-admin__empty-row">
                      <div className="pedidos-admin__empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <span>Nenhum pedido encontrado com os filtros selecionados.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  todosFiltrados.map((pedido) => {
                    const isPatrimonio = ehPedidoPatrimonio(pedido);
                    const isUrgente = pedido.urgente || String(pedido.prioridade).toLowerCase() === 'urgente';
                    const badgeCode = getStatusBadgeCode(pedido.status);
                    const infoEtapa = obterInfoEtapaTriagem(pedido);

                    return (
                      <tr
                        key={pedido.id}
                        className="pedidos-admin__linha"
                        onClick={() => handleAbrirFicha(pedido)}
                        title="Clique para ver a ficha completa de auditoria"
                      >
                        <td className="pedidos-admin__celula-id">
                          <div className="pedidos-admin__id-wrap">
                            <span className="pedidos-admin__numero-id">#{pedido.id}</span>
                            {isUrgente && (
                              <span
                                className="pedidos-admin__ponto-urgente"
                                title="Pedido Urgente"
                                aria-label="Urgente"
                              />
                            )}
                          </div>
                        </td>
                        <td className="pedidos-admin__celula-data">{pedido.data}</td>
                        <td className="pedidos-admin__celula-tipo">
                          {isPatrimonio ? (
                            <span className="pedidos-admin__pill-tipo pedidos-admin__pill-tipo--patrimonio">
                              Patrimônio
                            </span>
                          ) : (
                            <span className="pedidos-admin__pill-tipo pedidos-admin__pill-tipo--consumo">
                              Consumo
                            </span>
                          )}
                        </td>
                        <td className="pedidos-admin__celula-solicitante">
                          <div className="pedidos-admin__solicitante-wrap">
                            <span className="pedidos-admin__texto-solicitante" title={pedido.usuario}>{pedido.usuario}</span>
                            <span className="pedidos-admin__texto-setor" title={pedido.setor}>{pedido.setor}</span>
                          </div>
                        </td>
                        <td className="pedidos-admin__celula-itens">
                          <span className="pedidos-admin__texto-resumo">
                            {pedido.material || (pedido.itens || []).map((i) => i.materialNome).join(', ')}
                          </span>
                        </td>
                        <td className="pedidos-admin__celula-situacao">
                          <div className="pedidos-admin__situacao-wrap">
                            <StatusBadge status={badgeCode} label={pedido.status} size="sm" />
                            <span className="pedidos-admin__etapa-rotulo" title={infoEtapa.detalhe}>
                              {infoEtapa.rotuloTabela}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="pedidos-admin__row-arrow" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé Fixo da Tabela: Contagem Invariável */}
        <div className="pedidos-admin__footer-info">
          <span>
            {abaAtiva === 'autorizacoes'
              ? `Exibindo ${autorizacoesFiltradas.length} de ${pendentesPatrimonio.length} solicitações aguardando parecer`
              : `Exibindo ${todosFiltrados.length} de ${pedidos.length} pedidos institucionais registrados`}
          </span>
        </div>
      </div>

      {/* Modal / Gaveta de Auditoria do Pedido (Ficha Completa) */}
      <BottomSheetModal
        isOpen={Boolean(pedidoFicha)}
        onClose={handleFecharFicha}
        title={pedidoFicha ? `Ficha do Pedido #${pedidoFicha.id}` : ''}
        subtitle="Auditoria e Rastreabilidade Institucional"
        maxWidth="680px"
        badge={
          pedidoFicha && (
            <div className="pedidos-admin__ficha-badges">
              {ehPedidoPatrimonio(pedidoFicha) ? (
                <span className="pedidos-admin__pill-tipo pedidos-admin__pill-tipo--patrimonio">Patrimônio</span>
              ) : (
                <span className="pedidos-admin__pill-tipo pedidos-admin__pill-tipo--consumo">Consumo</span>
              )}
              <StatusBadge status={getStatusBadgeCode(pedidoFicha.status)} label={pedidoFicha.status} size="sm" />
            </div>
          )
        }
      >
        {pedidoFicha && (
          <div className="pedidos-admin__ficha-conteudo">
            <div className="pedidos-admin__ficha-secao">
              <h4 className="pedidos-admin__ficha-subtitulo">Dados da Solicitação</h4>
              <div className="pedidos-admin__ficha-grid-info">
                <div>
                  <span className="pedidos-admin__info-rotulo">Solicitante:</span>
                  <span className="pedidos-admin__info-valor">{pedidoFicha.usuario}</span>
                </div>
                <div>
                  <span className="pedidos-admin__info-rotulo">Setor:</span>
                  <span className="pedidos-admin__info-valor">{pedidoFicha.setor}</span>
                </div>
                <div>
                  <span className="pedidos-admin__info-rotulo">Data da Solicitação:</span>
                  <span className="pedidos-admin__info-valor">{pedidoFicha.data}</span>
                </div>
                <div>
                  <span className="pedidos-admin__info-rotulo">Prioridade:</span>
                  <span className="pedidos-admin__info-valor">
                    {pedidoFicha.urgente || String(pedidoFicha.prioridade).toLowerCase() === 'urgente' ? 'Urgente' : 'Normal'}
                  </span>
                </div>
              </div>

              {pedidoFicha.justificativa && (
                <div className="pedidos-admin__ficha-justificativa">
                  <span className="pedidos-admin__info-rotulo">Justificativa Institucional:</span>
                  <p className="pedidos-admin__justificativa-box">{pedidoFicha.justificativa}</p>
                </div>
              )}
            </div>

            {/* Stepper Visual de Esteira de Triagem & Atendimento */}
            <div className="pedidos-admin__ficha-secao">
              <div className="pedidos-admin__ficha-secao-header">
                <h4 className="pedidos-admin__ficha-subtitulo">Etapa da Triagem & Atendimento</h4>
                <span className="pedidos-admin__ficha-etapa-destaque">
                  {obterInfoEtapaTriagem(pedidoFicha).rotuloTabela}
                </span>
              </div>
              <div className="pedidos-admin__stepper" role="navigation" aria-label="Progresso da solicitação">
                {obterInfoEtapaTriagem(pedidoFicha).etapas.map((et, idx, arr) => (
                  <div key={et.id} className={`pedidos-admin__stepper-step pedidos-admin__stepper-step--${et.estado}`}>
                    <div className="pedidos-admin__stepper-step-head">
                      <div className="pedidos-admin__stepper-marcador">
                        {et.estado === 'concluido' ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : et.estado === 'cancelado' ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>
                      {idx < arr.length - 1 && (
                        <div className={`pedidos-admin__stepper-linha ${et.estado === 'concluido' ? 'pedidos-admin__stepper-linha--concluida' : ''}`} />
                      )}
                    </div>
                    <div className="pedidos-admin__stepper-info">
                      <span className="pedidos-admin__stepper-nome">{et.nome}</span>
                      <span className="pedidos-admin__stepper-sub">{et.descricao}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pedidos-admin__ficha-secao">
              <h4 className="pedidos-admin__ficha-subtitulo">Materiais e Quantidades</h4>
              <table className="pedidos-admin__ficha-tabela-itens">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Tipo</th>
                    <th style={{ width: '90px', textAlign: 'right' }}>Solicitado</th>
                    <th style={{ width: '90px', textAlign: 'right' }}>Entregue</th>
                  </tr>
                </thead>
                <tbody>
                  {(pedidoFicha.itens || []).map((it, idx) => (
                    <tr key={idx}>
                      <td className="pedidos-admin__ficha-item-nome">{it.materialNome || it.nome}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="pedidos-admin__ficha-item-tipo">
                          {it.bemDuravel ? 'Patrimônio' : 'Consumo'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {it.quantidade} {it.unidade || 'UN'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {it.quantidadeAtendida !== undefined ? `${it.quantidadeAtendida} ${it.unidade || 'UN'}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(pedidoFicha.mensagemAlmoxarife || pedidoFicha.motivoCancelamento || pedidoFicha.dataEntrega) && (
              <div className="pedidos-admin__ficha-secao">
                <h4 className="pedidos-admin__ficha-subtitulo">Observações do Almoxarifado</h4>
                {pedidoFicha.dataEntrega && (
                  <p className="pedidos-admin__obs-linha">
                    <strong>Data da Entrega:</strong> {pedidoFicha.dataEntrega}
                  </p>
                )}
                {pedidoFicha.mensagemAlmoxarife && (
                  <p className="pedidos-admin__obs-linha">
                    <strong>Mensagem de Retirada:</strong> {pedidoFicha.mensagemAlmoxarife}
                  </p>
                )}
                {pedidoFicha.motivoCancelamento && (
                  <p className="pedidos-admin__obs-linha pedidos-admin__obs-linha--recusa">
                    <strong>Motivo da Recusa/Cancelamento:</strong> {pedidoFicha.motivoCancelamento}
                  </p>
                )}
              </div>
            )}

            <div className="pedidos-admin__ficha-secao">
              <h4 className="pedidos-admin__ficha-subtitulo">Linha do Tempo e Rastreabilidade</h4>
              {fichaLoading ? (
                <p className="pedidos-admin__timeline-loading">Carregando eventos do histórico...</p>
              ) : fichaHistorico.length === 0 ? (
                <p className="pedidos-admin__timeline-vazio">Nenhum registro de movimentação encontrado.</p>
              ) : (
                <div className="pedidos-admin__timeline">
                  {fichaHistorico.map((log) => (
                    <div key={log.id} className="pedidos-admin__timeline-item">
                      <div className="pedidos-admin__timeline-marcador" />
                      <div className="pedidos-admin__timeline-conteudo">
                        <div className="pedidos-admin__timeline-header">
                          <span className="pedidos-admin__timeline-status">{log.statusNovo}</span>
                          <span className="pedidos-admin__timeline-data">{log.dataHora}</span>
                        </div>
                        <div className="pedidos-admin__timeline-autor">
                          Responsável: <strong>{log.usuarioNome}</strong>
                        </div>
                        {log.descricao && (
                          <p className="pedidos-admin__timeline-desc">{log.descricao}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {ehPedidoPatrimonio(pedidoFicha) && String(pedidoFicha.status).toLowerCase().trim() === 'pendente' && (
              <div className="pedidos-admin__ficha-acoes-autorizacao">
                <span className="pedidos-admin__ficha-acoes-aviso">
                  Esta solicitação de patrimônio está aguardando seu parecer:
                </span>
                <div className="pedidos-admin__ficha-acoes-btns">
                  <button
                    type="button"
                    className="pedidos-admin__btn-row-recusar"
                    onClick={() => handleAbrirRecusa(pedidoFicha)}
                    disabled={processandoId === pedidoFicha.id}
                  >
                    Recusar Solicitação
                  </button>
                  <button
                    type="button"
                    className="pedidos-admin__btn-row-autorizar"
                    onClick={() => handleConfirmarAutorizacao(pedidoFicha.id)}
                    disabled={processandoId === pedidoFicha.id}
                  >
                    Autorizar para Separação
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </BottomSheetModal>

      {/* Modal de Confirmação de Recusa de Patrimônio */}
      <BottomSheetModal
        isOpen={Boolean(pedidoRecusa)}
        onClose={() => setPedidoRecusa(null)}
        title={pedidoRecusa ? `Recusar Solicitação #${pedidoRecusa.id}` : ''}
        subtitle="Parecer da Administração"
        maxWidth="500px"
      >
        {pedidoRecusa && (
          <div className="pedidos-admin__recusa-form">
            <p className="pedidos-admin__recusa-aviso">
              Selecione o motivo da recusa ou informe uma justificativa detalhada. O solicitante será notificado.
            </p>

            <div className="pedidos-admin__recusa-chips">
              {MOTIVOS_RECUSA_PATRIMONIO.map((motivo, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`pedidos-admin__recusa-chip ${motivoRecusa === motivo ? 'pedidos-admin__recusa-chip--ativo' : ''}`}
                  onClick={() => {
                    setMotivoRecusa(motivo);
                    setMotivoCustomizado('');
                  }}
                >
                  {motivo}
                </button>
              ))}
            </div>

            <div className="pedidos-admin__recusa-custom">
              <label htmlFor="motivo-customizado" className="pedidos-admin__recusa-label">
                Ou descreva o motivo específico:
              </label>
              <textarea
                id="motivo-customizado"
                className="pedidos-admin__recusa-textarea"
                rows="3"
                placeholder="Explique o motivo da recusa para constar no histórico oficial..."
                value={motivoCustomizado}
                onChange={(e) => setMotivoCustomizado(e.target.value)}
              />
            </div>

            <div className="pedidos-admin__recusa-footer">
              <button
                type="button"
                className="pedidos-admin__btn-voltar"
                onClick={() => setPedidoRecusa(null)}
                disabled={processandoId === pedidoRecusa.id}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pedidos-admin__btn-confirmar-recusa"
                onClick={handleConfirmarRecusa}
                disabled={processandoId === pedidoRecusa.id}
              >
                {processandoId === pedidoRecusa.id ? 'Recusando...' : 'Confirmar Recusa'}
              </button>
            </div>
          </div>
        )}
      </BottomSheetModal>

      {/* Modal de Novo Pedido de Patrimônio (Autorizado Imediatamente pelo Admin) */}
      {onNovoPedido && (
        <NovoPedidoModal
          isOpen={isNovoPedidoPatrimonioOpen}
          onClose={() => setIsNovoPedidoPatrimonioOpen(false)}
          initialData={{ tipoPedido: 'patrimonio' }}
          onSave={async (dados) => {
            const sucesso = await onNovoPedido({
              ...dados,
              tipoPedido: 'patrimonio'
            });
            if (sucesso) {
              dispararFeedback('Pedido de patrimônio registrado e autorizado com sucesso! Encaminhado ao almoxarifado.');
              setIsNovoPedidoPatrimonioOpen(false);
            }
          }}
          materiaisDisponiveis={materiaisDisponiveis}
          usuariosDisponiveis={usuariosDisponiveis}
          userRole="admin"
        />
      )}
    </div>
  );
};

export default PedidosAdminView;
