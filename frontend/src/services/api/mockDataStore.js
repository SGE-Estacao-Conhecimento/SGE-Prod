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
      localizacao: payload.localizacao || 'Almoxarifado Central',
      descricao: payload.descricao || '',
      ativo: true
    };
    this._materiais = [novo, ...this._materiais];
    safeSet(STORAGE_KEYS.MATERIAIS, this._materiais);

    // Registra movimentação inicial caso tenha quantidade > 0
    if (novo.quantidade > 0) {
      this.registrarMovimentacao({
        produtoId: novo.id,
        produtoNome: novo.nome,
        tipo: 'entrada',
        quantidade: novo.quantidade,
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

  async deleteMaterial(id) {
    const numId = Number(id);
    this._materiais = this._materiais.filter(m => Number(m.id) !== numId);
    safeSet(STORAGE_KEYS.MATERIAIS, this._materiais);
    return { success: true };
  }

  // --- PEDIDOS ---
  async getPedidos(status = '') {
    if (!status) return [...this._pedidos];
    const s = String(status).toLowerCase();
    return this._pedidos.filter(p => String(p.status || '').toLowerCase() === s);
  }

  async getMeusPedidos(user) {
    const nomeOuEmail = (user?.identifier || user?.email || user?.nome || '').toLowerCase();
    if (!nomeOuEmail) return [...this._pedidos];
    return this._pedidos.filter(p => {
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

    const materiaisFormatados = itens.map(it => ({
      materialNome: it.materialNome || it.nome,
      quantidade: it.quantidade,
      unidade: it.unidade || 'UN'
    }));

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
      quantidade: itens.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0),
      materiais: materiaisFormatados,
      itens,
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

  async updateStatusPedido(id, novoStatus) {
    const numId = Number(id);
    let atualizado = null;
    this._pedidos = this._pedidos.map(p => {
      if (Number(p.id) === numId) {
        atualizado = { ...p, status: novoStatus };
        return atualizado;
      }
      return p;
    });
    safeSet(STORAGE_KEYS.PEDIDOS, this._pedidos);

    if (atualizado) {
      this.addNotificacao({
        pedidoId: numId,
        titulo: `Pedido #${numId} Atualizado`,
        mensagem: `Situação alterada para: ${novoStatus}.`,
        tipo: novoStatus.toLowerCase() === 'atendido' ? 'sucesso' : 'info'
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
    let atualizado = null;
    this._usuarios = this._usuarios.map(u => {
      if (Number(u.id) === numId) {
        atualizado = { ...u, ativo: !u.ativo };
        return atualizado;
      }
      return u;
    });
    safeSet(STORAGE_KEYS.USUARIOS, this._usuarios);
    return atualizado;
  }

  async deleteUsuario(id) {
    const numId = Number(id);
    this._usuarios = this._usuarios.map(u => {
      if (Number(u.id) === numId) return { ...u, ativo: false };
      return u;
    });
    safeSet(STORAGE_KEYS.USUARIOS, this._usuarios);
    return { success: true };
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

    // Ajusta o saldo físico do material
    if (mat) {
      let novaQtd = Number(mat.quantidade || 0);
      if (tipo === 'entrada') novaQtd += qtd;
      else if (tipo === 'saida') novaQtd = Math.max(0, novaQtd - qtd);
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

  async createRemessa(remessa) {
    const id = Math.max(0, ...this._remessas.map(r => Number(r.id) || 0)) + 1;
    const nova = {
      id,
      numeroRemessa: remessa.numeroRemessa || `REM-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`,
      materialId: remessa.materialId,
      materialNome: remessa.materialNome,
      quantidade: Number(remessa.quantidade) || 0,
      fornecedor: remessa.fornecedor || 'Fornecedor Externo',
      destino: remessa.destino || 'Almoxarifado Central',
      dataEnvio: remessa.dataEnvio || new Date().toISOString().slice(0, 10),
      status: remessa.status || 'Concluído',
      observacao: remessa.observacao || ''
    };
    this._remessas = [nova, ...this._remessas];
    safeSet(STORAGE_KEYS.REMESSAS, this._remessas);

    // Dando entrada no estoque do material
    if (nova.materialId && nova.quantidade > 0) {
      await this.registrarMovimentacao({
        produtoId: nova.materialId,
        produtoNome: nova.materialNome,
        tipo: 'entrada',
        quantidade: nova.quantidade,
        observacao: `Remessa ${nova.numeroRemessa} recebida`
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
    const demoUser = this._usuarios.find(u =>
      email && u.email.toLowerCase() === email.toLowerCase()
    );

    let perfilFinal = normalizedRole;
    if (demoUser) {
      if (demoUser.perfil === 'Almoxarifado') perfilFinal = 'almoxarife';
      else if (demoUser.perfil === 'Administrativo') perfilFinal = 'admin';
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
