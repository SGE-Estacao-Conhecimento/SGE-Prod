import { materialService } from '../materiais/materialService';
import { pedidoService } from '../pedidos/pedidoService';
import { usuarioService } from '../usuarios/usuarioService';
import { movimentacaoService } from '../movimentacoes/movimentacaoService';

/**
 * Escapa valores para o padrão CSV RFC 4180 com delimitador ponto-e-vírgula (;),
 * padrão comum para Excel em português.
 */
export const escaparCsv = (valor) => {
  if (valor === null || valor === undefined) return '';
  const str = String(valor);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Normaliza qualquer representação de data (DD/MM/YYYY, YYYY-MM-DD, ISO 8601 ou Date)
 * para uma string canônica YYYY-MM-DD no fuso local, evitando desvios de fuso horário UTC
 * e falhas de interpretação do formato brasileiro DD/MM/YYYY.
 */
export const normalizarDataParaIso = (dataValor) => {
  if (!dataValor) return null;
  if (dataValor instanceof Date) {
    if (isNaN(dataValor.getTime())) return null;
    const ano = dataValor.getFullYear();
    const mes = String(dataValor.getMonth() + 1).padStart(2, '0');
    const dia = String(dataValor.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  const str = String(dataValor).trim();
  if (!str) return null;

  const matchBr = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (matchBr) {
    return `${matchBr[3]}-${matchBr[2]}-${matchBr[1]}`;
  }

  const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
  }

  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  const ano = parsed.getFullYear();
  const mes = String(parsed.getMonth() + 1).padStart(2, '0');
  const dia = String(parsed.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

export const estaNoPeriodo = (dataValor, dataInicio, dataFim) => {
  if (!dataInicio && !dataFim) return true;
  const dIso = normalizarDataParaIso(dataValor);
  if (!dIso) return false;
  if (dataInicio) {
    const inicioIso = normalizarDataParaIso(dataInicio);
    if (inicioIso && dIso < inicioIso) return false;
  }
  if (dataFim) {
    const fimIso = normalizarDataParaIso(dataFim);
    if (fimIso && dIso > fimIso) return false;
  }
  return true;
};

/**
 * Gera o arquivo CSV formatado para o tipo de relatório solicitado,
 * consumindo diretamente os serviços reais da aplicação (conectados à API ou modo simulado)
 * e respeitando todos os filtros especificados.
 *
 * @param {('movimentacoes'|'estoque'|'pedidos'|'usuarios'|'consumo_setor')} tipo - Tipo de relatório
 * @param {Object} [filtros={}] - Filtros aplicados à consulta
 * @returns {Promise<Blob>} Blob com codificação UTF-8 (BOM) e tipo 'text/csv;charset=utf-8;'
 */
export const exportarCsv = async (tipo, filtros = {}) => {
  let cabecalho = '';
  let linhas = [];

  if (tipo === 'movimentacoes') {
    const paramsApi = filtros?.tipo && filtros.tipo !== 'todos' ? { tipo: filtros.tipo } : {};
    const dados = await movimentacaoService.listar(paramsApi);
    let filtrados = Array.isArray(dados) ? dados : [];

    if (filtros?.dataInicio || filtros?.dataFim) {
      filtrados = filtrados.filter((m) =>
        estaNoPeriodo(m.data || m.criadoEm, filtros.dataInicio, filtros.dataFim)
      );
    }
    if (filtros?.categoria && filtros.categoria !== 'todas') {
      const catAlvo = String(filtros.categoria).toLowerCase();
      let mapaCatPorId = new Map();
      let mapaCatPorNome = new Map();
      if (filtrados.some((m) => !m.categoria)) {
        try {
          const materiais = await materialService.listar(false);
          (Array.isArray(materiais) ? materiais : []).forEach((mat) => {
            if (mat.id !== undefined) mapaCatPorId.set(Number(mat.id), String(mat.categoria || '').toLowerCase());
            if (mat.nome) mapaCatPorNome.set(String(mat.nome).toLowerCase(), String(mat.categoria || '').toLowerCase());
          });
        } catch {
          // Se falhar consulta auxiliar de categorias, mantém filtro estrito pelo campo categoria presente
        }
      }
      filtrados = filtrados.filter((m) => {
        const catDireta = String(m.categoria || '').toLowerCase();
        if (catDireta) return catDireta === catAlvo;
        const catPorId = m.produtoId !== undefined ? mapaCatPorId.get(Number(m.produtoId)) : '';
        if (catPorId) return catPorId === catAlvo;
        const nomeMat = String(m.produtoNome || m.material || '').toLowerCase();
        return (mapaCatPorNome.get(nomeMat) || '') === catAlvo;
      });
    }
    if (filtros?.tipo && filtros.tipo !== 'todos') {
      filtrados = filtrados.filter(
        (m) => String(m.tipo || '').toLowerCase() === String(filtros.tipo).toLowerCase()
      );
    }

    cabecalho = 'ID;Data;Produto;Tipo;Quantidade;Responsável;Observação\n';
    linhas = filtrados.map((m) =>
      [
        escaparCsv(m.id),
        escaparCsv(m.data ? new Date(m.data).toLocaleString('pt-BR') : ''),
        escaparCsv(m.produtoNome || m.material || ''),
        escaparCsv(m.tipo || ''),
        escaparCsv(m.quantidade ?? 0),
        escaparCsv(m.funcionarioNome || m.responsavel || ''),
        escaparCsv(m.observacao || '')
      ].join(';')
    );
  } else if (tipo === 'estoque') {
    const dados = await materialService.listar(filtros?.apenasAtivos !== false);
    let filtrados = Array.isArray(dados) ? dados : [];

    if (filtros?.categoria && filtros.categoria !== 'todas') {
      filtrados = filtrados.filter(
        (m) => String(m.categoria || '').toLowerCase() === String(filtros.categoria).toLowerCase()
      );
    }
    if (filtros?.tipoBem && filtros.tipoBem !== 'todos') {
      const querDuravel = filtros.tipoBem === 'duravel' || filtros.tipoBem === 'Bem Durável';
      filtrados = filtrados.filter((m) => Boolean(m.bemDuravel) === querDuravel);
    }
    if (filtros?.saldoStatus && filtros.saldoStatus !== 'todos') {
      filtrados = filtrados.filter((m) => {
        const qtd = Number(m.quantidade ?? 0);
        const min = Number(m.estoqueMinimo ?? 0);
        if (filtros.saldoStatus === 'criticos') return qtd <= min;
        if (filtros.saldoStatus === 'zerados') return qtd === 0;
        if (filtros.saldoStatus === 'normais') return qtd > min;
        return true;
      });
    }

    cabecalho =
      'Código SKU;Material;Tipo de Bem;Categoria;Complexo;Localização;Validade;Saldo Físico;Unidade;Estoque Mínimo\n';
    linhas = filtrados.map((m) => {
      const tipoBem = m.bemDuravel ? 'Bem Durável' : 'Consumo';
      const validade = m.dataValidade || (m.bemDuravel ? 'Não se aplica' : '—');
      return [
        escaparCsv(m.codigo || ''),
        escaparCsv(m.nome || ''),
        escaparCsv(tipoBem),
        escaparCsv(m.categoria || ''),
        escaparCsv(m.complexo || 'Almoxarifado Central'),
        escaparCsv(m.localizacao || '—'),
        escaparCsv(validade),
        escaparCsv(m.quantidade ?? 0),
        escaparCsv(m.unidade || 'UN'),
        escaparCsv(m.estoqueMinimo ?? 0)
      ].join(';');
    });
  } else if (tipo === 'pedidos') {
    const statusParam = filtros?.status && filtros.status !== 'todos' ? filtros.status : '';
    const dados = await pedidoService.listar(statusParam);
    let filtrados = Array.isArray(dados) ? dados : [];

    if (filtros?.dataInicio || filtros?.dataFim) {
      filtrados = filtrados.filter((p) =>
        estaNoPeriodo(p.dataIso || p.data || p.criadoEm, filtros.dataInicio, filtros.dataFim)
      );
    }
    if (filtros?.setor && filtros.setor !== 'todos') {
      filtrados = filtrados.filter(
        (p) => String(p.setor || '').toLowerCase() === String(filtros.setor).toLowerCase()
      );
    }
    if (filtros?.prioridade && filtros.prioridade !== 'todos') {
      const querUrgente = filtros.prioridade === 'urgente' || filtros.prioridade === 'alta';
      filtrados = filtrados.filter(
        (p) =>
          (Boolean(p.urgente) || String(p.prioridade).toLowerCase() === 'urgente') === querUrgente
      );
    }
    if (filtros?.status && filtros.status !== 'todos') {
      filtrados = filtrados.filter(
        (p) => String(p.status || '').toLowerCase() === String(filtros.status).toLowerCase()
      );
    }

    cabecalho =
      'ID;Data;Solicitante;Setor;Ramal;Material;Quantidade;Prioridade;Status;Justificativa\n';
    linhas = filtrados.map((p) => [
      escaparCsv(p.id),
      escaparCsv(p.data || ''),
      escaparCsv(p.usuario || ''),
      escaparCsv(p.setor || ''),
      escaparCsv(p.ramal || '—'),
      escaparCsv(
        p.material ||
          (Array.isArray(p.materiais)
            ? p.materiais.map((m) => m.materialNome || m).join(', ')
            : '')
      ),
      escaparCsv(p.quantidade ?? 1),
      escaparCsv(p.prioridade || (p.urgente ? 'Urgente' : 'Normal')),
      escaparCsv(p.status || 'Pendente'),
      escaparCsv(p.justificativa || '')
    ].join(';'));
  } else if (tipo === 'consumo_setor') {
    const pedidos = await pedidoService.listar();
    let atendidos = (Array.isArray(pedidos) ? pedidos : []).filter((p) => {
      const st = String(p.status || '').toLowerCase();
      return st === 'atendido' || st === 'entregue' || st === 'atendido parcialmente';
    });

    if (filtros?.dataInicio || filtros?.dataFim) {
      atendidos = atendidos.filter((p) =>
        estaNoPeriodo(p.dataIso || p.data || p.criadoEm, filtros.dataInicio, filtros.dataFim)
      );
    }

    let mapaCatPorId = new Map();
    let mapaCatPorNome = new Map();
    if (filtros?.categoria && filtros.categoria !== 'todas') {
      try {
        const materiais = await materialService.listar(false);
        (Array.isArray(materiais) ? materiais : []).forEach((mat) => {
          if (mat.id !== undefined) mapaCatPorId.set(Number(mat.id), String(mat.categoria || '').toLowerCase());
          if (mat.nome) mapaCatPorNome.set(String(mat.nome).toLowerCase(), String(mat.categoria || '').toLowerCase());
        });
      } catch {
        // Sem catálogo auxiliar, filtra por it.categoria
      }
    }

    const catAlvo = filtros?.categoria && filtros.categoria !== 'todas'
      ? String(filtros.categoria).toLowerCase()
      : null;

    const mapaConsumo = new Map();
    atendidos.forEach((p) => {
      const setor = p.setor || 'Não Informado';
      const itens = Array.isArray(p.itens) && p.itens.length > 0
        ? p.itens
        : [{
            produtoId: p.produtoId,
            materialNome: p.material,
            quantidade: p.quantidade,
            categoria: p.categoria,
            unidade: 'UN'
          }];

      itens.forEach((it) => {
        const mat = it.materialNome || it.nome || 'Material';
        if (catAlvo) {
          const catItem = String(it.categoria || '').toLowerCase()
            || (it.produtoId !== undefined ? mapaCatPorId.get(Number(it.produtoId)) : '')
            || mapaCatPorNome.get(String(mat).toLowerCase())
            || '';
          if (catItem !== catAlvo) return;
        }
        const qtdEfetiva = Number(it.quantidadeAtendida ?? it.quantidade ?? 0);
        if (qtdEfetiva <= 0) return;
        const unid = it.unidade || 'UN';
        const chave = `${setor}||${mat}||${unid}`;
        const atual = mapaConsumo.get(chave) || { setor, material: mat, unidade: unid, quantidadeTotal: 0, totalPedidos: 0 };
        atual.quantidadeTotal = Math.round((atual.quantidadeTotal + qtdEfetiva) * 1000) / 1000;
        atual.totalPedidos += 1;
        mapaConsumo.set(chave, atual);
      });
    });

    let listaConsumo = Array.from(mapaConsumo.values());
    if (filtros?.setor && filtros.setor !== 'todos') {
      listaConsumo = listaConsumo.filter(
        (c) => String(c.setor).toLowerCase() === String(filtros.setor).toLowerCase()
      );
    }

    cabecalho = 'Setor;Material;Quantidade Consumida;Unidade;Total de Atendimentos\n';
    linhas = listaConsumo.map((c) => [
      escaparCsv(c.setor),
      escaparCsv(c.material),
      escaparCsv(c.quantidadeTotal),
      escaparCsv(c.unidade),
      escaparCsv(c.totalPedidos)
    ].join(';'));
  } else {
    // Tipo 'usuarios' ou padrão
    const dados = await usuarioService.listar();
    let filtrados = Array.isArray(dados) ? dados : [];

    if (filtros?.perfil && filtros.perfil !== 'todos') {
      filtrados = filtrados.filter(
        (u) => String(u.perfil || '').toLowerCase() === String(filtros.perfil).toLowerCase()
      );
    }
    if (filtros?.setor && filtros.setor !== 'todos') {
      filtrados = filtrados.filter(
        (u) => String(u.setor || '').toLowerCase() === String(filtros.setor).toLowerCase()
      );
    }
    if (filtros?.ativo !== undefined && filtros.ativo !== 'todos') {
      const querAtivo = filtros.ativo === true || filtros.ativo === 'true' || filtros.ativo === 'Ativo';
      filtrados = filtrados.filter((u) => Boolean(u.ativo) === querAtivo);
    }

    cabecalho = 'ID;Nome;Email;Perfil;Setor;Ramal;Ativo;Data de Cadastro\n';
    linhas = filtrados.map((u) => [
      escaparCsv(u.id),
      escaparCsv(u.nome || ''),
      escaparCsv(u.email || ''),
      escaparCsv(u.perfil || ''),
      escaparCsv(u.setor || ''),
      escaparCsv(u.ramal || '—'),
      escaparCsv(u.ativo ? 'Ativo' : 'Inativo'),
      escaparCsv(u.dataCadastro || '')
    ].join(';'));
  }

  const csvContent = '\uFEFF' + cabecalho + linhas.join('\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
};

/**
 * Dispara o download direto do relatório CSV no navegador.
 */
export const baixarCsv = async (tipo, filtros = {}, nomeArquivo = null) => {
  const blob = await exportarCsv(tipo, filtros);
  const dataIso = new Date().toISOString().split('T')[0];
  const nomeFinal = nomeArquivo || `relatorio_${tipo}_${dataIso}.csv`;

  if (typeof window !== 'undefined' && window.document) {
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = nomeFinal;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  return blob;
};

export const relatorioService = {
  exportarCsv,
  baixarCsv
};
