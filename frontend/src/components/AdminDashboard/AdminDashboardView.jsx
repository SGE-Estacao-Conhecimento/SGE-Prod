import React, { useState, useCallback } from 'react';
import useDashboardAnalytics from './useDashboardAnalytics';
import KpiAnaliticosRow from './KpiAnaliticosRow';
import EstoqueCriticoBanner from './EstoqueCriticoBanner';
import TendenciaConsumoLineChart from './charts/TendenciaConsumoLineChart';
import ConsumoSetoresBarChart from './charts/ConsumoSetoresBarChart';
import WmsLeadTimeFunnel from './charts/WmsLeadTimeFunnel';
import PrevisaoRupturaTable from './charts/PrevisaoRupturaTable';
import PrevisaoMaterialModal from './PrevisaoMaterialModal';
import './AdminDashboardView.css';

const OPCOES_JANELA = [7, 15, 30, 60];

function formatarHoraAtualizacao(isoString) {
  if (!isoString) return null;
  try {
    const data = new Date(isoString);
    if (isNaN(data.getTime())) return null;
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(data);
  } catch {
    return null;
  }
}

export default function AdminDashboardView({ onDrillDown }) {
  const [modalPrevisaoAberto, setModalPrevisaoAberto] = useState(false);
  const [selectedProdutoId, setSelectedProdutoId] = useState(null);
  const [selectedProdutoNome, setSelectedProdutoNome] = useState('');

  const handleAbrirPrevisaoModal = useCallback((produtoId, nome) => {
    setSelectedProdutoId(produtoId);
    setSelectedProdutoNome(nome || '');
    setModalPrevisaoAberto(true);
  }, []);

  const handleFecharPrevisaoModal = useCallback(() => {
    setModalPrevisaoAberto(false);
  }, []);

  const {
    data,
    loading,
    error,
    janelaDias,
    setJanelaDias,
    retryCountdown,
    recarregar
  } = useDashboardAnalytics(30);

  const horaAtualizacao = formatarHoraAtualizacao(data?.geradoEm);
  const temDados = Boolean(
    data && (
      (data.previsoesEsgotamento && data.previsoesEsgotamento.length > 0) ||
      (data.demandaSetores && data.demandaSetores.length > 0) ||
      (data.tendenciaSemanal && data.tendenciaSemanal.length > 0)
    )
  );

  return (
    <div className="admin-dashboard-container sge-page-scroll">
      {/* Cabecalho Executivo */}
      <header className="admin-dashboard-header">
        <div className="admin-dashboard-header-titles">
          <h1 className="admin-dashboard-title">Dashboard Analítico & Preditivo</h1>
          <p className="admin-dashboard-subtitle">
            Engenharia de estoque, eficiência operacional WMS e demanda setorial
          </p>
        </div>

        <div className="admin-dashboard-header-actions">
          {horaAtualizacao && (
            <span className="admin-dashboard-atualizado" title="Horário local da última compilação analítica">
              Atualizado às {horaAtualizacao}
            </span>
          )}

          {/* Seletor de Janela Temporal */}
          <div className="janela-seletor" role="group" aria-label="Janela temporal de análise">
            {OPCOES_JANELA.map((dias) => (
              <button
                key={dias}
                type="button"
                className={`btn-janela ${janelaDias === dias ? 'btn-janela--ativo' : ''}`}
                onClick={() => setJanelaDias(dias)}
                disabled={loading}
              >
                {dias} dias
              </button>
            ))}
          </div>

          {/* Botao de Recarga com Rate Limit */}
          <button
            type="button"
            className="btn-recarregar-dashboard"
            onClick={() => recarregar(true)}
            disabled={loading || retryCountdown > 0}
            title={retryCountdown > 0 ? `Aguarde ${retryCountdown} segundos para atualizar novamente` : 'Forçar atualização'}
          >
            <svg
              className={`icone-recarregar ${loading ? 'icone-recarregar--girando' : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>
              {retryCountdown > 0 ? `Aguarde ${retryCountdown}s` : 'Atualizar'}
            </span>
          </button>
        </div>
      </header>

      {/* Banner de Estoque Critico (descartavel na sessao) */}
      {data?.previsoesEsgotamento && (
        <EstoqueCriticoBanner itens={data.previsoesEsgotamento} onDrillDown={onDrillDown} />
      )}

      {/* Estado de Erro com Acao de Repeticao */}
      {error && (
        <div className="sge-feedback-banner sge-feedback-banner--error admin-dashboard-feedback" role="alert">
          <div className="admin-dashboard-feedback-texto">
            <strong>Falha na comunicação:</strong> {error}
          </div>
          <button
            type="button"
            className="btn-feedback-repetir"
            onClick={() => recarregar(false)}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Estado de Carregamento Esqueleto */}
      {loading && !data && (
        <div className="admin-dashboard-skeleton" aria-busy="true" aria-label="Carregando indicadores analíticos...">
          <div className="skeleton-card skeleton-card--tabela" />
          <div className="skeleton-kpis-grid">
            <div className="skeleton-card skeleton-card--kpi" />
            <div className="skeleton-card skeleton-card--kpi" />
            <div className="skeleton-card skeleton-card--kpi" />
            <div className="skeleton-card skeleton-card--kpi" />
          </div>
          <div className="skeleton-charts-grid">
            <div className="skeleton-card skeleton-card--grafico" />
            <div className="skeleton-card skeleton-card--grafico" />
          </div>
        </div>
      )}

      {/* Estado Vazio */}
      {!loading && !error && !temDados && (
        <div className="sge-empty-state admin-dashboard-vazio">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <p className="admin-dashboard-vazio-texto">Sem movimentações no período</p>
          <span className="admin-dashboard-vazio-subtexto">
            Não foram registrados atendimentos ou baixas na janela selecionada ({janelaDias} dias).
          </span>
        </div>
      )}

      {/* Dashboard Renderizado */}
      {temDados && (
        <main className="admin-dashboard-conteudo">
          {/* Tabela de Previsao de Ruptura de Estoque (Prioridade no Topo) */}
          <section className="admin-dashboard-secao">
            <article className="admin-dashboard-card">
              <header className="admin-dashboard-card-header">
                <div>
                  <h2 className="admin-dashboard-card-titulo">Previsão de Ruptura & Esgotamento de Estoque</h2>
                  <p className="admin-dashboard-card-descricao">
                    Materiais com necessidade de reposição preventiva ordenados por nível de criticidade
                  </p>
                </div>
              </header>
              <div className="admin-dashboard-card-corpo">
                <PrevisaoRupturaTable
                  itens={data.previsoesEsgotamento}
                  onDrillDown={onDrillDown}
                  onSelectMaterial={handleAbrirPrevisaoModal}
                />
              </div>
            </article>
          </section>

          {/* Linha de KPIs Analiticos */}
          <section className="admin-dashboard-secao">
            <KpiAnaliticosRow kpis={data.kpis} />
          </section>

          {/* Grid de Graficos: Tendencia Semanal & Demanda Setores */}
          <section className="admin-dashboard-grid-graficos">
            <article className="admin-dashboard-card">
              <header className="admin-dashboard-card-header">
                <div>
                  <h2 className="admin-dashboard-card-titulo">Tendência de Atendimento Semanal</h2>
                  <p className="admin-dashboard-card-descricao">Volume de pedidos concluídos nas últimas 8 semanas</p>
                </div>
              </header>
              <div className="admin-dashboard-card-corpo">
                <TendenciaConsumoLineChart dados={data.tendenciaSemanal} altura={220} />
              </div>
              <footer className="admin-dashboard-card-rodape">
                <span>Nota: Semanas ISO (segunda a domingo) calculadas em UTC. A última semana reflete o consumo em andamento.</span>
              </footer>
            </article>

            <article className="admin-dashboard-card">
              <header className="admin-dashboard-card-header">
                <div>
                  <h2 className="admin-dashboard-card-titulo">Distribuição de Demanda por Setor</h2>
                  <p className="admin-dashboard-card-descricao">Concentração de requisições por centro solicitante</p>
                </div>
              </header>
              <div className="admin-dashboard-card-corpo">
                <ConsumoSetoresBarChart dados={data.demandaSetores} altura={220} />
              </div>
            </article>
          </section>

          {/* Eficiencia Operacional WMS */}
          <section className="admin-dashboard-secao">
            <article className="admin-dashboard-card">
              <header className="admin-dashboard-card-header">
                <div>
                  <h2 className="admin-dashboard-card-titulo">Eficiência Operacional & Tempos de Ciclo WMS</h2>
                  <p className="admin-dashboard-card-descricao">
                    Duração mediana das etapas entre a emissão do pedido e a entrega física no balcão
                  </p>
                </div>
              </header>
              <div className="admin-dashboard-card-corpo">
                <WmsLeadTimeFunnel etapas={data.etapasWms} />
              </div>
            </article>
          </section>
        </main>
      )}

      {/* Modal de Detalhamento Preditivo Individual */}
      <PrevisaoMaterialModal
        isOpen={modalPrevisaoAberto}
        produtoId={selectedProdutoId}
        produtoNome={selectedProdutoNome}
        onClose={handleFecharPrevisaoModal}
        onDrillDownEstoque={onDrillDown}
      />
    </div>
  );
}
