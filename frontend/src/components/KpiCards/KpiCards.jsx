import React from 'react';
import './KpiCards.css';

// Estrutura dos cards — valores virão do backend (props)
const kpiConfig = [
  {
    id: 'usuarios',
    label: 'Usuários',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    color: '#8B5CF6',
  },
  {
    id: 'pedidos-pendentes',
    label: 'Pedidos Pendentes',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12,6 12,12 16,14"/>
      </svg>
    ),
    color: '#F59E0B',
  },
];

/**
 * KpiCards
 * Props esperadas do backend:
 * @param {Object} data - { usuarios, pedidosPendentes }
 * @param {Function} onNavigate - callback para navegar pelas telas
 */
const KpiCards = ({ data = {}, onNavigate }) => {
  const values = {
    'usuarios':          data.usuarios          ?? '—',
    'pedidos-pendentes': data.pedidosPendentes  ?? '—',
  };

  const navMap = {
    'usuarios':          'usuarios',
    'pedidos-pendentes': 'pedidos',
  };

  return (
    <div className="kpi-grid">
      {kpiConfig.map(card => (
        <div
          className={`kpi-card ${onNavigate ? 'kpi-card--interactive' : ''}`}
          id={`kpi-${card.id}`}
          key={card.id}
          onClick={() => onNavigate && onNavigate(navMap[card.id])}
          title={onNavigate ? `Ir para ${card.label}` : ''}
        >
          <div className="kpi-card__header">
            <span className="kpi-card__label">{card.label}</span>
            <div className="kpi-card__icon" style={{ background: `${card.color}18`, color: card.color }}>
              {card.icon}
            </div>
          </div>
          <div className={`kpi-card__value ${values[card.id] === '—' ? 'kpi-card__value--empty' : ''}`}>
            {values[card.id]}
          </div>
          <div className="kpi-card__empty-label">
            Aguardando dados do sistema
          </div>
        </div>
      ))}
    </div>
  );
};

export default KpiCards;
