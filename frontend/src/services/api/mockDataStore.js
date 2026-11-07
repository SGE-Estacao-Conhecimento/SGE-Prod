import { DEMO_MATERIAIS, DEMO_USUARIOS, DEMO_PEDIDOS, DEMO_MOVIMENTACOES } from '../../data/demoData';

const STORAGE_KEYS = {
  MATERIAIS: 'sge_standalone_materiais',
  PEDIDOS: 'sge_standalone_pedidos',
  USUARIOS: 'sge_standalone_usuarios',
  MOVIMENTACOES: 'sge_standalone_movimentacoes',
  NOTIFICACOES: 'sge_standalone_notificacoes',
  REMESSAS: 'sge_standalone_remessas',
  FAVORITOS: 'sge_standalone_favoritos',
  SETORES: 'sge_standalone_setores'
};

const INITIAL_SETORES = [
  'Educação Infantil',
  'Ensino Fundamental',
  'Coordenação',
  'Apoio / Limpeza',
  'Almoxarifado Central',
  'Diretoria / TI'
];

const INITIAL_NOTIFICACOES = [
  {
    id: 'notif-1',
    pedidoId: 102,
    titulo: 'Pedido Urgente Registrado',
    mensagem: 'Álcool em Gel 70% solicitado com urgência para as salas e refeitório.',
    tipo: 'urgente',
    tempo: 'Hoje, 09:30',
    lida: false,
    data: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'notif-2',
    pedidoId: 101,
    titulo: 'Pedido #101 Aguardando Separação',
    mensagem: 'Papel Sulfite A4 enviado para análise no almoxarifado.',
    tipo: 'info',
    tempo: 'Ontem, 16:15',
    lida: false,
    data: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'notif-3',
    pedidoId: 98,
    titulo: 'Pedido #98 Concluído',
    mensagem: 'Marcadores para quadro branco entregues à coordenação.',
    tipo: 'info',
    tempo: '2 dias atrás',
    lida: true,
    data: new Date(Date.now() - 172800000).toISOString()
  }
];

const INITIAL_REMESSAS = [
  {
    id: 1,
    numeroRemessa: 'REM-2026-001',
    materialId: 1,
    materialNome: 'Papel Sulfite A4',
    quantidade: 50,
    fornecedor: 'Distribuidora Papelaria Brasil',
    destino: 'Almoxarifado Central',
    dataEnvio: '2026-09-20',
    status: 'Concluído',
    observacao: 'Entrega trimestral de insumos de escritório'
  },
  {
    id: 2,
    numeroRemessa: 'REM-2026-002',
    materialId: 4,
    materialNome: 'Álcool em Gel 70%',
    quantidade: 30,
    fornecedor: 'Higiene & Cia',
    destino: 'Almoxarifado Central',
    dataEnvio: '2026-09-25',
    status: 'Concluído',
    observacao: 'Reposição preventiva'
  }
];

const safeGet = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const safeSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Falha silenciosa em caso de armazenamento restrito
  }
};

class MockDataStore {
  constructor() {
    this._materiais = safeGet(STORAGE_KEYS.MATERIAIS, DEMO_MATERIAIS);
    this._pedidos = safeGet(STORAGE_KEYS.PEDIDOS, DEMO_PEDIDOS);
    this._usuarios = safeGet(STORAGE_KEYS.USUARIOS, DEMO_USUARIOS);
    this._movimentacoes = safeGet(STORAGE_KEYS.MOVIMENTACOES, DEMO_MOVIMENTACOES);
    this._notificacoes = safeGet(STORAGE_KEYS.NOTIFICACOES, INITIAL_NOTIFICACOES);
    this._remessas = safeGet(STORAGE_KEYS.REMESSAS, INITIAL_REMESSAS);
    this._favoritos = safeGet(STORAGE_KEYS.FAVORITOS, []);
    this._setores = safeGet(STORAGE_KEYS.SETORES, INITIAL_SETORES);
  }

  // --- MATERIAIS ---
  async getMateriais(apenasAtivos = true) {
    let list = this._materiais.map(m => {
      if (!m.itensPorEmbalagem && m.qtdPorCaixa) {
        return { ...m, itensPorEmbalagem: Number(m.qtdPorCaixa) };
      }
      if (!m.itensPorEmbalagem) {
        const demo = DEMO_MATERIAIS.find(d => d.id === m.id || d.codigo === m.codigo);
        if (demo?.itensPorEmbalagem) {
          return { ...m, itensPorEmbalagem: demo.itensPorEmbalagem };
        }
      }
      return m;
    });
    if (apenasAtivos) {
      list = list.filter(m => m.ativo !== false);
    }
    return list;
  }

  async createMaterial(payload) {
    const id = Math.max(0, ...this._materiais.map(m => Number(m.id) || 0)) + 1;
    const novo = {
      id,
      codigo: payload.codigo || `MAT-${String(id).padStart(3, '0')}`,
      nome: payload.nome,
      categoria: payload.categoria || 'Geral',
      unidade: payload.unidade || 'UN',
      itensPorEmbalagem: payload.itensPorEmbalagem !== undefined ? Number(payload.itensPorEmbalagem) : undefined,
      quantidade: Number(payload.quantidadeInicial ?? payload.quantidade ?? 0),
      estoqueMinimo: Number(payload.estoqueMinimo ?? 0),
      complexo: payload.complexo || 'Almoxarifado Central',
      locacao: payload.locacao || '',
      localizacao: payload.localizacao || '',
      dataValidade: payload.dataValidade || null,
      descricao: payload.descricao || '',
      ativo: true
    };
    // O saldo inicial entra pela movimentação (que já soma ao saldo); cadastrar com o saldo
    // preenchido e ainda registrar a entrada duplicava a quantidade.
    const saldoInicial = novo.quantidade;
    novo.quantidade = 0;
    this._materiais = [novo, ...this._materiais];
    safeSet(STORAGE_KEYS.MATERIAIS, this._materiais);

    if (saldoInicial > 0) {
      await this.registrarMovimentacao({
        produtoId: novo.id,
        produtoNome: novo.nome,
        tipo: 'entrada',
        quantidade: saldoInicial,
        observacao: 'Saldo inicial cadastrado'
      });
    }

    return novo;
  }

  async updateMaterial(id, payload) {
    const numId = Number(id);
    let atualizado = null;
    this._materiais = this._materiais.map(m => {
      if (Number(m.id) === numId) {
        atualizado = {
          ...m,
          ...payload,
          id: numId,
          quantidade: payload.quantidadeInicial !== undefined ? Number(payload.quantidadeInicial) : m.quantidade,
          estoqueMinimo: payload.estoqueMinimo !== undefined ? Number(payload.estoqueMinimo) : m.estoqueMinimo
        };
        return atualizado;
      }
      return m;
    });
    safeSet(STORAGE_KEYS.MATERIAIS, this._materiais);
    return atualizado || payload;
  }

  // "Excluir material" retira do catálogo (desativa), como na API: o histórico continua.
  async deleteMaterial(id) {
    const numId = Number(id);
    let removido = null;
    this._materiais = this._materiais.map(m => {
      if (Number(m.id) !== numId) return m;
      removido = { ...m, ativo: false };
      return removido;
    });
    safeSet(STORAGE_KEYS.MATERIAIS, this._materiais);
    return removido;
  }

  _sanitizarPedido(p) {
    if (!p) return p;
    const resolverNome = (id, nomeAtual) => {
      if (nomeAtual && String(nomeAtual).trim() && nomeAtual !== 'undefined') return nomeAtual;
      const m = this._materiais.find(mat => Number(mat.id) === Number(id));
      return m?.nome || 'Material Solicitado';
    };
    const resolverUnidade = (id, unidAtual) => {
      if (unidAtual && String(unidAtual).trim() && unidAtual !== 'undefined') return unidAtual;
      const m = this._materiais.find(mat => Number(mat.id) === Number(id));
      return m?.unidade || 'UN';
    };

    let itensSanitizados = p.itens;
    if (Array.isArray(p.itens) && p.itens.length > 0) {
      itensSanitizados = p.itens.map(it => ({
        ...it,
        materialNome: resolverNome(it.produtoId || it.id, it.materialNome || it.nome),
        unidade: resolverUnidade(it.produtoId || it.id, it.unidade)
      }));
    }

    let materiaisSanitizados = p.materiais;
    if (Array.isArray(p.materiais) && p.materiais.length > 0) {
      materiaisSanitizados = p.materiais.map(m => typeof m === 'string' ? m : {
        ...m,
        materialNome: resolverNome(m.produtoId || m.id, m.materialNome || m.nome),
        unidade: resolverUnidade(m.produtoId || m.id, m.unidade)
      });
    }

    let resumoMaterial = p.material;
    if (!resumoMaterial || resumoMaterial.includes('undefined')) {
      if (Array.isArray(materiaisSanitizados) && materiaisSanitizados.length > 0) {
        resumoMaterial = materiaisSanitizados.length === 1
          ? (typeof materiaisSanitizados[0] === 'string' ? materiaisSanitizados[0] : materiaisSanitizados[0].materialNome)
          : materiaisSanitizados.map(m => typeof m === 'string' ? m : `${m.materialNome} (${m.quantidade} ${m.unidade})`).join(', ');
      }
    }

    return {
      ...p,
      itens: itensSanitizados || p.itens,
      materiais: materiaisSanitizados || p.materiais,
      material: resumoMaterial || p.material
    };
  }

  // --- PEDIDOS ---
  async getPedidos(status = '') {
    const list = this._pedidos.map(p => this._sanitizarPedido(p));
    if (!status) return [...list];
    const s = String(status).toLowerCase();
    return list.filter(p => String(p.status || '').toLowerCase() === s);
  }

  async getMeusPedidos(user) {
    const list = this._pedidos.map(p => this._sanitizarPedido(p));
    const nomeOuEmail = (user?.identifier || user?.email || user?.nome || '').toLowerCase();
    if (!nomeOuEmail) return [...list];
    return list.filter(p => {
      const u = String(p.usuario || '').toLowerCase();
      return u === nomeOuEmail || nomeOuEmail.includes(u) || u.includes('usuário') || u.includes('carlos');
    });
  }

  async createPedido(pedidoData, user) {
    const nextId = Math.max(0, ...this._pedidos.map(p => Number(p.id) || 0)) + 1;
    const itens = Array.isArray(pedidoData.itens) && pedidoData.itens.length > 0
      ? pedidoData.itens
      : [{
          materialNome: pedidoData.material,
          produtoId: pedidoData.produtoId,
          quantidade: pedidoData.quantidade,
          unidade: pedidoData.unidade || 'UN'
        }];

    const materiaisFormatados = itens.map(it => {
      const matCadastrado = this._materiais.find(m => Number(m.id) === Number(it.produtoId || it.id));
      const materialNome = it.materialNome || it.nome || matCadastrado?.nome || 'Material Solicitado';
      const unidade = it.unidade || matCadastrado?.unidade || 'UN';
      return {
        produtoId: it.produtoId || it.id,
        materialNome,
        quantidade: it.quantidade,
        unidade
      };
    });

    const itensNormalizados = itens.map(it => {
      const matCadastrado = this._materiais.find(m => Number(m.id) === Number(it.produtoId || it.id));
      return {
        ...it,
        materialNome: it.materialNome || it.nome || matCadastrado?.nome || 'Material Solicitado',
        unidade: it.unidade || matCadastrado?.unidade || 'UN'
      };
    });

    const resumoMaterial = materiaisFormatados.length === 1
      ? materiaisFormatados[0].materialNome
      : materiaisFormatados.map(m => `${m.materialNome} (${m.quantidade} ${m.unidade})`).join(', ');

    const urgenciaNormalizada = pedidoData.urgente || pedidoData.urgencia === 'alta' || pedidoData.prioridade === 'Urgente' || pedidoData.prioridade === 'alta'
      ? 'Urgente'
      : 'Normal';

    const novo = {
      id: nextId,
      usuario: pedidoData.usuario || user?.nome || user?.identifier || 'Carlos Silva',
      setor: pedidoData.setor || user?.setor || 'Educação Infantil',
      data: new Date().toLocaleDateString('pt-BR'),
      material: resumoMaterial,
      quantidade: itensNormalizados.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0),
      materiais: materiaisFormatados,
      itens: itensNormalizados,
      prioridade: urgenciaNormalizada,
      urgente: urgenciaNormalizada === 'Urgente',
      status: 'Pendente',
      justificativa: pedidoData.justificativa || null
    };

    this._pedidos = [novo, ...this._pedidos];
    safeSet(STORAGE_KEYS.PEDIDOS, this._pedidos);

    // Cria notificação associada
    this.addNotificacao({
      pedidoId: nextId,
      titulo: novo.urgente ? 'Pedido Urgente Registrado' : `Pedido #${nextId} Criado`,
      mensagem: `${resumoMaterial} enviado para o almoxarifado.`,
      tipo: novo.urgente ? 'urgente' : 'info'
    });

    return novo;
  }

  async updateStatusPedido(id, novoStatus, extras = {}) {
    const numId = Number(id);
    let atualizado = null;

    // Entrega: a baixa de estoque acontece junto com a mudança de situação, como na API
    // (bens duráveis não têm baixa; tratado em registrarMovimentacao).
    const statusTexto = String(novoStatus || '').toLowerCase();
    if (statusTexto.startsWith('atendido') && Array.isArray(extras.itens)) {
      const pedidoAtual = this._pedidos.find(p => Number(p.id) === numId);
      for (const it of extras.itens) {
        const qtdEntregue = it.quantidadeAtendida !== undefined ? Number(it.quantidadeAtendida) : Number(it.quantidade);
        const produtoId = it.produtoId || it.materialId;
        if (!produtoId || !(qtdEntregue > 0)) continue;
        await this.registrarMovimentacao({
          produtoId,
          produtoNome: it.materialNome,
          tipo: 'saida',
          quantidade: qtdEntregue,
          funcionarioNome: pedidoAtual?.usuario || 'Solicitante',
          observacao: `Atendimento do Pedido #${numId}`
        });
      }
    }
    this._pedidos = this._pedidos.map(p => {
      if (Number(p.id) === numId) {
        atualizado = {
          ...p,
          ...extras,
          status: novoStatus,
          id: numId
        };
        return atualizado;
      }
      return p;
    });
    safeSet(STORAGE_KEYS.PEDIDOS, this._pedidos);

    if (atualizado) {
      const isPronto = String(novoStatus).toLowerCase().includes('pronto');
      const isEntregue = String(novoStatus).toLowerCase().includes('atendido') || String(novoStatus).toLowerCase().includes('entregue');

      const tituloNotif = isPronto
        ? `Pedido #${numId} Pronto para Retirada!`
        : isEntregue
        ? `Pedido #${numId} Entregue`
        : `Pedido #${numId} Atualizado`;

      const msgNotif = extras.mensagemAlmoxarife
        ? extras.mensagemAlmoxarife
        : `Situação alterada para: ${novoStatus}.`;

      this.addNotificacao({
        pedidoId: numId,
        titulo: tituloNotif,
        mensagem: msgNotif,
        tipo: isEntregue ? 'sucesso' : (isPronto ? 'urgente' : 'info')
      });
    }

    return atualizado;
  }

  async cancelPedido(id) {
    return this.updateStatusPedido(id, 'cancelado');
  }

  // --- USUARIOS ---
  async getUsuarios() {
    return [...this._usuarios];
  }

  async createUsuario(payload) {
    const id = Math.max(0, ...this._usuarios.map(u => Number(u.id) || 0)) + 1;
    const novo = {
      id,
      nome: payload.nome,
      cpf: payload.cpf || null,
      email: payload.email,
      perfil: payload.perfil || 'Usuário',
      setor: payload.setor || 'Geral',
      ativo: payload.ativo !== undefined ? payload.ativo : true,
      inicial: (payload.nome || 'U').trim().charAt(0).toUpperCase(),
      dataCadastro: new Date().toLocaleDateString('pt-BR'),
      ramal: payload.ramal || payload.celular || '100'
    };
    this._usuarios = [novo, ...this._usuarios];
    safeSet(STORAGE_KEYS.USUARIOS, this._usuarios);
    return novo;
  }

  async updateUsuario(id, payload) {
    const numId = Number(id);
    let atualizado = null;
    this._usuarios = this._usuarios.map(u => {
      if (Number(u.id) === numId) {
        atualizado = {
          ...u,
          ...payload,
          id: numId,
          inicial: (payload.nome || u.nome).trim().charAt(0).toUpperCase()
        };
        return atualizado;
      }
      return u;
    });
    safeSet(STORAGE_KEYS.USUARIOS, this._usuarios);
    return atualizado || payload;
  }

  async toggleStatusUsuario(id) {
    const numId = Number(id);
    // Mesmo formato de perfil da API (o serviço do front converte para o rótulo da tela).
    const paraRole = (perfil) => ({ Administrativo: 'admin', Almoxarifado: 'almoxarife', 'Usuário': 'usuario' }[perfil] || perfil);
    let atualizado = null;
    this._usuarios = this._usuarios.map(u => {
      if (Number(u.id) === numId) {
        atualizado = { ...u, ativo: !u.ativo };
        return atualizado;
      }
      return u;
    });
    safeSet(STORAGE_KEYS.USUARIOS, this._usuarios);
    return atualizado && { ...atualizado, perfil: paraRole(atualizado.perfil) };
  }

  async deleteUsuario(id) {
    const numId = Number(id);
    let removido = null;
    this._usuarios = this._usuarios.map(u => {
      if (Number(u.id) !== numId) return u;
      removido = { ...u, ativo: false };
      return removido;
    });
    safeSet(STORAGE_KEYS.USUARIOS, this._usuarios);
    return removido;
  }

  // --- MOVIMENTAÇÕES ---
  async getMovimentacoes(params = {}) {
    let list = [...this._movimentacoes];
    if (params.tipo) {
      list = list.filter(m => m.tipo === params.tipo);
    }
    if (params.produtoId) {
      list = list.filter(m => Number(m.produtoId) === Number(params.produtoId));
    }
    return list;
  }

  async registrarMovimentacao({ produtoId, produtoNome, tipo, quantidade, observacao, funcionarioNome }) {
    const pId = Number(produtoId);
    const qtd = Number(quantidade) || 0;
    const mat = this._materiais.find(m => Number(m.id) === pId);
    const nomeFinal = produtoNome || mat?.nome || `Material #${pId}`;

    const nova = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      produtoId: pId,
      produtoNome: nomeFinal,
      tipo,
      quantidade: qtd,
      data: new Date().toISOString(),
      funcionarioNome: funcionarioNome || 'Almoxarife',
      observacao: observacao || `Registro de ${tipo}`
    };

    // Ajusta o saldo físico do material (bens duráveis não sofrem saída física em atendimentos)
    if (mat) {
      let novaQtd = Number(mat.quantidade || 0);
      if (tipo === 'entrada') {
        novaQtd += qtd;
      } else if (tipo === 'saida') {
        if (!mat.bemDuravel) {
          novaQtd = Math.max(0, novaQtd - qtd);
        }
      }
      mat.quantidade = novaQtd;
      safeSet(STORAGE_KEYS.MATERIAIS, this._materiais);
    }

    this._movimentacoes = [nova, ...this._movimentacoes];
    safeSet(STORAGE_KEYS.MOVIMENTACOES, this._movimentacoes);
    return nova;
  }

  async ajustarEstoque({ produtoId, novoSaldo, motivo }) {
    const pId = Number(produtoId);
    const saldo = Number(novoSaldo) || 0;
    const mat = this._materiais.find(m => Number(m.id) === pId);
    const saldoAnterior = mat ? Number(mat.quantidade || 0) : 0;
    const diferenca = saldo - saldoAnterior;

    if (mat) {
      mat.quantidade = saldo;
      safeSet(STORAGE_KEYS.MATERIAIS, this._materiais);
    }

    const nova = {
      id: `ajuste-${Date.now()}`,
      produtoId: pId,
      produtoNome: mat?.nome || `Material #${pId}`,
      tipo: 'ajuste',
      quantidade: Math.abs(diferenca),
      data: new Date().toISOString(),
      funcionarioNome: 'Almoxarife',
      observacao: motivo ? `Ajuste de inventário: ${motivo}` : 'Ajuste de inventário físico'
    };

    this._movimentacoes = [nova, ...this._movimentacoes];
    safeSet(STORAGE_KEYS.MOVIMENTACOES, this._movimentacoes);
    return nova;
  }

  // --- DASHBOARD ---
  async getDashboard() {
    const totalProdutos = this._materiais.length;
    const produtosEstoqueBaixo = this._materiais.filter(m => Number(m.quantidade ?? 0) <= Number(m.estoqueMinimo ?? 0)).length;
    const pedidosPendentes = this._pedidos.filter(p => String(p.status || '').toLowerCase() === 'pendente').length;
    const totalUsuarios = this._usuarios.length;

    return {
      totalProdutos,
      produtosEstoqueBaixo,
      pedidosPendentes,
      totalUsuarios
    };
  }

  // --- FAVORITOS ---
  async getFavoritos() {
    return [...this._favoritos];
  }

  async toggleFavorito(produtoId) {
    const id = Number(produtoId);
    if (this._favoritos.includes(id)) {
      this._favoritos = this._favoritos.filter(favId => favId !== id);
    } else {
      this._favoritos = [...this._favoritos, id];
    }
    safeSet(STORAGE_KEYS.FAVORITOS, this._favoritos);
    return this._favoritos;
  }

  // --- NOTIFICAÇÕES ---
  async getNotificacoes() {
    return [...this._notificacoes];
  }

  addNotificacao({ pedidoId, titulo, mensagem, tipo = 'info' }) {
    const nova = {
      id: `notif-${Date.now()}`,
      pedidoId,
      titulo,
      mensagem,
      tipo,
      tempo: 'Agora mesmo',
      lida: false,
      data: new Date().toISOString()
    };
    this._notificacoes = [nova, ...this._notificacoes];
    safeSet(STORAGE_KEYS.NOTIFICACOES, this._notificacoes);
    return nova;
  }

  async marcarNotificacaoLida(id) {
    this._notificacoes = this._notificacoes.map(n => n.id === id ? { ...n, lida: true } : n);
    safeSet(STORAGE_KEYS.NOTIFICACOES, this._notificacoes);
    return { success: true };
  }

  // --- REMESSAS ---
  async getRemessas() {
    return [...this._remessas];
  }

  async getRemessa(id) {
    return this._remessas.find(r => Number(r.id) === Number(id)) || null;
  }

  async createRemessa(remessa) {
    const id = Math.max(0, ...this._remessas.map(r => Number(r.id) || 0)) + 1;
    const numeroRemessa = remessa.numeroRemessa || `REM-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`;

    // O modal de recebimento envia um lote (itens[] com materialId/qtdRecebida), espelhando
    // recebimentos + recebimento_itens do banco. O formato legado de item único continua aceito.
    const itensBrutos = Array.isArray(remessa.itens) && remessa.itens.length > 0
      ? remessa.itens
      : [{ materialId: remessa.materialId, materialNome: remessa.materialNome, qtdRecebida: remessa.quantidade }];

    const itens = itensBrutos
      .map(it => {
        const materialId = Number(it.materialId ?? it.produtoId);
        const mat = this._materiais.find(m => Number(m.id) === materialId);
        return {
          materialId,
          materialNome: it.materialNome || it.nome || mat?.nome || `Material #${materialId}`,
          quantidade: Number(it.qtdRecebida ?? it.quantidade) || 0
        };
      })
      .filter(it => it.materialId && it.quantidade > 0);

    const nova = {
      id,
      numeroRemessa,
      tipoOrigem: remessa.tipoOrigem || null,
      documentoDoador: remessa.documentoDoador || '',
      itens,
      materialId: itens.length === 1 ? itens[0].materialId : undefined,
      materialNome: itens.map(it => it.materialNome).join(', '),
      quantidade: itens.reduce((acc, it) => acc + it.quantidade, 0),
      fornecedor: remessa.fornecedor || remessa.documentoDoador || 'Fornecedor Externo',
      destino: remessa.destino || 'Almoxarifado Central',
      dataEnvio: remessa.dataEnvio || new Date().toISOString().slice(0, 10),
      status: remessa.status || 'Concluído',
      observacao: remessa.observacao || ''
    };
    this._remessas = [nova, ...this._remessas];
    safeSet(STORAGE_KEYS.REMESSAS, this._remessas);

    // Entrada no estoque de cada material do lote
    for (const it of itens) {
      await this.registrarMovimentacao({
        produtoId: it.materialId,
        produtoNome: it.materialNome,
        tipo: 'entrada',
        quantidade: it.quantidade,
        observacao: `Remessa ${numeroRemessa} recebida`
      });
    }

    return nova;
  }

  // --- SETORES ---
  async getSetores() {
    return [...this._setores];
  }

  async createSetor(nome) {
    if (!this._setores.includes(nome)) {
      this._setores = [...this._setores, nome];
      safeSet(STORAGE_KEYS.SETORES, this._setores);
    }
    return { nome };
  }

  // --- AUTENTICAÇÃO ---
  async login({ email, senha, rememberMe = false, role = 'admin' }) {
    const normalizedRole = (role === 'almoxarifado' || role === 'almoxarife')
      ? 'almoxarife'
      : (role === 'usuario' || role === 'funcionario')
        ? 'usuario'
        : 'admin';

    // Se o email coincidir com algum dos usuários mock, assume os dados dele
    // Login aceita e-mail ou CPF (campo "E-mail ou CPF" da tela de login).
    const identificador = String(email || '').trim().toLowerCase();
    const cpfDigitos = identificador.replace(/\D/g, '');
    const demoUser = identificador ? this._usuarios.find(u =>
      (u.email && u.email.toLowerCase() === identificador) ||
      (cpfDigitos.length === 11 && u.cpf && String(u.cpf).replace(/\D/g, '') === cpfDigitos)
    ) : undefined;

    // Perfil pode estar no rótulo da UI ('Almoxarifado') ou no valor do banco ('almoxarifado').
    let perfilFinal = normalizedRole;
    if (demoUser) {
      const perfil = String(demoUser.perfil || '').toLowerCase();
      if (perfil === 'almoxarifado' || perfil === 'almoxarife') perfilFinal = 'almoxarife';
      else if (perfil === 'administrativo' || perfil === 'admin') perfilFinal = 'admin';
      else perfilFinal = 'usuario';
    }

    const usuario = {
      id: demoUser?.id || (perfilFinal === 'admin' ? 7 : perfilFinal === 'almoxarife' ? 6 : 1),
      nome: demoUser?.nome || (perfilFinal === 'admin' ? 'Arthur Vequi (Administrador)' : perfilFinal === 'almoxarife' ? 'Ana Beatriz (Almoxarife)' : 'Carlos Silva (Usuário)'),
      email: email || demoUser?.email || `${perfilFinal}@estacao.org.br`,
      identifier: email || demoUser?.email || `${perfilFinal}@estacao.org.br`,
      role: perfilFinal,
      setor: demoUser?.setor || (perfilFinal === 'admin' ? 'Diretoria / TI' : perfilFinal === 'almoxarife' ? 'Almoxarifado Central' : 'Educação Infantil'),
      rememberMe,
      isStandalone: true
    };

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('sge_user', JSON.stringify(usuario));
    storage.setItem('sge_token', 'mock_jwt_token_standalone');
    return usuario;
  }

  async logout() {
    localStorage.removeItem('sge_user');
    localStorage.removeItem('sge_token');
    sessionStorage.removeItem('sge_user');
    sessionStorage.removeItem('sge_token');
    return { success: true };
  }
}

export const mockStore = new MockDataStore();
