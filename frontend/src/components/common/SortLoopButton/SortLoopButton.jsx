import React from 'react';

/**
 * SortLoopButton — Botão de Ordenação Inteligente em Loop do SGE
 * 
 * Atende às diretrizes mandatórias de design:
 * - Dimensões estritamente fixas (128px de largura x 27px de altura) prevenindo Layout Shift (CLS zero).
 * - Ícone SVG de setas bidirecionais com micro-rotação tátil no clique ativo (:active).
 * - Alinhamento óptico preciso e tipografia semibold na cor institucional #017F7B.
 */
const SortLoopButton = ({
  currentLabel,
  onToggleSort,
  title,
  ariaLabel,
  className = ''
}) => {
  return (
    <button
      type="button"
      className={`sge-sort-btn ${className}`}
      onClick={onToggleSort}
      title={title || `Ordenado por: ${currentLabel}. Toque para alternar.`}
      aria-label={ariaLabel || `Alternar ordenação dos materiais. Atual: ${currentLabel}`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m3 16 4 4 4-4" />
        <path d="M7 20V4" />
        <path d="m21 8-4-4-4 4" />
        <path d="M17 4v16" />
      </svg>
      <span className="sge-sort-btn-label">
        {currentLabel}
      </span>
    </button>
  );
};

export default SortLoopButton;
