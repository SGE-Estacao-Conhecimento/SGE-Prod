import React, { useState, useMemo } from 'react';
import './RelatoriosView.css';
import * as XLSX from 'xlsx';

const USUARIOS_VAZIOS = [];

/**
 * RelatoriosView
 * Módulo de Emissão e Consulta de Relatórios (RF-004)
 * Sem dados estáticos / 100% dinâmico (Clean Dynamic Integration)
 *
 * Props esperadas do backend (C# / MySQL):
 * @param {Array} dadosEstoque - Lista atual de materiais do estoque
 * @param {Array} dadosPedidos - Lista de pedidos registrados
 * @param {Array} dadosUsuarios - Lista de usuários do sistema
 * @param {Function} onGerarRelatorio - Callback para solicitar geração/exportação ao backend
 */
const RelatoriosView = ({
  dadosEstoque = [],
  dadosPedidos = [],
  dadosUsuarios = null,
  dadosRemessasExternas = [],
  dadosMovimentacoes = [],
  onGerarRelatorio
}) => {
  const usuarios = dadosUsuarios ?? USUARIOS_VAZIOS;
  const podeVerUsuarios = Array.isArray(dadosUsuarios);
  // Aba de relatório selecionada: 'estoque' | 'pedidos' | 'usuarios' | 'movimentacoes'
  const [tipoRelatorio, setTipoRelatorio] = useState('estoque');

  // Filtros dinâmicos comuns
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('');
  const [buscaTexto, setBuscaTexto] = useState('');

  // Estado de prévia / resultado do relatório gerado
  const [isGerado, setIsGerado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertaDownload, setAlertaDownload] = useState(null);

  // Categorias disponíveis extraídas dinamicamente dos dados do estoque
  const categoriasDisponiveis = useMemo(() => {
    const cats = dadosEstoque.map(m => m.categoria).filter(Boolean);
    return Array.from(new Set(cats));
  }, [dadosEstoque]);

  // Coleção de remessas e doações salvas no sistema (SGE Core)
  const dadosRemessas = dadosRemessasExternas;

  // KPIs dinâmicos gerais com base nas coleções recebidas
  const kpis = useMemo(() => {
    return {
      totalItensEstoque: dadosEstoque.length,
      itensBaixoEstoque: dadosEstoque.filter(m => m.quantidade <= m.estoqueMinimo).length,
      totalPedidos: dadosPedidos.length,
      pedidosPendentes: dadosPedidos.filter(p => p.status === 'Pendente').length,
      totalUsuarios: usuarios.length,
      usuariosAtivos: usuarios.filter(u => u.ativo).length,
      totalRemessas: dadosRemessas.length,
      totalDoacoes: dadosRemessas.filter(r => r.tipoOrigem === 'doacao').length
    };
  }, [dadosEstoque, dadosPedidos, usuarios, dadosRemessas]);

  // Registros filtrados dinamicamente para o relatório ativo
  const registrosFiltrados = useMemo(() => {
    if (tipoRelatorio === 'estoque') {
      return dadosEstoque.filter(m => {
        const matchBusca = !buscaTexto ||
          m.nome.toLowerCase().includes(buscaTexto.toLowerCase()) ||
          m.codigo.toLowerCase().includes(buscaTexto.toLowerCase());
        const matchCat = !filtroCategoria || m.categoria === filtroCategoria;
        let itemStatus = m.quantidade === 0 ? 'Sem Estoque' : m.quantidade <= m.estoqueMinimo ? 'Estoque Baixo' : 'Normal';
        const matchSt = !filtroStatus || itemStatus === filtroStatus;
        return matchBusca && matchCat && matchSt;
      });
    }

    if (tipoRelatorio === 'pedidos') {
      return dadosPedidos.filter(p => {
        const matchBusca = !buscaTexto ||
          String(p.id).includes(buscaTexto) ||
          (p.usuario && p.usuario.toLowerCase().includes(buscaTexto.toLowerCase())) ||
          (p.setor && p.setor.toLowerCase().includes(buscaTexto.toLowerCase()));
        const matchSt = !filtroStatus || p.status === filtroStatus;
        
        let matchData = true;
        if (dataInicio && p.data && p.data < dataInicio) matchData = false;
        if (dataFim && p.data && p.data > dataFim) matchData = false;

        return matchBusca && matchSt && matchData;
      });
    }

    if (tipoRelatorio === 'usuarios') {
      return usuarios.filter(u => {
        const matchBusca = !buscaTexto ||
          u.nome.toLowerCase().includes(buscaTexto.toLowerCase()) ||
          u.email.toLowerCase().includes(buscaTexto.toLowerCase()) ||
          (u.setor && u.setor.toLowerCase().includes(buscaTexto.toLowerCase()));
        const matchPerfil = !filtroPerfil || u.perfil === filtroPerfil;
        const statusUsuario = u.ativo ? 'Ativo' : 'Inativo';
        const matchSt = !filtroStatus || statusUsuario === filtroStatus;
        return matchBusca && matchPerfil && matchSt;
      });
    }

    if (tipoRelatorio === 'remessas') {
      return dadosRemessas.filter(r => {
        const termo = buscaTexto.trim().toLowerCase();
        const matchBusca = !termo ||
          String(r.id).toLowerCase().includes(termo) ||
          (r.documentoDoador && r.documentoDoador.toLowerCase().includes(termo)) ||
          r.itens?.some(i => i.nome.toLowerCase().includes(termo) || (i.codigo && i.codigo.toLowerCase().includes(termo)));
        const matchTipo = !filtroCategoria || (filtroCategoria === 'doacao' ? r.tipoOrigem === 'doacao' : filtroCategoria === 'compra_nf' ? r.tipoOrigem === 'compra_nf' : true);

        let matchData = true;
        if (dataInicio && r.data && r.data < dataInicio) matchData = false;
        if (dataFim && r.data && r.data > dataFim) matchData = false;

        return matchBusca && matchTipo && matchData;
      });
    }

    if (tipoRelatorio === 'movimentacoes') {
      return dadosMovimentacoes.filter(m => {
        const termo = buscaTexto.trim().toLowerCase();
        const matchBusca = !termo ||
          String(m.id || '').includes(termo) ||
          String(m.produtoNome || '').toLowerCase().includes(termo) ||
          String(m.funcionarioNome || '').toLowerCase().includes(termo) ||
          String(m.observacao || '').toLowerCase().includes(termo);
        const matchTipo = !filtroStatus || String(m.tipo || '').toLowerCase() === filtroStatus.toLowerCase();
        const data = m.data ? new Date(m.data) : null;
        const matchData = (!dataInicio || !data || data >= new Date(dataInicio)) &&
          (!dataFim || !data || data <= new Date(`${dataFim}T23:59:59`));
        return matchBusca && matchTipo && matchData;
      });
    }

    return [];
  }, [tipoRelatorio, dadosEstoque, dadosPedidos, usuarios, dadosRemessas, dadosMovimentacoes, buscaTexto, filtroCategoria, filtroStatus, filtroPerfil, dataInicio, dataFim]);

  const handleGerarRelatorio = () => {
    setLoading(true);
    setIsGerado(true);
    setLoading(false);
    if (onGerarRelatorio) {
      onGerarRelatorio({
        tipo: tipoRelatorio,
        filtros: { dataInicio, dataFim, filtroCategoria, filtroStatus, filtroPerfil, buscaTexto }
      });
    }
  };

  const handleExportar = async (formato) => {
    setAlertaDownload(`Gerando exportação em ${formato.toUpperCase()}...`);
    try {
      if (formato === 'PDF') {
        setAlertaDownload(null);
        window.setTimeout(() => window.print(), 100);
        return;
      }
      if (formato === 'Excel') {
        const rows = registrosFiltrados.map((item) => {
          if (tipoRelatorio === 'movimentacoes') return {
            ID: item.id,
            Data: item.data ? new Date(item.data).toLocaleString('pt-BR') : '',
            Material: item.produtoNome || `Produto #${item.produtoId}`,
            Tipo: item.tipo,
            Quantidade: item.quantidade,
            Responsável: item.funcionarioNome || '',
            Observação: item.observacao || ''
          };
          if (tipoRelatorio === 'estoque') return {
            Código: item.codigo,
            Material: item.nome,
            Categoria: item.categoria,
            Localização: item.localizacao || '',
            Quantidade: item.quantidade,
            'Estoque mínimo': item.estoqueMinimo,
            Situação: item.quantidade === 0 ? 'Sem estoque' : item.quantidade <= item.estoqueMinimo ? 'Estoque baixo' : 'Normal'
          };
          if (tipoRelatorio === 'pedidos') return {
            Pedido: item.id,
            Data: item.data || '',
            Solicitante: item.usuario,
            Setor: item.setor,
            Prioridade: item.prioridade || 'Normal',
            Status: item.status
          };
          if (tipoRelatorio === 'usuarios') return {
            ID: item.id,
            Nome: item.nome,
            Email: item.email,
            Perfil: item.perfil,
            Setor: item.setor,
            Status: item.ativo ? 'Ativo' : 'Inativo'
          };
          return {
            Remessa: item.id,
            Data: item.dataFormatada || item.data || '',
            Tipo: item.tipoOrigem,
            Documento: item.documentoDoador || '',
            Materiais: item.itens?.map(i => i.nome).join(', ') || ''
          };
        });
        const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Informação: 'Nenhum registro encontrado' }]);
        const columns = Object.keys(rows[0] || { Informação: '' });
        worksheet['!cols'] = columns.map((column) => ({ wch: Math.min(Math.max(column.length + 4, 14), 34) }));
        worksheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(columns.length - 1)}${Math.max(rows.length, 1) + 1}` };
        worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
        const headerRange = XLSX.utils.decode_range(worksheet['!ref']);
        for (let column = headerRange.s.c; column <= headerRange.e.c; column += 1) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: column })];
          if (cell) {
            cell.s = {
              fill: { fgColor: { rgb: '017F7B' } },
              font: { bold: true, color: { rgb: 'FFFFFF' } },
              alignment: { horizontal: 'center' }
            };
          }
        }
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');
        XLSX.writeFile(workbook, `relatorio-${tipoRelatorio}.xlsx`);
      }
      setAlertaDownload(`Relatório exportado em ${formato.toUpperCase()} com sucesso!`);
      setTimeout(() => setAlertaDownload(null), 3000);
    } catch (error) {
      setAlertaDownload(error.message);
    }
  };

  const limparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setFiltroCategoria('');
    setFiltroStatus('');
    setFiltroPerfil('');
    setBuscaTexto('');
    setIsGerado(false);
  };

  return (
    <div className="relatorios-page-container">
      {/* Header */}
      <div className="relatorios-page-header">
        <div>
          <h1 className="relatorios-page-title">Relatórios e Indicadores do Sistema</h1>
          <p className="relatorios-page-subtitle">
            Configure parâmetros, gere consultas consolidadas e exporte dados operacionais em PDF ou Excel.
          </p>
        </div>

        {alertaDownload && (
          <div className="download-toast" role="status" aria-live="polite">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {alertaDownload}
          </div>
        )}
      </div>

      {/* Cards de Resumo Operacional */}
      <div className="relatorios-kpis-grid">
        <button type="button" className="relatorio-kpi-card" onClick={() => { setTipoRelatorio('estoque'); setIsGerado(false); }}>
          <div className="relatorio-kpi-icon relatorio-kpi-icon--estoque">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div className="relatorio-kpi-body">
            <span className="relatorio-kpi-label">Materiais Cadastrados</span>
            <div className="relatorio-kpi-val">{kpis.totalItensEstoque}</div>
            <small className="relatorio-kpi-sub">
              {kpis.itensBaixoEstoque > 0 ? (
                <span className="text-warning">{kpis.itensBaixoEstoque} em atenção / crítico</span>
              ) : (
                'Estoque balanceado'
              )}
            </small>
          </div>
        </button>

        <button type="button" className="relatorio-kpi-card" onClick={() => { setTipoRelatorio('pedidos'); setIsGerado(false); }}>
          <div className="relatorio-kpi-icon relatorio-kpi-icon--pedidos">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div className="relatorio-kpi-body">
            <span className="relatorio-kpi-label">Total de Solicitações</span>
            <div className="relatorio-kpi-val">{kpis.totalPedidos}</div>
            <small className="relatorio-kpi-sub">
              {kpis.pedidosPendentes > 0 ? (
                <span className="text-warning">{kpis.pedidosPendentes} aguardando atendimento</span>
              ) : (
                'Nenhum pedido pendente'
              )}
            </small>
          </div>
        </button>

        {podeVerUsuarios && <button type="button" className="relatorio-kpi-card" onClick={() => { setTipoRelatorio('usuarios'); setIsGerado(false); }}>
          <div className="relatorio-kpi-icon relatorio-kpi-icon--usuarios">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="relatorio-kpi-body">
            <span className="relatorio-kpi-label">Usuários Ativos</span>
            <div className="relatorio-kpi-val">{kpis.usuariosAtivos}</div>
            <small className="relatorio-kpi-sub">{kpis.totalUsuarios} registrados no sistema</small>
          </div>
        </button>}

        <button type="button" className="relatorio-kpi-card" onClick={() => { setTipoRelatorio('remessas'); setIsGerado(false); }}>
          <div className="relatorio-kpi-icon relatorio-kpi-icon--total" style={{ background: '#E6F4F3', color: '#017F7B' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div className="relatorio-kpi-body">
            <span className="relatorio-kpi-label">Remessas & Doações</span>
            <div className="relatorio-kpi-val">{kpis.totalRemessas}</div>
            <small className="relatorio-kpi-sub">
              {kpis.totalDoacoes > 0 ? (
                <span style={{ color: '#017F7B', fontWeight: 600 }}>{kpis.totalDoacoes} doações registradas</span>
              ) : (
                'Remessas e compras no lote'
              )}
            </small>
          </div>
        </button>
      </div>

      {/* Painel seletor de tipo de relatório e filtros */}
      <div className="relatorios-builder-card">
        <div className="relatorios-type-tabs">
          <button
            className={`relatorios-tab-btn ${tipoRelatorio === 'estoque' ? 'relatorios-tab-btn--active' : ''}`}
            onClick={() => { setTipoRelatorio('estoque'); setIsGerado(false); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            Relatório de Estoque e Saldo
          </button>

          <button
            className={`relatorios-tab-btn ${tipoRelatorio === 'pedidos' ? 'relatorios-tab-btn--active' : ''}`}
            onClick={() => { setTipoRelatorio('pedidos'); setIsGerado(false); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
            Histórico e Atendimento de Pedidos
          </button>

          {podeVerUsuarios && <button
            className={`relatorios-tab-btn ${tipoRelatorio === 'usuarios' ? 'relatorios-tab-btn--active' : ''}`}
            onClick={() => { setTipoRelatorio('usuarios'); setIsGerado(false); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            Controle de Acessos e Usuários
          </button>}

          <button
            className={`relatorios-tab-btn ${tipoRelatorio === 'remessas' ? 'relatorios-tab-btn--active' : ''}`}
            onClick={() => { setTipoRelatorio('remessas'); setIsGerado(false); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            Remessas, Entradas e Doações
          </button>

          <button
            className={`relatorios-tab-btn ${tipoRelatorio === 'movimentacoes' ? 'relatorios-tab-btn--active' : ''}`}
            onClick={() => { setTipoRelatorio('movimentacoes'); setIsGerado(false); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18" /><path d="M12 3v18" /><path d="m7 7 5-4 5 4" /><path d="m7 17 5 4 5-4" />
            </svg>
            Movimentações de Estoque
          </button>
        </div>

        {/* Formulário de Parâmetros e Filtros Dinâmicos */}
        <div className="relatorios-filters-row">
          <div className="filter-field filter-field--search">
            <label className="filter-label" htmlFor="relatorio-busca">Termo de Busca</label>
            <div className="filter-input-wrap">
              <input
                type="text"
                id="relatorio-busca"
                placeholder={
                  tipoRelatorio === 'estoque'
                    ? 'Buscar por material, código...'
                    : tipoRelatorio === 'pedidos'
                    ? 'Buscar por solicitante, setor, ID...'
                    : 'Buscar por nome, e-mail, setor...'
                }
                value={buscaTexto}
                onChange={e => setBuscaTexto(e.target.value)}
                className="filter-input"
              />
              {buscaTexto && (
                <button type="button" className="btn-clear-input" onClick={() => setBuscaTexto('')} aria-label="Limpar termo de busca">&times;</button>
              )}
            </div>
          </div>

          {tipoRelatorio === 'estoque' && (
            <div className="filter-field">
              <label className="filter-label" htmlFor="relatorio-categoria">Categoria</label>
              <select
                id="relatorio-categoria"
                value={filtroCategoria}
                onChange={e => setFiltroCategoria(e.target.value)}
                className="filter-select"
              >
                <option value="">Todas as categorias</option>
                {categoriasDisponiveis.map((c, i) => (
                  <option key={i} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {tipoRelatorio === 'pedidos' && (
            <>
              <div className="filter-field">
                <label className="filter-label" htmlFor="relatorio-data-inicio">Data Início</label>
                <input
                  id="relatorio-data-inicio"
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="filter-input"
                />
              </div>

              <div className="filter-field">
                <label className="filter-label" htmlFor="relatorio-data-fim">Data Fim</label>
                <input
                  id="relatorio-data-fim"
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="filter-input"
                />
              </div>
            </>
          )}

          {tipoRelatorio === 'usuarios' && (
            <div className="filter-field">
              <label className="filter-label" htmlFor="relatorio-perfil">Perfil de Acesso</label>
              <select
                id="relatorio-perfil"
                value={filtroPerfil}
                onChange={e => setFiltroPerfil(e.target.value)}
                className="filter-select"
              >
                <option value="">Todos os perfis</option>
                <option value="Administrativo">Administrativo</option>
                <option value="Almoxarifado">Almoxarifado</option>
                <option value="Usuário">Usuário</option>
              </select>
            </div>
          )}

          <div className="filter-field">
            <label className="filter-label" htmlFor="relatorio-status">Status</label>
            <select
              id="relatorio-status"
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              className="filter-select"
            >
              <option value="">Todos</option>
              {tipoRelatorio === 'estoque' && (
                <>
                  <option value="Normal">Normal</option>
                  <option value="Estoque Baixo">Estoque Baixo</option>
                  <option value="Sem Estoque">Sem Estoque</option>
                </>
              )}
              {tipoRelatorio === 'pedidos' && (
                <>
                  <option value="Pendente">Pendente</option>
                  <option value="Em Separação">Em separação</option>
                  <option value="Pronto para Retirada">Pronto para retirada</option>
                  <option value="Atendido">Atendido</option>
                  <option value="Cancelado">Cancelado</option>
                </>
              )}
              {tipoRelatorio === 'usuarios' && (
                <>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </>
              )}
            </select>
          </div>

          <div className="filter-actions-group">
            <button
              id="btn-gerar-relatorio"
              className="btn-submit-relatorio"
              onClick={handleGerarRelatorio}
              disabled={loading}
            >
              {loading ? (
                'Gerando...'
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  Gerar Relatório
                </>
              )}
            </button>

            <button
              type="button"
              className="btn-reset-filters"
              onClick={limparFiltros}
              title="Limpar todos os filtros"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Área de Visualização e Exportação dos Resultados */}
      <div className="relatorios-results-card">
        <div className="results-header">
          <div className="results-title-wrap">
            <h3 className="results-title">
              {tipoRelatorio === 'estoque' && 'Relatório Detalhado de Saldo em Estoque'}
              {tipoRelatorio === 'pedidos' && 'Relatório de Atendimento e Pedidos'}
              {tipoRelatorio === 'usuarios' && 'Relatório Cadastral de Usuários'}
              {tipoRelatorio === 'remessas' && 'Relatório de Remessas, Entradas e Doações'}
              {tipoRelatorio === 'movimentacoes' && 'Relatório de Movimentações de Estoque'}
            </h3>
            <span className="results-count">
              {registrosFiltrados.length} {registrosFiltrados.length === 1 ? 'registro filtrado' : 'registros filtrados'}
            </span>
          </div>

          {registrosFiltrados.length > 0 && (
            <div className="export-actions">
              <button
                id="btn-export-pdf"
                className="btn-export-action btn-export-action--pdf"
                onClick={() => handleExportar('PDF')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Exportar PDF
              </button>
              <button
                id="btn-export-excel"
                className="btn-export-action btn-export-action--excel"
                onClick={() => handleExportar('Excel')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="3" y1="15" x2="21" y2="15"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                  <line x1="15" y1="3" x2="15" y2="21"/>
                </svg>
                Exportar planilha .xlsx
              </button>
            </div>
          )}
        </div>

        {/* Tabela do Relatório Gerado ou Empty State */}
        {!isGerado ? (
          <div className="relatorio-empty-state">
            <div className="relatorio-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <h4>Pronto para gerar o relatório</h4>
            <p>Selecione a categoria de dados acima, ajuste os filtros desejados e clique em <strong>Gerar Relatório</strong> para visualizar a prévia e exportar os registros.</p>
          </div>
        ) : registrosFiltrados.length === 0 ? (
          <div className="relatorio-empty-state">
            <div className="relatorio-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
              </svg>
            </div>
            <h4>Nenhum registro encontrado</h4>
            <p>Não há dados correspondentes aos filtros aplicados para este relatório no sistema.</p>
            <button className="btn-reset-filters" onClick={limparFiltros}>Limpar Filtros</button>
          </div>
        ) : (
          <div className="relatorio-table-wrapper">
            {tipoRelatorio === 'estoque' && (
              <table className="relatorio-table">
                <thead>
                  <tr>
                    <th>Código SKU</th>
                    <th>Material</th>
                    <th>Categoria</th>
                    <th>Localização</th>
                    <th>Qtd. Atual</th>
                    <th>Estoque Mínimo</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map(m => {
                    const statusText = m.quantidade === 0 ? 'Sem Estoque' : m.quantidade <= m.estoqueMinimo ? 'Estoque Baixo' : 'Normal';
                    const badgeClass = m.quantidade === 0 ? 'badge--danger' : m.quantidade <= m.estoqueMinimo ? 'badge--warning' : 'badge--success';
                    return (
                      <tr key={m.id}>
                        <td><code>{m.codigo}</code></td>
                        <td><strong>{m.nome}</strong></td>
                        <td>{m.categoria}</td>
                        <td>{m.localizacao || '—'}</td>
                        <td><strong>{m.quantidade}</strong> {m.unidade}</td>
                        <td>{m.estoqueMinimo} {m.unidade}</td>
                        <td><span className={`status-badge ${badgeClass}`}>{statusText}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {tipoRelatorio === 'pedidos' && (
              <table className="relatorio-table">
                <thead>
                  <tr>
                    <th>Nº Pedido</th>
                    <th>Data</th>
                    <th>Solicitante</th>
                    <th>Setor</th>
                    <th>Materiais Solicitados</th>
                    <th>Prioridade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map(p => {
                    const badgeClass = p.status === 'Atendido' ? 'badge--success' : p.status === 'Cancelado' ? 'badge--danger' : 'badge--warning';
                    return (
                      <tr key={p.id}>
                        <td><code>#{p.id}</code></td>
                        <td>{p.data || '—'}</td>
                        <td><strong>{p.usuario}</strong></td>
                        <td>{p.setor}</td>
                        <td>
                          {p.materiais ? p.materiais.join(', ') : (p.itens ? p.itens.map(i => `${i.materialNome} (${i.quantidade})`).join(', ') : '—')}
                        </td>
                        <td>{p.prioridade || 'Normal'}</td>
                        <td><span className={`status-badge ${badgeClass}`}>{p.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {tipoRelatorio === 'usuarios' && (
              <table className="relatorio-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Perfil</th>
                    <th>Setor</th>
                    <th>Data Cadastro</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map(u => (
                    <tr key={u.id}>
                      <td><code>#{u.id}</code></td>
                      <td><strong>{u.nome}</strong></td>
                      <td>{u.email}</td>
                      <td><span className="perfil-tag">{u.perfil}</span></td>
                      <td>{u.setor}</td>
                      <td>{u.dataCadastro || '—'}</td>
                      <td>
                        <span className={`status-badge ${u.ativo ? 'badge--success' : 'badge--danger'}`}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tipoRelatorio === 'movimentacoes' && (
              <table className="relatorio-table">
                <thead><tr><th>ID</th><th>Data</th><th>Material</th><th>Tipo</th><th>Quantidade</th><th>Responsável</th><th>Observação</th></tr></thead>
                <tbody>
                  {registrosFiltrados.map(m => (
                    <tr key={m.id}>
                      <td><code>#{m.id}</code></td>
                      <td>{m.data ? new Date(m.data).toLocaleString('pt-BR') : '—'}</td>
                      <td><strong>{m.produtoNome || `Produto #${m.produtoId}`}</strong></td>
                      <td>{m.tipo || '—'}</td>
                      <td>{m.quantidade}</td>
                      <td>{m.funcionarioNome || '—'}</td>
                      <td>{m.observacao || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tipoRelatorio === 'remessas' && (
              <table className="relatorio-table">
                <thead>
                  <tr>
                    <th>Cód. Remessa</th>
                    <th>Data / Hora</th>
                    <th>Tipo</th>
                    <th>Doador / Documento</th>
                    <th>Volumes</th>
                    <th>Materiais Recebidos</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <code>#{r.id}</code>
                      </td>
                      <td>
                        {r.dataFormatada ||
                          new Intl.DateTimeFormat('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          }).format(new Date(r.data))}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            r.tipoOrigem === 'doacao'
                              ? 'badge--success'
                              : 'badge--info'
                          }`}
                        >
                          {r.tipoOrigem === 'doacao'
                            ? 'Doação'
                            : r.tipoOrigem === 'compra_nf'
                            ? 'Compra / NF'
                            : 'Outra Entrada'}
                        </span>
                      </td>
                      <td>
                        <strong>{r.documentoDoador || 'Não especificado'}</strong>
                        {r.observacao && (
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                            {r.observacao}
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>{r.totalVolumes}</strong> un
                      </td>
                      <td>
                        {r.itens && r.itens.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {r.itens.map((item, idx) => (
                              <span key={idx} style={{ fontSize: '12px', color: '#334155' }}>
                                • <strong>{item.nome}</strong>: +{item.qtdRecebida} {item.unidade}
                              </span>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RelatoriosView;
