import React from 'react';
import './StatusBadge.css';

/**
 * StatusBadge — Pílula de Estado Padronizada do SGE (A Geral)
 * 
 * Unifica etiquetas de status operacionais para materiais e pedidos,
 * com micro-ponto luminoso, tipografia estável e cores institucionais (AGENTS.md).
 * 
 * @param {string} status - Código do status ('pendente', 'em-separacao', 'pronto', 'atendido', 'cancelado', 'normal', 'baixo', 'sem-estoque', 'urgente')
 * @param {string} [label] - Texto opcional customizado (se omitido, usa o label padrão do status)
 * @param {number|string} [count] - Quantidade complementar opcional (ex: saldo ou itens)
 * @param {boolean} [pulse=false] - Se true, anima o micro-ponto com pulso luminoso sutil
 * @param {'sm'|'md'} [size='md'] - Escala do badge
 * @param {string} [className=''] - Classes adicionais
 */
const STATUS_CONFIG = {
  // Pedidos
  'pendente': {
    label: 'Aguardando Separação',
    className: 'sge-status-badge--warning',
    dotClass: 'sge-status-badge__dot--warning',
    pulse: true
  },
  'aguardando-separacao': {
    label: 'Aguardando Separação',
    className: 'sge-status-badge--warning',
    dotClass: 'sge-status-badge__dot--warning',
    pulse: true
  },
  'em-separacao': {
    label: 'Em Separação',
    className: 'sge-status-badge--info',
    dotClass: 'sge-status-badge__dot--info',
    pulse: true
  },
  'pronto': {
    label: 'Pronto para Retirada',
    className: 'sge-status-badge--success',
    dotClass: 'sge-status-badge__dot--success'
  },
  'pronto-para-retirada': {
    label: 'Pronto para Retirada',
    className: 'sge-status-badge--success',
    dotClass: 'sge-status-badge__dot--success'
  },
  'parcialmente-disponivel': {
    label: 'Parcialmente Disponível',
    className: 'sge-status-badge--partial',
    dotClass: 'sge-status-badge__dot--partial',
    pulse: true
  },
  'atendido-parcialmente': {
    label: 'Atendido Parcialmente',
    className: 'sge-status-badge--partial',
    dotClass: 'sge-status-badge__dot--partial',
    pulse: true
  },
  'entregue': {
    label: 'Entregue',
    className: 'sge-status-badge--success',
    dotClass: 'sge-status-badge__dot--success'
  },
  'concluido': {
    label: 'Concluído',
    className: 'sge-status-badge--success',
    dotClass: 'sge-status-badge__dot--success'
  },
  'atendido': {
    label: 'Entregue',
    className: 'sge-status-badge--success',
    dotClass: 'sge-status-badge__dot--success'
  },
  'estoque-insuficiente': {
    label: 'Estoque Insuficiente',
    className: 'sge-status-badge--danger',
    dotClass: 'sge-status-badge__dot--danger'
  },
  'indisponivel': {
    label: 'Estoque Insuficiente',
    className: 'sge-status-badge--danger',
    dotClass: 'sge-status-badge__dot--danger'
  },
  'cancelado': {
    label: 'Cancelado',
    className: 'sge-status-badge--neutral',
    dotClass: 'sge-status-badge__dot--neutral'
  },
  'urgente': {
    label: 'Urgente',
    className: 'sge-status-badge--urgent',
    dotClass: 'sge-status-badge__dot--urgent',
    isUrgentIcon: true,
    pulse: true
  },

  // Estoque
  'normal': {
    label: 'Em Estoque',
    className: 'sge-status-badge--success',
    dotClass: 'sge-status-badge__dot--success'
  },
  'regular': {
    label: 'Regular',
    className: 'sge-status-badge--success',
    dotClass: 'sge-status-badge__dot--success'
  },
  'baixo': {
    label: 'Estoque Baixo',
    className: 'sge-status-badge--warning',
    dotClass: 'sge-status-badge__dot--warning',
    pulse: true
  },
  'estoque-baixo': {
    label: 'Estoque Baixo',
    className: 'sge-status-badge--warning',
    dotClass: 'sge-status-badge__dot--warning',
    pulse: true
  },
  'atencao': {
    label: 'Atenção',
    className: 'sge-status-badge--warning',
    dotClass: 'sge-status-badge__dot--warning',
    pulse: true
  },
  'sem-estoque': {
    label: 'Sem Estoque',
    className: 'sge-status-badge--danger',
    dotClass: 'sge-status-badge__dot--danger'
  }
};

const normalizeKey = (key) => {
  if (!key) return 'normal';
  return String(key)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '-');
};

const StatusBadge = ({
  status,
  label,
  count,
  pulse,
  size = 'md',
  className = ''
}) => {
  const normKey = normalizeKey(status);
  const cfg = STATUS_CONFIG[normKey] || STATUS_CONFIG['normal'];

  const displayLabel = label || cfg.label;
  const shouldPulse = pulse !== undefined ? pulse : !!cfg.pulse;

  return (
    <span
      className={`sge-status-badge ${cfg.className} sge-status-badge--${size} ${className}`}
    >
      {cfg.isUrgentIcon ? (
        <svg
          className="sge-status-badge__icon"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ) : (
        <span
          className={`sge-status-badge__dot ${cfg.dotClass} ${shouldPulse ? 'sge-status-badge__dot--pulse' : ''}`}
          aria-hidden="true"
        />
      )}

      <span className="sge-status-badge__label">
        {displayLabel}
        {count !== undefined && count !== null && (
          <strong className="sge-status-badge__count"> ({count})</strong>
        )}
      </span>
    </span>
  );
};

export default StatusBadge;
