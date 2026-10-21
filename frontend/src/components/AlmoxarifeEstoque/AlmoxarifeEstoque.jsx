import React, { useState, useMemo, useEffect } from 'react';
import {
  SearchFilterBar,
  FilterDrawer,
  FilterGroup,
  FilterChip,
  SortLoopButton,
  BottomSheetModal,
  QuantityStepper,
  SegmentedTabs,
  SpeedDialFAB
} from '../common';
import RecebimentoLoteModal from './RecebimentoLoteModal/RecebimentoLoteModal';
import './AlmoxarifeEstoque.css';

// Lista de complexos disponíveis para endereçamento físico (A Geral do SGE)
export const LISTA_COMPLEXOS = [
  'Almoxarifado Central',
  'Complexo Administrativo',
  'Complexo Educacional',
  'Galpão de Manutenção',
  'Depósito de Limpeza',
  'Espaço Esportivo / Ginásio',
  'Outro Complexo'
];

// Lista de unidades de medida padronizadas para estoque (A Geral do SGE)
export const LISTA_UNIDADES = [
  'UN',
  'CX',
  'Pacote',
  'Resma',
  'Frasco',
  'Galão',
  'Fardo',
  'Rolo',
  'Par',
  'Outro'
];

/**
 * Identifica se a unidade representa um item individual/único (sem embalagem com múltiplos itens)
 */
export const isUnidadeIndividual = (unidade) => {
  if (!unidade) return true;
  const normal = String(unidade).trim().toUpperCase();
  return (
    normal === 'UN' ||
    normal === 'UNIDADE' ||
    normal === 'PAR' ||
    normal === 'PEÇA' ||
    normal === 'PECA' ||
    normal === 'ITEM'
  );
};

/**
 * Identifica se uma unidade representa embalagem do tipo Caixa (CX)
 */
export const isUnidadeCaixa = (unidade) => {
  if (!unidade) return false;
  const normal = String(unidade).trim().toUpperCase();
  return normal === 'CX' || normal === 'CAIXA' || normal.startsWith('CX') || normal.startsWith('CAIXA');
};

/**
 * Normaliza um material garantindo os campos estruturados de complexo, localização física e itens por caixa
 */
export const normalizarMaterial = (item) => {
  if (!item) return item;
  let qtdPorCaixa = item.qtdPorCaixa;
  if (!qtdPorCaixa && item.descricao) {
    const match = item.descricao.match(/Caixa (?:com|c\/)\s*([\d.]+)\s*unidades?/i);
    if (match) {
      qtdPorCaixa = parseInt(match[1].replace('.', ''), 10);
    }
  }

  if (item.complexo) {
    return { ...item, qtdPorCaixa };
  }
  if (item.localizacao && item.localizacao.includes('•')) {
    const [comp, ...resto] = item.localizacao.split('•');
    return {
      ...item,
      qtdPorCaixa,
      complexo: comp.trim() || 'Almoxarifado Central',
      localizacao: resto.join('•').trim()
    };
  }
  return {
    ...item,
    qtdPorCaixa,
    complexo: 'Almoxarifado Central',
    localizacao: item.localizacao || ''
  };
};

// Dados demonstrativos com especificações detalhadas de almoxarifado
const _MOCK_MATERIAIS_ALMOXARIFE = [
  {
    id: 1,
    codigo: 'MAT-001',
    nome: 'Papel Sulfite A4 75g',
    categoria: 'Escritório',
    unidade: 'Resma',
    quantidade: 48,
    estoqueMinimo: 15,
    descricao: 'Branco • Resma c/ 500 folhas • Gramatura 75g/m²',
    complexo: 'Almoxarifado Central',
    localizacao: 'Prat. 02'
  },
  {
    id: 2,
    codigo: 'MAT-002',
    nome: 'Caneta Esferográfica Azul',
    categoria: 'Escritório',
    unidade: 'CX',
    quantidade: 12,
    estoqueMinimo: 20,
    descricao: 'Ponta Média 1.0mm • Caixa com 50 unidades',
    complexo: 'Almoxarifado Central',
    localizacao: 'Corredor 1 • Gaveteiro A-03'
  },
  {
    id: 3,
    codigo: 'MAT-003',
    nome: 'Marcador para Quadro Branco',
    categoria: 'Material Didático',
    unidade: 'UN',
    quantidade: 8,
    estoqueMinimo: 15,
    descricao: 'Azul e Preto • Ponta Redonda Recarregável',
    complexo: 'Complexo Educacional',
    localizacao: 'Armário Didático B • Prat. 01'
  },
  {
    id: 4,
    codigo: 'MAT-004',
    nome: 'Álcool em Gel 70% 500ml',
    categoria: 'Limpeza e Higiene',
    unidade: 'Frasco',
    quantidade: 22,
    estoqueMinimo: 10,
    descricao: 'Higienização das mãos • Bico dosador pump',
    complexo: 'Depósito de Limpeza',
    localizacao: 'Prateleira C'
  },
  {
    id: 5,
    codigo: 'MAT-005',
    nome: 'Grampeador Metálico de Mesa',
    categoria: 'Escritório',
    unidade: 'UN',
    quantidade: 4,
    estoqueMinimo: 6,
    descricao: 'Estrutura metálica • Compatível com grampos 26/6',
    complexo: 'Almoxarifado Central',
    localizacao: 'Armário A • Gaveta 04'
  },
  {
    id: 6,
    codigo: 'MAT-006',
    nome: 'Fita Adesiva Transparente Larga',
    categoria: 'Escritório',
    unidade: 'Rolo',
    quantidade: 0,
    estoqueMinimo: 12,
    descricao: '45mm x 50 metros • Embalagem e reforço',
    complexo: 'Almoxarifado Central',
    localizacao: 'Corredor 2 • Caixa Fitas'
  },
  {
    id: 7,
    codigo: 'MAT-007',
    nome: 'Cabo HDMI 2.0 Blindado 2m',
    categoria: 'Informática / TI',
    unidade: 'UN',
    quantidade: 5,
    estoqueMinimo: 4,
    descricao: 'Alta velocidade 4K Ultra HD • Pontas banhadas a ouro',
    complexo: 'Complexo Administrativo',
    localizacao: 'Bancada TI • Gaveteiro 02'
  },
  {
    id: 8,
    codigo: 'MAT-008',
    nome: 'Apagador para Quadro Branco',
    categoria: 'Material Didático',
    unidade: 'UN',
    quantidade: 0,
    estoqueMinimo: 8,
    descricao: 'Base magnética e feltro de alta densidade',
    complexo: 'Complexo Educacional',
    localizacao: 'Armário Didático B • Prat. 02'
  },
  {
    id: 9,
    codigo: 'MAT-009',
    nome: 'Grampos 26/6 Galvanizados',
    categoria: 'Escritório',
    unidade: 'CX',
    quantidade: 16,
    estoqueMinimo: 12,
    descricao: 'Caixa com 5.000 unidades • Tratamento antiferrugem',
    complexo: 'Almoxarifado Central',
    localizacao: 'Armário A • Gaveta 04'
  },
  {
    id: 10,
    codigo: 'MAT-010',
    nome: 'Detergente Neutro Concentrado 5L',
    categoria: 'Limpeza e Higiene',
    unidade: 'Galão',
    quantidade: 3,
    estoqueMinimo: 4,
    descricao: 'Biodegradável • Uso institucional',
    complexo: 'Depósito de Limpeza',
    localizacao: 'Piso Pallet 01'
  }
];

// Configuração dos 3 modos de ordenação operacional em loop
const OPCOES_ORDENACAO_ALMOXARIFE = [
  { id: 'menor_estoque', label: 'Menor estoque' },
  { id: 'maior_estoque', label: 'Maior estoque' },
  { id: 'nome_az', label: 'Nome A-Z' }
];

// Cálculo padronizado do status de reposição do material
export const calcularStatusReposicao = (quantidade, estoqueMinimo) => {
  if (quantidade === 0) {
    return {
      chave: 'sem_estoque',
      label: 'Sem Estoque',
      classe: 'status-critico',
      cor: '#DC2626',
      bg: '#FEF2F2',
      pontoCor: '#EF4444'
    };
  }
  if (quantidade <= estoqueMinimo) {
    return {
      chave: 'estoque_baixo',
      label: 'Estoque Baixo',
      classe: 'status-baixo',
      cor: '#D97706',
      bg: '#FFFBEB',
      pontoCor: '#F59E0B'
    };
  }
  if (quantidade <= Math.ceil(estoqueMinimo * 1.5)) {
    return {
      chave: 'atencao',
      label: 'Atenção',
      classe: 'status-atencao',
      cor: '#CA8A04',
      bg: '#FEFCE8',
      pontoCor: '#EAB308'
    };
  }
  return {
    chave: 'regular',
    label: 'Regular',
    classe: 'status-regular',
    cor: '#059669',
    bg: '#ECFDF5',
    pontoCor: '#10B981'
  };
};

// Histórico inicial demonstrativo para rastreabilidade de materiais
const _MOCK_HISTORICOS_INICIAIS = {
  1: [
    { id: 'h1-1', tipo: 'entrada', qtd: 20, data: 'Hoje, 09:30', responsavel: 'Almoxarife', motivo: 'Recebimento NF 1045 - Kalunga' },
    { id: 'h1-2', tipo: 'saida', qtd: 4, data: 'Ontem, 16:15', responsavel: 'Prof. Carlos', motivo: 'Atendimento do Pedido #101' },
    { id: 'h1-3', tipo: 'ajuste', qtd: 32, data: '22/09/2026', responsavel: 'Almoxarife', motivo: 'Balanço mensal de inventário físico' }
  ],
  2: [
    { id: 'h2-1', tipo: 'saida', qtd: 2, data: 'Hoje, 08:20', responsavel: 'Coordenação', motivo: 'Consumo interno salas de aula' },
    { id: 'h2-2', tipo: 'entrada', qtd: 10, data: '25/09/2026', responsavel: 'Almoxarife', motivo: 'Reposição quinzenal de estoque' }
  ],
  3: [
    { id: 'h3-1', tipo: 'saida', qtd: 4, data: 'Ontem, 11:00', responsavel: 'Monitoria', motivo: 'Distribuição para salas do Bloco B' }
  ],
  4: [
    { id: 'h4-1', tipo: 'entrada', qtd: 15, data: '26/09/2026', responsavel: 'Almoxarife', motivo: 'Compra emergencial de álcool em gel' }
  ]
};

const AlmoxarifeEstoque = ({
  materiais: materiaisProp,
  remessasExternas = [],
  onCriarRemessa,
  historicoMovimentacoes = {},
  onAtualizarMaterial,
  onRegistrarMovimentacao,
  onAjustarEstoque,
  onNovoMaterial
}) => {
  // Estado local sincronizado de materiais normalizados
  const [materiais, setMateriais] = useState(() =>
    (materiaisProp || []).map(normalizarMaterial)
  );

  // Estados de busca, sanfona de filtros e ordenação
  const [busca, setBusca] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [indiceOrdenacao, setIndiceOrdenacao] = useState(0);

  // Estados de controle do modal (Cockpit do Material com 3 Abas)
  const [materialModal, setMaterialModal] = useState(null);
  const [materialModalTab, setMaterialModalTab] = useState('detalhes'); // 'detalhes' | 'movimentar' | 'historico'
  const [tipoMovimentacao, setTipoMovimentacao] = useState('entrada'); // 'entrada', 'saida', 'ajuste'
  const [qtdMovimentacao, setQtdMovimentacao] = useState(1);
  const [motivoMovimentacao, setMotivoMovimentacao] = useState('');
  const [historicoPorMaterial, setHistoricoPorMaterial] = useState(historicoMovimentacoes);
  const [isEditandoDetalhes, setIsEditandoDetalhes] = useState(false);
  const [detalhesForm, setDetalhesForm] = useState({
    codigo: '',
    nome: '',
    unidade: 'UN',
    qtdPorCaixa: '',
    categoria: '',
    estoqueMinimo: 0,
    complexo: 'Almoxarifado Central',
    localizacao: '',
    descricao: ''
  });
  const [novoCodigoInput, setNovoCodigoInput] = useState('');
  const [isConfirmarCodigoOpen, setIsConfirmarCodigoOpen] = useState(false);

  // Modal de cadastro de novo item
  const [isNovoModalOpen, setIsNovoModalOpen] = useState(false);
  const [novoItemForm, setNovoItemForm] = useState({
    codigo: '',
    nome: '',
    categoria: 'Escritório',
    unidade: 'UN',
    qtdPorCaixa: '',
    quantidade: 0,
    estoqueMinimo: 5,
    complexo: 'Almoxarifado Central',
    localizacao: '',
    descricao: ''
  });

  // Notificações Toast
  const [toast, setToast] = useState(null);
  const [campoErro, setCampoErro] = useState(null);

  const exibirToast = (mensagem, tipo = 'sucesso') => {
    setToast({ mensagem, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  // Estado do Modal de Recebimento em Lote / Doações e Rascunho Persistente em Memória
  const [isRecebimentoModalOpen, setIsRecebimentoModalOpen] = useState(false);
  const [draftRemessa, setDraftRemessa] = useState({
    tipoOrigem: 'doacao',
    documentoDoador: '',
    observacao: '',
    itens: [],
    fotos: []
  });

  // Histórico de remessas e doações salvas para relatórios e auditorias (SGE Core)
  const [remessasHistorico, setRemessasHistorico] = useState(remessasExternas);

  useEffect(() => {
    if (remessasExternas.length > 0) setRemessasHistorico(remessasExternas);
  }, [remessasExternas]);

  // Confirmação de recebimento em lote
  const handleConfirmarRecebimentoLote = async (novaRemessa) => {
    let remessaPersistida = novaRemessa;
    if (onCriarRemessa) {
      try {
        remessaPersistida = await onCriarRemessa({
          tipoOrigem: novaRemessa.tipoOrigem,
          documentoDoador: novaRemessa.documentoDoador,
          observacao: novaRemessa.observacao,
          itens: novaRemessa.itens.map((item) => ({
            materialId: item.materialId,
            qtdRecebida: item.qtdRecebida
          }))
        });
      } catch (error) {
        exibirToast(error?.message || 'Não foi possível salvar a remessa no backend.', 'aviso');
        return;
      }
    }
    // 1. Atualizar materiais com a nova quantidade em estoque
    setMateriais((prevMateriais) => {
      const novos = prevMateriais.map((mat) => {
        const itemRemessa = novaRemessa.itens.find((i) => i.materialId === mat.id);
        if (itemRemessa) {
          const matAtualizado = {
            ...mat,
            quantidade: mat.quantidade + itemRemessa.qtdRecebida
          };
          return matAtualizado;
        }
        return mat;
      });
      return novos;
    });

    // 2. Adicionar entradas no histórico individual de cada material recebido
    setHistoricoPorMaterial((prev) => {
      const proximo = { ...prev };
      novaRemessa.itens.forEach((item) => {
        const entradaHist = {
          id: Date.now() + Math.random(),
          tipo: 'entrada',
          quantidade: item.qtdRecebida,
          data:
            'Hoje, ' +
            new Intl.DateTimeFormat('pt-BR', {
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date()),
          responsavel: 'Almoxarife',
          motivo:
            novaRemessa.tipoOrigem === 'doacao'
              ? `Doação recebida: ${novaRemessa.documentoDoador || 'Sem identificação'} (${novaRemessa.id})`
              : `Entrada em lote: ${novaRemessa.documentoDoador || 'NF'} (${novaRemessa.id})`
        };
        proximo[item.materialId] = [entradaHist, ...(proximo[item.materialId] || [])];
      });
      return proximo;
    });

    // 3. Salvar remessa no histórico permanente para relatórios
    const novasRemessas = [
      remessaPersistida,
      ...remessasHistorico.filter((item) => item.id !== remessaPersistida.id)
    ];
    setRemessasHistorico(novasRemessas);

    // 4. Limpar rascunho e fechar modal
    setDraftRemessa({
      tipoOrigem: 'doacao',
      documentoDoador: '',
      observacao: '',
      itens: [],
      fotos: []
    });
    setIsRecebimentoModalOpen(false);

    // 5. Exibir toast
    const labelTipo =
      novaRemessa.tipoOrigem === 'doacao' ? 'Doação registrada' : 'Recebimento em lote';
    exibirToast(
      `${labelTipo} com sucesso: ${novaRemessa.totalVolumes} volumes incorporados ao estoque!`
    );
  };

  // Descartar rascunho de remessa
  const handleDescartarRascunhoRemessa = () => {
    setDraftRemessa({
      tipoOrigem: 'doacao',
      documentoDoador: '',
      observacao: '',
      itens: [],
      fotos: []
    });
    setIsRecebimentoModalOpen(false);
    exibirToast('Rascunho de remessa descartado.');
  };

  // Sincroniza se vierem novas props do backend
  useEffect(() => {
    if (materiaisProp && materiaisProp.length > 0) {
      setMateriais(materiaisProp.map(normalizarMaterial));
    }
  }, [materiaisProp]);

  useEffect(() => {
    if (Object.keys(historicoMovimentacoes).length > 0) {
      setHistoricoPorMaterial(prev => ({ ...prev, ...historicoMovimentacoes }));
    }
  }, [historicoMovimentacoes]);

  // Contadores para os chips de filtro operacional
  const metricasStatus = useMemo(() => {
    let semEstoque = 0;
    let estoqueBaixo = 0;
    let atencao = 0;
    let regular = 0;

    materiais.forEach(m => {
      const st = calcularStatusReposicao(m.quantidade, m.estoqueMinimo);
      if (st.chave === 'sem_estoque') semEstoque++;
      else if (st.chave === 'estoque_baixo') estoqueBaixo++;
      else if (st.chave === 'atencao') atencao++;
      else regular++;
    });

    return {
      todos: materiais.length,
      semEstoque,
      estoqueBaixo,
      atencao,
      regular
    };
  }, [materiais]);

  // Verifica se há filtro ativo aplicado diferente do padrão
  const temFiltroAtivo = statusFiltro !== 'todos';

  // Ciclo da ordenação em loop
  const alternarOrdenacao = () => {
    setIndiceOrdenacao(prev => (prev + 1) % OPCOES_ORDENACAO_ALMOXARIFE.length);
  };

  const ordenacaoAtual = OPCOES_ORDENACAO_ALMOXARIFE[indiceOrdenacao];

  // Filtragem e ordenação dos materiais
  const materiaisFiltrados = useMemo(() => {
    let lista = [...materiais];

    // Busca textual multi-critério (nome, código/SKU, complexo, localização física, categoria)
    if (busca.trim()) {
      const termo = busca.toLowerCase().trim();
      lista = lista.filter(item =>
        item.nome.toLowerCase().includes(termo) ||
        (item.codigo && item.codigo.toLowerCase().includes(termo)) ||
        (item.categoria && item.categoria.toLowerCase().includes(termo)) ||
        (item.complexo && item.complexo.toLowerCase().includes(termo)) ||
        (item.localizacao && item.localizacao.toLowerCase().includes(termo)) ||
        (item.descricao && item.descricao.toLowerCase().includes(termo))
      );
    }

    // Filtro por status de reposição operacional
    if (statusFiltro !== 'todos') {
      lista = lista.filter(item => {
        const st = calcularStatusReposicao(item.quantidade, item.estoqueMinimo);
        return st.chave === statusFiltro;
      });
    }

    // Ordenação
    switch (ordenacaoAtual.id) {
      case 'maior_estoque':
        lista.sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome));
        break;
      case 'nome_az':
        lista.sort((a, b) => a.nome.localeCompare(b.nome));
        break;
      case 'menor_estoque':
      default: {
        const PESO_STATUS = {
          sem_estoque: 0,
          estoque_baixo: 1,
          atencao: 2,
          regular: 3
        };

        lista.sort((a, b) => {
          const statusA = calcularStatusReposicao(a.quantidade, a.estoqueMinimo);
          const statusB = calcularStatusReposicao(b.quantidade, b.estoqueMinimo);
          const pesoA = PESO_STATUS[statusA.chave] ?? 99;
          const pesoB = PESO_STATUS[statusB.chave] ?? 99;

          if (pesoA !== pesoB) {
            return pesoA - pesoB;
          }
          return (a.quantidade - b.quantidade) || a.nome.localeCompare(b.nome);
        });
        break;
      }
    }

    return lista;
  }, [materiais, busca, statusFiltro, ordenacaoAtual]);

  // Abertura do Cockpit do Material (A Geral do SGE)
  const handleAbrirModalMovimentacao = (material) => {
    const matNormalizado = normalizarMaterial(material);
    setMaterialModal({ ...matNormalizado, _modalTs: Date.now() });
    setMaterialModalTab('detalhes'); // Detalhes como aba principal
    setTipoMovimentacao('entrada');
    setQtdMovimentacao(1);
    setMotivoMovimentacao('');
    setIsEditandoDetalhes(false);
    setNovoCodigoInput('');
    setIsConfirmarCodigoOpen(false);
    setDetalhesForm({
      codigo: matNormalizado.codigo || '',
      nome: matNormalizado.nome || '',
      unidade: matNormalizado.unidade || 'UN',
      qtdPorCaixa: matNormalizado.qtdPorCaixa || '',
      categoria: matNormalizado.categoria || 'Escritório',
      estoqueMinimo: matNormalizado.estoqueMinimo ?? 5,
      complexo: matNormalizado.complexo || 'Almoxarifado Central',
      localizacao: matNormalizado.localizacao || '',
      descricao: matNormalizado.descricao || ''
    });
  };

  // Salvar movimentação operacional (Entrada / Saída / Balanço)
  const handleConfirmarMovimentacao = async () => {
    if (!materialModal) return;

    let novaQtd = materialModal.quantidade;
    const qtdNum = Number(qtdMovimentacao) || 0;

    if (tipoMovimentacao === 'entrada') {
      novaQtd += qtdNum;
    } else if (tipoMovimentacao === 'saida') {
      if (qtdNum > materialModal.quantidade) {
        exibirToast('Quantidade de saída não pode ser maior que o estoque atual!', 'aviso');
        return;
      }
      novaQtd = Math.max(0, novaQtd - qtdNum);
    } else if (tipoMovimentacao === 'ajuste') {
      novaQtd = Math.max(0, qtdNum);
    }

    const materialAtualizado = {
      ...materialModal,
      quantidade: novaQtd
    };

    if (tipoMovimentacao === 'ajuste' && onAjustarEstoque) {
      try {
        await onAjustarEstoque({ produtoId: materialModal.id, novoSaldo: novaQtd, motivo: motivoMovimentacao.trim() });
      } catch {
        exibirToast('Não foi possível registrar o ajuste.', 'aviso');
        return;
      }
    }

    if (onRegistrarMovimentacao && tipoMovimentacao !== 'ajuste') {
      try {
        await onRegistrarMovimentacao({
          produtoId: materialModal.id,
          tipo: tipoMovimentacao,
          quantidade: qtdNum,
          observacao: motivoMovimentacao.trim() || null
        });
      } catch {
        exibirToast('Não foi possível registrar a movimentação.', 'aviso');
        return;
      }
    }

    setMateriais(prev =>
      prev.map(m => (m.id === materialModal.id ? materialAtualizado : m))
    );

    // Registra entrada na linha do tempo do material
    const agora = new Date();
    const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const novaEntradaHistorico = {
      id: `h-${Date.now()}`,
      tipo: tipoMovimentacao,
      qtd: qtdNum,
      data: `Hoje, ${horaFormatada}`,
      responsavel: 'Almoxarife',
      motivo: motivoMovimentacao.trim() || (
        tipoMovimentacao === 'entrada' ? 'Entrada manual avulsa' :
        tipoMovimentacao === 'saida' ? 'Saída manual avulsa' :
        'Ajuste físico de balanço'
      )
    };

    setHistoricoPorMaterial(prev => ({
      ...prev,
      [materialModal.id]: [novaEntradaHistorico, ...(prev[materialModal.id] || [])]
    }));

    if (onAtualizarMaterial) {
      onAtualizarMaterial(materialAtualizado);
    }

    const mensagens = {
      entrada: `Entrada confirmada: saldo atual ${novaQtd} ${materialModal.unidade}`,
      saida: `Saída confirmada: saldo atual ${novaQtd} ${materialModal.unidade}`,
      ajuste: `Balanço concluído: novo saldo ${novaQtd} ${materialModal.unidade}`
    };

    exibirToast(mensagens[tipoMovimentacao]);
    setMaterialModal(null);
  };

  // Iniciar modo de edição no Detalhes com dados atuais sincronizados
  const handleIniciarEdicaoDetalhes = () => {
    if (!materialModal) return;
    setDetalhesForm({
      codigo: materialModal.codigo || '',
      nome: materialModal.nome || '',
      unidade: materialModal.unidade || 'UN',
      qtdPorCaixa: materialModal.qtdPorCaixa || '',
      categoria: materialModal.categoria || 'Escritório',
      estoqueMinimo: materialModal.estoqueMinimo ?? 5,
      complexo: materialModal.complexo || 'Almoxarifado Central',
      localizacao: materialModal.localizacao || '',
      descricao: materialModal.descricao || ''
    });
    setNovoCodigoInput(materialModal.codigo || '');
    setIsConfirmarCodigoOpen(false);
    setCampoErro(null);
    setIsEditandoDetalhes(true);
  };

  // Cancelar modo de edição revertendo qualquer modificação não salva
  const handleCancelarEdicaoDetalhes = () => {
    if (materialModal) {
      setDetalhesForm({
        codigo: materialModal.codigo || '',
        nome: materialModal.nome || '',
        unidade: materialModal.unidade || 'UN',
        qtdPorCaixa: materialModal.qtdPorCaixa || '',
        categoria: materialModal.categoria || 'Escritório',
        estoqueMinimo: materialModal.estoqueMinimo ?? 5,
        complexo: materialModal.complexo || 'Almoxarifado Central',
        localizacao: materialModal.localizacao || '',
        descricao: materialModal.descricao || ''
      });
    }
    setNovoCodigoInput('');
    setIsConfirmarCodigoOpen(false);
    setCampoErro(null);
    setIsEditandoDetalhes(false);
  };

  // Alternar abas do Cockpit resetando o modo de edição se necessário
  const handleMudarAbaCockpit = (novaAba) => {
    if (isEditandoDetalhes) {
      handleCancelarEdicaoDetalhes();
    }
    setCampoErro(null);
    setMaterialModalTab(novaAba);
  };

  // Salvar alterações de cadastro no Detalhes
  const handleSalvarDetalhes = () => {
    if (!materialModal) return;

    const unidadeFormatada = detalhesForm.unidade.trim() || materialModal.unidade || 'UN';
    const ehIndividual = isUnidadeIndividual(unidadeFormatada);
    const qtdNum = Number(detalhesForm.qtdPorCaixa);

    // Validação mandatória: embalagens DEVEM ter quantidade informada (> 0)
    if (!ehIndividual && (!detalhesForm.qtdPorCaixa || isNaN(qtdNum) || qtdNum <= 0)) {
      setCampoErro('qtdPorCaixa');
      exibirToast('Preencha a quantidade no campo "Qtd na Embalagem"!', 'aviso');
      setTimeout(() => {
        const inputEl = document.querySelector('input[aria-label="Quantidade por Embalagem"]');
        if (inputEl) {
          inputEl.focus();
          inputEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
      return;
    }
    setCampoErro(null);

    const codigoFormatado = detalhesForm.codigo.trim() || materialModal.codigo;
    const nomeFormatado = detalhesForm.nome.trim() || materialModal.nome;
    const qtdPorCaixaNum = ehIndividual ? undefined : qtdNum;

    const materialAtualizado = {
      ...materialModal,
      codigo: codigoFormatado,
      nome: nomeFormatado,
      unidade: unidadeFormatada,
      qtdPorCaixa: qtdPorCaixaNum,
      categoria: detalhesForm.categoria || materialModal.categoria,
      estoqueMinimo: Number(detalhesForm.estoqueMinimo) || materialModal.estoqueMinimo,
      complexo: detalhesForm.complexo || materialModal.complexo || 'Almoxarifado Central',
      localizacao: detalhesForm.localizacao.trim(),
      descricao: detalhesForm.descricao.trim()
    };

    setMateriais(prev =>
      prev.map(m => (m.id === materialModal.id ? materialAtualizado : m))
    );
    setMaterialModal(materialAtualizado);
    setIsEditandoDetalhes(false);

    if (onAtualizarMaterial) {
      onAtualizarMaterial(materialAtualizado);
    }

    exibirToast(`Informações de "${materialAtualizado.nome}" atualizadas com sucesso!`);
  };

  // Confirmar inserção direta de novo código com blur de teclado e notificação
  const handleConfirmarNovoCodigo = () => {
    const codFormatado = novoCodigoInput.trim().toUpperCase();
    if (!codFormatado) {
      exibirToast('O código não pode ficar vazio!', 'aviso');
      return;
    }
    const active = document.activeElement;
    if (active && active.blur) active.blur();
    setDetalhesForm(prev => ({ ...prev, codigo: codFormatado }));
    setIsConfirmarCodigoOpen(false);
    exibirToast(`Código alterado para "${codFormatado}"`);
  };

  // Configuração das Abas do Cockpit do Material (A Geral do SGE: 1º Detalhes, 2º Movimentar, 3º Histórico)
  const abasCockpit = useMemo(() => {
    if (!materialModal) return [];
    const qtdHistorico = (historicoPorMaterial[materialModal.id] || []).length;
    return [
      {
        id: 'detalhes',
        label: 'Detalhes',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )
      },
      {
        id: 'movimentar',
        label: 'Movimentar',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        )
      },
      {
        id: 'historico',
        label: 'Histórico',
        badge: qtdHistorico > 0 ? qtdHistorico : undefined,
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 14 14" />
          </svg>
        )
      }
    ];
  }, [materialModal, historicoPorMaterial]);

  // Cadastro de novo item
  const handleCriarNovoMaterial = (e) => {
    e.preventDefault();
    if (!novoItemForm.nome.trim()) return;

    const ehIndividual = isUnidadeIndividual(novoItemForm.unidade);
    const qtdNum = Number(novoItemForm.qtdPorCaixa);

    if (!ehIndividual && (!novoItemForm.qtdPorCaixa || isNaN(qtdNum) || qtdNum <= 0)) {
      exibirToast('Informe a quantidade de itens na embalagem antes de cadastrar!', 'aviso');
      return;
    }

    const novoId = Math.max(...materiais.map(m => m.id), 0) + 1;
    const codigoGerado = novoItemForm.codigo.trim() || `MAT-${String(novoId).padStart(3, '0')}`;
    const qtdPorCaixaNum = ehIndividual ? undefined : qtdNum;

    const novoMaterial = {
      id: novoId,
      codigo: codigoGerado,
      nome: novoItemForm.nome.trim(),
      categoria: novoItemForm.categoria,
      unidade: novoItemForm.unidade || 'UN',
      qtdPorCaixa: qtdPorCaixaNum,
      quantidade: Number(novoItemForm.quantidade) || 0,
      estoqueMinimo: Number(novoItemForm.estoqueMinimo) || 5,
      complexo: novoItemForm.complexo || 'Almoxarifado Central',
      localizacao: novoItemForm.localizacao.trim(),
      descricao: novoItemForm.descricao.trim()
    };

    setMateriais(prev => [novoMaterial, ...prev]);
    if (onNovoMaterial) {
      onNovoMaterial(novoMaterial);
    }

    exibirToast(`Material "${novoMaterial.nome}" cadastrado com sucesso!`);
    setIsNovoModalOpen(false);
    setNovoItemForm({
      codigo: '',
      nome: '',
      categoria: 'Escritório',
      unidade: 'UN',
      qtdPorCaixa: '',
      quantidade: 0,
      estoqueMinimo: 5,
      complexo: 'Almoxarifado Central',
      localizacao: '',
      descricao: ''
    });
  };

  return (
    <div className="almoxarife-estoque">
      {/* Toast Notification */}
      {toast && (
        <div className={`almoxarife-toast ${toast.tipo === 'aviso' ? 'almoxarife-toast--aviso' : ''}`}>
          <div className="almoxarife-toast__icon">
            {toast.tipo === 'aviso' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
          </div>
          <span className="almoxarife-toast__text">{toast.mensagem}</span>
        </div>
      )}

      {/* Seção Superior Unificada: Busca + Botão de Filtro com Sanfona (A Geral do SGE) */}
      <div className="almoxarife-estoque__top-section">
        <SearchFilterBar
          searchTerm={busca}
          onSearchChange={setBusca}
          onClear={() => setBusca('')}
          placeholder="Buscar por nome, código ou prateleira..."
          hasActiveFilter={temFiltroAtivo}
          isFilterOpen={mostrarFiltros}
          onToggleFilter={() => setMostrarFiltros(prev => !prev)}
        />

        <FilterDrawer isOpen={mostrarFiltros}>
          <FilterGroup title="Status de Reposição">
            <FilterChip
              label="Todos"
              count={metricasStatus.todos}
              isActive={statusFiltro === 'todos'}
              onClick={() => setStatusFiltro('todos')}
            />

            <FilterChip
              label="Sem Estoque"
              count={metricasStatus.semEstoque}
              isActive={statusFiltro === 'sem_estoque'}
              dotColor="#DC2626"
              onClick={() => setStatusFiltro('sem_estoque')}
            />

            <FilterChip
              label="Estoque Baixo"
              count={metricasStatus.estoqueBaixo}
              isActive={statusFiltro === 'estoque_baixo'}
              dotColor="#F59E0B"
              onClick={() => setStatusFiltro('estoque_baixo')}
            />

            <FilterChip
              label="Atenção"
              count={metricasStatus.atencao}
              isActive={statusFiltro === 'atencao'}
              dotColor="#EAB308"
              onClick={() => setStatusFiltro('atencao')}
            />

            <FilterChip
              label="Regular"
              count={metricasStatus.regular}
              isActive={statusFiltro === 'regular'}
              dotColor="#10B981"
              onClick={() => setStatusFiltro('regular')}
            />
          </FilterGroup>
        </FilterDrawer>
      </div>

      {/* Contador de resultados e Seletor de Ordenação Inteligente (A Geral do SGE) */}
      <div className="sge-meta-bar">
        <span className="sge-meta-count">
          {materiaisFiltrados.length === 1
            ? '1 material encontrado'
            : `${materiaisFiltrados.length} materiais encontrados`}
        </span>

        <SortLoopButton
          currentLabel={ordenacaoAtual.label}
          onToggleSort={alternarOrdenacao}
        />
      </div>

      {/* Lista de Tickets do Almoxarife */}
      <div className="almoxarife-estoque__ticket-list">
        {materiaisFiltrados.length === 0 ? (
          <div className="empty-state-almoxarife">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <h4>Nenhum material encontrado</h4>
            <p>Tente ajustar os termos de busca ou selecione outro filtro de reposição.</p>
            {(busca || temFiltroAtivo) && (
              <button
                type="button"
                className="btn-limpar-filtros"
                onClick={() => {
                  setBusca('');
                  setStatusFiltro('todos');
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          materiaisFiltrados.map(item => {
            const status = calcularStatusReposicao(item.quantidade, item.estoqueMinimo);
            // Razão de preenchimento da barra de nível (base 2x o mínimo para escala regular)
            const metaEscala = Math.max(item.estoqueMinimo * 2, 1);
            const percentual = Math.min(100, Math.round((item.quantidade / metaEscala) * 100));

            return (
              <div
                key={item.id}
                className={`ticket-almoxarife ticket-almoxarife--${status.chave}`}
                onClick={() => handleAbrirModalMovimentacao(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleAbrirModalMovimentacao(item);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`${item.nome}, estoque ${item.quantidade} ${item.unidade}, status ${status.label}. Toque para abrir movimentações, histórico e detalhes.`}
              >
                {/* Lado Esquerdo: Identificação e Dados do Material */}
                <div className="ticket-almoxarife__main">
                  <div className="ticket-almoxarife__body">
                    <h3 className="ticket-almoxarife__title">{item.nome}</h3>
                    {item.descricao && (
                      <p className="ticket-almoxarife__desc">{item.descricao}</p>
                    )}
                  </div>

                  <div className="ticket-almoxarife__ids">
                    <span className="sku-badge">{item.codigo}</span>
                    <span
                      className="location-pill"
                      title={
                        item.localizacao
                          ? `${item.complexo || 'Almoxarifado Central'} • ${item.localizacao}`
                          : (item.complexo || 'Almoxarifado Central')
                      }
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="location-text">
                        {item.localizacao
                          ? `${item.complexo || 'Almoxarifado Central'} • ${item.localizacao}`
                          : (item.complexo || 'Almoxarifado Central')}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Lado Direito: Topo com Indicador de Atenção (!) + Saldo e Mínimo */}
                <div className="ticket-almoxarife__side">
                  <div className="ticket-almoxarife__side-top">
                    {status.chave === 'atencao' && (
                      <span
                        className="ticket-almoxarife__atencao-badge"
                        title="Atenção: estoque próximo do mínimo"
                        aria-label="Atenção: estoque próximo do mínimo"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <line x1="12" y1="8" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      </span>
                    )}
                  </div>

                  <div className="ticket-almoxarife__stock-wrap">
                    <span className="ticket-almoxarife__stock-current">
                      <strong>{item.quantidade}</strong> <small>{item.unidade}</small>
                    </span>
                    <span className="ticket-almoxarife__stock-min">
                      mín. {item.estoqueMinimo} {item.unidade}
                    </span>
                  </div>
                </div>

                {/* Barra de Nível Vertical na Borda Direita (Tank Gauge) */}
                <div
                  className="ticket-almoxarife__level-gauge"
                  title={`Nível do estoque: ${percentual}%`}
                  aria-hidden="true"
                >
                  {/* Linha de segurança do Estoque Mínimo (50% da escala) */}
                  <div
                    className="ticket-almoxarife__gauge-min-mark"
                    style={{ bottom: '50%' }}
                  />
                  <div
                    className="ticket-almoxarife__gauge-fill"
                    style={{
                      height: `${item.quantidade > 0 ? Math.max(percentual, 8) : 0}%`,
                      backgroundColor: status.pontoCor
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Speed Dial FAB Flutuante com Ações Rápidas (A Geral do SGE) */}
      <SpeedDialFAB
        badgeCount={draftRemessa.itens.length}
        actions={[
          {
            id: 'receber-lote',
            label: 'Receber em Lote / Doação',
            variant: 'accent',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            ),
            badge: draftRemessa.itens.length > 0 ? `${draftRemessa.itens.length} no rascunho` : null,
            onClick: () => setIsRecebimentoModalOpen(true)
          },
          {
            id: 'novo-material',
            label: 'Novo Material',
            variant: 'secondary',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            ),
            onClick: () => setIsNovoModalOpen(true)
          }
        ]}
      />

      {/* Cockpit do Material com 3 Abas: Detalhes, Movimentar, Histórico (A Geral do SGE) */}
      <BottomSheetModal
        isOpen={!!materialModal}
        onClose={() => {
          setIsEditandoDetalhes(false);
          setMaterialModal(null);
        }}
        title={
          materialModal ? (
            <div
              className={`modal-title-btn-box ${
                materialModalTab !== 'detalhes'
                  ? 'modal-title-btn-box--plain'
                  : isEditandoDetalhes
                  ? 'modal-title-btn-box--editing'
                  : 'modal-title-btn-box--view'
              }`}
            >
              {isEditandoDetalhes ? (
                <>
                  <input
                    type="text"
                    className="modal-title-btn-input"
                    value={detalhesForm.nome}
                    onChange={e => setDetalhesForm(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Nome do material..."
                    enterKeyHint="done"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.target.blur();
                      }
                    }}
                    aria-label="Editar nome do material"
                  />
                  <span className="modal-title-btn-pencil" aria-hidden="true" title="Editando nome">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </span>
                </>
              ) : (
                <span className="modal-title-btn-text">{materialModal.nome}</span>
              )}
            </div>
          ) : ''
        }
        className="almoxarife-cockpit-sheet"
        badge={null}
        footer={
          <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', gap: '10px' }}>
            {materialModalTab === 'detalhes' && (
              <>
                {isEditandoDetalhes ? (
                  <>
                    <button
                      type="button"
                      className="btn-modal-cancel"
                      onClick={handleCancelarEdicaoDetalhes}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn-modal-confirm"
                      onClick={handleSalvarDetalhes}
                    >
                      Salvar Alterações
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-modal-cancel"
                      onClick={() => setMaterialModal(null)}
                    >
                      Fechar
                    </button>
                    <button
                      type="button"
                      className="btn-modal-confirm"
                      onClick={handleIniciarEdicaoDetalhes}
                    >
                      Editar Dados
                    </button>
                  </>
                )}
              </>
            )}

            {materialModalTab === 'movimentar' && (
              <>
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setMaterialModal(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-modal-confirm"
                  onClick={handleConfirmarMovimentacao}
                  disabled={tipoMovimentacao === 'saida' && materialModal?.quantidade <= 0}
                >
                  {tipoMovimentacao === 'entrada' && 'Confirmar Entrada'}
                  {tipoMovimentacao === 'saida' && 'Confirmar Saída'}
                  {tipoMovimentacao === 'ajuste' && 'Confirmar Balanço'}
                </button>
              </>
            )}

            {materialModalTab === 'historico' && (
              <>
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setMaterialModal(null)}
                >
                  Fechar
                </button>
                <button
                  type="button"
                  className="btn-modal-confirm"
                  onClick={() => setMaterialModalTab('movimentar')}
                >
                  Nova Movimentação
                </button>
              </>
            )}
          </div>
        }
      >
        {materialModal && (
          <div className="almoxarife-modal__body" style={{ padding: 0 }}>
            {/* Navegação entre Abas do Cockpit (1º Detalhes, 2º Movimentar, 3º Histórico) */}
            <div style={{ marginBottom: '10px' }}>
              <SegmentedTabs
                tabs={abasCockpit}
                activeTab={materialModalTab}
                onChange={handleMudarAbaCockpit}
                layoutId="almoxMaterialModalTabIndicator"
                size="md"
                ariaLabel="Seções do material"
              />
            </div>

            {/* ABA 1 (PRINCIPAL): DETALHES & FICHA TÉCNICA (ZERO SHIFT & BOTÕES INTERATIVOS) */}
            {materialModalTab === 'detalhes' && (
              <div className="modal-tab-content">
                <div className="modal-details-grid">
                  {/* 1. Código / SKU (Editável via Modal com Confirmação e Inserção Direta) */}
                  <div
                    className={`detail-card ${isEditandoDetalhes ? 'detail-card--button detail-card--editing' : ''}`}
                    onClick={
                      isEditandoDetalhes
                        ? () => {
                            setNovoCodigoInput(detalhesForm.codigo || materialModal?.codigo || '');
                            setIsConfirmarCodigoOpen(true);
                          }
                        : undefined
                    }
                    title={
                      isEditandoDetalhes
                        ? "Clique para alterar o código com confirmação"
                        : undefined
                    }
                  >
                    <div className="detail-card__header">
                      <span className="detail-label">Código / SKU</span>
                      {isEditandoDetalhes && (
                        <span
                          className="detail-card__confirm-icon"
                          aria-hidden="true"
                          title="Clique para alterar com confirmação"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="detail-card__value-wrap">
                      <span className="detail-value">{isEditandoDetalhes ? detalhesForm.codigo : materialModal.codigo}</span>
                    </div>
                  </div>

                  {/* 2. Complexo (Editável / Dropdown) */}
                  <div
                    className={`detail-card ${isEditandoDetalhes ? 'detail-card--button detail-card--editing' : ''}`}
                    onClick={
                      isEditandoDetalhes
                        ? (e) => {
                            const el = e.currentTarget.querySelector('select');
                            if (el && document.activeElement !== el) el.focus();
                          }
                        : undefined
                    }
                  >
                    <div className="detail-card__header">
                      <span className="detail-label">Complexo</span>
                      {isEditandoDetalhes && (
                        <span className="detail-card__pencil" aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="detail-card__value-wrap">
                      {isEditandoDetalhes ? (
                        <select
                          className="card-btn-select"
                          value={detalhesForm.complexo}
                          onChange={e => setDetalhesForm({ ...detalhesForm, complexo: e.target.value })}
                          aria-label="Complexo"
                        >
                          {!LISTA_COMPLEXOS.includes(detalhesForm.complexo) && detalhesForm.complexo && (
                            <option value={detalhesForm.complexo}>{detalhesForm.complexo}</option>
                          )}
                          {LISTA_COMPLEXOS.map(comp => (
                            <option key={comp} value={comp}>{comp}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="detail-value">{materialModal.complexo || 'Almoxarifado Central'}</span>
                      )}
                    </div>
                  </div>

                  {/* 3. Localização Física (Largura Total, Editável / Texto) */}
                  <div
                    className={`detail-card detail-card--full ${isEditandoDetalhes ? 'detail-card--button detail-card--editing' : ''}`}
                    onClick={
                      isEditandoDetalhes
                        ? (e) => {
                            const el = e.currentTarget.querySelector('input');
                            if (el && document.activeElement !== el) el.focus();
                          }
                        : undefined
                    }
                  >
                    <div className="detail-card__header">
                      <span className="detail-label">Localização Física</span>
                      {isEditandoDetalhes && (
                        <span className="detail-card__pencil" aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="detail-card__value-wrap">
                      {isEditandoDetalhes ? (
                        <input
                          type="text"
                          className="card-btn-input"
                          placeholder="Ex: Prat. 02, Gaveta 04..."
                          value={detalhesForm.localizacao}
                          onChange={e => setDetalhesForm({ ...detalhesForm, localizacao: e.target.value })}
                          enterKeyHint="done"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.target.blur();
                            }
                          }}
                          aria-label="Localização Física"
                        />
                      ) : (
                        <span className="detail-value">{materialModal.localizacao || 'Não especificada'}</span>
                      )}
                    </div>
                  </div>

                  {/* 3. Unidade de Medida & Quantidade por Embalagem (Largura Total, Dividida 50% / 50%) */}
                  <div
                    className={`detail-card detail-card--full detail-card--split ${isEditandoDetalhes ? 'detail-card--editing-split' : ''}`}
                  >
                    {/* Metade Esquerda (50%): Unidade de Medida */}
                    <div
                      className={`detail-split__col ${isEditandoDetalhes ? 'detail-split__col--clickable' : ''}`}
                      onClick={
                        isEditandoDetalhes
                          ? (e) => {
                              if (e.target.tagName !== 'SELECT') {
                                const el = e.currentTarget.querySelector('select');
                                if (el && document.activeElement !== el) el.focus();
                              }
                            }
                          : undefined
                      }
                    >
                      <div className="detail-card__header">
                        <span className="detail-label">Unidade de Medida</span>
                        {isEditandoDetalhes && (
                          <span className="detail-card__pencil" aria-hidden="true">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="detail-card__value-wrap">
                        {isEditandoDetalhes ? (
                          <select
                            className="card-btn-select"
                            value={detalhesForm.unidade}
                            onChange={e => {
                              const novaUnidade = e.target.value;
                              setDetalhesForm(prev => ({
                                ...prev,
                                unidade: novaUnidade,
                                qtdPorCaixa: isUnidadeIndividual(novaUnidade) ? '' : prev.qtdPorCaixa
                              }));
                            }}
                            aria-label="Unidade de Medida"
                          >
                            {!LISTA_UNIDADES.includes(detalhesForm.unidade) && detalhesForm.unidade && (
                              <option value={detalhesForm.unidade}>{detalhesForm.unidade}</option>
                            )}
                            <option value="UN">Unidade (UN)</option>
                            <option value="CX">Caixa (CX)</option>
                            <option value="Pacote">Pacote (PCT)</option>
                            <option value="Resma">Resma</option>
                            <option value="Frasco">Frasco</option>
                            <option value="Galão">Galão</option>
                            <option value="Fardo">Fardo</option>
                            <option value="Rolo">Rolo</option>
                            <option value="Par">Par</option>
                            <option value="Outro">Outro</option>
                          </select>
                        ) : (
                          <span className="detail-value">
                            {isUnidadeIndividual(materialModal.unidade)
                              ? (materialModal.unidade === 'Par' ? 'Par (PAR)' : 'Unidade (UN)')
                              : isUnidadeCaixa(materialModal.unidade)
                              ? 'Caixa (CX)'
                              : materialModal.unidade === 'Pacote'
                              ? 'Pacote (PCT)'
                              : materialModal.unidade}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Divisória Vertical Central */}
                    <div className="detail-split__divider" aria-hidden="true" />

                    {/* Metade Direita (50%): Quantidade por Embalagem */}
                    <div
                      className={`detail-split__col ${
                        isEditandoDetalhes && !isUnidadeIndividual(detalhesForm.unidade) ? 'detail-split__col--clickable' : ''
                      } ${isEditandoDetalhes && isUnidadeIndividual(detalhesForm.unidade) ? 'detail-split__col--locked' : ''} ${
                        campoErro === 'qtdPorCaixa' ? 'detail-split__col--error' : ''
                      }`}
                      onClick={
                        isEditandoDetalhes && !isUnidadeIndividual(detalhesForm.unidade)
                          ? (e) => {
                              if (e.target.tagName !== 'INPUT') {
                                const el = e.currentTarget.querySelector('input');
                                if (el && document.activeElement !== el) el.focus();
                              }
                            }
                          : undefined
                      }
                    >
                      <div className="detail-card__header">
                        <span className="detail-label">
                          {isUnidadeIndividual(isEditandoDetalhes ? detalhesForm.unidade : materialModal.unidade)
                            ? 'Itens p/ Unidade'
                            : 'Qtd na Embalagem'}
                        </span>
                        {isEditandoDetalhes && !isUnidadeIndividual(detalhesForm.unidade) && (
                          <span className="detail-card__pencil" aria-hidden="true">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </span>
                        )}
                        {isEditandoDetalhes && isUnidadeIndividual(detalhesForm.unidade) && (
                          <span className="detail-split__lock-badge" title="Travado em 1 para item individual">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="detail-card__value-wrap">
                        {isEditandoDetalhes ? (
                          isUnidadeIndividual(detalhesForm.unidade) ? (
                            <span className="detail-value detail-value--locked" title="Quantidade indivisível para item individual">
                              1 {detalhesForm.unidade === 'Par' ? 'par' : 'un'} (individual)
                            </span>
                          ) : (
                            <div className="card-btn-number-wrap">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="card-btn-input"
                                placeholder="Ex: 50"
                                value={detalhesForm.qtdPorCaixa || ''}
                                onChange={e => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  if (campoErro === 'qtdPorCaixa') setCampoErro(null);
                                  setDetalhesForm(prev => ({ ...prev, qtdPorCaixa: val }));
                                }}
                                enterKeyHint="done"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.target.blur();
                                  }
                                }}
                                aria-label="Quantidade por Embalagem"
                              />
                              <span className="card-btn-unit">un</span>
                            </div>
                          )
                        ) : (
                          <span className={`detail-value ${isUnidadeIndividual(materialModal.unidade) ? 'detail-value--muted' : ''}`}>
                            {isUnidadeIndividual(materialModal.unidade)
                              ? `1 ${materialModal.unidade === 'Par' ? 'par' : 'un'} (individual)`
                              : materialModal.qtdPorCaixa
                              ? `${materialModal.qtdPorCaixa} un / emb.`
                              : 'Não informado'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 4. Categoria (Editável / Dropdown) */}
                  <div
                    className={`detail-card ${isEditandoDetalhes ? 'detail-card--button detail-card--editing' : ''}`}
                    onClick={
                      isEditandoDetalhes
                        ? (e) => {
                            const el = e.currentTarget.querySelector('select');
                            if (el && document.activeElement !== el) el.focus();
                          }
                        : undefined
                    }
                  >
                    <div className="detail-card__header">
                      <span className="detail-label">Categoria</span>
                      {isEditandoDetalhes && (
                        <span className="detail-card__pencil" aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="detail-card__value-wrap">
                      {isEditandoDetalhes ? (
                        <select
                          className="card-btn-select"
                          value={detalhesForm.categoria}
                          onChange={e => setDetalhesForm({ ...detalhesForm, categoria: e.target.value })}
                          aria-label="Categoria"
                        >
                          <option value="Escritório">Escritório</option>
                          <option value="Material Didático">Material Didático</option>
                          <option value="Limpeza e Higiene">Limpeza e Higiene</option>
                          <option value="Informática / TI">Informática / TI</option>
                          <option value="Manutenção / Reparos">Manutenção / Reparos</option>
                          <option value="Outros">Outros</option>
                        </select>
                      ) : (
                        <span className="detail-value">{materialModal.categoria}</span>
                      )}
                    </div>
                  </div>

                  {/* 5. Estoque Mínimo (Editável / Número com Teclado Numérico e Tecla OK) */}
                  <div
                    className={`detail-card ${isEditandoDetalhes ? 'detail-card--button detail-card--editing' : ''}`}
                    onClick={
                      isEditandoDetalhes
                        ? (e) => {
                            const el = e.currentTarget.querySelector('input');
                            if (el && document.activeElement !== el) el.focus();
                          }
                        : undefined
                    }
                  >
                    <div className="detail-card__header">
                      <span className="detail-label">Estoque Mínimo</span>
                      {isEditandoDetalhes && (
                        <span className="detail-card__pencil" aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="detail-card__value-wrap">
                      {isEditandoDetalhes ? (
                        <div className="card-btn-number-wrap">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="card-btn-input"
                            value={detalhesForm.estoqueMinimo}
                            onChange={e => {
                              const val = e.target.value.replace(/\D/g, '');
                              setDetalhesForm({ ...detalhesForm, estoqueMinimo: val });
                            }}
                            enterKeyHint="done"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.target.blur();
                              }
                            }}
                            aria-label="Estoque Mínimo"
                          />
                          <span className="card-btn-unit">{detalhesForm.unidade || materialModal.unidade}</span>
                        </div>
                      ) : (
                        <span className="detail-value">{materialModal.estoqueMinimo} {materialModal.unidade}</span>
                      )}
                    </div>
                  </div>

                  {/* 6. Saldo Atual (Largura Total, Fixo / Transacional na aba Movimentar) */}
                  <div className="detail-card detail-card--full detail-card--static">
                    <div className="detail-card__header">
                      <span className="detail-label">Saldo Atual em Estoque</span>
                    </div>
                    <div className="detail-card__value-wrap">
                      <span className="detail-value detail-value--accent">
                        {materialModal.quantidade} {materialModal.unidade}
                      </span>
                    </div>
                  </div>

                  {/* 8. Descrição & Especificações (Largura Total, Editável / Textarea) */}
                  <div
                    className={`detail-card detail-card--full detail-card--desc ${isEditandoDetalhes ? 'detail-card--button detail-card--editing' : ''}`}
                    onClick={
                      isEditandoDetalhes
                        ? (e) => {
                            const el = e.currentTarget.querySelector('textarea');
                            if (el && document.activeElement !== el) el.focus();
                          }
                        : undefined
                    }
                  >
                    <div className="detail-card__header">
                      <span className="detail-label">Descrição & Especificações</span>
                      {isEditandoDetalhes && (
                        <span className="detail-card__pencil" aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="detail-card__value-wrap">
                      {isEditandoDetalhes ? (
                        <textarea
                          className="card-btn-textarea"
                          value={detalhesForm.descricao}
                          onChange={e => setDetalhesForm({ ...detalhesForm, descricao: e.target.value })}
                          placeholder="Informações adicionais do material..."
                          enterKeyHint="done"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              e.target.blur();
                            }
                          }}
                          aria-label="Descrição e Especificações"
                        />
                      ) : (
                        <span className="detail-value detail-value--desc">{materialModal.descricao || 'Sem descrição cadastrada'}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 2: MOVIMENTAR & AJUSTAR (SEM LOCALIZAÇÃO REPETIDA) */}
            {materialModalTab === 'movimentar' && (
              <div className="modal-tab-content">
                {/* Saldo Atual */}
                <div className="modal-balance-card">
                  <span className="balance-label">Estoque Atual</span>
                  <span className="balance-value">
                    <strong>{materialModal.quantidade}</strong> {materialModal.unidade}
                  </span>
                  <span className="balance-min">
                    Estoque Mínimo de Segurança: {materialModal.estoqueMinimo} {materialModal.unidade}
                  </span>
                </div>

                {/* Seletor de Tipo de Movimentação */}
                <div className="mov-type-selector">
                  <button
                    type="button"
                    className={`type-btn ${tipoMovimentacao === 'entrada' ? 'type-btn--active-entrada' : ''}`}
                    onClick={() => setTipoMovimentacao('entrada')}
                  >
                    Entrada (+)
                  </button>
                  <button
                    type="button"
                    className={`type-btn ${tipoMovimentacao === 'saida' ? 'type-btn--active-saida' : ''}`}
                    onClick={() => setTipoMovimentacao('saida')}
                  >
                    Saída (−)
                  </button>
                  <button
                    type="button"
                    className={`type-btn ${tipoMovimentacao === 'ajuste' ? 'type-btn--active-ajuste' : ''}`}
                    onClick={() => setTipoMovimentacao('ajuste')}
                  >
                    Balanço (=)
                  </button>
                </div>

                {/* Campo de Quantidade com QuantityStepper Padronizado */}
                <div className="modal-form-group">
                  <label className="modal-label">
                    {tipoMovimentacao === 'entrada' && 'Quantidade a Adicionar:'}
                    {tipoMovimentacao === 'saida' && 'Quantidade a Retirar:'}
                    {tipoMovimentacao === 'ajuste' && 'Novo Saldo Real Contado:'}
                  </label>
                  <QuantityStepper
                    value={qtdMovimentacao}
                    onChange={setQtdMovimentacao}
                    min={tipoMovimentacao === 'ajuste' ? 0 : 1}
                    max={tipoMovimentacao === 'saida' ? materialModal.quantidade : undefined}
                    unit={materialModal.unidade}
                    quickPills={tipoMovimentacao === 'ajuste' ? [0, 5, 10, 20] : [1, 5, 10, 25]}
                  />
                </div>

                {/* Motivo da Operação */}
                <div className="modal-form-group">
                  <label className="modal-label">Motivo / Justificativa (Opcional):</label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder={
                      tipoMovimentacao === 'entrada'
                        ? 'Ex: Recebimento de fornecedor, devolução...'
                        : tipoMovimentacao === 'saida'
                        ? 'Ex: Baixa avulsa, avaria, descarte...'
                        : 'Ex: Contagem física de inventário...'
                    }
                    value={motivoMovimentacao}
                    onChange={e => setMotivoMovimentacao(e.target.value)}
                    enterKeyHint="done"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.target.blur();
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* ABA 3: HISTÓRICO & AUDITORIA */}
            {materialModalTab === 'historico' && (
              <div className="modal-tab-content">
                <div className="modal-timeline">
                  {(!historicoPorMaterial[materialModal.id] || historicoPorMaterial[materialModal.id].length === 0) ? (
                    <div className="timeline-empty">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 14 14" />
                      </svg>
                      <span>Nenhum histórico registrado para este item.</span>
                    </div>
                  ) : (
                    historicoPorMaterial[materialModal.id].map((h) => {
                      const isEntrada = h.tipo === 'entrada';
                      const isSaida = h.tipo === 'saida';
                      return (
                        <div key={h.id} className="timeline-card">
                          <div className={`timeline-dot timeline-dot--${h.tipo}`}>
                            {isEntrada && (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <polyline points="19 12 12 19 5 12" />
                              </svg>
                            )}
                            {isSaida && (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="12" y1="19" x2="12" y2="5" />
                                <polyline points="5 12 12 5 19 12" />
                              </svg>
                            )}
                            {!isEntrada && !isSaida && (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                              </svg>
                            )}
                          </div>
                          <div className="timeline-content">
                            <div className="timeline-top">
                              <span className="timeline-title">
                                {isEntrada ? 'Entrada de Estoque' : isSaida ? 'Saída Registrada' : 'Ajuste de Balanço'}
                              </span>
                              <span className={`timeline-delta timeline-delta--${h.tipo}`}>
                                {isEntrada ? `+${h.qtd}` : isSaida ? `-${h.qtd}` : `Saldo: ${h.qtd}`} {materialModal.unidade}
                              </span>
                            </div>
                            <p className="timeline-desc">{h.motivo}</p>
                            <span className="timeline-meta">{h.data} • {h.responsavel}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </BottomSheetModal>

      {/* Modal de Confirmação de Segurança para Alteração de Código / SKU */}
      <BottomSheetModal
        isOpen={isConfirmarCodigoOpen}
        onClose={() => setIsConfirmarCodigoOpen(false)}
        title="Alterar Código / SKU"
        subtitle="Confirmação Cadastral"
        zIndex={11000}
        footer={
          <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn-modal-cancel"
              onClick={() => setIsConfirmarCodigoOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-modal-confirm"
              onClick={handleConfirmarNovoCodigo}
            >
              Confirmar Código
            </button>
          </div>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const active = document.activeElement;
            if (active && active.blur) active.blur();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            padding: '12px',
            borderRadius: '10px'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div style={{ fontSize: '13px', color: '#92400E', lineHeight: '1.4' }}>
              <strong>Atenção à rastreabilidade:</strong> O Código / SKU é a chave de identificação do item. Digite o novo código abaixo para atualizar este cadastro.
            </div>
          </div>

          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 600 }}>Código Atual:</span>
            <span style={{ fontSize: '14.5px', color: '#0F172A', fontWeight: 700, letterSpacing: '0.3px' }}>
              {materialModal?.codigo}
            </span>
          </div>

          <div className="modal-form-group" style={{ margin: 0 }}>
            <label className="modal-label" style={{ fontWeight: 700, color: '#0F172A' }}>
              Novo Código *
            </label>
            <input
              type="text"
              className="modal-input"
              style={{
                height: '42px',
                fontSize: '14.5px',
                fontWeight: 700,
                color: '#017F7B',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                borderColor: '#017F7B',
                background: '#FFFFFF'
              }}
              placeholder="Digite o novo código..."
              value={novoCodigoInput}
              onChange={e => setNovoCodigoInput(e.target.value.toUpperCase())}
              autoFocus
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.target.blur();
                }
              }}
              aria-label="Novo Código"
            />
          </div>
        </form>
      </BottomSheetModal>

      {/* Modal Universal de Cadastro de Novo Material (A Geral do SGE) */}
      <BottomSheetModal
        isOpen={isNovoModalOpen}
        onClose={() => setIsNovoModalOpen(false)}
        title="Cadastrar Novo Material"
        subtitle="Almoxarifado Central"
        footer={
          <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn-modal-cancel"
              onClick={() => setIsNovoModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-novo-material-almox"
              className="btn-modal-confirm"
            >
              Salvar Material
            </button>
          </div>
        }
      >
        <form id="form-novo-material-almox" onSubmit={handleCriarNovoMaterial}>
          <div className="almoxarife-modal__body" style={{ padding: 0 }}>
            <div className="modal-form-group">
              <label className="modal-label">Nome do Material *</label>
              <input
                type="text"
                required
                className="modal-input"
                placeholder="Ex: Resma Papel Sulfite A4"
                value={novoItemForm.nome}
                onChange={e => setNovoItemForm({ ...novoItemForm, nome: e.target.value })}
                enterKeyHint="done"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                  }
                }}
              />
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group flex-1">
                <label className="modal-label">Código / SKU</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="Ex: MAT-011 (auto)"
                  value={novoItemForm.codigo}
                  onChange={e => setNovoItemForm({ ...novoItemForm, codigo: e.target.value })}
                  enterKeyHint="done"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.target.blur();
                    }
                  }}
                />
              </div>

              <div className="modal-form-group flex-1">
                <label className="modal-label">Unidade</label>
                <select
                  className="modal-input"
                  value={novoItemForm.unidade}
                  onChange={e => setNovoItemForm({ ...novoItemForm, unidade: e.target.value })}
                >
                  {LISTA_UNIDADES.map(u => (
                    <option key={u} value={u}>
                      {u === 'UN' ? 'Unidade (UN)' : u === 'CX' ? 'Caixa (CX)' : u === 'Pacote' ? 'Pacote (PCT)' : u}
                    </option>
                  ))}
                </select>
              </div>

              {!isUnidadeIndividual(novoItemForm.unidade) && (
                <div className="modal-form-group flex-1">
                  <label className="modal-label">Itens / Embalagem</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="modal-input"
                    placeholder="Ex: 500"
                    value={novoItemForm.qtdPorCaixa}
                    onChange={e => setNovoItemForm({ ...novoItemForm, qtdPorCaixa: e.target.value.replace(/\D/g, '') })}
                    enterKeyHint="done"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.target.blur();
                      }
                    }}
                  />
                </div>
              )}
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group flex-1">
                <label className="modal-label">Quantidade Inicial</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="modal-input"
                  value={novoItemForm.quantidade}
                  onChange={e => setNovoItemForm({ ...novoItemForm, quantidade: e.target.value.replace(/\D/g, '') })}
                  enterKeyHint="done"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.target.blur();
                    }
                  }}
                />
              </div>

              <div className="modal-form-group flex-1">
                <label className="modal-label">Estoque Mínimo</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="modal-input"
                  value={novoItemForm.estoqueMinimo}
                  onChange={e => setNovoItemForm({ ...novoItemForm, estoqueMinimo: e.target.value.replace(/\D/g, '') })}
                  enterKeyHint="done"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.target.blur();
                    }
                  }}
                />
              </div>
            </div>

            {/* Endereçamento dividido: Complexo (Lista) + Localização Física (Texto Editável) */}
            <div className="modal-form-row">
              <div className="modal-form-group flex-1">
                <label className="modal-label">Complexo *</label>
                <select
                  className="modal-input"
                  value={novoItemForm.complexo}
                  onChange={e => setNovoItemForm({ ...novoItemForm, complexo: e.target.value })}
                >
                  {LISTA_COMPLEXOS.map(comp => (
                    <option key={comp} value={comp}>{comp}</option>
                  ))}
                </select>
              </div>

              <div className="modal-form-group flex-1">
                <label className="modal-label">Localização Física</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="Ex: Prat. 02, Gaveta 04..."
                  value={novoItemForm.localizacao}
                  onChange={e => setNovoItemForm({ ...novoItemForm, localizacao: e.target.value })}
                  enterKeyHint="done"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.target.blur();
                    }
                  }}
                />
              </div>
            </div>

            <div className="modal-form-group">
              <label className="modal-label">Descrição / Especificação</label>
              <input
                type="text"
                className="modal-input"
                placeholder="Detalhes técnicos, marca, formato..."
                value={novoItemForm.descricao}
                onChange={e => setNovoItemForm({ ...novoItemForm, descricao: e.target.value })}
                enterKeyHint="done"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                  }
                }}
              />
            </div>
          </div>
        </form>
      </BottomSheetModal>

      {/* Modal de Entrada em Lote, Compras e Doações (Padrão Ouro do SGE) */}
      <RecebimentoLoteModal
        isOpen={isRecebimentoModalOpen}
        onClose={() => setIsRecebimentoModalOpen(false)}
        materiais={materiais}
        draftRemessa={draftRemessa}
        onUpdateDraft={setDraftRemessa}
        onConfirmar={handleConfirmarRecebimentoLote}
        onDescartar={handleDescartarRascunhoRemessa}
      />
    </div>
  );
};

export default AlmoxarifeEstoque;
