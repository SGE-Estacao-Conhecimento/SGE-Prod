import React from 'react';

/**
 * FilterChip — Botão de Opção de Filtro Padronizado do SGE (Padrão Almoxarife)
 * 
 * Implementa o design e microinteração física padrão do Almoxarife:
 * - Formato pílula (raio 9999px) com fundo #F8FAFC e borda #E2E8F0.
 * - Ponto indicador de status operacional opcional (.sge-filter-chip__dot).
 * - Badge numérico integrado com a quantidade de itens na categoria/status.
 * - Feedback tátil físico instantâneo (:active transform: scale(0.96)).
 * - Estado ativo na cor institucional #017F7B com sombra e badge contrastante.
 */
const FilterChip = ({
  label,
  count,
  isActive = false,
  onClick,
  dotColor,
  dotClass = '',
  className = '',
  ariaLabel
}) => {
  return (
    <button
      type="button"
      className={`sge-filter-chip ${isActive ? 'sge-filter-chip--active' : ''} ${className}`}
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={ariaLabel || `${label} (${count !== undefined ? count : ''})`}
    >
      {dotColor && (
        <span
          className="sge-filter-chip__dot"
          style={{ background: isActive ? '#FFFFFF' : dotColor }}
        />
      )}
      {!dotColor && dotClass && (
        <span className={`sge-filter-chip__dot ${dotClass}`} />
      )}
      <span className="sge-filter-chip__label">{label}</span>
      {count !== undefined && count !== null && (
        <span className="sge-filter-chip__badge">{count}</span>
      )}
    </button>
  );
};

export default FilterChip;
