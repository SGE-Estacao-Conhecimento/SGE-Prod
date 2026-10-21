import React from 'react';
import { motion } from 'motion/react';
import './QuantityStepper.css';

/**
 * QuantityStepper — Seletor Numérico Tátil do SGE (A Geral)
 * 
 * Controles de incremento/decremento com feedback de mola física,
 * campo numérico otimizado para mobile e suporte a atalhos rápidos (+1, +5, etc).
 * 
 * @param {number|string} value - Valor atual
 * @param {Function} onChange - Callback ao alterar (recebe novo valor número)
 * @param {number} [min=1] - Valor mínimo permitido
 * @param {number} [max=99999] - Valor máximo permitido
 * @param {number} [step=1] - Passo de incremento
 * @param {string} [unit=''] - Sufixo de unidade opcional
 * @param {Array<number>} [quickPills] - Lista de atalhos rápidos (ex: [1, 5, 10, 25])
 * @param {boolean} [disabled=false] - Se desabilitado
 * @param {string} [ariaLabel='Quantidade'] - Rótulo de acessibilidade
 * @param {string} [className=''] - Classes adicionais
 */
const QuantityStepper = ({
  value,
  onChange,
  min = 1,
  max = 99999,
  step = 1,
  unit = '',
  quickPills,
  disabled = false,
  ariaLabel = 'Quantidade',
  className = ''
}) => {
  const currentNum = typeof value === 'number' ? value : parseInt(value, 10) || min;

  const handleDecrement = (e) => {
    if (e) e.stopPropagation();
    if (disabled) return;
    const next = Math.max(min, currentNum - step);
    onChange(next);
  };

  const handleIncrement = (e) => {
    if (e) e.stopPropagation();
    if (disabled) return;
    const next = Math.min(max, currentNum + step);
    onChange(next);
  };

  const handleInputChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw === '') {
      onChange('');
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      onChange(Math.min(max, parsed));
    }
  };

  const handleBlur = () => {
    if (value === '' || isNaN(parseInt(value, 10)) || parseInt(value, 10) < min) {
      onChange(min);
    }
  };

  const handleQuickAdd = (amount, e) => {
    if (e) e.stopPropagation();
    if (disabled) return;
    const next = Math.min(max, Math.max(min, currentNum + amount));
    onChange(next);
  };

  return (
    <div className={`sge-stepper-container ${className}`}>
      <div className="sge-stepper">
        <motion.button
          type="button"
          className="sge-stepper__btn sge-stepper__btn--minus"
          onClick={handleDecrement}
          disabled={disabled || currentNum <= min}
          aria-label={`Diminuir ${ariaLabel}`}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 450, damping: 18 }}
        >
          &minus;
        </motion.button>

        <div className="sge-stepper__input-wrap">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="sge-stepper__input"
            value={value}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onFocus={(e) => e.target.select()}
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
              }
            }}
            disabled={disabled}
            aria-label={ariaLabel}
          />
          {unit && <span className="sge-stepper__unit">{unit}</span>}
        </div>

        <motion.button
          type="button"
          className="sge-stepper__btn sge-stepper__btn--plus"
          onClick={handleIncrement}
          disabled={disabled || currentNum >= max}
          aria-label={`Aumentar ${ariaLabel}`}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 450, damping: 18 }}
        >
          +
        </motion.button>
      </div>

      {/* Pílulas de Atalho Rápido de Incremento (+1, +5, etc) */}
      {Array.isArray(quickPills) && quickPills.length > 0 && (
        <div className="sge-stepper__quick-pills">
          {quickPills.map((pillVal) => (
            <button
              key={pillVal}
              type="button"
              className="sge-stepper__pill"
              onClick={(e) => handleQuickAdd(pillVal, e)}
              disabled={disabled}
              title={`Adicionar ${pillVal}`}
            >
              +{pillVal}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuantityStepper;
