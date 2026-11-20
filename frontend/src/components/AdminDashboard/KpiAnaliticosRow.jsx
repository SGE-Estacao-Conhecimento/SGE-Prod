import React from 'react';

export default function KpiAnaliticosRow({ kpis = {} }) {
  const {
    diasMedianaCoberturaAtiva = null,
    itensEmRisco = null,
    tempoMedianoAlmoxarifadoHoras = null,
    tempoMedianoCicloHoras = null,
    tempoP90CicloHoras = null,
    taxaAtendimentoIntegral = null
  } = kpis || {};

  const formatarNumero = (valor, sufixo = '') => {
    if (valor == null || isNaN(valor)) return '—';
    const formatado = Number(valor).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
    return `${formatado}${sufixo}`;
  };

  return (
    <div className="kpi-analiticos-grid" role="region" aria-label="Indicadores Analíticos Principais">
      {/* Card 1: Cobertura Mediana */}
      <div className="kpi-analitico-card">
        <div className="kpi-analitico-header">
          <span className="kpi-analitico-rotulo">Cobertura Mediana</span>
          <span className="kpi-analitico-icone kpi-icone--info" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </span>
        </div>
        <div className="kpi-analitico-valor">
          {formatarNumero(diasMedianaCoberturaAtiva, ' dias')}
        </div>
        <div className="kpi-analitico-subtitulo">
          Produtos ativos de consumo
        </div>
      </div>

      {/* Card 2: Itens em Risco */}
      <div className={`kpi-analitico-card ${Number(itensEmRisco) > 0 ? 'kpi-card--alerta' : ''}`}>
        <div className="kpi-analitico-header">
          <span className="kpi-analitico-rotulo">Itens em Risco</span>
          <span className={`kpi-analitico-icone ${Number(itensEmRisco) > 0 ? 'kpi-icone--alerta' : 'kpi-icone--ok'}`} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
        </div>
        <div className="kpi-analitico-valor">
          {itensEmRisco != null ? itensEmRisco : '—'}
        </div>
        <div className="kpi-analitico-subtitulo">
          {Number(itensEmRisco) > 0 ? 'Crítico ou Alerta de ruptura' : 'Estoque regular'}
        </div>
      </div>

      {/* Card 3: Tempo Mediano Almoxarifado */}
      <div className="kpi-analitico-card">
        <div className="kpi-analitico-header">
          <span className="kpi-analitico-rotulo">Tempo Almoxarifado</span>
          <span className="kpi-analitico-icone kpi-icone--primario" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
        </div>
        <div className="kpi-analitico-valor">
          {formatarNumero(tempoMedianoAlmoxarifadoHoras, 'h')}
        </div>
        <div className="kpi-analitico-subtitulo">
          {tempoMedianoCicloHoras != null
            ? `Ciclo: ${formatarNumero(tempoMedianoCicloHoras, 'h')} (P90: ${formatarNumero(tempoP90CicloHoras, 'h')})`
            : 'Fila + Separação'}
        </div>
      </div>

      {/* Card 4: Taxa de Atendimento Integral */}
      <div className="kpi-analitico-card">
        <div className="kpi-analitico-header">
          <span className="kpi-analitico-rotulo">Atendimento Integral</span>
          <span className="kpi-analitico-icone kpi-icone--sucesso" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </span>
        </div>
        <div className="kpi-analitico-valor">
          {formatarNumero(taxaAtendimentoIntegral, '%')}
        </div>
        <div className="kpi-analitico-subtitulo">
          Pedidos atendidos sem corte
        </div>
      </div>
    </div>
  );
}
