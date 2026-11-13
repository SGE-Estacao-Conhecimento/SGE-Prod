import React, { useState, useEffect } from 'react';
import { useDialogAccessibility } from '../common';
import './TombamentoModal.css';

const CATEGORIAS_PADRAO = [
  'Mobiliário',
  'Eletrodomésticos',
  'Equipamentos de TI',
  'Ferramentas',
  'Eletrônicos',
  'Utensílios',
  'Outros'
];

const ESTADOS_CONSERVACAO = [
  { value: 'novo', label: 'Novo' },
  { value: 'bom', label: 'Bom' },
  { value: 'regular', label: 'Regular' },
  { value: 'danificado', label: 'Danificado' },
  { value: 'em_manutencao', label: 'Em Manutenção' }
];

const TombamentoModal = ({
  isOpen,
  onClose,
  onSave,
  catalogo = [],
  ambientes = [],
  usuarios = [],
  ambientePadraoId = null,
  initialData = null
}) => {
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useDialogAccessibility({ isOpen, onClose: submitting ? undefined : onClose });

  const [isNovoModelo, setIsNovoModelo] = useState(false);
  const [formData, setFormData] = useState({
    patrimonioId: '',
    novoPatrimonioNome: '',
    categoria: 'Mobiliário',
    marca: '',
    modelo: '',
    numeroPatrimonio: '',
    numeroSerie: '',
    ambienteId: '',
    responsavelUsuarioId: '',
    estadoConservacao: 'bom',
    dataAquisicao: '',
    observacoes: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setIsNovoModelo(false);
      setFormData({
        patrimonioId: initialData.patrimonioId || '',
        novoPatrimonioNome: '',
        categoria: initialData.categoria || 'Mobiliário',
        marca: initialData.marca || '',
        modelo: initialData.modelo || '',
        numeroPatrimonio: initialData.numeroPatrimonio || '',
        numeroSerie: initialData.numeroSerie || '',
        ambienteId: initialData.ambienteId || '',
        responsavelUsuarioId: initialData.responsavelId || '',
        estadoConservacao: initialData.estadoConservacao || 'bom',
        dataAquisicao: initialData.dataAquisicao || '',
        observacoes: initialData.observacoes || ''
      });
    } else {
      const primeiroCat = catalogo.length > 0 ? catalogo[0].id : '';
      setIsNovoModelo(catalogo.length === 0);
      setFormData({
        patrimonioId: primeiroCat,
        novoPatrimonioNome: '',
        categoria: 'Mobiliário',
        marca: '',
        modelo: '',
        numeroPatrimonio: '',
        numeroSerie: '',
        ambienteId: ambientePadraoId || '',
        responsavelUsuarioId: '',
        estadoConservacao: 'bom',
        dataAquisicao: '',
        observacoes: ''
      });
    }
    setErrors({});
  }, [initialData, isOpen, ambientePadraoId, catalogo]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (isNovoModelo) {
      if (!formData.novoPatrimonioNome.trim()) {
        newErrors.novoPatrimonioNome = 'Informe o nome do modelo do patrimônio.';
      }
    } else {
      if (!formData.patrimonioId) {
        newErrors.patrimonioId = 'Selecione um modelo de patrimônio.';
      }
    }

    if (!formData.numeroPatrimonio.trim()) {
      newErrors.numeroPatrimonio = 'Informe o número da plaqueta de patrimônio.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        ...formData,
        id: initialData?.id,
        patrimonioId: isNovoModelo ? null : Number(formData.patrimonioId),
        ambienteId: formData.ambienteId ? Number(formData.ambienteId) : null,
        responsavelUsuarioId: formData.responsavelUsuarioId ? Number(formData.responsavelUsuarioId) : null
      });
      onClose();
    } catch (err) {
      setErrors({ form: err?.message || 'Erro ao registrar patrimônio.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tombamento-modal__overlay" role="presentation">
      <div
        className="tombamento-modal__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tombamento-modal-title"
      >
        <div className="tombamento-modal__header">
          <div>
            <h3 id="tombamento-modal-title" className="tombamento-modal__title">
              {initialData ? 'Editar Patrimônio Tombado' : 'Tombear Novo Patrimônio'}
            </h3>
            <p className="tombamento-modal__subtitle">
              Vincule o número da plaqueta ao modelo e destine ao ambiente físico ou responsável.
            </p>
          </div>
          <button
            type="button"
            className="tombamento-modal__close-btn"
            onClick={onClose}
            aria-label="Fechar modal"
            disabled={submitting}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="tombamento-modal__form">
          {errors.form && (
            <div className="tombamento-modal__error-banner" role="alert">
              <span>{errors.form}</span>
            </div>
          )}

          {/* Seção 1: Modelo / Catálogo do Bem Durável */}
          <div className="tombamento-modal__section">
            <div className="tombamento-modal__section-header">
              <span className="tombamento-modal__section-title">1. Modelo do Bem Durável</span>
              {!initialData && (
                <button
                  type="button"
                  className="tombamento-modal__toggle-mode-btn"
                  onClick={() => setIsNovoModelo(prev => !prev)}
                >
                  {isNovoModelo ? 'Selecionar modelo existente' : '+ Criar novo modelo'}
                </button>
              )}
            </div>

            {!isNovoModelo ? (
              <div className="tombamento-modal__field">
                <label htmlFor="select-patrimonio-modelo" className="tombamento-modal__label">
                  Selecione o Modelo <span className="tombamento-modal__required">*</span>
                </label>
                <select
                  id="select-patrimonio-modelo"
                  className={`tombamento-modal__select ${errors.patrimonioId ? 'tombamento-modal__input--error' : ''}`}
                  value={formData.patrimonioId}
                  onChange={(e) => handleChange('patrimonioId', e.target.value)}
                  disabled={Boolean(initialData)}
                >
                  <option value="">Selecione um modelo...</option>
                  {catalogo.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.categoria}){c.marca ? ` - ${c.marca}` : ''}
                    </option>
                  ))}
                </select>
                {errors.patrimonioId && <span className="tombamento-modal__error-text">{errors.patrimonioId}</span>}
              </div>
            ) : (
              <div className="tombamento-modal__row">
                <div className="tombamento-modal__field tombamento-modal__field--flex-2">
                  <label htmlFor="input-novo-modelo-nome" className="tombamento-modal__label">
                    Nome do Bem Durável <span className="tombamento-modal__required">*</span>
                  </label>
                  <input
                    id="input-novo-modelo-nome"
                    type="text"
                    className={`tombamento-modal__input ${errors.novoPatrimonioNome ? 'tombamento-modal__input--error' : ''}`}
                    placeholder="Ex: Fogão Industrial 4 Bocas, Cadeira Giratória..."
                    value={formData.novoPatrimonioNome}
                    onChange={(e) => handleChange('novoPatrimonioNome', e.target.value)}
                  />
                  {errors.novoPatrimonioNome && <span className="tombamento-modal__error-text">{errors.novoPatrimonioNome}</span>}
                </div>

                <div className="tombamento-modal__field tombamento-modal__field--flex-1">
                  <label htmlFor="select-novo-modelo-categoria" className="tombamento-modal__label">
                    Categoria <span className="tombamento-modal__required">*</span>
                  </label>
                  <select
                    id="select-novo-modelo-categoria"
                    className="tombamento-modal__select"
                    value={formData.categoria}
                    onChange={(e) => handleChange('categoria', e.target.value)}
                  >
                    {CATEGORIAS_PADRAO.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Seção 2: Identificação do Exemplar Físico (Plaqueta e Série) */}
          <div className="tombamento-modal__section">
            <span className="tombamento-modal__section-title">2. Identificação da Plaqueta</span>
            <div className="tombamento-modal__row">
              <div className="tombamento-modal__field tombamento-modal__field--flex-1">
                <label htmlFor="input-numero-patrimonio" className="tombamento-modal__label">
                  Nº do Patrimônio (Plaqueta) <span className="tombamento-modal__required">*</span>
                </label>
                <input
                  id="input-numero-patrimonio"
                  type="text"
                  className={`tombamento-modal__input ${errors.numeroPatrimonio ? 'tombamento-modal__input--error' : ''}`}
                  placeholder="Ex: 00124 ou PAT-052"
                  value={formData.numeroPatrimonio}
                  onChange={(e) => handleChange('numeroPatrimonio', e.target.value)}
                />
                {errors.numeroPatrimonio && <span className="tombamento-modal__error-text">{errors.numeroPatrimonio}</span>}
              </div>

              <div className="tombamento-modal__field tombamento-modal__field--flex-1">
                <label htmlFor="input-numero-serie" className="tombamento-modal__label">
                  Nº de Série do Fabricante
                </label>
                <input
                  id="input-numero-serie"
                  type="text"
                  className="tombamento-modal__input"
                  placeholder="Opcional (ex: SN984214)"
                  value={formData.numeroSerie}
                  onChange={(e) => handleChange('numeroSerie', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Alocação (Ambiente e Pessoa Responsável) */}
          <div className="tombamento-modal__section">
            <span className="tombamento-modal__section-title">3. Destinação e Responsabilidade</span>
            <div className="tombamento-modal__row">
              <div className="tombamento-modal__field tombamento-modal__field--flex-1">
                <label htmlFor="select-patrimonio-ambiente" className="tombamento-modal__label">
                  Ambiente de Instalação
                </label>
                <select
                  id="select-patrimonio-ambiente"
                  className="tombamento-modal__select"
                  value={formData.ambienteId}
                  onChange={(e) => handleChange('ambienteId', e.target.value)}
                >
                  <option value="">Sem ambiente definido</option>
                  {ambientes.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </div>

              <div className="tombamento-modal__field tombamento-modal__field--flex-1">
                <label htmlFor="select-patrimonio-responsavel" className="tombamento-modal__label">
                  Pessoa Vinculada (Responsável)
                </label>
                <select
                  id="select-patrimonio-responsavel"
                  className="tombamento-modal__select"
                  value={formData.responsavelUsuarioId}
                  onChange={(e) => handleChange('responsavelUsuarioId', e.target.value)}
                >
                  <option value="">Nenhum colaborador vinculado</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nome} ({u.perfil})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="tombamento-modal__row">
              <div className="tombamento-modal__field tombamento-modal__field--flex-1">
                <label htmlFor="select-estado-conservacao" className="tombamento-modal__label">
                  Estado de Conservação
                </label>
                <select
                  id="select-estado-conservacao"
                  className="tombamento-modal__select"
                  value={formData.estadoConservacao}
                  onChange={(e) => handleChange('estadoConservacao', e.target.value)}
                >
                  {ESTADOS_CONSERVACAO.map(est => (
                    <option key={est.value} value={est.value}>{est.label}</option>
                  ))}
                </select>
              </div>

              <div className="tombamento-modal__field tombamento-modal__field--flex-1">
                <label htmlFor="input-data-aquisicao" className="tombamento-modal__label">
                  Data de Aquisição / Entrada
                </label>
                <input
                  id="input-data-aquisicao"
                  type="date"
                  className="tombamento-modal__input"
                  value={formData.dataAquisicao}
                  onChange={(e) => handleChange('dataAquisicao', e.target.value)}
                />
              </div>
            </div>

            <div className="tombamento-modal__field">
              <label htmlFor="input-observacoes" className="tombamento-modal__label">
                Observações
              </label>
              <textarea
                id="input-observacoes"
                className="tombamento-modal__textarea"
                rows="2"
                placeholder="Detalhes adicionais, notas fiscais ou condição específica do item..."
                value={formData.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
              />
            </div>
          </div>

          <div className="tombamento-modal__footer">
            <button
              type="button"
              className="tombamento-modal__cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="tombamento-modal__submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Tombear Patrimônio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TombamentoModal;

