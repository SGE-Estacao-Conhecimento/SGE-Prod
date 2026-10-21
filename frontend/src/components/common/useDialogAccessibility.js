import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Padroniza o comportamento de foco dos diálogos do SGE.
 * O componente que usa o hook precisa permanecer montado apenas enquanto
 * o diálogo estiver aberto e aplicar a referência ao painel do diálogo.
 */
export default function useDialogAccessibility({ onClose, initialFocusRef, isOpen = true } = {}) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const initialFocusRefRef = useRef(initialFocusRef);
  initialFocusRefRef.current = initialFocusRef;

  useEffect(() => {
    if (!isOpen) return undefined;
    previousFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const focusInitialElement = () => {
      // Não altera o foco se o usuário já estiver com foco em algum campo dentro do diálogo
      if (dialog.contains(document.activeElement)) {
        return;
      }
      const target = initialFocusRefRef.current?.current || dialog.querySelector(FOCUSABLE_SELECTOR) || dialog;
      target.focus({ preventScroll: true });
    };
    const frame = window.requestAnimationFrame(focusInitialElement);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)]
        .filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      const previous = previousFocusRef.current;
      if (previous && document.contains(previous)) {
        window.requestAnimationFrame(() => previous.focus({ preventScroll: true }));
      }
    };
  }, [isOpen]);

  return dialogRef;
}
