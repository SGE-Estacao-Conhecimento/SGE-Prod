import React from 'react';
import { AlterarSenhaCard, AtualizarEmailCard } from '../common';
import './UsuarioPerfil.css';

const UsuarioPerfil = ({ user, onLogout, onUserUpdate }) => {
  const nomeUsuario = user?.nome || user?.identifier || 'Usuário Solicitante';
  const inicial = nomeUsuario.charAt(0).toUpperCase();

  return (
    <div className="usuario-perfil">
      {/* Card Principal de Identificação */}
      <div className="perfil-card">
        <div className="perfil-avatar">{inicial}</div>
        <div className="perfil-info">
          <h2 className="perfil-nome">{nomeUsuario}</h2>
          <span className="perfil-cargo">Solicitante</span>
          <span className="perfil-setor">{user?.setor ? `Setor: ${user.setor}` : 'Setor não informado'}</span>
          {user?.email && user.email !== nomeUsuario && <span className="perfil-setor">{user.email}</span>}
        </div>
      </div>

      {/* Seção de Segurança e Credenciais */}
      <AtualizarEmailCard user={user} onSuccess={onUserUpdate} />
      <AlterarSenhaCard user={user} />

      {/* Botão de Logout em Destaque */}
      {onLogout && (
        <div className="perfil-logout-wrap">
          <button
            type="button"
            className="btn-perfil-logout"
            onClick={onLogout}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair da Conta
          </button>
        </div>
      )}
    </div>
  );
};

export default UsuarioPerfil;
