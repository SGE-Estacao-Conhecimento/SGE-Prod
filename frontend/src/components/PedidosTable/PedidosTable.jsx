import React, { useState } from 'react';
import './PedidosTable.css';

const statusClass = {
  'Pendente':  'badge--warning',
  'Atendido':  'badge--success',
  'Cancelado': 'badge--danger',
};

/**
 * PedidosTable
 * Props esperadas do backend:
 * @param {Array} pedidos - lista de pedidos [{ id, usuario, data, materiais: [], status }]
 */
const PedidosTable = ({ pedidos = [], onVerTodos }) => {
  const [hoveredRow, setHoveredRow] = useState(null);

  return (
    <div className="pedidos-card">
      <div className="pedidos-card__header">
        <h2 className="pedidos-card__title">Histórico Recente de Pedidos</h2>
        <button id="btn-ver-todos-pedidos" className="pedidos-card__link" onClick={onVerTodos}>
          Ver todos
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </button>
      </div>

      <div className="pedidos-table-wrapper">
        {pedidos.length === 0 ? (
          <div className="pedidos-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span>Nenhum pedido encontrado</span>
            <p>Os pedidos aparecerão aqui assim que forem registrados no sistema.</p>
          </div>
        ) : (
          <table className="pedidos-table">
            <thead>
              <tr>
                <th>Nº Pedido</th>
                <th>Usuário</th>
                <th>Data</th>
                <th>Materiais Solicitados</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr
                  key={p.id}
                  className={hoveredRow === p.id ? 'row--hovered' : ''}
                  onMouseEnter={() => setHoveredRow(p.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td><span className="pedido-id">#{p.id}</span></td>
                  <td>
                    <div className="pedido-usuario">
                      <div className="pedido-avatar">{p.usuario?.charAt(0)}</div>
                      {p.usuario}
                    </div>
                  </td>
                  <td className="pedido-data">{p.data}</td>
                  <td>
                    <div className="pedido-materiais">
                      {p.materiais?.map((m, i) => (
                        <span key={i} className="pedido-material-tag">
                          {typeof m === 'string' ? m : `${m.materialNome || m.nome || 'Material'} (${m.quantidade || 1} ${m.unidade || 'UN'})`}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${statusClass[p.status] ?? ''}`}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PedidosTable;
