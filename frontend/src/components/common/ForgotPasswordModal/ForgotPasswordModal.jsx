import React, { useRef, useState, useEffect } from 'react';
import useDialogAccessibility from '../useDialogAccessibility';
import { solicitarRedefinicao } from '../../../services/api/authService';
import './ForgotPasswordModal.css';

/**
 * ForgotPasswordModal — Modal padronizado de recuperação/redefinição de senha (A Geral do SGE).
 * Suporta modo auto-gerenciado ou modo controlado para uso no Login e nos Perfis de Usuário.
 *
 * @param {Object} props
 * @param {boolean} [props.isOpen=true] - Controle de visibilidade se montado condicionalmente
 * @param {string} [props.initialEmail=''] - E-mail pré-preenchido (ex: e-mail do usuário logado)
 * @param {string} [props.email] - Valor controlado de e-mail (opcional)
 * @param {Function} [props.onEmailChange] - Manipulador controlado de e-mail (opcional)
 * @param {Function} [props.onSubmit] - Callback personalizado de submissão (opcional)
 * @param {Function} props.onClose - Callback de fechamento do modal
 * @param {string} [props.message] - Mensagem de sucesso externa (opcional)
 * @param {string} [props.error] - Mensagem de erro externa (opcional)
 * @param {boolean} [props.isLoading] - Estado de carregamento externo (opcional)
 */
const ForgotPasswordModal = ({
  isOpen = true,
  initialEmail = '',
  email: controlledEmail,
  onEmailChange: controlledOnEmailChange,
  onSubmit: customOnSubmit,
  onClose,
  message: controlledMessage,
  error: controlledError,
  isLoading: controlledLoading,
  zIndex = 1100
}) => {
  const isControlled = controlledEmail !== undefined;
  const [internalEmail, setInternalEmail] = useState(initialEmail || '');
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalMessage, setInternalMessage] = useState('');
  const [internalError, setInternalError] = useState('');

  const emailRef = useRef(null);

  useEffect(() => {
    if (initialEmail && !isControlled) {
      setInternalEmail(initialEmail);
    }
  }, [initialEmail, isControlled]);

  const currentEmail = isControlled ? controlledEmail : internalEmail;
  const currentLoading = controlledLoading !== undefined ? controlledLoading : internalLoading;
  const currentMessage = controlledMessage !== undefined ? controlledMessage : internalMessage;
  const currentError = controlledError !== undefined ? controlledError : internalError;

  const dialogRef = useDialogAccessibility({
    onClose: currentLoading ? undefined : onClose,
    initialFocusRef: emailRef,
    isOpen
  });

  if (!isOpen) return null;

  const handleEmailChange = (e) => {
    if (isControlled && controlledOnEmailChange) {
      controlledOnEmailChange(e);
    } else {
      setInternalEmail(e.target.value);
    }
    if (internalError) setInternalError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (customOnSubmit) {
      return customOnSubmit(e);
    }

    if (!currentEmail || !currentEmail.trim()) {
      setInternalError('Por favor, informe seu e-mail de acesso.');
      return;
    }

    setInternalLoading(true);
    setInternalMessage('');
    setInternalError('');

    try {
      const response = await solicitarRedefinicao(currentEmail.trim());
      setInternalMessage(response?.message || 'Link de redefinição enviado com sucesso para o seu e-mail.');
    } catch (err) {
      setInternalError(err.message || 'Não foi possível solicitar a redefinição de senha.');
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <div
      className="sge-forgot-backdrop"
      style={{ zIndex }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !currentLoading) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="sge-forgot-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sge-forgot-title"
        aria-describedby="sge-forgot-desc"
        tabIndex={-1}
      >
        <div className="sge-forgot-header">
          <div className="sge-forgot-icon-wrap" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="sge-forgot-title-area">
            <h3 id="sge-forgot-title" className="sge-forgot-title">Esqueceu sua senha?</h3>
            <p id="sge-forgot-desc" className="sge-forgot-description">
              Informe seu e-mail cadastrado. Se ele constar no sistema, enviaremos as instruções para a criação de uma nova credencial.
            </p>
          </div>
        </div>

        <form className="sge-forgot-form" onSubmit={handleSubmit} noValidate>
          <div className="sge-forgot-field">
            <label className="sge-forgot-label" htmlFor="sge-forgot-email">
              E-mail de Acesso
            </label>
            <input
              ref={emailRef}
              id="sge-forgot-email"
              className="sge-forgot-input"
              type="email"
              value={currentEmail}
              onChange={handleEmailChange}
              placeholder="seu.email@estacao.org.br"
              autoComplete="email"
              required
              disabled={currentLoading}
              aria-invalid={Boolean(currentError)}
            />
          </div>

          {currentMessage && (
            <div className="sge-forgot-success" role="status">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{currentMessage}</span>
            </div>
          )}

          {currentError && (
            <div className="sge-forgot-error" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{currentError}</span>
            </div>
          )}

          <div className="sge-forgot-actions">
            <button
              type="button"
              className="sge-forgot-btn-cancel"
              onClick={onClose}
              disabled={currentLoading}
            >
              {currentMessage ? 'Fechar' : 'Cancelar'}
            </button>
            <button
              type="submit"
              className="sge-forgot-btn-submit"
              disabled={currentLoading}
            >
              {currentLoading ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sge-spin" aria-hidden="true">
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                  </svg>
                  <span>Enviando...</span>
                </>
              ) : (
                'Enviar link de redefinição'
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default ForgotPasswordModal;
