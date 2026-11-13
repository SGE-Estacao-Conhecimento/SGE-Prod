import React, { useState, useEffect } from 'react';
import { useDialogAccessibility } from '../common';
import './TransferirPatrimonioModal.css';

const TransferirPatrimonioModal = ({
  isOpen,
  onClose,
  onConfirm,
  item = null,
  ambientes = [],
  usuarios = []
}) => {
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useDialogAccessibility({ isOpen, onClose: submitting ? undefined : onClose });

  const [novoAmbienteId, setNovoAmbienteId] = useState('');
  const [novoResponsavelId, setNovoResponsavelId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (item) {
      setNovoAmbienteId(item.ambienteId || '');
      setNovoResponsavelId(item.responsavelId || '');
      setObservacoes('');
      setErrorMsg(null);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirm(item.id, {
        novoAmbienteId: novoAmbienteId ? Number(novoAmbienteId) : null,
        novoResponsavelId: novoResponsavelId ? Number(novoResponsavelId) : null,
        observacoes: observacoes.trim() || undefined
      });
      onClose();
    } catch (err) {
      setErrorMsg(err?.message || 'Erro ao transferir patrimônio.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="transferir-modal__overlay" role="presentation">
      <div
        className="transferir-modal__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transferir-modal-title"
      >
        <div className="transferir-modal__header">
          <div>
            <h3 id="transferir-modal-title" className="transferir-modal__title">Transferir Patrimônio</h3>
            <p className="transferir-modal__subtitle">
              Plaqueta: <strong>{item.numeroPatrimonio}</strong> - {item.nomePatrimonio}
            </p>
          </div>
          <button
            type="button"
            className="transferir-modal__close-btn"
            onClick={onClose}
            aria-label="Fechar"
            disabled={submitting}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="transferir-modal__form">
          {errorMsg && (
            <div className="transferir-modal__error-banner" role="alert">
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="transferir-modal__field">
            <label htmlFor="select-novo-ambiente" className="transferir-modal__label">
              Novo Ambiente de Destino
            </label>
            <select
              id="select-novo-ambiente"
              className="transferir-modal__select"
              value={novoAmbienteId}
              onChange={(e) => setNovoAmbienteId(e.target.value)}
            >
              <option value="">Sem ambiente (desalocado)</option>
              {ambientes.map(a => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </div>

          <div className="transferir-modal__field">
            <label htmlFor="select-novo-responsavel" className="transferir-modal__label">
              Nova Pessoa Vinculada (Responsável)
            </label>
            <select
              id="select-novo-responsavel"
              className="transferir-modal__select"
              value={novoResponsavelId}
              onChange={(e) => setNovoResponsavelId(e.target.value)}
            >
              <option value="">Nenhum colaborador vinculado</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nome} ({u.perfil})</option>
              ))}
            </select>
          </div>

          <div className="transferir-modal__field">
            <label htmlFor="input-transferencia-obs" className="transferir-modal__label">
              Motivo ou Observação da Movimentação
            </label>
            <textarea
              id="input-transferencia-obs"
              className="transferir-modal__textarea"
              rows="2"
              placeholder="Ex: Mudança de setor, remanejamento de mobiliário..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <div className="transferir-modal__footer">
            <button
              type="button"
              className="transferir-modal__cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="transferir-modal__submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Salvando...' : 'Confirmar Transferência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferirPatrimonioModal;

