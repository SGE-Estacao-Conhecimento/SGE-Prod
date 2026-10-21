import React, { useState } from 'react';
import './ConsultaEstoque.css';
import { corrigirTexto, normalizarTextoBusca } from '../../utils/text';

/**
 * ConsultaEstoque
 * Props esperadas do backend:
 * @param {Array} itens - lista de itens [{ id, nome, qtd, status: 'ok' | 'baixo' | 'critico' }]
 */
const statusColor = {
  ok:      '#22C55E',
  baixo:   '#F59E0B',
  critico: '#EF4444',
};

const ConsultaEstoque = ({ itens = [], onNavigate }) => {
  const [query, setQuery] = useState('');

  const filtered = itens.filter(i =>
    normalizarTextoBusca(i.nome).includes(normalizarTextoBusca(query))
  );

  return (
    <div className="panel-card">
      <div className="panel-card__header">
        <h3 className="panel-card__title">Consulta Rápida de Estoque</h3>
        {onNavigate && (
          <button
            className="panel-btn-icon"
            title="Ir para Gestão de Estoque"
            onClick={() => onNavigate('estoque')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </button>
        )}
      </div>

      <div className="panel-search" style={{ marginLeft: 0, width: '100%', boxSizing: 'border-box' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          id="consulta-estoque-search"
          className="panel-search__input"
          type="text"
          placeholder="Buscar item no estoque..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {itens.length === 0 ? (
        <div className="panel-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          <span>Nenhum item em estoque</span>
        </div>
      ) : (
        <ul className="estoque-list">
          {filtered.length === 0 ? (
            <li className="estoque-empty">Nenhum item encontrado</li>
          ) : (
            filtered.slice(0, 5).map(item => (
              <li key={item.id} className="estoque-item">
                <div className="estoque-item__info">
                  <div
                    className="estoque-item__dot"
                    style={{ background: statusColor[item.status] ?? '#9CA3AF' }}
                    title={item.status}
                  />
                  <span className="estoque-item__nome">{corrigirTexto(item.nome)}</span>
                </div>
                <span className="estoque-item__qtd">Qtd: {item.qtd}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default ConsultaEstoque;
