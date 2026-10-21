import React, { useMemo, useState } from 'react';
import './GerenciarUsuarios.css';

/**
 * GerenciarUsuarios
 * Props esperadas do backend:
 * @param {Array} usuarios - lista [{ id, nome, perfil, ativo: bool, inicial, cor }]
 */
const GerenciarUsuarios = ({ usuarios = [], onNavigate, onSelectUsuario }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const usuariosVisiveis = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    return usuarios
      .filter((usuario) => !termo || [usuario.nome, usuario.email, usuario.setor]
        .filter(Boolean)
        .some((campo) => campo.toLowerCase().includes(termo)))
      .slice(0, 5);
  }, [usuarios, searchTerm]);

  const abrirPerfil = (usuario) => {
    if (onSelectUsuario) onSelectUsuario(usuario);
    else if (onNavigate) onNavigate('usuarios');
  };
  return (
    <div className="panel-card">
      <div className="panel-card__header">
        <h3 className="panel-card__title">Gerenciar Usuários</h3>
        <button
          id="btn-add-usuario"
          className="panel-btn-icon"
          title="Ir para Gerenciamento de Usuários"
          onClick={() => onNavigate && onNavigate('usuarios')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <div className="panel-search-wrap">
        <svg className="panel-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="search"
          className="panel-search"
          placeholder="Buscar usuário..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Buscar usuário por nome"
        />
      </div>

      {usuarios.length === 0 ? (
        <div className="panel-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span>Nenhum usuário cadastrado</span>
        </div>
      ) : (
        <>
          {usuariosVisiveis.length === 0 ? (
            <div className="panel-empty panel-empty--compact">Nenhum usuário encontrado</div>
          ) : (
          <ul className="usuarios-list">
            {usuariosVisiveis.map(u => (
              <li
                key={u.id}
                className="usuario-item usuario-item--clickable"
                role="button"
                tabIndex={0}
                onClick={() => abrirPerfil(u)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') abrirPerfil(u); }}
                title={`Abrir perfil de ${u.nome}`}
              >
                <div className="usuario-item__avatar" style={{ background: u.cor ?? '#4A6CF7' }}>
                  {u.inicial ?? u.nome?.charAt(0)}
                </div>
                <div className="usuario-item__info">
                  <span className="usuario-item__nome">{u.nome}</span>
                  <span className="usuario-item__perfil">{u.perfil}</span>
                </div>
                <div className={`usuario-item__status ${u.ativo ? 'usuario-item__status--on' : 'usuario-item__status--off'}`} />
              </li>
            ))}
          </ul>
          )}
          <button
            id="btn-ver-todos-usuarios"
            className="panel-link-btn"
            onClick={() => onNavigate && onNavigate('usuarios')}
          >
            Ver todos os usuários
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </button>
        </>
      )}
    </div>
  );
};

export default GerenciarUsuarios;
