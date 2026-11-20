import React, { useId, useMemo, useState } from 'react';
import { truncarTexto } from './chartUtils';

const LARGURA = 500;
const BAR_X = 165;
const BAR_MAX_WIDTH = 205;
const BAR_HEIGHT = 16;
const ROW_HEIGHT = 40;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 15;

/**
 * ConsumoSetoresBarChart — Gráfico de Barras Horizontais SVG Nativo para Distribuição de Demanda
 *
 * Características:
 * - SVG 100% nativo sem dependências de charting.
 * - Barras horizontais ordenadas de forma decrescente pela demanda.
 * - Exibe nome do setor truncado de forma segura com tooltip <title> nativo do SVG.
 * - Exibe percentual de demanda e total de pedidos atendidos.
 * - Totalmente acessível com role="img", <title>, <desc> e tabIndex={0} em cada barra.
 * - Suporte a tema claro e escuro via CSS tokens.
 * - Sem nenhum caractere emoji.
 *
 * @param {Object} props
 * @param {Array<{setorId: number, nomeSetor: string, totalPedidosAtendidos: number, totalItensDistintos?: number, percentualDemanda?: number}>} props.dados
 * @param {number} [props.altura=220]
 */
export default function ConsumoSetoresBarChart({ dados = [], altura = 220 }) {
  const chartId = useId();
  const [linhaFocada, setLinhaFocada] = useState(null);

  // Ordena os setores de forma decrescente pela demanda
  const setoresOrdenados = useMemo(() => {
    if (!Array.isArray(dados)) return [];
    return [...dados].sort((a, b) => {
      const demB = b?.percentualDemanda ?? b?.totalPedidosAtendidos ?? 0;
      const demA = a?.percentualDemanda ?? a?.totalPedidosAtendidos ?? 0;
      return demB - demA;
    });
  }, [dados]);

  // Altura dinâmica baseada na quantidade de setores
  const alturaTotal = useMemo(() => {
    if (setoresOrdenados.length === 0) return altura;
    const calculada = PADDING_TOP + setoresOrdenados.length * ROW_HEIGHT + PADDING_BOTTOM;
    return Math.max(altura, calculada);
  }, [setoresOrdenados.length, altura]);

  // Determina o valor máximo de referência para proporcionalidade das barras
  const maxReferencia = useMemo(() => {
    if (setoresOrdenados.length === 0) return 100;
    const temPercentual = setoresOrdenados.some(s => s?.percentualDemanda !== undefined);
    if (temPercentual) {
      return 100; // Referência 100% para percentuais
    }
    const maxPedidos = Math.max(...setoresOrdenados.map(s => Number(s?.totalPedidosAtendidos) || 0));
    return maxPedidos > 0 ? maxPedidos : 1;
  }, [setoresOrdenados]);

  // Resumo descritivo para leitores de tela
  const descricaoAcessivel = useMemo(() => {
    if (setoresOrdenados.length === 0) return 'Nenhum dado de demanda por setor disponível.';
    const top = setoresOrdenados[0];
    const topNome = top?.nomeSetor || 'Setor principal';
    const topPct = top?.percentualDemanda ?? 0;
    return `Distribuição de demanda entre ${setoresOrdenados.length} setores. Maior demanda registrada pelo setor ${topNome} com ${topPct}%.`;
  }, [setoresOrdenados]);

  if (!dados || dados.length === 0 || setoresOrdenados.length === 0) {
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
        Sem dados de distribuição de demanda por setor no período.
      </div>
    );
  }

  return (
    <div
      className="sge-setores-chart"
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: 'var(--card-bg, #FFFFFF)',
        borderRadius: 'var(--radius-md, 10px)',
        padding: '0.5rem 0'
      }}
    >
      <svg
        viewBox={`0 0 ${LARGURA} ${alturaTotal}`}
        width="100%"
        height="auto"
        role="img"
        aria-labelledby={`${chartId}-title ${chartId}-desc`}
        style={{ overflow: 'visible', display: 'block' }}
      >
        <title id={`${chartId}-title`}>Distribuição de Demanda por Setor</title>
        <desc id={`${chartId}-desc`}>{descricaoAcessivel}</desc>

        <defs>
          <linearGradient id={`${chartId}-bar-grad`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent, #017F7B)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--accent, #017F7B)" stopOpacity="1" />
          </linearGradient>
        </defs>

        <g className="setores-linhas">
          {setoresOrdenados.map((setor, idx) => {
            const y = PADDING_TOP + idx * ROW_HEIGHT;
            const valorAtual = setor?.percentualDemanda ?? setor?.totalPedidosAtendidos ?? 0;
            const proporcao = Math.max(0, Math.min(1, valorAtual / maxReferencia));
            const larguraBarra = Math.max(proporcao > 0 ? 4 : 0, proporcao * BAR_MAX_WIDTH);
            const isFocado = linhaFocada === idx;

            const nomeCompleto = setor?.nomeSetor || `Setor ${idx + 1}`;
            const nomeTruncado = truncarTexto(nomeCompleto, 20);
            const totalPedidos = Number(setor?.totalPedidosAtendidos) || 0;
            const pctDemanda = setor?.percentualDemanda !== undefined ? `${Number(setor.percentualDemanda).toFixed(1)}%` : '';

            return (
              <g
                key={setor?.setorId ?? idx}
                tabIndex={0}
                role="button"
                aria-label={`${nomeCompleto}: ${pctDemanda ? `${pctDemanda}, ` : ''}${totalPedidos} pedidos atendidos.`}
                onMouseEnter={() => setLinhaFocada(idx)}
                onMouseLeave={() => setLinhaFocada(null)}
                onFocus={() => setLinhaFocada(idx)}
                onBlur={() => setLinhaFocada(null)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setLinhaFocada(null);
                }}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                {/* Fundo sutil de destaque no hover/focus */}
                {isFocado && (
                  <rect
                    x="8"
                    y={y - 6}
                    width={LARGURA - 16}
                    height={ROW_HEIGHT - 4}
                    rx="6"
                    fill="var(--accent-light, #F0FDFA)"
                    stroke="var(--accent, #017F7B)"
                    strokeOpacity="0.3"
                    strokeWidth="1"
                    aria-hidden="true"
                  />
                )}

                {/* Nome do Setor alinhado à direita antes da barra */}
                <text
                  x={BAR_X - 12}
                  y={y + 12}
                  textAnchor="end"
                  fontSize="12"
                  fontWeight={isFocado ? '600' : '500'}
                  fill="var(--text-primary, #1A1D2E)"
                  fontFamily="inherit"
                >
                  <title>{nomeCompleto}</title>
                  {nomeTruncado}
                </text>

                {/* Trilho de fundo da barra (100% de capacidade) */}
                <rect
                  x={BAR_X}
                  y={y}
                  width={BAR_MAX_WIDTH}
                  height={BAR_HEIGHT}
                  rx="4"
                  fill="var(--border-light, #F3F4F6)"
                  stroke="var(--border, #E5E7EB)"
                  strokeWidth="0.5"
                  aria-hidden="true"
                />

                {/* Barra proporcional de demanda */}
                {larguraBarra > 0 && (
                  <rect
                    x={BAR_X}
                    y={y}
                    width={larguraBarra}
                    height={BAR_HEIGHT}
                    rx="4"
                    fill={isFocado ? 'var(--accent, #017F7B)' : `url(#${chartId}-bar-grad)`}
                    style={{ transition: 'width 0.3s ease, fill 0.2s ease' }}
                    aria-hidden="true"
                  />
                )}

                {/* Rótulo de valores à direita da barra */}
                <text
                  x={BAR_X + BAR_MAX_WIDTH + 10}
                  y={y + 12}
                  textAnchor="start"
                  fontSize="11.5"
                  fontWeight="600"
                  fill="var(--text-primary, #1A1D2E)"
                  fontFamily="inherit"
                >
                  {pctDemanda}
                  <tspan
                    dx="6"
                    fontSize="10.5"
                    fontWeight="400"
                    fill="var(--text-secondary, #6B7280)"
                  >
                    ({totalPedidos} {totalPedidos === 1 ? 'pedido' : 'pedidos'})
                  </tspan>
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
