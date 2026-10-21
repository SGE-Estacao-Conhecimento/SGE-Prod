import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import './SpeedDialFAB.css';

/**
 * SpeedDialFAB — Botão Flutuante de Ações Rápidas do SGE (A Geral do SGE)
 * 
 * Substitui FABs estáticos simples por um menu radial/empilhado ergonômico:
 * - Em repouso: Botão flutuante compacto com ícone '+' e indicador/badge de rascunhos em aberto.
 * - Ao abrir: Ícone gira 45° virando '×', backdrop sutil focaliza o menu e as opções sobem com microinteração ágil (150ms).
 * - Adaptação ergonômica: Posicionado a 74px do fundo no mobile (acima da BottomNav) e 28px no desktop.
 * - Touch Targets rigorosos (mínimo 44px de altura) e resposta tátil instantânea no clique (:active).
 * 
 * @param {Array} actions - Lista de ações [{ id, label, icon, onClick, variant: 'accent' | 'secondary' }]
 * @param {number} [badgeCount=0] - Número de itens em rascunho/memória para exibir no badge
 * @param {boolean} [isOpen] - Controle opcional de abertura externa
 * @param {Function} [onToggle] - Callback disparado ao alternar abertura
 * @param {string} [ariaLabel='Menu de ações rápidas'] - Rótulo de acessibilidade
 */
const SpeedDialFAB = ({
  actions = [],
  badgeCount = 0,
  isOpen: controlledIsOpen,
  onToggle,
  ariaLabel = 'Ações de estoque'
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const open = isControlled ? controlledIsOpen : internalIsOpen;

  const setOpen = useCallback((nextVal) => {
    if (!isControlled) {
      setInternalIsOpen(nextVal);
    }
    if (onToggle) {
      onToggle(nextVal);
    }
  }, [isControlled, onToggle]);

  // Fechar com a tecla ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, setOpen]);

  const handleToggle = () => {
    setOpen(!open);
  };

  const handleActionClick = (action, e) => {
    e.stopPropagation();
    setOpen(false);
    if (action.onClick) {
      action.onClick();
    }
  };

  return (
    <div className="sge-speed-dial">
      {/* Backdrop suave para isolar a atenção */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="sge-speed-dial__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <div className="sge-speed-dial__container">
        {/* Lista de Ações Empilhadas */}
        <AnimatePresence>
          {open && (
            <motion.div
              className="sge-speed-dial__actions"
              role="menu"
              aria-orientation="vertical"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {actions.map((action, idx) => {
                return (
                  <motion.button
                    key={action.id || idx}
                    type="button"
                    role="menuitem"
                    className={`sge-speed-dial__action-btn sge-speed-dial__action-btn--${action.variant || 'secondary'}`}
                    onClick={(e) => handleActionClick(action, e)}
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    transition={{
                      duration: 0.14,
                      delay: idx * 0.03,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                    whileTap={{ scale: 0.96 }}
                  >
                    {action.icon && (
                      <span className="sge-speed-dial__action-icon" aria-hidden="true">
                        {action.icon}
                      </span>
                    )}
                    <span className="sge-speed-dial__action-label">
                      {action.label}
                    </span>
                    {action.badge && (
                      <span className="sge-speed-dial__action-badge">
                        {action.badge}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botão Gatilho Principal (FAB) */}
        <motion.button
          type="button"
          className={`sge-speed-dial__trigger ${open ? 'sge-speed-dial__trigger--open' : ''}`}
          onClick={handleToggle}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="menu"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.94 }}
        >
          {/* Badge Numérico de Rascunho / Itens pendentes */}
          {badgeCount > 0 && !open && (
            <motion.span
              className="sge-speed-dial__badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              title={`${badgeCount} item(ns) em rascunho de remessa`}
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </motion.span>
          )}

          {/* Ícone '+' rotativo que vira '×' quando aberto */}
          <span className={`sge-speed-dial__icon ${open ? 'sge-speed-dial__icon--open' : ''}`}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
        </motion.button>
      </div>
    </div>
  );
};

export default SpeedDialFAB;
