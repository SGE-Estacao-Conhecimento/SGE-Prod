import React, { useId, useMemo, useState } from 'react';
import { calcularEscalaY, formatarData, formatarNumero } from './chartUtils';

const LARGURA = 500;
const PADDING = { top: 35, bottom: 50, left: 45, right: 20 };

export default function HistoricoConsumoBarChart({
  dados = [],
  altura = 220,
  unidadeMedida = 'un'
}) {
  const chartId = useId();
  const [barraAtiva, setBarraAtiva] = useState(null);

  const periodosValidos = useMemo(() => {
    if (!Array.isArray(dados)) return [];
    return dados.map((p, idx) => ({
      ...p,
      originalIndex: idx,
      quantidadeConsumida: Number(p?.quantidadeConsumida) || 0,
      taxaDiaria: Number(p?.taxaDiaria) || 0,
      peso: Number(p?.peso) || 1,
      outliersAtenuados: Number(p?.outliersAtenuados) || 0
    }));
  }, [dados]);

  const escalaY = useMemo(() => {
    const valores = periodosValidos.map(p => p.quantidadeConsumida);
    return calcularEscalaY(valores, altura, PADDING);
  }, [periodosValidos, altura]);

  const disponivelX = Math.max(1, LARGURA - PADDING.left - PADDING.right);
  const count = periodosValidos.length || 6;
  const slotWidth = disponivelX / count;
  const barWidth = Math.min(34, slotWidth * 0.55);
  const baselineY = altura - PADDING.bottom;

  const barras = useMemo(() => {
    return periodosValidos.map((p, idx) => {
      const centerX = PADDING.left + (idx + 0.5) * slotWidth;
      const barX = centerX - barWidth / 2;
      const topY = escalaY(p.quantidadeConsumida);
      const barHeight = Math.max(p.quantidadeConsumida > 0 ? 3 : 0, baselineY - topY);

      return {
        ...p,
        centerX,
        barX,
        topY,
        barHeight
      };
    });
  }, [periodosValidos, slotWidth, barWidth, escalaY, baselineY]);

  if (!dados || dados.length === 0 || periodosValidos.length === 0) {
    return (
      <div
        className="sge-chart-empty"
        style={{
          height: altura,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary, #6B7280)',
          fontSize: '0.875rem',
          backgroundColor: 'var(--card-bg, #FFFFFF)',
          borderRadius: 'var(--radius-md, 10px)',
          border: '1px solid var(--border, #E5E7EB)',
          padding: '1rem'
        }}
      >
        Sem dados de histórico de consumo semestral disponíveis.
      </div>
    );
  }

  const itemAtivo = barraAtiva !== null ? barras[barraAtiva] : null;

  return (
    <div
      className="sge-historico-consumo-chart"
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: 'var(--card-bg, #FFFFFF)',
        borderRadius: 'var(--radius-md, 10px)',
        padding: '0.5rem 0'
      }}
    >
      <svg
        viewBox={`0 0 ${LARGURA} ${altura}`}
        width="100%"
        height="auto"
        role="img"
        aria-labelledby={`${chartId}-title ${chartId}-desc`}
        style={{ overflow: 'visible', display: 'block' }}
      >
        <title id={`${chartId}-title`}>Histórico Semestral de Consumo Ponderado</title>
        <desc id={`${chartId}-desc`}>
          Consumo agregado em 6 períodos semestrais com pesos preditivos de 1 a 4 e atenuação de outliers via IQR.
        </desc>

        <defs>
          <linearGradient id={`${chartId}-bar-recente`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent, #017F7B)" stopOpacity="1" />
            <stop offset="100%" stopColor="#0D9488" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id={`${chartId}-bar-antigo`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0D9488" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.60" />
          </linearGradient>
        </defs>

        {/* Linhas de Grade e Eixo Y */}
        <g className="grid-linhas-y" aria-hidden="true">
          {escalaY.ticks.map(tick => (
            <g key={tick.y}>
              <line
                x1={PADDING.left}
                y1={tick.y}
                x2={LARGURA - PADDING.right}
                y2={tick.y}
                stroke="var(--border, #E5E7EB)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={PADDING.left - 8}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--text-secondary, #6B7280)"
                fontFamily="inherit"
              >
                {formatarNumero(tick.valor, 0)}
              </text>
            </g>
          ))}
        </g>

        {/* Linha de Base do Eixo X */}
        <line
          x1={PADDING.left}
          y1={baselineY}
          x2={LARGURA - PADDING.right}
          y2={baselineY}
          stroke="var(--border, #E5E7EB)"
          strokeWidth="1"
          aria-hidden="true"
        />

        {/* Barras e Rótulos */}
        <g className="barras-consumo">
          {barras.map((b, idx) => {
            const isFocado = barraAtiva === idx;
            const gradId = b.peso >= 3 ? `${chartId}-bar-recente` : `${chartId}-bar-antigo`;
            const temOutliers = b.outliersAtenuados > 0;

            return (
              <g
                key={idx}
                tabIndex={0}
                role="button"
                aria-label={`${b.periodoRotulo || `P${idx + 1}`}: ${formatarNumero(b.quantidadeConsumida)} ${unidadeMedida} consumidos, taxa diária de ${formatarNumero(b.taxaDiaria)} ${unidadeMedida}/dia. Peso preditivo: ${b.peso}x.${temOutliers ? ` ${b.outliersAtenuados} outliers atenuados por IQR.` : ''}`}
                onMouseEnter={() => setBarraAtiva(idx)}
                onMouseLeave={() => setBarraAtiva(null)}
                onFocus={() => setBarraAtiva(idx)}
                onBlur={() => setBarraAtiva(null)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setBarraAtiva(null);
                }}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                {/* Destaque sutil de fundo no foco/hover */}
                {isFocado && (
                  <rect
                    x={b.centerX - slotWidth / 2 + 2}
                    y={PADDING.top - 10}
                    width={slotWidth - 4}
                    height={baselineY - PADDING.top + 10}
                    rx="6"
                    fill="var(--accent-light, #F0FDFA)"
                    stroke="var(--accent, #017F7B)"
                    strokeOpacity="0.25"
                    strokeWidth="1"
                    aria-hidden="true"
                  />
                )}

                {/* Barra vertical proporcional */}
                {b.barHeight > 0 && (
                  <rect
                    x={b.barX}
                    y={b.topY}
                    width={barWidth}
                    height={b.barHeight}
                    rx="4"
                    fill={`url(#${gradId})`}
                    stroke={isFocado ? 'var(--accent, #017F7B)' : 'transparent'}
                    strokeWidth="1.5"
                    style={{ transition: 'height 0.3s ease, fill 0.2s ease' }}
                    aria-hidden="true"
                  />
                )}

                {/* Indicador de Expurgo IQR (quando outliersAtenuados > 0) */}
                {temOutliers && (
                  <g className="indicador-iqr" aria-hidden="true">
                    <rect
                      x={b.centerX - 24}
                      y={b.topY - 18}
                      width="48"
                      height="15"
                      rx="4"
                      fill="#FEF3C7"
                      stroke="#F59E0B"
                      strokeWidth="1"
                    />
                    <text
                      x={b.centerX}
                      y={b.topY - 7}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="600"
                      fill="#92400E"
                      fontFamily="inherit"
                    >
                      IQR ({b.outliersAtenuados})
                    </text>
                    {/* Top cap diferenciado na barra */}
                    <line
                      x1={b.barX}
                      y1={b.topY}
                      x2={b.barX + barWidth}
                      y2={b.topY}
                      stroke="#F59E0B"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </g>
                )}

                {/* Badge de Peso Preditivo */}
                <g className="badge-peso" aria-hidden="true">
                  <rect
                    x={b.centerX - 13}
                    y={baselineY + 6}
                    width="26"
                    height="14"
                    rx="3"
                    fill={b.peso >= 3 ? 'var(--accent-light, #E6F4F3)' : 'var(--border-light, #F3F4F6)'}
                    stroke={b.peso >= 3 ? 'var(--accent, #017F7B)' : 'var(--border, #E5E7EB)'}
                    strokeWidth="0.5"
                  />
                  <text
                    x={b.centerX}
                    y={baselineY + 16}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight={b.peso >= 3 ? '700' : '600'}
                    fill={b.peso >= 3 ? 'var(--accent, #017F7B)' : 'var(--text-secondary, #6B7280)'}
                    fontFamily="inherit"
                  >
                    {b.peso}x
                  </text>
                </g>

                {/* Rótulo do Período no Eixo X */}
                <text
                  x={b.centerX}
                  y={baselineY + 34}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isFocado ? '600' : '400'}
                  fill="var(--text-secondary, #6B7280)"
                  fontFamily="inherit"
                  aria-hidden="true"
                >
                  {b.periodoRotulo || `P${idx + 1}`}
                </text>
              </g>
            );
          })}
        </g>

        {/* Tooltip Detalhado Flutuante */}
        {itemAtivo && (
          <g
            className="tooltip-historico"
            transform={`translate(${Math.max(100, Math.min(LARGURA - 100, itemAtivo.centerX))}, ${Math.max(30, itemAtivo.topY - 45)})`}
            aria-hidden="true"
            pointerEvents="none"
          >
            <rect
              x="-85"
              y="-28"
              width="170"
              height="36"
              rx="6"
              fill="var(--card-bg, #FFFFFF)"
              stroke="var(--border, #CBD5E1)"
              strokeWidth="1"
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
            />
            <text x="0" y="-14" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--text-primary, #1A1D2E)">
              {formatarNumero(itemAtivo.quantidadeConsumida)} {unidadeMedida} ({formatarNumero(itemAtivo.taxaDiaria)}/dia)
            </text>
            <text x="0" y="-1" textAnchor="middle" fontSize="9" fill="var(--text-secondary, #6B7280)">
              {formatarData(itemAtivo.dataInicio)} a {formatarData(itemAtivo.dataFim)} (Peso {itemAtivo.peso}x)
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
