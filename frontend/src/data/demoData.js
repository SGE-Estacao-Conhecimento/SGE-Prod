/**
 * Dados demonstrativos usados somente quando o backend não está disponível
 * no bypass de desenvolvimento. Este arquivo nunca é persistido.
 */
export const DEMO_MATERIAIS = [
  { id: 1, codigo: 'MAT-001', nome: 'Papel Sulfite A4', categoria: 'Escritório', unidade: 'Resma', itensPorEmbalagem: 500, quantidade: 48, estoqueMinimo: 10, descricao: '75g/m², resma com 500 folhas', complexo: 'Almoxarifado Central', locacao: 'Corredor A', localizacao: 'Armário A - Prateleira 2', dataValidade: null },
  { id: 2, codigo: 'MAT-002', nome: 'Caneta Esferográfica Azul', categoria: 'Escritório', unidade: 'UN', quantidade: 120, estoqueMinimo: 30, descricao: 'Ponta média 1.0mm', complexo: 'Almoxarifado Central', locacao: 'Corredor 1', localizacao: 'Gaveteiro 1', dataValidade: null },
  { id: 3, codigo: 'MAT-003', nome: 'Marcador para Quadro Branco', categoria: 'Material Didático', unidade: 'UN', quantidade: 18, estoqueMinimo: 15, descricao: 'Cores azul e preta', complexo: 'Complexo Educacional', locacao: 'Armário B', localizacao: 'Prat. 01', dataValidade: null },
  { id: 4, codigo: 'MAT-004', nome: 'Álcool em Gel 70%', categoria: 'Limpeza e Higiene', unidade: 'Frasco', quantidade: 35, estoqueMinimo: 8, descricao: 'Frasco de 500ml', complexo: 'Almoxarifado Central', locacao: 'Nicho Farmácia', localizacao: 'Prat. 02', dataValidade: '2027-06-30' },
  { id: 5, codigo: 'MAT-005', nome: 'Grampeador de Mesa', categoria: 'Escritório', unidade: 'UN', quantidade: 6, estoqueMinimo: 5, descricao: 'Modelo médio para até 25 folhas', complexo: 'Almoxarifado Central', locacao: 'Corredor A', localizacao: 'Prateleira 3', dataValidade: null },
  { id: 6, codigo: 'MAT-006', nome: 'Fita Adesiva Transparente', categoria: 'Escritório', unidade: 'Rolo', quantidade: 0, estoqueMinimo: 10, descricao: '45mm x 50 metros', complexo: 'Almoxarifado Central', locacao: 'Caixas Insumos', localizacao: 'Caixa de Fitas', dataValidade: null },
  { id: 7, codigo: 'MAT-007', nome: 'Cabo HDMI 2.0', categoria: 'Informática / TI', unidade: 'UN', quantidade: 8, estoqueMinimo: 3, descricao: '2 metros, compatível com 4K', complexo: 'Almoxarifado Central', locacao: 'Setor TI', localizacao: 'Armário TI', dataValidade: null },
  { id: 8, codigo: 'MAT-008', nome: 'Apagador para Quadro Branco', categoria: 'Material Didático', unidade: 'UN', quantidade: 0, estoqueMinimo: 6, descricao: 'Corpo anatômico', complexo: 'Complexo Educacional', locacao: 'Armário B', localizacao: 'Prat. 02', dataValidade: null },
  { id: 9, codigo: 'MAT-009', nome: 'Giz Escolar Plastificado', categoria: 'Material Didático', unidade: 'Caixa', itensPorEmbalagem: 50, quantidade: 22, estoqueMinimo: 8, descricao: 'Caixa com 50 unidades', complexo: 'Complexo Educacional', locacao: 'Armário A', localizacao: 'Prat. 01', dataValidade: null },
  { id: 10, codigo: 'MAT-010', nome: 'Papel Toalha Interfolhado', categoria: 'Limpeza e Higiene', unidade: 'Fardo', itensPorEmbalagem: 1000, quantidade: 14, estoqueMinimo: 5, descricao: 'Fardo com 1000 folhas', complexo: 'Depósito de Limpeza', locacao: 'Pallet 03', localizacao: 'Fila B', dataValidade: null },
  { id: 11, codigo: 'MAT-011', nome: 'Protetor Solar FPS 50', categoria: 'Limpeza e Higiene', unidade: 'Frasco', quantidade: 25, estoqueMinimo: 10, descricao: 'Frasco 120ml proteção UVA/UVB', complexo: 'Almoxarifado Central', locacao: 'Nicho Farmácia', localizacao: 'Prat. 01', dataValidade: '2026-12-15' }
];

export const DEMO_USUARIOS = [
  { id: 1, nome: 'Carlos Silva', email: 'carlos.silva@estacao.org.br', perfil: 'Usuário', setor: 'Educação Infantil', ativo: true, inicial: 'C', dataCadastro: '10/02/2026', ramal: '104' },
  { id: 2, nome: 'Mariana Costa', email: 'mariana.costa@estacao.org.br', perfil: 'Usuário', setor: 'Ensino Fundamental', ativo: true, inicial: 'M', dataCadastro: '12/02/2026', ramal: '108' },
  { id: 3, nome: 'Roberto Souza', email: 'roberto.souza@estacao.org.br', perfil: 'Usuário', setor: 'Coordenação', ativo: true, inicial: 'R', dataCadastro: '05/01/2026', ramal: '101' },
  { id: 4, nome: 'Juliana Dias', email: 'juliana.dias@estacao.org.br', perfil: 'Usuário', setor: 'Educação Infantil', ativo: true, inicial: 'J', dataCadastro: '18/02/2026', ramal: '105' },
  { id: 5, nome: 'Marcos Andrade', email: 'marcos.andrade@estacao.org.br', perfil: 'Usuário', setor: 'Apoio / Limpeza', ativo: true, inicial: 'M', dataCadastro: '20/01/2026', ramal: '112' },
  { id: 6, nome: 'Ana Beatriz', email: 'ana.beatriz@estacao.org.br', perfil: 'Almoxarifado', setor: 'Almoxarifado Central', ativo: true, inicial: 'A', dataCadastro: '02/01/2026', ramal: '100' },
  { id: 7, nome: 'Arthur Vequi', email: 'arthur.vequi@estacao.org.br', perfil: 'Administrativo', setor: 'Diretoria / TI', ativo: true, inicial: 'A', dataCadastro: '01/01/2026', ramal: '102' },
  { id: 8, nome: 'Fernanda Lima', email: 'fernanda.lima@estacao.org.br', perfil: 'Usuário', setor: 'Ensino Fundamental', ativo: true, inicial: 'F', dataCadastro: '15/03/2026', ramal: '109' }
];

export const DEMO_PEDIDOS = [
  { id: 102, usuario: 'Carlos Silva', setor: 'Educação Infantil', data: '27/09/2026', material: 'Álcool em Gel 70%', quantidade: 3, prioridade: 'Urgente', status: 'Pendente', justificativa: 'Urgência sanitária para as salas e refeitório' },
  { id: 101, usuario: 'Mariana Costa', setor: 'Ensino Fundamental', data: '26/09/2026', material: 'Papel Sulfite A4', quantidade: 2, prioridade: 'Normal', status: 'Pendente', justificativa: 'Impressão das atividades pedagógicas' },
  { id: 100, usuario: 'Roberto Souza', setor: 'Coordenação', data: '25/09/2026', material: 'Caneta Esferográfica Azul', quantidade: 10, prioridade: 'Normal', status: 'Pendente', justificativa: 'Reposição de materiais da coordenação' },
  { id: 98, usuario: 'Juliana Dias', setor: 'Educação Infantil', data: '24/09/2026', material: 'Marcador para Quadro Branco', quantidade: 4, prioridade: 'Normal', status: 'Atendido', justificativa: 'Uso diário em sala de aula' }
];

export const DEMO_MOVIMENTACOES = [
  { id: 'demo-mov-1', produtoId: 1, produtoNome: 'Papel Sulfite A4', tipo: 'entrada', quantidade: 20, data: '2026-09-30T09:30:00', funcionarioNome: 'Almoxarife', observacao: 'Recebimento de material' },
  { id: 'demo-mov-2', produtoId: 1, produtoNome: 'Papel Sulfite A4', tipo: 'saida', quantidade: 4, data: '2026-09-29T16:15:00', funcionarioNome: 'Prof. Carlos', observacao: 'Atendimento do Pedido #101' },
  { id: 'demo-mov-3', produtoId: 2, produtoNome: 'Caneta Esferográfica Azul', tipo: 'saida', quantidade: 10, data: '2026-09-28T08:20:00', funcionarioNome: 'Coordenação', observacao: 'Consumo interno' },
  { id: 'demo-mov-4', produtoId: 3, produtoNome: 'Marcador para Quadro Branco', tipo: 'ajuste', quantidade: 2, data: '2026-09-27T11:00:00', funcionarioNome: 'Almoxarife', observacao: 'Ajuste de inventário físico' },
  { id: 'demo-mov-5', produtoId: 4, produtoNome: 'Álcool em Gel 70%', tipo: 'entrada', quantidade: 15, data: '2026-09-26T14:00:00', funcionarioNome: 'Almoxarife', observacao: 'Compra emergencial' }
];
