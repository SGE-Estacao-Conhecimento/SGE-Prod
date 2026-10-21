import React from 'react';
import { StatCard, AlterarSenhaCard } from '../common';
import '../UsuarioPerfil/UsuarioPerfil.css';

const AlmoxarifePerfil = ({ user, onLogout, onNavigate }) => {
  const nomeUsuario = user?.nome || user?.identifier || 'Almoxarife';
  const inicial = nomeUsuario.charAt(0).toUpperCase();

  return (
    <div className="usuario-perfil">
      {/* Card Principal de Identificação */}
      <div className="perfil-card">
        <div className="perfil-avatar" style={{ background: 'linear-gradient(135deg, #017F7B, #016562)' }}>
          {inicial}
        </div>
        <div className="perfil-info">
          <h2 className="perfil-nome">{nomeUsuario}</h2>
          <span className="perfil-cargo" style={{ color: '#017F7B' }}>Almoxarife / Estoquista</span>
          <span className="perfil-setor">{user?.setor ? `Setor: ${user.setor}` : 'Setor não informado'}</span>
          {user?.email && user.email !== nomeUsuario && <span className="perfil-setor">{user.email}</span>}
        </div>
      </div>

      {/* Atalhos Rápidos Operacionais */}
      <div className="perfil-stats-grid">
        <StatCard
          value="Estoque"
          label="Materiais"
          variant="accent"
          onClick={() => onNavigate && onNavigate('estoque')}
        />

        <StatCard
          value="Pedidos"
          label="Atendimento"
          variant="warning"
          onClick={() => onNavigate && onNavigate('pedidos')}
        />

        <StatCard
          value="Métricas"
          label="Relatórios"
          variant="success"
          onClick={() => onNavigate && onNavigate('relatorios')}
        />
      </div>

      {/* Seção de Segurança: Alterar Senha */}
      <AlterarSenhaCard user={user} />

      {/* Botão de Logout Padronizado com o Perfil do Usuário */}
      {onLogout && (
        <div className="perfil-logout-wrap">
          <button
            type="button"
            className="btn-perfil-logout"
            onClick={onLogout}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair da Conta
          </button>
        </div>
      )}
    </div>
  );
};

export default AlmoxarifePerfil;
