import React, { useState, useMemo } from 'react';
import NovoUsuarioModal from './NovoUsuarioModal';
import { ConfirmDialog } from '../common';
import { limparCpf, validarCpf } from '../../utils/cpf';
import './UsuariosView.css';

/**
 * UsuariosView
 * Módulo de Gerenciamento de Usuários (RF-002)
 * Props esperadas do backend (C# / MySQL):
 * @param {Array} usuarios - Lista de usuários [{ id, nome, email, perfil, setor, ativo, inicial, dataCadastro }]
 * @param {Function} onSave - Callback chamado ao criar/editar usuário
 * @param {Function} onDelete - Callback chamado ao remover usuário
 * @param {Function} onToggleStatus - Callback chamado ao alterar status ativo/inativo
 * @param {Function} onResetPassword - Callback chamado ao resetar a senha do usuário
 */
const UsuariosView = ({
  usuarios: initialUsuariosProp,
  setores = [],
  onCriarSetor,
  onSave,
  onDelete,
  onToggleStatus,
  onResetPassword,
  usuarioSelecionado
}) => {
  // Estado inicial zerado, pronto para conexão com o backend
  const [usuarios, setUsuarios] = useState(initialUsuariosProp || []);
  const [selectedSetor, setSelectedSetor] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPerfil, setSelectedPerfil] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Controle de Modal e Ações
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState(null);
  const [usuarioToDelete, setUsuarioToDelete] = useState(null);
  const [usuarioToReset, setUsuarioToReset] = useState(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [openMenuUserId, setOpenMenuUserId] = useState(null);

  // Cadastro rápido de setor na barra lateral
  const [showNovoSetorInput, setShowNovoSetorInput] = useState(false);
  const [novoSetorTexto, setNovoSetorTexto] = useState('');
  const [criandoSetor, setCriandoSetor] = useState(false);

  // Fecha o menu de 3 pontinhos ao clicar fora ou apertar Escape
  React.useEffect(() => {
    if (openMenuUserId === null) return;
    const handleGlobalClick = (e) => {
      if (!e.target.closest('.user-kebab-container')) {
        setOpenMenuUserId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenMenuUserId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuUserId]);

  // Sincronização com props do backend
  React.useEffect(() => {
    if (initialUsuariosProp) {
      setUsuarios(initialUsuariosProp);
    }
  }, [initialUsuariosProp]);

  React.useEffect(() => {
    if (usuarioSelecionado) {
      setEditingUsuario(usuarioSelecionado);
      setIsModalOpen(true);
    }
  }, [usuarioSelecionado]);

  // Contagem dinâmica de usuários por setor
  const setoresComContagem = useMemo(() => {
    const contagem = {};
    usuarios.forEach(u => {
      const s = (u.setor || '').trim();
      contagem[s] = (contagem[s] || 0) + 1;
    });

    const nomes = new Set();
    (setores || []).forEach(s => {
      const nome = typeof s === 'string' ? s : s?.nome;
      if (nome && nome.trim()) nomes.add(nome.trim());
    });
    Object.keys(contagem).forEach(s => {
      if (s) nomes.add(s);
    });

    const itens = Array.from(nomes)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map(nome => ({
        nome,
        total: contagem[nome] || 0
      }));

    return {
      total: usuarios.length,
      semSetor: contagem[''] || 0,
      itens
    };
  }, [usuarios, setores]);

  // Filtragem em tempo real (setor, texto, perfil e status)
  const filteredUsuarios = useMemo(() => {
    return usuarios.filter(user => {
      if (selectedSetor === '__SEM_SETOR__') {
        if (user.setor && user.setor.trim()) return false;
      } else if (selectedSetor) {
        if (user.setor !== selectedSetor) return false;
      }

      const cleanSearch = searchTerm.replace(/\D/g, '');
      const matchSearch =
        user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cleanSearch && user.cpf && user.cpf.replace(/\D/g, '').includes(cleanSearch)) ||
        (user.setor && user.setor.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchPerfil = !selectedPerfil || user.perfil === selectedPerfil;

      const userStatusStr = user.ativo ? 'ativo' : 'inativo';
      const matchStatus = !selectedStatus || userStatusStr === selectedStatus;

      return matchSearch && matchPerfil && matchStatus;
    });
  }, [usuarios, selectedSetor, searchTerm, selectedPerfil, selectedStatus]);

  const handleOpenNewModal = () => {
    setEditingUsuario(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (usuario) => {
    setEditingUsuario(usuario);
    setIsModalOpen(true);
  };

  const handleDeleteUsuario = (id, nome) => {
    setUsuarioToDelete({ id, nome });
  };

  const confirmDeleteUsuario = () => {
    if (!usuarioToDelete) return;
    if (onDelete) {
      onDelete(usuarioToDelete.id);
    } else {
      setUsuarios(prev => prev.filter(u => u.id !== usuarioToDelete.id));
    }
    setUsuarioToDelete(null);
  };

  const handleToggleActive = (id) => {
    if (onToggleStatus) {
      onToggleStatus(id);
    } else {
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, ativo: !u.ativo } : u));
    }
  };

  const handleSaveUsuario = async (usuarioData) => {
    if (onSave) {
      return await onSave(usuarioData);
    }
    if (editingUsuario) {
      setUsuarios(prev => prev.map(u => u.id === usuarioData.id ? usuarioData : u));
    } else {
      setUsuarios(prev => [usuarioData, ...prev]);
    }
    return true;
  };

  const confirmResetPassword = async () => {
    if (!usuarioToReset || isResettingPassword) return;
    setIsResettingPassword(true);
    setFeedbackMsg(null);
    try {
      if (onResetPassword) {
        await onResetPassword(usuarioToReset.id);
      }
      setFeedbackMsg({
        type: 'success',
        text: `Senha de ${usuarioToReset.nome} redefinida para os 6 primeiros dígitos do CPF. A troca será exigida no próximo acesso.`
      });
      setUsuarioToReset(null);
    } catch (error) {
      setFeedbackMsg({
        type: 'error',
        text: error?.message || 'Não foi possível resetar a senha do usuário.'
      });
      setUsuarioToReset(null);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleCriarSetor = async (e) => {
    e.preventDefault();
    const nomeLimpo = novoSetorTexto.trim();
    if (!nomeLimpo) return;
    setCriandoSetor(true);
    try {
      if (onCriarSetor) {
        await onCriarSetor(nomeLimpo);
      }
      setSelectedSetor(nomeLimpo);
      setNovoSetorTexto('');
      setShowNovoSetorInput(false);
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Erro ao cadastrar setor.'
      });
    } finally {
      setCriandoSetor(false);
    }
  };

  const tituloSetorAtivo = useMemo(() => {
    if (!selectedSetor) return 'Todos os Usuários';
    if (selectedSetor === '__SEM_SETOR__') return 'Usuários Sem Setor';
    return `Setor: ${selectedSetor}`;
  }, [selectedSetor]);

  const getPerfilBadge = (perfil) => {
    switch (perfil) {
      case 'Administrativo':
        return <span className="perfil-badge perfil-badge--admin">Administrativo</span>;
      case 'Almoxarifado':
        return <span className="perfil-badge perfil-badge--almoxarifado">Almoxarifado</span>;
      case 'Usuário':
      default:
        return <span className="perfil-badge perfil-badge--usuario">Usuário</span>;
    }
  };

  return (
    <div className="usuarios-split-container">
      {/* Coluna Esquerda: Lista de Setores */}
      <aside className="usuarios-setores-sidebar" aria-label="Lista de setores">
        <div className="usuarios-setores-header">
          <div className="usuarios-setores-header-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <span>Setores</span>
          </div>
        </div>

        <div className="usuarios-setores-list" role="tablist" aria-orientation="vertical">
          <button
            type="button"
            className={`usuarios-setor-item ${selectedSetor === '' ? 'usuarios-setor-item--active' : ''}`}
            onClick={() => setSelectedSetor('')}
            role="tab"
            aria-selected={selectedSetor === ''}
          >
            <span className="usuarios-setor-name">Todos os Setores</span>
            <span className="usuarios-setor-count">{setoresComContagem.total}</span>
          </button>

          {setoresComContagem.itens.map(item => (
            <button
              key={item.nome}
              type="button"
              className={`usuarios-setor-item ${selectedSetor === item.nome ? 'usuarios-setor-item--active' : ''}`}
              onClick={() => setSelectedSetor(item.nome)}
              role="tab"
              aria-selected={selectedSetor === item.nome}
            >
              <span className="usuarios-setor-name" title={item.nome}>{item.nome}</span>
              <span className="usuarios-setor-count">{item.total}</span>
            </button>
          ))}

          {setoresComContagem.semSetor > 0 && (
            <button
              type="button"
              className={`usuarios-setor-item ${selectedSetor === '__SEM_SETOR__' ? 'usuarios-setor-item--active' : ''}`}
              onClick={() => setSelectedSetor('__SEM_SETOR__')}
              role="tab"
              aria-selected={selectedSetor === '__SEM_SETOR__'}
            >
              <span className="usuarios-setor-name">Sem Setor</span>
              <span className="usuarios-setor-count">{setoresComContagem.semSetor}</span>
            </button>
          )}
        </div>

        <div className="usuarios-setores-footer">
          {showNovoSetorInput ? (
            <form className="usuarios-novo-setor-form" onSubmit={handleCriarSetor}>
              <input
                type="text"
                className="usuarios-novo-setor-input"
                placeholder="Nome do novo setor..."
                value={novoSetorTexto}
                onChange={(e) => setNovoSetorTexto(e.target.value)}
                autoFocus
                disabled={criandoSetor}
              />
              <div className="usuarios-novo-setor-actions">
                <button
                  type="submit"
                  className="btn-novo-setor-salvar"
                  disabled={criandoSetor || !novoSetorTexto.trim()}
                >
                  {criandoSetor ? 'Salvando...' : 'Criar'}
                </button>
                <button
                  type="button"
                  className="btn-novo-setor-cancelar"
                  onClick={() => {
                    setShowNovoSetorInput(false);
                    setNovoSetorTexto('');
                  }}
                  disabled={criandoSetor}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="btn-novo-setor-footer"
              onClick={() => setShowNovoSetorInput(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Novo Setor</span>
            </button>
          )}
        </div>
      </aside>

      {/* Coluna Direita: Conteúdo Principal e Usuários */}
      <main className="usuarios-main-content">
        <div className="usuarios-content-header">
          <div>
            <h2 className="usuarios-content-title">{tituloSetorAtivo}</h2>
            <p className="usuarios-content-subtitle">
              {filteredUsuarios.length} {filteredUsuarios.length === 1 ? 'colaborador listado' : 'colaboradores listados'}
            </p>
          </div>
        </div>

        {/* Barra de Pesquisa e Filtros */}
        <div className="usuarios-filter-bar">
          <div className="usuarios-search-wrap">
            <svg className="usuarios-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="usuarios-search-input"
              placeholder="Buscar por nome, e-mail ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="usuarios-clear-search"
                onClick={() => setSearchTerm('')}
                aria-label="Limpar busca"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <div className="usuarios-filters-right">
            <select
              className="usuarios-select-filter"
              value={selectedPerfil}
              onChange={(e) => setSelectedPerfil(e.target.value)}
              aria-label="Filtrar por perfil"
            >
              <option value="">Todos os Perfis</option>
              <option value="Administrativo">Administrativo</option>
              <option value="Almoxarifado">Almoxarifado</option>
              <option value="Usuário">Usuário</option>
            </select>

            <select
              className="usuarios-select-filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filtrar por status"
            >
              <option value="">Todos os Status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>
        </div>

        {feedbackMsg && (
          <div
            className={`usuarios-feedback usuarios-feedback--${feedbackMsg.type}`}
            role={feedbackMsg.type === 'error' ? 'alert' : 'status'}
          >
            <span>{feedbackMsg.text}</span>
            <button
              type="button"
              className="usuarios-feedback__close"
              onClick={() => setFeedbackMsg(null)}
              aria-label="Fechar aviso"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Tabela de Usuários */}
        <div className="usuarios-table-card">
          {filteredUsuarios.length > 0 ? (
            <>
              <div className="usuarios-table-wrapper">
                <table className="usuarios-table">
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>E-mail</th>
                      <th>Perfil de Acesso</th>
                      <th>Setor</th>
                      <th>Status</th>
                      <th>Data de Cadastro</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsuarios.map((user, index) => {
                      const temCpfValido = validarCpf(limparCpf(user.cpf));
                      const isNearBottom = index >= filteredUsuarios.length - 2 && filteredUsuarios.length > 2;
                      return (
                        <tr key={user.id} className={!user.ativo ? 'tr-inativo' : ''}>
                          <td>
                            <div className="user-cell-info">
                              <div className={`user-avatar user-avatar--${user.perfil.toLowerCase()}`}>
                                {user.inicial || user.nome.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="user-name-wrapper">
                                <span className="user-name-text">{user.nome}</span>
                                {user.cpf && (
                                  <span className="user-cpf-tag">
                                    CPF: {user.cpf}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="user-email-text">{user.email || '—'}</span>
                          </td>
                          <td>{getPerfilBadge(user.perfil)}</td>
                          <td>
                            <span className="setor-tag">{user.setor || 'Não informado'}</span>
                          </td>
                          <td>
                            <span className={`user-status-pill ${user.ativo ? 'user-status-pill--active' : 'user-status-pill--inactive'}`}>
                              <span className="status-dot" aria-hidden="true" />
                              {user.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td>
                            <span className="date-text">{user.dataCadastro || '—'}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="user-kebab-container">
                              <button
                                type="button"
                                className={`btn-kebab ${openMenuUserId === user.id ? 'btn-kebab--active' : ''}`}
                                aria-label={`Ações para ${user.nome}`}
                                aria-haspopup="true"
                                aria-expanded={openMenuUserId === user.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuUserId(prev => prev === user.id ? null : user.id);
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                  <circle cx="12" cy="5" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="12" cy="19" r="2" />
                                </svg>
                              </button>

                              {openMenuUserId === user.id && (
                                <div className={`user-kebab-menu ${isNearBottom ? 'user-kebab-menu--up' : ''}`} role="menu">
                                  <button
                                    type="button"
                                    className="user-kebab-item"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuUserId(null);
                                      handleOpenEditModal(user);
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    <span>Editar Dados</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="user-kebab-item"
                                    role="menuitem"
                                    disabled={!temCpfValido}
                                    title={temCpfValido
                                      ? 'Redefinir senha para os 6 primeiros dígitos do CPF'
                                      : 'Cadastre um CPF válido para habilitar o reset'}
                                    onClick={() => {
                                      setOpenMenuUserId(null);
                                      setUsuarioToReset(user);
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5M3 21l9-9m3-3l3 3-1.5 1.5" />
                                      <circle cx="7.5" cy="16.5" r="4.5" />
                                    </svg>
                                    <span>Resetar Senha</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="user-kebab-item"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuUserId(null);
                                      handleToggleActive(user.id);
                                    }}
                                  >
                                    {user.ativo ? (
                                      <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <circle cx="12" cy="12" r="10" />
                                          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                        </svg>
                                        <span>Desativar Conta</span>
                                      </>
                                    ) : (
                                      <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                          <polyline points="22 4 12 14.01 9 11.01" />
                                        </svg>
                                        <span>Ativar Conta</span>
                                      </>
                                    )}
                                  </button>

                                  <div className="user-kebab-divider" role="separator" />

                                  <button
                                    type="button"
                                    className="user-kebab-item user-kebab-item--danger"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuUserId(null);
                                      handleDeleteUsuario(user.id, user.nome);
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                    <span>Excluir Usuário</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Botão no fim da lista */}
              <div className="usuarios-table-footer">
                <button
                  type="button"
                  className="btn-novo-usuario-footer"
                  onClick={handleOpenNewModal}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Cadastrar Novo Usuário</span>
                </button>
              </div>
            </>
          ) : (
            <div className="usuarios-empty-state">
              <div className="empty-icon-wrap">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h4>Nenhum usuário encontrado</h4>
              <p>
                {searchTerm || selectedPerfil || selectedStatus
                  ? 'Nenhum registro corresponde aos filtros selecionados.'
                  : selectedSetor
                    ? 'Nenhum usuário cadastrado neste setor.'
                    : 'O cadastro de usuários está vazio.'}
              </p>
              {(searchTerm || selectedPerfil || selectedStatus) ? (
                <button
                  type="button"
                  className="btn-clear-filters"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedPerfil('');
                    setSelectedStatus('');
                  }}
                >
                  Limpar Filtros
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-novo-usuario-footer"
                  onClick={handleOpenNewModal}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Cadastrar Primeiro Usuário</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal de Adição/Edição */}
      <NovoUsuarioModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveUsuario}
        initialData={editingUsuario}
        setores={setores}
        onCriarSetor={onCriarSetor}
        setorPadrao={selectedSetor && selectedSetor !== '__SEM_SETOR__' ? selectedSetor : ''}
      />
      {usuarioToDelete && (
        <ConfirmDialog
          title="Excluir usuário?"
          description={`O acesso de "${usuarioToDelete.nome}" será removido. Para uma suspensão temporária, prefira desativar a conta.`}
          confirmLabel="Excluir usuário"
          onCancel={() => setUsuarioToDelete(null)}
          onConfirm={confirmDeleteUsuario}
        />
      )}
      {usuarioToReset && (
        <ConfirmDialog
          title="Resetar senha do usuário?"
          description={`A senha de "${usuarioToReset.nome}" será redefinida para os 6 primeiros dígitos do CPF e uma nova senha pessoal será exigida no próximo acesso.`}
          confirmLabel="Resetar senha"
          tone="accent"
          isBusy={isResettingPassword}
          onCancel={() => setUsuarioToReset(null)}
          onConfirm={confirmResetPassword}
        />
      )}
    </div>
  );
};

export default UsuariosView;
