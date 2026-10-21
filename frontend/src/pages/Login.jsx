import React, { useState } from 'react';
import './Login.css';
import logoEstacao from '../assets/logo-estacao-conhecimento.png';
import { ForgotPasswordModal } from '../components/common';

const Login = ({ onLogin, onForgotPassword, error, isLoading = false }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin'); // 'admin' | 'usuario' | 'almoxarife'
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onLogin) {
      onLogin({
        identifier,
        password,
        role,
        rememberMe
      });
    }
  };

  return (
    <div className="login-container">
      {/* Background shapes decorativos */}
      <div className="login-backdrop">
        <div className="login-blob login-blob--1" />
        <div className="login-blob login-blob--2" />
      </div>

      <section className="login-showcase" aria-hidden="true">
        <div className="login-showcase__grid" />
        <div className="login-showcase__content">
          <div className="login-showcase__brand">
            <img src={logoEstacao} alt="Estação Conhecimento" className="login-showcase__logo-image" />
            <span className="login-showcase__brand-name">Estação<br />Conhecimento</span>
            <div className="login-showcase__logo">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
          </div>
          <p className="login-showcase__eyebrow">Estação Conhecimento</p>
          <h1>Gestão simples para uma operação mais eficiente.</h1>
          <p className="login-showcase__description">
            Controle materiais, pedidos e movimentações em um só lugar, com clareza para toda a equipe.
          </p>
          <div className="login-showcase__line" />
          <p className="login-showcase__caption">Sistema de Gestão e Estoque</p>
        </div>
      </section>

      <div className="login-card-wrapper">
        <div className="login-card">
          {/* Cabeçalho */}
          <div className="login-header">
            <div className="login-brand">
              <img src={logoEstacao} alt="Estação Conhecimento" className="login-brand-image" />
              <span className="login-brand-title">Estação<br />Conhecimento</span>
              <div className="login-logo">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
              </div>
            </div>
            <h2 className="login-title">Acesse sua conta</h2>
            <p className="login-subtitle">Sistema de Gestão e Estoque</p>
          </div>

          {/* Formulário */}
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label" htmlFor="login-role">
                Perfil de Acesso
              </label>
              <div className="login-role-selector">
                <button
                  type="button"
                  id="role-admin-btn"
                  className={`login-role-btn ${role === 'admin' ? 'login-role-btn--active' : ''}`}
                  onClick={() => setRole('admin')}
                >
                  Administrativo
                </button>
                <button
                  type="button"
                  id="role-usuario-btn"
                  className={`login-role-btn ${role === 'usuario' ? 'login-role-btn--active' : ''}`}
                  onClick={() => setRole('usuario')}
                >
                  Usuário
                </button>
                <button
                  type="button"
                  id="role-almoxarife-btn"
                  className={`login-role-btn ${role === 'almoxarife' ? 'login-role-btn--active' : ''}`}
                  onClick={() => setRole('almoxarife')}
                >
                  Almoxarife
                </button>
              </div>
            </div>

            {/* Email ou CPF */}
            <div className="login-field">
              <label className="login-label" htmlFor="login-identifier">
                E-mail ou CPF
              </label>
              <div className="login-input-group">
                <span className="login-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  id="login-identifier"
                  type="text"
                  className="login-input"
                  placeholder="usuario@empresa.com ou CPF"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="login-field">
              <div className="login-field-header">
                <label className="login-label" htmlFor="login-password">
                  Senha
                </label>
                <button type="button" className="login-forgot-link" onClick={() => { setForgotEmail(identifier); setForgotMessage(''); setForgotError(''); setForgotOpen(true); }}>
                  Esqueceu a senha?
                </button>
              </div>
              <div className="login-input-group">
                <span className="login-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  id="toggle-password-visibility"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Lembrar-me */}
            <div className="login-checkbox-row">
              <label className="login-checkbox-label">
                <input
                  id="login-remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Lembrar meu acesso</span>
              </label>
            </div>

            {error && <p className="login-error" role="alert">{error}</p>}

            {/* Botão de Entrar */}
            <button id="login-submit-btn" type="submit" className="login-submit-btn" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar no Sistema'}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </form>

          {/* Rodapé institucional */}
          <div className="login-footer">
            <p>Estação Conhecimento • Todos os direitos reservados</p>
          </div>
        </div>
      </div>
      {forgotOpen && (
        <ForgotPasswordModal
          isOpen={forgotOpen}
          email={forgotEmail}
          onEmailChange={(event) => setForgotEmail(event.target.value)}
          onClose={() => setForgotOpen(false)}
          message={forgotMessage}
          error={forgotError}
          isLoading={forgotLoading}
          onSubmit={async (event) => {
            event.preventDefault();
            setForgotLoading(true);
            setForgotMessage('');
            setForgotError('');
            try {
              const response = await onForgotPassword(forgotEmail);
              setForgotMessage(response.message);
            } catch (requestError) {
              setForgotError(requestError.message);
            } finally {
              setForgotLoading(false);
            }
          }}
        />
      )}
    </div>
  );
};

export default Login;
