import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Topbar from '../components/Topbar/Topbar';
import UsuarioEstoque from '../components/UsuarioEstoque/UsuarioEstoque';
import MeusPedidos from '../components/MeusPedidos/MeusPedidos';
import UsuarioPerfil from '../components/UsuarioPerfil/UsuarioPerfil';
import { BottomNav, PageTabTransition, useSectionNavigation } from '../components/common';
import './Usuario.css';
// A página renderiza a sidebar diretamente, então precisa carregar seus estilos.
import '../components/Sidebar/Sidebar.css';
import { pedidoService } from '../services/pedidos/pedidoService';
import { materialService } from '../services/materiais/materialService';
import { notificacaoService } from '../services/notificacoes/notificacaoService';
import { USA_API, formatarErroApi } from '../services/api/client';
import { DEMO_MATERIAIS, DEMO_PEDIDOS } from '../data/demoData';

const TITLES = {
  inicio: 'Início',
  pedidos: 'Meus Pedidos',
  perfil: 'Meu Perfil'
};

const navItemsUsuario = [
  { id: 'inicio', label: 'Início', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { id: 'pedidos', label: 'Meus Pedidos', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>
    </svg>
  )},
  { id: 'perfil', label: 'Perfil', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )}
];

const USUARIO_SECTIONS = navItemsUsuario.map((item) => item.id);

const Usuario = ({ onLogout, user, materiais = [], initialPedidos = [] }) => {
  const [activeNav, setActiveNav] = useSectionNavigation('usuario', USUARIO_SECTIONS, 'inicio');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [pedidos, setPedidos] = useState(initialPedidos || []);
  const [pedidosLoading, setPedidosLoading] = useState(true);
  const [pedidosError, setPedidosError] = useState(null);
  const [materiaisReais, setMateriaisReais] = useState(materiais);
  const [materiaisLoading, setMateriaisLoading] = useState(true);
  const [materiaisError, setMateriaisError] = useState(null);
  const [autoFocusBuscaTrigger, setAutoFocusBuscaTrigger] = useState(0);

  const [notificacoes, setNotificacoes] = useState([]);

  useEffect(() => {
    let active = true;
    setPedidosLoading(true);
    setPedidosError(null);
    pedidoService.listarMeus()
      .then((data) => {
        if (active) {
          setPedidos(data || []);
          setPedidosError(null);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (USA_API) {
          setPedidos((prev) => (prev.length > 0 ? prev : []));
          setPedidosError(formatarErroApi(err, 'Erro ao carregar seus pedidos da API.'));
        } else {
          setPedidos(DEMO_PEDIDOS);
        }
      })
      .finally(() => {
        if (active) setPedidosLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const carregarNotificacoes = () => notificacaoService.listar()
      .then((data) => {
        if (!active) return;
        setNotificacoes((data || []).map((item) => ({
          ...item,
          lida: false,
          tempo: item.data ? new Date(item.data).toLocaleString('pt-BR') : ''
        })));
      })
      .catch(() => {
        if (active) setNotificacoes([]);
      });
    carregarNotificacoes();
    const intervalo = window.setInterval(carregarNotificacoes, 15000);

    return () => { active = false; window.clearInterval(intervalo); };
  }, []);

  useEffect(() => {
    let active = true;
    setMateriaisLoading(true);
    setMateriaisError(null);
    materialService.listar()
      .then((data) => {
        if (active) {
          setMateriaisReais(data || []);
          setMateriaisError(null);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (USA_API) {
          setMateriaisReais((prev) => (prev.length > 0 ? prev : []));
          setMateriaisError(formatarErroApi(err, 'Erro ao carregar catálogo de materiais da API.'));
        } else {
          setMateriaisReais(DEMO_MATERIAIS);
        }
      })
      .finally(() => {
        if (active) setMateriaisLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleNavClick = (id) => {
    setActiveNav(id);
    setIsSidebarOpen(false);
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

  const handleNovoPedidoSubmit = async (novoPedido) => {
    const itensRecebidos = Array.isArray(novoPedido.itens) && novoPedido.itens.length > 0
      ? novoPedido.itens
      : [{
          materialNome: novoPedido.material,
          produtoId: novoPedido.produtoId,
          quantidade: novoPedido.quantidade,
          unidade: novoPedido.unidade || 'UN'
        }];

    const materiaisFormatados = itensRecebidos.map(it => ({
      materialNome: it.materialNome || it.nome,
      quantidade: it.quantidade,
      unidade: it.unidade || 'UN'
    }));

    const resumoMaterial = materiaisFormatados.length === 1
      ? materiaisFormatados[0].materialNome
      : materiaisFormatados.map(m => `${m.materialNome} (${m.quantidade} ${m.unidade})`).join(', ');

    const prioridadeFinal = novoPedido.urgente || novoPedido.prioridade === 'Urgente' ? 'Urgente' : 'Normal';
    const isUrgente = prioridadeFinal === 'Urgente';

    try {
      const criado = await pedidoService.criar(novoPedido);
      const pedidoFormatado = criado?.id ? {
        ...criado,
        material: criado.material || resumoMaterial,
        materiais: criado.materiais || materiaisFormatados,
        itens: criado.itens || itensRecebidos
      } : criado;

      setPedidos(prev => [pedidoFormatado, ...prev]);

      setNotificacoes(prev => [
        {
          id: `notif-${Date.now()}`,
          pedidoId: pedidoFormatado?.id || Date.now(),
          titulo: isUrgente ? 'Pedido Urgente Registrado' : `Pedido #${pedidoFormatado?.id || ''} Criado`,
          mensagem: `${resumoMaterial} enviado para o almoxarifado.`,
          tipo: isUrgente ? 'urgente' : 'info',
          tempo: 'Agora mesmo',
          lida: false
        },
        ...prev
      ]);

      return pedidoFormatado;
    } catch (err) {
      if (USA_API) {
        throw err;
      }
      const nextId = Math.max(...pedidos.map(p => Number(p.id) || 0), 100) + 1;
      const pedidoCriado = {
        id: nextId,
        data: new Date().toLocaleDateString('pt-BR'),
        material: resumoMaterial,
        quantidade: itensRecebidos.reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0),
        materiais: materiaisFormatados,
        itens: itensRecebidos,
        justificativa: novoPedido.justificativa,
        prioridade: prioridadeFinal,
        urgente: isUrgente,
        status: 'Pendente',
        usuario: user?.identifier || user?.nome || 'Usuário'
      };

      setPedidos(prev => [pedidoCriado, ...prev]);

      setNotificacoes(prev => [
        {
          id: `notif-${Date.now()}`,
          pedidoId: nextId,
          titulo: isUrgente ? 'Pedido Urgente Registrado' : `Pedido #${nextId} Criado`,
          mensagem: `${resumoMaterial} enviado para o almoxarifado.`,
          tipo: isUrgente ? 'urgente' : 'info',
          tempo: 'Agora mesmo',
          lida: false
        },
        ...prev
      ]);

      return pedidoCriado;
    }
  };

  // Se o servidor recusar (ex.: pedido já em separação), o erro segue para MeusPedidos,
  // que exibe o aviso "Não foi possível cancelar" em vez de marcar o pedido como cancelado.
  const handleCancelarPedido = async (pedidoId) => {
    await pedidoService.cancelar(pedidoId);
    setPedidos(prev => prev.map(p => (p.id === pedidoId ? { ...p, status: 'cancelado' } : p)));
  };

  const pendentesCount = pedidos.filter(p => p.status === 'Pendente').length;
  const initial = (user?.identifier || 'U')[0].toUpperCase();

  const renderContent = () => {
    switch (activeNav) {
      case 'perfil':
        return (
          <PageTabTransition tabKey="perfil">
            <UsuarioPerfil
              user={user}
              pedidos={pedidos}
              onLogout={onLogout}
              onNavigate={handleNavClick}
            />
          </PageTabTransition>
        );
      case 'pedidos':
        return (
          <PageTabTransition tabKey="pedidos">
            {pedidosLoading && <p className="sge-loading-text">Carregando seus pedidos...</p>}
            {pedidosError && (
              <div className="sge-feedback-banner sge-feedback-banner--error" role="alert">
                <svg className="sge-feedback-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{pedidosError}</span>
              </div>
            )}
            {!pedidosLoading && (!pedidosError || pedidos.length > 0) && (
              <MeusPedidos
                pedidos={pedidos}
                user={user}
                onCancelarPedido={handleCancelarPedido}
                onNavigateToEstoque={() => handleNavClick('inicio')}
                onPedirNovamente={handleNovoPedidoSubmit}
              />
            )}
          </PageTabTransition>
        );
      case 'inicio':
      default:
        return (
          <PageTabTransition tabKey="inicio" className="usuario-inicio-container">
            {materiaisLoading && <p className="sge-loading-text">Carregando catálogo de materiais...</p>}
            {materiaisError && (
              <div className="sge-feedback-banner sge-feedback-banner--error" role="alert">
                <svg className="sge-feedback-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{materiaisError}</span>
              </div>
            )}
            {!materiaisLoading && (!materiaisError || materiaisReais.length > 0) && (
              <UsuarioEstoque
                materiais={materiaisReais}
                pedidos={pedidos}
                user={user}
                onSolicitarMaterial={handleNovoPedidoSubmit}
                onNavigateToPedidos={() => handleNavClick('pedidos')}
                autoFocusBuscaTrigger={autoFocusBuscaTrigger}
              />
            )}
          </PageTabTransition>
        );
    }
  };

  return (
    <div className="usuario-layout">
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar Desktop do Usuário */}
      <aside className={`sidebar ${isSidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <div className="sidebar__logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <span className="sidebar__brand-name">SGE</span>
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
            {navItemsUsuario.map(item => {
              const isActive = activeNav === item.id;
              return (
                <li key={item.id}>
                  <motion.button
                    id={`nav-user-${item.id}`}
                    className={`sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`}
                    onClick={() => handleNavClick(item.id)}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="sidebar__nav-icon">{item.icon}</span>
                    <span className="sidebar__nav-label">{item.label}</span>
                    {item.id === 'pedidos' && pendentesCount > 0 && (
                      <span className="sidebar__badge">{pendentesCount}</span>
                    )}
                    {isActive && (
                      <motion.span
                        layoutId="userSidebarIndicator"
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
          <div className="sidebar__user-avatar">{initial}</div>
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">{user?.identifier || 'Usuário'}</span>
            <span className="sidebar__user-role">Solicitante</span>
          </div>
          {onLogout && (
            <motion.button
              id="sidebar-logout-btn"
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

      <div className="usuario-main">
        <Topbar
          title={TITLES[activeNav] || 'Portal do Usuário'}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          user={user}
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
          items={navItemsUsuario.map(item => ({
            ...item,
            badge: item.id === 'pedidos' ? pendentesCount : 0
          }))}
          activeNav={activeNav}
          onNavClick={handleNavClick}
          layoutId="usuarioMobileActiveTabIndicator"
          ariaLabel="Navegação do Usuário"
        />
      </div>
    </div>
  );
};

export default Usuario;
