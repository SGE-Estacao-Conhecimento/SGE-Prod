import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SearchFilterBar, FilterDrawer, FilterGroup, FilterChip, SortLoopButton, QuantityStepper, BottomSheetModal } from '../common';
import './UsuarioEstoque.css';
import { favoritoService } from '../../services/favoritos/favoritoService';
import { corrigirTexto } from '../../utils/text';
import CadernetaPedidosModal from './CadernetaPedidosModal';

const OPCOES_ORDENACAO = [
  { id: 'alfabetica', label: 'Nome (A - Z)' },
  { id: 'alfabetica-desc', label: 'Nome (Z - A)' },
  { id: 'mais-pedidos', label: 'Mais pedidos' }
];

// Extrai o multiplicador (quantidade de unidades por embalagem) e o nome da unidade base
// Retorna null quando o item é distribuído em unidade individual (sem conversão a exibir)
const getMultiplicador = (material) => {
  if (!material) return null;

  // 1. Campo estruturado oficial do Almoxarifado (itensPorEmbalagem)
  const itensPorEmb = Number(material.itensPorEmbalagem ?? material.qtdPorCaixa ?? material.multiplicador);
  if (!isNaN(itensPorEmb) && itensPorEmb > 1) {
    const unid = (material.unidade || '').toLowerCase();
    const combo = ((material.nome || '') + ' ' + (material.descricao || '')).toLowerCase();
    const sub = (unid.includes('resma') || combo.includes('resma') || unid.includes('fardo') || combo.includes('fardo'))
      ? 'folhas'
      : 'unidades';
    return { fator: itensPorEmb, unidadeBase: sub };
  }

  const combo = ((material.nome || '') + ' ' + (material.descricao || '')).toLowerCase();
  const unid = (material.unidade || '').toLowerCase();

  // 2. Fallbacks de leitura de texto (para compatibilidade histórica)
  // Resma: 500 folhas
  if (unid.includes('resma') || combo.includes('resma')) {
    return { fator: 500, unidadeBase: 'folhas' };
  }

  // Fardo de papel
  if (unid.includes('fardo') || combo.includes('fardo')) {
    const matchFardo = combo.match(/(\d[\d.,]*)\s*folhas/i);
    const fator = matchFardo ? parseInt(matchFardo[1].replace(/\./g, ''), 10) : 1000;
    return { fator: isNaN(fator) ? 1000 : fator, unidadeBase: 'folhas' };
  }

  // Cartela ou Caixa com quantidade numérica -> unidades
  const matchCx = combo.match(/(?:caixa|cx\.?|cartela)\s*(?:com|c\/)\s*(\d[\d.,]*)/i) ||
    combo.match(/(?:com|c\/)\s*(\d[\d.,]*)\s*(?:unidades?|un|itens?|palitos?|folhas?)/i) ||
    combo.match(/(?:caixa\s*c\/|cx\.?\s*c\/|c\/)\s*(\d[\d.,]*)/i) ||
    combo.match(/(?:cx\.?\s*)(\d[\d.,]*)/i);
  if (matchCx) {
    const fator = parseInt(matchCx[1].replace(/\./g, '').replace(',', '.'), 10);
    if (!isNaN(fator) && fator > 1) {
      return { fator, unidadeBase: 'unidades' };
    }
  }

  return null;
};

// Normaliza texto removendo acentos gráficos e caracteres especiais para busca instantânea e fluida
const normalizeText = (text) => {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const displayText = (text = '') => corrigirTexto(text);

const UsuarioEstoque = ({
  materiais = [],
  pedidos = [],
  user,
  onSolicitarMaterial,
  onNavigateToPedidos,
  }) => {
  // Funcionário comum visualiza apenas materiais de consumo (bens duráveis/patrimônio são restritos à equipe).
  const dados = useMemo(
    () => (materiais || []).filter((item) => !item?.bemDuravel),
    [materiais]
  );

  // Referência para o campo de pesquisa (para foco automático ao clicar no botão '+')
  const searchInputRef = useRef(null);

  // Filtros de busca
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('Todas');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [apenasFavoritos, setApenasFavoritos] = useState(false);


  // Caderneta de Pedidos do Usuário (Persistência no localStorage vinculada à conta do usuário)
  const [isCadernetaOpen, setIsCadernetaOpen] = useState(false);
  const storageKeyCaderneta = useMemo(() => {
    const userKey = user?.matricula || user?.email || user?.id || user?.identifier || 'usuario';
    return `sge_caderneta_${userKey}`;
  }, [user]);

  const [itensCaderneta, setItensCaderneta] = useState(() => {
    try {
      const userKey = user?.matricula || user?.email || user?.id || user?.identifier || 'usuario';
      const saved = localStorage.getItem(`sge_caderneta_${userKey}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sincroniza a caderneta no localStorage sempre que houver alteração
  useEffect(() => {
    try {
      localStorage.setItem(storageKeyCaderneta, JSON.stringify(itensCaderneta));
    } catch (e) {
      console.error('Erro ao sincronizar caderneta no localStorage:', e);
    }
  }, [itensCaderneta, storageKeyCaderneta]);

  // Recarrega os itens da caderneta caso a conta conectada mude
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKeyCaderneta);
      setItensCaderneta(saved ? JSON.parse(saved) : []);
    } catch {
      setItensCaderneta([]);
    }
  }, [storageKeyCaderneta]);

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

  // Alterna o status de favorito de um material com persistência.
  // A chamada fica fora do atualizador de estado: o React (StrictMode) pode executar o
  // atualizador duas vezes, o que alternaria o favorito duas vezes no servidor.
  const handleToggleFavorito = useCallback((id, e) => {
    if (e) {
      e.stopPropagation();
    }
    setFavoritos(prev => (prev.includes(id) ? prev.filter(favId => favId !== id) : [...prev, id]));
    favoritoService.alternar(id).then((servidorIds) => {
      if (Array.isArray(servidorIds)) setFavoritos(servidorIds);
    }).catch(() => {
      // Falhou no servidor: desfaz a alteração otimista.
      setFavoritos(prev => (prev.includes(id) ? prev.filter(favId => favId !== id) : [...prev, id]));
    });
  }, []);

  // Categorias extraídas dinamicamente a partir dos materiais cadastrados
  const categorias = useMemo(() => {
    const cats = Array.from(new Set(dados.map(m => m.categoria).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return ['Todas', ...cats];
  }, [dados]);

  // Contagem dinâmica de materiais por categoria para os badges de filtro (Padrão Almoxarife)
  const metricasCategorias = useMemo(() => {
    const counts = { Todas: dados.length };
    categorias.forEach(cat => {
      if (cat !== 'Todas') {
        counts[cat] = dados.filter(item => item.categoria === cat).length;
      }
    });
    return counts;
  }, [dados, categorias]);


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

  // Estado do modal de confirmação de quantidade (material clicado no catálogo)
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState(1);
  const [erroQtd, setErroQtd] = useState('');

  // Toast de feedback
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimeoutRef = useRef(null);

  // Lista filtrada e ordenada com base na busca instantânea, favoritos e ordenação
  const materiaisFiltrados = useMemo(() => {
    const searchNormalized = normalizeText(searchTerm.trim());

    const filtrados = dados.filter(item => {
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
  }, [dados, searchTerm, selectedCategoria, ordenacao, apenasFavoritos, favoritos, contagemPedidosUsuario]);

  // Paginação com Scroll Infinito Automático
  const ITEMS_POR_PAGINA = 10;
  const [limiteExibicao, setLimiteExibicao] = useState(ITEMS_POR_PAGINA);
  const sentinelRef = useRef(null);

  // Reseta a paginação automaticamente ao pesquisar, alternar categoria, mudar ordenação ou filtros
  useEffect(() => {
    setLimiteExibicao(ITEMS_POR_PAGINA);
  }, [searchTerm, selectedCategoria, ordenacao, apenasFavoritos]);

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
    setItemSelecionado(material);
    const itemExistente = itensCaderneta.find(i => i.id === material.id);
    setQuantidade(itemExistente ? itemExistente.quantidade : 1);
    setErroQtd('');
  };

  const handleCloseModal = useCallback(() => {
    setItemSelecionado(null);
    setErroQtd('');
  }, []);

  // Adiciona ou atualiza o material na Caderneta de Pedidos
  const handleSalvarItemCaderneta = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!itemSelecionado) return;

    const qtdFinal = typeof quantidade === 'number' && quantidade >= 1 ? quantidade : 1;
    if (quantidade === '' || quantidade < 1) {
      setQuantidade(1);
    }

    const itemJaNaLista = itensCaderneta.some(it => it.id === itemSelecionado.id);

    setItensCaderneta(prev => {
      const idx = prev.findIndex(it => it.id === itemSelecionado.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          quantidade: qtdFinal,
          itensPorEmbalagem: itemSelecionado.itensPorEmbalagem
        };
        return copy;
      }
      return [
        ...prev,
        {
          id: itemSelecionado.id,
          nome: itemSelecionado.nome,
          descricao: itemSelecionado.descricao,
          unidade: itemSelecionado.unidade || 'UN',
          itensPorEmbalagem: itemSelecionado.itensPorEmbalagem,
          quantidade: qtdFinal
        }
      ];
    });

    setToastMessage({
      id: Date.now(),
      titulo: itemJaNaLista ? 'Caderneta atualizada!' : 'Adicionado à caderneta!',
      detalhe: `${qtdFinal} ${itemSelecionado.unidade || 'UN'} de "${itemSelecionado.nome}"`,
      tipo: 'sucesso',
      urgente: false
    });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);

    handleCloseModal();
  };

  // Funções de gerenciamento da caderneta de pedidos
  const handleUpdateQtdCaderneta = useCallback((id, novaQtd) => {
    setItensCaderneta(prev => prev.map(item => item.id === id ? { ...item, quantidade: novaQtd } : item));
  }, []);

  const handleRemoveItemCaderneta = useCallback((id) => {
    setItensCaderneta(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleClearCaderneta = useCallback(() => {
    setItensCaderneta([]);
  }, []);

  const handleSubmitCaderneta = useCallback(async (dadosPedido) => {
    let pedidoCriado = null;
    if (onSolicitarMaterial) {
      pedidoCriado = await onSolicitarMaterial(dadosPedido);
    }

    const pedidoId = pedidoCriado?.id || Math.floor(Math.random() * 900) + 100;
    const totalItens = dadosPedido.itens?.length || 1;
    const resumo = totalItens === 1
      ? `${dadosPedido.itens?.[0]?.quantidade || 1} ${dadosPedido.itens?.[0]?.unidade || 'UN'} de "${dadosPedido.itens?.[0]?.materialNome || 'Material'}"`
      : `${totalItens} materiais solicitados em lote via caderneta`;

    setToastMessage({
      id: pedidoId,
      titulo: `Pedido #${pedidoId} gerado com sucesso!`,
      detalhe: resumo,
      tipo: 'sucesso',
      urgente: dadosPedido.urgente || dadosPedido.prioridade === 'Urgente'
    });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 5500);

    setItensCaderneta([]);
    setIsCadernetaOpen(false);
  }, [onSolicitarMaterial]);

  return (
    <div className="usuario-estoque">
      {/* Toast flutuante de feedback animado com Motion */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key="usuario-feedback-toast"
            className={`sge-toast usuario-toast ${toastMessage.tipo === 'aviso-reposicao' ? 'sge-toast--aviso' : 'sge-toast--sucesso'}`}
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
          >
            <div className="sge-toast__icon usuario-toast__icon">
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
                  Acompanhar em Meus Pedidos
                </button>
              )}
            </div>
            <button
              type="button"
              className="usuario-toast__close"
              onClick={() => setToastMessage(null)}
              aria-label="Fechar notificação"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seção Superior Unificada: Busca + Gatilho de Filtro com Sanfona (A Geral do SGE) */}
      <div className="usuario-estoque__top-section">
        <SearchFilterBar
          inputRef={searchInputRef}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onClear={() => setSearchTerm('')}
          placeholder="Buscar material..."
          hasActiveFilter={selectedCategoria !== 'Todas' || apenasFavoritos}
          isFilterOpen={mostrarFiltros}
          onToggleFilter={() => setMostrarFiltros(prev => !prev)}
        />

        <FilterDrawer isOpen={mostrarFiltros}>
          <FilterGroup title="Acesso Rápido">
            <FilterChip
              label="Meus Favoritos"
              count={favoritos.length}
              isActive={apenasFavoritos}
              onClick={() => {
                setApenasFavoritos(prev => !prev);
              }}
            />
          </FilterGroup>

          <FilterGroup title="Categorias">
            {categorias.map(cat => (
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
              const naCaderneta = itensCaderneta.find(it => it.id === item.id);
              return (
                <button
                  key={`recente-${item.id}`}
                  type="button"
                  className={`usuario-recente-card ${naCaderneta ? 'usuario-recente-card--na-caderneta' : ''}`}
                  onClick={() => handleItemClick(item)}
                  title={naCaderneta ? `${item.nome} (${naCaderneta.quantidade} na caderneta)` : `Adicionar ${item.nome} à caderneta`}
                >
                  <div className="usuario-recente-card__icon-wrap">
                    {naCaderneta ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                      </svg>
                    )}
                  </div>
                  <div className="usuario-recente-card__info">
                    <span className="usuario-recente-card__nome">{item.nome}</span>
                    <span className="usuario-recente-card__unidade">
                      {naCaderneta ? `${naCaderneta.quantidade} na lista` : (item.unidade || 'UN')}
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
              setApenasFavoritos(prev => !prev);
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
        </div>

        <SortLoopButton
          currentLabel={ordenacaoAtual.label}
          onToggleSort={handleCiclarOrdenacao}
        />
      </div>

      {/* Tabela Interativa de Materiais (Otimizada para Mobile / Celular) */}
      <div className="usuario-estoque__table-card">
        {materiaisFiltrados.length === 0 ? (
          <div className="sge-empty-state usuario-estoque__empty">
            <div className="sge-empty-state__icon-wrap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill={apenasFavoritos ? "rgba(245, 158, 11, 0.2)" : "none"} stroke={apenasFavoritos ? "#D97706" : "currentColor"} strokeWidth="1.8">
                {apenasFavoritos ? (
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                ) : (
                  <>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </>
                )}
              </svg>
            </div>
            <h4 className="sge-empty-state__title">
              {apenasFavoritos
                ? 'Nenhum material favorito encontrado'
                : 'Nenhum material encontrado'}
            </h4>
            <p className="sge-empty-state__desc">
              {apenasFavoritos
                ? 'Clique no ícone de favorito de qualquer material para fixá-lo como favorito para acesso rápido.'
                : 'Tente buscar por outro termo ou selecione "Todas" as categorias.'}
            </p>
            {apenasFavoritos && (
              <button
                type="button"
                className="sge-empty-state__btn btn-limpar-fav-filtro"
                onClick={() => {
                  setApenasFavoritos(false);
                }}
              >
                Ver todos os materiais
              </button>
            )}
          </div>
        ) : (
          <div className="usuario-ticket-list">
            {materiaisExibidos.map((item) => {
              const isFavorito = favoritos.includes(item.id);
              const itemCaderneta = itensCaderneta.find(it => it.id === item.id);

              return (
                <div
                  key={item.id}
                  className={`usuario-ticket ${isFavorito ? 'usuario-ticket--favorito' : ''} ${itemCaderneta ? 'usuario-ticket--na-caderneta' : ''}`}
                  onClick={() => handleItemClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleItemClick(item);
                    }
                  }}
                >
                  {/* Corpo do Ticket: Informações */}
                  <div className="ticket-body">
                    <div className="ticket-info">
                      <div className="ticket-title-row">
                        <span className="ticket-nome" title={displayText(item.nome)}>{displayText(item.nome)}</span>
                        <span className="ticket-unidade-tag">{item.unidade || 'UN'}</span>
                        {itemCaderneta && (
                          <span className="ticket-caderneta-badge" title={`${itemCaderneta.quantidade} ${item.unidade || 'UN'} na sua caderneta`}>
                            {itemCaderneta.quantidade}
                          </span>
                        )}
                      </div>
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

      {/* Modal / Bottom Sheet Oficial de Solicitação de Pedido */}
      <BottomSheetModal
        isOpen={Boolean(itemSelecionado)}
        onClose={handleCloseModal}
        title={itemSelecionado ? displayText(itemSelecionado.nome) : ''}
        subtitle={
          itemSelecionado
            ? (itensCaderneta.some(it => it.id === itemSelecionado.id)
                ? 'Atualizar na Caderneta'
                : 'Adicionar à Caderneta')
            : ''
        }
        badge={
          itemSelecionado ? (
            <span className="sheet-badge-unit">{itemSelecionado.unidade || 'UN'}</span>
          ) : null
        }
        footer={
          itemSelecionado ? (
            <div className="sheet-footer">
              <button
                type="button"
                className="sge-modal-btn sge-modal-btn--cancel"
                onClick={handleCloseModal}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="sge-modal-btn sge-modal-btn--confirm"
                onClick={handleSalvarItemCaderneta}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  <path d="M9 12h6" />
                  <path d="M9 16h6" />
                </svg>
                {itensCaderneta.some(it => it.id === itemSelecionado.id)
                  ? 'Atualizar na Caderneta'
                  : 'Adicionar à Caderneta'}
              </button>
            </div>
          ) : null
        }
      >
        {itemSelecionado && (
          <div className="pedido-sheet__form">
            {itemSelecionado.descricao && (
              <p className="sheet-material-desc">{displayText(itemSelecionado.descricao)}</p>
            )}

            {/* Seletor de Quantidade */}
            <div className="qty-picker-container">
              <label className="qty-picker-label">
                Quantidade a pedir ({itemSelecionado.unidade || 'UN'})
              </label>
              <QuantityStepper
                value={quantidade}
                onChange={(val) => {
                  setQuantidade(val);
                  if (val !== '' && !isNaN(val) && Number(val) >= 1) {
                    setErroQtd('');
                  }
                }}
                min={1}
                max={9999}
                unit={itemSelecionado.unidade || 'UN'}
                quickPills={[1, 5, 10, 25]}
                ariaLabel={`Quantidade de ${itemSelecionado.nome}`}
              />
              {erroQtd && <span className="sheet-error">{erroQtd}</span>}
            </div>

            {/* Resumo de conversao de embalagem */}
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
          </div>
        )}
      </BottomSheetModal>

      {/* Botão Flutuante (FAB) da Caderneta de Pedidos - Sempre Visível */}
      <motion.button
        type="button"
        id="btn-fab-caderneta"
        className="fab-caderneta"
        onClick={() => setIsCadernetaOpen(true)}
        title="Caderneta de Pedidos"
        aria-label={`Caderneta de Pedidos com ${itensCaderneta.length} ${itensCaderneta.length === 1 ? 'item' : 'itens'}`}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
      >
        <div className="fab-caderneta__icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M9 12h6" />
            <path d="M9 16h6" />
          </svg>
          {itensCaderneta.length > 0 && (
            <span className="fab-caderneta__badge" aria-hidden="true">
              {itensCaderneta.length}
            </span>
          )}
        </div>
      </motion.button>

      {/* Modal de Revisão e Envio da Caderneta de Pedidos */}
      <CadernetaPedidosModal
        isOpen={isCadernetaOpen}
        onClose={() => setIsCadernetaOpen(false)}
        itens={itensCaderneta}
        onUpdateQtd={handleUpdateQtdCaderneta}
        onRemoveItem={handleRemoveItemCaderneta}
        onClear={handleClearCaderneta}
        onSubmit={handleSubmitCaderneta}
      />
    </div>
  );
};

export default UsuarioEstoque;
