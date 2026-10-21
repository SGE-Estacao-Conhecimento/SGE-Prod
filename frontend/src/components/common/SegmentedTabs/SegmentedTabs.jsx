import React from 'react';
import { motion } from 'motion/react';
import './SegmentedTabs.css';

/**
 * SegmentedTabs — Controle Segmentado / Abas em Pílula Padronizado do SGE (A Geral)
 * 
 * Alternância de abas fluida com Motion Spring Capsule, zero layout shifts,
 * acessibilidade completa (role="tablist", aria-selected) e suporte a ícones e badges.
 * 
 * @param {Array<{ id: string, label: string, icon?: React.ReactNode, badge?: number|string }>} tabs - Lista de abas
 * @param {string} activeTab - ID da aba ativa
 * @param {Function} onChange - Callback ao trocar de aba (recebe id)
 * @param {string} [layoutId='sgeSegmentedIndicator'] - ID único para a animação da cápsula Framer Motion
 * @param {'sm'|'md'} [size='md'] - Tamanho do controle
 * @param {string} [className=''] - Classes adicionais
 * @param {string} [ariaLabel='Abas de navegação'] - Rótulo de acessibilidade
 */
const SegmentedTabs = ({
  tabs = [],
  activeTab,
  onChange,
  layoutId = 'sgeSegmentedIndicator',
  size = 'md',
  className = '',
  ariaLabel = 'Abas de navegação'
}) => {
  return (
    <div
      className={`sge-segmented-tabs sge-segmented-tabs--${size} ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`sge-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`sge-segmented-tab ${isActive ? 'sge-segmented-tab--active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="sge-segmented-tab__indicator"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <span className="sge-segmented-tab__content">
              {tab.icon && <span className="sge-segmented-tab__icon">{tab.icon}</span>}
              <span className="sge-segmented-tab__label">{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== null && tab.badge !== '' && (
                <span className={`sge-segmented-tab__badge ${isActive ? 'sge-segmented-tab__badge--active' : ''}`}>
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedTabs;
