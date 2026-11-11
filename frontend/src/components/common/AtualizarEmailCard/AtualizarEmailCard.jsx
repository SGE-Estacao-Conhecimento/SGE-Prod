import React, { useState, useRef } from 'react';
import useDialogAccessibility from '../useDialogAccessibility';
import { atualizarEmail } from '../../../services/api/authService';
import '../AlterarSenhaCard/AlterarSenhaCard.css';

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * AtualizarEmailCard — Card de perfil para cadastro ou alteração autogerenciada de e-mail.
 * Exige confirmação pela senha atual antes de atualizar a credencial na API.
 */
const AtualizarEmailCard = ({ user, onSuccess }) => {
  const emailAtual = user?.email && String(user.email).includes('@') ? String(user.email) : '';
  const temEmail = Boolean(emailAtual);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessPopupOpen, setIsSuccessPopupOpen] = useState(false);
  const [emailSalvo, setEmailSalvo] = useState('');

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setError('');
    setSenhaAtual('');
  };

  const emailInputRef = useRef(null);
  const modalDialogRef = useDialogAccessibility({
    isOpen: isModalOpen,
    onClose: isSubmitting ? undefined : handleCloseModal,
    initialFocusRef: emailInputRef
  });

  const successBtnRef = useRef(null);
  const successDialogRef = useDialogAccessibility({
    isOpen: isSuccessPopupOpen,
    onClose: () => setIsSuccessPopupOpen(false),
    initialFocusRef: successBtnRef
  });

  const handleOpenModal = () => {
    setEmail(emailAtual);
    setSenhaAtual('');
    setShowSenhaAtual(false);
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailNormalizado = email.trim().toLowerCase();
    if (!emailNormalizado) {
      setError('Informe o e-mail desejado.');
      return;
    }
    if (emailNormalizado.length > 150 || !REGEX_EMAIL.test(emailNormalizado)) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }
    if (temEmail && emailNormalizado === emailAtual.trim().toLowerCase()) {
      setError('O novo e-mail informado é igual ao e-mail atual.');
      return;
    }
    if (!senhaAtual) {
      setError('Informe sua senha atual para confirmar a alteração.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await atualizarEmail({ email: emailNormalizado, senhaAtual });
      const novoEmail = res?.email || emailNormalizado;
      setEmailSalvo(novoEmail);
      setSenhaAtual('');
      setIsModalOpen(false);
      setIsSuccessPopupOpen(true);
      if (onSuccess) {
        onSuccess({
          email: novoEmail,
          identifier: res?.identifier || novoEmail
        });
      }
    } catch (err) {
      setError(err?.message || 'Não foi possível atualizar o e-mail. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        id="btn-abrir-atualizar-email"
        className="alterar-senha-trigger-btn"
        onClick={handleOpenModal}
        aria-haspopup="dialog"
        aria-expanded={isModalOpen}
      >
        <div className="alterar-senha-trigger-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <div className="alterar-senha-trigger-text">
          <span className="alterar-senha-trigger-title">
            {temEmail ? 'Alterar E-mail de Acesso' : 'Cadastrar E-mail de Acesso'}
          </span>
          <span className="alterar-senha-trigger-desc">
            {temEmail ? emailAtual : 'Adicione um endereço de e-mail à sua conta'}
          </span>
        </div>
        <div className="alterar-senha-trigger-arrow" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </button>

      {isModalOpen && (
        <div
          className="alterar-senha-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) handleCloseModal();
          }}
        >
          <section
            ref={modalDialogRef}
            className="alterar-senha-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="atualizar-email-dialog-title"
            tabIndex={-1}
          >
            <div className="alterar-senha-modal-header">
              <div className="alterar-senha-header__icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div className="alterar-senha-header__text">
                <h3 id="atualizar-email-dialog-title" className="alterar-senha-header__title">
                  {temEmail ? 'Alterar E-mail' : 'Cadastrar E-mail'}
                </h3>
                <p className="alterar-senha-header__desc">
                  Informe o endereço de e-mail para acesso ao sistema e confirme com sua senha atual
                </p>
              </div>
              <button
                type="button"
                className="alterar-senha-close-btn"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                aria-label="Fechar janela de atualização de e-mail"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form className="alterar-senha-form" onSubmit={handleSubmit} noValidate>
              <div className="alterar-senha-field">
                <label className="alterar-senha-field__label" htmlFor="campo-novo-email">
                  E-mail
                </label>
                <div className="alterar-senha-input-wrap">
                  <span className="alterar-senha-input-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </span>
                  <input
                    ref={emailInputRef}
                    id="campo-novo-email"
                    type="email"
                    className="alterar-senha-input"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="usuario@empresa.com"
                    autoComplete="email"
                    maxLength={150}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="alterar-senha-field">
                <label className="alterar-senha-field__label" htmlFor="campo-email-senha-atual">
                  Senha Atual
                </label>
                <div className="alterar-senha-input-wrap">
                  <span className="alterar-senha-input-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="campo-email-senha-atual"
                    type={showSenhaAtual ? 'text' : 'password'}
                    className="alterar-senha-input"
                    value={senhaAtual}
                    onChange={(e) => {
                      setSenhaAtual(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Digite sua senha atual para confirmar"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="alterar-senha-input-toggle"
                    onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                    aria-label={showSenhaAtual ? 'Ocultar senha atual' : 'Exibir senha atual'}
                    tabIndex={-1}
                  >
                    {showSenhaAtual ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="alterar-senha-error-banner" role="alert">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="alterar-senha-actions">
                <button
                  type="button"
                  className="alterar-senha-cancel-btn"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="alterar-senha-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar E-mail'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isSuccessPopupOpen && (
        <div
          className="alterar-senha-popup-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsSuccessPopupOpen(false);
          }}
        >
          <section
            ref={successDialogRef}
            className="alterar-senha-popup-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sucesso-email-title"
            aria-describedby="sucesso-email-desc"
            tabIndex={-1}
          >
            <div className="alterar-senha-popup-icon" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 id="sucesso-email-title" className="alterar-senha-popup-title">
              E-mail Atualizado com Sucesso!
            </h3>
            <p id="sucesso-email-desc" className="alterar-senha-popup-desc">
              Seu e-mail de acesso agora é {emailSalvo}. Você já pode utilizá-lo para entrar no sistema.
            </p>
            <button
              ref={successBtnRef}
              type="button"
              className="alterar-senha-popup-btn"
              onClick={() => setIsSuccessPopupOpen(false)}
            >
              Concluir
            </button>
          </section>
        </div>
      )}
    </>
  );
};

export default AtualizarEmailCard;

