import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SearchFilterBar, FilterDrawer, FilterGroup, FilterChip, SortLoopButton } from '../common';
import './UsuarioEstoque.css';
import { favoritoService } from '../../services/favoritos/favoritoService';
import { corrigirTexto } from '../../utils/text';
import NovoPedidoModal from '../Pedidos/NovoPedidoModal';

// Dados de demonstração realistas para apresentação ao professor
const _MOCK_MATERIAIS_DEMO = [
  {
    id: 1,
    codigo: 'MAT-001',
    nome: 'Papel Sulfite A4',
    categoria: 'Escritório',
    unidade: 'Resma',
    quantidade: 48,
    estoqueMinimo: 10,
    pedidos: 148,
    maisPedido: true,
    descricao: 'Branco • 75g/m² • Formato A4 • Resma c/ 500 folhas',
    localizacao: 'Armário A - Prateleira 2'
  },
  {
    id: 2,
    codigo: 'MAT-002',
    nome: 'Caneta Esferográfica',
    categoria: 'Escritório',
    unidade: 'UN',
    quantidade: 120,
    estoqueMinimo: 30,
    pedidos: 124,
    maisPedido: true,
    descricao: 'Azul • Ponta Média 1.0mm',
    localizacao: 'Gaveteiro 1'
  },
  {
    id: 3,
    codigo: 'MAT-003',
    nome: 'Marcador para Quadro Branco',
    categoria: 'Material Didático',
    unidade: 'UN',
    quantidade: 18,
    estoqueMinimo: 15,
    pedidos: 98,
    maisPedido: true,
    descricao: 'Azul e Preto • Ponta Redonda',
    localizacao: 'Armário Didático B'
  },
  {
    id: 4,
    codigo: 'MAT-004',
    nome: 'Álcool em Gel 70%',
    categoria: 'Limpeza e Higiene',
    unidade: 'Frasco',
    quantidade: 35,
    estoqueMinimo: 8,
    pedidos: 85,
    maisPedido: true,
    descricao: 'Frasco 500ml • Bico dosador',
    localizacao: 'Almoxarifado Central'
  },
  {
    id: 5,
    codigo: 'MAT-005',
    nome: 'Grampeador de Mesa',
    categoria: 'Escritório',
    unidade: 'UN',
    quantidade: 6,
    estoqueMinimo: 5,
    pedidos: 52,
    descricao: 'Modelo Médio • Grampos 26/6 • Até 25 folhas',
    localizacao: 'Prateleira 3'
  },
  {
    id: 6,
    codigo: 'MAT-006',
    nome: 'Fita Adesiva Transparente',
    categoria: 'Escritório',
    unidade: 'Rolo',
    quantidade: 0,
    estoqueMinimo: 10,
    pedidos: 60,
    descricao: 'Larga • 45mm x 50 metros',
    localizacao: 'Caixa de Fitas'
  },
  {
    id: 7,
    codigo: 'MAT-007',
    nome: 'Cabo HDMI 2.0',
    categoria: 'Informática / TI',
    unidade: 'UN',
    quantidade: 8,
    estoqueMinimo: 3,
    pedidos: 22,
    descricao: '2 metros • 4K Alta Velocidade',
    localizacao: 'Armário TI - Gaveta 2'
  },
  {
    id: 8,
    codigo: 'MAT-008',
    nome: 'Apagador para Quadro Branco',
    categoria: 'Material Didático',
    unidade: 'UN',
    quantidade: 0,
    estoqueMinimo: 6,
    pedidos: 45,
    descricao: 'Corpo anatômico • Suporte para 2 marcadores',
    localizacao: 'Armário Didático B'
  },
  {
    id: 9,
    codigo: 'MAT-009',
    nome: 'Giz Escolar Plastificado',
    categoria: 'Material Didático',
    unidade: 'Caixa',
    quantidade: 22,
    estoqueMinimo: 8,
    pedidos: 38,
    descricao: 'Branco • Cx c/ 50 palitos antialérgicos',
    localizacao: 'Prateleira 1'
  },
  {
    id: 10,
    codigo: 'MAT-010',
    nome: 'Papel Toalha Interfolhado',
    categoria: 'Limpeza e Higiene',
    unidade: 'Fardo',
    quantidade: 14,
    estoqueMinimo: 5,
    pedidos: 76,
    maisPedido: true,
    descricao: 'Folha dupla 100% Celulose • Fardo 1000 folhas',
    localizacao: 'Depósito de Limpeza'
  },
  {
    id: 11,
    codigo: 'MAT-011',
    nome: 'Grampos Galvanizados 26/6',
    categoria: 'Escritório',
    unidade: 'Caixa',
    quantidade: 15,
    estoqueMinimo: 5,
    pedidos: 54,
    descricao: 'Caixa c/ 5000 unidades • Modelo 26/6',
    localizacao: 'Prateleira 3'
  },
  {
    id: 12,
    codigo: 'MAT-012',
    nome: 'Mouse Óptico USB',
    categoria: 'Informática / TI',
    unidade: 'UN',
    quantidade: 4,
    estoqueMinimo: 5,
    pedidos: 16,
    descricao: 'Preto • Cabo 1.5m • 1000 DPI',
    localizacao: 'Armário TI - Prateleira 1'
  },
  {
    id: 13,
    codigo: 'MAT-013',
    nome: 'Clipes Metálicos Nº 2/0',
    categoria: 'Escritório',
    unidade: 'Caixa',
    quantidade: 28,
    estoqueMinimo: 10,
    pedidos: 35,
    descricao: 'Niquelados antiferrugem • Caixa c/ 100 un',
    localizacao: 'Gaveteiro 2'
  },
  {
    id: 14,
    codigo: 'MAT-014',
    nome: 'Sabonete Líquido Neutro',
    categoria: 'Limpeza e Higiene',
    unidade: 'Galão',
    quantidade: 3,
    estoqueMinimo: 3,
    pedidos: 29,
    descricao: 'Bombona 5 Litros • Refil',
    localizacao: 'Depósito de Limpeza'
  },
  {
    id: 15,
    codigo: 'MAT-015',
    nome: 'Pilhas Alcalinas AAA (Palito)',
    categoria: 'Informática / TI',
    unidade: 'Cartela',
    quantidade: 0,
    estoqueMinimo: 8,
    pedidos: 19,
    descricao: '1.5V • Cartela c/ 4 unidades',
    localizacao: 'Armário TI - Gaveta 3'
  },
  {
    id: 16,
    codigo: 'MAT-016',
    nome: 'Pasta Suspensa Kraft',
    categoria: 'Escritório',
    unidade: 'UN',
    quantidade: 42,
    estoqueMinimo: 15,
    pedidos: 42,
    descricao: 'Com haste plástica, visor e etiqueta',
    localizacao: 'Arquivo Deslizante 2'
  },
  {
    id: 17,
    codigo: 'MAT-017',
    nome: 'Bloco de Recado Autoadesivo',
    categoria: 'Escritório',
    unidade: 'Bloco',
    quantidade: 19,
    estoqueMinimo: 6,
    pedidos: 40,
    descricao: 'Amarelo • 76x76mm • Bloco c/ 100 folhas',
    localizacao: 'Prateleira 2'
  },
  {
    id: 18,
    codigo: 'MAT-018',
    nome: 'Papel Sulfite A3',
    categoria: 'Escritório',
    unidade: 'Resma',
    quantidade: 2,
    estoqueMinimo: 3,
    pedidos: 25,
    descricao: 'Branco • 75g/m² • Formato A3 • Resma c/ 500 folhas',
    localizacao: 'Armário A - Prateleira 1'
  },
  {
    id: 19,
    codigo: 'MAT-019',
    nome: 'Tesoura Escolar',
    categoria: 'Material Didático',
    unidade: 'UN',
    quantidade: 30,
    estoqueMinimo: 10,
    pedidos: 33,
    descricao: '13cm • Sem ponta (aço inox)',
    localizacao: 'Armário Didático A'
  },
  {
    id: 20,
    codigo: 'MAT-020',
    nome: 'Adaptador USB-C Multiporta',
    categoria: 'Informática / TI',
    unidade: 'UN',
    quantidade: 0,
    estoqueMinimo: 4,
    pedidos: 12,
    descricao: 'Saídas HDMI e VGA',
    localizacao: 'Armário TI - Gaveta 1'
  }
];

const CATEGORIAS = ['Todas', 'Escritório', 'Material Didático', 'Limpeza e Higiene', 'Informática / TI'];

const OPCOES_ORDENACAO = [
  { id: 'alfabetica', label: 'Nome (A - Z)' },
  { id: 'alfabetica-desc', label: 'Nome (Z - A)' },
  { id: 'mais-pedidos', label: 'Mais pedidos' }
];

// Extrai o multiplicador (quantidade de unidades por embalagem) e o nome da unidade base
// Retorna null quando o item é distribuído em unidade individual (sem conversão a exibir)
const getMultiplicador = (material) => {
  if (!material) return null;
  if (material.multiplicador) return material.multiplicador; // suporte a campo explícito

  const combo = ((material.nome || '') + ' ' + (material.descricao || '')).toLowerCase();
  const unid = (material.unidade || '').toLowerCase();

  // 1. Resma: 500 folhas
  if (unid.includes('resma') || combo.includes('resma')) {
    return { fator: 500, unidadeBase: 'folhas' };
  }

  // 2. Líquidos / Volumes
  if (combo.includes('500ml') || combo.includes('500 ml')) {
    return { fator: 500, unidadeBase: 'ml' };
  }
  if (combo.includes('5 litros') || combo.includes('5l')) {
    return { fator: 5, unidadeBase: 'Litros' };
  }

  // 3. Fardo de papel
  if (unid.includes('fardo') || combo.includes('fardo')) {
    const matchFardo = ((material.nome || '') + ' ' + (material.descricao || '')).match(/(\d[\d.,]*)\s*folhas/i);
    const fator = matchFardo ? parseInt(matchFardo[1].replace(/\./g, ''), 10) : 1000;
    return { fator: isNaN(fator) ? 1000 : fator, unidadeBase: 'folhas' };
  }

  // 4. Cartela
  const matchCart = ((material.nome || '') + ' ' + (material.descricao || '')).match(/cartela[^c]*c[/\s]\s*(\d+)/i);
  if (matchCart) {
    const fator = parseInt(matchCart[1], 10);
    if (!isNaN(fator) && fator > 1) {
      const sub = combo.includes('pilha') ? 'pilhas' : 'unidades';
      return { fator, unidadeBase: sub };
    }
  }

  // 5. Caixa ou Cx com quantidade numérica
  const comboText = (material.nome || '') + ' ' + (material.descricao || '');
  const matchCx = comboText.match(/(?:caixa\s*c\/|cx\.?\s*c\/|c\/)\s*(\d[\d.,]*)/i) ||
    comboText.match(/(?:cx\.?\s*)(\d[\d.,]*)/i);
  if (matchCx) {
    const fator = parseInt(matchCx[1].replace(/\./g, '').replace(',', '.'), 10);
    if (!isNaN(fator) && fator > 1) {
      let sub = 'unidades';
      if (combo.includes('grampo')) sub = 'grampos';
      else if (combo.includes('giz') || combo.includes('palito')) sub = 'palitos';
      else if (combo.includes('folha')) sub = 'folhas';
      return { fator, unidadeBase: sub };
    }
  }

  // 6. Bloco
  if (unid.includes('bloco') || combo.includes('bloco')) {
    return { fator: 100, unidadeBase: 'folhas' };
  }

  return null;
};

// Calcula a intensidade de destaque do material proporcional ao seu volume de uso/pedidos
// Retorna um valor de 0 (sem traço) até 1.0 (máxima intensidade visual)
const getIntensidadeUso = (pedidos) => {
  const qtd = Number(pedidos ?? 0);
  const MIN_PEDIDOS = 35; // Itens com menos de 35 pedidos não exibem traço (já sumiram)
  const MAX_PEDIDOS = 148; // Referência de uso máximo no almoxarifado

  if (qtd < MIN_PEDIDOS) return 0;
  const ratio = (qtd - MIN_PEDIDOS) / (MAX_PEDIDOS - MIN_PEDIDOS);
  return Math.min(Math.max(0.25 + ratio * 0.75, 0.25), 1.0);
};

// Normaliza texto removendo acentos gráficos e caracteres especiais para busca instantânea e fluida
const normalizeText = (text) => {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const displayText = (text = '') => corrigirTexto(text)
  .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í')
  .replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú').replace(/Ã§/g, 'ç')
  .replace(/Ã£/g, 'ã').replace(/Ãµ/g, 'õ').replace(/Ãª/g, 'ê')
  .replace(/Ã´/g, 'ô').replace(/Ã/g, 'Á').replace(/Ã/g, '');

const UsuarioEstoque = ({
  materiais = [],
  pedidos = [],
  user,
  onSolicitarMaterial,
  onNavigateToPedidos,
  autoFocusBuscaTrigger
}) => {
  // Se não vier dados de materiais via props, carrega os dados de demonstração
  const dados = materiais || [];

  // Referência para o campo de pesquisa (para foco automático ao clicar no botão '+')
  const searchInputRef = useRef(null);

  // Filtros de busca
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('Todas');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [apenasFavoritos, setApenasFavoritos] = useState(false);
  const [apenasEsgotados, setApenasEsgotados] = useState(false);

  // Modal de Novo Pedido (com suporte nativo a pedido em lote)
  const [isNovoPedidoModalOpen, setIsNovoPedidoModalOpen] = useState(false);
  const currentUserName = user?.nome || user?.identifier || 'Usuário';
  const initialPedidoData = useMemo(() => ({
    usuario: currentUserName
  }), [currentUserName]);

  // Foco automático e seleção da busca ao ser acionado externamente
  useEffect(() => {
    if (autoFocusBuscaTrigger) {
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select?.();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocusBuscaTrigger]);

  // Lista de IDs favoritados com persistência no localStorage (Padrões iniciais: Papel, Caneta, Álcool)
  const [favoritos, setFavoritos] = useState([]);

  useEffect(() => {
    let active = true;
    favoritoService.listar().then((ids) => {
      if (active) setFavoritos(Array.isArray(ids) ? ids : []);
    }).catch(() => {
      if (active) setFavoritos([]);
    });
    return () => { active = false; };
  }, []);

  // Alterna o status de favorito de um material com persistência
  const handleToggleFavorito = useCallback((id, e) => {
    if (e) {
      e.stopPropagation();
    }
    setFavoritos(prev => {
      const isFav = prev.includes(id);
      const next = isFav ? prev.filter(favId => favId !== id) : [...prev, id];
      favoritoService.alternar(id).then((servidorIds) => {
        setFavoritos(Array.isArray(servidorIds) ? servidorIds : next);
      }).catch(() => setFavoritos(next));
      return next;
    });
  }, []);

  // Contagem dinâmica de materiais por categoria para os badges de filtro (Padrão Almoxarife)
  const metricasCategorias = useMemo(() => {
    const counts = { Todas: dados.length };
    CATEGORIAS.forEach(cat => {
      if (cat !== 'Todas') {
        counts[cat] = dados.filter(item => item.categoria === cat).length;
      }
    });
    return counts;
  }, [dados]);

  // Contagem de itens sem estoque (esgotados)
  const contagemEsgotados = useMemo(() => {
    return dados.filter(item => Number(item.quantidade ?? 0) <= 0).length;
  }, [dados]);

  // Contagem de pedidos do próprio usuário por material para ordenação inteligente
  const contagemPedidosUsuario = useMemo(() => {
    const counts = {};
    if (Array.isArray(pedidos)) {
      pedidos.forEach(p => {
        const itens = Array.isArray(p.itens) && p.itens.length > 0
          ? p.itens
          : Array.isArray(p.materiais) && p.materiais.length > 0
            ? p.materiais
            : [{ materialNome: p.material, produtoId: p.produtoId }];

        itens.forEach(it => {
          const nomeNorm = normalizeText(it.materialNome || it.nome || '');
          const mat = dados.find(m => (it.produtoId && m.id === it.produtoId) || normalizeText(m.nome) === nomeNorm);
          if (mat) {
            counts[mat.id] = (counts[mat.id] || 0) + (Number(it.quantidade) || 1);
          }
        });
      });
    }
    return counts;
  }, [pedidos, dados]);

  // Ordenação inteligente (Padrão: 'alfabetica')
  const [ordenacao, setOrdenacao] = useState(() => {
    try {
      const saved = localStorage.getItem('sge_estoque_ordenacao');
      if (saved === 'alfabetica' || saved === 'mais-pedidos') {
        return saved;
      }
      localStorage.setItem('sge_estoque_ordenacao', 'alfabetica');
      return 'alfabetica';
    } catch {
      return 'alfabetica';
    }
  });

  // Alterna para o próximo modo de ordenação em loop ao clicar
  const handleCiclarOrdenacao = () => {
    const currentIndex = OPCOES_ORDENACAO.findIndex(op => op.id === ordenacao);
    const nextIndex = (currentIndex + 1) % OPCOES_ORDENACAO.length;
    const proxima = OPCOES_ORDENACAO[nextIndex].id;
    setOrdenacao(proxima);
    try {
      localStorage.setItem('sge_estoque_ordenacao', proxima);
    } catch {
      // Ignora erro caso o storage esteja inacessível
    }
  };

  const ordenacaoAtual = useMemo(() => {
    return OPCOES_ORDENACAO.find(op => op.id === ordenacao) || OPCOES_ORDENACAO[0];
  }, [ordenacao]);

  // Itens Recentes extraídos do histórico de pedidos do usuário com fallback para os itens mais demandados
  const itensRecentes = useMemo(() => {
    const mapRecentes = new Map();

    // 1. Extrai materiais dos pedidos realizados pelo usuário (do mais recente para o mais antigo)
    if (Array.isArray(pedidos) && pedidos.length > 0) {
      pedidos.forEach(pedido => {
        const itensPedido = Array.isArray(pedido.itens) && pedido.itens.length > 0
          ? pedido.itens
          : Array.isArray(pedido.materiais) && pedido.materiais.length > 0
            ? pedido.materiais
            : [{ materialNome: pedido.material, produtoId: pedido.produtoId }];

        itensPedido.forEach(it => {
          const nomeBusca = normalizeText(it.materialNome || it.nome || '');
          const match = dados.find(m =>
            (it.produtoId && m.id === it.produtoId) ||
            normalizeText(m.nome) === nomeBusca ||
            (nomeBusca && normalizeText(m.nome).includes(nomeBusca)) ||
            (nomeBusca && nomeBusca.includes(normalizeText(m.nome)))
          );

          if (match && !mapRecentes.has(match.id)) {
            mapRecentes.set(match.id, match);
          }
        });
      });
    }

    // 2. Fallback inteligente para materiais mais pedidos caso haja poucos recentes
    if (mapRecentes.size < 5) {
      const maisDemandados = [...dados]
        .filter(m => !mapRecentes.has(m.id))
        .sort((a, b) => (b.pedidos || 0) - (a.pedidos || 0));

      for (const item of maisDemandados) {
        mapRecentes.set(item.id, item);
        if (mapRecentes.size >= 8) break;
      }
    }

    return Array.from(mapRecentes.values()).slice(0, 8);
  }, [pedidos, dados]);

  // Estado do modal de solicitação (material clicado na tabela)
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState(1);
  const [justificativa, setJustificativa] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [erroQtd, setErroQtd] = useState('');

  // Toast de feedback
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimeoutRef = useRef(null);

  // Lista filtrada e ordenada com base na busca instantânea, favoritos, esgotados e ordenação
  const materiaisFiltrados = useMemo(() => {
    const searchNormalized = normalizeText(searchTerm.trim());
    const isPesquisando = Boolean(searchNormalized);

    const filtrados = dados.filter(item => {
      const isSemEstoque = Number(item.quantidade ?? 0) <= 0;

      // Se o filtro de itens esgotados estiver ativo, foca exclusivamente nos materiais sem estoque
      if (apenasEsgotados) {
        if (!isSemEstoque) return false;
      } else {
        // Se NÃO estiver no filtro de esgotados e NÃO estiver pesquisando, oculta os sem estoque
        if (isSemEstoque && !isPesquisando) {
          return false;
        }
      }

      const matchSearch =
        !searchNormalized ||
        normalizeText(item.nome).includes(searchNormalized) ||
        normalizeText(item.codigo).includes(searchNormalized) ||
        normalizeText(item.descricao).includes(searchNormalized) ||
        normalizeText(item.categoria).includes(searchNormalized);

      const matchCat = selectedCategoria === 'Todas' || item.categoria === selectedCategoria;
      const matchFav = !apenasFavoritos || favoritos.includes(item.id);

      return matchSearch && matchCat && matchFav;
    });

    return [...filtrados].sort((a, b) => {
      if (ordenacao === 'mais-pedidos') {
        const pedUserA = Number(contagemPedidosUsuario[a.id] ?? 0);
        const pedUserB = Number(contagemPedidosUsuario[b.id] ?? 0);
        if (pedUserB !== pedUserA) return pedUserB - pedUserA;

        const pedA = Number(a.pedidos ?? 0);
        const pedB = Number(b.pedidos ?? 0);
        if (pedB !== pedA) return pedB - pedA;

        return a.nome.localeCompare(b.nome, 'pt-BR');
      }
      if (ordenacao === 'alfabetica') {
        return a.nome.localeCompare(b.nome, 'pt-BR');
      }
      if (ordenacao === 'alfabetica-desc') {
        return b.nome.localeCompare(a.nome, 'pt-BR');
      }
      return 0;
    });
  }, [dados, searchTerm, selectedCategoria, ordenacao, apenasFavoritos, favoritos, apenasEsgotados, contagemPedidosUsuario]);

  // Paginação com Scroll Infinito Automático
  const ITEMS_POR_PAGINA = 10;
  const [limiteExibicao, setLimiteExibicao] = useState(ITEMS_POR_PAGINA);
  const sentinelRef = useRef(null);

  // Reseta a paginação automaticamente ao pesquisar, alternar categoria, mudar ordenação ou filtros
  useEffect(() => {
    setLimiteExibicao(ITEMS_POR_PAGINA);
  }, [searchTerm, selectedCategoria, ordenacao, apenasFavoritos, apenasEsgotados]);

  // Lista fatiada para a tela
  const materiaisExibidos = useMemo(() => {
    return materiaisFiltrados.slice(0, limiteExibicao);
  }, [materiaisFiltrados, limiteExibicao]);

  const temMaisItens = limiteExibicao < materiaisFiltrados.length;

  // Carrega automaticamente o próximo lote ao se aproximar do fim da lista
  useEffect(() => {
    if (!temMaisItens) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          setLimiteExibicao(prev => prev + ITEMS_POR_PAGINA);
        }
      },
      {
        rootMargin: '200px', // Antecipa o carregamento antes de atingir o fim da tela
        threshold: 0.05
      }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [temMaisItens, limiteExibicao]);

  // Ao clicar em uma linha/material da tabela
  const handleItemClick = (material) => {
    if (isClosingRef.current) return;
    setItemSelecionado(material);
    setQuantidade(1);
    setJustificativa('');
    setUrgente(false);
    setErroQtd('');
  };

  // Referências para arrastar e fechar (Swipe down to dismiss)
  const sheetRef = useRef(null);
  const backdropRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const startTimeRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const isClosingRef = useRef(false);
  const closeTimerRef = useRef(null);

  // Limpa o timer de fechamento ao desmontar o componente
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // Reseta referências e estilos inline ao abrir novo material
  useEffect(() => {
    if (itemSelecionado) {
      isClosingRef.current = false;
      isDraggingRef.current = false;
      hasDraggedRef.current = false;
      if (sheetRef.current) {
        sheetRef.current.style.display = '';
        sheetRef.current.style.opacity = '';
        sheetRef.current.style.transform = '';
        sheetRef.current.style.transition = '';
      }
      if (backdropRef.current) {
        backdropRef.current.style.display = '';
        backdropRef.current.style.opacity = '';
        backdropRef.current.style.transition = '';
      }
    }
  }, [itemSelecionado]);

  // Fechamento padrão do modal com animação simétrica de Zoom Out
  const handleCloseModal = useCallback(() => {
    if (isClosingRef.current) return;
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    if (sheetRef.current) {
      sheetRef.current.style.transition = '';
      sheetRef.current.style.transform = '';
      sheetRef.current.style.transformOrigin = 'center center';
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = '';
      backdropRef.current.style.opacity = '';
    }
    setItemSelecionado(null);
  }, []);

  // Atalho de acessibilidade: tecla Escape para fechar
  useEffect(() => {
    if (!itemSelecionado) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [itemSelecionado, handleCloseModal]);

  const onDragStart = (clientY) => {
    if (isClosingRef.current) return;
    isDraggingRef.current = true;
    startYRef.current = clientY;
    currentYRef.current = clientY;
    startTimeRef.current = Date.now();
    hasDraggedRef.current = false;
  };

  const onDragMove = (clientY) => {
    if (!isDraggingRef.current || isClosingRef.current) return;
    currentYRef.current = clientY;
    const deltaY = clientY - startYRef.current;

    // Aumentada a tolerância para 12px para evitar que micro-vibrações do toque anulem cliques
    if (Math.abs(deltaY) > 12) {
      hasDraggedRef.current = true;
    }

    if (!sheetRef.current) return;

    if (deltaY > 0) {
      // Arrastando para baixo: acompanha diretamente o dedo em tempo real
      sheetRef.current.style.transformOrigin = 'bottom center';
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;

      if (backdropRef.current) {
        backdropRef.current.style.transition = 'none';
        const opacity = Math.max(0, 1 - (deltaY / 320));
        backdropRef.current.style.opacity = `${opacity}`;
      }
    } else {
      // Puxando para cima: BASE FIXA NO CHÃO + ESTIRAMENTO ELÁSTICO (Opção 2)
      sheetRef.current.style.transformOrigin = 'bottom center';
      sheetRef.current.style.transition = 'none';
      const pullUp = Math.abs(deltaY);
      // Resistência elástica progressiva suave (máximo 6% de estiramento vertical)
      const stretch = Math.min(Math.pow(pullUp, 0.6) * 0.005, 0.06);
      sheetRef.current.style.transform = `scaleY(${1 + stretch})`;
    }
  };

  const onDragEnd = () => {
    if (!isDraggingRef.current || isClosingRef.current) return;
    isDraggingRef.current = false;

    const deltaY = currentYRef.current - startYRef.current;
    const elapsedTime = Math.max(Date.now() - startTimeRef.current, 1);
    const velocityY = deltaY / elapsedTime;

    // Se arrastou mais de 70px para baixo ou deu um puxão rápido (> 0.35 px/ms)
    // CORREÇÃO DO SNAP-BACK GLITCH:
    // Em vez de zerar o transform inline (que teletransportava a folha de volta para o topo antes do exit),
    // anima suavemente o trajeto restante para baixo (translateY(100%)) com fade do backdrop.
    if (deltaY > 70 || (deltaY > 25 && velocityY > 0.35)) {
      isClosingRef.current = true;
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      if (sheetRef.current) {
        sheetRef.current.style.transformOrigin = 'bottom center';
        sheetRef.current.style.transition = 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease';
        sheetRef.current.style.transform = 'translateY(100%)';
        sheetRef.current.style.opacity = '0';
      }
      if (backdropRef.current) {
        backdropRef.current.style.transition = 'opacity 0.2s ease';
        backdropRef.current.style.opacity = '0';
      }

      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        if (sheetRef.current) {
          sheetRef.current.style.display = 'none';
        }
        if (backdropRef.current) {
          backdropRef.current.style.display = 'none';
        }
        setItemSelecionado(null);
        isClosingRef.current = false;
      }, 220);
    } else {
      // Retorna com efeito de mola elástica suave
      if (sheetRef.current) {
        sheetRef.current.style.transformOrigin = 'bottom center';
        sheetRef.current.style.transition = 'transform 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.15)';
        sheetRef.current.style.transform = 'translateY(0) scaleY(1)';
      }
      if (backdropRef.current) {
        backdropRef.current.style.transition = 'opacity 0.2s ease';
        backdropRef.current.style.opacity = '1';
      }
    }
  };

  // Suporte a Touch Events (Mobile Touchscreen)
  const handleTouchStart = (e) => {
    if (isClosingRef.current) return;
    if (e.touches && e.touches.length === 1) {
      onDragStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (isClosingRef.current) return;
    if (e.touches && e.touches.length === 1) {
      if (e.cancelable) {
        e.preventDefault(); // Impede o navegador de rolar a página em background durante o arrasto
      }
      onDragMove(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = (e) => {
    if (hasDraggedRef.current && e && e.cancelable) {
      e.preventDefault(); // Suprime clique fantasma residual do touch
    }
    onDragEnd();
  };

  // Suporte a Pointer / Mouse Events (Desktop devtools / mouse)
  const handlePointerDown = (e) => {
    if (isClosingRef.current) return;
    if (e.pointerType === 'touch') return;
    if (e.button !== undefined && e.button !== 0) return;
    onDragStart(e.clientY);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e) => {
    if (isClosingRef.current) return;
    if (e.pointerType === 'touch') return;
    onDragMove(e.clientY);
  };

  const handlePointerUp = (e) => {
    if (e.pointerType === 'touch') return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    onDragEnd();
  };

  const handleHandleClick = (e) => {
    if (e) e.stopPropagation();
    if (!hasDraggedRef.current && !isClosingRef.current) {
      handleCloseModal();
    }
  };

  const handleIncrement = () => {
    setQuantidade(prev => (typeof prev === 'number' ? prev + 1 : 2));
    setErroQtd('');
  };

  const handleDecrement = () => {
    setQuantidade(prev => (typeof prev === 'number' && prev > 1 ? prev - 1 : 1));
    setErroQtd('');
  };

  const handleQuantityChange = (e) => {
    const text = e.target.value.replace(/\D/g, '');
    if (text === '') {
      setQuantidade('');
      setErroQtd('Informe a quantidade desejada.');
      return;
    }
    const val = parseInt(text, 10);
    if (isNaN(val) || val < 1) {
      setQuantidade('');
      setErroQtd('A quantidade deve ser no mínimo 1.');
    } else {
      setQuantidade(val);
      setErroQtd('');
    }
  };

  const handleQuantityBlur = () => {
    if (quantidade === '' || quantidade < 1) {
      setQuantidade(1);
      setErroQtd('');
    }
  };

  const handleSubmitPedido = async (e) => {
    e.preventDefault();
    if (!itemSelecionado) return;

    const qtdFinal = typeof quantidade === 'number' && quantidade >= 1 ? quantidade : 1;
    if (quantidade === '' || quantidade < 1) {
      setQuantidade(1);
    }

    let pedidoCriado = null;
    if (onSolicitarMaterial) {
      pedidoCriado = await onSolicitarMaterial({
        produtoId: itemSelecionado.id,
        material: itemSelecionado.nome,
        quantidade: qtdFinal,
        unidade: itemSelecionado.unidade || 'UN',
        justificativa: justificativa.trim() || 'Solicitação via catálogo de materiais',
        urgente,
        materialCodigo: itemSelecionado.codigo,
        semEstoqueImediato: itemSelecionado.quantidade === 0
      });
    }

    const pedidoId = pedidoCriado?.id || Math.floor(Math.random() * 900) + 100;

    // Exibe notificação de confirmação visual informando o número do pedido gerado
    setToastMessage({
      id: pedidoId,
      titulo: `Pedido #${pedidoId} gerado com sucesso!`,
      detalhe: `${qtdFinal} ${itemSelecionado.unidade || 'UN'} de "${itemSelecionado.nome}"`,
      tipo: itemSelecionado.quantidade === 0 ? 'aviso-reposicao' : 'sucesso',
      urgente: urgente
    });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 5500);

    handleCloseModal();
  };

  // Salva pedido criado via NovoPedidoModal (suporte a pedido em lote com múltiplos itens)
  const handleSalvarNovoPedido = async (dadosPedido) => {
    let pedidoCriado = null;
    if (onSolicitarMaterial) {
      pedidoCriado = await onSolicitarMaterial(dadosPedido);
    }

    const pedidoId = pedidoCriado?.id || Math.floor(Math.random() * 900) + 100;
    const totalItens = dadosPedido?.itens?.length || 1;
    const resumo = totalItens === 1
      ? `${dadosPedido.itens?.[0]?.quantidade || 1} ${dadosPedido.itens?.[0]?.unidade || 'UN'} de "${dadosPedido.itens?.[0]?.materialNome || 'Material'}"`
      : `${totalItens} materiais solicitados em lote`;

    setToastMessage({
      id: pedidoId,
      titulo: `Pedido #${pedidoId} gerado com sucesso!`,
      detalhe: resumo,
      tipo: 'sucesso',
      urgente: dadosPedido.prioridade === 'Urgente'
    });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 5500);

    setIsNovoPedidoModalOpen(false);
  };

  return (
    <div className="usuario-estoque">
      {/* Toast flutuante de feedback animado com Motion */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key="usuario-feedback-toast"
            className={`usuario-toast ${toastMessage.tipo === 'aviso-reposicao' ? 'usuario-toast--aviso' : 'usuario-toast--sucesso'}`}
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
          >
            <div className="usuario-toast__icon">
              {toastMessage.tipo === 'aviso-reposicao' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
            <div className="usuario-toast__content">
              <div className="usuario-toast__header">
                <span className="usuario-toast__title">{toastMessage.titulo}</span>
                {toastMessage.urgente && (
                  <span className="usuario-toast__urgente-tag">Urgente</span>
                )}
              </div>
              <p className="usuario-toast__desc">{toastMessage.detalhe}</p>
              {onNavigateToPedidos && (
                <button
                  type="button"
                  className="usuario-toast__btn"
                  onClick={() => {
                    setToastMessage(null);
                    onNavigateToPedidos();
                  }}
                >
                  Acompanhar em Meus Pedidos &rarr;
                </button>
              )}
            </div>
            <button
              type="button"
              className="usuario-toast__close"
              onClick={() => setToastMessage(null)}
              aria-label="Fechar notificação"
            >
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seção Superior Unificada (Busca + Botão Novo Pedido + Sanfona de Categorias - A Geral do SGE) */}
      <div className="usuario-estoque__top-section">
        <div className="usuario-estoque__action-bar">
          <div className="usuario-estoque__search-wrap">
            <SearchFilterBar
              inputRef={searchInputRef}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onClear={() => setSearchTerm('')}
              placeholder="Buscar material..."
              hasActiveFilter={selectedCategoria !== 'Todas' || apenasFavoritos || apenasEsgotados}
              isFilterOpen={mostrarFiltros}
              onToggleFilter={() => setMostrarFiltros(prev => !prev)}
            />
          </div>
          <button
            type="button"
            id="btn-usuario-novo-pedido"
            className="usuario-btn-novo-pedido"
            onClick={() => setIsNovoPedidoModalOpen(true)}
            title="Novo Pedido (incluindo pedido em lote de múltiplos materiais)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="usuario-btn-novo-pedido__label">Novo Pedido</span>
          </button>
        </div>

        <FilterDrawer isOpen={mostrarFiltros}>
          <FilterGroup title="Acesso Rápido">
            <FilterChip
              label="Meus Favoritos"
              count={favoritos.length}
              isActive={apenasFavoritos}
              onClick={() => {
                setApenasFavoritos(prev => {
                  const next = !prev;
                  if (next) setApenasEsgotados(false);
                  return next;
                });
              }}
            />
            <FilterChip
              label="Itens Esgotados"
              count={contagemEsgotados}
              isActive={apenasEsgotados}
              onClick={() => {
                setApenasEsgotados(prev => {
                  const next = !prev;
                  if (next) {
                    setApenasFavoritos(false);
                    setSelectedCategoria('Todas');
                  }
                  return next;
                });
              }}
            />
          </FilterGroup>

          <FilterGroup title="Categorias">
            {CATEGORIAS.map(cat => (
              <FilterChip
                key={cat}
                label={cat}
                count={metricasCategorias[cat] ?? 0}
                isActive={selectedCategoria === cat && !apenasFavoritos}
                onClick={() => {
                  setSelectedCategoria(cat);
                  setApenasFavoritos(false);
                }}
              />
            ))}
          </FilterGroup>
        </FilterDrawer>
      </div>

      {/* Menu / Carrossel de Itens Recentes (Sessão Início) */}
      {itensRecentes.length > 0 && !searchTerm.trim() && (
        <section className="usuario-recentes-section" aria-label="Itens recentes do usuário">
          <div className="usuario-recentes-header">
            <div className="usuario-recentes-title-wrap">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="usuario-recentes-icon"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <h3 className="usuario-recentes-title">Itens Recentes</h3>
            </div>
            <span className="usuario-recentes-hint">Toque para solicitar</span>
          </div>

          <div className="usuario-recentes-scroll" tabIndex={0} role="region" aria-label="Carrossel de itens recentes">
            {itensRecentes.map(item => {
              const semEstoque = item.quantidade === 0;
              const estoqueBaixo = item.quantidade > 0 && item.quantidade <= (item.estoqueMinimo || 5);
              return (
                <button
                  key={`recente-${item.id}`}
                  type="button"
                  className={`usuario-recente-card ${semEstoque ? 'usuario-recente-card--sem-estoque' : ''}`}
                  onClick={() => handleItemClick(item)}
                  title={`Solicitar ${item.nome}`}
                >
                  <div className="usuario-recente-card__icon-wrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                  </div>
                  <div className="usuario-recente-card__info">
                    <span className="usuario-recente-card__nome">{item.nome}</span>
                    <span className={`usuario-recente-card__saldo ${semEstoque ? 'usuario-recente-card__saldo--esgotado' : estoqueBaixo ? 'usuario-recente-card__saldo--baixo' : ''}`}>
                      {semEstoque ? 'Sem estoque' : `${item.quantidade} ${item.unidade || 'UN'}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Contador de resultados, Atalho Rápido de Favoritos e Seletor de Ordenação Inteligente */}
      <div className="sge-meta-bar">
        <div className="sge-meta-left">
          <span className="sge-meta-count">
            {materiaisFiltrados.length === 1
              ? '1 material'
              : `${materiaisFiltrados.length} materiais`}
          </span>

          <button
            type="button"
            className={`sge-fav-filter-chip ${apenasFavoritos ? 'sge-fav-filter-chip--active' : ''}`}
            onClick={() => {
              setApenasFavoritos(prev => {
                const next = !prev;
                if (next) setApenasEsgotados(false);
                return next;
              });
            }}
            title={apenasFavoritos ? "Mostrar todos os materiais" : "Ver apenas meus favoritos"}
            aria-pressed={apenasFavoritos}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill={apenasFavoritos ? "#F59E0B" : "none"}
              stroke={apenasFavoritos ? "#D97706" : "currentColor"}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span>Favoritos</span>
            <span className="sge-fav-count-pill">{favoritos.length}</span>
          </button>

          <button
            type="button"
            className={`sge-fav-filter-chip sge-esgotados-chip ${apenasEsgotados ? 'sge-esgotados-chip--active' : ''}`}
            onClick={() => {
              setApenasEsgotados(prev => {
                const next = !prev;
                if (next) {
                  setApenasFavoritos(false);
                  setSelectedCategoria('Todas');
                }
                return next;
              });
            }}
            title={apenasEsgotados ? "Mostrar materiais disponíveis" : "Filtrar apenas itens esgotados"}
            aria-pressed={apenasEsgotados}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            <span>Esgotados</span>
            <span className="sge-fav-count-pill sge-esgotados-count-pill">{contagemEsgotados}</span>
          </button>
        </div>

        <SortLoopButton
          currentLabel={ordenacaoAtual.label}
          onToggleSort={handleCiclarOrdenacao}
        />
      </div>

      {/* Tabela Interativa de Materiais (Otimizada para Mobile / Celular) */}
      <div className="usuario-estoque__table-card">
        {materiaisFiltrados.length === 0 ? (
          <div className="usuario-estoque__empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill={apenasFavoritos ? "rgba(245, 158, 11, 0.2)" : "none"} stroke={apenasFavoritos ? "#D97706" : apenasEsgotados ? "#DC2626" : "currentColor"} strokeWidth="1.5">
              {apenasFavoritos ? (
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              ) : apenasEsgotados ? (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </>
              ) : (
                <>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </>
              )}
            </svg>
            <p className="usuario-estoque__empty-title">
              {apenasFavoritos
                ? 'Nenhum material favorito encontrado'
                : apenasEsgotados
                ? 'Nenhum material esgotado no momento'
                : 'Nenhum material encontrado'}
            </p>
            <p className="usuario-estoque__empty-sub">
              {apenasFavoritos
                ? 'Clique no ícone de favorito de qualquer material para fixá-lo como favorito para acesso rápido.'
                : apenasEsgotados
                ? 'Todos os materiais catalogados possuem saldo disponível em estoque.'
                : 'Tente buscar por outro termo ou selecione "Todas" as categorias.'}
            </p>
            {(apenasFavoritos || apenasEsgotados) && (
              <button
                type="button"
                className="btn-limpar-fav-filtro"
                onClick={() => {
                  setApenasFavoritos(false);
                  setApenasEsgotados(false);
                }}
              >
                Ver todos os materiais
              </button>
            )}
          </div>
        ) : (
          <div className="usuario-ticket-list">
            {materiaisExibidos.map((item) => {
              const semEstoque = item.quantidade === 0;
              const estoqueBaixo = item.quantidade > 0 && item.quantidade <= (item.estoqueMinimo || 5);
              const intensidadeUso = getIntensidadeUso(item.pedidos);
              const isFavorito = favoritos.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`usuario-ticket ${semEstoque ? 'usuario-ticket--sem-estoque' : estoqueBaixo ? 'usuario-ticket--baixo' : ''} ${isFavorito ? 'usuario-ticket--favorito' : ''}`}
                  onClick={() => handleItemClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleItemClick(item);
                    }
                  }}
                >
                  {/* Bloco Esquerdo do Ticket: Saldo e Unidade (Indicador Visual) */}
                  <div className="ticket-left">
                    <span className="ticket-qtd">{item.quantidade}</span>
                    <span className="ticket-unidade">{semEstoque ? 'esgotado' : item.unidade}</span>
                  </div>

                  {/* Corpo do Ticket: Informações */}
                  <div className="ticket-body">
                    <div className="ticket-info">
                    <span className="ticket-nome" title={displayText(item.nome)}>{displayText(item.nome)}</span>
                      {item.descricao && (
                        <span className="ticket-desc" title={displayText(item.descricao)}>
                          {displayText(item.descricao)}
                        </span>
                      )}
                    </div>

                    {/* Botão de favorito */}
                    <button
                      type="button"
                      className={`ticket-fav-btn ${isFavorito ? 'ticket-fav-btn--active' : ''}`}
                      onClick={(e) => handleToggleFavorito(item.id, e)}
                      aria-label={isFavorito ? `Remover ${item.nome} dos favoritos` : `Favoritar ${item.nome}`}
                      title={isFavorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill={isFavorito ? "#F59E0B" : "none"}
                        stroke={isFavorito ? "#D97706" : "currentColor"}
                        strokeWidth="2.1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>

                    {/* Seta indicativa de toque */}
                    <div className="ticket-arrow">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>

                    {/* Mini-traço verde que desvanece gradualmente conforme o volume de uso */}
                    {intensidadeUso > 0 && (
                      <span
                        className="ticket-destaque-pill"
                        style={{ opacity: intensidadeUso }}
                        title={`Item frequente • ${item.pedidos || 0} solicitações registradas`}
                        aria-label="Indicador de frequência de uso"
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Scroll Infinito Automático (Sentinela invisível para carregar novos itens) */}
            {temMaisItens && (
              <div ref={sentinelRef} className="usuario-estoque__sentinel" aria-hidden="true" />
            )}

            {/* Indicador discreto de fim da lista (exibido no final de toda lista de materiais) */}
            {!temMaisItens && materiaisFiltrados.length > 0 && (
              <div className="usuario-estoque__all-loaded">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Fim dos materiais ({materiaisFiltrados.length} {materiaisFiltrados.length === 1 ? 'item' : 'itens'})</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal / Bottom Sheet de Solicitação de Pedido com Motion */}
      <AnimatePresence>
        {itemSelecionado && (
          <motion.div
            key="modal-solicitacao-backdrop"
            ref={backdropRef}
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18, ease: "easeOut" } }}
            exit={{ opacity: 0, transition: { duration: 0.16, ease: "easeOut" } }}
            onClick={handleCloseModal}
          >
            <motion.div
              key="modal-solicitacao-sheet"
              ref={sheetRef}
              className="pedido-sheet"
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1, transition: { type: "spring", damping: 28, stiffness: 380 } }}
              exit={{ opacity: 0, scale: 0.93, transition: { duration: 0.16, ease: "easeOut" } }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {/* Puxador interativo para mobile (centralizado, toque ou arraste para fechar) */}
              <div
                className="sheet-handle-wrap"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={handleHandleClick}
                role="button"
                tabIndex={0}
                aria-label="Arrastar para baixo para fechar"
                title="Arraste para baixo para fechar"
              >
                <div className="sheet-handle" />
              </div>

              {/* Cabeçalho do Modal (com suporte a toque/arrasto ergonômico) */}
              <div
                className="pedido-sheet__header"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
              >
                <div className="pedido-sheet__header-title">
                  <div className="sheet-subtitle-row">
                    <span className="sheet-subtitle">Solicitar ao Almoxarifado</span>
                    {urgente && (
                      <span className="sheet-badge-urgente">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        Urgência Ativada
                      </span>
                    )}
                  </div>
                  <h3 className="sheet-material-nome">{itemSelecionado.nome}</h3>
                  {itemSelecionado.descricao && (
                    <p className="sheet-material-desc">{itemSelecionado.descricao}</p>
                  )}
                </div>
              </div>

              {/* Formulário de Pedido */}
              <form onSubmit={handleSubmitPedido} className="pedido-sheet__form">
                {/* Alerta caso o item esteja sem estoque imediato */}
                {itemSelecionado.quantidade === 0 && (
                  <div className="sheet-alert sheet-alert--sem-estoque">
                    <div className="sheet-alert__icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </div>
                    <div className="sheet-alert__content">
                      <strong>Demanda para Reposição</strong>
                      <p>O item está sem saldo imediato e será registrado para o Almoxarifado providenciar.</p>
                    </div>
                  </div>
                )}

                {/* Layout dividido simétrico: Estoque (esq) ╎ Seletor (dir) */}
                <div className={`qty-split-row ${itemSelecionado.quantidade === 0 ? 'qty-split-row--sem-estoque' : ''}`}>
                  {/* Coluna esquerda: Saldo no Almoxarifado */}
                  <div className="qty-split-left">
                    <span className="qty-split-label">No almoxarifado</span>
                    {itemSelecionado.quantidade > 0 ? (
                      <div className="qty-saldo-block">
                        <span className={`qty-saldo-line ${itemSelecionado.quantidade <= (itemSelecionado.estoqueMinimo || 5) ? 'qty-saldo-line--baixo' : ''}`}>
                          <strong>{itemSelecionado.quantidade}</strong> {itemSelecionado.unidade || 'UN'}
                        </span>
                      </div>
                    ) : (
                      <div className="qty-saldo-block">
                        <span className="qty-saldo-esgotado">Esgotado</span>
                      </div>
                    )}
                  </div>

                  {/* Divisória vertical */}
                  <div className="qty-split-divider" aria-hidden="true" />

                  {/* Coluna direita: Quantidade a pedir */}
                  <div className="qty-split-right">
                    <label className="qty-split-label" htmlFor="sheet-qtd-input">
                      Quantidade a pedir
                    </label>
                    <div className="stepper-wrap">
                      <motion.button
                        type="button"
                        className="stepper-btn stepper-btn--minus"
                        onClick={handleDecrement}
                        aria-label="Diminuir quantidade"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.86 }}
                        transition={{ type: "spring", stiffness: 450, damping: 18 }}
                      >
                        &minus;
                      </motion.button>
                      <input
                        id="sheet-qtd-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="stepper-input"
                        value={quantidade}
                        onChange={handleQuantityChange}
                        onBlur={handleQuantityBlur}
                        onFocus={(e) => e.target.select()}
                        aria-label="Quantidade"
                      />
                      <motion.button
                        type="button"
                        className="stepper-btn stepper-btn--plus"
                        onClick={handleIncrement}
                        aria-label="Aumentar quantidade"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.86 }}
                        transition={{ type: "spring", stiffness: 450, damping: 18 }}
                      >
                        +
                      </motion.button>
                    </div>
                    {erroQtd && <span className="sheet-error">{erroQtd}</span>}
                  </div>
                </div>

                {/* Linha única de resumo / conversão alinhada abaixo das duas colunas */}
                {(() => {
                  const mult = getMultiplicador(itemSelecionado);
                  const qtd = typeof quantidade === 'number' && quantidade >= 1 ? quantidade : (parseInt(quantidade, 10) || 1);
                  if (!mult) return null;
                  const total = qtd * mult.fator;
                  return (
                    <div className="qty-total-bar">
                      <span className="qty-total-bar__text">
                        Total da solicitação: <strong>{total.toLocaleString('pt-BR')} {mult.unidadeBase}</strong>
                      </span>
                    </div>
                  );
                })()}

                {/* Justificativa / Finalidade */}
                <div className="sheet-form-group">
                  <label className="sheet-label" htmlFor="sheet-justificativa">
                    Justificativa / Finalidade
                  </label>
                  <textarea
                    id="sheet-justificativa"
                    className="sheet-textarea"
                    rows="3"
                    placeholder="Ex: Aulas pedagógicas, reposição do setor..."
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                  />
                </div>

                {/* Switch / Toggle Moderno de Pedido Urgente */}
                <div className={`sheet-switch-group ${urgente ? 'sheet-switch-group--active' : ''}`}>
                  <label className="sheet-switch-label" htmlFor="urgent-switch">
                    <div className="sheet-switch-info">
                      <div className="sheet-switch-title">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        <span>Marcar como Pedido Urgente</span>
                      </div>
                      <span className="sheet-switch-desc">Prioridade na fila de separação do almoxarifado</span>
                    </div>
                    <div className="sheet-toggle-wrap">
                      <input
                        id="urgent-switch"
                        type="checkbox"
                        className="sheet-toggle-input"
                        checked={urgente}
                        onChange={(e) => setUrgente(e.target.checked)}
                      />
                      <span className="sheet-toggle-slider" />
                    </div>
                  </label>
                </div>

                {/* Botões do Rodapé */}
                <div className="sheet-footer">
                  <motion.button
                    type="button"
                    className="sheet-btn sheet-btn--cancel"
                    onClick={handleCloseModal}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    type="submit"
                    className={`sheet-btn sheet-btn--submit ${urgente ? 'sheet-btn--submit-urgente' : ''}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    {urgente ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        Confirmar Pedido Urgente
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Confirmar Pedido
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Pedido em Lote / Novo Pedido */}
      <NovoPedidoModal
        isOpen={isNovoPedidoModalOpen}
        onClose={() => setIsNovoPedidoModalOpen(false)}
        onSave={handleSalvarNovoPedido}
        initialData={initialPedidoData}
        materiaisDisponiveis={dados}
        usuariosDisponiveis={[currentUserName]}
      />
    </div>
  );
};

export default UsuarioEstoque;
