import React, { useId, useMemo, useState } from 'react';

const LARGURA = 500;
const ALTURA_BARRA = 36;

/**
 * Determina se a etapa é de responsabilidade do Almoxarifado.
 * @param {Object} etapa
 * @returns {boolean}
 */
function isResponsabilidadeAlmoxarifado(etapa) {
  if (!etapa) return false;
  const resp = (etapa.responsabilidade || '').toLowerCase();
  const id = (etapa.etapaId || '').toLowerCase();
  return (
    resp.includes('almoxarif') ||
    id === 'aguardando_separacao' ||
    id === 'em_separacao'
  );
}

/**
 * Cores temáticas por etapa e responsabilidade
 */
const CORES_ETAPAS = {
  aguardando_separacao: {
    bg: 'var(--accent, #017F7B)',
    cardBorder: 'var(--accent, #017F7B)',
    badgeBg: '#E6F4F3',
    badgeText: '#016562'
  },
  em_separacao: {
    bg: '#0D9488',
    cardBorder: '#0D9488',
    badgeBg: '#CCFBF1',
    badgeText: '#0F766E'
  },
  aguardando_retirada: {
    bg: '#3B82F6',
    cardBorder: '#3B82F6',
    badgeBg: '#EFF6FF',
    badgeText: '#1E40AF'
  }
};

/**
 * WmsLeadTimeFunnel — Funil e Barra Segmentada Proporcional do Ciclo WMS
 *
 * Características:
 * - Barra segmentada proporcional ao percentualDoCiclo de cada etapa.
 * - Identificação visual de responsabilidade com paletas distintas:
 *   Almoxarifado (verde institucional/teal) vs Setor Solicitante (azul informativo).
 * - Destaque automático da etapa mais longa DENTRO do Almoxarifado (ex: fila vs montagem),
 *   sem culpar o Almoxarifado pelo tempo de balcão do Solicitante.
 * - Cards descritivos sincronizados com foco e interação da barra.
 * - Acessibilidade completa via ARIA roles, títulos e navegação por teclado.
 * - Sem nenhum caractere emoji.
 *
 * @param {Object} props
 * @param {Array<{etapaId: string, etapaRotulo: string, responsabilidade: string, tempoMedianoHoras: number, percentualDoCiclo: number}>} props.etapas
 */
export default function WmsLeadTimeFunnel({ etapas = [] }) {
  const chartId = useId();
  const [etapaAtiva, setEtapaAtiva] = useState(null);

  // Calcula proporções e normaliza etapas
  const etapasNormalizadas = useMemo(() => {
    if (!Array.isArray(etapas) || etapas.length === 0) return [];

    const totalPct = etapas.reduce((acc, e) => acc + (Number(e?.percentualDoCiclo) || 0), 0) || 100;

    let acumuladoX = 0;
    return etapas.map((etapa, idx) => {
      const pct = Number(etapa?.percentualDoCiclo) || 0;
      const largura = (pct / totalPct) * LARGURA;
      const x = acumuladoX;
      acumuladoX += largura;

      const horas = Number(etapa?.tempoMedianoHoras) || 0;
      const ehAlmox = isResponsabilidadeAlmoxarifado(etapa);

      return {
        ...etapa,
        index: idx,
        x,
        largura,
        pct,
        horas,
        ehAlmox,
        cores: CORES_ETAPAS[etapa.etapaId] || (ehAlmox ? CORES_ETAPAS.aguardando_separacao : CORES_ETAPAS.aguardando_retirada)
      };
    });
  }, [etapas]);

  // Identifica a etapa mais longa estritamente dentro da responsabilidade do Almoxarifado
  const etapaGargaloAlmoxarifadoId = useMemo(() => {
    const etapasAlmox = etapasNormalizadas.filter(e => e.ehAlmox);
    if (etapasAlmox.length === 0) return null;

    let maiorTempo = -1;
    let maiorId = null;

    etapasAlmox.forEach(e => {
      if (e.horas > maiorTempo) {
        maiorTempo = e.horas;
        maiorId = e.etapaId;
      }
    });

    return maiorId;
  }, [etapasNormalizadas]);

  // Resumo para tecnologias assistivas
  const descricaoAcessivel = useMemo(() => {
    if (etapasNormalizadas.length === 0) return 'Nenhum dado de ciclo WMS disponível.';
    const resumoEtapas = etapasNormalizadas
      .map(e => `${e.etapaRotulo}: ${e.horas}h (${e.pct}%, ${e.responsabilidade})`)
      .join('; ');
    return `Ciclo operacional dividido em ${etapasNormalizadas.length} etapas: ${resumoEtapas}.`;
  }, [etapasNormalizadas]);

  if (!etapas || etapas.length === 0 || etapasNormalizadas.length === 0) {
    return (
      <div
        className="sge-chart-empty"
        style={{
          minHeight: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary, #6B7280)',
          fontSize: '0.875rem',
          backgroundColor: 'var(--card-bg, #FFFFFF)',
          borderRadius: 'var(--radius-md, 10px)',
          border: '1px solid var(--border, #E5E7EB)',
          padding: '1.5rem'
        }}
      >
        Sem dados de etapas operacionais de ciclo WMS no período.
      </div>
    );
  }

  return (
    <div
      className="sge-wms-funnel"
      style={{
        backgroundColor: 'var(--card-bg, #FFFFFF)',
        borderRadius: 'var(--radius-md, 10px)',
        padding: '1rem',
        border: '1px solid var(--border, #E5E7EB)'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}
      >
        <div>
          <h4
            id={`${chartId}-title`}
            style={{
              margin: 0,
              fontSize: '0.95rem',
              fontWeight: '600',
              color: 'var(--text-primary, #1A1D2E)'
            }}
          >
            Tempo Médio por Etapa do Pedido (WMS)
          </h4>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6B7280)' }}>
            Duração mediana e peso percentual de cada fase no tempo total de ciclo
          </span>
        </div>
      </div>

      {/* Barra Proporcional Segmentada SVG */}
      <div style={{ width: '100%', marginBottom: '1.25rem' }}>
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA_BARRA + 22}`}
          width="100%"
          height="auto"
          role="img"
          aria-labelledby={`${chartId}-title ${chartId}-desc`}
          style={{ overflow: 'visible', display: 'block' }}
        >
          <desc id={`${chartId}-desc`}>{descricaoAcessivel}</desc>

          <defs>
            <clipPath id={`${chartId}-barra-clip`}>
              <rect x="0" y="0" width={LARGURA} height={ALTURA_BARRA} rx="6" />
            </clipPath>
          </defs>

          {/* Barra segmentada recortada com cantos arredondados */}
          <g clipPath={`url(#${chartId}-barra-clip)`}>
            {etapasNormalizadas.map((etapa, idx) => {
              const isAtivo = etapaAtiva === idx;
              return (
                <rect
                  key={etapa.etapaId}
                  x={etapa.x}
                  y="0"
                  width={etapa.largura}
                  height={ALTURA_BARRA}
                  fill={etapa.cores.bg}
                  opacity={etapaAtiva !== null && !isAtivo ? 0.45 : 1}
                  style={{ transition: 'opacity 0.2s ease', cursor: 'pointer' }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${etapa.etapaRotulo}: ${etapa.horas} horas, ${etapa.pct}% do ciclo.`}
                  onMouseEnter={() => setEtapaAtiva(idx)}
                  onMouseLeave={() => setEtapaAtiva(null)}
                  onFocus={() => setEtapaAtiva(idx)}
                  onBlur={() => setEtapaAtiva(null)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setEtapaAtiva(null);
                  }}
                />
              );
            })}
          </g>

          {/* Divisórias visuais sutis entre segmentos */}
          {etapasNormalizadas.slice(1).map(etapa => (
            <line
              key={`sep-${etapa.etapaId}`}
              x1={etapa.x}
              y1="0"
              x2={etapa.x}
              y2={ALTURA_BARRA}
              stroke="#FFFFFF"
              strokeWidth="2"
              aria-hidden="true"
            />
          ))}

          {/* Percentuais centrais de cada segmento */}
          {etapasNormalizadas.map(etapa => {
            if (etapa.largura < 35) return null;
            const centroX = etapa.x + etapa.largura / 2;
            return (
              <text
                key={`label-${etapa.etapaId}`}
                x={centroX}
                y={ALTURA_BARRA / 2 + 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#FFFFFF"
                pointerEvents="none"
                aria-hidden="true"
                fontFamily="inherit"
              >
                {etapa.pct.toFixed(1)}%
              </text>
            );
          })}

          {/* Indicador de cursor para a etapa ativa */}
          {etapaAtiva !== null && (
            <polygon
              points={`
                ${etapasNormalizadas[etapaAtiva].x + etapasNormalizadas[etapaAtiva].largura / 2 - 6},${ALTURA_BARRA + 8}
                ${etapasNormalizadas[etapaAtiva].x + etapasNormalizadas[etapaAtiva].largura / 2 + 6},${ALTURA_BARRA + 8}
                ${etapasNormalizadas[etapaAtiva].x + etapasNormalizadas[etapaAtiva].largura / 2},${ALTURA_BARRA + 2}
              `}
              fill={etapasNormalizadas[etapaAtiva].cores.bg}
              aria-hidden="true"
            />
          )}
        </svg>
      </div>

      {/* Grid de Cards das Etapas com Destaque Operacional */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.75rem'
        }}
      >
        {etapasNormalizadas.map((etapa, idx) => {
          const isAtivo = etapaAtiva === idx;
          const isGargaloAlmox = etapa.etapaId === etapaGargaloAlmoxarifadoId;

          return (
            <div
              key={etapa.etapaId}
              onMouseEnter={() => setEtapaAtiva(idx)}
              onMouseLeave={() => setEtapaAtiva(null)}
              onFocus={() => setEtapaAtiva(idx)}
              onBlur={() => setEtapaAtiva(null)}
              tabIndex={0}
              role="region"
              aria-label={`${etapa.etapaRotulo}: ${etapa.horas} horas.`}
              style={{
                position: 'relative',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: isAtivo
                  ? 'var(--accent-light, #F0FDFA)'
                  : 'var(--content-bg, #F9FAFB)',
                border: `1.5px solid ${
                  isAtivo
                    ? etapa.cores.bg
                    : isGargaloAlmox
                    ? 'var(--warning, #F59E0B)'
                    : 'var(--border, #E5E7EB)'
                }`,
                transition: 'all 0.2s ease',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {/* Badge indicativo de maior tempo interno no almoxarifado */}
              {isGargaloAlmox && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-9px',
                    right: '8px',
                    backgroundColor: '#FEF3C7',
                    border: '1px solid #F59E0B',
                    borderRadius: '10px',
                    padding: '1px 6px',
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    color: '#92400E',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Etapa de maior permanência sob responsabilidade direta do Almoxarifado"
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                    <line x1="12" y1="6" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="12" y1="12" x2="16" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>Gargalo Interno</span>
                </div>
              )}

              {/* Rótulo da Etapa */}
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: '600',
                  color: 'var(--text-primary, #1A1D2E)',
                  marginBottom: '4px'
                }}
              >
                {etapa.etapaRotulo}
              </div>

              {/* Duração em Horas e Percentual */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                <span
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: etapa.cores.bg,
                    lineHeight: '1'
                  }}
                >
                  {etapa.horas.toFixed(1)}h
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6B7280)' }}>
                  ({etapa.pct.toFixed(1)}%)
                </span>
              </div>

              {/* Tag de Responsabilidade */}
              <div
                style={{
                  display: 'inline-block',
                  fontSize: '0.6875rem',
                  fontWeight: '500',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: etapa.cores.badgeBg,
                  color: etapa.cores.badgeText
                }}
              >
                {etapa.responsabilidade}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
