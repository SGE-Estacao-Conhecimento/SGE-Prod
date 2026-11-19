import React from 'react';
import { motion } from 'motion/react';

/**
 * BottomNav — Barra de Navegação Inferior Universal Mobile do SGE
 * 
 * Implementa rigorosamente as diretrizes SGE:
 * - 100% sólida em branco puro (#FFFFFF) com separação nítida (zero custo de GPU).
 * - Transição suave com física de mola (Spring) para a cápsula indicadora ativa.
 * - Feedback físico tátil instantâneo no toque (whileTap scale 0.90).
 * - Indicadores numéricos compactos (badges) para notificações e pedidos.
 */
const BottomNav = ({
  items = [],
  activeNav,
  onNavClick,
  layoutId = 'sgeBottomNavActiveIndicator',
  ariaLabel = 'Navegação móvel'
}) => {
  return (
    <nav className="sge-bottom-nav" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = activeNav === item.id;
        const badge = item.badge;
        const isBadgeObject = badge && typeof badge === 'object';
        const isDot = isBadgeObject ? Boolean(badge.dot) : badge === 'dot';
        const badgeCount = isBadgeObject ? Number(badge.count || 0) : Number(badge || 0);
        const badgeVariant = (isBadgeObject && badge.variant) || (badgeCount > 0 ? 'danger' : 'warning');
        const showBadge = isDot || badgeCount > 0;

        return (
          <motion.button
            key={item.id}
            type="button"
            id={`sge-nav-${item.id}`}
            className={`sge-bottom-nav__item ${isActive ? 'sge-bottom-nav__item--active' : ''}`}
            onClick={() => onNavClick?.(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            whileTap={{ scale: 0.90 }}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="sge-bottom-nav__active-bg"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="sge-bottom-nav__icon">
              {item.icon}
              {showBadge && (
                <span
                  className={`sge-bottom-nav__badge ${isDot ? 'sge-bottom-nav__badge--dot' : ''} sge-bottom-nav__badge--${badgeVariant}`}
                  aria-hidden={isDot ? 'true' : undefined}
                >
                  {!isDot ? badgeCount : null}
                </span>
              )}
            </span>
            <span className="sge-bottom-nav__label">{item.label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
