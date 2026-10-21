import React from 'react';
import { motion } from 'motion/react';

/**
 * PageTabTransition — Transição Padronizada de Abas/Telas do SGE
 * 
 * Envolve o conteúdo de cada aba com:
 * - Animação suave e ágil de entrada/saída (180ms - 200ms) sem lag.
 * - Deslocamento vertical mínimo (8px) para sensação de ancoragem tátil.
 * - Container com rolagem isolada (.sge-page-scroll) e safe-areas de viewport.
 */
const PageTabTransition = ({
  tabKey,
  children,
  className = '',
  style
}) => {
  return (
    <motion.div
      key={tabKey}
      className={`sge-page-scroll ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={style}
    >
      {children}
    </motion.div>
  );
};

export default PageTabTransition;
