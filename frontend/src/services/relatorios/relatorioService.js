import { mockStore } from '../api/mockDataStore';

export const exportarCsv = async (tipo) => {
  let cabecalho = '';
  let linhas = [];

  if (tipo === 'movimentacoes') {
    const dados = await mockStore.getMovimentacoes();
    cabecalho = 'ID;Data;Produto;Tipo;Quantidade;Responsável;Observação\n';
    linhas = dados.map(m =>
      `${m.id};${m.data ? new Date(m.data).toLocaleString('pt-BR') : ''};${m.produtoNome || ''};${m.tipo};${m.quantidade};${m.funcionarioNome || ''};${m.observacao || ''}`
    );
  } else if (tipo === 'estoque') {
    const dados = await mockStore.getMateriais(false);
    cabecalho = 'Código SKU;Material;Tipo de Bem;Categoria;Complexo;Locação;Localização;Validade;Saldo Físico;Unidade;Estoque Mínimo\n';
    linhas = dados.map(m => {
      const tipoBem = m.bemDuravel ? 'Bem Durável' : 'Consumo';
      const validade = m.dataValidade || (m.bemDuravel ? 'Não se aplica' : '—');
      return `${m.codigo || ''};${m.nome};${tipoBem};${m.categoria || ''};${m.complexo || 'Almoxarifado Central'};${m.locacao || '—'};${m.localizacao || '—'};${validade};${m.quantidade};${m.unidade || 'UN'};${m.estoqueMinimo}`;
    });
  } else if (tipo === 'pedidos') {
    const dados = await mockStore.getPedidos();
    cabecalho = 'ID;Data;Solicitante;Setor;Ramal;Material;Quantidade;Prioridade;Status\n';
    linhas = dados.map(p =>
      `${p.id};${p.data || ''};${p.usuario || ''};${p.setor || ''};${p.ramal || '—'};${p.material || ''};${p.quantidade};${p.prioridade || 'Normal'};${p.status || 'Pendente'}`
    );
  } else {
    const dados = await mockStore.getUsuarios();
    cabecalho = 'ID;Nome;Email;Perfil;Setor;Ramal;Ativo;Data de Cadastro\n';
    linhas = dados.map(u =>
      `${u.id};${u.nome};${u.email};${u.perfil};${u.setor};${u.ramal || '—'};${u.ativo ? 'Ativo' : 'Inativo'};${u.dataCadastro || ''}`
    );
  }

  const csvContent = '\uFEFF' + cabecalho + linhas.join('\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
};

export const relatorioService = { exportarCsv };
