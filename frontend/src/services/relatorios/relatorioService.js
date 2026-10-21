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
    cabecalho = 'Código;Material;Categoria;Unidade;Quantidade;Estoque Mínimo;Localização\n';
    linhas = dados.map(m =>
      `${m.codigo || ''};${m.nome};${m.categoria || ''};${m.unidade || 'UN'};${m.quantidade};${m.estoqueMinimo};${m.localizacao || ''}`
    );
  } else if (tipo === 'pedidos') {
    const dados = await mockStore.getPedidos();
    cabecalho = 'ID;Data;Solicitante;Setor;Material;Quantidade;Prioridade;Status\n';
    linhas = dados.map(p =>
      `${p.id};${p.data || ''};${p.usuario || ''};${p.setor || ''};${p.material || ''};${p.quantidade};${p.prioridade || 'Normal'};${p.status || 'Pendente'}`
    );
  } else {
    const dados = await mockStore.getUsuarios();
    cabecalho = 'ID;Nome;Email;Perfil;Setor;Ativo;Data de Cadastro\n';
    linhas = dados.map(u =>
      `${u.id};${u.nome};${u.email};${u.perfil};${u.setor};${u.ativo ? 'Ativo' : 'Inativo'};${u.dataCadastro || ''}`
    );
  }

  const csvContent = '\uFEFF' + cabecalho + linhas.join('\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
};

export const relatorioService = { exportarCsv };
