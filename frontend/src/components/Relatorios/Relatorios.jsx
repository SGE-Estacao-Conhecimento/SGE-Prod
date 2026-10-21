import React from 'react';
import './Relatorios.css';

// Configuração estática dos cards (estrutura visual).
// Stats dinâmicos virão do backend via prop `stats`
const relatoriosConfig = [
  {
    id: 'relatorio-estoque',
    title: 'Relatório de Estoque',
    description: 'Visualize o status atual de todos os materiais em estoque, quantidades disponíveis e alertas de baixo estoque.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      </svg>
    ),
    color: '#10B981',
  },
  {
    id: 'relatorio-pedidos',
    title: 'Relatório de Pedidos',
    description: 'Acompanhe todos os pedidos por período, status, usuário e setor solicitante com filtros avançados.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    color: '#4A6CF7',
  },
  {
    id: 'relatorio-usuarios',
    title: 'Relatório de Usuários',
    description: 'Analise a atividade dos usuários, retiradas realizadas e histórico de movimentações por perfil.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    color: '#8B5CF6',
  },
];

/**
 * Relatorios
 * Props esperadas do backend:
 * @param {Object} stats - { estoque: ['x itens', ...], pedidos: [...], usuarios: [...] }
 * @param {Function} onVisualizar - callback para navegar para a aba completa de relatórios
 */
const Relatorios = ({ stats = {}, onVisualizar }) => {
  const statsMap = {
    'relatorio-estoque':   stats.estoque   ?? [],
    'relatorio-pedidos':   stats.pedidos   ?? [],
    'relatorio-usuarios':  stats.usuarios  ?? [],
  };

  return (
    <div className="relatorios-section">
      <div className="relatorios-section__header">
        <h2 className="relatorios-section__title">Gerar Relatórios</h2>
      </div>
      <div className="relatorios-grid">
        {relatoriosConfig.map(rel => (
          <div className="relatorio-card" key={rel.id} id={rel.id}>
            <div className="relatorio-card__top">
              <div className="relatorio-card__icon" style={{ background: `${rel.color}15`, color: rel.color }}>
                {rel.icon}
              </div>
              <div className="relatorio-card__stats">
                {statsMap[rel.id].length > 0 ? (
                  statsMap[rel.id].map((s, i) => (
                    <span key={i} className="relatorio-stat">{s}</span>
                  ))
                ) : (
                  <span className="relatorio-stat relatorio-stat--empty">Sem dados</span>
                )}
              </div>
            </div>
            <h3 className="relatorio-card__title">{rel.title}</h3>
            <p className="relatorio-card__desc">{rel.description}</p>
            <div className="relatorio-card__divider" />
            <div className="relatorio-card__actions">
              <button
                id={`btn-exportar-${rel.id}`}
                className="relatorio-btn relatorio-btn--outline"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Exportar
              </button>
              <button
                id={`btn-visualizar-${rel.id}`}
                className="relatorio-btn relatorio-btn--primary"
                style={{ '--btn-color': rel.color }}
                onClick={onVisualizar}
              >
                Visualizar
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9,18 15,12 9,6"/>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Relatorios;
