import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from '../components/Sidebar/Sidebar';
import Topbar from '../components/Topbar/Topbar';
import KpiCards from '../components/KpiCards/KpiCards';
import PedidosTable from '../components/PedidosTable/PedidosTable';
import Relatorios from '../components/Relatorios/Relatorios';
import ConsultaEstoque from '../components/ConsultaEstoque/ConsultaEstoque';
import GerenciarUsuarios from '../components/GerenciarUsuarios/GerenciarUsuarios';
import NovoPedido from '../components/NovoPedido/NovoPedido';
import EstoqueView from '../components/Estoque/EstoqueView';
import UsuariosView from '../components/Usuarios/UsuariosView';
import PedidosView from '../components/Pedidos/PedidosView';
import RelatoriosView from '../components/Relatorios/RelatoriosView';
import './Administrativo.css';
import { materialService } from '../services/materiais/materialService';
import { dashboardService } from '../services/dashboard/dashboardService';
import { pedidoService } from '../services/pedidos/pedidoService';
import { usuarioService } from '../services/usuarios/usuarioService';
import { setorService } from '../services/setores/setorService';
import { movimentacaoService } from '../services/movimentacoes/movimentacaoService';
import { notificacaoService } from '../services/notificacoes/notificacaoService';
import { remessaService } from '../services/remessas/remessaService';
import { formatarErroApi } from '../services/api/client';
import NovoMaterialModal from '../components/Estoque/NovoMaterialModal';
import NovoUsuarioModal from '../components/Usuarios/NovoUsuarioModal';
import NovoPedidoModal from '../components/Pedidos/NovoPedidoModal';
import AdminPerfil from '../components/AdminPerfil/AdminPerfil';
import { useSectionNavigation, SpeedDialFAB } from '../components/common';

const ADMIN_SECTIONS = ['dashboard', 'estoque', 'usuarios', 'pedidos', 'relatorios', 'perfil'];

const TITLES = {
  dashboard: 'Início',
  estoque: 'Gestão de Estoque',
  usuarios: 'Gerenciamento de Usuários',
  pedidos: 'Gestão de Pedidos',
  relatorios: 'Relatórios do Sistema',
  perfil: 'Meu Perfil'
};

const Administrativo = ({ onLogout, user, onUserUpdate }) => {
  const [activeNav, setActiveNav] = useSectionNavigation('admin', ADMIN_SECTIONS, 'dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Estados compartilhados do painel administrativo
  const [pedidos, setPedidos] = useState([]);
  const [pedidosLoading, setPedidosLoading] = useState(true);
  const [pedidosError, setPedidosError] = useState(null);
  const [materiais, setMateriais] = useState([]);
  const [materiaisLoading, setMateriaisLoading] = useState(true);
  const [materiaisError, setMateriaisError] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosLoading, setUsuariosLoading] = useState(true);
  const [usuariosError, setUsuariosError] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [remessas, setRemessas] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [setores, setSetores] = useState([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  // Filtro de status pré-aplicado ao abrir o Estoque por atalho (ex: banner de itens esgotados)
  const [estoqueStatusInicial, setEstoqueStatusInicial] = useState('');

  // Modais globais acionados pelo SpeedDialFAB flutuante
  const [isNovoPedidoModalOpen, setIsNovoPedidoModalOpen] = useState(false);
  const [isNovoMaterialModalOpen, setIsNovoMaterialModalOpen] = useState(false);
  const [isNovoUsuarioModalOpen, setIsNovoUsuarioModalOpen] = useState(false);

  useEffect(() => {
    if (activeNav !== 'usuarios') {
      setUsuarioSelecionado(null);
    }
    if (activeNav !== 'estoque') {
      setEstoqueStatusInicial('');
    }
  }, [activeNav]);

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
    const carregarNotificacoes = () => notificacaoService.listar()
      .then((data) => {
        if (active) setNotificacoes((data || []).map(item => ({ ...item, lida: false, tempo: item.data ? new Date(item.data).toLocaleString('pt-BR') : '' })));
      })
      .catch(() => {});
    carregarNotificacoes();
    const intervalo = window.setInterval(carregarNotificacoes, 15000);
    return () => { active = false; window.clearInterval(intervalo); };
  }, []);

  const handleMarcarNotifLida = (id) => setNotificacoes(prev => prev.map(item => item.id === id ? { ...item, lida: true } : item));
  const handleLimparNotificacoes = () => setNotificacoes(prev => prev.map(item => ({ ...item, lida: true })));

  useEffect(() => {
    let active = true;
    movimentacaoService.listar()
      .then((data) => { if (active) setMovimentacoes(data || []); })
      .catch(() => {});
    remessaService.listar()
      .then((data) => { if (active) setRemessas(data || []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setorService.listar()
      .then((data) => { if (active) setSetores(data || []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handleCriarSetor = async (nomeSetor) => {
    const listaAtualizada = await setorService.criar(nomeSetor);
    if (Array.isArray(listaAtualizada)) {
      setSetores(listaAtualizada);
    }
    return listaAtualizada;
  };

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
          setUsuariosError(formatarErroApi(err, 'Não foi possível carregar a lista de usuários.'));
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

  useEffect(() => {
    let active = true;
    dashboardService.obter()
      .then((data) => {
        if (active) {
          setDashboard(data);
          setDashboardError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setDashboard((prev) => prev);
          setDashboardError(formatarErroApi(err, 'Não foi possível carregar os indicadores do painel.'));
        }
      })
      .finally(() => { if (active) setDashboardLoading(false); });
    return () => { active = false; };
  }, []);

  // Contadores dinâmicos para a Sidebar e Dashboard
  const counts = useMemo(() => {
    const pedidosPendentes = pedidos.filter(p => (p.status || '').toLowerCase() === 'pendente').length;
    const estoqueCritico = materiais.filter(m => Number(m.quantidade ?? 0) === 0).length;
    const totalUsuarios = usuarios.length;
    return { pedidosPendentes, estoqueCritico, totalUsuarios };
  }, [pedidos, materiais, usuarios]);

  // Lista de materiais com estoque totalmente esgotado
  const materiaisZerados = useMemo(() => {
    return materiais.filter(m => Number(m.quantidade ?? 0) === 0);
  }, [materiais]);

  // Atualização de status de pedidos. Repassa a mensagem de retirada, o motivo da recusa e as
  // quantidades da entrega; falhas sobem para a tela de pedidos, que mantém a etapa e avisa.
  const handleUpdatePedidoStatus = async (pedidoId, novoStatus, extras = {}) => {
    const atualizado = await pedidoService.atualizarStatus(pedidoId, novoStatus, extras);
    setPedidos(prev => prev.map(p => (p.id === pedidoId ? (atualizado || { ...p, status: novoStatus, ...extras }) : p)));

    // A entrega dá baixa no estoque: recarrega saldos e histórico.
    if (String(novoStatus).toLowerCase().startsWith('atendido')) {
      const [materiaisAtualizados, movsAtualizadas] = await Promise.all([materialService.listar(), movimentacaoService.listar()]);
      if (materiaisAtualizados) setMateriais(materiaisAtualizados);
      if (movsAtualizadas) setMovimentacoes(movsAtualizadas);
    }
  };

  const handleNovoPedido = async (novoPedido) => {
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

    try {
      const criado = await pedidoService.criar(novoPedido);
      const pedidoFormatado = criado?.id ? {
        ...criado,
        material: criado.material || resumoMaterial,
        materiais: criado.materiais || materiaisFormatados,
        itens: criado.itens || itensRecebidos
      } : criado;
      setPedidos(prev => [pedidoFormatado, ...prev]);
      return true;
    } catch (error) {
      // Não exibe um pedido que não foi gravado.
      alert(error?.message || 'Não foi possível registrar o pedido.');
      return false;
    }
  };

  const handleSaveMaterial = async (material) => {
    try {
      const saved = material.id
        ? await materialService.editar(material.id, material)
        : await materialService.criar(material);
      setMateriais(prev => material.id
        ? prev.map(item => item.id === material.id ? saved : item)
        : [saved, ...prev]);
      const movsAtualizadas = await movimentacaoService.listar();
      if (movsAtualizadas) setMovimentacoes(movsAtualizadas);
    } catch (error) {
      // Aviso pontual: a tela de estoque continua disponível (antes o erro substituía a tela inteira).
      alert(error?.message || 'Não foi possível salvar o material.');
    }
  };

  // "Excluir" retira o material do catálogo; o histórico é preservado.
  const handleDeleteMaterial = async (materialId) => {
    try {
      await materialService.excluir(materialId);
      setMateriais(prev => prev.filter(item => item.id !== materialId));
    } catch (error) {
      alert(error?.message || 'Não foi possível excluir o material.');
    }
  };

  const handleToggleUsuarioStatus = async (usuarioId) => {
    try {
      const atualizado = await usuarioService.alternarStatus(usuarioId);
      setUsuarios(prev => prev.map(u => u.id === usuarioId ? (atualizado || { ...u, ativo: !u.ativo }) : u));
    } catch (error) {
      alert(error?.message || 'Não foi possível alterar o status do usuário.');
    }
  };

  const handleSaveUsuario = async (usuario) => {
    try {
      const existe = usuarios.some(item => item.id === usuario.id);
      const salvo = existe
        ? await usuarioService.editar(usuario)
        : await usuarioService.criar(usuario);
      setUsuarios(prev => existe
        ? prev.map(item => item.id === salvo.id ? salvo : item)
        : [salvo, ...prev]);
      setUsuariosError(null);
      return true;
    } catch (error) {
      // Não exibe um usuário que não foi gravado (ex.: CPF inválido ou já cadastrado).
      alert(error?.message || 'Não foi possível salvar o usuário.');
      return false;
    }
  };

  const handleResetSenhaUsuario = async (usuarioId) => {
    const atualizado = await usuarioService.resetarSenha(usuarioId);
    setUsuarios(prev => prev.map(u => u.id === usuarioId ? (atualizado || u) : u));
    return atualizado;
  };

  // "Excluir" desativa a conta, preservando o histórico.
  const handleRemoverUsuario = async (usuarioId) => {
    try {
      const removido = await usuarioService.remover(usuarioId);
      setUsuarios(prev => prev.map(u => u.id === usuarioId ? (removido || { ...u, ativo: false }) : u));
    } catch (error) {
      alert(error?.message || 'Não foi possível excluir o usuário.');
    }
  };

  const renderContent = () => {
    switch (activeNav) {
      case 'estoque':
        return (
          <div className="dashboard-page-scroll">
            {materiaisLoading && <p>Carregando materiais...</p>}
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
              <EstoqueView
                materiais={materiais}
                movimentacoes={movimentacoes}
                remessas={remessas}
                onSave={handleSaveMaterial}
                onDelete={handleDeleteMaterial}
                initialStatus={estoqueStatusInicial}
              />
            )}
          </div>
        );
      case 'usuarios':
        return (
          <div className="dashboard-page-scroll">
            {usuariosLoading && <p>Carregando usuários...</p>}
            {usuariosError && (
              <div className="sge-feedback-banner sge-feedback-banner--error" role="alert">
                <svg className="sge-feedback-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{usuariosError}</span>
              </div>
            )}
            {!usuariosLoading && (!usuariosError || usuarios.length > 0) && (
              <UsuariosView
                usuarios={usuarios}
                setores={setores}
                onCriarSetor={handleCriarSetor}
                onSave={handleSaveUsuario}
                onToggleStatus={handleToggleUsuarioStatus}
                onResetPassword={handleResetSenhaUsuario}
                onDelete={handleRemoverUsuario}
                usuarioSelecionado={usuarioSelecionado}
              />
            )}
          </div>
        );
      case 'pedidos':
        return (
          <div className="dashboard-page-scroll">
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
                onUpdateStatus={handleUpdatePedidoStatus}
                usuariosDisponiveis={usuarios}
                materiaisDisponiveis={materiais}
                setoresDisponiveis={setores}
                userRole="admin"
              />
            )}
          </div>
        );
      case 'relatorios':
        return (
          <div className="dashboard-page-scroll">
            <RelatoriosView
              dadosEstoque={materiais}
              dadosPedidos={pedidos}
              dadosUsuarios={usuarios}
              dadosMovimentacoes={movimentacoes}
              dadosRemessasExternas={remessas}
            />
          </div>
        );
      case 'perfil':
        return (
          <div className="dashboard-page-scroll">
            <AdminPerfil user={user} onLogout={onLogout} onNavigate={setActiveNav} onUserUpdate={onUserUpdate} />
          </div>
        );
      case 'dashboard':
      default:
        return (
          <div className="dashboard-body">
            {/* Esquerda / Centro */}
            <div className="dashboard-content">
              {/* Banner de Alerta de Estoque Crítico (quando há itens zerados) */}
              {materiaisZerados.length > 0 && (
                <div className="alerta-estoque-critico">
                  <div className="alerta-estoque-critico__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <div className="alerta-estoque-critico__content">
                    <strong>Atenção: {materiaisZerados.length} materiais com estoque esgotado!</strong>
                    <p>
                      Os itens {materiaisZerados.slice(0, 2).map(m => `"${m.nome}"`).join(', ')}
                      {materiaisZerados.length > 2 ? ` e mais ${materiaisZerados.length - 2} itens` : ''} precisam de reposição emergencial.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="alerta-estoque-critico__btn"
                    onClick={() => {
                      setEstoqueStatusInicial('critico');
                      setActiveNav('estoque');
                    }}
                  >
                    Ver no Estoque &rarr;
                  </button>
                </div>
              )}

              {dashboardError && (
                <div className="sge-feedback-banner sge-feedback-banner--error" role="alert">
                  <svg className="sge-feedback-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{dashboardError}</span>
                </div>
              )}
              <section className="dashboard-section">
                <KpiCards
                  data={{
                    usuarios: dashboardLoading ? '...' : dashboard?.totalUsuarios,
                    pedidosPendentes: dashboardLoading ? '...' : dashboard?.pedidosPendentes
                  }}
                  onNavigate={setActiveNav}
                />
              </section>

              <section className="dashboard-section">
                <PedidosTable
                  pedidos={pedidos}
                  onVerTodos={() => setActiveNav('pedidos')}
                />
              </section>

              <section className="dashboard-section">
                <Relatorios onVisualizar={() => setActiveNav('relatorios')} />
              </section>
            </div>

            {/* Painel Lateral Direito */}
            <aside className="dashboard-panel">
              <ConsultaEstoque
                itens={materiais.map((material) => ({
                  id: material.id,
                  nome: material.nome,
                  qtd: material.quantidade,
                  status: material.quantidade === 0 ? 'critico' : material.quantidade <= material.estoqueMinimo ? 'baixo' : 'ok'
                }))}
                onNavigate={setActiveNav}
              />
              <GerenciarUsuarios
                usuarios={usuarios}
                onNavigate={setActiveNav}
                onSelectUsuario={(usuario) => {
                  setUsuarioSelecionado({ ...usuario });
                  setActiveNav('usuarios');
                }}
              />
              <NovoPedido materiais={materiais.filter((m) => !m?.bemDuravel)} onSubmit={handleNovoPedido} />
            </aside>
          </div>
        );
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar
        activeItem={activeNav}
        onNavigate={setActiveNav}
        onLogout={onLogout}
        user={user}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        counts={counts}
      />

      <div className="dashboard-main">
        <Topbar
          title={TITLES[activeNav] || 'Início'}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          notificacoes={notificacoes}
          onMarcarLida={handleMarcarNotifLida}
          onLimparNotificacoes={handleLimparNotificacoes}
        />
        {renderContent()}
      </div>

      {/* Botão Fixo de Ações Rápidas no canto inferior direito (Oculto no Perfil) */}
      {activeNav !== 'perfil' && (
        <SpeedDialFAB
          actions={[
            {
              id: 'novo-pedido',
              label: 'Novo Pedido',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              ),
              onClick: () => setIsNovoPedidoModalOpen(true),
              variant: 'accent'
            },
            {
              id: 'novo-relatorio',
              label: 'Novo Relatório',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              ),
              onClick: () => setActiveNav('relatorios'),
              variant: 'secondary'
            },
            {
              id: 'novo-usuario',
              label: 'Novo Usuário',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              ),
              onClick: () => setIsNovoUsuarioModalOpen(true),
              variant: 'secondary'
            },
            {
              id: 'novo-material',
              label: 'Novo Material',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <line x1="12" y1="12" x2="12" y2="22" />
                  <line x1="12" y1="7" x2="12" y2="13" />
                  <line x1="9" y1="10" x2="15" y2="10" />
                </svg>
              ),
              onClick: () => setIsNovoMaterialModalOpen(true),
              variant: 'secondary'
            }
          ]}
          ariaLabel="Menu de criação rápida"
        />
      )}

      {/* Modais Globais disparados pelo SpeedDialFAB */}
      <NovoPedidoModal
        isOpen={isNovoPedidoModalOpen}
        onClose={() => setIsNovoPedidoModalOpen(false)}
        onSave={async (dados) => {
          const ok = await handleNovoPedido(dados);
          if (ok) setIsNovoPedidoModalOpen(false);
        }}
        materiaisDisponiveis={materiais}
        usuariosDisponiveis={usuarios}
        userRole="admin"
      />
      <NovoMaterialModal
        isOpen={isNovoMaterialModalOpen}
        onClose={() => setIsNovoMaterialModalOpen(false)}
        onSave={(material) => {
          handleSaveMaterial(material);
          setIsNovoMaterialModalOpen(false);
        }}
      />
      <NovoUsuarioModal
        isOpen={isNovoUsuarioModalOpen}
        onClose={() => setIsNovoUsuarioModalOpen(false)}
        onSave={handleSaveUsuario}
        setores={setores}
        onCriarSetor={handleCriarSetor}
      />
    </div>
  );
};

export default Administrativo;
