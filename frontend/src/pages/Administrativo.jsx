import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar/Sidebar';
import Topbar from '../components/Topbar/Topbar';
import AdminDashboardView from '../components/AdminDashboard/AdminDashboardView';
import EstoqueView from '../components/Estoque/EstoqueView';
import PatrimonioView from '../components/Patrimonio/PatrimonioView';
import AmbientesView from '../components/Ambientes/AmbientesView';
import UsuariosView from '../components/Usuarios/UsuariosView';
import PedidosAdminView from '../components/Pedidos/PedidosAdminView';
import RelatoriosView from '../components/Relatorios/RelatoriosView';
import './Administrativo.css';
import { materialService } from '../services/materiais/materialService';
import { ambienteService } from '../services/ambientes/ambienteService';
import { patrimonioService } from '../services/patrimonios/patrimonioService';
import { pedidoService } from '../services/pedidos/pedidoService';
import { usuarioService } from '../services/usuarios/usuarioService';
import { setorService } from '../services/setores/setorService';
import { movimentacaoService } from '../services/movimentacoes/movimentacaoService';
import { notificacaoService } from '../services/notificacoes/notificacaoService';
import { remessaService } from '../services/remessas/remessaService';
import { baixaPatrimonioService } from '../services/baixaPatrimonio/baixaPatrimonioService';
import { formatarErroApi } from '../services/api/client';
import NovoMaterialModal from '../components/Estoque/NovoMaterialModal';
import NovoUsuarioModal from '../components/Usuarios/NovoUsuarioModal';
import NovoPedidoModal from '../components/Pedidos/NovoPedidoModal';
import AdminPerfil from '../components/AdminPerfil/AdminPerfil';
import { useSectionNavigation, SpeedDialFAB, useAutoRefresh } from '../components/common';

const ADMIN_SECTIONS = ['dashboard', 'consumo', 'patrimonio', 'estoque', 'ambientes', 'usuarios', 'pedidos', 'relatorios', 'perfil'];

const TITLES = {
  dashboard: 'Início',
  consumo: 'Gestão de Consumo & Estoque',
  patrimonio: 'Gestão de Patrimônio & Bens Duráveis',
  estoque: 'Gestão de Consumo & Estoque',
  ambientes: 'Gestão de Ambientes e Patrimônio',
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
  const [pedidosBaixa, setPedidosBaixa] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [materiaisLoading, setMateriaisLoading] = useState(true);
  const [materiaisError, setMateriaisError] = useState(null);
  const [drilldownFiltro, setDrilldownFiltro] = useState(null);
  const [drilldownKey, setDrilldownKey] = useState(0);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosLoading, setUsuariosLoading] = useState(true);
  const [usuariosError, setUsuariosError] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [remessas, setRemessas] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [setores, setSetores] = useState([]);
  const [ambientes, setAmbientes] = useState([]);
  const [ambientesLoading, setAmbientesLoading] = useState(true);
  const [ambientesError, setAmbientesError] = useState(null);
  const [patrimoniosCatalogo, setPatrimoniosCatalogo] = useState([]);
  const [patrimoniosItens, setPatrimoniosItens] = useState([]);
  const [patrimoniosLoading, setPatrimoniosLoading] = useState(true);
  const [patrimoniosError, setPatrimoniosError] = useState(null);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  // Filtro de status pré-aplicado ao abrir o Estoque por atalho (ex: banner de itens esgotados)
  const [estoqueStatusInicial, setEstoqueStatusInicial] = useState('');

  // Modais globais acionados pelo SpeedDialFAB flutuante
  const [isNovoPedidoModalOpen, setIsNovoPedidoModalOpen] = useState(false);
  const [isNovoMaterialModalOpen, setIsNovoMaterialModalOpen] = useState(false);
  const [isNovoUsuarioModalOpen, setIsNovoUsuarioModalOpen] = useState(false);

  const handleDrillDown = useCallback((produtoId, nome) => {
    setDrilldownFiltro({ produtoId, nome });
    setDrilldownKey((k) => k + 1);
    setActiveNav('estoque');
  }, [setActiveNav]);

  useEffect(() => {
    if (activeNav !== 'usuarios') {
      setUsuarioSelecionado(null);
    }
    if (activeNav !== 'estoque' && activeNav !== 'consumo') {
      setEstoqueStatusInicial('');
      setDrilldownFiltro(null);
    }
  }, [activeNav]);

  const carregarPedidos = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setPedidosLoading(true);
      setPedidosError(null);
    }
    try {
      const data = await pedidoService.listar();
      setPedidos(data || []);
      setPedidosError(null);
    } catch (err) {
      if (!silencioso) {
        setPedidos((prev) => (prev.length > 0 ? prev : []));
        setPedidosError(formatarErroApi(err, 'Não foi possível carregar os pedidos.'));
      }
    } finally {
      if (!silencioso) setPedidosLoading(false);
    }
  }, []);

  const carregarBaixas = useCallback(async () => {
    try {
      const data = await baixaPatrimonioService.listar();
      setPedidosBaixa(data || []);
    } catch {
      setPedidosBaixa([]);
    }
  }, []);

  const carregarMateriais = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setMateriaisLoading(true);
      setMateriaisError(null);
    }
    try {
      const data = await materialService.listar();
      setMateriais(data || []);
      setMateriaisError(null);
    } catch (err) {
      if (!silencioso) {
        setMateriais((prev) => (prev.length > 0 ? prev : []));
        setMateriaisError(formatarErroApi(err, 'Não foi possível carregar os materiais do estoque.'));
      }
    } finally {
      if (!silencioso) setMateriaisLoading(false);
    }
  }, []);

  const carregarUsuarios = useCallback(async (silencioso = false) => {
    if (!silencioso) setUsuariosLoading(true);
    try {
      const data = await usuarioService.listar();
      setUsuarios(data || []);
      setUsuariosError(null);
    } catch (err) {
      if (!silencioso) {
        setUsuarios((prev) => (prev.length > 0 ? prev : []));
        setUsuariosError(formatarErroApi(err, 'Não foi possível carregar a lista de usuários.'));
      }
    } finally {
      if (!silencioso) setUsuariosLoading(false);
    }
  }, []);

  const carregarPatrimonios = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setPatrimoniosLoading(true);
      setPatrimoniosError(null);
    }
    try {
      const [cats, itens] = await Promise.all([
        patrimonioService.listarCatalogo().catch(() => []),
        patrimonioService.listarItens().catch(() => [])
      ]);
      setPatrimoniosCatalogo(cats || []);
      setPatrimoniosItens(itens || []);
      setPatrimoniosError(null);
    } catch (err) {
      if (!silencioso) {
        setPatrimoniosError(formatarErroApi(err, 'Não foi possível carregar os patrimônios.'));
      }
    } finally {
      if (!silencioso) setPatrimoniosLoading(false);
    }
  }, []);

  // Carga inicial dos módulos
  useEffect(() => {
    carregarMateriais();
    carregarPedidos();
    carregarBaixas();
    carregarUsuarios();
    carregarPatrimonios();
  }, [carregarMateriais, carregarPedidos, carregarBaixas, carregarUsuarios, carregarPatrimonios]);

  // Revalidação silenciosa ao navegar entre seções (SPA)
  useEffect(() => {
    if (activeNav === 'pedidos') {
      carregarPedidos(true);
      carregarBaixas();
    } else if (activeNav === 'consumo' || activeNav === 'estoque') {
      carregarMateriais(true);
    } else if (activeNav === 'patrimonio') {
      carregarPatrimonios(true);
    } else if (activeNav === 'usuarios') {
      carregarUsuarios(true);
    }
  }, [activeNav, carregarPedidos, carregarBaixas, carregarMateriais, carregarPatrimonios, carregarUsuarios]);

  // Sincronização passiva em segundo plano e ao focar a janela
  useAutoRefresh(() => {
    carregarPedidos(true);
    carregarBaixas();
  }, { intervalMs: 20000, enabled: true });

  useEffect(() => {
    let active = true;
    const carregarNotificacoes = () => notificacaoService.listar()
      .then((data) => {
        if (active) setNotificacoes(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    carregarNotificacoes();
    const intervalo = window.setInterval(carregarNotificacoes, 15000);
    return () => { active = false; window.clearInterval(intervalo); };
  }, []);

  const handleMarcarNotifLida = async (id) => {
    setNotificacoes(prev => prev.map(item => item.id === id ? { ...item, lida: true } : item));
    try {
      await notificacaoService.marcarLida(id);
    } catch {
      // Falha silenciosa
    }
  };

  const handleLimparNotificacoes = async () => {
    setNotificacoes(prev => prev.map(item => ({ ...item, lida: true })));
    try {
      await notificacaoService.marcarTodasLidas(notificacoes.map(item => item.id));
    } catch {
      // Falha silenciosa
    }
  };

  const handleExcluirNotificacao = async (id) => {
    setNotificacoes(prev => prev.filter(item => item.id !== id));
    try {
      await notificacaoService.excluir(id);
    } catch {
      // Falha silenciosa
    }
  };

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
    ambienteService.listar()
      .then((data) => {
        if (active) {
          setAmbientes(data || []);
          setAmbientesError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setAmbientes([]);
          setAmbientesError(formatarErroApi(err, 'Não foi possível carregar os ambientes.'));
        }
      })
      .finally(() => { if (active) setAmbientesLoading(false); });
    return () => { active = false; };
  }, []);


  const handleCriarAmbiente = async (dados) => {
    const criado = await ambienteService.criar(dados);
    const lista = await ambienteService.listar().catch(() => []);
    if (Array.isArray(lista)) setAmbientes(lista);
    return criado;
  };

  const handleCriarModeloPatrimonio = async (dados) => {
    const salvo = dados.id
      ? await patrimonioService.atualizarCatalogo(dados.id, dados)
      : await patrimonioService.criarCatalogo(dados);
    const cats = await patrimonioService.listarCatalogo().catch(() => []);
    if (Array.isArray(cats)) setPatrimoniosCatalogo(cats);
    return salvo;
  };

  const handleSalvarPatrimonioItem = async (dados) => {
    const salvo = dados.id
      ? await patrimonioService.atualizarItem(dados.id, dados)
      : await patrimonioService.criarItem(dados);

    const [cats, itens, listaAmb] = await Promise.all([
      patrimonioService.listarCatalogo().catch(() => []),
      patrimonioService.listarItens().catch(() => []),
      ambienteService.listar().catch(() => [])
    ]);
    if (Array.isArray(cats)) setPatrimoniosCatalogo(cats);
    if (Array.isArray(itens)) setPatrimoniosItens(itens);
    if (Array.isArray(listaAmb)) setAmbientes(listaAmb);
    return salvo;
  };

  const handleTransferirPatrimonioItem = async (id, dados) => {
    await patrimonioService.transferirItem(id, dados);
    const [itens, listaAmb] = await Promise.all([
      patrimonioService.listarItens().catch(() => []),
      ambienteService.listar().catch(() => [])
    ]);
    if (Array.isArray(itens)) setPatrimoniosItens(itens);
    if (Array.isArray(listaAmb)) setAmbientes(listaAmb);
  };

  const handleBaixarPatrimonioItem = async (dadosOuId) => {
    if (typeof dadosOuId === 'object' && dadosOuId !== null) {
      await baixaPatrimonioService.solicitar(dadosOuId);
    } else {
      await patrimonioService.baixarItem(dadosOuId);
    }
    const [itens, listaAmb, baixas] = await Promise.all([
      patrimonioService.listarItens().catch(() => []),
      ambienteService.listar().catch(() => []),
      baixaPatrimonioService.listar().catch(() => [])
    ]);
    if (Array.isArray(itens)) setPatrimoniosItens(itens);
    if (Array.isArray(listaAmb)) setAmbientes(listaAmb);
    if (Array.isArray(baixas)) setPedidosBaixa(baixas);
  };


  // Contadores dinâmicos para a Sidebar e Dashboard
  const counts = useMemo(() => {
    // Para o Administrador, o badge de pedidos reflete estritamente as solicitações de patrimônio pendentes de autorização institucional.
    const pedidosPendentes = pedidos.filter(p =>
      (p.tipoPedido === 'patrimonio' || p.aguardandoAprovacaoAdmin || p.itens?.some(i => i.bemDuravel)) &&
      (p.status || '').toLowerCase() === 'pendente'
    ).length;
    const estoqueCritico = materiais.filter(m => Number(m.quantidade ?? 0) === 0).length;
    const totalUsuarios = usuarios.length;
    return { pedidosPendentes, estoqueCritico, totalUsuarios };
  }, [pedidos, materiais, usuarios]);

  // Autorização de solicitação de patrimônio pelo Administrador.
  // Transiciona de pendente para em_separacao, liberando para a esteira do almoxarifado.
  const handleAutorizarPedidoPatrimonio = async (pedidoId) => {
    try {
      const atualizado = await pedidoService.atualizarStatus(pedidoId, 'em_separacao');
      setPedidos(prev => prev.map(p => (p.id === pedidoId ? (atualizado || { ...p, status: 'Em Separação' }) : p)));
      await carregarPedidos(true);
      return true;
    } catch (error) {
      alert(error?.message || 'Não foi possível autorizar a solicitação de patrimônio.');
      return false;
    }
  };

  // Recusa de solicitação de patrimônio pelo Administrador com registro de justificativa.
  const handleRecusarPedidoPatrimonio = async (pedidoId, motivo) => {
    try {
      const atualizado = await pedidoService.atualizarStatus(pedidoId, 'cancelado', { motivoCancelamento: motivo });
      setPedidos(prev => prev.map(p => (p.id === pedidoId ? (atualizado || { ...p, status: 'Cancelado', motivoCancelamento: motivo }) : p)));
      await carregarPedidos(true);
      return true;
    } catch (error) {
      alert(error?.message || 'Não foi possível recusar a solicitação de patrimônio.');
      return false;
    }
  };

  // Deliberação de pedidos de baixa de patrimônio
  const handleAprovarBaixa = async (id, parecer) => {
    try {
      await baixaPatrimonioService.aprovar(id, parecer);
      const [atualizadas, itens] = await Promise.all([
        baixaPatrimonioService.listar().catch(() => []),
        patrimonioService.listarItens().catch(() => [])
      ]);
      setPedidosBaixa(atualizadas || []);
      if (Array.isArray(itens)) setPatrimoniosItens(itens);
      return true;
    } catch (error) {
      alert(error?.message || 'Não foi possível aprovar a baixa de patrimônio.');
      return false;
    }
  };

  const handleRecusarBaixa = async (id, parecer) => {
    try {
      await baixaPatrimonioService.recusar(id, parecer);
      const [atualizadas, itens] = await Promise.all([
        baixaPatrimonioService.listar().catch(() => []),
        patrimonioService.listarItens().catch(() => [])
      ]);
      setPedidosBaixa(atualizadas || []);
      if (Array.isArray(itens)) setPatrimoniosItens(itens);
      return true;
    } catch (error) {
      alert(error?.message || 'Não foi possível recusar o pedido de baixa.');
      return false;
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

      await Promise.all([
        carregarPedidos(true),
        carregarMateriais(true)
      ]);
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
      await Promise.all([
        carregarMateriais(true),
        movimentacaoService.listar().then(movs => { if (movs) setMovimentacoes(movs); })
      ]);
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
      await carregarMateriais(true);
    } catch (error) {
      alert(error?.message || 'Não foi possível excluir o material.');
    }
  };

  const handleToggleUsuarioStatus = async (usuarioId) => {
    try {
      const atualizado = await usuarioService.alternarStatus(usuarioId);
      setUsuarios(prev => prev.map(u => u.id === usuarioId ? (atualizado || { ...u, ativo: !u.ativo }) : u));
      await carregarUsuarios(true);
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
      await carregarUsuarios(true);
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
      case 'consumo':
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
                key={drilldownKey}
                materiais={materiais.filter((m) => !m?.bemDuravel)}
                movimentacoes={movimentacoes}
                remessas={remessas}
                onSave={handleSaveMaterial}
                onDelete={handleDeleteMaterial}
                initialStatus={estoqueStatusInicial}
                initialProdutoId={drilldownFiltro?.produtoId ?? null}
                initialProdutoNome={drilldownFiltro?.nome ?? ''}
              />
            )}
          </div>
        );
      case 'patrimonio':
        return (
          <div className="dashboard-page-scroll dashboard-page-scroll--patrimonio">
            {patrimoniosLoading && <p>Carregando patrimônios...</p>}
            {patrimoniosError && (
              <div className="sge-feedback-banner sge-feedback-banner--error" role="alert">
                <svg className="sge-feedback-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{patrimoniosError}</span>
              </div>
            )}
            {!patrimoniosLoading && (
              <PatrimonioView
                catalogo={patrimoniosCatalogo}
                itens={patrimoniosItens}
                ambientes={ambientes}
                usuarios={usuarios}
                onCriarModelo={handleCriarModeloPatrimonio}
                onSalvarItem={handleSalvarPatrimonioItem}
                onTransferirItem={handleTransferirPatrimonioItem}
                onBaixarItem={handleBaixarPatrimonioItem}
              />
            )}
          </div>
        );
      case 'ambientes':
        return (
          <div className="dashboard-page-scroll dashboard-page-scroll--ambientes">
            {(ambientesLoading || patrimoniosLoading) && <p>Carregando ambientes e patrimônios...</p>}
            {(ambientesError || patrimoniosError) && (
              <div className="sge-feedback-banner sge-feedback-banner--error" role="alert">
                <svg className="sge-feedback-banner__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{ambientesError || patrimoniosError}</span>
              </div>
            )}
            {!ambientesLoading && !patrimoniosLoading && (
              <AmbientesView
                ambientes={ambientes}
                catalogo={patrimoniosCatalogo}
                itens={patrimoniosItens}
                usuarios={usuarios}
                onCriarAmbiente={handleCriarAmbiente}
                onSalvarItem={handleSalvarPatrimonioItem}
                onTransferirItem={handleTransferirPatrimonioItem}
                onBaixarItem={handleBaixarPatrimonioItem}
              />
            )}
          </div>
        );
      case 'usuarios':
        return (
          <div className="dashboard-page-scroll dashboard-page-scroll--usuarios">
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
                ambientes={ambientes}
                onCriarSetor={handleCriarSetor}
                onSave={handleSaveUsuario}
                onToggleStatus={handleToggleUsuarioStatus}
                onResetPassword={handleResetSenhaUsuario}
                onDelete={handleRemoverUsuario}
                usuarioSelecionado={usuarioSelecionado}
                onTransferirPatrimonio={handleTransferirPatrimonioItem}
              />
            )}
          </div>
        );
      case 'pedidos':
        return (
          <div className="dashboard-page-scroll dashboard-page-scroll--pedidos">
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
              <PedidosAdminView
                pedidos={pedidos}
                pedidosBaixa={pedidosBaixa}
                onAutorizar={handleAutorizarPedidoPatrimonio}
                onRecusar={handleRecusarPedidoPatrimonio}
                onAprovarBaixa={handleAprovarBaixa}
                onRecusarBaixa={handleRecusarBaixa}
                onNovoPedido={handleNovoPedido}
                usuariosDisponiveis={usuarios}
                materiaisDisponiveis={materiais}
                setoresDisponiveis={setores}
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
        return <AdminDashboardView onDrillDown={handleDrillDown} />;
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
          onExcluirNotificacao={handleExcluirNotificacao}
          onNavigateToPedido={(_pedidoId, linkAcao) => {
            if (linkAcao && linkAcao.includes('patrimonio')) {
              setActiveNav('patrimonio');
            } else if (linkAcao && linkAcao.includes('estoque')) {
              setActiveNav('estoque');
            } else {
              setActiveNav('pedidos');
            }
          }}
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
