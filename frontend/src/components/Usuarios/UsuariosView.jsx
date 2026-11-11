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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPerfil, setSelectedPerfil] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Controle de Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState(null);
  const [usuarioToDelete, setUsuarioToDelete] = useState(null);
  const [usuarioToReset, setUsuarioToReset] = useState(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

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

  // Estatísticas calculadas dinamicamente
  const stats = useMemo(() => {
    const total = usuarios.length;
    const admin = usuarios.filter(u => u.perfil === 'Administrativo').length;
    const almoxarifado = usuarios.filter(u => u.perfil === 'Almoxarifado').length;
    const comum = usuarios.filter(u => u.perfil === 'Usuário').length;
    return { total, admin, almoxarifado, comum };
  }, [usuarios]);

  // Filtragem em tempo real
  const filteredUsuarios = useMemo(() => {
    return usuarios.filter(user => {
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
  }, [usuarios, searchTerm, selectedPerfil, selectedStatus]);

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
    <div className="usuarios-container">
      {/* Cabeçalho */}
      <div className="usuarios-header">
        <div>
          <h1 className="usuarios-title">Gerenciamento de Usuários</h1>
          <p className="usuarios-subtitle">Cadastre novos usuários, gerencie perfis de acesso e vincule setores aos colaboradores.</p>
        </div>
        <button className="btn-novo-usuario" onClick={handleOpenNewModal}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Novo Usuário
        </button>
      </div>

      {/* Cards de Resumo Interativos */}
      <div className="usuarios-kpis" role="region" aria-label="Filtros rápidos por perfil de usuário">
        <div
          className={`usuarios-kpi-card ${!selectedPerfil ? 'usuarios-kpi-card--active-total' : ''}`}
          onClick={() => setSelectedPerfil('')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPerfil(''); }}
          title="Clique para ver todos os usuários cadastrados"
        >
          <div className="usuarios-kpi-icon usuarios-kpi-icon--total">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <span className="usuarios-kpi-label">Total Cadastrado</span>
            <div className="usuarios-kpi-val">{stats.total}</div>
          </div>
        </div>

        <div
          className={`usuarios-kpi-card ${selectedPerfil === 'Administrativo' ? 'usuarios-kpi-card--active-admin' : ''}`}
          onClick={() => setSelectedPerfil(prev => prev === 'Administrativo' ? '' : 'Administrativo')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPerfil(prev => prev === 'Administrativo' ? '' : 'Administrativo'); }}
          title="Clique para filtrar apenas administradores"
        >
          <div className="usuarios-kpi-icon usuarios-kpi-icon--admin">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <span className="usuarios-kpi-label">Administradores</span>
            <div className="usuarios-kpi-val text-admin">{stats.admin}</div>
          </div>
        </div>

        <div
          className={`usuarios-kpi-card ${selectedPerfil === 'Almoxarifado' ? 'usuarios-kpi-card--active-almoxarifado' : ''}`}
          onClick={() => setSelectedPerfil(prev => prev === 'Almoxarifado' ? '' : 'Almoxarifado')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPerfil(prev => prev === 'Almoxarifado' ? '' : 'Almoxarifado'); }}
          title="Clique para filtrar usuários do almoxarifado"
        >
          <div className="usuarios-kpi-icon usuarios-kpi-icon--almoxarifado">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div>
            <span className="usuarios-kpi-label">Almoxarifado</span>
            <div className="usuarios-kpi-val text-almoxarifado">{stats.almoxarifado}</div>
          </div>
        </div>

        <div
          className={`usuarios-kpi-card ${selectedPerfil === 'Usuário' ? 'usuarios-kpi-card--active-comum' : ''}`}
          onClick={() => setSelectedPerfil(prev => prev === 'Usuário' ? '' : 'Usuário')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPerfil(prev => prev === 'Usuário' ? '' : 'Usuário'); }}
          title="Clique para filtrar usuários comuns (solicitantes)"
        >
          <div className="usuarios-kpi-icon usuarios-kpi-icon--comum">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="7" r="4"/>
              <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            </svg>
          </div>
          <div>
            <span className="usuarios-kpi-label">Usuários Comuns</span>
            <div className="usuarios-kpi-val text-comum">{stats.comum}</div>
          </div>
        </div>
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div className="usuarios-filter-bar">
        <div className="usuarios-search-wrap">
          <svg className="usuarios-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="usuarios-search-input"
            placeholder="Buscar por nome, e-mail ou setor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="usuarios-clear-search" onClick={() => setSearchTerm('')}>
              ×
            </button>
          )}
        </div>

        <div className="usuarios-filters-right">
          <select
            className="usuarios-select-filter"
            value={selectedPerfil}
            onChange={(e) => setSelectedPerfil(e.target.value)}
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
                {filteredUsuarios.map(user => {
                  const temCpfValido = validarCpf(limparCpf(user.cpf));
                  return (
                  <tr key={user.id} className={!user.ativo ? 'tr-inativo' : ''}>
                    <td>
                      <div className="user-cell-info">
                        <div className={`user-avatar user-avatar--${user.perfil.toLowerCase()}`}>
                          {user.inicial || user.nome.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="user-name-wrapper">
                          <span className="user-name-text">{user.nome}</span>
                          {user.cpf && <span className="user-cpf-tag" style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>CPF: {user.cpf}</span>}
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
                      <button
                        className={`status-btn-toggle ${user.ativo ? 'status-btn-toggle--active' : 'status-btn-toggle--inactive'}`}
                        onClick={() => handleToggleActive(user.id)}
                        title="Clique para alterar status"
                      >
                        <span className="status-dot" />
                        {user.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td>
                      <span className="date-text">{user.dataCadastro || '—'}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="action-buttons">
                        <button
                          className="btn-action btn-action--edit"
                          title="Editar usuário"
                          onClick={() => handleOpenEditModal(user)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-action--reset"
                          title={temCpfValido
                            ? 'Resetar senha para os 6 primeiros dígitos do CPF'
                            : 'Cadastre um CPF válido neste usuário para habilitar o reset'}
                          aria-label={`Resetar senha de ${user.nome}`}
                          disabled={!temCpfValido}
                          onClick={() => setUsuarioToReset(user)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5M3 21l9-9m3-3l3 3-1.5 1.5" />
                            <circle cx="7.5" cy="16.5" r="4.5" />
                          </svg>
                        </button>
                        <button
                          className="btn-action btn-action--delete"
                          title="Excluir usuário"
                          onClick={() => handleDeleteUsuario(user.id, user.nome)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="usuarios-empty-state">
            <div className="empty-icon-wrap">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h4>Nenhum usuário cadastrado</h4>
            <p>
              {searchTerm || selectedPerfil || selectedStatus
                ? 'Nenhum registro encontrado para os filtros selecionados.'
                : 'O cadastro de usuários está vazio. Clique no botão acima para adicionar o primeiro usuário.'}
            </p>
            {(searchTerm || selectedPerfil || selectedStatus) ? (
              <button
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
              <button className="btn-novo-usuario" onClick={handleOpenNewModal}>
                + Cadastrar Primeiro Usuário
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de Adição/Edição */}
      <NovoUsuarioModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveUsuario}
        initialData={editingUsuario}
        setores={setores}
        onCriarSetor={onCriarSetor}
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
