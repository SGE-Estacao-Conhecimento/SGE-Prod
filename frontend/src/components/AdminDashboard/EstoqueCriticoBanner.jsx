import React, { useState } from 'react';

const STORAGE_KEY = 'sge_dashboard_critico_banner_dismissed';

export default function EstoqueCriticoBanner({ itens = [], onDrillDown }) {
  const [descartado, setDescartado] = useState(() => {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const itensCriticos = (itens || []).filter(
    (item) => Number(item?.estoqueAtual ?? 0) <= 0 || item?.statusRisco === 'critico'
  );

  if (descartado || itensCriticos.length === 0) {
    return null;
  }

  const handleDescartar = () => {
    setDescartado(true);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEY, 'true');
      }
    } catch {
      // Ignora falhas em navegadores com armazenamento desabilitado
    }
  };

  const primeiroItem = itensCriticos[0];
  const total = itensCriticos.length;

  return (
    <aside className="estoque-critico-banner" role="alert" aria-live="polite">
      <div className="estoque-critico-banner-icone" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <div className="estoque-critico-banner-conteudo">
        <strong className="estoque-critico-banner-titulo">
          {total === 1 ? '1 item em situação crítica' : `${total} itens em situação crítica`}
        </strong>
        <p className="estoque-critico-banner-descricao">
          Há materiais com estoque zerado ou ruptura iminente nos próximos 7 dias.
          {primeiroItem?.nome ? ` Exemplo: ${primeiroItem.nome}.` : ''}
        </p>
      </div>

      <div className="estoque-critico-banner-acoes">
        {onDrillDown && primeiroItem && (
          <button
            type="button"
            className="btn-banner-acao"
            onClick={() => onDrillDown(primeiroItem.produtoId, primeiroItem.nome)}
          >
            Examinar no Estoque
          </button>
        )}

        <button
          type="button"
          className="btn-banner-fechar"
          onClick={handleDescartar}
          aria-label="Dispensar aviso de estoque crítico nesta sessão"
          title="Dispensar aviso"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
