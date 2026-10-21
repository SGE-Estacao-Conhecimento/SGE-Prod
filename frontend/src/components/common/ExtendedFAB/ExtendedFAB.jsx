import React from 'react';
import { motion } from 'motion/react';

/**
 * ExtendedFAB — Botão de Ação Flutuante em Pílula do SGE
 * 
 * Botão ergonômico de alta proeminência visual para ações primárias:
 * - Posicionado acima da barra de navegação no mobile e no canto direito no desktop.
 * - Formato pílula (raio 9999px) com ícone SVG e rótulo claro.
 * - Sombra de profundidade e física com motion (hover sutil e active 0.95).
 */
const ExtendedFAB = ({
  icon,
  label,
  onClick,
  className = '',
  ariaLabel,
  title
}) => {
  return (
    <motion.button
      type="button"
      className={`sge-extended-fab ${className}`}
      onClick={onClick}
      aria-label={ariaLabel || label}
      title={title || label}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.95 }}
    >
      {icon && <span className="sge-extended-fab__icon">{icon}</span>}
      <span className="sge-extended-fab__label">{label}</span>
    </motion.button>
  );
};

export default ExtendedFAB;
