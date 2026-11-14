import React, { useState, useEffect, useCallback } from 'react';
import { useDialogAccessibility } from '../common';
import { patrimonioService } from '../../services/patrimonios/patrimonioService';
import TransferirPatrimonioModal from '../Ambientes/TransferirPatrimonioModal';
import './UsuarioDrawer.css';

/**
 * Mapeamento visual para estados de conservação do patrimônio
 */
const ESTADOS_CONSERVACAO = {
  novo: { rotulo: 'Novo', classe: 'usuario-drawer__badge--novo' },
  bom: { rotulo: 'Bom', classe: 'usuario-drawer__badge--bom' },
  regular: { rotulo: 'Regular', classe: 'usuario-drawer__badge--regular' },
  danificado: { rotulo: 'Danificado', classe: 'usuario-drawer__badge--danificado' },
  em_manutencao: { rotulo: 'Em Manutenção', classe: 'usuario-drawer__badge--manutencao' }
};

/**
 * Mapeamento visual para perfis de acesso
 */
const PERFIS_INFO = {
  admin: { rotulo: 'Administrador', classe: 'usuario-drawer__perfil--admin' },
  almoxarifado: { rotulo: 'Almoxarifado', classe: 'usuario-drawer__perfil--almoxarife' },
  funcionario: { rotulo: 'Funcionário', classe: 'usuario-drawer__perfil--funcionario' }
};

const UsuarioDrawer = ({
  usuario = null,
  isOpen = false,
  onClose,
  onEdit,
  onResetPassword,
  ambientes = [],
  usuarios = [],
  onTransferirPatrimonio
}) => {
  const [bens, setBens] = useState([]);
  const [loadingBens, setLoadingBens] = useState(false);
  const [erroBens, setErroBens] = useState(null);

  // Modal de transferência/desvinculação rápida
  const [itemParaTransferir, setItemParaTransferir] = useState(null);

  const dialogRef = useDialogAccessibility({
    isOpen,
    onClose
  });

  const carregarBensDoUsuario = useCallback(async (usuarioId) => {
    if (!usuarioId) {
      setBens([]);
      return;
    }
    setLoadingBens(true);
    setErroBens(null);
    try {
      const itens = await patrimonioService.listarItens({ responsavelUsuarioId: usuarioId });
      setBens(Array.isArray(itens) ? itens : []);
    } catch (err) {
      setErroBens(err?.message || 'Não foi possível carregar os patrimônios vinculados.');
    } finally {
      setLoadingBens(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && usuario?.id) {
      carregarBensDoUsuario(usuario.id);
    } else {
      setBens([]);
      setErroBens(null);
      setItemParaTransferir(null);
    }
  }, [isOpen, usuario?.id, carregarBensDoUsuario]);

  if (!isOpen || !usuario) return null;

  const perfilConfig = PERFIS_INFO[usuario.perfil?.toLowerCase()] || {
    rotulo: usuario.perfil || 'Usuário',
    classe: 'usuario-drawer__perfil--funcionario'
  };

  const handleConfirmarTransferencia = async (itemId, dados) => {
    if (onTransferirPatrimonio) {
      await onTransferirPatrimonio(itemId, dados);
    } else {
      await patrimonioService.transferirItem(itemId, dados);
    }
    await carregarBensDoUsuario(usuario.id);
  };

  return (
    <div className="usuario-drawer__overlay" onClick={onClose} role="presentation">
      <aside
        className="usuario-drawer__panel"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="usuario-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <header className="usuario-drawer__header">
          <div className="usuario-drawer__header-info">
            <span className="usuario-drawer__header-eyebrow">Ficha do Colaborador</span>
            <h2 id="usuario-drawer-title" className="usuario-drawer__title">
              {usuario.nome}
            </h2>
          </div>
          <button
            type="button"
            className="usuario-drawer__close-btn"
            onClick={onClose}
            aria-label="Fechar ficha do usuário"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Conteúdo com rolagem suave */}
        <div className="usuario-drawer__body">
          {/* Cartão de Identificação do Usuário */}
          <section className="usuario-drawer__user-card">
            <div className="usuario-drawer__avatar-row">
              <div className={`usuario-drawer__avatar ${perfilConfig.classe}`}>
                {usuario.inicial || usuario.nome.substring(0, 2).toUpperCase()}
              </div>
              <div className="usuario-drawer__avatar-meta">
                <div className="usuario-drawer__badges-row">
                  <span className={`usuario-drawer__perfil-badge ${perfilConfig.classe}`}>
                    {perfilConfig.rotulo}
                  </span>
                  <span className={`usuario-drawer__status-pill ${usuario.ativo ? 'usuario-drawer__status-pill--active' : 'usuario-drawer__status-pill--inactive'}`}>
                    <span className="usuario-drawer__status-dot" aria-hidden="true" />
                    {usuario.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <span className="usuario-drawer__setor-text">
                  Setor: {usuario.setor || 'Não informado'}
                </span>
              </div>
            </div>

            <dl className="usuario-drawer__details-grid">
              <div className="usuario-drawer__detail-item">
                <dt>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  E-mail
                </dt>
                <dd title={usuario.email}>{usuario.email || '—'}</dd>
              </div>

              <div className="usuario-drawer__detail-item">
                <dt>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <circle cx="9" cy="10" r="2" />
                    <path d="M15 8h2M15 12h2M7 16h10" />
                  </svg>
                  CPF
                </dt>
                <dd>{usuario.cpf || '—'}</dd>
              </div>

              <div className="usuario-drawer__detail-item">
                <dt>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Data de Cadastro
                </dt>
                <dd>{usuario.dataCadastro || '—'}</dd>
              </div>

              {usuario.celular && (
                <div className="usuario-drawer__detail-item">
                  <dt>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12.01" y2="18" />
                    </svg>
                    Celular
                  </dt>
                  <dd>{usuario.celular}</dd>
                </div>
              )}
            </dl>

            {/* Ações Rápidas de Conta */}
            <div className="usuario-drawer__actions-row">
              {onEdit && (
                <button
                  type="button"
                  className="usuario-drawer__btn usuario-drawer__btn--secondary"
                  onClick={() => onEdit(usuario)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  Editar Dados
                </button>
              )}
              {onResetPassword && (
                <button
                  type="button"
                  className="usuario-drawer__btn usuario-drawer__btn--secondary"
                  onClick={() => onResetPassword(usuario)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 2l-2 2m-1.5 1.5L14 9M3 21l6-6m0 0l-3-3 3-3 3 3-3 3z" />
                    <circle cx="17.5" cy="6.5" r="3.5" />
                  </svg>
                  Redefinir Senha
                </button>
              )}
            </div>
          </section>

          {/* Seção: Bens Patrimoniados Sob Custódia */}
          <section className="usuario-drawer__patrimonio-section">
            <div className="usuario-drawer__section-header">
              <div className="usuario-drawer__section-title-wrapper">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                <h3 className="usuario-drawer__section-title">Bens Sob Custódia</h3>
              </div>
              <span className="usuario-drawer__count-badge" aria-label={`${bens.length} itens vinculados`}>
                {loadingBens ? '...' : `${bens.length} ${bens.length === 1 ? 'item' : 'itens'}`}
              </span>
            </div>

            {loadingBens && (
              <div className="usuario-drawer__loading-state" role="status">
                <div className="usuario-drawer__spinner" aria-hidden="true" />
                <span>Carregando patrimônios do usuário...</span>
              </div>
            )}

            {erroBens && !loadingBens && (
              <div className="usuario-drawer__error-state" role="alert">
                <span>{erroBens}</span>
                <button
                  type="button"
                  className="usuario-drawer__retry-btn"
                  onClick={() => carregarBensDoUsuario(usuario.id)}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!loadingBens && !erroBens && bens.length === 0 && (
              <div className="usuario-drawer__empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <p className="usuario-drawer__empty-title">Nenhum bem patrimoniado vinculado</p>
                <p className="usuario-drawer__empty-subtitle">
                  Quando um equipamento ou bem durável for atribuído a este colaborador, ele será listado aqui.
                </p>
              </div>
            )}

            {!loadingBens && !erroBens && bens.length > 0 && (
              <div className="usuario-drawer__items-list">
                {bens.map((item) => {
                  const estadoConfig = ESTADOS_CONSERVACAO[item.estadoConservacao?.toLowerCase()] || {
                    rotulo: item.estadoConservacao || 'Bom',
                    classe: 'usuario-drawer__badge--bom'
                  };
                  return (
                    <article key={item.id} className="usuario-drawer__item-card">
                      <div className="usuario-drawer__item-main">
                        <div className="usuario-drawer__item-header">
                          <span className="usuario-drawer__plaqueta-tag">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="3" y="5" width="18" height="14" rx="2" />
                              <line x1="7" y1="15" x2="7.01" y2="15" />
                              <line x1="11" y1="15" x2="13" y2="15" />
                            </svg>
                            {item.numeroPatrimonio}
                          </span>
                          <span className={`usuario-drawer__item-badge ${estadoConfig.classe}`}>
                            {estadoConfig.rotulo}
                          </span>
                        </div>

                        <h4 className="usuario-drawer__item-nome">{item.nomePatrimonio}</h4>

                        <div className="usuario-drawer__item-specs">
                          <span className="usuario-drawer__spec-pill">{item.categoria}</span>
                          {(item.marca || item.modelo) && (
                            <span className="usuario-drawer__spec-text">
                              {[item.marca, item.modelo].filter(Boolean).join(' • ')}
                            </span>
                          )}
                        </div>

                        <div className="usuario-drawer__item-meta">
                          <div className="usuario-drawer__meta-row">
                            <span className="usuario-drawer__meta-label">Ambiente:</span>
                            <span className="usuario-drawer__meta-value">
                              {item.nomeAmbiente || 'Sem ambiente vinculado'}
                            </span>
                          </div>
                          {item.numeroSerie && (
                            <div className="usuario-drawer__meta-row">
                              <span className="usuario-drawer__meta-label">Nº de Série:</span>
                              <span className="usuario-drawer__meta-value">{item.numeroSerie}</span>
                            </div>
                          )}
                          {item.dataAquisicao && (
                            <div className="usuario-drawer__meta-row">
                              <span className="usuario-drawer__meta-label">Aquisição:</span>
                              <span className="usuario-drawer__meta-value">{item.dataAquisicao}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="usuario-drawer__item-actions">
                        <button
                          type="button"
                          className="usuario-drawer__item-btn-transferir"
                          title="Transferir ou desvincular bem"
                          onClick={() => setItemParaTransferir(item)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="17 1 21 5 17 9" />
                            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                            <polyline points="7 23 3 19 7 15" />
                            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                          </svg>
                          Transferir / Desvincular
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Modal de Transferência / Desvinculação rápida reutilizável */}
        {itemParaTransferir && (
          <TransferirPatrimonioModal
            isOpen={Boolean(itemParaTransferir)}
            onClose={() => setItemParaTransferir(null)}
            onConfirm={handleConfirmarTransferencia}
            item={itemParaTransferir}
            ambientes={ambientes}
            usuarios={usuarios}
          />
        )}
      </aside>
    </div>
  );
};

export default UsuarioDrawer;
