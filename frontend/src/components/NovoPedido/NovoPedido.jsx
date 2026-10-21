import React, { useState, useMemo, useRef, useEffect } from 'react';
import './NovoPedido.css';

/**
 * NovoPedido
 * Formulário dinâmico para criação de pedidos.
 * Não possui campo de setor.
 * Inclui campo de busca de produto mostrando nome e quantidade máxima (estoque disponível).
 *
 * Props esperadas do backend:
 * @param {Array} materiais - lista de materiais:
 *   [{ id, nome, quantidade, estoqueMinimo, unidade }] ou array simples de strings
 * @param {Function} onSubmit - callback chamado ao enviar o formulário
 */
const NovoPedido = ({ materiais = [], onSubmit }) => {
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialSearch, setMaterialSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [quantidade, setQuantidade] = useState(1);
  const [justificativa, setJustificativa] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const dropdownRef = useRef(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Normalização da lista de materiais recebida das props
  const listaMateriais = useMemo(() => {
    return materiais.map((item, idx) => {
      if (typeof item === 'string') {
        return {
          id: idx + 1,
          codigo: '',
          nome: item,
          quantidadeMax: null, // sem limite se vier só string
          unidade: 'UN'
        };
      }
      return {
        id: item.id || idx + 1,
        codigo: item.codigo || '',
        nome: item.nome || item.materialNome || 'Material',
        quantidadeMax: typeof item.quantidade === 'number' ? item.quantidade : null,
        unidade: item.unidade || 'UN'
      };
    });
  }, [materiais]);

  // Filtragem dos materiais pelo termo digitado
  const materiaisFiltrados = useMemo(() => {
    if (!materialSearch.trim()) return listaMateriais;
    const term = materialSearch.trim().toLowerCase();
    return listaMateriais.filter(m =>
      m.nome.toLowerCase().startsWith(term) ||
      String(m.codigo || '').toLowerCase().startsWith(term)
    );
  }, [listaMateriais, materialSearch]);

  const handleSelectMaterial = (m) => {
    setSelectedMaterial(m);
    setMaterialSearch(m.nome);
    setIsDropdownOpen(false);
    // Ajusta quantidade se exceder o estoque máximo disponível
    if (m.quantidadeMax !== null && m.quantidadeMax > 0 && quantidade > m.quantidadeMax) {
      setQuantidade(m.quantidadeMax);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setMaterialSearch(val);
    setSelectedMaterial(null);
    setIsDropdownOpen(true);
  };

  const maxQtd = selectedMaterial?.quantidadeMax !== null ? selectedMaterial?.quantidadeMax : undefined;

  const [itensLote, setItensLote] = useState([]);
  const [erroLote, setErroLote] = useState('');

  // Adiciona o material atual à lista do pedido em lote
  const handleAdicionarAoLote = () => {
    if (!materialSearch.trim()) {
      setErroLote('Pesquise e selecione um produto primeiro');
      return;
    }

    const materialNome = selectedMaterial ? selectedMaterial.nome : materialSearch.trim();
    const matId = selectedMaterial?.id || null;
    const unidade = selectedMaterial?.unidade || 'UN';

    if (maxQtd !== undefined && maxQtd !== null && quantidade > maxQtd) {
      setErroLote(`Quantidade não pode exceder o estoque disponível (${maxQtd} ${unidade})`);
      return;
    }

    // Se já estiver no lote, soma quantidade
    const indexExistente = itensLote.findIndex(i =>
      matId ? i.produtoId === matId : i.materialNome.toLowerCase() === materialNome.toLowerCase()
    );

    if (indexExistente >= 0) {
      const itemExistente = itensLote[indexExistente];
      const novaQtd = itemExistente.quantidade + quantidade;
      if (maxQtd !== undefined && maxQtd !== null && novaQtd > maxQtd) {
        setErroLote(`Total somado (${novaQtd}) excede o estoque disponível (${maxQtd} ${unidade})`);
        return;
      }
      setItensLote(prev => prev.map((it, idx) => idx === indexExistente ? { ...it, quantidade: novaQtd } : it));
    } else {
      setItensLote(prev => [
        ...prev,
        {
          produtoId: matId,
          materialNome,
          quantidade,
          unidade,
          quantidadeMax: maxQtd ?? null
        }
      ]);
    }

    // Limpa campos para o próximo item
    setSelectedMaterial(null);
    setMaterialSearch('');
    setQuantidade(1);
    setErroLote('');
  };

  const handleRemoverDoLote = (index) => {
    setItensLote(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const temItemNoInput = Boolean(materialSearch.trim());
    if (itensLote.length === 0 && !temItemNoInput) {
      setErroLote('Selecione ao menos um produto para enviar o pedido');
      return;
    }

    // Se houver itens no lote + item no input não adicionado ainda, inclui também
    let listaFinal = [...itensLote];
    if (temItemNoInput) {
      const matNome = selectedMaterial ? selectedMaterial.nome : materialSearch.trim();
      listaFinal.push({
        produtoId: selectedMaterial?.id || null,
        materialNome: matNome,
        quantidade,
        unidade: selectedMaterial?.unidade || 'UN',
        quantidadeMax: maxQtd ?? null
      });
    }

    if (onSubmit) {
      if (listaFinal.length > 1) {
        const resumoMateriais = listaFinal.map(m => `${m.materialNome} (${m.quantidade} ${m.unidade})`).join(', ');
        onSubmit({
          material: resumoMateriais,
          produtoId: listaFinal[0].produtoId,
          quantidade: listaFinal.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0),
          itens: listaFinal,
          justificativa,
          urgente
        });
      } else {
        const itemUnico = listaFinal[0];
        onSubmit({
          material: itemUnico.materialNome,
          produtoId: itemUnico.produtoId,
          quantidade: itemUnico.quantidade,
          unidade: itemUnico.unidade,
          itens: listaFinal,
          justificativa,
          urgente
        });
      }
    }

    setEnviado(true);
    setTimeout(() => {
      setEnviado(false);
      setSelectedMaterial(null);
      setMaterialSearch('');
      setQuantidade(1);
      setItensLote([]);
      setJustificativa('');
      setUrgente(false);
      setErroLote('');
    }, 2500);
  };

  return (
    <div className="novo-pedido-card">
      <div className="panel-card__header">
        <h3 className="panel-card__title">Novo Pedido de Material</h3>
      </div>

      {enviado ? (
        <div className="novo-pedido__success">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22,4 12,14.01 9,11.01"/>
          </svg>
          <span>Pedido enviado com sucesso!</span>
        </div>
      ) : (
        <form className="novo-pedido__form" onSubmit={handleSubmit}>
          {/* Busca de Produto com exibição de Nome e Quantidade Máxima */}
          <div className="form-group" ref={dropdownRef}>
            <label className="form-label" htmlFor="np-material-search">
              Produto / Material <span className="required-star">*</span>
            </label>
            <div className="material-search-container">
              <div className="material-search-input-wrap">
                <svg className="material-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  id="np-material-search"
                  type="text"
                  className="material-search-input"
                  placeholder="Pesquise o produto pelo nome..."
                  value={materialSearch}
                  onChange={handleSearchChange}
                  onFocus={() => setIsDropdownOpen(true)}
                  autoComplete="off"
                  required
                />
                {materialSearch && (
                  <button
                    type="button"
                    className="material-search-clear"
                    onClick={() => {
                      setMaterialSearch('');
                      setSelectedMaterial(null);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Dropdown com Lista de Produtos e Quantidade Máxima Disponível */}
              {isDropdownOpen && (
                <div className="material-dropdown-list">
                  {materiaisFiltrados.length === 0 ? (
                    <div className="material-dropdown-empty">
                      {listaMateriais.length === 0
                        ? 'Nenhum produto cadastrado no estoque'
                        : 'Nenhum produto encontrado com esse nome'}
                    </div>
                  ) : (
                    materiaisFiltrados.map((item) => (
                      <div
                        key={item.id}
                        className={`material-dropdown-item ${selectedMaterial?.id === item.id ? 'material-dropdown-item--selected' : ''}`}
                        onClick={() => handleSelectMaterial(item)}
                      >
                        <div className="material-item-info">
                          <span className="material-item-name">{item.nome}</span>
                          <span className="material-item-unit">Unidade: {item.unidade}</span>
                        </div>
                        <div className="material-item-stock">
                          <span className="material-stock-label">Qtd. Máxima:</span>
                          <span className={`material-stock-val ${item.quantidadeMax === 0 ? 'material-stock-val--zero' : ''}`}>
                            {item.quantidadeMax !== null ? `${item.quantidadeMax} ${item.unidade}` : 'Disponível'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedMaterial && (
              <div className="material-selected-banner">
                <span>Produto selecionado: <strong>{selectedMaterial.nome}</strong></span>
                {selectedMaterial.quantidadeMax !== null && (
                  <span className="banner-max-badge">
                    Estoque Máximo: <strong>{selectedMaterial.quantidadeMax} {selectedMaterial.unidade}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Quantidade Solicitada */}
          <div className="form-group">
            <div className="form-group-header">
              <label className="form-label" htmlFor="np-quantidade">Quantidade Solicitada</label>
              {maxQtd !== undefined && (
                <span className="max-allowed-hint">
                  Limite máx: {maxQtd} {selectedMaterial?.unidade || 'UN'}
                </span>
              )}
            </div>
            <div className="form-quantity">
              <button
                type="button"
                className="qty-btn"
                id="btn-qty-decrement"
                onClick={() => setQuantidade(q => Math.max(1, q - 1))}
              >−</button>
              <input
                id="np-quantidade"
                name="quantidade"
                type="number"
                className="form-qty-input"
                value={quantidade}
                min="1"
                max={maxQtd}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 1;
                  if (maxQtd !== undefined && val > maxQtd) {
                    setQuantidade(maxQtd);
                  } else {
                    setQuantidade(Math.max(1, val));
                  }
                }}
              />
              <button
                type="button"
                className="qty-btn"
                id="btn-qty-increment"
                onClick={() => {
                  if (maxQtd === undefined || quantidade < maxQtd) {
                    setQuantidade(q => q + 1);
                  }
                }}
              >+</button>
            </div>
          </div>

          {/* Botão para adicionar ao lote de materiais */}
          <div className="form-group">
            <button
              type="button"
              className="btn-add-lote"
              onClick={handleAdicionarAoLote}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {itensLote.length > 0 ? '+ Adicionar mais um material' : '+ Incluir material no pedido (Lote)'}
            </button>
            {erroLote && <span className="novo-pedido__erro-lote" role="alert">{erroLote}</span>}
          </div>

          {/* Lista de Materiais Adicionados ao Lote */}
          {itensLote.length > 0 && (
            <div className="novo-pedido__lote-section">
              <div className="novo-pedido__lote-header">
                <span className="novo-pedido__lote-title">
                  Materiais no Pedido ({itensLote.length})
                </span>
                <button
                  type="button"
                  className="novo-pedido__lote-clear"
                  onClick={() => setItensLote([])}
                  title="Limpar materiais"
                >
                  Limpar
                </button>
              </div>
              <div className="novo-pedido__lote-list">
                {itensLote.map((item, idx) => (
                  <div key={idx} className="novo-pedido__lote-item">
                    <div className="novo-pedido__lote-item-info">
                      <span className="novo-pedido__lote-item-nome">{item.materialNome}</span>
                      <span className="novo-pedido__lote-item-qtd">{item.quantidade} {item.unidade}</span>
                    </div>
                    <button
                      type="button"
                      className="novo-pedido__lote-item-remove"
                      onClick={() => handleRemoverDoLote(idx)}
                      title={`Remover ${item.materialNome}`}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Justificativa */}
          <div className="form-group">
            <label className="form-label" htmlFor="np-justificativa">Justificativa / Motivo</label>
            <textarea
              id="np-justificativa"
              name="justificativa"
              className="form-textarea"
              placeholder="Descreva o motivo da solicitação deste produto..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={3}
            />
          </div>

          {/* Urgência */}
          <div className="form-group form-group--inline">
            <label className="form-label" htmlFor="np-urgente">Urgência do Pedido</label>
            <label className="toggle" htmlFor="np-urgente">
              <input
                id="np-urgente"
                name="urgente"
                type="checkbox"
                checked={urgente}
                onChange={(e) => setUrgente(e.target.checked)}
              />
              <span className="toggle__slider" />
              <span className="toggle__label">{urgente ? 'Urgente' : 'Normal'}</span>
            </label>
          </div>

          {/* Botão de Envio */}
          <button
            id="btn-enviar-pedido"
            type="submit"
            className="btn-enviar"
            disabled={itensLote.length === 0 && !materialSearch.trim()}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22,2 15,22 11,13 2,9"/>
            </svg>
            {itensLote.length > 0
              ? `Enviar Pedido (${itensLote.length + (materialSearch.trim() ? 1 : 0)} ${itensLote.length + (materialSearch.trim() ? 1 : 0) === 1 ? 'material' : 'materiais'})`
              : 'Enviar Pedido'}
          </button>
        </form>
      )}
    </div>
  );
};

export default NovoPedido;
