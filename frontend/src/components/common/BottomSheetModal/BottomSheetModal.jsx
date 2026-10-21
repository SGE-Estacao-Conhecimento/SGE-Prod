import React, { useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import './BottomSheetModal.css';

/**
 * BottomSheetModal — Modal / Bottom Sheet Universal Padronizado do SGE (A Geral)
 * 
 * - Mobile-first: opera como Bottom Sheet colado no chão com gesto tátil de arrastar para baixo.
 * - Desktop-first: opera como caixa de diálogo centralizada com proporção harmônica.
 * - Física: Zoom simétrico (In/Out), mola tátil e backdrop com blur.
 * - Acessibilidade: tecla Escape, bloqueio de scroll, touch targets de 44px.
 * 
 * @param {boolean} isOpen - Controla exibição do modal
 * @param {Function} onClose - Callback chamado para fechar
 * @param {string} [title] - Título principal do modal
 * @param {string} [subtitle] - Subtítulo / Categoria em caixa alta suave
 * @param {React.ReactNode} [badge] - Badge de status ou urgência opcional no topo
 * @param {React.ReactNode} children - Conteúdo interno do modal / formulário
 * @param {React.ReactNode} [footer] - Ações do rodapé (botões Cancelar/Confirmar)
 * @param {string} [maxWidth='520px'] - Largura máxima no desktop
 * @param {string} [className=''] - Classes adicionais
 */
const BottomSheetModal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
  maxWidth = '520px',
  className = '',
  zIndex = 10000
}) => {
  const sheetRef = useRef(null);
  const backdropRef = useRef(null);
  const isDraggingRef = useRef(false);
  const isClosingRef = useRef(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const startTimeRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const closeTimerRef = useRef(null);

  // Limpa timers ao desmontar
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Reseta referências e estilos inline ao abrir ou ao trocar de item
  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      isClosingRef.current = false;
      isDraggingRef.current = false;
      hasDraggedRef.current = false;
      if (sheetRef.current) {
        sheetRef.current.classList.remove('is-closing');
        sheetRef.current.style.display = '';
        sheetRef.current.style.opacity = '';
        sheetRef.current.style.transform = '';
        sheetRef.current.style.transition = '';
        sheetRef.current.style.transformOrigin = 'center center';
        sheetRef.current.style.pointerEvents = '';
      }
      if (backdropRef.current) {
        backdropRef.current.classList.remove('is-closing');
        backdropRef.current.style.display = '';
        backdropRef.current.style.opacity = '';
        backdropRef.current.style.transition = '';
        backdropRef.current.style.pointerEvents = '';
      }
    }
  }, [isOpen, title, subtitle]);

  // Fechamento padrão (Zoom Out simétrico com o Zoom In de abertura)
  const handleRequestClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    // Desativa pointer-events imediatamente para não bloquear nenhum clique
    if (backdropRef.current) {
      backdropRef.current.classList.add('is-closing');
      backdropRef.current.style.pointerEvents = 'none';
    }
    if (sheetRef.current) {
      sheetRef.current.classList.add('is-closing');
      sheetRef.current.style.pointerEvents = 'none';
      sheetRef.current.style.transformOrigin = 'center center';
    }
    if (onClose) onClose();
  }, [onClose]);

  // Atalho Escape para fechar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleRequestClose]);

  // Gestos de Arrastar para Baixo (Swipe-to-Dismiss Mobile)
  const onDragStart = (clientY) => {
    if (isClosingRef.current) return;
    isDraggingRef.current = true;
    startYRef.current = clientY;
    currentYRef.current = clientY;
    startTimeRef.current = Date.now();
    hasDraggedRef.current = false;
  };

  const onDragMove = (clientY) => {
    if (!isDraggingRef.current || isClosingRef.current) return;
    currentYRef.current = clientY;
    const deltaY = clientY - startYRef.current;

    if (Math.abs(deltaY) > 12) {
      hasDraggedRef.current = true;
    }

    if (!sheetRef.current) return;

    if (deltaY > 0) {
      // Arrastando para baixo: acompanha diretamente o dedo em tempo real
      sheetRef.current.style.transformOrigin = 'bottom center';
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;

      if (backdropRef.current) {
        backdropRef.current.style.transition = 'none';
        const opacity = Math.max(0, 1 - (deltaY / 320));
        backdropRef.current.style.opacity = `${opacity}`;
      }
    } else {
      // Puxando para cima: estiramento elástico suave com base no chão
      sheetRef.current.style.transformOrigin = 'bottom center';
      sheetRef.current.style.transition = 'none';
      const pullUp = Math.abs(deltaY);
      const stretch = Math.min(Math.pow(pullUp, 0.6) * 0.005, 0.06);
      sheetRef.current.style.transform = `scaleY(${1 + stretch})`;
    }
  };

  const onDragEnd = () => {
    if (!isDraggingRef.current || isClosingRef.current) return;
    isDraggingRef.current = false;

    const deltaY = currentYRef.current - startYRef.current;
    const elapsedTime = Math.max(Date.now() - startTimeRef.current, 1);
    const velocityY = deltaY / elapsedTime;

    // Se arrastou mais de 60px para baixo ou deu um puxão rápido (> 0.28 px/ms)
    if (deltaY > 60 || (deltaY > 20 && velocityY > 0.28)) {
      isClosingRef.current = true;
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      // Libera cliques imediatamente no exato instante em que solta o dedo
      if (backdropRef.current) {
        backdropRef.current.classList.add('is-closing');
        backdropRef.current.style.pointerEvents = 'none';
        backdropRef.current.style.transition = 'opacity 0.12s ease-out';
        backdropRef.current.style.opacity = '0';
      }
      if (sheetRef.current) {
        sheetRef.current.classList.add('is-closing');
        sheetRef.current.style.pointerEvents = 'none';
        sheetRef.current.style.transformOrigin = 'bottom center';
        sheetRef.current.style.transition = 'transform 0.12s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.1s ease-out';
        sheetRef.current.style.transform = 'translateY(100%)';
        sheetRef.current.style.opacity = '0';
      }

      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        if (sheetRef.current) sheetRef.current.style.display = 'none';
        if (backdropRef.current) backdropRef.current.style.display = 'none';
        if (onClose) onClose();
        isClosingRef.current = false;
        closeTimerRef.current = null;
      }, 120);
    } else {
      // Retorna com efeito de mola elástica suave
      if (sheetRef.current) {
        sheetRef.current.style.transformOrigin = 'bottom center';
        sheetRef.current.style.transition = 'transform 0.24s cubic-bezier(0.175, 0.885, 0.32, 1.15)';
        sheetRef.current.style.transform = 'translateY(0) scaleY(1)';
      }
      if (backdropRef.current) {
        backdropRef.current.style.transition = 'opacity 0.18s ease';
        backdropRef.current.style.opacity = '1';
      }
    }
  };

  // Suporte a Touch
  const handleTouchStart = (e) => {
    if (isClosingRef.current) return;
    if (e.touches && e.touches.length === 1) {
      onDragStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (isClosingRef.current) return;
    if (e.touches && e.touches.length === 1) {
      if (e.cancelable) e.preventDefault();
      onDragMove(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = (e) => {
    if (hasDraggedRef.current && e && e.cancelable) {
      e.preventDefault();
    }
    onDragEnd();
  };

  // Suporte a Pointer / Mouse
  const handlePointerDown = (e) => {
    if (isClosingRef.current || e.pointerType === 'touch') return;
    if (e.button !== undefined && e.button !== 0) return;
    onDragStart(e.clientY);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e) => {
    if (isClosingRef.current || e.pointerType === 'touch') return;
    onDragMove(e.clientY);
  };

  const handlePointerUp = (e) => {
    if (e.pointerType === 'touch') return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    onDragEnd();
  };

  const handleHandleClick = (e) => {
    if (e) e.stopPropagation();
    if (!hasDraggedRef.current && !isClosingRef.current) {
      handleRequestClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="sge-modal-backdrop"
          ref={backdropRef}
          className="sge-modal-backdrop"
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, pointerEvents: 'auto', transition: { duration: 0.16, ease: "easeOut" } }}
          exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.12, ease: "easeOut" } }}
          onClick={handleRequestClose}
        >
          <motion.div
            key="sge-modal-sheet"
            ref={sheetRef}
            className={`sge-bottom-sheet ${className}`}
            style={{ maxWidth }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1, pointerEvents: 'auto', transition: { type: "spring", damping: 28, stiffness: 380 } }}
            exit={{ opacity: 0, scale: 0.94, pointerEvents: 'none', transition: { duration: 0.12, ease: "easeOut" } }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Puxador para mobile (toque ou arraste para fechar) */}
            <div
              className="sge-sheet-handle-wrap"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={handleHandleClick}
              role="button"
              tabIndex={0}
              aria-label="Arrastar para baixo para fechar"
              title="Arraste para baixo para fechar"
            >
              <div className="sge-sheet-handle" />
            </div>

            {/* Cabeçalho do Modal (Título primeiro, metadados/subtítulo em baixo) */}
            {(title || subtitle || badge) && (
              <div
                className="sge-bottom-sheet__header"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
              >
                <div className="sge-bottom-sheet__header-title">
                  {title && (typeof title === 'string' ? <h3 className="sge-sheet-title">{title}</h3> : title)}
                  {(subtitle || badge) && (
                    <div className="sge-sheet-subtitle-row">
                      {badge}
                      {subtitle && <span className="sge-sheet-subtitle">{subtitle}</span>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Corpo / Conteúdo do Modal */}
            <div className={`sge-bottom-sheet__body ${!footer ? 'sge-bottom-sheet__body--no-footer' : ''}`}>
              {children}
            </div>

            {/* Rodapé opcional de Ações */}
            {footer && (
              <div className="sge-bottom-sheet__footer">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BottomSheetModal;
