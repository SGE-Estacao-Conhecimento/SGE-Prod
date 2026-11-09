import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import './RelatoriosView.css';

const USUARIOS_VAZIOS = [];

/**
 * Converte qualquer formato de data presente no sistema para formato ISO YYYY-MM-DD
 */
const normalizarDataParaIso = (dataStr) => {
  if (!dataStr) return null;
  if (dataStr instanceof Date) {
    return isNaN(dataStr.getTime()) ? null : dataStr.toISOString().split('T')[0];
  }
  const str = String(dataStr).trim();
  if (str.includes('T')) return str.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/');
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return null;
};

/**
 * Central de Emissão de Relatórios Parametrizada do SGE
 * 
 * - Padrão em 2 Telas: Tela 1 (Configuração & Parâmetros) -> Tela 2 (Extrato Completo & Exportações).
 * - Sem títulos ou subtítulos redundantes dentro da página.
 * - Cards limpos e objetivos sem badges de taxonomia desnecessários.
 * - Exportação integral de todos os metadados: Complexo, Locação, Localização, Validade, Déficit, etc.
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

  // Catálogo dos Relatórios Disponíveis (sem badges de taxonomia redundantes)
  const catalogos = useMemo(() => {
    const list = [
      {
        id: 'estoque',
        titulo: 'Posição de Estoque & Reposição',
        subtitulo: 'Saldos físicos atuais, estoque mínimo, alertas de ruptura e déficit sugerido para compras'
      },
      {
        id: 'consumo_setor',
        titulo: 'Consumo por Setor Escolar',
        subtitulo: 'Levantamento consolidado de materiais entregues por centro de custo para prestação de contas'
      },
      {
        id: 'movimentacoes',
        titulo: 'Extrato de Movimentações (Kardex)',
        subtitulo: 'Rastreabilidade cronológica de entradas (remessas/doações), saídas de pedidos e balanços físicos'
      },
      {
        id: 'pedidos',
        titulo: 'Atendimento de Pedidos e Eficiência WMS',
        subtitulo: 'Métricas de atendimento de solicitações, entregas totais, parciais e motivos de recusas'
      }
    ];

    if (podeVerUsuarios) {
      list.push({
        id: 'usuarios',
        titulo: 'Cadastro e Acessos de Usuários',
        subtitulo: 'Relação de logins cadastrados, perfis de autorização, setores e atividade no sistema'
      });
    }

    return list;
  }, [podeVerUsuarios]);

  // Controle de Tela Ativa: 'configuracao' | 'extrato'
  const [faseTela, setFaseTela] = useState('configuracao');

  // Relatório selecionado atualmente
  const [relatorioSelecionado, setRelatorioSelecionado] = useState('estoque');

  // Parâmetros de Consulta
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [atalhoDataAtivo, setAtalhoDataAtivo] = useState('tudo');

  // Filtros Específicos
  const [filtroTipoBem, setFiltroTipoBem] = useState('todos'); // 'todos' | 'consumo' | 'duravel'
  const [filtroSaldoStatus, setFiltroSaldoStatus] = useState('todos'); // 'todos' | 'criticos' | 'zerados' | 'normais'
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('');
  const [filtroStatusPedido, setFiltroStatusPedido] = useState('todos');
  const [filtroTipoMovimento, setFiltroTipoMovimento] = useState('todos');
  const [filtroPerfil, setFiltroPerfil] = useState('');
  const [filtroStatusUsuario, setFiltroStatusUsuario] = useState('todos');
  const [buscaTexto, setBuscaTexto] = useState('');

  // Controle de Feedback e Timestamp
  const [dataHoraGeracao, setDataHoraGeracao] = useState(new Date());
  const [alertaDownload, setAlertaDownload] = useState(null);

  // Lista dinâmica de categorias a partir do estoque
  const categoriasDisponiveis = useMemo(() => {
    const set = new Set();
    dadosEstoque.forEach(m => {
      if (m.categoria) set.add(m.categoria);
    });
    return Array.from(set);
  }, [dadosEstoque]);

  // Lista dinâmica de setores a partir dos pedidos e usuários
  const setoresDisponiveis = useMemo(() => {
    const set = new Set();
    dadosPedidos.forEach(p => { if (p.setor) set.add(p.setor); });
    usuarios.forEach(u => { if (u.setor) set.add(u.setor); });
    return Array.from(set);
  }, [dadosPedidos, usuarios]);

  // Aplica atalhos de data predefinidos
  const handleAplicarAtalhoData = (tipo) => {
    setAtalhoDataAtivo(tipo);
    const hoje = new Date();
    const hojeIso = hoje.toISOString().split('T')[0];

    if (tipo === 'este_mes') {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
      setDataInicio(inicio);
      setDataFim(hojeIso);
    } else if (tipo === 'mes_anterior') {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().split('T')[0];
      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().split('T')[0];
      setDataInicio(inicio);
      setDataFim(fim);
    } else if (tipo === 'ultimos_30') {
      const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setDataInicio(trintaDiasAtras);
      setDataFim(hojeIso);
    } else if (tipo === 'ano_atual') {
      const inicio = `${hoje.getFullYear()}-01-01`;
      setDataInicio(inicio);
      setDataFim(hojeIso);
    } else if (tipo === 'tudo') {
      setDataInicio('');
      setDataFim('');
    }
  };

  // Limpa os parâmetros específicos
  const handleLimparParametros = () => {
    setDataInicio('');
    setDataFim('');
    setAtalhoDataAtivo('tudo');
    setFiltroTipoBem('todos');
    setFiltroSaldoStatus('todos');
    setFiltroCategoria('');
    setFiltroSetor('');
    setFiltroStatusPedido('todos');
    setFiltroTipoMovimento('todos');
    setFiltroPerfil('');
    setFiltroStatusUsuario('todos');
    setBuscaTexto('');
  };

  // Execução do Relatório: avança para a Tela 2 (Extrato)
  const handleExecutarRelatorio = () => {
    setDataHoraGeracao(new Date());
    setFaseTela('extrato');
    if (onGerarRelatorio) {
      onGerarRelatorio({
        tipo: relatorioSelecionado,
        parametros: {
          dataInicio,
          dataFim,
          filtroTipoBem,
          filtroSaldoStatus,
          filtroCategoria,
          filtroSetor,
          filtroStatusPedido,
          filtroTipoMovimento,
          filtroPerfil,
          buscaTexto
        }
      });
    }
  };

  // 1. Processamento: Posição de Estoque & Reposição (com Complexo, Locação, Localização e Validade)
  const dadosRelatorioEstoque = useMemo(() => {
    if (relatorioSelecionado !== 'estoque') return [];
    const termo = buscaTexto.trim().toLowerCase();

    return dadosEstoque
      .filter(m => {
        // Tipo de bem
        if (filtroTipoBem === 'duravel' && !m.bemDuravel) return false;
        if (filtroTipoBem === 'consumo' && m.bemDuravel) return false;

        // Categoria
        if (filtroCategoria && m.categoria !== filtroCategoria) return false;

        // Saldo
        const saldo = Number(m.quantidade) || 0;
        const min = Number(m.estoqueMinimo) || 0;
        if (filtroSaldoStatus === 'criticos' && saldo > min) return false;
        if (filtroSaldoStatus === 'zerados' && saldo > 0) return false;
        if (filtroSaldoStatus === 'normais' && (saldo <= min || saldo === 0)) return false;

        // Busca
        if (termo) {
          const matchCod = String(m.codigo || '').toLowerCase().includes(termo);
          const matchNome = String(m.nome || '').toLowerCase().includes(termo);
          const matchLoc = String(m.localizacao || '').toLowerCase().includes(termo);
          const matchComp = String(m.complexo || '').toLowerCase().includes(termo);
          if (!matchCod && !matchNome && !matchLoc && !matchComp) return false;
        }

        return true;
      })
      .map(m => {
        const saldo = Number(m.quantidade) || 0;
        const min = Number(m.estoqueMinimo) || 0;
        const deficit = Math.max(0, min - saldo);
        const situacao = saldo === 0 ? 'Sem Estoque' : saldo <= min ? 'Estoque Baixo' : 'Normal';

        // Normalização completa do endereçamento físico WMS (Complexo, Localização)
        let comp = m.complexo || '';
        let loc = m.localizacao || '';
        if (!comp && loc.includes('•')) {
          const parts = loc.split('•');
          comp = parts[0].trim();
          loc = parts.slice(1).join('•').trim();
        }
        if (!comp) comp = 'Almoxarifado Central';

        const validadeFormatada = m.dataValidade
          ? normalizarDataParaIso(m.dataValidade)?.split('-').reverse().join('/') || m.dataValidade
          : m.bemDuravel
          ? 'Não se aplica'
          : '—';

        return {
          id: m.id,
          codigo: m.codigo || `MAT-${m.id}`,
          nome: m.nome,
          categoria: m.categoria || 'Geral',
          tipoBem: m.bemDuravel ? 'Bem Durável' : 'Consumo',
          complexo: comp,
          localizacao: loc || '—',
          validade: validadeFormatada,
          itensPorEmbalagem: m.itensPorEmbalagem || 1,
          quantidade: saldo,
          estoqueMinimo: min,
          deficitSugerido: deficit,
          unidade: m.unidade || 'un',
          situacao
        };
      });
  }, [relatorioSelecionado, dadosEstoque, filtroTipoBem, filtroSaldoStatus, filtroCategoria, buscaTexto]);

  // 2. Processamento: Consumo por Setor Escolar
  const dadosRelatorioConsumoSetor = useMemo(() => {
    if (relatorioSelecionado !== 'consumo_setor') return [];
    const termo = buscaTexto.trim().toLowerCase();

    const mapMateriais = new Map();
    dadosEstoque.forEach(m => {
      mapMateriais.set(String(m.id), m);
      mapMateriais.set(String(m.nome).toLowerCase(), m);
    });

    const agregador = new Map();

    dadosPedidos.forEach(p => {
      const dataIso = normalizarDataParaIso(p.data);
      if (dataInicio && dataIso && dataIso < dataInicio) return;
      if (dataFim && dataIso && dataIso > dataFim) return;

      const setorPedido = p.setor || 'Geral';
      if (filtroSetor && setorPedido !== filtroSetor) return;

      const st = String(p.status || '').toLowerCase();
      const foiAtendido = st.includes('atendido') || st.includes('entregue') || st.includes('conclu') || st.includes('pronto');
      if (!foiAtendido) return;

      const itensLista = Array.isArray(p.itens) && p.itens.length > 0
        ? p.itens
        : Array.isArray(p.materiais)
        ? p.materiais.map(m => ({ materialNome: m, quantidade: 1 }))
        : [];

      itensLista.forEach(it => {
        const matNome = it.materialNome || it.nome || 'Material Diverso';
        const matInfo = mapMateriais.get(String(it.produtoId)) || mapMateriais.get(matNome.toLowerCase());
        const isDuravel = matInfo?.bemDuravel ?? false;

        if (filtroTipoBem === 'duravel' && !isDuravel) return;
        if (filtroTipoBem === 'consumo' && isDuravel) return;

        if (termo) {
          const matchNome = matNome.toLowerCase().includes(termo);
          const matchSetor = setorPedido.toLowerCase().includes(termo);
          if (!matchNome && !matchSetor) return;
        }

        const qtdAtendida = Number(it.quantidadeAtendida !== undefined ? it.quantidadeAtendida : it.quantidade) || 1;
        if (qtdAtendida <= 0) return;

        const chave = `${setorPedido}___${matNome}`;
        if (!agregador.has(chave)) {
          agregador.set(chave, {
            setor: setorPedido,
            material: matNome,
            categoria: matInfo?.categoria || 'Geral',
            tipoBem: isDuravel ? 'Bem Durável' : 'Consumo',
            unidade: it.unidade || matInfo?.unidade || 'un',
            quantidadeEntregue: 0,
            pedidosCount: 0
          });
        }

        const reg = agregador.get(chave);
        reg.quantidadeEntregue += qtdAtendida;
        reg.pedidosCount += 1;
      });
    });

    return Array.from(agregador.values()).sort((a, b) => {
      if (a.setor !== b.setor) return a.setor.localeCompare(b.setor);
      return b.quantidadeEntregue - a.quantidadeEntregue;
    });
  }, [relatorioSelecionado, dadosPedidos, dadosEstoque, dataInicio, dataFim, filtroSetor, filtroTipoBem, buscaTexto]);

  // 3. Processamento: Extrato de Movimentações (Kardex com SKU e Unidade)
  const dadosRelatorioMovimentacoes = useMemo(() => {
    if (relatorioSelecionado !== 'movimentacoes') return [];
    const termo = buscaTexto.trim().toLowerCase();

    const mapMateriais = new Map();
    dadosEstoque.forEach(mat => {
      mapMateriais.set(String(mat.id), mat);
      mapMateriais.set(String(mat.nome).toLowerCase(), mat);
    });

    return dadosMovimentacoes
      .filter(m => {
        const dataIso = normalizarDataParaIso(m.data);
        if (dataInicio && dataIso && dataIso < dataInicio) return;
        if (dataFim && dataIso && dataIso > dataFim) return;

        const tipoMov = String(m.tipo || '').toLowerCase();
        if (filtroTipoMovimento === 'entrada' && tipoMov !== 'entrada') return false;
        if (filtroTipoMovimento === 'saida' && tipoMov !== 'saida') return false;
        if (filtroTipoMovimento === 'ajuste' && tipoMov !== 'ajuste') return false;

        if (termo) {
          const matchMat = String(m.produtoNome || '').toLowerCase().includes(termo);
          const matchResp = String(m.funcionarioNome || '').toLowerCase().includes(termo);
          const matchObs = String(m.observacao || '').toLowerCase().includes(termo);
          const matchId = String(m.id || '').toLowerCase().includes(termo);
          if (!matchMat && !matchResp && !matchObs && !matchId) return false;
        }

        return true;
      })
      .map(m => {
        const matInfo = mapMateriais.get(String(m.produtoId)) || mapMateriais.get(String(m.produtoNome).toLowerCase());
        return {
          id: m.id,
          data: m.data ? new Date(m.data).toLocaleString('pt-BR') : '—',
          codigo: matInfo?.codigo || '—',
          material: m.produtoNome || `Produto #${m.produtoId}`,
          tipo: m.tipo,
          quantidade: m.quantidade,
          unidade: matInfo?.unidade || 'un',
          responsavel: m.funcionarioNome || 'Almoxarife',
          observacao: m.observacao || 'Movimentação padrão de estoque'
        };
      });
  }, [relatorioSelecionado, dadosMovimentacoes, dadosEstoque, dataInicio, dataFim, filtroTipoMovimento, buscaTexto]);

  // 4. Processamento: Atendimento de Pedidos e Eficiência WMS (com Ramal e Instruções)
  const dadosRelatorioPedidos = useMemo(() => {
    if (relatorioSelecionado !== 'pedidos') return [];
    const termo = buscaTexto.trim().toLowerCase();

    return dadosPedidos
      .filter(p => {
        const dataIso = normalizarDataParaIso(p.data);
        if (dataInicio && dataIso && dataIso < dataInicio) return;
        if (dataFim && dataIso && dataIso > dataFim) return;

        if (filtroSetor && p.setor !== filtroSetor) return false;

        const st = String(p.status || '').toLowerCase();
        if (filtroStatusPedido === 'atendido' && !st.includes('atendido')) return false;
        if (filtroStatusPedido === 'recusado' && !st.includes('recus') && !st.includes('cancel')) return false;
        if (filtroStatusPedido === 'pendente' && !st.includes('pendente')) return false;

        if (termo) {
          const matchId = String(p.id).includes(termo);
          const matchUser = String(p.usuario || '').toLowerCase().includes(termo);
          const matchSetor = String(p.setor || '').toLowerCase().includes(termo);
          if (!matchId && !matchUser && !matchSetor) return false;
        }

        return true;
      })
      .map(p => {
        const itensLista = Array.isArray(p.itens) && p.itens.length > 0
          ? p.itens.map(i => `${i.materialNome} (${i.quantidadeAtendida ?? i.quantidade})`).join(', ')
          : Array.isArray(p.materiais)
          ? p.materiais.join(', ')
          : '—';

        return {
          id: p.id,
          data: p.data || '—',
          usuario: p.usuario || 'Usuário Solicitante',
          setor: p.setor || 'Geral',
          ramal: p.ramal || '',
          itensDescricao: itensLista,
          prioridade: p.prioridade || 'Normal',
          status: p.status || 'Pendente',
          mensagemAlmoxarife: p.mensagemAlmoxarife || '',
          justificativa: p.justificativa || p.motivoRecusa || '—'
        };
      });
  }, [relatorioSelecionado, dadosPedidos, dataInicio, dataFim, filtroSetor, filtroStatusPedido, buscaTexto]);

  // 5. Processamento: Cadastro de Usuários (Admin com Ramal)
  const dadosRelatorioUsuarios = useMemo(() => {
    if (relatorioSelecionado !== 'usuarios') return [];
    const termo = buscaTexto.trim().toLowerCase();

    return usuarios
      .filter(u => {
        if (filtroPerfil && u.perfil !== filtroPerfil) return false;
        if (filtroStatusUsuario === 'ativo' && !u.ativo) return false;
        if (filtroStatusUsuario === 'inativo' && u.ativo) return false;

        if (termo) {
          const matchNome = String(u.nome || '').toLowerCase().includes(termo);
          const matchEmail = String(u.email || '').toLowerCase().includes(termo);
          const matchSetor = String(u.setor || '').toLowerCase().includes(termo);
          if (!matchNome && !matchEmail && !matchSetor) return false;
        }

        return true;
      })
      .map(u => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        perfil: u.perfil,
        setor: u.setor || 'Geral',
        ramal: u.ramal || '—',
        dataCadastro: u.dataCadastro || '—',
        status: u.ativo ? 'Ativo' : 'Inativo'
      }));
  }, [relatorioSelecionado, usuarios, filtroPerfil, filtroStatusUsuario, buscaTexto]);

  // Registros Ativos do Relatório
  const registrosAtuais = useMemo(() => {
    switch (relatorioSelecionado) {
      case 'estoque': return dadosRelatorioEstoque;
      case 'consumo_setor': return dadosRelatorioConsumoSetor;
      case 'movimentacoes': return dadosRelatorioMovimentacoes;
      case 'pedidos': return dadosRelatorioPedidos;
      case 'usuarios': return dadosRelatorioUsuarios;
      default: return [];
    }
  }, [
    relatorioSelecionado,
    dadosRelatorioEstoque,
    dadosRelatorioConsumoSetor,
    dadosRelatorioMovimentacoes,
    dadosRelatorioPedidos,
    dadosRelatorioUsuarios
  ]);

  // Exportação em Planilha Excel (Totalmente Completa com Todos os Metadados)
  const handleExportarExcel = () => {
    if (registrosAtuais.length === 0) {
      setAlertaDownload('Não há registros para exportar com os filtros atuais.');
      setTimeout(() => setAlertaDownload(null), 3500);
      return;
    }

    setAlertaDownload('Gerando planilha Excel (.xlsx)...');
    try {
      let rows = [];
      if (relatorioSelecionado === 'estoque') {
        rows = registrosAtuais.map(r => ({
          'Código SKU': r.codigo,
          'Material': r.nome,
          'Tipo de Bem': r.tipoBem,
          'Categoria': r.categoria,
          'Complexo': r.complexo,
          'Localização': r.localizacao,
          'Validade': r.validade,
          'Itens p/ Embalagem': r.itensPorEmbalagem,
          'Saldo Físico': r.quantidade,
          'Unidade': r.unidade,
          'Estoque Mínimo': r.estoqueMinimo,
          'Déficit Reposição': r.deficitSugerido,
          'Situação': r.situacao
        }));
      } else if (relatorioSelecionado === 'consumo_setor') {
        rows = registrosAtuais.map(r => ({
          'Setor Escolar': r.setor,
          'Material Entregue': r.material,
          'Tipo de Bem': r.tipoBem,
          'Categoria': r.categoria,
          'Qtd. Total Entregue': r.quantidadeEntregue,
          'Unidade': r.unidade,
          'Nº de Pedidos Atendidos': r.pedidosCount,
          'Média p/ Pedido': (r.quantidadeEntregue / Math.max(1, r.pedidosCount)).toFixed(1)
        }));
      } else if (relatorioSelecionado === 'movimentacoes') {
        rows = registrosAtuais.map(r => ({
          'Nº Registro': `#${r.id}`,
          'Data / Hora': r.data,
          'Código SKU': r.codigo,
          'Material': r.material,
          'Tipo Operação': r.tipo.toUpperCase(),
          'Quantidade': r.quantidade,
          'Unidade': r.unidade,
          'Responsável': r.responsavel,
          'Documento / Justificativa': r.observacao
        }));
      } else if (relatorioSelecionado === 'pedidos') {
        rows = registrosAtuais.map(r => ({
          'Nº Pedido': `#${r.id}`,
          'Data Solicitação': r.data,
          'Solicitante': r.usuario,
          'Setor': r.setor,
          'Ramal': r.ramal || '—',
          'Materiais Atendidos': r.itensDescricao,
          'Prioridade': r.prioridade,
          'Status WMS': r.status,
          'Instrução Almoxarife': r.mensagemAlmoxarife || '—',
          'Observações / Justificativa': r.justificativa
        }));
      } else if (relatorioSelecionado === 'usuarios') {
        rows = registrosAtuais.map(r => ({
          'ID': r.id,
          'Nome': r.nome,
          'E-mail': r.email,
          'Perfil': r.perfil,
          'Setor': r.setor,
          'Ramal': r.ramal || '—',
          'Data Cadastro': r.dataCadastro,
          'Status': r.status
        }));
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const columns = Object.keys(rows[0] || {});
      worksheet['!cols'] = columns.map(c => ({ wch: Math.min(Math.max(c.length + 4, 14), 40) }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');
      XLSX.writeFile(workbook, `relatorio_${relatorioSelecionado}_${new Date().toISOString().split('T')[0]}.xlsx`);

      setAlertaDownload('Planilha exportada com sucesso!');
      setTimeout(() => setAlertaDownload(null), 3500);
    } catch (e) {
      setAlertaDownload(`Falha na exportação: ${e.message}`);
      setTimeout(() => setAlertaDownload(null), 3500);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const relatorioAtualConfig = catalogos.find(c => c.id === relatorioSelecionado) || catalogos[0];

  return (
    <div className="relatorios-page-container">
      {/* Toast flutuante de notificação */}
      {alertaDownload && (
        <div className="relatorio-download-toast" role="status" aria-live="polite">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {alertaDownload}
        </div>
      )}

      {/* =========================================================================
          TELA 1: CONFIGURAÇÃO DO RELATÓRIO E PARÂMETROS
          ========================================================================= */}
      {faseTela === 'configuracao' && (
        <div className="relatorios-config-screen">
          {/* Seletor de Relatórios (Cards Limpos sem Badges) */}
          <div className="relatorios-catalog-section">
            <span className="relatorios-section-eyebrow">SELECIONE O RELATÓRIO</span>
            <div className="relatorios-catalog-grid">
              {catalogos.map(cat => {
                const isSelected = relatorioSelecionado === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`relatorio-catalog-card ${isSelected ? 'relatorio-catalog-card--selected' : ''}`}
                    onClick={() => setRelatorioSelecionado(cat.id)}
                  >
                    <div className="relatorio-catalog-card__top">
                      <h3 className="relatorio-catalog-card__title">{cat.titulo}</h3>
                      {isSelected && (
                        <span className="relatorio-catalog-card__check" title="Relatório ativo">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <p className="relatorio-catalog-card__desc">{cat.subtitulo}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Painel de Parâmetros Direcionados */}
          <div className="relatorios-params-card">
            <div className="relatorios-params-header">
              <div>
                <span className="relatorios-section-eyebrow">PARÂMETROS DA CONSULTA</span>
                <h2 className="relatorios-params-title">{relatorioAtualConfig.titulo}</h2>
              </div>
              <button
                type="button"
                className="relatorios-btn-clear"
                onClick={handleLimparParametros}
                title="Redefinir parâmetros para o padrão"
              >
                Limpar Parâmetros
              </button>
            </div>

            {/* Atalhos Rápidos de Período */}
            {(relatorioSelecionado === 'consumo_setor' || relatorioSelecionado === 'movimentacoes' || relatorioSelecionado === 'pedidos') && (
              <div className="relatorios-date-shortcuts">
                <span className="relatorios-date-shortcuts-label">Atalhos de Período:</span>
                <div className="relatorios-date-chips">
                  <button
                    type="button"
                    className={`relatorios-chip ${atalhoDataAtivo === 'este_mes' ? 'relatorios-chip--active' : ''}`}
                    onClick={() => handleAplicarAtalhoData('este_mes')}
                  >
                    Este Mês
                  </button>
                  <button
                    type="button"
                    className={`relatorios-chip ${atalhoDataAtivo === 'mes_anterior' ? 'relatorios-chip--active' : ''}`}
                    onClick={() => handleAplicarAtalhoData('mes_anterior')}
                  >
                    Mês Anterior
                  </button>
                  <button
                    type="button"
                    className={`relatorios-chip ${atalhoDataAtivo === 'ultimos_30' ? 'relatorios-chip--active' : ''}`}
                    onClick={() => handleAplicarAtalhoData('ultimos_30')}
                  >
                    Últimos 30 Dias
                  </button>
                  <button
                    type="button"
                    className={`relatorios-chip ${atalhoDataAtivo === 'ano_atual' ? 'relatorios-chip--active' : ''}`}
                    onClick={() => handleAplicarAtalhoData('ano_atual')}
                  >
                    Ano Corrente
                  </button>
                  <button
                    type="button"
                    className={`relatorios-chip ${atalhoDataAtivo === 'tudo' ? 'relatorios-chip--active' : ''}`}
                    onClick={() => handleAplicarAtalhoData('tudo')}
                  >
                    Todo o Histórico
                  </button>
                </div>
              </div>
            )}

            {/* Grade de Campos */}
            <div className="relatorios-fields-grid">
              {/* Datas */}
              {(relatorioSelecionado === 'consumo_setor' || relatorioSelecionado === 'movimentacoes' || relatorioSelecionado === 'pedidos') && (
                <>
                  <div className="relatorio-field">
                    <label className="relatorio-label" htmlFor="param-data-inicio">Data Inicial</label>
                    <input
                      id="param-data-inicio"
                      type="date"
                      className="relatorio-input"
                      value={dataInicio}
                      onChange={(e) => {
                        setDataInicio(e.target.value);
                        setAtalhoDataAtivo('custom');
                      }}
                    />
                  </div>
                  <div className="relatorio-field">
                    <label className="relatorio-label" htmlFor="param-data-fim">Data Final</label>
                    <input
                      id="param-data-fim"
                      type="date"
                      className="relatorio-input"
                      value={dataFim}
                      onChange={(e) => {
                        setDataFim(e.target.value);
                        setAtalhoDataAtivo('custom');
                      }}
                    />
                  </div>
                </>
              )}

              {/* Filtros específicos de Estoque */}
              {relatorioSelecionado === 'estoque' && (
                <>
                  <div className="relatorio-field">
                    <label className="relatorio-label" htmlFor="param-tipo-bem">Tipo de Material</label>
                    <select
                      id="param-tipo-bem"
                      className="relatorio-select"
                      value={filtroTipoBem}
                      onChange={(e) => setFiltroTipoBem(e.target.value)}
                    >
                      <option value="todos">Todos os Materiais</option>
                      <option value="consumo">Apenas Material de Consumo</option>
                      <option value="duravel">Apenas Bens Duráveis / Patrimônio</option>
                    </select>
                  </div>

                  <div className="relatorio-field">
                    <label className="relatorio-label" htmlFor="param-saldo-status">Situação de Saldo</label>
                    <select
                      id="param-saldo-status"
                      className="relatorio-select"
                      value={filtroSaldoStatus}
                      onChange={(e) => setFiltroSaldoStatus(e.target.value)}
                    >
                      <option value="todos">Todos os Níveis de Saldo</option>
                      <option value="criticos">Apenas Críticos (Abaixo do Mínimo / Zerados)</option>
                      <option value="zerados">Apenas Zerados (Sem Saldo)</option>
                      <option value="normais">Saldo Regular / Normal</option>
                    </select>
                  </div>

                  <div className="relatorio-field">
                    <label className="relatorio-label" htmlFor="param-categoria">Categoria</label>
                    <select
                      id="param-categoria"
                      className="relatorio-select"
                      value={filtroCategoria}
                      onChange={(e) => setFiltroCategoria(e.target.value)}
                    >
                      <option value="">Todas as Categorias</option>
                      {categoriasDisponiveis.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Filtros específicos de Consumo por Setor */}
              {relatorioSelecionado === 'consumo_setor' && (
                <>
                  <div className="relatorio-field">
                    <label className="relatorio-label" htmlFor="param-setor">Setor Escolar</label>
                    <select
                      id="param-setor"
                      className="relatorio-select"
                      value={filtroSetor}
                      onChange={(e) => setFiltroSetor(e.target.value)}
                    >
                      <option value="">Todos os Setores</option>
                      {setoresDisponiveis.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relatorio-field">
                    <label className="relatorio-label" htmlFor="param-consumo-tipo-bem">Tipo de Material</label>
                    <select
                      id="param-consumo-tipo-bem"
                      className="relatorio-select"
                      value={filtroTipoBem}
                      onChange={(e) => setFiltroTipoBem(e.target.value)}
                    >
                      <option value="todos">Todos os Materiais</option>
                      <option value="consumo">Apenas Material de Consumo</option>
                      <option value="duravel">Apenas Bens Duráveis</option>
                    </select>
                  </div>
                </>
              )}

              {/* Filtros específicos de Movimentações */}
              {relatorioSelecionado === 'movimentacoes' && (
                <div className="relatorio-field">
                  <label className="relatorio-label" htmlFor="param-tipo-movimento">Tipo de Operação</label>
                  <select
                    id="param-tipo-movimento"
                    className="relatorio-select"
                    value={filtroTipoMovimento}
                    onChange={(e) => setFiltroTipoMovimento(e.target.value)}
                  >
                    <option value="todos">Todas as Operações</option>
                    <option value="entrada">Entradas (Remessas / Doações)</option>
                    <option value="saida">Saídas (Atendimento de Pedidos)</option>
                    <option value="ajuste">Ajuste / Balanço Físico de Inventário</option>
                  </select>
                </div>
              )}

              {/* Filtros específicos de Atendimento de Pedidos */}
              {relatorioSelecionado === 'pedidos' && (
                <>
                  <div className="relatorio-field">
                    <label className="relatorio-label" htmlFor="param-status-pedido">Status do Pedido</label>
                    <select
                      id="param-status-pedido"
                      className="relatorio-select"
                      value={filtroStatusPedido}
                      onChange={(e) => setFiltroStatusPedido(e.target.value)}
                    >
                      <option value="todos">Todos os Status</option>
                      <option value="atendido">Atendidos / Concluídos</option>
                      <option value="pendente">Aguardando Atendimento</option>
                      <option value="recusado">Cancelados ou Recusados</option>
                    </select>
                  </div>

                  <div className="relatorio-field">
                    <label className="relatorio-label" htmlFor="param-pedido-setor">Setor Solicitante</label>
                    <select
                      id="param-pedido-setor"
                      className="relatorio-select"
                      value={filtroSetor}
                      onChange={(e) => setFiltroSetor(e.target.value)}
                    >
                      <option value="">Todos os Setores</option>
                      {setoresDisponiveis.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Filtros de Usuários (Admin) */}
              {relatorioSelecionado === 'usuarios' && (
                <>
                  <div className="relatorio-field">
                    <label className="relatorio-label" htmlFor="param-usuario-perfil">Perfil de Acesso</label>
                    <select
                      id="param-usuario-perfil"
                      className="relatorio-select"
                      value={filtroPerfil}
                      onChange={(e) => setFiltroPerfil(e.target.value)}
                    >
                      <option value="">Todos os Perfis</option>
                      <option value="Administrativo">Administrativo</option>
                      <option value="Almoxarifado">Almoxarifado</option>
                      <option value="Usuário">Usuário</option>
                    </select>
                  </div>

                  <div className="relatorio-field">
                    <label className="relatorio-label" htmlFor="param-usuario-status">Situação da Conta</label>
                    <select
                      id="param-usuario-status"
                      className="relatorio-select"
                      value={filtroStatusUsuario}
                      onChange={(e) => setFiltroStatusUsuario(e.target.value)}
                    >
                      <option value="todos">Todas</option>
                      <option value="ativo">Apenas Ativos</option>
                      <option value="inativo">Apenas Inativos</option>
                    </select>
                  </div>
                </>
              )}

              {/* Campo universal de busca textual */}
              <div className="relatorio-field relatorio-field--search">
                <label className="relatorio-label" htmlFor="param-busca">Termo de Busca</label>
                <div className="relatorio-search-wrap">
                  <input
                    id="param-busca"
                    type="text"
                    className="relatorio-input"
                    placeholder={
                      relatorioSelecionado === 'estoque'
                        ? 'Buscar por SKU, material, complexo ou localização...'
                        : relatorioSelecionado === 'consumo_setor'
                        ? 'Buscar por material ou setor...'
                        : relatorioSelecionado === 'movimentacoes'
                        ? 'Buscar por material, SKU, responsável ou motivo...'
                        : relatorioSelecionado === 'pedidos'
                        ? 'Buscar por solicitante, setor ou número...'
                        : 'Buscar por nome, e-mail ou setor...'
                    }
                    value={buscaTexto}
                    onChange={(e) => setBuscaTexto(e.target.value)}
                  />
                  {buscaTexto && (
                    <button
                      type="button"
                      className="relatorio-search-clear"
                      onClick={() => setBuscaTexto('')}
                      aria-label="Limpar busca"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Ação de Disparo: Avança para Tela 2 */}
            <div className="relatorios-params-actions">
              <button
                type="button"
                className="relatorios-btn-submit"
                onClick={handleExecutarRelatorio}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Visualizar Relatório
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TELA 2: EXTRATO COMPLETO DO RELATÓRIO (MODO RELATÓRIO / TELA CHEIA)
          ========================================================================= */}
      {faseTela === 'extrato' && (
        <div className="relatorios-extrato-screen">
          {/* Barra Superior de Navegação e Exportações */}
          <div className="relatorios-extrato-topbar">
            <button
              type="button"
              className="relatorios-btn-voltar"
              onClick={() => setFaseTela('configuracao')}
              title="Voltar para a seleção e filtros de relatório"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Voltar aos Parâmetros
            </button>

            {registrosAtuais.length > 0 && (
              <div className="relatorios-export-buttons">
                <button
                  type="button"
                  className="relatorios-export-btn relatorios-export-btn--excel"
                  onClick={handleExportarExcel}
                  title="Exportar para planilha Excel com cabeçalhos formatados"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="3" y1="15" x2="21" y2="15" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                  </svg>
                  Exportar Planilha .xlsx
                </button>

                <button
                  type="button"
                  className="relatorios-export-btn relatorios-export-btn--pdf"
                  onClick={handleImprimir}
                  title="Imprimir relatório formatado em folha A4"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Imprimir / PDF A4
                </button>
              </div>
            )}
          </div>

          {/* Cabeçalho Oficial de Emissão */}
          <div className="relatorios-official-header">
            <div className="relatorios-official-info">
              <div className="relatorios-org-name">Estação Conhecimento • Sistema de Gestão de Estoque</div>
              <h2 className="relatorios-report-main-title">{relatorioAtualConfig.titulo}</h2>
              <div className="relatorios-report-meta">
                <span>
                  Emitido em: <strong>{dataHoraGeracao.toLocaleDateString('pt-BR')} às {dataHoraGeracao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
                </span>
                <span>•</span>
                <span>
                  Total de registros filtrados: <strong>{registrosAtuais.length}</strong>
                </span>
                {(dataInicio || dataFim) && (
                  <>
                    <span>•</span>
                    <span>
                      Período de referência: <strong>{dataInicio ? dataInicio.split('-').reverse().join('/') : 'Início'}</strong> até <strong>{dataFim ? dataFim.split('-').reverse().join('/') : 'Atual'}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Tabela de Resultados ou Empty Box */}
          {registrosAtuais.length === 0 ? (
            <div className="relatorios-empty-box">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <h4>Nenhum registro encontrado</h4>
              <p>Não foram encontrados registros para os parâmetros selecionados.</p>
              <button
                type="button"
                className="relatorios-btn-voltar"
                style={{ marginTop: '12px' }}
                onClick={() => setFaseTela('configuracao')}
              >
                Voltar e Ajustar Filtros
              </button>
            </div>
          ) : (
            <div className="relatorios-table-card">
              <div className="relatorios-table-scroll">
                {/* 1. Tabela: Posição de Estoque (com Complexo, Localização e Validade) */}
                {relatorioSelecionado === 'estoque' && (
                  <table className="relatorios-data-table">
                    <thead>
                      <tr>
                        <th>Código SKU</th>
                        <th>Material</th>
                        <th>Tipo de Bem</th>
                        <th>Categoria</th>
                        <th>Complexo</th>
                        <th>Localização</th>
                        <th>Validade</th>
                        <th style={{ textAlign: 'right' }}>Saldo Atual</th>
                        <th style={{ textAlign: 'right' }}>Estoque Mín.</th>
                        <th style={{ textAlign: 'right' }}>Déficit</th>
                        <th style={{ textAlign: 'center' }}>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrosAtuais.map(r => {
                        const isCritico = r.situacao === 'Sem Estoque';
                        const isBaixo = r.situacao === 'Estoque Baixo';
                        return (
                          <tr key={r.id}>
                            <td><code>{r.codigo}</code></td>
                            <td><strong>{r.nome}</strong></td>
                            <td>
                              <span className={`relatorios-badge ${r.tipoBem === 'Bem Durável' ? 'relatorios-badge--duravel' : 'relatorios-badge--consumo'}`}>
                                {r.tipoBem}
                              </span>
                            </td>
                            <td>{r.categoria}</td>
                            <td>{r.complexo}</td>
                            <td>{r.localizacao}</td>
                            <td>
                              <span style={{ fontSize: '11.5px', color: r.validade.includes('/') ? '#0F172A' : '#64748B' }}>
                                {r.validade}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}><strong>{r.quantidade}</strong> {r.unidade}</td>
                            <td style={{ textAlign: 'right', color: '#64748B' }}>{r.estoqueMinimo} {r.unidade}</td>
                            <td style={{ textAlign: 'right' }}>
                              {r.deficitSugerido > 0 ? (
                                <strong style={{ color: '#DC2626' }}>+{r.deficitSugerido} {r.unidade}</strong>
                              ) : (
                                <span style={{ color: '#64748B' }}>0</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`relatorios-status-tag ${isCritico ? 'status-tag--critico' : isBaixo ? 'status-tag--baixo' : 'status-tag--normal'}`}>
                                {r.situacao}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* 2. Tabela: Consumo por Setor Escolar */}
                {relatorioSelecionado === 'consumo_setor' && (
                  <table className="relatorios-data-table">
                    <thead>
                      <tr>
                        <th>Setor Escolar</th>
                        <th>Material Entregue</th>
                        <th>Tipo de Bem</th>
                        <th>Categoria</th>
                        <th style={{ textAlign: 'right' }}>Qtd. Entregue</th>
                        <th style={{ textAlign: 'right' }}>Nº de Pedidos Atendidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrosAtuais.map((r, idx) => (
                        <tr key={idx}>
                          <td><strong>{r.setor}</strong></td>
                          <td>{r.material}</td>
                          <td>
                            <span className={`relatorios-badge ${r.tipoBem === 'Bem Durável' ? 'relatorios-badge--duravel' : 'relatorios-badge--consumo'}`}>
                              {r.tipoBem}
                            </span>
                          </td>
                          <td>{r.categoria}</td>
                          <td style={{ textAlign: 'right' }}>
                            <strong style={{ color: '#017F7B' }}>{r.quantidadeEntregue}</strong> {r.unidade}
                          </td>
                          <td style={{ textAlign: 'right' }}>{r.pedidosCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 3. Tabela: Extrato de Movimentações (Kardex com SKU e Unidade) */}
                {relatorioSelecionado === 'movimentacoes' && (
                  <table className="relatorios-data-table">
                    <thead>
                      <tr>
                        <th>Nº Registro</th>
                        <th>Data / Hora</th>
                        <th>Código SKU</th>
                        <th>Material</th>
                        <th>Operação</th>
                        <th style={{ textAlign: 'right' }}>Quantidade</th>
                        <th>Responsável</th>
                        <th>Documento / Justificativa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrosAtuais.map(r => {
                        const tipoLower = String(r.tipo || '').toLowerCase();
                        return (
                          <tr key={r.id}>
                            <td><code>#{r.id}</code></td>
                            <td>{r.data}</td>
                            <td><code>{r.codigo}</code></td>
                            <td><strong>{r.material}</strong></td>
                            <td>
                              <span className={`relatorios-badge ${tipoLower === 'entrada' ? 'relatorios-badge--entrada' : tipoLower === 'saida' ? 'relatorios-badge--saida' : 'relatorios-badge--ajuste'}`}>
                                {r.tipo.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <strong>{tipoLower === 'entrada' ? `+${r.quantidade}` : tipoLower === 'saida' ? `-${r.quantidade}` : `±${r.quantidade}`}</strong> {r.unidade}
                            </td>
                            <td>{r.responsavel}</td>
                            <td>{r.observacao}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* 4. Tabela: Atendimento de Pedidos (com Ramal e Instruções) */}
                {relatorioSelecionado === 'pedidos' && (
                  <table className="relatorios-data-table">
                    <thead>
                      <tr>
                        <th>Nº Pedido</th>
                        <th>Data</th>
                        <th>Solicitante</th>
                        <th>Setor</th>
                        <th>Ramal</th>
                        <th>Materiais Solicitados / Atendidos</th>
                        <th>Prioridade</th>
                        <th style={{ textAlign: 'center' }}>Status WMS</th>
                        <th>Instruções / Justificativa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrosAtuais.map(r => (
                        <tr key={r.id}>
                          <td><code>#{r.id}</code></td>
                          <td>{r.data}</td>
                          <td><strong>{r.usuario}</strong></td>
                          <td>{r.setor}</td>
                          <td>{r.ramal || '—'}</td>
                          <td style={{ maxWidth: '300px' }}>{r.itensDescricao}</td>
                          <td>
                            {r.prioridade === 'Urgente' ? (
                              <span className="relatorios-status-tag status-tag--critico">Urgente</span>
                            ) : (
                              <span style={{ color: '#64748B' }}>Normal</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="relatorios-status-tag status-tag--normal">
                              {r.status}
                            </span>
                          </td>
                          <td>{r.mensagemAlmoxarife || r.justificativa}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 5. Tabela: Cadastro de Usuários (Admin com Ramal) */}
                {relatorioSelecionado === 'usuarios' && (
                  <table className="relatorios-data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Perfil</th>
                        <th>Setor</th>
                        <th>Ramal</th>
                        <th>Data Cadastro</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrosAtuais.map(r => (
                        <tr key={r.id}>
                          <td><code>#{r.id}</code></td>
                          <td><strong>{r.nome}</strong></td>
                          <td>{r.email}</td>
                          <td><span className="relatorios-badge relatorios-badge--consumo">{r.perfil}</span></td>
                          <td>{r.setor}</td>
                          <td>{r.ramal || '—'}</td>
                          <td>{r.dataCadastro}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`relatorios-status-tag ${r.status === 'Ativo' ? 'status-tag--normal' : 'status-tag--critico'}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RelatoriosView;
