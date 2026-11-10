import React, { useState, useEffect, useRef, useCallback } from 'react';
import { obterFotoBlobUrl } from '../../../services/remessas/remessaService';
import useDialogAccessibility from '../useDialogAccessibility';
import './FotoGaleriaModal.css';

/**
 * Formata bytes em representação humana legível (KB ou MB).
 */
const formatarTamanho = (bytes) => {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * FotoGaleriaModal — Visualizador Lightbox de Comprovantes Fotográficos de Remessas
 * 
 * Exibe as fotos de um recebimento sob demanda com:
 * - Carregamento autenticado via Blob
 * - Navegação anterior / próxima (teclas de seta e botões)
 * - Zoom / alternância de resolução
 * - Download da imagem original
 * - Tira de miniaturas para remessas com múltiplas fotos
 * - Gerenciamento de memória (revogação automática de object URLs)
 */
const FotoGaleriaModal = ({
  isOpen,
  onClose,
  fotos = [],
  recebimentoId,
  tituloDocumento = 'Comprovantes do Recebimento'
}) => {
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const [blobCache, setBlobCache] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);

  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useDialogAccessibility({
    dialogRef,
    isOpen,
    onClose,
    initialFocusRef: closeButtonRef
  });

  // Reseta índice e zoom ao abrir novo lote de fotos
  useEffect(() => {
    if (isOpen) {
      setIndiceAtivo(0);
      setIsZoomed(false);
      setErro(null);
    }
  }, [isOpen]);

  // Limpa URLs Blob da memória ao desmontar ou fechar
  useEffect(() => {
    return () => {
      Object.values(blobCache).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
    };
  }, [blobCache]);

  const fotoAtual = fotos[indiceAtivo] || null;
  const anexoIdAtual = fotoAtual?.id || fotoAtual?.anexoId;
  const recIdEfetivo = fotoAtual?.recebimentoId || recebimentoId;

  // Carrega o blob da foto atual sob demanda
  const carregarFotoAtual = useCallback(async () => {
    if (!fotoAtual || !anexoIdAtual || !recIdEfetivo) return;

    if (blobCache[anexoIdAtual]) {
      setCarregando(false);
      setErro(null);
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      const url = await obterFotoBlobUrl(recIdEfetivo, anexoIdAtual);
      setBlobCache((prev) => ({ ...prev, [anexoIdAtual]: url }));
    } catch (err) {
      setErro(err?.message || 'Não foi possível carregar esta foto.');
    } finally {
      setCarregando(false);
    }
  }, [fotoAtual, anexoIdAtual, recIdEfetivo, blobCache]);

  useEffect(() => {
    if (isOpen && fotoAtual) {
      carregarFotoAtual();
    }
  }, [isOpen, indiceAtivo, carregarFotoAtual, fotoAtual]);

  // Navegação por teclado (Setas esquerda e direita)
  useEffect(() => {
    if (!isOpen || fotos.length <= 1) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndiceAtivo((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
        setIsZoomed(false);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIndiceAtivo((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
        setIsZoomed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, fotos.length]);

  if (!isOpen || !fotos || fotos.length === 0) {
    return null;
  }

  const handleAnterior = () => {
    setIndiceAtivo((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
    setIsZoomed(false);
  };

  const handleProxima = () => {
    setIndiceAtivo((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
    setIsZoomed(false);
  };

  const handleDownload = () => {
    const url = blobCache[anexoIdAtual];
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = fotoAtual?.nomeOriginal || `comprovante-${recIdEfetivo}-${anexoIdAtual}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const urlAtual = blobCache[anexoIdAtual];

  return (
    <div
      className="sge-foto-galeria-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="sge-foto-galeria-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Galeria de fotos: ${tituloDocumento}`}
        tabIndex={-1}
      >
        {/* Cabeçalho */}
        <div className="sge-foto-galeria-header">
          <div className="sge-foto-galeria-header__info">
            <div className="sge-foto-galeria-header__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
            <div>
              <h3 className="sge-foto-galeria-header__title">{tituloDocumento}</h3>
              <span className="sge-foto-galeria-header__sub">
                {fotoAtual?.nomeOriginal || 'Foto anexada'}
                {fotoAtual?.tamanhoBytes ? ` (${formatarTamanho(fotoAtual.tamanhoBytes)})` : ''}
              </span>
            </div>
          </div>

          <div className="sge-foto-galeria-header__actions">
            {fotos.length > 1 && (
              <span className="sge-foto-galeria-counter">
                {indiceAtivo + 1} de {fotos.length}
              </span>
            )}

            {urlAtual && (
              <>
                <button
                  type="button"
                  className={`sge-foto-galeria-btn ${isZoomed ? 'sge-foto-galeria-btn--active' : ''}`}
                  onClick={() => setIsZoomed(!isZoomed)}
                  title={isZoomed ? 'Ajustar à tela' : 'Tamanho original'}
                  aria-label={isZoomed ? 'Ajustar à tela' : 'Ampliar foto'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {isZoomed ? (
                      <>
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                      </>
                    ) : (
                      <>
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        <line x1="11" y1="8" x2="11" y2="14" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                      </>
                    )}
                  </svg>
                </button>

                <button
                  type="button"
                  className="sge-foto-galeria-btn"
                  onClick={handleDownload}
                  title="Baixar imagem original"
                  aria-label="Baixar foto original"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              </>
            )}

            <button
              ref={closeButtonRef}
              type="button"
              className="sge-foto-galeria-btn sge-foto-galeria-btn--close"
              onClick={onClose}
              title="Fechar galeria (Esc)"
              aria-label="Fechar galeria"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Visualizador Principal */}
        <div className="sge-foto-galeria-body">
          {fotos.length > 1 && (
            <button
              type="button"
              className="sge-foto-galeria-nav sge-foto-galeria-nav--prev"
              onClick={handleAnterior}
              title="Foto anterior (Seta para a esquerda)"
              aria-label="Foto anterior"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          <div className={`sge-foto-galeria-viewport ${isZoomed ? 'sge-foto-galeria-viewport--zoomed' : ''}`}>
            {carregando && (
              <div className="sge-foto-galeria-status" role="status">
                <div className="sge-foto-galeria-spinner" />
                <span>Carregando comprovante...</span>
              </div>
            )}

            {erro && !carregando && (
              <div className="sge-foto-galeria-status sge-foto-galeria-status--error" role="alert">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{erro}</span>
                <button
                  type="button"
                  className="sge-foto-galeria-retry-btn"
                  onClick={carregarFotoAtual}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {urlAtual && !carregando && !erro && (
              <img
                src={urlAtual}
                alt={fotoAtual?.nomeOriginal || `Foto ${indiceAtivo + 1}`}
                className={`sge-foto-galeria-img ${isZoomed ? 'sge-foto-galeria-img--zoomed' : ''}`}
                onClick={() => setIsZoomed(!isZoomed)}
                title={isZoomed ? 'Clique para ajustar à tela' : 'Clique para ampliar'}
              />
            )}
          </div>

          {fotos.length > 1 && (
            <button
              type="button"
              className="sge-foto-galeria-nav sge-foto-galeria-nav--next"
              onClick={handleProxima}
              title="Próxima foto (Seta para a direita)"
              aria-label="Próxima foto"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>

        {/* Rodapé: Tira de Miniaturas (quando houver mais de 1 foto) */}
        {fotos.length > 1 && (
          <div className="sge-foto-galeria-thumbs">
            {fotos.map((f, i) => {
              const anexoId = f.id || f.anexoId;
              const isSelected = i === indiceAtivo;
              const thumbUrl = blobCache[anexoId];

              return (
                <button
                  key={anexoId || i}
                  type="button"
                  className={`sge-foto-galeria-thumb ${isSelected ? 'sge-foto-galeria-thumb--selected' : ''}`}
                  onClick={() => {
                    setIndiceAtivo(i);
                    setIsZoomed(false);
                  }}
                  title={f.nomeOriginal || `Foto ${i + 1}`}
                  aria-label={`Visualizar foto ${i + 1}: ${f.nomeOriginal || ''}`}
                  aria-current={isSelected ? 'true' : undefined}
                >
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" className="sge-foto-galeria-thumb-img" />
                  ) : (
                    <div className="sge-foto-galeria-thumb-placeholder">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                      <span>#{i + 1}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FotoGaleriaModal;

