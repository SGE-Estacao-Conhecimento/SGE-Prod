import React, { useState, useId, useMemo } from 'react';
import {
  calcularEscalaX,
  calcularEscalaY,
  gerarPathLinhaSuave,
  formatarData
} from './chartUtils';

const LARGURA = 500;
const PADDING = { top: 30, bottom: 45, left: 45, right: 30 };

/**
 * TendenciaConsumoLineChart — Gráfico de Linha SVG Nativo para Tendência Semanal
 *
 * Características:
 * - SVG 100% nativo sem dependências de charting (Chart.js/Recharts/D3).
 * - Curva suave monotônica (Fritsch-Carlson) evitando overshoots ou picos negativos.
 * - Segmento até a semana parcial desenhado com traço pontilhado/tracejado e badge "em andamento".
 * - Acessibilidade completa: role="img", <title>, <desc>, tabIndex={0} nos pontos de dados,
 *   tooltip via hover, teclado (focus) e toque.
 * - Ponto nulo ou indefinido é ignorado com segurança.
 * - Nota de rodapé sobre semanas ISO em UTC.
 * - Sem nenhum caractere emoji.
 *
 * @param {Object} props
 * @param {Array<{semanaRotulo: string, dataInicio: string, pedidosAtendidos: number, parcial?: boolean}>} props.dados
 * @param {number} [props.altura=220]
 */
export default function TendenciaConsumoLineChart({ dados = [], altura = 220 }) {
  const chartId = useId();
  const [pontoAtivo, setPontoAtivo] = useState(null);

  // Filtra dados válidos preservando os índices e referências
  const pontosValidos = useMemo(() => {
    if (!Array.isArray(dados)) return [];
    return dados
      .map((item, originalIndex) => ({
        originalIndex,
        semanaRotulo: item?.semanaRotulo || `Sem ${originalIndex + 1}`,
        dataInicio: item?.dataInicio || '',
        pedidosAtendidos:
          item?.pedidosAtendidos !== null && item?.pedidosAtendidos !== undefined
            ? Number(item.pedidosAtendidos)
            : null,
        parcial: Boolean(item?.parcial)
      }))
      .filter(item => item.pedidosAtendidos !== null && Number.isFinite(item.pedidosAtendidos));
  }, [dados]);

  // Escalas X e Y
  const escalaX = useMemo(() => {
    return calcularEscalaX(dados?.length || 0, LARGURA, PADDING);
  }, [dados?.length]);

  const escalaY = useMemo(() => {
    const valores = pontosValidos.map(p => p.pedidosAtendidos);
    return calcularEscalaY(valores, altura, PADDING);
  }, [pontosValidos, altura]);

  // Coordenadas projetadas
  const coordenadas = useMemo(() => {
    return pontosValidos.map(p => ({
      ...p,
      x: escalaX(p.originalIndex),
      y: escalaY(p.pedidosAtendidos)
    }));
  }, [pontosValidos, escalaX, escalaY]);

  // Divide a série em segmentos contínuos e segmento parcial tracejado
  const { pathSolido, pathTracejado, pontoParcial } = useMemo(() => {
    if (coordenadas.length === 0) {
      return { pathSolido: '', pathTracejado: '', pontoParcial: null };
    }

    const ultimoPonto = coordenadas[coordenadas.length - 1];
    const temParcial = ultimoPonto?.parcial;

    if (!temParcial || coordenadas.length === 1) {
      return {
        pathSolido: gerarPathLinhaSuave(coordenadas),
        pathTracejado: '',
        pontoParcial: temParcial ? ultimoPonto : null
      };
    }

    // O último ponto é parcial: traçado sólido até o penúltimo, tracejado do penúltimo ao último
    const pontosSolidos = coordenadas.slice(0, coordenadas.length - 1);
    const pontoAnterior = coordenadas[coordenadas.length - 2];
    const segmentoParcial = [pontoAnterior, ultimoPonto];

    return {
      pathSolido: gerarPathLinhaSuave(pontosSolidos),
      pathTracejado: gerarPathLinhaSuave(segmentoParcial),
      pontoParcial: ultimoPonto
    };
  }, [coordenadas]);

  // Área preenchida sob a curva sólida (gradiente suave)
  const pathArea = useMemo(() => {
    if (coordenadas.length === 0) return '';
    const baseY = altura - PADDING.bottom;
    const pontosBase = coordenadas.map(p => ({ x: p.x, y: p.y }));
    const dCurva = gerarPathLinhaSuave(pontosBase);
    if (!dCurva) return '';

    const primeiroX = pontosBase[0].x;
    const ultimoX = pontosBase[pontosBase.length - 1].x;
    return `${dCurva} L ${ultimoX} ${baseY} L ${primeiroX} ${baseY} Z`;
  }, [coordenadas, altura]);

  // Resumo para leitor de tela
  const descricaoAcessivel = useMemo(() => {
    if (coordenadas.length === 0) return 'Nenhum dado de tendência semanal disponível.';
    const valores = coordenadas.map(c => c.pedidosAtendidos);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const totalSem = coordenadas.length;
    return `Série semanal de ${totalSem} semanas. Mínimo de ${min} e máximo de ${max} pedidos atendidos. A última semana ${pontoParcial ? 'está em andamento' : 'está consolidada'}.`;
  }, [coordenadas, pontoParcial]);

  if (!dados || dados.length === 0 || coordenadas.length === 0) {
    return (
      <div
        className="sge-chart-empty"
        style={{
          height: altura,
          display: 'flex',
          flexDirection: 'column',
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
        <p style={{ margin: 0 }}>Sem dados de tendência de consumo no período.</p>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9CA3AF)', marginTop: '4px' }}>
          * Semanas ISO (segunda a domingo) calculadas em UTC.
        </span>
      </div>
    );
  }

  const pontoFocado = pontoAtivo !== null ? coordenadas[pontoAtivo] : null;

  return (
    <div
      className="sge-tendencia-chart"
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
        <title id={`${chartId}-title`}>Tendência Semanal de Consumo</title>
        <desc id={`${chartId}-desc`}>{descricaoAcessivel}</desc>

        <defs>
          <linearGradient id={`${chartId}-area-grad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent, #017F7B)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent, #017F7B)" stopOpacity="0.0" />
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
                {tick.valor}
              </text>
            </g>
          ))}
        </g>

        {/* Linha de base do Eixo X */}
        <line
          x1={PADDING.left}
          y1={altura - PADDING.bottom}
          x2={LARGURA - PADDING.right}
          y2={altura - PADDING.bottom}
          stroke="var(--border, #E5E7EB)"
          strokeWidth="1"
          aria-hidden="true"
        />

        {/* Rótulos das Semanas no Eixo X */}
        <g className="eixo-x-rotulos" aria-hidden="true">
          {dados.map((item, idx) => {
            const x = escalaX(idx);
            return (
              <text
                key={idx}
                x={x}
                y={altura - PADDING.bottom + 18}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-secondary, #6B7280)"
                fontFamily="inherit"
              >
                {item?.semanaRotulo || `S${idx + 1}`}
              </text>
            );
          })}
        </g>

        {/* Área preenchida sob a curva */}
        {pathArea && (
          <path
            d={pathArea}
            fill={`url(#${chartId}-area-grad)`}
            pointerEvents="none"
            aria-hidden="true"
          />
        )}

        {/* Traçado principal contínuo (semanas consolidadas) */}
        {pathSolido && (
          <path
            d={pathSolido}
            fill="none"
            stroke="var(--accent, #017F7B)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          />
        )}

        {/* Traçado tracejado para semana parcial em andamento */}
        {pathTracejado && (
          <path
            d={pathTracejado}
            fill="none"
            stroke="var(--warning, #F59E0B)"
            strokeWidth="2.5"
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          />
        )}

        {/* Badge "em andamento" para a semana parcial */}
        {pontoParcial && (
          <g
            className="badge-semana-parcial"
            transform={`translate(${pontoParcial.x}, ${
              pontoParcial.y > 45 ? pontoParcial.y - 14 : pontoParcial.y + 20
            })`}
            aria-hidden="true"
          >
            <rect
              x="-38"
              y="-11"
              width="76"
              height="16"
              rx="8"
              fill="var(--warning-light, #FFFBEB)"
              stroke="var(--warning, #F59E0B)"
              strokeWidth="1"
            />
            <text
              x="0"
              y="1"
              textAnchor="middle"
              fontSize="9"
              fill="var(--warning, #92400E)"
              fontWeight="600"
              fontFamily="inherit"
            >
              em andamento
            </text>
          </g>
        )}

        {/* Pontos de dados navegáveis e acessíveis */}
        <g className="pontos-dados">
          {coordenadas.map((p, idx) => {
            const isAtivo = pontoAtivo === idx;
            const corPonto = p.parcial ? 'var(--warning, #F59E0B)' : 'var(--accent, #017F7B)';

            return (
              <g
                key={idx}
                tabIndex={0}
                role="button"
                aria-label={`${p.semanaRotulo}: ${p.pedidosAtendidos} pedidos atendidos${
                  p.parcial ? ', em andamento' : ''
                }. Início em ${formatarData(p.dataInicio)}.`}
                onMouseEnter={() => setPontoAtivo(idx)}
                onMouseLeave={() => setPontoAtivo(null)}
                onFocus={() => setPontoAtivo(idx)}
                onBlur={() => setPontoAtivo(null)}
                onTouchStart={() => setPontoAtivo(idx)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setPontoAtivo(null);
                }}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                {/* Alvo de toque/clique invisível expandido */}
                <circle cx={p.x} cy={p.y} r="14" fill="transparent" />

                {/* Halo pulsante no foco ou hover */}
                {isAtivo && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="8"
                    fill={corPonto}
                    fillOpacity="0.25"
                    aria-hidden="true"
                  />
                )}

                {/* Marcador visual do ponto */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isAtivo ? '5.5' : '4'}
                  fill="#FFFFFF"
                  stroke={corPonto}
                  strokeWidth="2.5"
                  aria-hidden="true"
                />
              </g>
            );
          })}
        </g>

        {/* Tooltip SVG contextual */}
        {pontoFocado && (
          <g
            className="chart-tooltip"
            pointerEvents="none"
            transform={`translate(${Math.max(
              10,
              Math.min(LARGURA - 145, pontoFocado.x - 70)
            )}, ${Math.max(10, pontoFocado.y - 62)})`}
            aria-hidden="true"
          >
            <rect
              width="140"
              height="50"
              rx="6"
              fill="var(--card-bg, #FFFFFF)"
              stroke="var(--border, #E5E7EB)"
              strokeWidth="1"
              style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.12))' }}
            />
            <text
              x="70"
              y="16"
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="600"
              fill="var(--text-primary, #1A1D2E)"
              fontFamily="inherit"
            >
              {pontoFocado.semanaRotulo}
              {pontoFocado.dataInicio ? ` • ${formatarData(pontoFocado.dataInicio)}` : ''}
            </text>
            <text
              x="70"
              y="32"
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill={pontoFocado.parcial ? 'var(--warning, #F59E0B)' : 'var(--accent, #017F7B)'}
              fontFamily="inherit"
            >
              {pontoFocado.pedidosAtendidos} pedidos
              {pontoFocado.parcial ? ' (parcial)' : ''}
            </text>
          </g>
        )}
      </svg>

      {/* Nota de rodapé técnica sobre fuso horário UTC */}
      <footer
        className="sge-chart-footnote"
        style={{
          marginTop: '6px',
          paddingRight: '12px',
          textAlign: 'right',
          fontSize: '0.75rem',
          color: 'var(--text-muted, #9CA3AF)',
          lineHeight: '1.2'
        }}
      >
        * Semanas ISO (segunda a domingo) calculadas no fuso UTC.
      </footer>
    </div>
  );
}
