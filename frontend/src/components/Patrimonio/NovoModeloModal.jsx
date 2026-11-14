import React, { useState } from 'react';
import { useDialogAccessibility } from '../common';
import './NovoModeloModal.css';

const CATEGORIAS_PADRAO = [
  'Mobiliário',
  'Equipamentos de TI',
  'Eletrodomésticos',
  'Ferramentas',
  'Eletrônicos',
  'Utensílios',
  'Veículos',
  'Outros'
];

const NovoModeloModal = ({
  isOpen,
  onClose,
  onSave,
  initialData = null
}) => {
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useDialogAccessibility({ isOpen, onClose: submitting ? undefined : onClose });

  const [formData, setFormData] = useState({
    nome: initialData?.nome || '',
    categoria: initialData?.categoria || 'Mobiliário',
    marca: initialData?.marca || '',
    modelo: initialData?.modelo || '',
    descricao: initialData?.descricao || ''
  });

  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!formData.nome.trim()) {
      errs.nome = 'Informe o nome do modelo de patrimônio.';
    } else if (formData.nome.trim().length > 150) {
      errs.nome = 'O nome pode ter no máximo 150 caracteres.';
    }
    if (!formData.categoria.trim()) {
      errs.categoria = 'Selecione a categoria.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSave({
        nome: formData.nome.trim(),
        categoria: formData.categoria.trim(),
        marca: formData.marca.trim() || undefined,
        modelo: formData.modelo.trim() || undefined,
        descricao: formData.descricao.trim() || undefined
      });
      onClose();
    } catch (err) {
      setErrors({ form: err?.message || 'Erro ao salvar modelo de patrimônio.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="novo-modelo-modal__overlay" role="presentation">
      <div
        className="novo-modelo-modal__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="novo-modelo-title"
      >
        <div className="novo-modelo-modal__header">
          <div>
            <span className="novo-modelo-modal__eyebrow">Catálogo Patrimonial</span>
            <h2 id="novo-modelo-title" className="novo-modelo-modal__title">
              {initialData ? 'Editar Modelo' : 'Novo Modelo de Patrimônio'}
            </h2>
          </div>
          <button
            type="button"
            className="novo-modelo-modal__close-btn"
            onClick={onClose}
            aria-label="Fechar modal"
            disabled={submitting}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="novo-modelo-modal__form">
          {errors.form && (
            <div className="novo-modelo-modal__error-banner" role="alert">
              <span>{errors.form}</span>
            </div>
          )}

          <div className="novo-modelo-modal__field">
            <label htmlFor="modelo-nome">
              Nome do Modelo <span className="required">*</span>
            </label>
            <input
              id="modelo-nome"
              type="text"
              placeholder="Ex: Armário de Aço 2 Portas, Notebook Dell Vostro, Cadeira Giratória"
              value={formData.nome}
              onChange={(e) => {
                setFormData({ ...formData, nome: e.target.value });
                if (errors.nome) setErrors({ ...errors, nome: null });
              }}
              className={errors.nome ? 'input-error' : ''}
              autoFocus
            />
            {errors.nome && <span className="field-error">{errors.nome}</span>}
          </div>

          <div className="novo-modelo-modal__row">
            <div className="novo-modelo-modal__field">
              <label htmlFor="modelo-categoria">
                Categoria <span className="required">*</span>
              </label>
              <select
                id="modelo-categoria"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
              >
                {CATEGORIAS_PADRAO.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="novo-modelo-modal__field">
              <label htmlFor="modelo-marca">Marca</label>
              <input
                id="modelo-marca"
                type="text"
                placeholder="Ex: Dell, Consul, Cavaletti"
                value={formData.marca}
                onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
              />
            </div>
          </div>

          <div className="novo-modelo-modal__field">
            <label htmlFor="modelo-versao">Modelo / Especificação</label>
            <input
              id="modelo-versao"
              type="text"
              placeholder="Ex: Vostro 3520 16GB, Standard 1.80m, Ergonômica NR17"
              value={formData.modelo}
              onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
            />
          </div>

          <div className="novo-modelo-modal__field">
            <label htmlFor="modelo-descricao">Descrição / Observações Gerais</label>
            <textarea
              id="modelo-descricao"
              rows="3"
              placeholder="Detalhes técnicos, dimensões ou especificações padrão deste modelo..."
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            />
          </div>

          <div className="novo-modelo-modal__footer">
            <button
              type="button"
              className="btn-cancelar"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-salvar"
              disabled={submitting}
            >
              {submitting ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Criar Modelo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NovoModeloModal;
