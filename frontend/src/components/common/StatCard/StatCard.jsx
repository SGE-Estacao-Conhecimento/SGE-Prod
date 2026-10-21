import React from 'react';
import './StatCard.css';

/**
 * StatCard — Card de Métrica e Estatística Padronizado do SGE (A Geral)
 * 
 * Exibe métricas operacionais com alta densidade, tipografia estável
 * e resposta tátil rápida (:active scale 0.98).
 * 
 * @param {string|number} value - Número ou valor da métrica (ex: 12, "Estoque")
 * @param {string} label - Rótulo descritivo da métrica
 * @param {'default'|'accent'|'warning'|'success'|'danger'} [variant='default'] - Variante de cor
 * @param {React.ReactNode} [icon] - Ícone SVG opcional
 * @param {Function} [onClick] - Se fornecido, torna o card clicável/interativo
 * @param {string} [className=''] - Classes adicionais
 */
const StatCard = ({
  value,
  label,
  variant = 'default',
  icon,
  onClick,
  className = ''
}) => {
  const isClickable = typeof onClick === 'function';

  return (
    <div
      className={`sge-stat-card sge-stat-card--${variant} ${isClickable ? 'sge-stat-card--clickable' : ''} ${className}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {icon && <div className="sge-stat-card__icon">{icon}</div>}
      <div className="sge-stat-card__content">
        <span className="sge-stat-card__value">{value}</span>
        <span className="sge-stat-card__label">{label}</span>
      </div>
    </div>
  );
};

export default StatCard;
