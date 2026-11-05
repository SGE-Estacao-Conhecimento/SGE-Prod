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
import { DEMO_MATERIAIS, DEMO_PEDIDOS, DEMO_USUARIOS, DEMO_MOVIMENTACOES } from '../data/demoData';
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

const _MOCK_ADMIN_PEDIDOS = [
  {
    id: 102,
    usuario: 'Carlos Silva',
    setor: 'Educação Infantil',
    data: '27/09/2026',
    material: 'Álcool em Gel 70% (Frasco 500ml)',
    quantidade: 3,
    materiais: [
      { materialNome: 'Álcool em Gel 70% (Frasco 500ml)', quantidade: 3, unidade: 'Frasco' }
    ],
    justificativa: 'Urgência sanitária para as salas e refeitório',
    prioridade: 'Urgente',
    urgente: true,
    status: 'Pendente'
  },
  {
    id: 101,
    usuario: 'Mariana Costa',
    setor: 'Ensino Fundamental',
    data: '26/09/2026',
    material: 'Papel Sulfite A4 (Resma 500 folhas)',
    quantidade: 2,
    materiais: [
      { materialNome: 'Papel Sulfite A4 (Resma 500 folhas)', quantidade: 2, unidade: 'Resma' }
    ],
    justificativa: 'Impressão das atividades pedagógicas do 3º bimestre',
    prioridade: 'Normal',
    urgente: false,
    status: 'Pendente'
  },
  {
    id: 100,
    usuario: 'Roberto Souza',
    setor: 'Coordenação',
    data: '25/09/2026',
    material: 'Caneta Esferográfica Azul',
    quantidade: 10,
    materiais: [
      { materialNome: 'Caneta Esferográfica Azul', quantidade: 10, unidade: 'UN' }
    ],
    justificativa: 'Reposição da coordenação pedagógica',
    prioridade: 'Normal',
    urgente: false,
    status: 'Pendente'
  },
  {
    id: 98,
    usuario: 'Juliana Dias',
    setor: 'Educação Infantil',
    data: '24/09/2026',
    material: 'Marcador para Quadro Branco',
    quantidade: 4,
    materiais: [
      { materialNome: 'Marcador para Quadro Branco', quantidade: 4, unidade: 'UN' }
    ],
    justificativa: 'Uso diário em sala de aula',
    prioridade: 'Normal',
    urgente: false,
    status: 'Atendido'
  },
  {
    id: 95,
    usuario: 'Marcos Andrade',
    setor: 'Apoio / Limpeza',
    data: '22/09/2026',
    material: 'Sabonete Líquido Neutro (5L)',
    quantidade: 1,
    materiais: [
      { materialNome: 'Sabonete Líquido Neutro (5L)', quantidade: 1, unidade: 'Galão' }
    ],
    justificativa: 'Limpeza dos blocos pedagógicos',
    prioridade: 'Normal',
    urgente: false,
    status: 'Atendido'
  },
  {
    id: 94,
    usuario: 'Carlos Silva',
    setor: 'Educação Infantil',
    data: '15/09/2026',
    material: 'Giz Escolar Colorido (Caixa c/ 64)',
    quantidade: 2,
    materiais: [
      { materialNome: 'Giz Escolar Colorido (Caixa c/ 64)', quantidade: 2, unidade: 'Caixa' }
    ],
    justificativa: 'Atividades recreativas e de pintura',
    prioridade: 'Normal',
    urgente: false,
    status: 'Atendido'
  },
  {
    id: 91,
    usuario: 'Mariana Costa',
    setor: 'Ensino Fundamental',
    data: '10/09/2026',
    material: 'Fita Adesiva Transparente',
    quantidade: 4,
    materiais: [
      { materialNome: 'Fita Adesiva Transparente', quantidade: 4, unidade: 'Rolo' }
    ],
    justificativa: 'Organização de murais e cartazes do 3º ano',
    prioridade: 'Normal',
    urgente: false,
    status: 'Atendido'
  },
  {
    id: 88,
    usuario: 'Juliana Dias',
    setor: 'Educação Infantil',
    data: '02/09/2026',
    material: 'Papel Sulfite A4 (Resma 500 folhas)',
    quantidade: 3,
    materiais: [
      { materialNome: 'Papel Sulfite A4 (Resma 500 folhas)', quantidade: 3, unidade: 'Resma' }
    ],
    justificativa: 'Avaliações do maternal e artes plásticas',
    prioridade: 'Urgente',
    urgente: true,
    status: 'Atendido'
  },
  {
    id: 84,
    usuario: 'Roberto Souza',
    setor: 'Coordenação',
    data: '28/08/2026',
    material: 'Grampeador de Mesa',
    quantidade: 1,
    materiais: [
      { materialNome: 'Grampeador de Mesa', quantidade: 1, unidade: 'UN' }
    ],
    justificativa: 'Substituição de equipamento avariado na coordenação',
    prioridade: 'Normal',
    urgente: false,
    status: 'Atendido'
  },
  {
    id: 80,
    usuario: 'Fernanda Lima',
    setor: 'Ensino Fundamental',
    data: '20/08/2026',
    material: 'Caneta Esferográfica Azul',
    quantidade: 15,
    materiais: [
      { materialNome: 'Caneta Esferográfica Azul', quantidade: 15, unidade: 'UN' }
    ],
    justificativa: 'Material para os professores do 4º e 5º ano',
    prioridade: 'Normal',
    urgente: false,
    status: 'Atendido'
  }
];

const _MOCK_ADMIN_MATERIAIS = [
  { id: 1, codigo: 'MAT-001', nome: 'Papel Sulfite A4', categoria: 'Escritório', unidade: 'Resma', quantidade: 48, estoqueMinimo: 10, localizacao: 'Armário A' },
  { id: 2, codigo: 'MAT-002', nome: 'Caneta Esferográfica', categoria: 'Escritório', unidade: 'UN', quantidade: 120, estoqueMinimo: 30, localizacao: 'Gaveteiro 1' },
  { id: 3, codigo: 'MAT-003', nome: 'Marcador para Quadro Branco', categoria: 'Material Didático', unidade: 'UN', quantidade: 18, estoqueMinimo: 15, localizacao: 'Armário Didático B' },
  { id: 4, codigo: 'MAT-004', nome: 'Álcool em Gel 70%', categoria: 'Limpeza e Higiene', unidade: 'Frasco', quantidade: 35, estoqueMinimo: 8, localizacao: 'Almoxarifado Central' },
  { id: 5, codigo: 'MAT-005', nome: 'Grampeador de Mesa', categoria: 'Escritório', unidade: 'UN', quantidade: 4, estoqueMinimo: 5, localizacao: 'Prateleira 3' },
  { id: 6, codigo: 'MAT-006', nome: 'Fita Adesiva Transparente', categoria: 'Escritório', unidade: 'Rolo', quantidade: 0, estoqueMinimo: 10, localizacao: 'Caixa de Fitas' },
  { id: 7, codigo: 'MAT-007', nome: 'Cabo HDMI 2.0', categoria: 'Informática / TI', unidade: 'UN', quantidade: 8, estoqueMinimo: 3, localizacao: 'Armário TI' },
  { id: 8, codigo: 'MAT-008', nome: 'Apagador para Quadro Branco', categoria: 'Material Didático', unidade: 'UN', quantidade: 0, estoqueMinimo: 6, localizacao: 'Armário Didático B' },
  { id: 9, codigo: 'MAT-015', nome: 'Pilhas Alcalinas AAA (Palito)', categoria: 'Informática / TI', unidade: 'Cartela', quantidade: 0, estoqueMinimo: 8, localizacao: 'Armário TI' }
];

const _MOCK_ADMIN_USUARIOS = [
  { id: 1, nome: 'Carlos Silva', email: 'carlos.silva@estacao.org.br', perfil: 'Usuário', setor: 'Educação Infantil', ativo: true, inicial: 'C', dataCadastro: '10/02/2026', ramal: '104' },
  { id: 2, nome: 'Mariana Costa', email: 'mariana.costa@estacao.org.br', perfil: 'Usuário', setor: 'Ensino Fundamental', ativo: true, inicial: 'M', dataCadastro: '12/02/2026', ramal: '108' },
  { id: 3, nome: 'Roberto Souza', email: 'roberto.souza@estacao.org.br', perfil: 'Usuário', setor: 'Coordenação', ativo: true, inicial: 'R', dataCadastro: '05/01/2026', ramal: '101' },
  { id: 4, nome: 'Juliana Dias', email: 'juliana.dias@estacao.org.br', perfil: 'Usuário', setor: 'Educação Infantil', ativo: true, inicial: 'J', dataCadastro: '18/02/2026', ramal: '105' },
  { id: 5, nome: 'Marcos Andrade', email: 'marcos.andrade@estacao.org.br', perfil: 'Usuário', setor: 'Apoio / Limpeza', ativo: true, inicial: 'M', dataCadastro: '20/01/2026', ramal: '112' },
  { id: 6, nome: 'Ana Beatriz', email: 'ana.beatriz@estacao.org.br', perfil: 'Almoxarifado', setor: 'Almoxarifado Central', ativo: true, inicial: 'A', dataCadastro: '02/01/2026', ramal: '100' },
  { id: 7, nome: 'Arthur Vequi', email: 'arthur.vequi@estacao.org.br', perfil: 'Administrativo', setor: 'Diretoria / TI', ativo: true, inicial: 'A', dataCadastro: '01/01/2026', ramal: '102' },
  { id: 8, nome: 'Fernanda Lima', email: 'fernanda.lima@estacao.org.br', perfil: 'Usuário', setor: 'Ensino Fundamental', ativo: true, inicial: 'F', dataCadastro: '15/03/2026', ramal: '109' }
];

const Administrativo = ({ onLogout, user }) => {
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
      .then((data) => { if (active) setMateriais(data || []); })
      .catch(() => {
        if (active) {
          setMateriais(DEMO_MATERIAIS);
          setMateriaisError(null);
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
      .catch(() => { if (active) setNotificacoes([]); });
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
      .catch(() => {
        if (active) setMovimentacoes(DEMO_MOVIMENTACOES);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setorService.listar()
      .then((data) => { if (active) setSetores(data || []); })
      .catch(() => { if (active) setSetores([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    usuarioService.listar()
      .then((data) => { if (active) setUsuarios(data || []); })
      .catch(() => {
        if (active) {
          setUsuarios(DEMO_USUARIOS);
          setUsuariosError(null);
        }
      })
      .finally(() => { if (active) setUsuariosLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    pedidoService.listar()
      .then((data) => { if (active) setPedidos(data || []); })
      .catch(() => {
        if (active) {
          setPedidos(DEMO_PEDIDOS);
          setPedidosError(null);
        }
      })
      .finally(() => { if (active) setPedidosLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    dashboardService.obter()
      .then((data) => { if (active) setDashboard(data); })
      .catch(() => {
        if (active) {
          setDashboard({
            totalProdutos: DEMO_MATERIAIS.length,
            produtosEstoqueBaixo: DEMO_MATERIAIS.filter(m => m.quantidade <= m.estoqueMinimo).length,
            pedidosPendentes: DEMO_PEDIDOS.filter(p => p.status === 'Pendente').length,
            totalUsuarios: DEMO_USUARIOS.length
          });
          setDashboardError(null);
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

  // Atualização de status de pedidos em tempo real
  const handleUpdatePedidoStatus = async (pedidoId, novoStatus) => {
    try {
      const atualizado = await pedidoService.atualizarStatus(pedidoId, novoStatus);
      setPedidos(prev => prev.map(p => (p.id === pedidoId ? (atualizado || { ...p, status: novoStatus }) : p)));
    } catch {
      setPedidos(prev => prev.map(p => (p.id === pedidoId ? { ...p, status: novoStatus } : p)));
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
    } catch {
      const localId = Math.max(0, ...pedidos.map(p => Number(p.id) || 0)) + 1;
      const pedidoFormatado = {
        id: localId,
        usuario: novoPedido.usuario || user?.nome || 'Administrador',
        setor: novoPedido.setor || 'Administrativo',
        data: new Date().toLocaleDateString('pt-BR'),
        material: resumoMaterial,
        quantidade: itensRecebidos.reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0),
        materiais: materiaisFormatados,
        itens: itensRecebidos,
        prioridade: novoPedido.urgente || novoPedido.prioridade === 'Urgente' ? 'Urgente' : 'Normal',
        urgente: Boolean(novoPedido.urgente || novoPedido.prioridade === 'Urgente'),
        status: 'Pendente',
        justificativa: novoPedido.justificativa
      };
      setPedidos(prev => [pedidoFormatado, ...prev]);
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
    } catch (error) {
      setMateriaisError(error.message);
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    try {
      await materialService.excluir(materialId);
      setMateriais(prev => prev.filter(item => item.id !== materialId));
    } catch (error) {
      setMateriaisError(error.message);
    }
  };

  const handleToggleUsuarioStatus = async (usuarioId) => {
    try {
      await usuarioService.alternarStatus(usuarioId);
      setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, ativo: !u.ativo } : u));
    } catch {
      setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, ativo: !u.ativo } : u));
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
    } catch {
      const existe = usuarios.some(item => item.id === usuario.id);
      const usuarioLocal = {
        ...usuario,
        id: usuario.id ?? Math.max(0, ...usuarios.map(item => Number(item.id) || 0)) + 1,
        inicial: (usuario.nome || 'U').trim().charAt(0).toUpperCase(),
        dataCadastro: usuario.dataCadastro || new Date().toLocaleDateString('pt-BR')
      };
      setUsuarios(prev => existe
        ? prev.map(item => item.id === usuarioLocal.id ? usuarioLocal : item)
        : [usuarioLocal, ...prev]);
      setUsuariosError(null);
    }
  };

  const handleRemoverUsuario = async (usuarioId) => {
    try {
      await usuarioService.remover(usuarioId);
      setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, ativo: false } : u));
    } catch {
      setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, ativo: false } : u));
    }
  };

  const renderContent = () => {
    switch (activeNav) {
      case 'estoque':
        return (
          <div className="dashboard-page-scroll">
            {materiaisLoading && <p>Carregando materiais...</p>}
            {materiaisError && <p role="alert">{materiaisError}</p>}
            {!materiaisLoading && !materiaisError && (
              <EstoqueView
                materiais={materiais}
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
            {usuariosError && <p role="alert">{usuariosError}</p>}
            {!usuariosLoading && !usuariosError && (
              <UsuariosView
                usuarios={usuarios}
                setores={setores}
                onSave={handleSaveUsuario}
                onToggleStatus={handleToggleUsuarioStatus}
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
            {pedidosError && <p role="alert">{pedidosError}</p>}
            {!pedidosLoading && !pedidosError && (
              <PedidosView
                pedidos={pedidos}
                onUpdateStatus={handleUpdatePedidoStatus}
                usuariosDisponiveis={usuarios}
                materiaisDisponiveis={materiais}
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
            />
          </div>
        );
      case 'perfil':
        return (
          <div className="dashboard-page-scroll">
            <AdminPerfil user={user} onLogout={onLogout} onNavigate={setActiveNav} />
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

              {dashboardError && <p role="alert">{dashboardError}</p>}
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
              <NovoPedido materiais={materiais} onSubmit={handleNovoPedido} />
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
        onSave={(dados) => {
          handleNovoPedido(dados);
          setIsNovoPedidoModalOpen(false);
        }}
        materiaisDisponiveis={materiais}
        usuariosDisponiveis={usuarios}
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
        onSave={(usuario) => {
          handleSaveUsuario(usuario);
          setIsNovoUsuarioModalOpen(false);
        }}
        setores={setores}
      />
    </div>
  );
};

export default Administrativo;
