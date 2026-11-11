import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BottomSheetModal, QuantityStepper, SegmentedTabs } from '../common';
import './NovoPedidoModal.css';

/**
 * NovoPedidoModal — Cadastro Rápido de Pedido pelo Almoxarifado ou Administrativo
 *
 * Totalmente padronizado com o Design System do SGE:
 * - Baseado no BottomSheetModal oficial (acessibilidade, física de mola, responsivo).
 * - Escolha entre Material de Consumo e Patrimônio / Bem Durável.
 * - Opção de entrega imediata (baixa direta no histórico) exclusiva para Consumo pelo almoxarife.
 * - Seleção inteligente de solicitante vinculado ao setor e ramal.
 * - Busca de materiais filtrada pelo tipo escolhido e exibição do saldo físico disponível.
 */
const NovoPedidoModal = ({
  isOpen,
  onClose,
  onSave,
  initialData = null,
  materiaisDisponiveis = [],
  usuariosDisponiveis = [],
  userRole = 'almoxarife'
}) => {
  const isAlmoxarife = userRole === 'almoxarife' || userRole === 'almoxarifado';

  const [tipoPedido, setTipoPedido] = useState('consumo');
  const [entregaImediata, setEntregaImediata] = useState(isAlmoxarife);
  const [avisoTrocaTipo, setAvisoTrocaTipo] = useState('');
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState('');
  const [usuarioNomeCustom, setUsuarioNomeCustom] = useState('');
  const [setorCustom, setSetorCustom] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [itens, setItens] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Busca e Autocomplete de Materiais
  const [buscaMaterial, setBuscaMaterial] = useState('');
  const [isDropdownAberto, setIsDropdownAberto] = useState(false);
  const [erro, setErro] = useState('');
  const dropdownRef = useRef(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Lista normalizada de materiais para seleção
  const listaMateriais = useMemo(() => {
    return (materiaisDisponiveis || []).map((m, idx) => ({
      id: m.id || idx + 1,
      codigo: m.codigo || `MAT-${String(m.id || idx + 1).padStart(3, '0')}`,
      nome: m.nome || m.materialNome || 'Material',
      unidade: m.unidade || 'UN',
      quantidade: typeof m.quantidade === 'number' ? m.quantidade : Number(m.quantidade) || 0,
      complexo: m.complexo || 'Almoxarifado Central',
      localizacao: m.localizacao || '',
      bemDuravel: Boolean(m.bemDuravel)
    }));
  }, [materiaisDisponiveis]);

  const ehTipoPatrimonio = tipoPedido === 'patrimonio';
  const entregaImediataAtiva = isAlmoxarife && !ehTipoPatrimonio && entregaImediata && !initialData;

  // Apenas materiais compatíveis com o tipo de pedido escolhido
  const materiaisDoTipo = useMemo(() => {
    return listaMateriais.filter((m) => (ehTipoPatrimonio ? m.bemDuravel : !m.bemDuravel));
  }, [listaMateriais, ehTipoPatrimonio]);

  // Filtro de materiais pelo termo de busca
  const materiaisFiltrados = useMemo(() => {
    if (!buscaMaterial.trim()) return materiaisDoTipo.slice(0, 8);
    const termo = buscaMaterial.toLowerCase().trim();
    return materiaisDoTipo.filter(m =>
      m.nome.toLowerCase().includes(termo) ||
      m.codigo.toLowerCase().includes(termo) ||
      (m.localizacao && m.localizacao.toLowerCase().includes(termo)) ||
      (m.complexo && m.complexo.toLowerCase().includes(termo))
    ).slice(0, 10);
  }, [materiaisDoTipo, buscaMaterial]);

  // Lista de usuários para seleção
  const listaUsuarios = useMemo(() => {
    return (usuariosDisponiveis || []).filter(u => u.ativo !== false);
  }, [usuariosDisponiveis]);

  // Inicializa dados ao abrir
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      const uEncontrado = listaUsuarios.find(
        u => u.nome?.toLowerCase() === initialData.usuario?.toLowerCase()
      );
      if (uEncontrado) {
        setUsuarioSelecionadoId(String(uEncontrado.id));
        setUsuarioNomeCustom('');
        setSetorCustom('');
      } else {
        setUsuarioSelecionadoId('custom');
        setUsuarioNomeCustom(initialData.usuario || '');
        setSetorCustom(initialData.setor || '');
      }

      setUrgente(initialData.urgente || String(initialData.prioridade).toLowerCase() === 'urgente');
      setJustificativa(initialData.justificativa || '');

      const itensIniciais = Array.isArray(initialData.itens) && initialData.itens.length > 0
        ? initialData.itens
        : Array.isArray(initialData.materiais) && initialData.materiais.length > 0
        ? initialData.materiais
        : initialData.material
        ? [{ materialNome: initialData.material, quantidade: initialData.quantidade || 1, unidade: 'UN' }]
        : [];

      const itensNormalizados = itensIniciais.map((it, idx) => {
        const mat = listaMateriais.find(m => m.id === it.produtoId || m.nome.toLowerCase() === (it.materialNome || it.nome)?.toLowerCase());
        return {
          produtoId: it.produtoId || mat?.id || idx + 1,
          materialNome: it.materialNome || it.nome || mat?.nome || 'Material',
          quantidade: Number(it.quantidade) || 1,
          unidade: it.unidade || mat?.unidade || 'UN',
          saldo: mat ? mat.quantidade : 999,
          bemDuravel: Boolean(it.bemDuravel || mat?.bemDuravel)
        };
      });

      const possuiPatrimonio =
        initialData.tipoPedido === 'patrimonio' || itensNormalizados.some((it) => it.bemDuravel);
      setTipoPedido(possuiPatrimonio ? 'patrimonio' : 'consumo');
      setEntregaImediata(false);
      setItens(itensNormalizados);
    } else {
      setUsuarioSelecionadoId(listaUsuarios.length > 0 ? String(listaUsuarios[0].id) : 'custom');
      setUsuarioNomeCustom('');
      setSetorCustom('');
      setUrgente(false);
      setJustificativa('');
      setTipoPedido('consumo');
      setEntregaImediata(isAlmoxarife);
      setItens([]);
    }
    setAvisoTrocaTipo('');
    setBuscaMaterial('');
    setIsDropdownAberto(false);
    setErro('');
    setSubmitting(false);
  }, [isOpen, initialData, listaUsuarios, listaMateriais, isAlmoxarife]);

  if (!isOpen) return null;

  const handleTrocarTipoPedido = (novoTipo) => {
    if (novoTipo === tipoPedido) return;
    setTipoPedido(novoTipo);
    if (novoTipo === 'patrimonio') {
      setEntregaImediata(false);
    } else {
      setEntregaImediata(isAlmoxarife && !initialData);
    }
    if (itens.length > 0) {
      setItens([]);
      setAvisoTrocaTipo(
        `Lista limpa ao alternar para ${novoTipo === 'patrimonio' ? 'Patrimônio' : 'Material de Consumo'}, pois os dois tipos não podem ser misturados no mesmo pedido.`
      );
    } else {
      setAvisoTrocaTipo('');
    }
    setBuscaMaterial('');
    setIsDropdownAberto(false);
    setErro('');
  };

  // Adiciona material selecionado à lista do pedido
  const handleAdicionarMaterial = (mat) => {
    if (entregaImediataAtiva && mat.quantidade <= 0) {
      setErro(`O material "${mat.nome}" não possui saldo disponível para entrega imediata.`);
      return;
    }

    setItens(prev => {
      const indexExistente = prev.findIndex(it => it.produtoId === mat.id);
      if (indexExistente >= 0) {
        const atual = prev[indexExistente];
        const teto = entregaImediataAtiva
          ? mat.quantidade
          : (mat.quantidade > 0 ? mat.quantidade : 9999);
        const novaQtd = Math.min(teto, atual.quantidade + 1);
        const atualizados = [...prev];
        atualizados[indexExistente] = { ...atual, quantidade: novaQtd };
        return atualizados;
      }
      return [
        ...prev,
        {
          produtoId: mat.id,
          materialNome: mat.nome,
          quantidade: 1,
          unidade: mat.unidade || 'UN',
          saldo: mat.quantidade,
          bemDuravel: Boolean(mat.bemDuravel)
        }
      ];
    });

    setBuscaMaterial('');
    setIsDropdownAberto(false);
    setAvisoTrocaTipo('');
    setErro('');
  };

  const handleUpdateQtd = (index, novaQtd) => {
    setItens(prev => {
      const atualizados = [...prev];
      atualizados[index] = { ...atualizados[index], quantidade: Math.max(1, novaQtd) };
      return atualizados;
    });
    setErro('');
  };

  const handleRemoverItem = (index) => {
    setItens(prev => prev.filter((_, i) => i !== index));
    setErro('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    let solicitanteId = null;
    let solicitanteNome = '';
    let solicitanteSetor = '';

    if (usuarioSelecionadoId === 'custom') {
      if (listaUsuarios.length > 0 && !initialData) {
        setErro('Selecione um colaborador cadastrado como solicitante.');
        return;
      }
      if (!usuarioNomeCustom.trim()) {
        setErro('Informe o nome do solicitante.');
        return;
      }
      solicitanteNome = usuarioNomeCustom.trim();
      solicitanteSetor = setorCustom.trim() || 'Geral';
    } else {
      const u = listaUsuarios.find(item => String(item.id) === String(usuarioSelecionadoId));
      if (!u) {
        setErro('Selecione um solicitante.');
        return;
      }
      solicitanteId = u.id;
      solicitanteNome = u.nome;
      solicitanteSetor = u.setor || 'Geral';
    }

    if (itens.length === 0) {
      setErro('Adicione pelo menos 1 material ao pedido.');
      return;
    }

    if (entregaImediataAtiva) {
      const insuficiente = itens.find((it) => Number(it.quantidade) > Number(it.saldo ?? 0));
      if (insuficiente) {
        setErro(
          `Saldo insuficiente para entrega imediata de ${insuficiente.materialNome} (disponível: ${insuficiente.saldo ?? 0} ${insuficiente.unidade}). Reduza a quantidade ou desmarque a baixa imediata.`
        );
        return;
      }
    }

    if (!justificativa.trim()) {
      setErro('Informe a finalidade ou justificativa do pedido.');
      return;
    }

    const payload = {
      ...(initialData?.id ? { id: initialData.id } : { id: Date.now() }),
      solicitanteId,
      usuario: solicitanteNome,
      setor: solicitanteSetor,
      data: initialData?.data || new Date().toLocaleDateString('pt-BR'),
      prioridade: urgente ? 'Urgente' : 'Normal',
      urgente,
      justificativa: justificativa.trim(),
      tipoPedido,
      entregaImediata: entregaImediataAtiva,
      status: initialData?.status || 'Pendente',
      itens: itens.map(it => ({
        produtoId: it.produtoId,
        materialNome: it.materialNome,
        quantidade: it.quantidade,
        unidade: it.unidade,
        bemDuravel: Boolean(it.bemDuravel)
      }))
    };

    try {
      setSubmitting(true);
      const resultado = await onSave(payload);
      if (resultado !== false) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const usuarioAtual = listaUsuarios.find(u => String(u.id) === String(usuarioSelecionadoId));

  const textoBotaoSubmit = submitting
    ? 'Registrando...'
    : initialData
    ? 'Salvar Alterações'
    : entregaImediataAtiva
    ? 'Registrar e Dar Baixa'
    : ehTipoPatrimonio
    ? 'Enviar p/ Administrativo'
    : 'Criar Pedido';

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? `Editar Pedido #${initialData.id}` : 'Novo Pedido de Material'}
      subtitle={isAlmoxarife ? 'Balcão de Atendimento' : 'Solicitação Interna'}
      maxWidth="580px"
      badge={
        urgente ? (
          <span className="novo-pedido-badge-urgente">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Urgência Ativada
          </span>
        ) : null
      }
      footer={
        <div className="novo-pedido-footer">
          <button
            type="button"
            className="novo-pedido-btn-cancel"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="form-novo-pedido-almoxarife"
            disabled={submitting}
            className={`novo-pedido-btn-submit ${urgente ? 'novo-pedido-btn-submit--urgente' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {textoBotaoSubmit}
          </button>
        </div>
      }
    >
      <form id="form-novo-pedido-almoxarife" onSubmit={handleSubmit} className="novo-pedido-form">
        {erro && (
          <div className="novo-pedido-erro-banner" role="alert">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{erro}</span>
          </div>
        )}

        {/* 0. TIPO DE PEDIDO E REGRA DE BAIXA / APROVAÇÃO */}
        <div className="novo-pedido-section">
          <label className="novo-pedido-label">Tipo de Pedido</label>
          <SegmentedTabs
            tabs={[
              { id: 'consumo', label: 'Material de Consumo' },
              { id: 'patrimonio', label: 'Patrimônio' }
            ]}
            activeTab={tipoPedido}
            onChange={handleTrocarTipoPedido}
            layoutId="novoPedidoTipoTabs"
            size="sm"
            ariaLabel="Tipo de pedido"
          />

          {ehTipoPatrimonio && (
            <div className="novo-pedido-info-banner novo-pedido-info-banner--patrimonio">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                Pedidos de patrimônio vão primeiro para autorização do Administrativo antes da separação e não realizam baixa automática no estoque.
              </span>
            </div>
          )}

          {isAlmoxarife && !ehTipoPatrimonio && !initialData && (
            <label className="novo-pedido-baixa-card">
              <input
                type="checkbox"
                className="novo-pedido-baixa-checkbox"
                checked={entregaImediata}
                onChange={(e) => {
                  setEntregaImediata(e.target.checked);
                  setErro('');
                }}
              />
              <div className="novo-pedido-baixa-copy">
                <span className="novo-pedido-baixa-title">
                  Entregar agora (ir para o histórico e baixar estoque)
                </span>
                <span className="novo-pedido-baixa-desc">
                  {entregaImediata
                    ? 'Conclui o pedido diretamente como Atendido no histórico com débito imediato de saldo.'
                    : 'Registra como Pendente na fila para seguir o fluxo de separação.'}
                </span>
              </div>
            </label>
          )}

          {avisoTrocaTipo && (
            <div className="novo-pedido-info-banner novo-pedido-info-banner--aviso" role="status">
              <span>{avisoTrocaTipo}</span>
            </div>
          )}
        </div>

        {/* 1. SELEÇÃO DE SOLICITANTE */}
        <div className="novo-pedido-section">
          <label className="novo-pedido-label" htmlFor="select-solicitante-almox">
            Solicitante do Pedido <span className="campo-obrigatorio">*</span>
          </label>
          <div className="novo-pedido-solicitante-row">
            <select
              id="select-solicitante-almox"
              className="novo-pedido-select"
              value={usuarioSelecionadoId}
              onChange={(e) => setUsuarioSelecionadoId(e.target.value)}
            >
              {listaUsuarios.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nome} - {u.setor || 'Geral'}{u.ramal ? ` (Ramal ${u.ramal})` : ''}
                </option>
              ))}
              {(listaUsuarios.length === 0 || usuarioSelecionadoId === 'custom') && (
                <option value="custom">Outro colaborador (digitar)...</option>
              )}
            </select>
          </div>

          {usuarioSelecionadoId === 'custom' && (
            <div className="novo-pedido-custom-user-grid">
              <div>
                <label className="novo-pedido-sublabel">Nome Completo</label>
                <input
                  type="text"
                  className="novo-pedido-input"
                  placeholder="Ex: João da Silva"
                  value={usuarioNomeCustom}
                  onChange={(e) => setUsuarioNomeCustom(e.target.value)}
                />
              </div>
              <div>
                <label className="novo-pedido-sublabel">Setor</label>
                <input
                  type="text"
                  className="novo-pedido-input"
                  placeholder="Ex: Manutenção"
                  value={setorCustom}
                  onChange={(e) => setSetorCustom(e.target.value)}
                />
              </div>
            </div>
          )}

          {usuarioAtual && usuarioSelecionadoId !== 'custom' && (
            <div className="novo-pedido-solicitante-card">
              <div className="novo-pedido-user-avatar">
                {usuarioAtual.inicial || usuarioAtual.nome?.charAt(0) || 'U'}
              </div>
              <div className="novo-pedido-user-meta">
                <span className="novo-pedido-user-name">{usuarioAtual.nome}</span>
                <span className="novo-pedido-user-sub">
                  {usuarioAtual.setor || 'Geral'}{usuarioAtual.ramal ? ` | Ramal ${usuarioAtual.ramal}` : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. ADIÇÃO DE MATERIAIS COM SALDO REAL */}
        <div className="novo-pedido-section">
          <label className="novo-pedido-label">
            {ehTipoPatrimonio ? 'Itens de Patrimônio Solicitados' : 'Materiais Solicitados'}{' '}
            <span className="campo-obrigatorio">*</span>
          </label>

          {/* Campo de Busca / Autocomplete */}
          <div className="novo-pedido-search-wrap" ref={dropdownRef}>
            <div className="novo-pedido-input-icon-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="novo-pedido-search-icon">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="novo-pedido-search-input"
                placeholder={
                  ehTipoPatrimonio
                    ? 'Buscar bem durável por nome, código ou localização...'
                    : 'Buscar material por nome, código ou prateleira...'
                }
                value={buscaMaterial}
                onFocus={() => setIsDropdownAberto(true)}
                onChange={(e) => {
                  setBuscaMaterial(e.target.value);
                  setIsDropdownAberto(true);
                }}
              />
            </div>

            {/* Dropdown de Resultados com Saldo Físico */}
            {isDropdownAberto && (
              <div className="novo-pedido-dropdown">
                {materiaisFiltrados.length === 0 ? (
                  <div className="novo-pedido-dropdown-empty">
                    {ehTipoPatrimonio
                      ? 'Nenhum item de patrimônio encontrado no estoque.'
                      : 'Nenhum material de consumo encontrado no estoque.'}
                  </div>
                ) : (
                  materiaisFiltrados.map(mat => {
                    const temSaldo = mat.quantidade > 0;
                    const bloqueadoPorSaldo = entregaImediataAtiva && !temSaldo;
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        disabled={bloqueadoPorSaldo}
                        className={`novo-pedido-dropdown-item ${bloqueadoPorSaldo ? 'novo-pedido-dropdown-item--disabled' : ''}`}
                        onClick={() => handleAdicionarMaterial(mat)}
                      >
                        <div className="novo-pedido-item-main">
                          <span className="novo-pedido-item-sku">{mat.codigo}</span>
                          <span className="novo-pedido-item-nome">{mat.nome}</span>
                          <span className="novo-pedido-item-loc">
                            {[mat.complexo, mat.localizacao].filter(Boolean).join(' - ')}
                          </span>
                        </div>

                        <div className="novo-pedido-item-stock">
                          <span className={`novo-pedido-saldo-badge ${temSaldo ? 'saldo--ok' : 'saldo--zero'}`}>
                            {temSaldo
                              ? `Saldo: ${mat.quantidade} ${mat.unidade}`
                              : bloqueadoPorSaldo
                              ? 'Sem saldo p/ baixa'
                              : 'Sem estoque'}
                          </span>
                          <span className="novo-pedido-add-icon">+</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Lista de Itens Adicionados (Layout Padronizado com a Caderneta do Usuário) */}
          {itens.length === 0 ? (
            <div className="novo-pedido-itens-vazio">
              <span>
                {ehTipoPatrimonio
                  ? 'Nenhum item de patrimônio adicionado ainda. Utilize a busca acima.'
                  : 'Nenhum material adicionado ainda. Utilize a busca acima.'}
              </span>
            </div>
          ) : (
            <div className="caderneta-itens-scroll novo-pedido-itens-lista">
              <AnimatePresence initial={false}>
                {itens.map((it, idx) => {
                  const excedeSaldoDireto = entregaImediataAtiva && Number(it.quantidade) > Number(it.saldo ?? 0);
                  const maxStepper = entregaImediataAtiva
                    ? Math.max(1, Number(it.saldo) || 1)
                    : (it.saldo > 0 ? it.saldo : 9999);
                  return (
                    <motion.div
                      key={it.produtoId || idx}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.18 }}
                      className="caderneta-item-row"
                    >
                      <div className="caderneta-item-info">
                        <div className="caderneta-item-nome-wrap">
                          <span className="caderneta-item-nome" title={it.materialNome}>
                            {it.materialNome}
                          </span>
                          <span className="caderneta-item-unidade">
                            {it.unidade || 'UN'}
                          </span>
                        </div>
                        <span className={`caderneta-item-conversao ${excedeSaldoDireto ? 'novo-pedido-saldo-alerta' : ''}`}>
                          Saldo em estoque: <strong>{it.saldo} {it.unidade}</strong>
                          {excedeSaldoDireto ? ' (excede saldo para baixa direta)' : ''}
                        </span>
                      </div>

                      {/* Stepper Padronizado de Quantidade */}
                      <QuantityStepper
                        value={it.quantidade}
                        onChange={(novaQtd) => handleUpdateQtd(idx, novaQtd)}
                        min={1}
                        max={maxStepper}
                        ariaLabel={`Quantidade de ${it.materialNome}`}
                        className="caderneta-quantity-stepper"
                      />

                      {/* Botão Remover */}
                      <button
                        type="button"
                        className="caderneta-item-remove"
                        onClick={() => handleRemoverItem(idx)}
                        title={`Remover ${it.materialNome}`}
                        aria-label={`Remover ${it.materialNome}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* 3. PRIORIDADE E URGÊNCIA */}
        <div className="novo-pedido-section">
          <label className="novo-pedido-label">Prioridade do Atendimento</label>
          <div className="novo-pedido-prioridade-toggle">
            <button
              type="button"
              className={`prioridade-btn ${!urgente ? 'prioridade-btn--active' : ''}`}
              onClick={() => setUrgente(false)}
            >
              Normal
            </button>
            <button
              type="button"
              className={`prioridade-btn prioridade-btn--urgente ${urgente ? 'prioridade-btn--urgente-active' : ''}`}
              onClick={() => setUrgente(true)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Urgente
            </button>
          </div>
        </div>

        {/* 4. JUSTIFICATIVA / FINALIDADE */}
        <div className="novo-pedido-section">
          <label className="novo-pedido-label" htmlFor="novo-pedido-justificativa">
            Finalidade / Justificativa <span className="campo-obrigatorio">*</span>
          </label>
          <textarea
            id="novo-pedido-justificativa"
            className="novo-pedido-textarea"
            rows={3}
            placeholder="Ex: Atendimento presencial no balcão para reposição das salas do bloco B..."
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
          />
        </div>
      </form>
    </BottomSheetModal>
  );
};

export default NovoPedidoModal;
