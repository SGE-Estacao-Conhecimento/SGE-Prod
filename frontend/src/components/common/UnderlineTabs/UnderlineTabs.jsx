import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import './UnderlineTabs.css';

/**
 * UnderlineTabs — Controle de Navegação em Abas Minimalista do SGE
 * 
 * - Ocupa apenas 34px de altura vertical (sem container pesado de fundo).
 * - Indicador inferior animado com Framer Motion Spring (layoutId).
 * - Alto contraste e affordance visual em todas as opções (ativas e inativas).
 * - Suporte a ícones SVG, badges numéricos e acessibilidade completa (role="tablist").
 * 
 * @param {Array<{ id: string, label: string, icon?: React.ReactNode, badge?: number|string }>} tabs - Lista de abas
 * @param {string} activeTab - ID da aba ativa
 * @param {Function} onChange - Callback ao trocar de aba (recebe id)
 * @param {string} [layoutId='sgeUnderlineIndicator'] - ID único para a animação do indicador
 * @param {'sm'|'md'} [size='md'] - Tamanho do controle
 * @param {string} [className=''] - Classes adicionais
 * @param {string} [ariaLabel='Abas de navegação'] - Rótulo de acessibilidade
 */
const UnderlineTabs = ({
  tabs = [],
  activeTab,
  onChange,
  layoutId = 'sgeUnderlineIndicator',
  size = 'md',
  className = '',
  ariaLabel = 'Abas de navegação'
}) => {
  const containerRef = useRef(null);

  return (
    <div
      ref={containerRef}
      className={`sge-underline-tabs sge-underline-tabs--${size} ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div className="sge-underline-tabs__track">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`sge-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`sge-underline-tab ${isActive ? 'sge-underline-tab--active' : ''}`}
              onClick={() => onChange(tab.id)}
            >
              <span className="sge-underline-tab__content">
                {tab.icon && (
                  <span className="sge-underline-tab__icon" aria-hidden="true">
                    {tab.icon}
                  </span>
                )}
                <span className="sge-underline-tab__label">{tab.label}</span>
                {tab.badge !== undefined && tab.badge !== null && tab.badge !== '' && (
                  <span className={`sge-underline-tab__badge ${isActive ? 'sge-underline-tab__badge--active' : ''}`}>
                    {tab.badge}
                  </span>
                )}
              </span>

              {isActive && (
                <motion.div
                  layoutId={layoutId}
                  className="sge-underline-tab__indicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default UnderlineTabs;

