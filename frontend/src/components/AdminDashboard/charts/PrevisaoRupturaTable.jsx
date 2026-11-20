import React, { useMemo } from 'react';
import { formatarData } from './chartUtils';

const STATUS_ORDER = {
  critico: 1,
  alerta: 2,
  sem_giro: 3,
  estavel: 4
};

const STATUS_CONFIG = {
  critico: {
    label: 'Crítico',
    badgeClass: 'sge-badge-critico',
    bg: '#FEF2F2',
    color: '#991B1B',
    border: '#FECACA',
    barColor: '#EF4444',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    )
  },
  alerta: {
    label: 'Alerta',
    badgeClass: 'sge-badge-alerta',
    bg: '#FFFBEB',
    color: '#92400E',
    border: '#FDE68A',
    barColor: '#F59E0B',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  },
  sem_giro: {
    label: 'Sem Giro',
    badgeClass: 'sge-badge-sem-giro',
    bg: '#F1F5F9',
    color: '#475569',
    border: '#CBD5E1',
    barColor: '#94A3B8',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    )
  },
  estavel: {
    label: 'Estável',
    badgeClass: 'sge-badge-estavel',
    bg: '#ECFDF5',
    color: '#065F46',
    border: '#A7F3D0',
    barColor: '#10B981',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    )
  }
};

const CONFIANCA_CONFIG = {
  alta: { label: 'Alta', bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  media: { label: 'Média', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  baixa: { label: 'Baixa', bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' }
};

/**
 * PrevisaoRupturaTable — Tabela Preditiva de Esgotamento e Cobertura de Estoque
 *
 * Características:
 * - Tabela HTML semântica (<th scope="col">).
 * - Ordenação estrita: critico -> alerta -> sem_giro -> estavel; dentro do grupo por cobertura ascendente.
 * - Regras de negócio essenciais:
 *   - estoqueAtual <= 0: exibe "Esgotado" na coluna de data prevista de ruptura.
 *   - diasCobertura == null com estoque positivo: exibe "—".
 * - Botão de ação "Ver no Estoque" aciona o callback onDrillDown(produtoId, nome).
 * - Contêiner com rolagem horizontal isolada (overflow-x: auto) sem scroll na página inteira.
 * - Ícones de status puramente em SVG vetorial inline (zero emojis).
 *
 * @param {Object} props
 * @param {Array<Object>} props.itens
 * @param {Function} [props.onDrillDown] - Callback (produtoId, nome) => void
 * @param {Function} [props.onSelectMaterial] - Callback (produtoId, nome) => void
 */
export default function PrevisaoRupturaTable({ itens = [], onDrillDown, onSelectMaterial }) {
  // Ordena os itens pela hierarquia de risco e cobertura
  const itensOrdenados = useMemo(() => {
    if (!Array.isArray(itens)) return [];
    return [...itens].sort((a, b) => {
      const statusA = STATUS_ORDER[a?.statusRisco] ?? 99;
      const statusB = STATUS_ORDER[b?.statusRisco] ?? 99;
      if (statusA !== statusB) {
        return statusA - statusB;
      }

      // Dentro do mesmo status: esgotados (estoqueAtual <= 0) vêm primeiro
      const esgotadoA = Number(a?.estoqueAtual) <= 0;
      const esgotadoB = Number(b?.estoqueAtual) <= 0;
      if (esgotadoA && !esgotadoB) return -1;
      if (!esgotadoA && esgotadoB) return 1;

      // Cobertura crescente (nulos por último)
      const cobA = a?.diasCobertura !== null && a?.diasCobertura !== undefined ? Number(a.diasCobertura) : Infinity;
      const cobB = b?.diasCobertura !== null && b?.diasCobertura !== undefined ? Number(b.diasCobertura) : Infinity;
      if (cobA !== cobB) {
        return cobA - cobB;
      }

      return (a?.nome || '').localeCompare(b?.nome || '');
    });
  }, [itens]);

  if (!itens || itens.length === 0 || itensOrdenados.length === 0) {
    return (
      <div
        className="sge-table-empty"
        style={{
          padding: '2.5rem 1rem',
          textAlign: 'center',
          color: 'var(--text-secondary, #6B7280)',
          backgroundColor: 'var(--card-bg, #FFFFFF)',
          borderRadius: 'var(--radius-md, 10px)',
          border: '1px solid var(--border, #E5E7EB)',
          fontSize: '0.875rem'
        }}
      >
        Nenhum item com previsão de ruptura ou risco registrado no período.
      </div>
    );
  }

  return (
    <div
      className="sge-previsao-ruptura-wrapper"
      style={{
        backgroundColor: 'var(--card-bg, #FFFFFF)',
        borderRadius: 'var(--radius-md, 10px)',
        border: '1px solid var(--border, #E5E7EB)',
        overflow: 'hidden'
      }}
    >
      <div
        className="sge-previsao-ruptura-container"
        style={{
          width: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <table
          className="sge-table sge-table--previsao-ruptura"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.875rem'
          }}
        >
          <caption className="sr-only" style={{ display: 'none' }}>
            Previsão Preditiva de Esgotamento de Materiais
          </caption>
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--content-bg, #F9FAFB)',
                borderBottom: '1px solid var(--border, #E5E7EB)',
                color: 'var(--text-secondary, #6B7280)',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>
                Material
              </th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>
                Estoque / Mínimo
              </th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>
                Consumo Diário
              </th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '600', minWidth: '150px' }}>
                Cobertura
              </th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>
                Status de Risco
              </th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>
                Data Prevista
              </th>
              <th scope="col" style={{ padding: '0.75rem 1rem', fontWeight: '600', textAlign: 'right' }}>
                Ação
              </th>
            </tr>
          </thead>
          <tbody>
            {itensOrdenados.map((item, idx) => {
              const statusCfg = STATUS_CONFIG[item.statusRisco] || STATUS_CONFIG.estavel;
              const confiancaCfg = CONFIANCA_CONFIG[item.nivelConfianca] || CONFIANCA_CONFIG.baixa;
              const estoqueAtual = Number(item.estoqueAtual) || 0;
              const estoqueMinimo = Number(item.estoqueMinimo) || 0;
              const isEsgotado = estoqueAtual <= 0;
              const diasCobertura = item.diasCobertura !== null && item.diasCobertura !== undefined ? Number(item.diasCobertura) : null;
              const cmd = Number(item.consumoDiarioMedio) || 0;

              // Barra de cobertura proporcional (referência de 30 dias para 100%)
              const pctBarraCobertura = diasCobertura !== null
                ? Math.min(100, Math.max(3, (diasCobertura / 30) * 100))
                : 0;

              return (
                <tr
                  key={item.produtoId ?? idx}
                  onClick={() => onSelectMaterial && onSelectMaterial(item.produtoId, item.nome)}
                  style={{
                    borderBottom: '1px solid var(--border-light, #F3F4F6)',
                    backgroundColor: idx % 2 === 0 ? 'var(--card-bg, #FFFFFF)' : 'var(--content-bg, #FAFAFA)',
                    transition: 'background-color 0.15s ease',
                    cursor: onSelectMaterial ? 'pointer' : 'default'
                  }}
                >
                  {/* Coluna 1: Material e Nível de Confiança */}
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span
                        style={{
                          fontWeight: '600',
                          color: 'var(--text-primary, #1A1D2E)',
                          fontSize: '0.875rem'
                        }}
                      >
                        {item.nome}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--text-secondary, #6B7280)'
                          }}
                        >
                          UN: {item.unidadeMedida || 'UN'}
                        </span>
                        {item.nivelConfianca && (
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: '600',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: confiancaCfg.bg,
                              color: confiancaCfg.color,
                              border: `1px solid ${confiancaCfg.border}`
                            }}
                            title={`Nível de confiança estatística: ${confiancaCfg.label}`}
                          >
                            Confiança {confiancaCfg.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Coluna 2: Estoque Atual / Mínimo */}
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span
                        style={{
                          fontWeight: '700',
                          color: isEsgotado ? '#DC2626' : estoqueAtual <= estoqueMinimo ? '#D97706' : 'var(--text-primary, #1A1D2E)'
                        }}
                      >
                        {estoqueAtual.toLocaleString('pt-BR')}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6B7280)' }}>
                        / {estoqueMinimo.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </td>

                  {/* Coluna 3: Consumo Diário Médio (CMD) */}
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary, #1A1D2E)' }}>
                    <span style={{ fontWeight: '500' }}>
                      {cmd > 0 ? `${cmd.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} / dia` : '0,0 / dia'}
                    </span>
                  </td>

                  {/* Coluna 4: Cobertura Proporcional */}
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {diasCobertura !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '54px',
                            height: '6px',
                            backgroundColor: 'var(--border-light, #E5E7EB)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            flexShrink: 0
                          }}
                          aria-hidden="true"
                        >
                          <div
                            style={{
                              width: `${pctBarraCobertura}%`,
                              height: '100%',
                              backgroundColor: statusCfg.barColor,
                              borderRadius: '3px'
                            }}
                          />
                        </div>
                        <span style={{ fontWeight: '600', fontSize: '0.8125rem', color: 'var(--text-primary, #1A1D2E)' }}>
                          {diasCobertura.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dias
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary, #9CA3AF)', fontSize: '0.875rem' }}>
                        —
                      </span>
                    )}
                  </td>

                  {/* Coluna 5: Status de Risco com Ícone SVG */}
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: statusCfg.bg,
                        color: statusCfg.color,
                        border: `1px solid ${statusCfg.border}`
                      }}
                    >
                      {statusCfg.icon}
                      {statusCfg.label}
                    </span>
                  </td>

                  {/* Coluna 6: Data Prevista de Ruptura */}
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                    {isEsgotado ? (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#FEE2E2',
                          color: '#991B1B',
                          fontWeight: '700',
                          fontSize: '0.75rem'
                        }}
                      >
                        Esgotado
                      </span>
                    ) : item.dataPrevistaRuptura ? (
                      <span style={{ color: 'var(--text-primary, #1A1D2E)', fontSize: '0.8125rem' }}>
                        {formatarData(item.dataPrevistaRuptura)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary, #9CA3AF)' }}>—</span>
                    )}
                  </td>

                  {/* Coluna 7: Ações */}
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                      {onSelectMaterial && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMaterial(item.produtoId, item.nome);
                          }}
                          aria-label={`Ver previsão preditiva de ${item.nome}`}
                          title="Ver previsão e gráficos analíticos"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 9px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: '#FFFFFF',
                            backgroundColor: 'var(--accent, #017F7B)',
                            border: '1px solid var(--accent, #017F7B)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                          </svg>
                          <span>Previsão</span>
                        </button>
                      )}

                      {onDrillDown && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDrillDown(item.produtoId, item.nome);
                          }}
                          aria-label={`Ver ${item.nome} no estoque`}
                          title="Examinar no módulo de estoque"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 9px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: 'var(--accent, #017F7B)',
                            backgroundColor: 'var(--accent-light, #F0FDFA)',
                            border: '1px solid var(--accent, #017F7B)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span>Estoque</span>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
