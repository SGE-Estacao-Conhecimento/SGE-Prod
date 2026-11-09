import React, { useState, useEffect } from 'react';
import './NovoMaterialModal.css';
import { useDialogAccessibility } from '../common';
import { LISTA_COMPLEXOS } from '../AlmoxarifeEstoque/AlmoxarifeEstoque';

const CATEGORIAS = [
  'Escritório',
  'Limpeza e Higiene',
  'Material Didático',
  'Informática / TI',
  'Esportes e Lazer',
  'Alimentação',
  'Outros'
];

const UNIDADES = [
  { value: 'UN', label: 'Unidade (UN)' },
  { value: 'CX', label: 'Caixa (CX)' },
  { value: 'PCT', label: 'Pacote (PCT)' },
  { value: 'KG', label: 'Quilograma (KG)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'RL', label: 'Rolo (RL)' },
];

const NovoMaterialModal = ({ isOpen, onClose, onSave, initialData = null }) => {
  const dialogRef = useDialogAccessibility({ isOpen, onClose });
  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    categoria: 'Escritório',
    unidade: 'UN',
    quantidade: 0,
    estoqueMinimo: 5,
    complexo: 'Almoxarifado Central',
    localizacao: '',
    descricao: '',
    bemDuravel: false
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        codigo: initialData.codigo || '',
        nome: initialData.nome || '',
        categoria: initialData.categoria || 'Escritório',
        unidade: initialData.unidade || 'UN',
        quantidade: initialData.quantidade ?? 0,
        estoqueMinimo: initialData.estoqueMinimo ?? 5,
        complexo: initialData.complexo || 'Almoxarifado Central',
        localizacao: initialData.localizacao || '',
        descricao: initialData.descricao || '',
        bemDuravel: Boolean(initialData.bemDuravel)
      });
    } else {
      setFormData({
        codigo: '',
        nome: '',
        categoria: 'Escritório',
        unidade: 'UN',
        quantidade: 0,
        estoqueMinimo: 5,
        complexo: 'Almoxarifado Central',
        localizacao: '',
        descricao: '',
        bemDuravel: false
      });
    }
    setErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantidade' || name === 'estoqueMinimo' ? Number(value) : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.nome.trim()) newErrors.nome = 'Nome do material é obrigatório';
    if (!formData.codigo.trim()) newErrors.codigo = 'Código / SKU é obrigatório';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Calcula status com base no estoque
    let status = 'ok';
    if (formData.quantidade === 0) {
      status = 'critico';
    } else if (formData.quantidade <= formData.estoqueMinimo) {
      status = 'baixo';
    }

    onSave({
      ...formData,
      status,
      bemDuravel: Boolean(formData.bemDuravel),
      // Só a edição leva o id; no cadastro o id é definido pelo servidor (ou pelo modo simulado).
      id: initialData ? initialData.id : undefined
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="modal-container" role="dialog" aria-modal="true" aria-labelledby="material-modal-title" tabIndex={-1}>
        <div className="modal-header">
          <div className="modal-header__title-wrap">
            <div className="modal-header__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <h3 id="material-modal-title">{initialData ? 'Editar Material' : 'Cadastrar Novo Material'}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="modal-grid">
            {/* Código / SKU */}
            <div className="form-group">
              <label className="form-label" htmlFor="material-codigo">Código / SKU *</label>
              <input
                id="material-codigo"
                type="text"
                name="codigo"
                className={`form-input ${errors.codigo ? 'form-input--error' : ''}`}
                placeholder="Ex: MAT-104"
                value={formData.codigo}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.codigo)}
                aria-describedby={errors.codigo ? 'material-codigo-error' : undefined}
              />
              {errors.codigo && <span id="material-codigo-error" className="form-error-msg" role="alert">{errors.codigo}</span>}
            </div>

            {/* Nome do Material */}
            <div className="form-group">
              <label className="form-label" htmlFor="material-nome">Nome do Material *</label>
              <input
                id="material-nome"
                type="text"
                name="nome"
                className={`form-input ${errors.nome ? 'form-input--error' : ''}`}
                placeholder="Ex: Papel A4 Sulfite 75g"
                value={formData.nome}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.nome)}
                aria-describedby={errors.nome ? 'material-nome-error' : undefined}
              />
              {errors.nome && <span id="material-nome-error" className="form-error-msg" role="alert">{errors.nome}</span>}
            </div>

            {/* Categoria */}
            <div className="form-group">
              <label className="form-label" htmlFor="material-categoria">Categoria</label>
              <select
                id="material-categoria"
                name="categoria"
                className="form-select"
                value={formData.categoria}
                onChange={handleChange}
              >
                {CATEGORIAS.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Unidade de Medida */}
            <div className="form-group">
              <label className="form-label" htmlFor="material-unidade">Unidade de Medida</label>
              <select
                id="material-unidade"
                name="unidade"
                className="form-select"
                value={formData.unidade}
                onChange={handleChange}
              >
                {UNIDADES.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>

            {/* Quantidade Inicial */}
            <div className="form-group">
              <label className="form-label" htmlFor="material-quantidade">Qtd. Inicial em Estoque</label>
              <input
                id="material-quantidade"
                type="number"
                name="quantidade"
                min="0"
                className="form-input"
                value={formData.quantidade}
                onChange={handleChange}
              />
            </div>

            {/* Estoque Mínimo */}
            <div className="form-group">
              <label className="form-label" htmlFor="material-minimo">Estoque Mínimo (Alerta)</label>
              <input
                id="material-minimo"
                type="number"
                name="estoqueMinimo"
                min="0"
                className="form-input"
                value={formData.estoqueMinimo}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Complexo e Localização */}
          <div className="form-row margin-top-sm">
            <div className="form-group flex-1">
              <label className="form-label" htmlFor="material-complexo">Complexo</label>
              <select
                id="material-complexo"
                name="complexo"
                className="form-select"
                value={formData.complexo}
                onChange={handleChange}
              >
                {LISTA_COMPLEXOS.map(comp => (
                  <option key={comp} value={comp}>{comp}</option>
                ))}
              </select>
            </div>

            <div className="form-group flex-1">
              <label className="form-label" htmlFor="material-localizacao">Localização (Armário / Prateleira)</label>
              <input
                id="material-localizacao"
                type="text"
                name="localizacao"
                className="form-input"
                placeholder="Ex: Armário 3, Prateleira 2"
                value={formData.localizacao}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="form-group margin-top-sm">
            <label className="form-label" htmlFor="material-descricao">Observações / Descrição</label>
            <textarea
              id="material-descricao"
              name="descricao"
              className="form-textarea"
              rows="3"
              placeholder="Detalhes adicionais do material ou especificações técnicas..."
              value={formData.descricao}
              onChange={handleChange}
            />
          </div>

          {/* Tipo de Material: Patrimônio / Bem Durável */}
          <div className="form-group margin-top-sm">
            <label className="modal-checkbox-label" htmlFor="material-bem-duravel">
              <input
                id="material-bem-duravel"
                type="checkbox"
                name="bemDuravel"
                checked={Boolean(formData.bemDuravel)}
                onChange={(e) => setFormData((prev) => ({ ...prev, bemDuravel: e.target.checked }))}
              />
              <span className="modal-checkbox-text">Item Permanente / Patrimônio (Bem Durável)</span>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-modal-submit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {initialData ? 'Salvar Alterações' : 'Cadastrar Material'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default NovoMaterialModal;
