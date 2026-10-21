import React from 'react';

/**
 * FilterGroup — Grupo Estruturado de Filtros do SGE
 * 
 * Exibe o título formal do grupo em maiúsculas suaves e organiza as opções
 * em chips flexíveis e escaneáveis.
 */
export const FilterGroup = ({ title, action, children, className = '' }) => (
  <div className={`sge-filter-group ${className}`}>
    <div className="sge-filter-group__header">
      <span className="sge-filter-group__title">{title}</span>
      {action}
    </div>
    <div className="sge-filter-group__chips">
      {children}
    </div>
  </div>
);

/**
 * FilterDrawer — Gaveta Acordeão de Filtros Padronizada
 * 
 * - Animação suave e contínua via grid CSS (sem sobressaltos de layout).
 * - Fundo branco, cantos arredondados (12px), leve sombreamento e borda sutil.
 */
const FilterDrawer = ({
  isOpen = false,
  children,
  className = ''
}) => {
  return (
    <div className={`sge-accordion ${isOpen ? 'sge-accordion--open' : ''} ${className}`}>
      <div className="sge-accordion-inner">
        <div className="sge-filters-box">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FilterDrawer;
