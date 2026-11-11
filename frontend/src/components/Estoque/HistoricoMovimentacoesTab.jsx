import React, { useState, useMemo } from 'react';
import { SearchFilterBar, FilterDrawer, FilterGroup, FilterChip, SortLoopButton, FotoGaleriaModal } from '../common';
import './HistoricoMovimentacoesTab.css';

/**
 * Formata data ISO para padrão brasileiro legível: DD/MM/AAAA às HH:mm
 */
const formatarDataHora = (dataIso) => {
  if (!dataIso) return '—';
  try {
    const d = new Date(dataIso);
    if (isNaN(d.getTime())) return String(dataIso);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} às ${hora}:${min}`;
  } catch {
    return String(dataIso);
  }
};

const extrairNumeroPedido = (str) => {
  if (!str) return null;
  const match = String(str).match(/pedido\s*#?\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
};

const ITENS_VISIVEIS_POR_DOC = 5;
const LIMIAR_RECOLHER_ITENS_DOC = 6;

/**
 * HistoricoMovimentacoesTab
 * Sub-aba de Histórico de Estoque agrupado por Nota Fiscal / Documento de Operação.
 * Utilizada tanto pelo Almoxarife quanto pelo Administrador.
 */
const HistoricoMovimentacoesTab = ({
  movimentacoes = [],
  materiais = [],
  remessas = [],
  onAdicionarItemNF,
  isAdmin = false,
  className = ''
}) => {
  const [termoBusca, setTermoBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos'); // 'todos' | 'nota_fiscal' | 'saida' | 'ajuste'
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [ordenacao, setOrdenacao] = useState('desc'); // 'desc' (mais recentes) | 'asc'
  const [limiteExibicao, setLimiteExibicao] = useState(25);
  const [docsItensExpandidos, setDocsItensExpandidos] = useState({});
  const [galeriaAberta, setGaleriaAberta] = useState(false);
  const [dadosGaleria, setDadosGaleria] = useState({ fotos: [], recebimentoId: null, titulo: '', dadosOperacao: null });

  const handleAlternarItensDocumento = (chave) => {
    setDocsItensExpandidos((prev) => ({
      ...prev,
      [chave]: !prev[chave]
    }));
  };

  const handleAbrirGaleria = (op) => {
    setDadosGaleria({
      fotos: op.fotos || [],
      recebimentoId: op.recebimentoId || op.id,
      titulo: op.documentoFiscal || op.numeroRemessa || 'Nota Fiscal / Remessa',
      dadosOperacao: op
    });
    setGaleriaAberta(true);
  };

  // Mapeamento rápido de materiais para buscar código SKU, categoria e unidade
  const mapMateriais = useMemo(() => {
    const map = new Map();
    (materiais || []).forEach((mat) => {
      if (mat?.id !== undefined) {
        map.set(mat.id, mat);
        map.set(String(mat.id), mat);
      }
      if (mat?.nome) {
        map.set(String(mat.nome).toLowerCase().trim(), mat);
      }
    });
    return map;
  }, [materiais]);

  // Agrupamento principal das operações (por Nota Fiscal, por Pedido e por Ajuste)
  const operacoesAgrupadas = useMemo(() => {
    // 1. Dicionário de Notas Fiscais
    const nfMap = new Map();

    const extrairRemessaDaObservacao = (obs) => {
      if (!obs) return null;
      const match = String(obs).match(/Remessa\s+(REM-[\w-]+)/i);
      return match ? match[1] : null;
    };

    const extrairIdDaRemessa = (numRemessa) => {
      if (!numRemessa) return null;
      const match = String(numRemessa).match(/REM-\d{4}-(\d+)/i);
      return match ? parseInt(match[1], 10) : null;
    };

    // Popula inicialmente a partir de remessas cadastradas/confirmadas (Fonte da verdade das NFs)
    const complementos = [];
    (remessas || []).forEach((rem) => {
      const recId = rem.id;
      if (!recId) return;

      const origemId = rem.recebimentoOrigemId || rem.recebimento_origem_id;
      if (origemId) {
        complementos.push(rem);
        return;
      }

      const numRemessa = rem.numeroRemessa || `REM-${recId}`;
      const docFiscal = rem.documentoDoador || rem.fornecedor || numRemessa;
      const fornecedor = rem.fornecedor || rem.documentoDoador || '';

      const nfObj = {
        chave: `nf_${recId}`,
        tipoOperacao: 'nota_fiscal',
        id: recId,
        recebimentoId: recId,
        numeroRemessa: numRemessa,
        documentoFiscal: docFiscal,
        fornecedor,
        tipoOrigem: rem.tipoOrigem || 'compra_nf',
        data: rem.data || rem.dataEnvio || new Date().toISOString(),
        responsavel: rem.recebidoPor || 'Almoxarife',
        observacao: rem.observacao || '',
        fotos: rem.fotos || [],
        itensMap: new Map()
      };

      (rem.itens || []).forEach((it) => {
        const mat = mapMateriais.get(it.materialId) || mapMateriais.get(String(it.materialNome || '').toLowerCase().trim());
        const matId = it.materialId || (mat?.id ?? null);
        const sku = mat?.codigo || (matId ? `#${matId}` : '—');
        const cat = mat?.categoria || (mat?.bemDuravel ? 'Patrimônio' : 'Consumo');
        const un = it.unidade || mat?.unidade || 'UN';

        nfObj.itensMap.set(String(matId || it.materialNome), {
          materialId: matId,
          nome: it.materialNome || mat?.nome || 'Material',
          codigo: sku,
          categoria: cat,
          quantidade: it.quantidade,
          unidade: un,
          saldoApos: null
        });
      });

      // Indexa para cruzamento seguro por ID numérico, string, número da remessa e documento
      nfMap.set(recId, nfObj);
      nfMap.set(String(recId), nfObj);
      if (numRemessa) {
        nfMap.set(numRemessa, nfObj);
        nfMap.set(numRemessa.toLowerCase(), nfObj);
      }
      if (rem.documentoDoador) {
        nfMap.set(rem.documentoDoador, nfObj);
        nfMap.set(rem.documentoDoador.toLowerCase(), nfObj);
      }
    });

    // 1.1 Processa complementos de Nota Fiscal incorporando seus itens na NF original
    complementos.forEach((rem) => {
      const recId = rem.id;
      const origemId = rem.recebimentoOrigemId || rem.recebimento_origem_id;
      const nfPai = nfMap.get(origemId) || nfMap.get(String(origemId));

      if (nfPai) {
        (rem.itens || []).forEach((it) => {
          const mat = mapMateriais.get(it.materialId) || mapMateriais.get(String(it.materialNome || '').toLowerCase().trim());
          const matId = it.materialId || (mat?.id ?? null);
          const sku = mat?.codigo || (matId ? `#${matId}` : '—');
          const cat = mat?.categoria || (mat?.bemDuravel ? 'Patrimônio' : 'Consumo');
          const un = it.unidade || mat?.unidade || 'UN';
          const chave = String(matId || it.materialNome);

          if (nfPai.itensMap.has(chave)) {
            const itemExistente = nfPai.itensMap.get(chave);
            itemExistente.quantidade = (itemExistente.quantidade || 0) + it.quantidade;
          } else {
            nfPai.itensMap.set(chave, {
              materialId: matId,
              nome: it.materialNome || mat?.nome || 'Material',
              codigo: sku,
              categoria: cat,
              quantidade: it.quantidade,
              unidade: un,
              saldoApos: null
            });
          }
        });

        // Vincula as chaves deste complemento ao pai para cruzamento com movimentações
        if (recId) {
          nfMap.set(recId, nfPai);
          nfMap.set(String(recId), nfPai);
        }
        if (rem.numeroRemessa) {
          nfMap.set(rem.numeroRemessa, nfPai);
          nfMap.set(rem.numeroRemessa.toLowerCase(), nfPai);
        }
      } else {
        // Fallback: se porventura a remessa pai não estiver no lote de remessas, exibe como avulsa
        const numRemessa = rem.numeroRemessa || `REM-${recId}`;
        const docFiscal = rem.documentoDoador || rem.fornecedor || numRemessa;
        const fornecedor = rem.fornecedor || rem.documentoDoador || '';

        const nfObj = {
          chave: `nf_${recId}`,
          tipoOperacao: 'nota_fiscal',
          id: recId,
          recebimentoId: recId,
          numeroRemessa: numRemessa,
          documentoFiscal: docFiscal,
          fornecedor,
          tipoOrigem: rem.tipoOrigem || 'compra_nf',
          data: rem.data || rem.dataEnvio || new Date().toISOString(),
          responsavel: rem.recebidoPor || 'Almoxarife',
          observacao: rem.observacao || '',
          fotos: rem.fotos || [],
          itensMap: new Map()
        };

        (rem.itens || []).forEach((it) => {
          const mat = mapMateriais.get(it.materialId) || mapMateriais.get(String(it.materialNome || '').toLowerCase().trim());
          const matId = it.materialId || (mat?.id ?? null);
          const sku = mat?.codigo || (matId ? `#${matId}` : '—');
          const cat = mat?.categoria || (mat?.bemDuravel ? 'Patrimônio' : 'Consumo');
          const un = it.unidade || mat?.unidade || 'UN';

          nfObj.itensMap.set(String(matId || it.materialNome), {
            materialId: matId,
            nome: it.materialNome || mat?.nome || 'Material',
            codigo: sku,
            categoria: cat,
            quantidade: it.quantidade,
            unidade: un,
            saldoApos: null
          });
        });

        nfMap.set(recId, nfObj);
        nfMap.set(String(recId), nfObj);
      }
    });

    // 2. Dicionários de Saídas e Ajustes
    const saidasMap = new Map();
    const ajustesMap = new Map();

    // Processa movimentações individuais evitando qualquer duplicação com as NFs existentes
    (movimentacoes || []).forEach((mov) => {
      const tipo = String(mov.tipo || '').toLowerCase();
      const mat = mapMateriais.get(mov.produtoId) || mapMateriais.get(String(mov.produtoNome || '').toLowerCase().trim());
      const sku = mat?.codigo || (mov.produtoId ? `#${mov.produtoId}` : '—');
      const cat = mat?.categoria || (mat?.bemDuravel ? 'Patrimônio' : 'Consumo');
      const un = mat?.unidade || 'UN';
      const nomeMaterial = mov.produtoNome || mat?.nome || `Produto #${mov.produtoId}`;

      if (tipo === 'entrada') {
        const recId = mov.recebimentoId;
        const numRem = mov.numeroRemessa || extrairRemessaDaObservacao(mov.observacao);
        const idFromObs = !recId && numRem ? extrairIdDaRemessa(numRem) : null;
        const docOrigem = mov.documentoOrigem;

          // Tenta encontrar a Nota Fiscal já cadastrada
          let nfObj =
            (recId ? (nfMap.get(recId) || nfMap.get(String(recId))) : null) ||
            (idFromObs ? (nfMap.get(idFromObs) || nfMap.get(String(idFromObs))) : null) ||
            (numRem ? (nfMap.get(numRem) || nfMap.get(numRem.toLowerCase())) : null) ||
            (docOrigem ? (nfMap.get(docOrigem) || nfMap.get(docOrigem.toLowerCase())) : null);

          // Se ainda não encontrou, compara por data e produtos recebidos na mesma remessa
          if (!nfObj && mov.data) {
            const movDataMin = String(mov.data).slice(0, 16);
            for (const rem of (remessas || [])) {
              const remDataMin = String(rem.data || rem.dataEnvio || '').slice(0, 16);
              if (remDataMin && remDataMin === movDataMin) {
                const temItem = (rem.itens || []).some(
                  (it) => it.materialId === mov.produtoId ||
                    String(it.materialNome || '').toLowerCase().trim() === String(mov.produtoNome || '').toLowerCase().trim()
                );
                if (temItem) {
                  nfObj = nfMap.get(rem.id) || nfMap.get(String(rem.id));
                  break;
                }
              }
            }
          }

              // Se a Nota Fiscal já existe, apenas atualiza o saldoApos do item correspondente (NUNCA cria card duplicado)
              if (nfObj) {
                const itemKey = String(mov.produtoId || nomeMaterial);
                const itemExistente =
                  nfObj.itensMap.get(itemKey) ||
                  nfObj.itensMap.get(String(mov.produtoNome || '').toLowerCase().trim());

                if (itemExistente) {
                  if (mov.saldoApos !== null && mov.saldoApos !== undefined) {
                    itemExistente.saldoApos = mov.saldoApos;
                  }
                } else {
                  nfObj.itensMap.set(itemKey, {
                    materialId: mov.produtoId,
                    nome: nomeMaterial,
                    codigo: sku,
                    categoria: cat,
                    quantidade: mov.quantidade,
                    unidade: un,
                    saldoApos: mov.saldoApos
                  });
                }
              } else {
                // Caso a remessa não tenha sido pré-carregada mas a movimentação tenha identificação de remessa
                if (recId || numRem || idFromObs) {
                  const idGen = recId || idFromObs || numRem;
                  const chave = `nf_${idGen}`;
                  let nfCriada = nfMap.get(chave);
                  if (!nfCriada) {
                    const doc = docOrigem || numRem || `NF #${idGen}`;
                    nfCriada = {
                      chave,
                      tipoOperacao: 'nota_fiscal',
                      id: idGen,
                      recebimentoId: recId || idFromObs || null,
                      numeroRemessa: numRem || (recId ? `REM-${recId}` : ''),
                      documentoFiscal: doc,
                      fornecedor: docOrigem || '',
                      tipoOrigem: mov.tipoOrigem || 'compra_nf',
                      data: mov.data,
                      responsavel: mov.funcionarioNome || 'Almoxarife',
                      observacao: mov.observacao || '',
                      fotos: [],
                      itensMap: new Map()
                    };
                    nfMap.set(chave, nfCriada);
                    if (recId) nfMap.set(recId, nfCriada);
                    if (numRem) nfMap.set(numRem, nfCriada);
                  }
                  const itemKey = String(mov.produtoId || nomeMaterial);
                  nfCriada.itensMap.set(itemKey, {
                    materialId: mov.produtoId,
                    nome: nomeMaterial,
                    codigo: sku,
                    categoria: cat,
                    quantidade: mov.quantidade,
                    unidade: un,
                    saldoApos: mov.saldoApos
                  });
                } else {
                  // Entradas manuais avulsas ou saldos iniciais (sem documento fiscal) são listadas como Ajustes
                  const grupoAjusteKey = `ajuste_${mov.id}`;
                  ajustesMap.set(grupoAjusteKey, {
                    chave: grupoAjusteKey,
                    tipoOperacao: 'ajuste',
                    id: mov.id,
                    data: mov.data,
                    responsavel: mov.funcionarioNome || 'Almoxarife',
                    observacao: mov.observacao || 'Entrada manual avulsa',
                    itens: [
                      {
                        materialId: mov.produtoId,
                        nome: nomeMaterial,
                        codigo: sku,
                        categoria: cat,
                        quantidade: mov.quantidade,
                        unidade: un,
                        saldoApos: mov.saldoApos
                      }
                    ]
                  });
                }
              }
            } else if (tipo === 'saida') {
              const pedidoId = mov.pedidoId || extrairNumeroPedido(mov.observacao);
              const dataMinuto = mov.data ? String(mov.data).slice(0, 16) : '';
              const grupoKey = pedidoId ? `ped_${pedidoId}` : `saida_${dataMinuto}_${mov.funcionarioNome}`;

              let saidaObj = saidasMap.get(grupoKey);
              if (!saidaObj) {
                saidaObj = {
                  chave: grupoKey,
                  tipoOperacao: 'saida',
                  id: mov.id,
                  pedidoId,
                  data: mov.data,
                  responsavel: mov.funcionarioNome || 'Almoxarife',
                  observacao: mov.observacao || (pedidoId ? `Atendimento do Pedido #${pedidoId}` : 'Saída de estoque'),
                  itens: []
                };
                saidasMap.set(grupoKey, saidaObj);
              }

              saidaObj.itens.push({
                materialId: mov.produtoId,
                nome: nomeMaterial,
                codigo: sku,
                categoria: cat,
                quantidade: mov.quantidade,
                unidade: un,
                saldoApos: mov.saldoApos
              });
            } else {
              // Ajuste de inventário físico
              const grupoAjusteKey = `ajuste_${mov.id}`;
              ajustesMap.set(grupoAjusteKey, {
                chave: grupoAjusteKey,
                tipoOperacao: 'ajuste',
                id: mov.id,
                data: mov.data,
                responsavel: mov.funcionarioNome || 'Almoxarife',
                observacao: mov.observacao || 'Ajuste de inventário físico',
                itens: [
                  {
                    materialId: mov.produtoId,
                    nome: nomeMaterial,
                    codigo: sku,
                    categoria: cat,
                    quantidade: mov.quantidade,
                    unidade: un,
                    saldoApos: mov.saldoApos
                  }
                ]
              });
            }
          });

    // Desduplica as Notas Fiscais
    const nfsUnicas = Array.from(new Set(nfMap.values())).map((nf) => ({
      ...nf,
      itens: Array.from(nf.itensMap.values())
    })).filter((nf) => nf.itens.length > 0);

    const saidas = Array.from(saidasMap.values());
    const ajustes = Array.from(ajustesMap.values());

    return [...nfsUnicas, ...saidas, ...ajustes];
  }, [remessas, movimentacoes, mapMateriais]);

  // Contadores para os chips de tipo baseados nas operações agrupadas
  const metricas = useMemo(() => {
    let todos = operacoesAgrupadas.length;
    let notaFiscal = 0;
    let saida = 0;
    let ajuste = 0;

    operacoesAgrupadas.forEach((op) => {
      if (op.tipoOperacao === 'nota_fiscal') notaFiscal += 1;
      else if (op.tipoOperacao === 'saida') saida += 1;
      else if (op.tipoOperacao === 'ajuste') ajuste += 1;
    });

    return { todos, notaFiscal, saida, ajuste };
  }, [operacoesAgrupadas]);

  // Lista filtrada e ordenada
  const operacoesFiltradas = useMemo(() => {
    const termo = termoBusca.toLowerCase().trim();

    const filtradas = operacoesAgrupadas.filter((op) => {
      // Filtro de Tipo
      if (tipoFiltro !== 'todos' && op.tipoOperacao !== tipoFiltro) {
        return false;
      }

      // Filtro de Busca Textual abrangente
      if (termo) {
        const docFiscal = String(op.documentoFiscal || '').toLowerCase();
        const numRemessa = String(op.numeroRemessa || '').toLowerCase();
        const fornecedor = String(op.fornecedor || '').toLowerCase();
        const responsavel = String(op.responsavel || '').toLowerCase();
        const obs = String(op.observacao || '').toLowerCase();
        const pedIdStr = op.pedidoId ? String(op.pedidoId).toLowerCase() : '';

        // Procura no cabeçalho da operação
        const matchHeader =
          docFiscal.includes(termo) ||
          numRemessa.includes(termo) ||
          fornecedor.includes(termo) ||
          responsavel.includes(termo) ||
          obs.includes(termo) ||
          pedIdStr.includes(termo);

        if (matchHeader) return true;

        // Procura dentro dos itens contidos na operação
        const matchItem = (op.itens || []).some((item) => {
          const nome = String(item.nome || '').toLowerCase();
          const cod = String(item.codigo || '').toLowerCase();
          return nome.includes(termo) || cod.includes(termo);
        });

        if (!matchItem) return false;
      }

      return true;
    });

    // Ordenação cronológica por data
    filtradas.sort((a, b) => {
      const timeA = new Date(a.data).getTime() || 0;
      const timeB = new Date(b.data).getTime() || 0;
      if (timeA === timeB) {
        return ordenacao === 'desc' ? (b.id || 0) - (a.id || 0) : (a.id || 0) - (b.id || 0);
      }
      return ordenacao === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return filtradas;
  }, [operacoesAgrupadas, tipoFiltro, termoBusca, ordenacao]);

  const itensExibidos = operacoesFiltradas.slice(0, limiteExibicao);
  const temFiltroAtivo = tipoFiltro !== 'todos';
  const temBuscaOuFiltroAtivo = temFiltroAtivo || termoBusca.trim() !== '';

  const handleLimparFiltros = () => {
    setTipoFiltro('todos');
    setTermoBusca('');
    setLimiteExibicao(25);
  };

  return (
    <div className={`sge-historico-tab ${className}`}>
      {/* Seção Superior Unificada: Busca + Botão de Filtro com Sanfona */}
      <div className="sge-historico-top-section">
        <SearchFilterBar
          searchTerm={termoBusca}
          onSearchChange={(val) => {
            setTermoBusca(val);
            setLimiteExibicao(25);
          }}
          onClear={() => {
            setTermoBusca('');
            setLimiteExibicao(25);
          }}
          placeholder="Buscar por nota fiscal, doador, remessa, produto SKU ou responsável..."
          hasActiveFilter={temFiltroAtivo}
          isFilterOpen={mostrarFiltros}
          onToggleFilter={() => setMostrarFiltros((prev) => !prev)}
        />

        <FilterDrawer isOpen={mostrarFiltros}>
          <FilterGroup title="Tipo de Operação">
            <FilterChip
              label="Todos"
              count={metricas.todos}
              isActive={tipoFiltro === 'todos'}
              onClick={() => {
                setTipoFiltro('todos');
                setLimiteExibicao(25);
              }}
            />
            <FilterChip
              label="Entradas"
              count={metricas.notaFiscal}
              dotColor="#059669"
              isActive={tipoFiltro === 'nota_fiscal'}
              onClick={() => {
                setTipoFiltro('nota_fiscal');
                setLimiteExibicao(25);
              }}
            />
            <FilterChip
              label="Saídas"
              count={metricas.saida}
              dotColor="#DC2626"
              isActive={tipoFiltro === 'saida'}
              onClick={() => {
                setTipoFiltro('saida');
                setLimiteExibicao(25);
              }}
            />
            <FilterChip
              label="Ajustes"
              count={metricas.ajuste}
              dotColor="#2563EB"
              isActive={tipoFiltro === 'ajuste'}
              onClick={() => {
                setTipoFiltro('ajuste');
                setLimiteExibicao(25);
              }}
            />
          </FilterGroup>
        </FilterDrawer>
      </div>

      {/* Meta Bar: Quantidade de registros e ordenação padrão SGE */}
      <div className="sge-meta-bar">
        <span className="sge-meta-count">
          {operacoesFiltradas.length === 1
            ? '1 registro encontrado'
            : `${operacoesFiltradas.length} registros encontrados`}
        </span>

        <SortLoopButton
          currentLabel={ordenacao === 'desc' ? 'Mais recentes' : 'Mais antigas'}
          onToggleSort={() => setOrdenacao((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
          title="Alternar ordem cronológica"
          ariaLabel={`Alternar ordenação dos registros. Atual: ${ordenacao === 'desc' ? 'Mais recentes' : 'Mais antigas'}`}
        />
      </div>

      {/* Lista de Registros de Histórico Agrupados por Documento / Operação */}
      {operacoesFiltradas.length === 0 ? (
        <div className="sge-historico-empty">
          <div className="sge-historico-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
          </div>
          <h3 className="sge-historico-empty-title">
            {temBuscaOuFiltroAtivo ? 'Nenhum registro encontrado' : 'Nenhuma operação registrada'}
          </h3>
          <p className="sge-historico-empty-desc">
            {temBuscaOuFiltroAtivo
              ? 'Tente ajustar os filtros ou o termo de busca para localizar outros documentos.'
              : 'As entradas, saídas e movimentações do estoque aparecerão aqui organizadas por operação.'}
          </p>
          {temBuscaOuFiltroAtivo && (
            <button
              type="button"
              className="sge-historico-clear-filter-btn"
              onClick={handleLimparFiltros}
            >
              Limpar Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="sge-historico-list">
          {itensExibidos.map((op) => {
            const isNF = op.tipoOperacao === 'nota_fiscal';
            const isSaida = op.tipoOperacao === 'saida';
            const isAjuste = op.tipoOperacao === 'ajuste';
            const isDoacao = op.tipoOrigem === 'doacao';
            const isCompra = op.tipoOrigem === 'compra_nf' || op.tipoOrigem === 'compra';
            const rotuloEntrada = isDoacao
              ? 'Doador'
              : isCompra
                ? 'Nota Fiscal'
                : 'Origem';

            const totalUnidades = (op.itens || []).reduce(
              (acc, it) => acc + (Number(it.quantidade) || 0),
              0
            );
            const itensOp = op.itens || [];
            const possuiListaExtensa = itensOp.length > LIMIAR_RECOLHER_ITENS_DOC;
            const termoLimpo = termoBusca.toLowerCase().trim();
            const matchEmItemOculto = Boolean(
              termoLimpo &&
                possuiListaExtensa &&
                itensOp.slice(ITENS_VISIVEIS_POR_DOC).some((item) => {
                  const nome = String(item.nome || '').toLowerCase();
                  const cod = String(item.codigo || '').toLowerCase();
                  return nome.includes(termoLimpo) || cod.includes(termoLimpo);
                })
            );
            const listaExpandida = !possuiListaExtensa || Boolean(docsItensExpandidos[op.chave]) || matchEmItemOculto;
            const itensVisiveis = listaExpandida ? itensOp : itensOp.slice(0, ITENS_VISIVEIS_POR_DOC);
            const qtdItensOcultos = Math.max(0, itensOp.length - itensVisiveis.length);

            return (
              <article key={op.chave} className={`sge-historico-card sge-historico-card--${op.tipoOperacao}`}>
                {/* Cabeçalho do Card */}
                <div className="sge-historico-card-top">
                  <div className="sge-historico-doc-badge-group">
                    <div className="sge-historico-doc-details">
                      <div className="sge-historico-doc-header-row">
                        {isNF && (
                          <>
                            <span className="sge-historico-doc-title">
                              {rotuloEntrada}: <strong>{op.documentoFiscal || op.numeroRemessa || 'Entrada'}</strong>
                            </span>
                            {op.numeroRemessa && op.numeroRemessa !== op.documentoFiscal && (
                              <span className="sge-historico-remessa-tag" title="Identificador da Remessa">
                                {op.numeroRemessa}
                              </span>
                            )}
                            {isCompra && op.fornecedor && op.fornecedor !== op.documentoFiscal && (
                              <span className="sge-historico-fornecedor-tag" title="Fornecedor">
                                Fornecedor: {op.fornecedor}
                              </span>
                            )}
                          </>
                        )}

                        {isSaida && (
                          <span className="sge-historico-doc-title">
                            {op.pedidoId ? (
                              <>Pedido: <strong>#{op.pedidoId}</strong></>
                            ) : (
                              <strong>Saída de Estoque</strong>
                            )}
                          </span>
                        )}

                        {isAjuste && (
                          <span className="sge-historico-doc-title">
                            <strong>Ajuste de Inventário Físico</strong>
                          </span>
                        )}
                      </div>

                      <div className="sge-historico-doc-meta-row">
                        <span className="sge-historico-meta-item">
                          <svg className="sge-historico-meta-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          <span>{formatarDataHora(op.data)}</span>
                        </span>

                        <span className="sge-historico-meta-item">
                          <svg className="sge-historico-meta-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          <span>
                            {isNF
                              ? `Recebido por: ${op.responsavel}`
                              : isSaida
                                ? `Atendido por: ${op.responsavel}`
                                : `Ajustado por: ${op.responsavel}`}
                          </span>
                        </span>

                        {op.fotos && op.fotos.length > 0 && (
                          <button
                            type="button"
                            className="sge-historico-meta-item sge-historico-meta-item--anexo sge-historico-meta-btn-fotos"
                            onClick={() => handleAbrirGaleria(op)}
                            title="Clique para visualizar as fotos do comprovante"
                            aria-label={`Ver ${op.fotos.length} fotos anexadas à remessa`}
                          >
                            <svg className="sge-historico-meta-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                            <span>{op.fotos.length} {op.fotos.length === 1 ? 'foto' : 'fotos'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ação de Adicionar item a esta NF (apenas em Notas Fiscais) */}
                  {isNF && onAdicionarItemNF && (
                    <div className="sge-historico-card-actions">
                      <button
                        type="button"
                        className="sge-historico-add-item-btn"
                        onClick={() => onAdicionarItemNF(op)}
                        title="Adicionar item faltante vinculado a esta mesma Nota Fiscal / Remessa"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>Adicionar item a esta NF</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Observação descritiva se houver */}
                {op.observacao && (
                  <div className="sge-historico-doc-obs">
                    <span>{op.observacao}</span>
                  </div>
                )}

                {/* Seção de Itens Contidos no Documento */}
                <div className="sge-historico-items-section">
                  <div className="sge-historico-items-header">
                    <span className="sge-historico-items-title">
                      {isNF
                        ? 'Itens recebidos'
                        : isSaida
                          ? 'Itens atendidos'
                          : 'Itens ajustados'}
                    </span>
                    <span className="sge-historico-items-sum">
                      Volume: {totalUnidades}
                    </span>
                  </div>

                  <div className="sge-historico-items-table">
                    {itensVisiveis.map((item, idx) => (
                      <div
                        key={`${op.chave}_it_${item.materialId || idx}`}
                        className="sge-historico-item-row"
                      >
                        <div className="sge-historico-item-col-prod">
                          <span className="sge-historico-sku-badge">{item.codigo}</span>
                          <span className="sge-historico-item-nome">{item.nome}</span>
                        </div>

                        <div className="sge-historico-item-col-delta">
                          <span className={`sge-historico-delta sge-historico-delta--${isNF ? 'entrada' : isSaida ? 'saida' : 'ajuste'}`}>
                            {isNF && `+${item.quantidade} ${item.unidade}`}
                            {isSaida && `-${item.quantidade} ${item.unidade}`}
                            {isAjuste && `Ajuste (${item.quantidade > 0 ? `+${item.quantidade}` : item.quantidade}) ${item.unidade}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {possuiListaExtensa && !matchEmItemOculto && (
                    <button
                      type="button"
                      className="sge-historico-items-toggle"
                      onClick={() => handleAlternarItensDocumento(op.chave)}
                      aria-expanded={listaExpandida}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`sge-historico-items-toggle-icon ${listaExpandida ? 'sge-historico-items-toggle-icon--aberto' : ''}`}
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      <span>
                        {listaExpandida
                          ? 'Recolher lista'
                          : `Mostrar mais ${qtdItensOcultos} ${qtdItensOcultos === 1 ? 'item' : 'itens'} (${itensOp.length} no total)`}
                      </span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {itensExibidos.length < operacoesFiltradas.length && (
            <button
              type="button"
              className="sge-historico-load-more"
              onClick={() => setLimiteExibicao((prev) => prev + 25)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span>Carregar mais documentos ({operacoesFiltradas.length - itensExibidos.length} restantes)</span>
            </button>
          )}
        </div>
      )}

      {/* Visualizador de Inspeção Documental */}
      <FotoGaleriaModal
        isOpen={galeriaAberta}
        onClose={() => setGaleriaAberta(false)}
        fotos={dadosGaleria.fotos}
        recebimentoId={dadosGaleria.recebimentoId}
        tituloDocumento={dadosGaleria.titulo}
        dadosOperacao={dadosGaleria.dadosOperacao}
      />
    </div>
  );
};

export default HistoricoMovimentacoesTab;
