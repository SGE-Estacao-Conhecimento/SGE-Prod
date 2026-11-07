import React, { useState, useRef } from 'react';
import ForgotPasswordModal from '../ForgotPasswordModal/ForgotPasswordModal';
import useDialogAccessibility from '../useDialogAccessibility';
import { alterarSenha } from '../../../services/api/authService';
import './AlterarSenhaCard.css';

/**
 * AlterarSenhaCard — Módulo padronizado de alteração de senha para os Perfis do SGE.
 * Apresenta um gatilho minimalista em botão que abre o modal com o formulário completo,
 * conferência da senha atual, igualdade entre nova senha e confirmação, reuso do esqueceu a senha
 * e popup de conclusão com feedback visual.
 *
 * @param {Object} props
 * @param {Object} [props.user] - Dados do usuário logado (email, identificador, perfil)
 * @param {Function} [props.onSuccess] - Callback opcional disparado ao concluir a alteração
 */
const AlterarSenhaCard = ({ user, onSuccess }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmeSenha, setConfirmeSenha] = useState('');

  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmeSenha, setShowConfirmeSenha] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [isSuccessPopupOpen, setIsSuccessPopupOpen] = useState(false);

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setError('');
  };

  const senhaAtualInputRef = useRef(null);
  const modalDialogRef = useDialogAccessibility({
    isOpen: isModalOpen,
    onClose: isSubmitting ? undefined : handleCloseModal,
    initialFocusRef: senhaAtualInputRef
  });

  const successBtnRef = useRef(null);
  const successDialogRef = useDialogAccessibility({
    isOpen: isSuccessPopupOpen,
    onClose: () => setIsSuccessPopupOpen(false),
    initialFocusRef: successBtnRef
  });

  const handleOpenModal = () => {
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validação da senha atual
    if (!senhaAtual || !senhaAtual.trim()) {
      setError('Informe sua senha atual para autorizar a alteração.');
      return;
    }

    // Validação da nova senha
    if (!novaSenha || !novaSenha.trim()) {
      setError('Informe a nova senha desejada.');
      return;
    }

    if (novaSenha.length < 8) {
      setError('A nova senha deve possuir no mínimo 8 caracteres.');
      return;
    }

    // Validação de correspondência entre as duas senhas
    if (novaSenha !== confirmeSenha) {
      setError('A confirmação da senha não coincide com a nova senha digitada.');
      return;
    }

    setIsSubmitting(true);

    // A API confere a senha atual; no modo standalone a chamada é simulada.
    try {
      await alterarSenha({ senhaAtual, novaSenha });
    } catch (err) {
      setIsSubmitting(false);
      setError(err?.message || 'Não foi possível alterar a senha. Tente novamente.');
      return;
    }

    setIsSubmitting(false);
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmeSenha('');
    setError('');
    setIsModalOpen(false);
    setIsSuccessPopupOpen(true);
    if (onSuccess) onSuccess();
  };

  return (
    <>
      {/* Botão Minimalista para a Seção de Perfil */}
      <button
        type="button"
        id="btn-abrir-alterar-senha"
        className="alterar-senha-trigger-btn"
        onClick={handleOpenModal}
        aria-haspopup="dialog"
        aria-expanded={isModalOpen}
      >
        <div className="alterar-senha-trigger-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="alterar-senha-trigger-text">
          <span className="alterar-senha-trigger-title">Alterar Senha de Acesso</span>
          <span className="alterar-senha-trigger-desc">Atualize sua credencial de autenticação com segurança</span>
        </div>
        <div className="alterar-senha-trigger-arrow" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </button>

      {/* Modal Dialog com o Card de Alteração de Senha */}
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
            aria-labelledby="alterar-senha-dialog-title"
            tabIndex={-1}
          >
            {/* Cabeçalho do Modal */}
            <div className="alterar-senha-modal-header">
              <div className="alterar-senha-header__icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div className="alterar-senha-header__text">
                <h3 id="alterar-senha-dialog-title" className="alterar-senha-header__title">
                  Alterar Senha
                </h3>
                <p className="alterar-senha-header__desc">
                  Altere sua credencial de acesso com segurança e confirmação em duas etapas
                </p>
              </div>
              <button
                type="button"
                className="alterar-senha-close-btn"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                aria-label="Fechar janela de alteração de senha"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Formulário de Alteração */}
            <form className="alterar-senha-form" onSubmit={handleSubmit} noValidate>
              {/* Campo 1: Senha Atual + Link 'Esqueceu a senha?' */}
              <div className="alterar-senha-field">
                <div className="alterar-senha-field__header">
                  <label className="alterar-senha-field__label" htmlFor="campo-senha-atual">
                    Senha Atual
                  </label>
                  <button
                    type="button"
                    className="alterar-senha-field__forgot-btn"
                    onClick={() => setIsForgotModalOpen(true)}
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
                <div className="alterar-senha-input-wrap">
                  <span className="alterar-senha-input-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    ref={senhaAtualInputRef}
                    id="campo-senha-atual"
                    type={showSenhaAtual ? 'text' : 'password'}
                    className="alterar-senha-input"
                    value={senhaAtual}
                    onChange={(e) => {
                      setSenhaAtual(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Digite sua senha atual"
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

              {/* Campo 2: Nova Senha */}
              <div className="alterar-senha-field">
                <label className="alterar-senha-field__label" htmlFor="campo-nova-senha">
                  Nova Senha
                </label>
                <div className="alterar-senha-input-wrap">
                  <span className="alterar-senha-input-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5M3 21l9-9m3-3l3 3-1.5 1.5" />
                      <circle cx="7.5" cy="16.5" r="4.5" />
                    </svg>
                  </span>
                  <input
                    id="campo-nova-senha"
                    type={showNovaSenha ? 'text' : 'password'}
                    className="alterar-senha-input"
                    value={novaSenha}
                    onChange={(e) => {
                      setNovaSenha(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Digite a nova senha (mínimo 8 caracteres)"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="alterar-senha-input-toggle"
                    onClick={() => setShowNovaSenha(!showNovaSenha)}
                    aria-label={showNovaSenha ? 'Ocultar nova senha' : 'Exibir nova senha'}
                    tabIndex={-1}
                  >
                    {showNovaSenha ? (
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

              {/* Campo 3: Confirme a Nova Senha */}
              <div className="alterar-senha-field">
                <label className="alterar-senha-field__label" htmlFor="campo-confirme-senha">
                  Confirme a Nova Senha
                </label>
                <div className="alterar-senha-input-wrap">
                  <span className="alterar-senha-input-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <input
                    id="campo-confirme-senha"
                    type={showConfirmeSenha ? 'text' : 'password'}
                    className="alterar-senha-input"
                    value={confirmeSenha}
                    onChange={(e) => {
                      setConfirmeSenha(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Confirme exatamente a nova senha"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="alterar-senha-input-toggle"
                    onClick={() => setShowConfirmeSenha(!showConfirmeSenha)}
                    aria-label={showConfirmeSenha ? 'Ocultar confirmação de senha' : 'Exibir confirmação de senha'}
                    tabIndex={-1}
                  >
                    {showConfirmeSenha ? (
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

              {/* Mensagem de Erro de Validação */}
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

              {/* Ações do Modal: Cancelar e Salvar */}
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
                  {isSubmitting ? (
                    <span>Atualizando...</span>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                      <span>Salvar Nova Senha</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Reutilizado de 'Esqueceu sua senha?' */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        initialEmail={user?.email || user?.identifier || ''}
        onClose={() => setIsForgotModalOpen(false)}
      />

      {/* Popup de Conclusão com Sucesso */}
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
            aria-labelledby="sucesso-senha-title"
            aria-describedby="sucesso-senha-desc"
            tabIndex={-1}
          >
            <div className="alterar-senha-popup-icon" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 id="sucesso-senha-title" className="alterar-senha-popup-title">
              Senha Alterada com Sucesso!
            </h3>
            <p id="sucesso-senha-desc" className="alterar-senha-popup-desc">
              Sua nova credencial de acesso foi salva com sucesso. Utilize a nova senha em seus próximos acessos ao sistema.
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

export default AlterarSenhaCard;
