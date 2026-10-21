import React from 'react';

/**
 * SearchFilterBar — Barra Universal de Pesquisa e Gatilho de Filtro
 * 
 * Unifica a barra de busca e botão de filtro para todo o catálogo do SGE:
 * - Ícone SVG de busca e campo com limpeza rápida (botão ×).
 * - Botão de filtro com alternância de estado ativo e ponto indicador de filtro aplicado.
 * - Foco nítido com anel suave na cor do sistema (#017F7B).
 */
const SearchFilterBar = ({
  searchTerm = '',
  onSearchChange,
  onClear,
  placeholder = 'Buscar materiais, códigos...',
  hasActiveFilter = false,
  isFilterOpen = false,
  onToggleFilter,
  filterAriaLabel,
  className = '',
  inputRef
}) => {
  return (
    <div className={`sge-search-wrapper ${className}`}>
      <div className="sge-search-box">
        <svg
          className="sge-search-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          className="sge-search-input"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchChange?.(e.target.value)}
          enterKeyHint="search"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.target.blur();
            }
          }}
          aria-label={placeholder}
        />

        {searchTerm && (
          <button
            type="button"
            className="sge-search-clear-btn"
            onClick={onClear}
            aria-label="Limpar busca"
          >
            &times;
          </button>
        )}

        <button
          type="button"
          className={`sge-filter-toggle-btn ${isFilterOpen ? 'sge-filter-toggle-btn--active' : ''}`}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleFilter?.();
          }}
          aria-label={filterAriaLabel || (isFilterOpen ? "Fechar filtros" : "Abrir filtros")}
          title={isFilterOpen ? "Ocultar filtros" : "Mostrar filtros"}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="15" y1="3" x2="15" y2="9" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="9" y1="9" x2="9" y2="15" />
            <line x1="3" y1="18" x2="21" y2="18" />
            <line x1="17" y1="15" x2="17" y2="21" />
          </svg>
          {hasActiveFilter && <span className="sge-filter-active-dot" />}
        </button>
      </div>
    </div>
  );
};

export default SearchFilterBar;
