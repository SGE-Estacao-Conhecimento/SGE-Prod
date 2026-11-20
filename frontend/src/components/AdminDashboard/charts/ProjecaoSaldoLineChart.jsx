import React, { useCallback, useId, useMemo } from 'react';
import { calcularEscalaY, formatarNumero, gerarPathLinhaReta } from './chartUtils';

const LARGURA = 500;
const PADDING = { top: 30, bottom: 45, left: 55, right: 35 };

export default function ProjecaoSaldoLineChart({
  dados = [],
  estoqueAtual = 0,
  estoqueMinimo = 0,
  unidadeMedida = 'un',
  statusRisco = 'estavel',
  altura = 240
}) {
  const chartId = useId();

  const saldoNum = Number(estoqueAtual) || 0;
  const estoqueMinNum = Number(estoqueMinimo) || 0;

  const ehSemConsumoRecente = statusRisco === 'sem_consumo_recente';
  const ehSemDadosSuficientes = statusRisco === 'sem_dados_suficientes';
  const ehEsgotado = saldoNum <= 0;

  const pontosValidos = useMemo(() => {
    if (!Array.isArray(dados) || dados.length === 0) return [];
    return dados
      .map(p => ({
        ...p,
        dia: Number(p?.dia) || 0,
        saldoProjetado: Number(p?.saldoProjetado) || 0,
        ehEstoqueMinimo: Boolean(p?.ehEstoqueMinimo),
        ehRuptura: Boolean(p?.ehRuptura)
      }))
      .sort((a, b) => a.dia - b.dia);
  }, [dados]);

  const escalaY = useMemo(() => {
    const valores = [0, estoqueMinNum, saldoNum, ...pontosValidos.map(p => p.saldoProjetado)];
    return calcularEscalaY(valores, altura, PADDING);
  }, [pontosValidos, estoqueMinNum, saldoNum, altura]);

  const totalDias = useMemo(() => {
    if (pontosValidos.length <= 1) return 30;
    return pontosValidos[pontosValidos.length - 1].dia || 1;
  }, [pontosValidos]);

  const disponivelX = Math.max(1, LARGURA - PADDING.left - PADDING.right);

  const getPixelX = useCallback(dia => {
    const frac = Math.max(0, Math.min(1, dia / totalDias));
    return PADDING.left + frac * disponivelX;
  }, [totalDias, disponivelX]);

  const coordenadas = useMemo(() => {
    return pontosValidos.map(p => ({
      ...p,
      x: Number(getPixelX(p.dia).toFixed(2)),
      y: Number(escalaY(p.saldoProjetado).toFixed(2))
    }));
  }, [pontosValidos, escalaY, getPixelX]);

  const yEstoqueMinimo = Number(escalaY(estoqueMinNum).toFixed(2));
  const baselineY = altura - PADDING.bottom;

  const { pathLinha, pathArea, pontoMinimo, pontoRuptura } = useMemo(() => {
    if (coordenadas.length <= 1 || ehSemConsumoRecente || ehSemDadosSuficientes || ehEsgotado) {
      return { pathLinha: '', pathArea: '', pontoMinimo: null, pontoRuptura: null };
    }

    const dLinha = gerarPathLinhaReta(coordenadas);
    const primeiroX = coordenadas[0].x;
    const ultimoX = coordenadas[coordenadas.length - 1].x;
    const dArea = `${dLinha} L ${ultimoX} ${baselineY} L ${primeiroX} ${baselineY} Z`;

    const pMin = coordenadas.find(p => p.ehEstoqueMinimo);
    const pRup = coordenadas.find(p => p.ehRuptura);

    return {
      pathLinha: dLinha,
      pathArea: dArea,
      pontoMinimo: pMin,
      pontoRuptura: pRup
    };
  }, [coordenadas, baselineY, ehSemConsumoRecente, ehSemDadosSuficientes, ehEsgotado]);

  return (
    <div
      className="sge-projecao-saldo-chart"
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
        <title id={`${chartId}-title`}>Projeção Linear de Saldo até Ruptura</title>
        <desc id={`${chartId}-desc`}>
          Evolução estimada do estoque a partir do Dia 0 com marcadores de atingimento do estoque mínimo e ruptura total.
        </desc>

        <defs>
          <linearGradient id={`${chartId}-area-grad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent, #017F7B)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent, #017F7B)" stopOpacity="0.02" />
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

        {/* Linha Horizontal de Referencia: ESTOQUE MINIMO */}
        {estoqueMinNum > 0 && yEstoqueMinimo >= PADDING.top && yEstoqueMinimo <= baselineY && (
          <g className="linha-estoque-minimo" aria-hidden="true">
            <line
              x1={PADDING.left}
              y1={yEstoqueMinimo}
              x2={LARGURA - PADDING.right}
              y2={yEstoqueMinimo}
              stroke="#F59E0B"
              strokeDasharray="5 4"
              strokeWidth="1.5"
            />
            <rect
              x={LARGURA - PADDING.right - 120}
              y={yEstoqueMinimo - 16}
              width="120"
              height="15"
              rx="3"
              fill="#FFFBEB"
              stroke="#FDE68A"
              strokeWidth="0.5"
            />
            <text
              x={LARGURA - PADDING.right - 6}
              y={yEstoqueMinimo - 5}
              textAnchor="end"
              fontSize="9"
              fontWeight="600"
              fill="#92400E"
              fontFamily="inherit"
            >
              Mínimo: {formatarNumero(estoqueMinNum)} {unidadeMedida}
            </text>
          </g>
        )}

        {/* CASO ESPECIAL: Sem Consumo Recente (> 60 dias) */}
        {ehSemConsumoRecente && (
          <g className="estado-sem-consumo-recente" transform="translate(60, 50)" aria-hidden="true">
            <rect x="0" y="0" width="380" height="70" rx="8" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
            <circle cx="28" cy="35" r="14" fill="#E2E8F0" />
            <line x1="22" y1="35" x2="34" y2="35" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
            <text x="52" y="28" fontSize="12" fontWeight="700" fill="#334155">Sem Consumo Recente (&gt; 60 dias)</text>
            <text x="52" y="46" fontSize="10.5" fill="#64748B">
              Saldo de {formatarNumero(saldoNum)} {unidadeMedida} estável sem previsão de ruptura imediata.
            </text>
            <text x="52" y="60" fontSize="9" fill="#94A3B8">Não há saídas nos últimos 2 períodos semestrais.</text>
          </g>
        )}

        {/* CASO ESPECIAL: Dados Insuficientes */}
        {ehSemDadosSuficientes && (
          <g className="estado-sem-dados" transform="translate(60, 50)" aria-hidden="true">
            <rect x="0" y="0" width="380" height="70" rx="8" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
            <circle cx="28" cy="35" r="14" fill="#E2E8F0" />
            <circle cx="28" cy="29" r="1.5" fill="#475569" />
            <line x1="28" y1="33" x2="28" y2="41" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
            <text x="52" y="28" fontSize="12" fontWeight="700" fill="#334155">Dados Insuficientes para Projeção</text>
            <text x="52" y="46" fontSize="10.5" fill="#64748B">
              Sem movimentações nos últimos 180 dias. Saldo atual: {formatarNumero(saldoNum)} {unidadeMedida}.
            </text>
          </g>
        )}

        {/* CASO ESPECIAL: Esgotado Imediato */}
        {ehEsgotado && (
          <g className="estado-esgotado" transform="translate(60, 50)" aria-hidden="true">
            <rect x="0" y="0" width="380" height="70" rx="8" fill="#FEF2F2" stroke="#FECACA" strokeWidth="1" />
            <circle cx="28" cy="35" r="14" fill="#FEE2E2" />
            <line x1="28" y1="28" x2="28" y2="36" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="28" cy="41" r="1.5" fill="#EF4444" />
            <text x="52" y="28" fontSize="12" fontWeight="700" fill="#991B1B">Estoque Esgotado (Saldo 0)</text>
            <text x="52" y="46" fontSize="10.5" fill="#B91C1C">
              Material em ruptura imediata. Ponto de reposição ultrapassado.
            </text>
          </g>
        )}

        {/* FLUXO REGULAR: Projeção Linear Ativa */}
        {!ehSemConsumoRecente && !ehSemDadosSuficientes && !ehEsgotado && pathLinha && (
          <>
            {/* Área preenchida sob a reta */}
            <path d={pathArea} fill={`url(#${chartId}-area-grad)`} pointerEvents="none" aria-hidden="true" />

            {/* Traçado linear descendente */}
            <path
              d={pathLinha}
              fill="none"
              stroke="var(--accent, #017F7B)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            />

            {/* Marcador do Ponto de Estoque Mínimo */}
            {pontoMinimo && (
              <g className="marcador-estoque-minimo" aria-hidden="true">
                <circle cx={pontoMinimo.x} cy={pontoMinimo.y} r="9" fill="none" stroke="#F59E0B" strokeWidth="1" strokeOpacity="0.4" />
                <circle cx={pontoMinimo.x} cy={pontoMinimo.y} r="5.5" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2" />
                <rect
                  x={Math.max(10, pontoMinimo.x - 45)}
                  y={pontoMinimo.y > 50 ? pontoMinimo.y - 24 : pontoMinimo.y + 12}
                  width="90"
                  height="16"
                  rx="4"
                  fill="#FFFBEB"
                  stroke="#F59E0B"
                  strokeWidth="0.8"
                />
                <text
                  x={Math.max(10, pontoMinimo.x - 45) + 45}
                  y={pontoMinimo.y > 50 ? pontoMinimo.y - 12 : pontoMinimo.y + 24}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="600"
                  fill="#92400E"
                >
                  Mínimo (D+{pontoMinimo.dia})
                </text>
              </g>
            )}

            {/* Marcador do Ponto de Ruptura (Saldo 0) */}
            {pontoRuptura && (
              <g className="marcador-ruptura" aria-hidden="true">
                <circle cx={pontoRuptura.x} cy={pontoRuptura.y} r="10" fill="none" stroke="#EF4444" strokeWidth="1" strokeOpacity="0.4" />
                <circle cx={pontoRuptura.x} cy={pontoRuptura.y} r="6" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
                <rect
                  x={Math.max(10, pontoRuptura.x - 45)}
                  y={pontoRuptura.y - 24}
                  width="90"
                  height="16"
                  rx="4"
                  fill="#FEF2F2"
                  stroke="#EF4444"
                  strokeWidth="0.8"
                />
                <text
                  x={Math.max(10, pontoRuptura.x - 45) + 45}
                  y={pontoRuptura.y - 12}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="#991B1B"
                >
                  Ruptura (D+{pontoRuptura.dia})
                </text>
              </g>
            )}

            {/* Rótulos do Eixo X (Dias Chave) */}
            <g className="eixo-x-rotulos" aria-hidden="true">
              <text x={PADDING.left} y={baselineY + 18} textAnchor="middle" fontSize="10" fill="var(--text-secondary, #6B7280)">
                Hoje (D+0)
              </text>
              {pontoMinimo && pontoMinimo.dia > 0 && pontoMinimo.dia < totalDias && (
                <text x={pontoMinimo.x} y={baselineY + 18} textAnchor="middle" fontSize="10" fill="#92400E" fontWeight="600">
                  D+{pontoMinimo.dia}
                </text>
              )}
              {pontoRuptura && (
                <text x={pontoRuptura.x} y={baselineY + 18} textAnchor="middle" fontSize="10" fill="#991B1B" fontWeight="700">
                  D+{pontoRuptura.dia}
                </text>
              )}
            </g>
          </>
        )}
      </svg>
    </div>
  );
}
