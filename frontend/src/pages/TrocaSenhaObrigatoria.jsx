import React, { useState } from 'react';
import './Login.css';
import './TrocaSenhaObrigatoria.css';
import logoEstacao from '../assets/logo-estacao-conhecimento.png';
import { alterarSenha } from '../services/api/authService';

const PasswordToggleIcon = ({ visible }) => (
  visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
);

const TrocaSenhaObrigatoria = ({ user, onSuccess, onLogout }) => {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmeSenha, setConfirmeSenha] = useState('');

  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [showConfirme, setShowConfirme] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!senhaAtual) {
      setError('Informe sua senha provisória atual (6 primeiros dígitos do CPF).');
      return;
    }
    if (!novaSenha || novaSenha.length < 8) {
      setError('A nova senha deve possuir no mínimo 8 caracteres.');
      return;
    }
    if (novaSenha.length > 128) {
      setError('A nova senha deve possuir no máximo 128 caracteres.');
      return;
    }
    if (novaSenha === senhaAtual) {
      setError('A nova senha deve ser diferente da senha provisória.');
      return;
    }
    if (novaSenha !== confirmeSenha) {
      setError('A confirmação da senha não coincide com a nova senha.');
      return;
    }

    setIsSubmitting(true);
    try {
      const atualizado = await alterarSenha({
        senhaAtual,
        novaSenha,
        lembrar: Boolean(user?.rememberMe)
      });
      if (onSuccess) onSuccess(atualizado);
    } catch (err) {
      setError(err?.message || 'Não foi possível atualizar a senha. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
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
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>
          <p className="login-showcase__eyebrow">Primeiro Acesso e Segurança</p>
          <h1>Defina sua senha pessoal.</h1>
          <p className="login-showcase__description">
            Para proteger sua conta, substitua a senha inicial antes de iniciar as operações no sistema.
          </p>
          <div className="login-showcase__line" />
          <p className="login-showcase__caption">Sistema de Gestão e Estoque</p>
        </div>
      </section>

      <div className="login-card-wrapper">
        <div className="login-card">
          <div className="login-header">
            <div className="login-brand">
              <img src={logoEstacao} alt="Estação Conhecimento" className="login-brand-image" />
              <span className="login-brand-title">Estação<br />Conhecimento</span>
            </div>
            <h2 className="login-title">Troca de senha obrigatória</h2>
            <p className="login-subtitle">
              {user?.nome ? `Conta: ${user.nome}` : 'Atualize sua credencial para continuar'}
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="troca-senha-aviso">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                Informe os 6 primeiros dígitos do seu CPF como senha atual e defina uma nova senha pessoal com no mínimo 8 caracteres.
              </span>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="forced-senha-atual">
                Senha Provisória (6 primeiros dígitos do CPF)
              </label>
              <div className="login-input-group">
                <span className="login-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="forced-senha-atual"
                  type={showAtual ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Digite os 6 primeiros dígitos do CPF"
                  value={senhaAtual}
                  onChange={(e) => {
                    setSenhaAtual(e.target.value);
                    if (error) setError('');
                  }}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowAtual((v) => !v)}
                  aria-label={showAtual ? 'Ocultar senha atual' : 'Exibir senha atual'}
                  tabIndex={-1}
                >
                  <PasswordToggleIcon visible={showAtual} />
                </button>
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="forced-nova-senha">
                Nova Senha
              </label>
              <div className="login-input-group">
                <span className="login-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5M3 21l9-9m3-3l3 3-1.5 1.5" />
                    <circle cx="7.5" cy="16.5" r="4.5" />
                  </svg>
                </span>
                <input
                  id="forced-nova-senha"
                  type={showNova ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Mínimo de 8 caracteres"
                  value={novaSenha}
                  onChange={(e) => {
                    setNovaSenha(e.target.value);
                    if (error) setError('');
                  }}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowNova((v) => !v)}
                  aria-label={showNova ? 'Ocultar nova senha' : 'Exibir nova senha'}
                  tabIndex={-1}
                >
                  <PasswordToggleIcon visible={showNova} />
                </button>
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="forced-confirme-senha">
                Confirmar Nova Senha
              </label>
              <div className="login-input-group">
                <span className="login-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <input
                  id="forced-confirme-senha"
                  type={showConfirme ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Repita a nova senha"
                  value={confirmeSenha}
                  onChange={(e) => {
                    setConfirmeSenha(e.target.value);
                    if (error) setError('');
                  }}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowConfirme((v) => !v)}
                  aria-label={showConfirme ? 'Ocultar confirmação' : 'Exibir confirmação'}
                  tabIndex={-1}
                >
                  <PasswordToggleIcon visible={showConfirme} />
                </button>
              </div>
            </div>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button type="submit" className="login-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar e Acessar o Sistema'}
            </button>

            {onLogout && (
              <button
                type="button"
                className="troca-senha-logout-btn"
                onClick={onLogout}
                disabled={isSubmitting}
              >
                Sair da conta
              </button>
            )}
          </form>

          <div className="login-footer">
            <p>Estação Conhecimento - Sistema de Gestão e Estoque</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrocaSenhaObrigatoria;

