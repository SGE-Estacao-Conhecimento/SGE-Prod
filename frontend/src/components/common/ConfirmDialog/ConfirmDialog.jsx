import useDialogAccessibility from '../useDialogAccessibility';
import './ConfirmDialog.css';

/** Confirmação acessível para ações destrutivas ou irreversíveis. */
export default function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  isBusy = false,
  onConfirm,
  onCancel
}) {
  const dialogRef = useDialogAccessibility({ onClose: isBusy ? undefined : onCancel });

  return (
    <div className="confirm-dialog__backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isBusy) onCancel();
    }}>
      <section
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        tabIndex={-1}
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-description">{description}</p>
        <div className="confirm-dialog__actions">
          <button type="button" className="confirm-dialog__cancel" onClick={onCancel} disabled={isBusy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-dialog__confirm confirm-dialog__confirm--${tone}`}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
