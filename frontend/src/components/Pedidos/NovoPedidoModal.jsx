import React, { useState, useEffect, useMemo, useRef } from 'react';
import './NovoPedidoModal.css';
import { useDialogAccessibility } from '../common';

/**
 * Modal para criação e edição de pedidos de materiais
 * Alinhado com o padrão estético de "Cadastrar Novo Material":
 * - Header com ícone azul e título estilizado
 * - Botão de fechar circular
 * - Grid padronizado de campos (form-group, form-label, form-input, form-select)
 * - Seleção inteligente de produtos com busca e quantidade máxima disponível em estoque
 * - Footer com botões Cancelar e Submeter com ícone
 */
const ITEM_VAZIO = { materialId: null, materialNome: '', quantidade: 1, unidade: 'UN', quantidadeMax: null };

const NovoPedidoModal = ({
  isOpen,
  onClose,
  onSave,
  initialData = null,
  materiaisDisponiveis = [],
  usuariosDisponiveis = []
}) => {
  const dialogRef = useDialogAccessibility({ isOpen, onClose });
  const [formData, setFormData] = useState({
    usuario: '',
    prioridade: 'Normal', // Normal, Alta, Urgente
    justificativa: '',
    itens: [] // [{ materialId, materialNome, quantidade, unidade, quantidadeMax }]
  });

  // Linha temporária para adição de itens ao pedido (lote)
  const [itemTemp, setItemTemp] = useState(ITEM_VAZIO);

  const [productSearch, setProductSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const dropdownRef = useRef(null);

  // Fecha dropdown de produtos ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Normaliza lista de materiais
  const listaMateriais = useMemo(() => {
    return materiaisDisponiveis.map((m, idx) => {
      if (typeof m === 'string') {
        return {
          id: idx + 1,
          nome: m,
          unidade: 'UN',
          quantidadeMax: null
        };
      }
      return {
        id: m.id || idx + 1,
        nome: m.nome || m.materialNome,
        unidade: m.unidade || 'UN',
        quantidadeMax: typeof m.quantidade === 'number' ? m.quantidade : null
      };
    });
  }, [materiaisDisponiveis]);

  const materiaisFiltrados = useMemo(() => {
    if (!productSearch.trim()) return listaMateriais;
    const term = productSearch.toLowerCase();
    return listaMateriais.filter(m => m.nome.toLowerCase().includes(term));
  }, [listaMateriais, productSearch]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        usuario: initialData.usuario || '',
        prioridade: initialData.prioridade || 'Normal',
        justificativa: initialData.justificativa || '',
        itens: initialData.itens ? [...initialData.itens] : (
          initialData.materiais
            ? initialData.materiais.map(m => ({
                materialId: m.materialId ?? m.produtoId ?? null,
                materialNome: typeof m === 'string' ? m : m.materialNome,
                quantidade: m.quantidade || 1,
                unidade: m.unidade || 'UN',
                quantidadeMax: m.quantidadeMax || null
              }))
            : []
        )
      });
    } else {
      setFormData({
        usuario: '',
        prioridade: 'Normal',
        justificativa: '',
        itens: []
      });
    }
    setProductSearch('');
    setItemTemp(ITEM_VAZIO);
    setErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSelectMaterial = (m) => {
    setItemTemp(prev => ({
      ...prev,
      materialId: m.id,
      materialNome: m.nome,
      unidade: m.unidade || 'UN',
      quantidadeMax: m.quantidadeMax
    }));
    setProductSearch(m.nome);
    setIsDropdownOpen(false);
    if (errors.item) {
      setErrors(prev => ({ ...prev, item: null }));
    }
  };

  const handleAddItem = () => {
    if (!itemTemp.materialNome.trim()) {
      setErrors(prev => ({ ...prev, item: 'Selecione um produto da lista' }));
      return;
    }

    if (itemTemp.quantidadeMax !== null && itemTemp.quantidade > itemTemp.quantidadeMax) {
      setErrors(prev => ({
        ...prev,
        item: `A quantidade não pode exceder o estoque máximo (${itemTemp.quantidadeMax} ${itemTemp.unidade})`
      }));
      return;
    }

    const mesmoItem = (it) => (itemTemp.materialId != null
      ? it.materialId === itemTemp.materialId
      : it.materialNome === itemTemp.materialNome.trim());
    const existente = formData.itens.find(mesmoItem);

    if (existente) {
      const somada = existente.quantidade + itemTemp.quantidade;
      if (itemTemp.quantidadeMax !== null && somada > itemTemp.quantidadeMax) {
        setErrors(prev => ({
          ...prev,
          item: `Este material já está no pedido. O total (${somada}) excede o estoque (${itemTemp.quantidadeMax} ${itemTemp.unidade})`
        }));
        return;
      }
      setFormData(prev => ({
        ...prev,
        itens: prev.itens.map(it => (mesmoItem(it) ? { ...it, quantidade: somada } : it))
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        itens: [
          ...prev.itens,
          {
            materialId: itemTemp.materialId,
            materialNome: itemTemp.materialNome.trim(),
            quantidade: itemTemp.quantidade,
            unidade: itemTemp.unidade || 'UN',
            quantidadeMax: itemTemp.quantidadeMax
          }
        ]
      }));
    }

    setItemTemp(ITEM_VAZIO);
    setProductSearch('');
    setErrors(prev => ({ ...prev, item: null, itens: null }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      itens: prev.itens.filter((_, i) => i !== index)
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.usuario.trim()) {
      newErrors.usuario = 'O solicitante é obrigatório';
    }

    if (!formData.itens || formData.itens.length === 0) {
      newErrors.itens = 'Adicione ao menos um material ao pedido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) return;

    const dataFinal = {
      ...(initialData?.id ? { id: initialData.id } : { id: Date.now() }),
      usuario: formData.usuario.trim(),
      prioridade: formData.prioridade,
      justificativa: formData.justificativa.trim(),
      itens: formData.itens,
      materiais: formData.itens.map(i => `${i.materialNome} (${i.quantidade} ${i.unidade})`),
      data: initialData?.data || new Date().toISOString().split('T')[0],
      status: initialData?.status || 'Pendente',
      dataAtualizacao: new Date().toISOString()
    };

    onSave(dataFinal);
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="modal-container modal-container--pedidos" role="dialog" aria-modal="true" aria-labelledby="order-modal-title" tabIndex={-1}>
        {/* Header no mesmo padrão do cadastro de materiais */}
        <div className="modal-header">
          <div className="modal-header__title-wrap">
            <div className="modal-header__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <h3 id="order-modal-title">{initialData ? 'Editar Pedido de Material' : 'Cadastrar Novo Pedido'}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="modal-grid">
            {/* Solicitante */}
            <div className="form-group">
              <label className="form-label" htmlFor="order-requester">Solicitante *</label>
              {usuariosDisponiveis.length > 0 ? (
                <select
                  id="order-requester"
                  name="usuario"
                  value={formData.usuario}
                  onChange={handleChange}
                  className={`form-select ${errors.usuario ? 'form-input--error' : ''}`}
                  required
                  aria-invalid={Boolean(errors.usuario)}
                  aria-describedby={errors.usuario ? 'order-requester-error' : undefined}
                >
                  <option value="">Selecione o solicitante...</option>
                  {usuariosDisponiveis.map((u, idx) => {
                    const nome = typeof u === 'string' ? u : u.nome;
                    return (
                      <option key={idx} value={nome}>{nome}</option>
                    );
                  })}
                </select>
              ) : (
                <input
                  id="order-requester"
                  name="usuario"
                  type="text"
                  placeholder="Nome do usuário solicitante"
                  value={formData.usuario}
                  onChange={handleChange}
                  className={`form-input ${errors.usuario ? 'form-input--error' : ''}`}
                  required
                  aria-invalid={Boolean(errors.usuario)}
                  aria-describedby={errors.usuario ? 'order-requester-error' : undefined}
                />
              )}
              {errors.usuario && <span id="order-requester-error" className="form-error-msg" role="alert">{errors.usuario}</span>}
            </div>

            {/* Prioridade */}
            <div className="form-group">
              <label className="form-label" htmlFor="order-priority">Prioridade</label>
              <select
                id="order-priority"
                name="prioridade"
                value={formData.prioridade}
                onChange={handleChange}
                className="form-select"
              >
                <option value="Normal">Normal</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* Justificativa */}
          <div className="form-group margin-top-sm">
            <label className="form-label" htmlFor="order-reason">Justificativa / Motivo</label>
            <input
              id="order-reason"
              name="justificativa"
              type="text"
              placeholder="Ex: Reposição para início de semestre letivo"
              value={formData.justificativa}
              onChange={handleChange}
              className="form-input"
            />
          </div>

          {/* Seção de Itens do Pedido */}
          <div className="pedido-itens-section margin-top-sm">
            <div className="itens-section-header">
              <label className="form-label">
                Itens do Pedido <span className="required-star">*</span>
              </label>
              <span className="itens-counter">
                {formData.itens.length} {formData.itens.length === 1 ? 'item adicionado' : 'itens adicionados'}
              </span>
            </div>

            {/* Linha para adicionar item com busca de produto e quantidade máxima */}
            <div className="adicionar-item-box" ref={dropdownRef}>
              <div className="item-search-wrapper">
                <input
                  id="order-product-search"
                  type="text"
                  placeholder="Pesquise o produto pelo nome..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  className="form-input"
                  aria-label="Pesquisar material"
                  role="combobox"
                  aria-expanded={isDropdownOpen}
                  aria-controls="order-product-options"
                  aria-autocomplete="list"
                />

                {isDropdownOpen && (
                  <div id="order-product-options" className="modal-product-dropdown" role="listbox" aria-label="Materiais disponíveis">
                    {materiaisFiltrados.length === 0 ? (
                      <div className="modal-dropdown-empty">
                        {listaMateriais.length === 0
                          ? 'Nenhum material cadastrado no estoque'
                          : 'Nenhum material encontrado'}
                      </div>
                    ) : (
                      materiaisFiltrados.map(m => (
                        <button
                          type="button"
                          key={m.id}
                          className="modal-dropdown-item"
                          onClick={() => handleSelectMaterial(m)}
                          role="option"
                          aria-selected={itemTemp.materialNome === m.nome}
                        >
                          <span className="dropdown-item-title">{m.nome}</span>
                          <span className="dropdown-item-badge">
                            {m.quantidadeMax !== null ? `Máx: ${m.quantidadeMax} ${m.unidade}` : m.unidade}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Quantidade */}
              <div className="item-qtd-wrapper">
                <input
                  aria-label="Quantidade do material"
                  type="number"
                  name="quantidade"
                  min="1"
                  max={itemTemp.quantidadeMax || undefined}
                  value={itemTemp.quantidade}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 1);
                    setItemTemp(p => ({
                      ...p,
                      quantidade: itemTemp.quantidadeMax !== null ? Math.min(val, itemTemp.quantidadeMax) : val
                    }));
                  }}
                  className="form-input"
                  title={itemTemp.quantidadeMax !== null ? `Máximo permitido: ${itemTemp.quantidadeMax}` : ''}
                />
              </div>

              {/* Unidade */}
              <div className="item-und-wrapper">
                <span className="item-unit-display">{itemTemp.unidade || 'UN'}</span>
              </div>

              {/* Botão Incluir */}
              <button
                type="button"
                className="btn-add-item"
                onClick={handleAddItem}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Incluir
              </button>
            </div>

            {itemTemp.materialNome && itemTemp.quantidadeMax !== null && (
              <span className="item-max-hint">
                Disponível em estoque: <strong>{itemTemp.quantidadeMax} {itemTemp.unidade}</strong>
              </span>
            )}

            {errors.item && <span className="form-error-msg">{errors.item}</span>}
            {errors.itens && <span className="form-error-msg">{errors.itens}</span>}

            {/* Lista dos itens incluídos */}
            {formData.itens.length > 0 ? (
              <div className="itens-lista">
                {formData.itens.map((it, idx) => (
                  <div key={idx} className="item-row-badge">
                    <span className="item-nome">{it.materialNome}</span>
                    <span className="item-badge-qtd">{it.quantidade} {it.unidade}</span>
                    <button
                      type="button"
                      className="btn-remove-item"
                      onClick={() => handleRemoveItem(idx)}
                      title="Remover item"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="itens-empty-note">
                Nenhum item adicionado a este pedido ainda.
              </div>
            )}
          </div>

          {/* Footer idêntico ao de Cadastro de Materiais */}
          <div className="modal-footer">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-modal-submit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {initialData ? 'Salvar Alterações' : 'Cadastrar Pedido'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default NovoPedidoModal;
