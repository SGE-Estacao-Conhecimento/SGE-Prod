import React, { useState, useMemo } from 'react';
import NovoModeloModal from './NovoModeloModal';
import TombamentoModal from '../Ambientes/TombamentoModal';
import TransferirPatrimonioModal from '../Ambientes/TransferirPatrimonioModal';
import { ConfirmDialog } from '../common';
import './PatrimonioView.css';

const CATEGORIAS_FILTRO = [
  'Todas',
  'Mobiliário',
  'Equipamentos de TI',
  'Eletrodomésticos',
  'Ferramentas',
  'Eletrônicos',
  'Utensílios',
  'Veículos',
  'Outros'
];

const ESTADOS_FILTRO = [
  { value: '', label: 'Todos os Estados' },
  { value: 'novo', label: 'Novo' },
  { value: 'bom', label: 'Bom' },
  { value: 'regular', label: 'Regular' },
  { value: 'danificado', label: 'Danificado' },
  { value: 'em_manutencao', label: 'Em Manutenção' }
];

const CONSERVACAO_LABELS = {
  novo: 'Novo',
  bom: 'Bom',
  regular: 'Regular',
  danificado: 'Danificado',
  em_manutencao: 'Em Manutenção'
};

const PatrimonioView = ({
  catalogo = [],
  itens = [],
  ambientes = [],
  usuarios = [],
  onCriarModelo,
  onSalvarItem,
  onTransferirItem,
  onBaixarItem
}) => {
  // Navegação: 'catalogo' (tabela de modelos / "caixas") ou 'detalhe' (dentro da caixa selecionada)
  const [viewMode, setViewMode] = useState('catalogo');
  const [selectedModeloId, setSelectedModeloId] = useState(null);

  // Filtros de busca no catálogo de modelos
  const [buscaModelo, setBuscaModelo] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');

  // Filtros de busca dentro da caixa selecionada
  const [buscaItem, setBuscaItem] = useState('');
  const [filtroConservacao, setFiltroConservacao] = useState('');

  // Modais e ações
  const [isNovoModeloModalOpen, setIsNovoModeloModalOpen] = useState(false);
  const [modeloEmEdicao, setModeloEmEdicao] = useState(null);

  const [isTombamentoOpen, setIsTombamentoOpen] = useState(false);
  const [tombamentoModeloPadraoId, setTombamentoModeloPadraoId] = useState(null);
  const [itemEmEdicao, setItemEmEdicao] = useState(null);

  const [transferindoItem, setTransferindoItem] = useState(null);
  const [itemParaBaixar, setItemParaBaixar] = useState(null);
  const [isBaixando, setIsBaixando] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Mapeamento de itens por ID do modelo
  const itensPorModelo = useMemo(() => {
    const mapa = new Map();
    itens.forEach(item => {
      const lista = mapa.get(item.patrimonioId) || [];
      lista.push(item);
      mapa.set(item.patrimonioId, lista);
    });
    return mapa;
  }, [itens]);

  // Modelos filtrados
  const modelosFiltrados = useMemo(() => {
    return catalogo.filter(m => {
      if (categoriaFiltro !== 'Todas' && m.categoria !== categoriaFiltro) {
        return false;
      }
      if (buscaModelo.trim()) {
        const termo = buscaModelo.toLowerCase();
        const matchNome = m.nome?.toLowerCase().includes(termo);
        const matchMarca = m.marca?.toLowerCase().includes(termo);
        const matchMod = m.modelo?.toLowerCase().includes(termo);
        const matchDesc = m.descricao?.toLowerCase().includes(termo);
        const matchCat = m.categoria?.toLowerCase().includes(termo);
        if (!matchNome && !matchMarca && !matchMod && !matchDesc && !matchCat) return false;
      }
      return true;
    });
  }, [catalogo, categoriaFiltro, buscaModelo]);

  // Modelo selecionado atualmente para visualização interna da caixa
  const modeloSelecionado = useMemo(() => {
    if (!selectedModeloId) return null;
    return catalogo.find(m => m.id === selectedModeloId) || null;
  }, [catalogo, selectedModeloId]);

  // Itens do modelo selecionado com filtros aplicados
  const itensDoModeloSelecionado = useMemo(() => {
    if (!selectedModeloId) return [];
    const lista = itensPorModelo.get(selectedModeloId) || [];
    return lista.filter(item => {
      if (filtroConservacao && item.estadoConservacao !== filtroConservacao) {
        return false;
      }
      if (buscaItem.trim()) {
        const termo = buscaItem.toLowerCase();
        const plaquetaOk = item.numeroPatrimonio?.toLowerCase().includes(termo);
        const serieOk = item.numeroSerie?.toLowerCase().includes(termo);
        const ambOk = item.nomeAmbiente?.toLowerCase().includes(termo);
        const respOk = item.nomeResponsavel?.toLowerCase().includes(termo);
        const obsOk = item.observacoes?.toLowerCase().includes(termo);
        if (!plaquetaOk && !serieOk && !ambOk && !respOk && !obsOk) return false;
      }
      return true;
    });
  }, [selectedModeloId, itensPorModelo, filtroConservacao, buscaItem]);

  // Manipuladores de ação
  const handleAbrirCaixa = (modelo) => {
    setSelectedModeloId(modelo.id);
    setViewMode('detalhe');
    setBuscaItem('');
    setFiltroConservacao('');
  };

  const handleVoltarCatalogo = () => {
    setViewMode('catalogo');
    setSelectedModeloId(null);
    setBuscaItem('');
    setFiltroConservacao('');
  };

  const handleAbrirNovoModelo = () => {
    setModeloEmEdicao(null);
    setIsNovoModeloModalOpen(true);
  };

  const handleAbrirEditarModelo = (modelo, e) => {
    if (e) e.stopPropagation();
    setModeloEmEdicao(modelo);
    setIsNovoModeloModalOpen(true);
  };

  const handleSalvarModelo = async (dados) => {
    if (onCriarModelo) {
      await onCriarModelo({ ...dados, id: modeloEmEdicao?.id });
      setFeedbackMsg({
        tipo: 'sucesso',
        texto: modeloEmEdicao ? 'Modelo atualizado com sucesso.' : 'Novo modelo de patrimônio cadastrado.'
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  const handleAbrirTombamento = (modeloId = null, e) => {
    if (e) e.stopPropagation();
    setItemEmEdicao(null);
    setTombamentoModeloPadraoId(modeloId || selectedModeloId || null);
    setIsTombamentoOpen(true);
  };

  const handleAbrirEditarItem = (item) => {
    setItemEmEdicao(item);
    setTombamentoModeloPadraoId(item.patrimonioId);
    setIsTombamentoOpen(true);
  };

  const handleSalvarItemModal = async (dados) => {
    if (onSalvarItem) {
      await onSalvarItem(dados);
      setFeedbackMsg({
        tipo: 'sucesso',
        texto: dados.id ? 'Patrimônio atualizado com sucesso.' : 'Novo exemplar tombado com sucesso.'
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  const handleAbrirTransferencia = (item) => {
    setTransferindoItem(item);
  };

  const handleConfirmarTransferencia = async (itemId, dados) => {
    if (onTransferirItem) {
      await onTransferirItem(itemId, dados);
      setFeedbackMsg({ tipo: 'sucesso', texto: 'Transferência de patrimônio concluída.' });
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  const handleSolicitarBaixa = (item) => {
    setItemParaBaixar(item);
  };

  const handleConfirmarBaixa = async () => {
    if (!itemParaBaixar || !onBaixarItem) return;
    setIsBaixando(true);
    try {
      await onBaixarItem(itemParaBaixar.id);
      setFeedbackMsg({ tipo: 'sucesso', texto: `Baixa efetuada para a plaqueta "${itemParaBaixar.numeroPatrimonio}".` });
      setItemParaBaixar(null);
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err) {
      setFeedbackMsg({ tipo: 'erro', texto: err?.message || 'Falha ao efetuar baixa do bem.' });
    } finally {
      setIsBaixando(false);
    }
  };

  return (
    <div className="patrimonio-container">
      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`patrimonio-feedback-banner patrimonio-feedback-banner--${feedbackMsg.tipo === 'erro' ? 'error' : 'success'}`}
          role="status"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {feedbackMsg.tipo === 'erro' ? (
              <>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </>
            ) : (
              <>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </>
            )}
          </svg>
          <span>{feedbackMsg.texto}</span>
        </div>
      )}

      {/* Visão 1: Catálogo de Modelos ("Caixas") */}
      {viewMode === 'catalogo' && (
        <>
          {/* Barra de Filtros e Busca */}
          <div className="patrimonio-filter-bar">
            <div className="patrimonio-search-wrap">
              <svg className="patrimonio-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="patrimonio-search-input"
                placeholder="Buscar modelo por nome, marca ou especificação..."
                value={buscaModelo}
                onChange={(e) => setBuscaModelo(e.target.value)}
              />
              {buscaModelo && (
                <button
                  type="button"
                  className="patrimonio-clear-search"
                  onClick={() => setBuscaModelo('')}
                  aria-label="Limpar busca"
                >
                  ×
                </button>
              )}
            </div>

            <div className="patrimonio-filters-right">
              <select
                className="patrimonio-select-filter"
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
              >
                {CATEGORIAS_FILTRO.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'Todas' ? 'Todas as Categorias' : cat}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn-novo-modelo"
                onClick={handleAbrirNovoModelo}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Novo Modelo</span>
              </button>
            </div>
          </div>

          {/* Tabela Compacta de Modelos ("Caixas") */}
          <div className="patrimonio-table-card">
            {modelosFiltrados.length > 0 ? (
              <div className="patrimonio-table-wrapper">
                <table className="patrimonio-table">
                  <thead>
                    <tr>
                      <th>Modelo de Patrimônio</th>
                      <th>Categoria</th>
                      <th>Marca / Especificação</th>
                      <th>Descrição</th>
                      <th>Unidades Tombadas</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelosFiltrados.map(modelo => {
                      const itensDoModelo = itensPorModelo.get(modelo.id) || [];
                      const qtdTombados = itensDoModelo.length;
                      const emManutencao = itensDoModelo.filter(
                        i => i.estadoConservacao === 'danificado' || i.estadoConservacao === 'em_manutencao'
                      ).length;

                      return (
                        <tr key={modelo.id}>
                          <td>
                            <button
                              type="button"
                              className="patrimonio-nome-link"
                              onClick={() => handleAbrirCaixa(modelo)}
                              title="Abrir este modelo para ver exemplares tombados"
                            >
                              <strong>{modelo.nome}</strong>
                            </button>
                          </td>
                          <td>
                            <span className="categoria-tag">{modelo.categoria}</span>
                          </td>
                          <td>
                            {(modelo.marca || modelo.modelo) ? (
                              <span className="patrimonio-espec-text">
                                {[modelo.marca, modelo.modelo].filter(Boolean).join(' • ')}
                              </span>
                            ) : (
                              <span className="patrimonio-muted-cell">-</span>
                            )}
                          </td>
                          <td>
                            {modelo.descricao ? (
                              <span className="patrimonio-desc-cell">{modelo.descricao}</span>
                            ) : (
                              <span className="patrimonio-muted-cell">-</span>
                            )}
                          </td>
                          <td>
                            <div className="patrimonio-qtd-wrap">
                              <span className="patrimonio-unidades-badge">
                                <strong>{qtdTombados}</strong> {qtdTombados === 1 ? 'unidade' : 'unidades'}
                              </span>
                              {emManutencao > 0 && (
                                <span className="patrimonio-avaria-pill" title={`${emManutencao} em manutenção/avaria`}>
                                  {emManutencao} em manutenção
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="patrimonio-actions-row">
                              <button
                                type="button"
                                className="btn-patrimonio-abrir"
                                onClick={() => handleAbrirCaixa(modelo)}
                                title="Abrir caixa deste modelo"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                                </svg>
                                <span>Ver Exemplares</span>
                              </button>

                              <button
                                type="button"
                                className="btn-patrimonio-quick-tombar"
                                onClick={(e) => handleAbrirTombamento(modelo.id, e)}
                                title={`Tombar nova unidade de ${modelo.nome}`}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <line x1="12" y1="5" x2="12" y2="19" />
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Tombar</span>
                              </button>

                              <button
                                type="button"
                                className="btn-patrimonio-icon-action"
                                onClick={(e) => handleAbrirEditarModelo(modelo, e)}
                                title="Editar dados do modelo"
                                aria-label={`Editar ${modelo.nome}`}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="patrimonio-empty-state">
                <div className="empty-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <h4>Nenhum modelo de patrimônio encontrado</h4>
                <p>
                  {buscaModelo || categoriaFiltro !== 'Todas'
                    ? 'Nenhum modelo corresponde aos filtros selecionados.'
                    : 'Cadastre o primeiro modelo ("caixa") para registrar os bens duráveis.'}
                </p>
                {buscaModelo || categoriaFiltro !== 'Todas' ? (
                  <button
                    type="button"
                    className="btn-clear-filters"
                    onClick={() => {
                      setBuscaModelo('');
                      setCategoriaFiltro('Todas');
                    }}
                  >
                    Limpar Filtros
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-novo-modelo"
                    onClick={handleAbrirNovoModelo}
                  >
                    + Criar Primeiro Modelo
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Visão 2: Detalhe do Modelo (Dentro da Caixa Selecionada) */}
      {viewMode === 'detalhe' && modeloSelecionado && (
        <>
          {/* Barra Contextual Superior do Modelo */}
          <div className="patrimonio-context-bar">
            <div className="patrimonio-context-left">
              <button
                type="button"
                className="btn-patrimonio-voltar"
                onClick={handleVoltarCatalogo}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>Voltar aos Modelos</span>
              </button>

              <div className="patrimonio-context-title-wrap">
                <span className="categoria-tag">{modeloSelecionado.categoria}</span>
                <h3 className="patrimonio-context-title">{modeloSelecionado.nome}</h3>
                {(modeloSelecionado.marca || modeloSelecionado.modelo) && (
                  <span className="patrimonio-context-meta">
                    {[modeloSelecionado.marca, modeloSelecionado.modelo].filter(Boolean).join(' • ')}
                  </span>
                )}
              </div>
            </div>

            <div className="patrimonio-context-right">
              <button
                type="button"
                className="btn-patrimonio-secondary"
                onClick={(e) => handleAbrirEditarModelo(modeloSelecionado, e)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span>Editar Modelo</span>
              </button>

              <button
                type="button"
                className="btn-novo-modelo"
                onClick={() => handleAbrirTombamento(modeloSelecionado.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Tombar Unidade</span>
              </button>
            </div>
          </div>

          {/* Barra de Filtros dos Exemplares Desta Caixa */}
          <div className="patrimonio-filter-bar">
            <div className="patrimonio-search-wrap">
              <svg className="patrimonio-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="patrimonio-search-input"
                placeholder="Buscar por plaqueta, série, ambiente ou responsável..."
                value={buscaItem}
                onChange={(e) => setBuscaItem(e.target.value)}
              />
              {buscaItem && (
                <button
                  type="button"
                  className="patrimonio-clear-search"
                  onClick={() => setBuscaItem('')}
                  aria-label="Limpar busca"
                >
                  ×
                </button>
              )}
            </div>

            <div className="patrimonio-filters-right">
              <select
                className="patrimonio-select-filter"
                value={filtroConservacao}
                onChange={(e) => setFiltroConservacao(e.target.value)}
              >
                {ESTADOS_FILTRO.map(est => (
                  <option key={est.value} value={est.value}>{est.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabela de Exemplares Tombados Desta Caixa */}
          <div className="patrimonio-table-card">
            {itensDoModeloSelecionado.length > 0 ? (
              <div className="patrimonio-table-wrapper">
                <table className="patrimonio-table">
                  <thead>
                    <tr>
                      <th>Plaqueta (Nº Patrimônio)</th>
                      <th>Nº de Série</th>
                      <th>Ambiente / Localização</th>
                      <th>Responsável</th>
                      <th>Conservação</th>
                      <th>Data Aquisição</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensDoModeloSelecionado.map(item => (
                      <tr key={item.id}>
                        <td>
                          <span className="sku-badge">{item.numeroPatrimonio}</span>
                        </td>
                        <td>
                          {item.numeroSerie ? (
                            <span className="patrimonio-serie-code">{item.numeroSerie}</span>
                          ) : (
                            <span className="patrimonio-muted-cell">-</span>
                          )}
                        </td>
                        <td>
                          {item.nomeAmbiente ? (
                            <span className="local-text">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                              </svg>
                              {item.nomeAmbiente}
                            </span>
                          ) : (
                            <span className="patrimonio-muted-cell">Não alocado</span>
                          )}
                        </td>
                        <td>
                          {item.nomeResponsavel ? (
                            <span className="patrimonio-responsavel-text">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                              {item.nomeResponsavel}
                            </span>
                          ) : (
                            <span className="patrimonio-muted-cell">Sem responsável</span>
                          )}
                        </td>
                        <td>
                          <span className={`status-badge status-badge--${item.estadoConservacao === 'danificado' ? 'danger' : item.estadoConservacao === 'em_manutencao' || item.estadoConservacao === 'regular' ? 'warning' : 'success'}`}>
                            {CONSERVACAO_LABELS[item.estadoConservacao] || item.estadoConservacao || 'Bom'}
                          </span>
                        </td>
                        <td>
                          {item.dataAquisicao ? (
                            <span>{new Date(item.dataAquisicao).toLocaleDateString('pt-BR')}</span>
                          ) : (
                            <span className="patrimonio-muted-cell">-</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="btn-action"
                              style={{ width: 'auto', padding: '0 8px', fontSize: '11px', fontWeight: 600 }}
                              onClick={() => handleAbrirTransferencia(item)}
                              title="Transferir localização ou responsável"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: 3 }}>
                                <path d="M17 1l4 4-4 4" />
                                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                <path d="M7 23l-4-4 4-4" />
                                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                              </svg>
                              Transferir
                            </button>

                            <button
                              type="button"
                              className="btn-action btn-action--edit"
                              onClick={() => handleAbrirEditarItem(item)}
                              title="Editar patrimônio"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              className="btn-action btn-action--delete"
                              onClick={() => handleSolicitarBaixa(item)}
                              title="Baixar exemplar"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="patrimonio-empty-state">
                <div className="empty-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <h4>Nenhum exemplar tombado neste modelo</h4>
                <p>
                  {buscaItem || filtroConservacao
                    ? 'Nenhum exemplar corresponde aos filtros pesquisados.'
                    : 'Cadastre a primeira plaqueta física para vincular a este modelo.'}
                </p>
                {buscaItem || filtroConservacao ? (
                  <button
                    type="button"
                    className="btn-clear-filters"
                    onClick={() => {
                      setBuscaItem('');
                      setFiltroConservacao('');
                    }}
                  >
                    Limpar Filtros
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-novo-modelo"
                    onClick={() => handleAbrirTombamento(modeloSelecionado.id)}
                  >
                    + Tombar Primeira Unidade
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de Criação / Edição de Modelo */}
      <NovoModeloModal
        isOpen={isNovoModeloModalOpen}
        onClose={() => setIsNovoModeloModalOpen(false)}
        onSave={handleSalvarModelo}
        initialData={modeloEmEdicao}
      />

      {/* Modal de Tombamento de Item */}
      <TombamentoModal
        isOpen={isTombamentoOpen}
        onClose={() => setIsTombamentoOpen(false)}
        onSave={handleSalvarItemModal}
        catalogo={catalogo}
        ambientes={ambientes}
        usuarios={usuarios}
        modeloPadraoId={tombamentoModeloPadraoId}
        initialData={itemEmEdicao}
      />

      {/* Modal de Transferência */}
      <TransferirPatrimonioModal
        isOpen={Boolean(transferindoItem)}
        onClose={() => setTransferindoItem(null)}
        onConfirm={handleConfirmarTransferencia}
        item={transferindoItem}
        ambientes={ambientes}
        usuarios={usuarios}
      />

      {/* Confirmação de Baixa */}
      {itemParaBaixar && (
        <ConfirmDialog
          title="Confirmar baixa de patrimônio?"
          description={`O bem com a plaqueta "${itemParaBaixar.numeroPatrimonio}" (${itemParaBaixar.nomePatrimonio}) será removido do acervo patrimonial ativo.`}
          confirmLabel="Efetuar Baixa"
          tone="danger"
          isBusy={isBaixando}
          onCancel={() => setItemParaBaixar(null)}
          onConfirm={handleConfirmarBaixa}
        />
      )}
    </div>
  );
};

export default PatrimonioView;
