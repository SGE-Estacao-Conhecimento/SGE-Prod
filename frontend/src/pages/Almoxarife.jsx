import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Topbar from '../components/Topbar/Topbar';
import AlmoxarifeEstoque from '../components/AlmoxarifeEstoque/AlmoxarifeEstoque';
import PedidosView from '../components/Pedidos/PedidosView';
import RelatoriosView from '../components/Relatorios/RelatoriosView';
import AlmoxarifePerfil from '../components/AlmoxarifePerfil/AlmoxarifePerfil';
import NovoPedidoModal from '../components/Pedidos/NovoPedidoModal';
import { BottomNav, PageTabTransition, useSectionNavigation, SpeedDialFAB } from '../components/common';
import './Almoxarife.css';
import '../components/Sidebar/Sidebar.css';
import { useEffect } from 'react';
import { materialService } from '../services/materiais/materialService';
import { movimentacaoService } from '../services/movimentacoes/movimentacaoService';
import { notificacaoService } from '../services/notificacoes/notificacaoService';
import { remessaService } from '../services/remessas/remessaService';
import { pedidoService } from '../services/pedidos/pedidoService';
import { usuarioService } from '../services/usuarios/usuarioService';
import { formatarErroApi } from '../services/api/client';

const TITLES = {
  estoque: 'Controle de Estoque & Movimentações',
  pedidos: 'Separação e Pedidos',
  relatorios: 'Relatórios de Estoque',
  perfil: 'Meu Perfil'
};

const navItemsAlmoxarife = [
  {
    id: 'estoque',
    label: 'Estoque',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    )
  },
  {
    id: 'pedidos',
    label: 'Pedidos',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" /><line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" /><polyline points="10,9 9,9 8,9" />
      </svg>
    )
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    )
  },
  {
    id: 'perfil',
    label: 'Perfil',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  }
];

const ALMOXARIFE_SECTIONS = navItemsAlmoxarife.map((item) => item.id);

const Almoxarife = ({ onLogout, user }) => {
  const [materiais, setMateriais] = useState([]);
  const [materiaisLoading, setMateriaisLoading] = useState(true);
  const [materiaisError, setMateriaisError] = useState(null);
  const [historicoMovimentacoes, setHistoricoMovimentacoes] = useState({});
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [remessas, setRemessas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [pedidosLoading, setPedidosLoading] = useState(true);
  const [pedidosError, setPedidosError] = useState(null);
  const [notificacoes, setNotificacoes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosLoading, setUsuariosLoading] = useState(true);
  const [usuariosError, setUsuariosError] = useState(null);

  useEffect(() => {
    let active = true;
    usuarioService.listar()
      .then((data) => {
        if (active) {
          setUsuarios(data || []);
          setUsuariosError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setUsuarios((prev) => (prev.length > 0 ? prev : []));
          setUsuariosError(formatarErroApi(err, 'Não foi possível carregar os usuários.'));
        }
      })
      .finally(() => { if (active) setUsuariosLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    pedidoService.listar()
      .then((data) => {
        if (active) {
          setPedidos(data || []);
          setPedidosError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setPedidos((prev) => (prev.length > 0 ? prev : []));
          setPedidosError(formatarErroApi(err, 'Não foi possível carregar os pedidos.'));
        }
      })
      .finally(() => { if (active) setPedidosLoading(false); });
    return () => { active = false; };
  }, []);

  const handleRegistrarMovimentacao = async (movimentacao) => {
    await movimentacaoService.registrar(movimentacao);
    const atualizados = await materialService.listar();
    setMateriais(atualizados || []);
  };

  const handleAjustarEstoque = async (ajuste) => {
    await movimentacaoService.ajustar(ajuste);
    setMateriais(await materialService.listar());
  };

  const handleCriarRemessa = async (remessa) => {
    const criada = await remessaService.criar(remessa);
    setRemessas(await remessaService.listar());
    setMateriais(await materialService.listar());
    return criada;
  };

  // Entrega do pedido: a baixa de estoque é feita pelo back-end (ou pelo modo simulado) na mesma
  // operação da mudança de situação. Erros sobem para a tela, que exibe o aviso ao almoxarife.
  const handleConfirmarEntregaPedido = async (pedidoAtualizado) => {
    const novoStatus = pedidoAtualizado.status || 'Atendido';
    const atualizado = await pedidoService.atualizarStatus(pedidoAtualizado.id, novoStatus, {
      status: novoStatus,
      itens: pedidoAtualizado.itens,
      mensagemAlmoxarife: pedidoAtualizado.mensagemAlmoxarife
    });
    setPedidos(prev => prev.map(p => p.id === pedidoAtualizado.id ? (atualizado || pedidoAtualizado) : p));

    const [materiaisAtualizados, movsAtualizadas] = await Promise.all([
      materialService.listar(),
      movimentacaoService.listar()
    ]);
    if (materiaisAtualizados) setMateriais(materiaisAtualizados);
    if (movsAtualizadas) setMovimentacoes(movsAtualizadas);
  };

  // Cadastro e edição de material pela tela de estoque (recarrega a lista com os dados do servidor).
  const handleNovoMaterial = async (material) => {
    await materialService.criar(material);
    setMateriais(await materialService.listar());
  };

  const handleAtualizarMaterial = async (material) => {
    await materialService.editar(material.id, material);
    setMateriais(await materialService.listar());
  };

  useEffect(() => {
    let active = true;
    materialService.listar()
      .then((data) => {
        if (active) {
          setMateriais(data || []);
          setMateriaisError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setMateriais((prev) => (prev.length > 0 ? prev : []));
          setMateriaisError(formatarErroApi(err, 'Não foi possível carregar os materiais do estoque.'));
        }
      })
      .finally(() => { if (active) setMateriaisLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const carregarDados = () => Promise.all([notificacaoService.listar(), remessaService.listar()])
      .then(([novasNotificacoes, novasRemessas]) => {
        if (!active) return;
        setNotificacoes(novasNotificacoes || []);
        setRemessas(novasRemessas || []);
      })
      .catch(() => {});
    carregarDados();
    const intervalo = window.setInterval(carregarDados, 15000);
    return () => { active = false; window.clearInterval(intervalo); };
  }, []);

  useEffect(() => {
    let active = true;
    movimentacaoService.listar()
      .then((movs) => {
        if (!active) return;
        setMovimentacoes(movs || []);
        const agrupado = (movs || []).reduce((acc, item) => {
          const lista = acc[item.produtoId] || [];
          lista.push({
            id: item.id,
            tipo: item.tipo,
            qtd: item.quantidade,
            data: new Date(item.data).toLocaleString('pt-BR'),
            responsavel: item.funcionarioNome || 'Usuário',
            motivo: item.observacao || 'Movimentação registrada'
          });
          acc[item.produtoId] = lista;
          return acc;
        }, {});
        setHistoricoMovimentacoes(agrupado);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const [activeNav, setActiveNav] = useSectionNavigation('almoxarife', ALMOXARIFE_SECTIONS, 'estoque');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Estados Globais acionados pelo SpeedDialFAB flutuante (Oculto apenas no Perfil)
  const [isNovoPedidoModalOpen, setIsNovoPedidoModalOpen] = useState(false);
  const [isRecebimentoModalOpen, setIsRecebimentoModalOpen] = useState(false);
  const [isNovoMaterialModalOpen, setIsNovoMaterialModalOpen] = useState(false);
  const [draftRemessa, setDraftRemessa] = useState({
    tipoOrigem: 'doacao',
    documentoDoador: '',
    observacao: '',
    itens: [],
    fotos: []
  });

  const handleCriarNovoPedido = async (novoPedido) => {
    try {
      const criado = await pedidoService.criar(novoPedido);
      const pedidoSalvo = criado?.id ? criado : { ...novoPedido, id: novoPedido.id || Date.now(), data: new Date().toISOString(), status: 'Pendente' };
      setPedidos(prev => [pedidoSalvo, ...prev]);
      setIsNovoPedidoModalOpen(false);
    } catch (error) {
      // Não exibe um pedido que não foi gravado; o modal continua aberto para nova tentativa.
      alert(error?.message || 'Não foi possível registrar o pedido.');
    }
  };

  const handleMarcarNotifLida = (id) => {
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const handleLimparNotificacoes = () => {
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  };

  const handleNavigateToPedido = () => {
    setActiveNav('pedidos');
  };

  const handleNavClick = (id) => {
    setActiveNav(id);
    setIsSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activeNav) {
      case 'perfil':
        return (
          <PageTabTransition tabKey="perfil">
            <AlmoxarifePerfil
              user={user}
              onLogout={onLogout}
              onNavigate={handleNavClick}
            />
          </PageTabTransition>
        );
      case 'pedidos':
        return (
          <PageTabTransition tabKey="pedidos">
            {pedidosLoading && <p>Carregando pedidos...</p>}
            {pedidosError && (
              <div className="sge-feedback-banner sge-feedback-banner--error" role="alert">
                <svg className="sge-feedback-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{pedidosError}</span>
              </div>
            )}
            {!pedidosLoading && (!pedidosError || pedidos.length > 0) && (
              <PedidosView
                pedidos={pedidos}
                materiais={materiais}
                usuariosDisponiveis={usuarios}
                onConfirmarEntrega={handleConfirmarEntregaPedido}
                onSave={(novo) => {
                  setPedidos(prev => [novo, ...prev]);
                }}
                onUpdateStatus={async (pedidoId, novoStatus, extras = {}) => {
                  // Falhas sobem para a tela de pedidos, que mantém o pedido na etapa anterior e avisa.
                  const atualizado = await pedidoService.atualizarStatus(pedidoId, novoStatus, extras);
                  setPedidos(prev => prev.map(p => p.id === pedidoId ? (atualizado || { ...p, status: novoStatus, ...extras }) : p));
                }}
              />
            )}
          </PageTabTransition>
        );
      case 'relatorios':
        return (
          <PageTabTransition tabKey="relatorios">
            <RelatoriosView
              dadosEstoque={materiais}
              dadosPedidos={pedidos}
              dadosRemessasExternas={remessas}
              dadosMovimentacoes={movimentacoes}
            />
          </PageTabTransition>
        );
      case 'estoque':
      default:
        return (
          <PageTabTransition tabKey="estoque">
            {materiaisLoading && <p>Carregando estoque...</p>}
            {materiaisError && (
              <div className="sge-feedback-banner sge-feedback-banner--error" role="alert">
                <svg className="sge-feedback-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{materiaisError}</span>
              </div>
            )}
            {!materiaisLoading && (!materiaisError || materiais.length > 0) && (
              <AlmoxarifeEstoque
                materiais={materiais}
                remessasExternas={remessas}
                onCriarRemessa={handleCriarRemessa}
                onNovoMaterial={handleNovoMaterial}
                onAtualizarMaterial={handleAtualizarMaterial}
                historicoMovimentacoes={historicoMovimentacoes}
                onRegistrarMovimentacao={handleRegistrarMovimentacao}
                onAjustarEstoque={handleAjustarEstoque}
                isRecebimentoModalOpen={isRecebimentoModalOpen}
                setIsRecebimentoModalOpen={setIsRecebimentoModalOpen}
                isNovoModalOpen={isNovoMaterialModalOpen}
                setIsNovoModalOpen={setIsNovoMaterialModalOpen}
                draftRemessa={draftRemessa}
                setDraftRemessa={setDraftRemessa}
              />
            )}
          </PageTabTransition>
        );
    }
  };

  return (
    <div className="almoxarife-layout">
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar de Almoxarife (Desktop) */}
      <aside className={`sidebar ${isSidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <div className="sidebar__logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <span className="sidebar__brand-name">Sistema</span>
          <button
            type="button"
            className="sidebar__close-btn"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="sidebar__nav">
          <ul>
            {navItemsAlmoxarife.map(item => {
              const isActive = activeNav === item.id;
              return (
                <li key={item.id}>
                  <motion.button
                    id={`nav-almox-${item.id}`}
                    className={`sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`}
                    onClick={() => handleNavClick(item.id)}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="sidebar__nav-icon">{item.icon}</span>
                    <span className="sidebar__nav-label">{item.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="almoxarifeSidebarIndicator"
                        className="sidebar__nav-indicator"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      />
                    )}
                  </motion.button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user-avatar" style={{ background: '#017F7B' }}>AL</div>
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">{user?.identifier || 'Almoxarife'}</span>
            <span className="sidebar__user-role">Almoxarifado</span>
          </div>
          {onLogout && (
            <motion.button
              id="sidebar-almox-logout-btn"
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

      <div className="almoxarife-main">
        <Topbar
          title={TITLES[activeNav] || 'Almoxarifado'}
          notificacoes={notificacoes}
          onMarcarLida={handleMarcarNotifLida}
          onLimparNotificacoes={handleLimparNotificacoes}
          onNavigateToPedido={handleNavigateToPedido}
        />
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>

        {/* Barra de Navegação Inferior Universal Mobile (A Geral do SGE) */}
        <BottomNav
          items={navItemsAlmoxarife}
          activeNav={activeNav}
          onNavClick={handleNavClick}
          layoutId="almoxMobileActiveTabIndicator"
          ariaLabel="Navegação do Almoxarifado"
        />
      </div>

      {/* Botão Flutuante de Ações Rápidas (A Geral do SGE) - Oculto apenas no Perfil */}
      {activeNav !== 'perfil' && (
        <SpeedDialFAB
          badgeCount={draftRemessa.itens.length}
          actions={[
            {
              id: 'novo-pedido',
              label: 'Novo Pedido',
              variant: 'accent',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              ),
              onClick: () => setIsNovoPedidoModalOpen(true)
            },
            {
              id: 'receber-lote',
              label: 'Receber em Lote / Doação',
              variant: 'secondary',
              badge: draftRemessa.itens.length > 0 ? `${draftRemessa.itens.length} no rascunho` : null,
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              ),
              onClick: () => {
                setActiveNav('estoque');
                setIsRecebimentoModalOpen(true);
              }
            },
            {
              id: 'novo-material',
              label: 'Novo Material',
              variant: 'secondary',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ),
              onClick: () => {
                setActiveNav('estoque');
                setIsNovoMaterialModalOpen(true);
              }
            }
          ]}
          ariaLabel="Ações rápidas do Almoxarifado"
        />
      )}

      {/* Modal de Criação de Novo Pedido acessível globalmente pelo FAB */}
      <NovoPedidoModal
        isOpen={isNovoPedidoModalOpen}
        onClose={() => setIsNovoPedidoModalOpen(false)}
        materiaisDisponiveis={materiais}
        usuariosDisponiveis={usuarios}
        onSave={handleCriarNovoPedido}
      />
    </div>
  );
};

export default Almoxarife;
