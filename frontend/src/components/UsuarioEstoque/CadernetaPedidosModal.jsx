import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BottomSheetModal, QuantityStepper } from '../common';
import './CadernetaPedidosModal.css';

/**
 * CadernetaPedidosModal — Modal de Revisão e Envio da Caderneta de Pedidos do Usuário
 * 
 * Permite ao usuário revisar todos os materiais selecionados no estoque,
 * ajustar quantidades diretamente na lista, remover itens, informar a justificativa
 * geral do pedido, marcar urgência e despachar tudo de uma só vez.
 */
const CadernetaPedidosModal = ({
  isOpen,
  onClose,
  itens = [],
  onUpdateQtd,
  onRemoveItem,
  onClear,
  onSubmit
}) => {
  const [justificativa, setJustificativa] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const totalMateriais = itens.length;
  const totalVolumes = itens.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (itens.length === 0) return;

    if (!justificativa.trim()) {
      setErro('Informe uma justificativa ou finalidade para o pedido.');
      return;
    }

    const itensValidados = [];
    for (const it of itens) {
      const rawStr = String(it.quantidade ?? '').trim();
      const raw = typeof it.quantidade === 'number'
        ? it.quantidade
        : (rawStr === '' ? NaN : Number(rawStr.replace(',', '.')));
      if (isNaN(raw) || !Number.isFinite(raw) || raw <= 0) {
        setErro(`Quantidade inválida para o material "${it.nome}". Informe um valor numérico maior que zero.`);
        return;
      }
      const permiteFracao = Boolean(it.permiteFracao ?? it.permite_fracao);
      if (!permiteFracao && !Number.isInteger(raw)) {
        setErro(`O material "${it.nome}" não permite quantidades fracionárias.`);
        return;
      }
      itensValidados.push({
        produtoId: it.id,
        materialNome: it.nome,
        quantidade: permiteFracao ? Math.round(raw * 1000) / 1000 : raw,
        unidade: it.unidade || 'UN',
        itensPorEmbalagem: it.itensPorEmbalagem
      });
    }

    setErro('');
    setEnviando(true);
    try {
      await onSubmit({
        itens: itensValidados,
        justificativa: justificativa.trim(),
        urgente,
        prioridade: urgente ? 'Urgente' : 'Normal'
      });
      setJustificativa('');
      setUrgente(false);
    } catch (error) {
      setErro(error?.message || 'Não foi possível enviar o pedido. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title="Caderneta de Pedidos"
      subtitle={totalMateriais > 0 ? `${totalMateriais} ${totalMateriais === 1 ? 'material' : 'materiais'} na lista` : 'Lista Vazia'}
      badge={
        urgente ? (
          <span className="caderneta-badge-urgente">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Urgência Ativada
          </span>
        ) : null
      }
      headerAction={
        totalMateriais > 0 ? (
          <button
            type="button"
            className="caderneta-clear-btn"
            onClick={onClear}
            title="Limpar todos os itens da caderneta"
          >
            Limpar lista
          </button>
        ) : null
      }
      footer={
        totalMateriais > 0 ? (
          <div className="caderneta-footer__actions">
            <button
              type="button"
              className="caderneta-btn-cancel"
              onClick={onClose}
            >
              Continuar Escolhendo
            </button>
            <button
              type="submit"
              form="caderneta-form-pedidos"
              disabled={enviando || totalMateriais === 0}
              className={`caderneta-btn-submit ${urgente ? 'caderneta-btn-submit--urgente' : ''}`}
            >
              {enviando ? (
                'Enviando Pedido...'
              ) : urgente ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Enviar Pedido Urgente
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Confirmar e Enviar Pedido
                </>
              )}
            </button>
          </div>
        ) : null
      }
      maxWidth="560px"
      className="caderneta-modal"
    >
      {totalMateriais === 0 ? (
        <div className="caderneta-empty">
          <div className="caderneta-empty__icon-wrap">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
          </div>
          <h4 className="caderneta-empty__title">Sua caderneta está vazia</h4>
          <p className="caderneta-empty__desc">
            Navegue pelo estoque e toque nos materiais que você precisa para adicioná-los aqui e solicitar tudo em um único pedido.
          </p>
          <button
            type="button"
            className="caderneta-empty__btn"
            onClick={onClose}
          >
            Explorar Catálogo
          </button>
        </div>
      ) : (
        <form id="caderneta-form-pedidos" onSubmit={handleSubmit} className="caderneta-form">
          {/* Lista de Itens da Caderneta Direto na Janela */}
          <div className="caderneta-itens-scroll">
            <AnimatePresence initial={false}>
              {itens.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.18 }}
                  className="caderneta-item-row"
                >
                    <div className="caderneta-item-info">
                      <div className="caderneta-item-nome-wrap">
                        <span className="caderneta-item-nome" title={item.nome}>
                          {item.nome}
                        </span>
                        <span className="caderneta-item-unidade">
                          {item.unidade || 'UN'}
                        </span>
                      </div>
                      {item.itensPorEmbalagem > 1 && (
                        <span className="caderneta-item-conversao">
                          Total: <strong>{(item.quantidade * item.itensPorEmbalagem).toLocaleString('pt-BR')} unidades</strong>
                        </span>
                      )}
                    </div>

                    {/* Stepper Padronizado de Quantidade */}
                    <QuantityStepper
                      value={item.quantidade}
                      onChange={(novaQtd) => onUpdateQtd(item.id, novaQtd)}
                      min={1}
                      max={99999}
                      ariaLabel={`Quantidade de ${item.nome}`}
                      className="caderneta-quantity-stepper"
                    />

                    {/* Botão Remover */}
                    <button
                      type="button"
                      className="caderneta-item-remove"
                      onClick={() => onRemoveItem(item.id)}
                      title={`Remover ${item.nome} da caderneta`}
                      aria-label={`Remover ${item.nome}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Justificativa Geral do Pedido */}
          <div className="caderneta-form-group">
            <label className="caderneta-label" htmlFor="caderneta-justificativa">
              Justificativa / Finalidade do Pedido <span className="caderneta-required">*</span>
            </label>
            <textarea
              id="caderneta-justificativa"
              className={`caderneta-textarea ${erro ? 'caderneta-textarea--error' : ''}`}
              rows="3"
              placeholder="Ex: Reposição para atividades pedagógicas do bloco B, salas 101 e 102..."
              value={justificativa}
              onChange={(e) => {
                setJustificativa(e.target.value);
                if (erro) setErro('');
              }}
            />
            {erro && <span className="caderneta-error-msg">{erro}</span>}
          </div>

          {/* Toggle de Urgência */}
          <div className="caderneta-urgent-box">
            <label className="caderneta-urgent-label" htmlFor="caderneta-urgente-switch">
              <div className="caderneta-urgent-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div className="caderneta-urgent-text">
                <strong>Pedido Urgente</strong>
                <span>Prioridade máxima de atendimento para o Almoxarifado</span>
              </div>
              <div className="sheet-toggle-wrap">
                <input
                  id="caderneta-urgente-switch"
                  type="checkbox"
                  className="sheet-toggle-input"
                  checked={urgente}
                  onChange={(e) => setUrgente(e.target.checked)}
                />
                <span className="sheet-toggle-slider" />
              </div>
            </label>
          </div>
        </form>
      )}
    </BottomSheetModal>
  );
};

export default CadernetaPedidosModal;

