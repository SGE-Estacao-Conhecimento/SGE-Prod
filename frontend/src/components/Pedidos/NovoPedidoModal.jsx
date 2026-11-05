import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BottomSheetModal, QuantityStepper } from '../common';
import './NovoPedidoModal.css';

/**
 * NovoPedidoModal — Cadastro Rápido de Pedido pelo Almoxarifado
 * 
 * Totalmente padronizado com o Design System do SGE:
 * - Baseado no BottomSheetModal oficial (acessibilidade, física de mola, responsivo).
 * - Seleção inteligente de solicitante vinculado ao setor e ramal.
 * - Busca de materiais com autocomplete e exibição do saldo físico disponível.
 * - Controle de volume via QuantityStepper padronizado.
 * - Toggle de urgência tátil e justificativa operacional.
 */
const NovoPedidoModal = ({
  isOpen,
  onClose,
  onSave,
  initialData = null,
  materiaisDisponiveis = [],
  usuariosDisponiveis = []
}) => {
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState('');
  const [usuarioNomeCustom, setUsuarioNomeCustom] = useState('');
  const [setorCustom, setSetorCustom] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [itens, setItens] = useState([]);

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
      quantidade: typeof m.quantidade === 'number' ? m.quantidade : 0,
      complexo: m.complexo || 'Almoxarifado Central',
      locacao: m.locacao || '',
      localizacao: m.localizacao || ''
    }));
  }, [materiaisDisponiveis]);

  // Filtro de materiais pelo termo de busca
  const materiaisFiltrados = useMemo(() => {
    if (!buscaMaterial.trim()) return listaMateriais.slice(0, 8);
    const termo = buscaMaterial.toLowerCase().trim();
    return listaMateriais.filter(m =>
      m.nome.toLowerCase().includes(termo) ||
      m.codigo.toLowerCase().includes(termo) ||
      (m.locacao && m.locacao.toLowerCase().includes(termo))
    ).slice(0, 10);
  }, [listaMateriais, buscaMaterial]);

  // Lista de usuários para seleção
  const listaUsuarios = useMemo(() => {
    return (usuariosDisponiveis || []).filter(u => u.ativo !== false);
  }, [usuariosDisponiveis]);

  // Inicializa dados ao abrir
  useEffect(() => {
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

      setItens(itensIniciais.map((it, idx) => {
        const mat = listaMateriais.find(m => m.id === it.produtoId || m.nome.toLowerCase() === (it.materialNome || it.nome)?.toLowerCase());
        return {
          produtoId: it.produtoId || mat?.id || idx + 1,
          materialNome: it.materialNome || it.nome || mat?.nome || 'Material',
          quantidade: Number(it.quantidade) || 1,
          unidade: it.unidade || mat?.unidade || 'UN',
          saldo: mat ? mat.quantidade : 999
        };
      }));
    } else {
      setUsuarioSelecionadoId(listaUsuarios.length > 0 ? String(listaUsuarios[0].id) : 'custom');
      setUsuarioNomeCustom('');
      setSetorCustom('');
      setUrgente(false);
      setJustificativa('');
      setItens([]);
    }
    setBuscaMaterial('');
    setIsDropdownAberto(false);
    setErro('');
  }, [isOpen, initialData, listaUsuarios, listaMateriais]);

  if (!isOpen) return null;

  // Adiciona material selecionado à lista do pedido
  const handleAdicionarMaterial = (mat) => {
    setItens(prev => {
      const indexExistente = prev.findIndex(it => it.produtoId === mat.id);
      if (indexExistente >= 0) {
        const atual = prev[indexExistente];
        const novaQtd = Math.min(mat.quantidade || 999, atual.quantidade + 1);
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
          saldo: mat.quantidade
        }
      ];
    });

    setBuscaMaterial('');
    setIsDropdownAberto(false);
    setErro('');
  };

  const handleUpdateQtd = (index, novaQtd) => {
    setItens(prev => {
      const atualizados = [...prev];
      atualizados[index] = { ...atualizados[index], quantidade: Math.max(1, novaQtd) };
      return atualizados;
    });
  };

  const handleRemoverItem = (index) => {
    setItens(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let solicitanteNome = '';
    let solicitanteSetor = '';

    if (usuarioSelecionadoId === 'custom') {
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
      solicitanteNome = u.nome;
      solicitanteSetor = u.setor || 'Geral';
    }

    if (itens.length === 0) {
      setErro('Adicione pelo menos 1 material ao pedido.');
      return;
    }

    if (!justificativa.trim()) {
      setErro('Informe a finalidade ou justificativa do pedido.');
      return;
    }

    const payload = {
      ...(initialData?.id ? { id: initialData.id } : { id: Date.now() }),
      usuario: solicitanteNome,
      setor: solicitanteSetor,
      data: initialData?.data || new Date().toLocaleDateString('pt-BR'),
      prioridade: urgente ? 'Urgente' : 'Normal',
      urgente,
      justificativa: justificativa.trim(),
      status: initialData?.status || 'Pendente',
      itens: itens.map(it => ({
        produtoId: it.produtoId,
        materialNome: it.materialNome,
        quantidade: it.quantidade,
        unidade: it.unidade
      }))
    };

    onSave(payload);
    onClose();
  };

  const usuarioAtual = listaUsuarios.find(u => String(u.id) === String(usuarioSelecionadoId));

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? `Editar Pedido #${initialData.id}` : 'Novo Pedido de Material'}
      subtitle="Balcão de Atendimento"
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
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="form-novo-pedido-almoxarife"
            className={`novo-pedido-btn-submit ${urgente ? 'novo-pedido-btn-submit--urgente' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {initialData ? 'Salvar Alterações' : 'Criar Pedido'}
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
                  {u.nome} — {u.setor || 'Geral'}{u.ramal ? ` (Ramal ${u.ramal})` : ''}
                </option>
              ))}
              <option value="custom">Outro colaborador (digitar)...</option>
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
                  {usuarioAtual.setor || 'Geral'}{usuarioAtual.ramal ? ` • Ramal ${usuarioAtual.ramal}` : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. ADIÇÃO DE MATERIAIS COM SALDO REAL */}
        <div className="novo-pedido-section">
          <label className="novo-pedido-label">
            Materiais Solicitados <span className="campo-obrigatorio">*</span>
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
                placeholder="Buscar material por nome, código ou prateleira..."
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
                    Nenhum material encontrado no estoque.
                  </div>
                ) : (
                  materiaisFiltrados.map(mat => {
                    const temSaldo = mat.quantidade > 0;
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        className="novo-pedido-dropdown-item"
                        onClick={() => handleAdicionarMaterial(mat)}
                      >
                        <div className="novo-pedido-item-main">
                          <span className="novo-pedido-item-sku">{mat.codigo}</span>
                          <span className="novo-pedido-item-nome">{mat.nome}</span>
                          <span className="novo-pedido-item-loc">
                            {[mat.locacao, mat.localizacao].filter(Boolean).join(' • ') || mat.complexo}
                          </span>
                        </div>

                        <div className="novo-pedido-item-stock">
                          <span className={`novo-pedido-saldo-badge ${temSaldo ? 'saldo--ok' : 'saldo--zero'}`}>
                            {temSaldo ? `Saldo: ${mat.quantidade} ${mat.unidade}` : 'Sem estoque'}
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
              <span>Nenhum material adicionado ainda. Utilize a busca acima.</span>
            </div>
          ) : (
            <div className="caderneta-itens-scroll novo-pedido-itens-lista">
              <AnimatePresence initial={false}>
                {itens.map((it, idx) => (
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
                      <span className="caderneta-item-conversao">
                        Saldo em estoque: <strong>{it.saldo} {it.unidade}</strong>
                      </span>
                    </div>

                    {/* Stepper Padronizado de Quantidade */}
                    <QuantityStepper
                      value={it.quantidade}
                      onChange={(novaQtd) => handleUpdateQtd(idx, novaQtd)}
                      min={1}
                      max={it.saldo || 9999}
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
                ))}
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
