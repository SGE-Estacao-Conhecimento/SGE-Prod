import React, { useState, useMemo, useEffect } from 'react';
import TombamentoModal from './TombamentoModal';
import TransferirPatrimonioModal from './TransferirPatrimonioModal';
import { ConfirmDialog } from '../common';
import './AmbientesView.css';

const AmbientesView = ({
  ambientes: initialAmbientes = [],
  catalogo: initialCatalogo = [],
  itens: initialItens = [],
  usuarios = [],
  onCriarAmbiente,
  onSalvarItem,
  onTransferirItem,
  onBaixarItem
}) => {
  const [ambientes, setAmbientes] = useState(initialAmbientes);
  const [catalogo, setCatalogo] = useState(initialCatalogo);
  const [itens, setItens] = useState(initialItens);

  const [selectedAmbienteId, setSelectedAmbienteId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modais e Ações
  const [isTombamentoOpen, setIsTombamentoOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [transferindoItem, setTransferindoItem] = useState(null);
  const [itemParaBaixar, setItemParaBaixar] = useState(null);
  const [isBaixando, setIsBaixando] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Cadastro rápido de ambiente na barra lateral
  const [showNovoAmbienteInput, setShowNovoAmbienteInput] = useState(false);
  const [novoAmbienteTexto, setNovoAmbienteTexto] = useState('');
  const [criandoAmbiente, setCriandoAmbiente] = useState(false);

  // Sincronização com props
  useEffect(() => { setAmbientes(initialAmbientes); }, [initialAmbientes]);
  useEffect(() => { setCatalogo(initialCatalogo); }, [initialCatalogo]);
  useEffect(() => { setItens(initialItens); }, [initialItens]);

  // Fecha menu de 3 pontinhos ao clicar fora ou apertar Escape
  useEffect(() => {
    if (openMenuId === null) return;
    const handleGlobalClick = (e) => {
      if (!e.target.closest('.patrimonio-kebab-container')) {
        setOpenMenuId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuId]);

  // Contagem dinâmica por ambiente
  const ambientesComContagem = useMemo(() => {
    const contagem = {};
    let semAmbienteTotal = 0;

    itens.forEach(item => {
      if (item.status === 'baixado') return;
      if (item.ambienteId) {
        contagem[item.ambienteId] = (contagem[item.ambienteId] || 0) + 1;
      } else {
        semAmbienteTotal += 1;
      }
    });

    const lista = ambientes.map(a => ({
      ...a,
      totalPatrimonios: contagem[a.id] ?? a.totalPatrimonios ?? 0
    })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const totalAtivos = itens.filter(i => i.status !== 'baixado').length;

    return {
      total: totalAtivos,
      semAmbiente: semAmbienteTotal,
      itens: lista
    };
  }, [ambientes, itens]);

  // Itens filtrados
  const filteredItens = useMemo(() => {
    return itens.filter(item => {
      if (selectedAmbienteId === '__SEM_AMBIENTE__') {
        if (item.ambienteId) return false;
      } else if (selectedAmbienteId) {
        if (String(item.ambienteId) !== String(selectedAmbienteId)) return false;
      }

      if (selectedCategoria && item.categoria !== selectedCategoria) {
        return false;
      }

      if (selectedStatus && item.status !== selectedStatus) {
        return false;
      }

      if (searchTerm.trim()) {
        const termo = searchTerm.toLowerCase();
        const match =
          (item.numeroPatrimonio && item.numeroPatrimonio.toLowerCase().includes(termo)) ||
          (item.nomePatrimonio && item.nomePatrimonio.toLowerCase().includes(termo)) ||
          (item.categoria && item.categoria.toLowerCase().includes(termo)) ||
          (item.nomeResponsavel && item.nomeResponsavel.toLowerCase().includes(termo)) ||
          (item.nomeAmbiente && item.nomeAmbiente.toLowerCase().includes(termo)) ||
          (item.numeroSerie && item.numeroSerie.toLowerCase().includes(termo));
        if (!match) return false;
      }

      return true;
    });
  }, [itens, selectedAmbienteId, selectedCategoria, selectedStatus, searchTerm]);

  const ambienteAtivo = useMemo(() => {
    if (!selectedAmbienteId) return null;
    if (selectedAmbienteId === '__SEM_AMBIENTE__') return { nome: 'Sem Ambiente Atribuído' };
    return ambientes.find(a => String(a.id) === String(selectedAmbienteId));
  }, [ambientes, selectedAmbienteId]);

  const tituloAmbienteAtivo = useMemo(() => {
    if (!selectedAmbienteId) return 'Todos os Patrimônios';
    if (selectedAmbienteId === '__SEM_AMBIENTE__') return 'Patrimônios Sem Ambiente';
    return `Ambiente: ${ambienteAtivo?.nome || ''}`;
  }, [selectedAmbienteId, ambienteAtivo]);

  const handleCriarAmbiente = async (e) => {
    e.preventDefault();
    const nomeLimpo = novoAmbienteTexto.trim();
    if (!nomeLimpo) return;
    setCriandoAmbiente(true);
    try {
      if (onCriarAmbiente) {
        const criado = await onCriarAmbiente({ nome: nomeLimpo });
        if (criado?.id) {
          setSelectedAmbienteId(String(criado.id));
        }
      }
      setNovoAmbienteTexto('');
      setShowNovoAmbienteInput(false);
      setFeedbackMsg({ type: 'success', text: `Ambiente "${nomeLimpo}" criado com sucesso.` });
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao criar ambiente.' });
    } finally {
      setCriandoAmbiente(false);
    }
  };

  const handleOpenTombamentoModal = (item = null) => {
    setEditingItem(item);
    setIsTombamentoOpen(true);
  };

  const handleSaveTombamento = async (dados) => {
    if (onSalvarItem) {
      const salvo = await onSalvarItem(dados);
      if (salvo) {
        setItens(prev => {
          const idx = prev.findIndex(i => i.id === salvo.id);
          if (idx >= 0) {
            const copia = [...prev];
            copia[idx] = salvo;
            return copia;
          }
          return [salvo, ...prev];
        });
      }
    }
    setFeedbackMsg({
      type: 'success',
      text: dados.id ? 'Patrimônio atualizado com sucesso.' : `Patrimônio tombado sob a plaqueta "${dados.numeroPatrimonio}".`
    });
  };

  const handleTransferir = async (itemId, dados) => {
    if (onTransferirItem) {
      await onTransferirItem(itemId, dados);
    }
    setItens(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const novoAmb = ambientes.find(a => a.id === dados.novoAmbienteId);
      const novoResp = usuarios.find(u => u.id === dados.novoResponsavelId);
      return {
        ...item,
        ambienteId: dados.novoAmbienteId,
        nomeAmbiente: novoAmb ? novoAmb.nome : null,
        responsavelId: dados.novoResponsavelId,
        nomeResponsavel: novoResp ? novoResp.nome : null,
        observacoes: dados.observacoes || item.observacoes
      };
    }));
    setFeedbackMsg({ type: 'success', text: 'Transferência de patrimônio realizada com sucesso.' });
  };

  const handleConfirmarBaixa = async () => {
    if (!itemParaBaixar || isBaixando) return;
    setIsBaixando(true);
    try {
      if (onBaixarItem) {
        await onBaixarItem(itemParaBaixar.id);
      }
      setItens(prev => prev.map(i => i.id === itemParaBaixar.id ? { ...i, status: 'baixado' } : i));
      setFeedbackMsg({ type: 'success', text: `Baixa efetuada para o patrimônio "${itemParaBaixar.numeroPatrimonio}".` });
      setItemParaBaixar(null);
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao efetuar baixa do patrimônio.' });
    } finally {
      setIsBaixando(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'em_manutencao':
        return <span className="patrimonio-status-badge patrimonio-status-badge--manutencao">Em Manutenção</span>;
      case 'baixado':
        return <span className="patrimonio-status-badge patrimonio-status-badge--baixado">Baixado</span>;
      case 'ativo':
      default:
        return <span className="patrimonio-status-badge patrimonio-status-badge--ativo">Ativo</span>;
    }
  };

  return (
    <div className="ambientes-split-container">
      {/* Coluna Esquerda: Lista de Ambientes */}
      <aside className="ambientes-sidebar" aria-label="Lista de ambientes físicos">
        <div className="ambientes-sidebar-header">
          <div className="ambientes-sidebar-header-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Ambientes</span>
          </div>
        </div>

        <div className="ambientes-list" role="tablist" aria-orientation="vertical">
          <button
            type="button"
            className={`ambientes-item ${selectedAmbienteId === '' ? 'ambientes-item--active' : ''}`}
            onClick={() => setSelectedAmbienteId('')}
            role="tab"
            aria-selected={selectedAmbienteId === ''}
          >
            <span className="ambientes-item-name">Todos os Ambientes</span>
            <span className="ambientes-item-count">{ambientesComContagem.total}</span>
          </button>

          {ambientesComContagem.itens.map(amb => (
            <button
              key={amb.id}
              type="button"
              className={`ambientes-item ${String(selectedAmbienteId) === String(amb.id) ? 'ambientes-item--active' : ''}`}
              onClick={() => setSelectedAmbienteId(String(amb.id))}
              role="tab"
              aria-selected={String(selectedAmbienteId) === String(amb.id)}
            >
              <span className="ambientes-item-name" title={amb.nome}>{amb.nome}</span>
              <span className="ambientes-item-count">{amb.totalPatrimonios}</span>
            </button>
          ))}

          {ambientesComContagem.semAmbiente > 0 && (
            <button
              type="button"
              className={`ambientes-item ${selectedAmbienteId === '__SEM_AMBIENTE__' ? 'ambientes-item--active' : ''}`}
              onClick={() => setSelectedAmbienteId('__SEM_AMBIENTE__')}
              role="tab"
              aria-selected={selectedAmbienteId === '__SEM_AMBIENTE__'}
            >
              <span className="ambientes-item-name">Sem Ambiente</span>
              <span className="ambientes-item-count">{ambientesComContagem.semAmbiente}</span>
            </button>
          )}
        </div>

        <div className="ambientes-sidebar-footer">
          {showNovoAmbienteInput ? (
            <form className="ambientes-novo-form" onSubmit={handleCriarAmbiente}>
              <input
                type="text"
                className="ambientes-novo-input"
                placeholder="Nome do ambiente..."
                value={novoAmbienteTexto}
                onChange={(e) => setNovoAmbienteTexto(e.target.value)}
                autoFocus
                disabled={criandoAmbiente}
              />
              <div className="ambientes-novo-actions">
                <button
                  type="submit"
                  className="btn-novo-ambiente-salvar"
                  disabled={criandoAmbiente || !novoAmbienteTexto.trim()}
                >
                  {criandoAmbiente ? 'Salvando...' : 'Criar'}
                </button>
                <button
                  type="button"
                  className="btn-novo-ambiente-cancelar"
                  onClick={() => {
                    setShowNovoAmbienteInput(false);
                    setNovoAmbienteTexto('');
                  }}
                  disabled={criandoAmbiente}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="btn-novo-ambiente-footer"
              onClick={() => setShowNovoAmbienteInput(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Novo Ambiente</span>
            </button>
          )}
        </div>
      </aside>

      {/* Coluna Direita: Conteúdo Principal e Tabela */}
      <main className="ambientes-main-content">
        <div className="ambientes-content-header">
          <div>
            <h2 className="ambientes-content-title">{tituloAmbienteAtivo}</h2>
            <p className="ambientes-content-subtitle">
              {filteredItens.length} {filteredItens.length === 1 ? 'bem patrimonial listado' : 'bens patrimoniais listados'}
            </p>
          </div>
        </div>

        {/* Barra de Pesquisa e Filtros */}
        <div className="ambientes-filter-bar">
          <div className="ambientes-search-wrap">
            <svg className="ambientes-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="ambientes-search-input"
              placeholder="Buscar por plaqueta, modelo, responsável ou ambiente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="ambientes-clear-search"
                onClick={() => setSearchTerm('')}
                aria-label="Limpar busca"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <div className="ambientes-filters-right">
            <select
              className="ambientes-select-filter"
              value={selectedCategoria}
              onChange={(e) => setSelectedCategoria(e.target.value)}
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas as Categorias</option>
              <option value="Mobiliário">Mobiliário</option>
              <option value="Eletrodomésticos">Eletrodomésticos</option>
              <option value="Equipamentos de TI">Equipamentos de TI</option>
              <option value="Ferramentas">Ferramentas</option>
              <option value="Eletrônicos">Eletrônicos</option>
              <option value="Utensílios">Utensílios</option>
              <option value="Outros">Outros</option>
            </select>

            <select
              className="ambientes-select-filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filtrar por status"
            >
              <option value="">Todos os Status</option>
              <option value="ativo">Ativos</option>
              <option value="em_manutencao">Em Manutenção</option>
              <option value="baixado">Baixados</option>
            </select>
          </div>
        </div>

        {feedbackMsg && (
          <div
            className={`ambientes-feedback ambientes-feedback--${feedbackMsg.type}`}
            role={feedbackMsg.type === 'error' ? 'alert' : 'status'}
          >
            <span>{feedbackMsg.text}</span>
            <button
              type="button"
              className="ambientes-feedback__close"
              onClick={() => setFeedbackMsg(null)}
              aria-label="Fechar aviso"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Tabela de Patrimônios */}
        <div className="ambientes-table-card">
          {filteredItens.length > 0 ? (
            <>
              <div className="ambientes-table-wrapper">
                <table className="ambientes-table">
                  <thead>
                    <tr>
                      <th>Plaqueta</th>
                      <th>Item / Modelo</th>
                      <th>Categoria</th>
                      <th>Ambiente</th>
                      <th>Responsável</th>
                      <th>Estado</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItens.map((item, index) => {
                      const isNearBottom = index >= filteredItens.length - 2 && filteredItens.length > 2;
                      return (
                        <tr key={item.id} className={item.status === 'baixado' ? 'tr-baixado' : ''}>
                          <td>
                            <span className="patrimonio-plaqueta-badge">
                              {item.numeroPatrimonio}
                            </span>
                          </td>
                          <td>
                            <div className="patrimonio-item-info">
                              <span className="patrimonio-item-nome">{item.nomePatrimonio}</span>
                              {item.numeroSerie && (
                                <span className="patrimonio-item-sub">Série: {item.numeroSerie}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="patrimonio-categoria-tag">{item.categoria}</span>
                          </td>
                          <td>
                            <span className="patrimonio-ambiente-tag">
                              {item.nomeAmbiente || 'Sem ambiente'}
                            </span>
                          </td>
                          <td>
                            <span className="patrimonio-responsavel-text">
                              {item.nomeResponsavel || 'Não atribuído'}
                            </span>
                          </td>
                          <td>
                            <span className={`patrimonio-estado-pill patrimonio-estado-pill--${item.estadoConservacao}`}>
                              {item.estadoConservacao.toUpperCase()}
                            </span>
                          </td>
                          <td>{getStatusBadge(item.status)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="patrimonio-kebab-container">
                              <button
                                type="button"
                                className={`btn-kebab ${openMenuId === item.id ? 'btn-kebab--active' : ''}`}
                                aria-label={`Ações para o patrimônio ${item.numeroPatrimonio}`}
                                aria-haspopup="true"
                                aria-expanded={openMenuId === item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(prev => prev === item.id ? null : item.id);
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                  <circle cx="12" cy="5" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="12" cy="19" r="2" />
                                </svg>
                              </button>

                              {openMenuId === item.id && (
                                <div className={`patrimonio-kebab-menu ${isNearBottom ? 'patrimonio-kebab-menu--up' : ''}`} role="menu">
                                  <button
                                    type="button"
                                    className="patrimonio-kebab-item"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setTransferindoItem(item);
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <polyline points="17 1 21 5 17 9" />
                                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                      <polyline points="7 23 3 19 7 15" />
                                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                    </svg>
                                    <span>Transferir</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="patrimonio-kebab-item"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleOpenTombamentoModal(item);
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    <span>Editar Dados</span>
                                  </button>

                                  {item.status !== 'baixado' && (
                                    <>
                                      <div className="patrimonio-kebab-divider" role="separator" />
                                      <button
                                        type="button"
                                        className="patrimonio-kebab-item patrimonio-kebab-item--danger"
                                        role="menuitem"
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          setItemParaBaixar(item);
                                        }}
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <circle cx="12" cy="12" r="10" />
                                          <line x1="15" y1="9" x2="9" y2="15" />
                                          <line x1="9" y1="9" x2="15" y2="15" />
                                        </svg>
                                        <span>Dar Baixa</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Botão no fim da lista (alinhado à esquerda para não sobrepor o botão flutuante) */}
              <div className="ambientes-table-footer">
                <button
                  type="button"
                  className="btn-tombamento-footer"
                  onClick={() => handleOpenTombamentoModal(null)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Tombear Novo Patrimônio</span>
                </button>
              </div>
            </>
          ) : (
            <div className="ambientes-empty-state">
              <div className="empty-icon-wrap">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <h4>Nenhum patrimônio encontrado</h4>
              <p>
                {searchTerm || selectedCategoria || selectedStatus
                  ? 'Nenhum item patrimonial corresponde aos filtros aplicados.'
                  : selectedAmbienteId
                    ? 'Nenhum patrimônio alocado neste ambiente.'
                    : 'Nenhum bem patrimonial tombado ainda.'}
              </p>
              {(searchTerm || selectedCategoria || selectedStatus) ? (
                <button
                  type="button"
                  className="btn-clear-filters"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategoria('');
                    setSelectedStatus('');
                  }}
                >
                  Limpar Filtros
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-tombamento-footer"
                  onClick={() => handleOpenTombamentoModal(null)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Tombear Primeiro Patrimônio</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal de Tombamento */}
      <TombamentoModal
        isOpen={isTombamentoOpen}
        onClose={() => setIsTombamentoOpen(false)}
        onSave={handleSaveTombamento}
        catalogo={catalogo}
        ambientes={ambientes}
        usuarios={usuarios}
        ambientePadraoId={selectedAmbienteId && selectedAmbienteId !== '__SEM_AMBIENTE__' ? Number(selectedAmbienteId) : null}
        initialData={editingItem}
      />

      {/* Modal de Transferência */}
      <TransferirPatrimonioModal
        isOpen={Boolean(transferindoItem)}
        onClose={() => setTransferindoItem(null)}
        onConfirm={handleTransferir}
        item={transferindoItem}
        ambientes={ambientes}
        usuarios={usuarios}
      />

      {/* Confirmação de Baixa */}
      {itemParaBaixar && (
        <ConfirmDialog
          title="Confirmar baixa de patrimônio?"
          description={`O bem com a plaqueta "${itemParaBaixar.numeroPatrimonio}" (${itemParaBaixar.nomePatrimonio}) será marcado como baixado do acervo patrimonial.`}
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

export default AmbientesView;

