import React, { useState, useEffect, useCallback } from 'react';
import { BottomSheetModal } from '../common';
import { formatarData, formatarNumero } from './charts/chartUtils';
import dashboardService from '../../services/dashboard/dashboardService';
import { formatarErroApi } from '../../services/api/client';
import HistoricoConsumoBarChart from './charts/HistoricoConsumoBarChart';
import ProjecaoSaldoLineChart from './charts/ProjecaoSaldoLineChart';
import './PrevisaoMaterialModal.css';

const STATUS_RISCO_CONFIG = {
  critico: {
    label: 'Crítico',
    badgeClass: 'sge-badge-risco--critico',
    color: '#991B1B',
    bg: '#FEF2F2',
    border: '#FECACA',
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
    badgeClass: 'sge-badge-risco--alerta',
    color: '#92400E',
    bg: '#FFFBEB',
    border: '#FDE68A',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  },
  alto_risco: {
    label: 'Alto Risco',
    badgeClass: 'sge-badge-risco--alerta',
    color: '#92400E',
    bg: '#FFFBEB',
    border: '#FDE68A',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  },
  atencao: {
    label: 'Atenção',
    badgeClass: 'sge-badge-risco--atencao',
    color: '#854D0E',
    bg: '#FEFCE8',
    border: '#FEF08A',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    )
  },
  estavel: {
    label: 'Estável',
    badgeClass: 'sge-badge-risco--estavel',
    color: '#065F46',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    )
  },
  sem_consumo_recente: {
    label: 'Sem Consumo Recente',
    badgeClass: 'sge-badge-risco--inativo',
    color: '#475569',
    bg: '#F1F5F9',
    border: '#CBD5E1',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    )
  },
  sem_dados_suficientes: {
    label: 'Sem Dados Suficientes',
    badgeClass: 'sge-badge-risco--sem-dados',
    color: '#64748B',
    bg: '#F8FAFC',
    border: '#E2E8F0',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    )
  },
  sem_giro: {
    label: 'Sem Giro',
    badgeClass: 'sge-badge-risco--inativo',
    color: '#475569',
    bg: '#F1F5F9',
    border: '#CBD5E1',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    )
  }
};

const CONFIANCA_CONFIG = {
  alta: { label: 'Alta Confiança', bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  media: { label: 'Média Confiança', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  baixa: { label: 'Baixa Confiança', bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' }
};

const TENDENCIA_CONFIG = {
  crescente: {
    label: 'Demanda Crescente',
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="7" y1="17" x2="17" y2="7" />
        <polyline points="7 7 17 7 17 17" />
      </svg>
    )
  },
  estavel: {
    label: 'Demanda Estável',
    color: '#475569',
    bg: '#F1F5F9',
    border: '#CBD5E1',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    )
  },
  decrescente: {
    label: 'Demanda Decrescente',
    color: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="7" y1="7" x2="17" y2="17" />
        <polyline points="17 7 17 17 7 17" />
      </svg>
    )
  }
};

export default function PrevisaoMaterialModal({
  isOpen,
  onClose,
  produtoId,
  produtoNome,
  nomeMaterial,
  onDrillDownEstoque,
  onNavigateToEstoque,
  variant = 'sheet'
}) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const carregarDetalhes = useCallback(async (signal) => {
    if (!produtoId || Number(produtoId) <= 0) return;
    setLoading(true);
    setError(null);

    try {
      const resposta = await dashboardService.obterPrevisaoMaterial(produtoId, signal);
      setDados(resposta);
    } catch (err) {
      if (signal?.aborted || err?.name === 'AbortError') return;
      setError(formatarErroApi(err, 'Não foi possível carregar a previsão do material.'));
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [produtoId]);

  useEffect(() => {
    if (!isOpen || !produtoId) {
      return;
    }

    const controller = new AbortController();
    carregarDetalhes(controller.signal);

    return () => {
      controller.abort();
    };
  }, [isOpen, produtoId, carregarDetalhes]);

  const nomeExibicao = dados?.nome || produtoNome || nomeMaterial || 'Detalhamento Preditivo de Estoque';
  const unidade = dados?.unidadeMedida || 'un';
  const statusConfig = STATUS_RISCO_CONFIG[dados?.statusRisco] || STATUS_RISCO_CONFIG.estavel;
  const confiancaConfig = CONFIANCA_CONFIG[dados?.nivelConfianca] || CONFIANCA_CONFIG.baixa;
  const tendenciaConfig = TENDENCIA_CONFIG[dados?.tendenciaConsumo] || TENDENCIA_CONFIG.estavel;

  const handleNavegarEstoque = () => {
    onClose();
    if (onDrillDownEstoque) {
      onDrillDownEstoque(produtoId, nomeExibicao);
    } else if (onNavigateToEstoque) {
      onNavigateToEstoque(produtoId);
    }
  };

  const badgeHeader = dados?.recalculoPendente ? (
    <span
      className="sge-previsao-modal__badge-recalculo"
      title="Movimentações recentes registradas. O recálculo está agendado na fila assíncrona."
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
      </svg>
      <span>Recálculo Pendente</span>
    </span>
  ) : null;

  const subtituloHeader = produtoId
    ? `ID: ${produtoId} | Unidade: ${unidade.toUpperCase()}`
    : '';

  const rodapeModal = (
    <div className="sge-previsao-modal__footer">
      <div className="sge-previsao-modal__footer-meta">
        {dados?.versaoAlgoritmo && (
          <span className="sge-previsao-modal__meta-item">
            Algoritmo v{dados.versaoAlgoritmo}
          </span>
        )}
        {dados?.calculadoEm && (
          <span className="sge-previsao-modal__meta-item">
            Calculado em {formatarData(dados.calculadoEm)}
          </span>
        )}
      </div>

      <div className="sge-previsao-modal__footer-actions">
        <button
          type="button"
          className="sge-modal-btn sge-modal-btn--cancel"
          onClick={onClose}
        >
          Fechar
        </button>

        {(onDrillDownEstoque || onNavigateToEstoque) && (
          <button
            type="button"
            className="sge-modal-btn sge-modal-btn--confirm"
            onClick={handleNavegarEstoque}
          >
            <span>Ver no Estoque</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title={nomeExibicao}
      subtitle={subtituloHeader}
      badge={badgeHeader}
      footer={rodapeModal}
      maxWidth="780px"
      variant={variant}
      className="sge-previsao-material-modal"
    >
      {/* Estado de Carregamento (Skeleton) */}
      {loading && !dados && (
        <div className="sge-previsao-skeleton" aria-busy="true" aria-label="Carregando previsão do material...">
          <div className="sge-previsao-skeleton__kpis-grid">
            <div className="sge-previsao-skeleton__card" />
            <div className="sge-previsao-skeleton__card" />
            <div className="sge-previsao-skeleton__card" />
            <div className="sge-previsao-skeleton__card" />
          </div>
          <div className="sge-previsao-skeleton__milestones-grid">
            <div className="sge-previsao-skeleton__card sge-previsao-skeleton__card--milestone" />
            <div className="sge-previsao-skeleton__card sge-previsao-skeleton__card--milestone" />
          </div>
          <div className="sge-previsao-skeleton__card sge-previsao-skeleton__card--grafico" />
          <div className="sge-previsao-skeleton__card sge-previsao-skeleton__card--grafico" />
        </div>
      )}

      {/* Estado de Erro */}
      {error && (
        <div className="sge-previsao-modal__erro" role="alert">
          <div className="sge-previsao-modal__erro-corpo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="sge-previsao-modal__erro-texto">
              <strong>Falha ao obter projeção:</strong>
              <p>{error}</p>
            </div>
          </div>
          <button
            type="button"
            className="sge-previsao-modal__btn-repetir"
            onClick={() => carregarDetalhes(null)}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Conteúdo Completo */}
      {!loading && !error && dados && (
        <div className="sge-previsao-modal__conteudo">
          {/* 1. Grade Superior de Métricas de Inventário (4 KPIs) */}
          <section className="sge-previsao-modal__secao" aria-label="Métricas de Inventário">
            <div className="sge-previsao-kpis-grid">
              {/* Card 1: Saldo Atual */}
              <div className="sge-previsao-kpi-card">
                <span className="sge-previsao-kpi-rotulo">Saldo Atual</span>
                <span className="sge-previsao-kpi-valor">
                  {formatarNumero(dados.estoqueAtual)} <small>{unidade}</small>
                </span>
                <span className={`sge-previsao-kpi-status ${dados.estoqueAtual <= 0 ? 'sge-previsao-kpi-status--critico' : dados.estoqueAtual <= dados.estoqueMinimo ? 'sge-previsao-kpi-status--alerta' : 'sge-previsao-kpi-status--regular'}`}>
                  {dados.estoqueAtual <= 0 ? 'Estoque esgotado' : dados.estoqueAtual <= dados.estoqueMinimo ? 'Abaixo do mínimo' : 'Disponível no armazém'}
                </span>
              </div>

              {/* Card 2: Estoque Mínimo */}
              <div className="sge-previsao-kpi-card">
                <span className="sge-previsao-kpi-rotulo">Estoque Mínimo</span>
                <span className="sge-previsao-kpi-valor">
                  {formatarNumero(dados.estoqueMinimo)} <small>{unidade}</small>
                </span>
                <span className="sge-previsao-kpi-descricao">Ponto de reposição</span>
              </div>

              {/* Card 3: Consumo Diário Ponderado */}
              <div className="sge-previsao-kpi-card">
                <span className="sge-previsao-kpi-rotulo">Consumo Diário</span>
                <span className="sge-previsao-kpi-valor">
                  {formatarNumero(dados.consumoDiarioPonderado, 2)} <small>{unidade}/dia</small>
                </span>
                <span className="sge-previsao-kpi-descricao">Média semestral ponderada</span>
              </div>

              {/* Card 4: Cobertura Estimada */}
              <div className="sge-previsao-kpi-card">
                <span className="sge-previsao-kpi-rotulo">Autonomia</span>
                <span className="sge-previsao-kpi-valor">
                  {dados.diasCobertura !== null && Number.isFinite(dados.diasCobertura)
                    ? `${Math.round(dados.diasCobertura)} dias`
                    : dados.estoqueAtual <= 0
                    ? '0 dias'
                    : '—'}
                </span>
                <span className="sge-previsao-kpi-descricao">Cobertura estimada</span>
              </div>
            </div>
          </section>

          {/* 2. Painel Preditivo: Marcos Temporais & Classificações Técnicas */}
          <section className="sge-previsao-modal__secao" aria-label="Indicadores Preditivos">
            <div className="sge-previsao-milestones-grid">
              {/* Marco 1: Estoque Mínimo */}
              <div className="sge-previsao-milestone-card">
                <div className="sge-previsao-milestone-cabecalho">
                  <span className="sge-previsao-milestone-ponto sge-previsao-milestone-ponto--minimo" aria-hidden="true" />
                  <span className="sge-previsao-milestone-titulo">Previsão Estoque Mínimo</span>
                </div>
                <div className="sge-previsao-milestone-data">
                  {dados.estoqueAtual <= dados.estoqueMinimo ? (
                    <span className="sge-previsao-milestone-alerta">Abaixo do nível mínimo</span>
                  ) : dados.dataPrevistaEstoqueMinimo ? (
                    formatarData(dados.dataPrevistaEstoqueMinimo)
                  ) : (
                    <span className="sge-previsao-milestone-vazio">Sem atingimento previsto</span>
                  )}
                </div>
                <span className="sge-previsao-milestone-subtexto">
                  Data estimada para atingir o limiar de segurança
                </span>
              </div>

              {/* Marco 2: Ruptura Total */}
              <div className="sge-previsao-milestone-card">
                <div className="sge-previsao-milestone-cabecalho">
                  <span className="sge-previsao-milestone-ponto sge-previsao-milestone-ponto--ruptura" aria-hidden="true" />
                  <span className="sge-previsao-milestone-titulo">Previsão de Ruptura (Zero)</span>
                </div>
                <div className="sge-previsao-milestone-data">
                  {dados.estoqueAtual <= 0 ? (
                    <span className="sge-previsao-milestone-critico">Material em ruptura total</span>
                  ) : dados.dataPrevistaRuptura ? (
                    formatarData(dados.dataPrevistaRuptura)
                  ) : (
                    <span className="sge-previsao-milestone-vazio">Sem ruptura projetada</span>
                  )}
                </div>
                <span className="sge-previsao-milestone-subtexto">
                  Data estimada para esgotamento total do saldo
                </span>
              </div>
            </div>

            {/* Barra de Badges Técnicos */}
            <div className="sge-previsao-badges-row" role="group" aria-label="Classificações Preditivas">
              {/* Badge Risco */}
              <span
                className="sge-previsao-tag"
                style={{
                  backgroundColor: statusConfig.bg,
                  color: statusConfig.color,
                  border: `1px solid ${statusConfig.border}`
                }}
              >
                {statusConfig.icon}
                <span>Risco: {statusConfig.label}</span>
              </span>

              {/* Badge Confiança */}
              <span
                className="sge-previsao-tag"
                style={{
                  backgroundColor: confiancaConfig.bg,
                  color: confiancaConfig.color,
                  border: `1px solid ${confiancaConfig.border}`
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>{confiancaConfig.label}</span>
              </span>

              {/* Badge Tendência */}
              <span
                className="sge-previsao-tag"
                style={{
                  backgroundColor: tendenciaConfig.bg,
                  color: tendenciaConfig.color,
                  border: `1px solid ${tendenciaConfig.border}`
                }}
              >
                {tendenciaConfig.icon}
                <span>{tendenciaConfig.label}</span>
              </span>
            </div>
          </section>

          {/* 3. Gráfico SVG Nativo: Histórico Semestral de Consumo (180 Dias) */}
          <section className="sge-previsao-modal__secao" aria-label="Histórico de Consumo">
            <article className="sge-previsao-modal__grafico-card">
              <header className="sge-previsao-modal__grafico-header">
                <div>
                  <h4 className="sge-previsao-modal__grafico-titulo">
                    Histórico Semestral Ponderado (180 Dias)
                  </h4>
                  <p className="sge-previsao-modal__grafico-descricao">
                    Consumo distribuído em 6 períodos de 30 dias com pesos preditivos de 1x a 4x
                  </p>
                </div>
              </header>

              <div className="sge-previsao-modal__grafico-corpo">
                <HistoricoConsumoBarChart
                  dados={dados.historicoConsumo180Dias}
                  unidadeMedida={unidade}
                  altura={210}
                />
              </div>

              <footer className="sge-previsao-modal__grafico-rodape">
                <span>
                  Pesos: P1-P2 (1x), P3-P4 (2x), P5 (3x) e P6 recente (4x). Outliers limitados a Mediana + 2,5 * IQR.
                </span>
              </footer>
            </article>
          </section>

          {/* 4. Gráfico SVG Nativo: Projeção Linear de Saldo */}
          <section className="sge-previsao-modal__secao" aria-label="Projeção Linear de Saldo">
            <article className="sge-previsao-modal__grafico-card">
              <header className="sge-previsao-modal__grafico-header">
                <div>
                  <h4 className="sge-previsao-modal__grafico-titulo">
                    Projeção Linear de Saldo até a Ruptura
                  </h4>
                  <p className="sge-previsao-modal__grafico-descricao">
                    Trajetória estimada de esgotamento com limiar de estoque mínimo de segurança
                  </p>
                </div>
              </header>

              <div className="sge-previsao-modal__grafico-corpo">
                <ProjecaoSaldoLineChart
                  dados={dados.projecaoSaldo}
                  estoqueAtual={dados.estoqueAtual}
                  estoqueMinimo={dados.estoqueMinimo}
                  unidadeMedida={unidade}
                  statusRisco={dados.statusRisco}
                  altura={230}
                />
              </div>

              <footer className="sge-previsao-modal__grafico-rodape">
                <span>
                  Projeção linear baseada no consumo diário ponderado ({formatarNumero(dados.consumoDiarioPonderado, 2)} {unidade}/dia). Linha tracejada âmbar marca o estoque mínimo.
                </span>
              </footer>
            </article>
          </section>
        </div>
      )}
    </BottomSheetModal>
  );
}
