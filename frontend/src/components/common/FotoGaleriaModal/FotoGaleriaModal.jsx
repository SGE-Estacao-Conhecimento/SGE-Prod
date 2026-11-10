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
 * Formata data ISO para padrão brasileiro legível: DD/MM/AAAA às HH:mm.
 */
const formatarDataHora = (dataIso) => {
  if (!dataIso) return '—';
  try {
    const d = new Date(dataIso);
    if (isNaN(d.getTime())) return String(dataIso);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} às ${hora}:${min}`;
  } catch {
    return String(dataIso);
  }
};

/**
 * FotoGaleriaModal — Visualizador de Inspeção Documental Corporativo
 * 
 * Interface para auditoria e conferência de notas fiscais e comprovantes fotográficos:
 * - Painel split-view de conferência: metadados da operação e conferência de itens lado a lado
 * - Rotação em passos de 90° (horário e anti-horário) para documentos em orientação inadequada
 * - Zoom escalonado (50% a 300%) com ajuste automático à área útil
 * - Navegação por teclado (Setas, R para rotação, +/- para zoom, Esc para fechar)
 * - Arraste para inspeção panorâmica (drag-to-pan) quando ampliado
 * - Gerenciamento de ciclo de vida de memória (revogação de Blob URLs na saída)
 */
const FotoGaleriaModal = ({
  isOpen,
  onClose,
  fotos = [],
  recebimentoId,
  tituloDocumento = 'Inspeção de Documento Fiscal',
  dadosOperacao = null
}) => {
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const [blobCache, setBlobCache] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  // Estados de manipulação visual do documento
  const [rotacao, setRotacao] = useState(0); // 0, 90, 180, 270
  const [zoomNivel, setZoomNivel] = useState(1); // 1 = 100% (fit)
  const [painelAberto, setPainelAberto] = useState(true);
  const [viewportDimensoes, setViewportDimensoes] = useState({ largura: 800, altura: 600 });
  const [isArrastando, setIsArrastando] = useState(false);

  const closeButtonRef = useRef(null);
  const viewportRef = useRef(null);
  const urlsCriadasRef = useRef(new Set());
  const posArrastoRef = useRef({ startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const dialogRef = useDialogAccessibility({
    isOpen,
    onClose,
    initialFocusRef: closeButtonRef
  });

  // Descarte seguro de todos os Blobs mantidos na sessão do modal
  const revogarTodosBlobs = useCallback(() => {
    urlsCriadasRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    });
    urlsCriadasRef.current.clear();
    setBlobCache({});
  }, []);

  // Monitora dimensões do viewport com ResizeObserver
  useEffect(() => {
    if (!isOpen || !viewportRef.current) return undefined;

    const atualizarDimensoes = () => {
      if (viewportRef.current) {
        setViewportDimensoes({
          largura: viewportRef.current.clientWidth,
          altura: viewportRef.current.clientHeight
        });
      }
    };

    atualizarDimensoes();
    const ro = new ResizeObserver(atualizarDimensoes);
    ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, [isOpen, painelAberto]);

  // Reseta visualizações ao abrir ou mudar de lote
  useEffect(() => {
    if (isOpen) {
      setIndiceAtivo(0);
      setRotacao(0);
      setZoomNivel(1);
      setErro(null);
    }
  }, [isOpen]);

  // Limpa blobs quando o modal é fechado
  useEffect(() => {
    if (!isOpen) {
      revogarTodosBlobs();
    }
  }, [isOpen, revogarTodosBlobs]);

  // Liberação de memória no desmonte do componente
  useEffect(() => {
    return () => {
      urlsCriadasRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
      urlsCriadasRef.current.clear();
    };
  }, []);

  const fotoAtual = fotos[indiceAtivo] || null;
  const anexoIdAtual = fotoAtual?.id || fotoAtual?.anexoId;
  const recIdEfetivo = fotoAtual?.recebimentoId || recebimentoId;

  // Carregamento autenticado da foto sob demanda
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
      urlsCriadasRef.current.add(url);
      setBlobCache((prev) => ({ ...prev, [anexoIdAtual]: url }));
    } catch (err) {
      setErro(err?.message || 'Não foi possível carregar este documento.');
    } finally {
      setCarregando(false);
    }
  }, [fotoAtual, anexoIdAtual, recIdEfetivo, blobCache]);

  useEffect(() => {
    if (isOpen && fotoAtual) {
      carregarFotoAtual();
    }
  }, [isOpen, indiceAtivo, carregarFotoAtual, fotoAtual]);

  // Funções de controle de navegação e manipulação de imagem
  const handleAnterior = useCallback(() => {
    setIndiceAtivo((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
    setRotacao(0);
    setZoomNivel(1);
  }, [fotos.length]);

  const handleProxima = useCallback(() => {
    setIndiceAtivo((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
    setRotacao(0);
    setZoomNivel(1);
  }, [fotos.length]);

  const handleGirarHorario = useCallback(() => {
    setRotacao((prev) => (prev + 90) % 360);
  }, []);

  const handleGirarAntiHorario = useCallback(() => {
    setRotacao((prev) => (prev - 90 + 360) % 360);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomNivel((prev) => Math.min(3, +(prev + 0.25).toFixed(2)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomNivel((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomNivel(1);
  }, []);

  // Atalhos de teclado operacionais
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleAnterior();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleProxima();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleGirarHorario();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleAnterior, handleProxima, handleGirarHorario, handleZoomIn, handleZoomOut, handleZoomReset]);

  // Arraste (Pan) com mouse quando com zoom ampliado
  const handleMouseDown = (e) => {
    if (zoomNivel <= 1 || e.button !== 0) return;
    setIsArrastando(true);
    if (viewportRef.current) {
      posArrastoRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: viewportRef.current.scrollLeft,
        scrollTop: viewportRef.current.scrollTop
      };
    }
  };

  const handleMouseMove = (e) => {
    if (!isArrastando || !viewportRef.current) return;
    e.preventDefault();
    const dx = e.clientX - posArrastoRef.current.startX;
    const dy = e.clientY - posArrastoRef.current.startY;
    viewportRef.current.scrollLeft = posArrastoRef.current.scrollLeft - dx;
    viewportRef.current.scrollTop = posArrastoRef.current.scrollTop - dy;
  };

  const handleMouseUp = () => {
    setIsArrastando(false);
  };

  const handleDownload = () => {
    const url = blobCache[anexoIdAtual];
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = fotoAtual?.nomeOriginal || `documento-${recIdEfetivo}-${anexoIdAtual}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen || !fotos || fotos.length === 0) {
    return null;
  }

  const urlAtual = blobCache[anexoIdAtual];
  const isRotacionado90 = rotacao === 90 || rotacao === 270;

  // Dimensões dinâmicas calculadas para evitar cortes em rotações de 90°
  const maxLarguraEfetiva = isRotacionado90
    ? Math.max(160, viewportDimensoes.altura - 36)
    : Math.max(160, viewportDimensoes.largura - 36);
  const maxAlturaEfetiva = isRotacionado90
    ? Math.max(160, viewportDimensoes.largura - 36)
    : Math.max(160, viewportDimensoes.altura - 36);

  const itensConferidos = dadosOperacao?.itens || [];

  return (
    <div
      className="sge-inspecao-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="sge-inspecao-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Inspeção de comprovantes: ${tituloDocumento}`}
        tabIndex={-1}
      >
        {/* Cabeçalho Corporativo */}
        <header className="sge-inspecao-header">
          <div className="sge-inspecao-header__titulo-bloco">
            <div className="sge-inspecao-header__icone">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="sge-inspecao-header__titulos">
              <div className="sge-inspecao-header__linha-principal">
                <h2 className="sge-inspecao-header__titulo">{tituloDocumento}</h2>
                {dadosOperacao?.tipoOrigem && (
                  <span className="sge-inspecao-badge-origem">
                    {dadosOperacao.tipoOrigem.toUpperCase()}
                  </span>
                )}
              </div>
              <span className="sge-inspecao-header__subtitulo">
                Arquivo {indiceAtivo + 1} de {fotos.length}
                {fotoAtual?.nomeOriginal ? ` • ${fotoAtual.nomeOriginal}` : ''}
                {fotoAtual?.tamanhoBytes ? ` (${formatarTamanho(fotoAtual.tamanhoBytes)})` : ''}
              </span>
            </div>
          </div>

          {/* Barra de Ferramentas Documentais */}
          <div className="sge-inspecao-toolbar">
            {/* Alternar Ficha de Conferência */}
            <button
              type="button"
              className={`sge-inspecao-btn-tool ${painelAberto ? 'sge-inspecao-btn-tool--ativo' : ''}`}
              onClick={() => setPainelAberto(!painelAberto)}
              title={painelAberto ? 'Ocultar ficha de conferência' : 'Exibir ficha de conferência'}
              aria-label={painelAberto ? 'Ocultar ficha' : 'Exibir ficha'}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
              </svg>
              <span className="sge-inspecao-btn-label">Ficha</span>
            </button>

            <span className="sge-inspecao-toolbar-divisoria" />

            {/* Controles de Zoom */}
            <button
              type="button"
              className="sge-inspecao-btn-tool"
              onClick={handleZoomOut}
              title="Diminuir zoom (-)"
              aria-label="Diminuir zoom"
              disabled={zoomNivel <= 0.5}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>

            <button
              type="button"
              className={`sge-inspecao-btn-tool sge-inspecao-btn-tool--zoom-reset ${zoomNivel === 1 ? 'sge-inspecao-btn-tool--zoom-padrao' : ''}`}
              onClick={handleZoomReset}
              title="Ajustar zoom à tela (0)"
              aria-label="Ajustar zoom à tela"
            >
              <span>{Math.round(zoomNivel * 100)}%</span>
            </button>

            <button
              type="button"
              className="sge-inspecao-btn-tool"
              onClick={handleZoomIn}
              title="Aumentar zoom (+)"
              aria-label="Aumentar zoom"
              disabled={zoomNivel >= 3}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>

            <span className="sge-inspecao-toolbar-divisoria" />

            {/* Controles de Rotação de Documento */}
            <button
              type="button"
              className="sge-inspecao-btn-tool"
              onClick={handleGirarAntiHorario}
              title="Girar 90° à esquerda (anti-horário)"
              aria-label="Girar 90° à esquerda"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            <button
              type="button"
              className={`sge-inspecao-btn-tool ${rotacao > 0 ? 'sge-inspecao-btn-tool--ativo' : ''}`}
              onClick={handleGirarHorario}
              title="Girar 90° à direita (R)"
              aria-label="Girar 90° à direita"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              {rotacao > 0 && <span className="sge-inspecao-rotacao-tag">{rotacao}°</span>}
            </button>

            <span className="sge-inspecao-toolbar-divisoria" />

            {/* Download do Original */}
            <button
              type="button"
              className="sge-inspecao-btn-tool"
              onClick={handleDownload}
              title="Baixar imagem original"
              aria-label="Baixar foto original"
              disabled={!urlAtual}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>

            <span className="sge-inspecao-toolbar-divisoria" />

            {/* Botão Fechar */}
            <button
              ref={closeButtonRef}
              type="button"
              className="sge-inspecao-btn-tool sge-inspecao-btn-tool--fechar"
              onClick={onClose}
              title="Fechar inspeção (Esc)"
              aria-label="Fechar inspeção"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        {/* Corpo Dividido (Split Body) */}
        <div className="sge-inspecao-corpo">
          {/* Painel Lateral: Ficha de Auditoria e Conferência */}
          {painelAberto && (
            <aside className="sge-inspecao-sidebar" aria-label="Ficha de conferência documental">
              {/* Seção 1: Dados do Recebimento */}
              <div className="sge-inspecao-sidebar-secao">
                <span className="sge-inspecao-sidebar-rotulo">Dados da Operação</span>
                <div className="sge-inspecao-meta-grid">
                  <div className="sge-inspecao-meta-item">
                    <span className="sge-inspecao-meta-chave">Documento:</span>
                    <strong className="sge-inspecao-meta-valor">
                      {dadosOperacao?.documentoFiscal || dadosOperacao?.numeroRemessa || '—'}
                    </strong>
                  </div>

                  {dadosOperacao?.numeroRemessa && dadosOperacao?.numeroRemessa !== dadosOperacao?.documentoFiscal && (
                    <div className="sge-inspecao-meta-item">
                      <span className="sge-inspecao-meta-chave">Remessa:</span>
                      <span className="sge-inspecao-meta-valor">{dadosOperacao.numeroRemessa}</span>
                    </div>
                  )}

                  <div className="sge-inspecao-meta-item">
                    <span className="sge-inspecao-meta-chave">Fornecedor / Origem:</span>
                    <span className="sge-inspecao-meta-valor">{dadosOperacao?.fornecedor || 'Fornecedor padrão'}</span>
                  </div>

                  <div className="sge-inspecao-meta-item">
                    <span className="sge-inspecao-meta-chave">Data de Registro:</span>
                    <span className="sge-inspecao-meta-valor">
                      {formatarDataHora(dadosOperacao?.data)}
                    </span>
                  </div>

                  <div className="sge-inspecao-meta-item">
                    <span className="sge-inspecao-meta-chave">Conferente:</span>
                    <span className="sge-inspecao-meta-valor">{dadosOperacao?.responsavel || 'Almoxarife'}</span>
                  </div>

                  {dadosOperacao?.observacao && (
                    <div className="sge-inspecao-obs-box">
                      <span className="sge-inspecao-meta-chave">Observação:</span>
                      <p className="sge-inspecao-obs-texto">{dadosOperacao.observacao}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Seção 2: Itens Vinculados */}
              {itensConferidos.length > 0 && (
                <div className="sge-inspecao-sidebar-secao sge-inspecao-sidebar-secao--itens">
                  <div className="sge-inspecao-sidebar-cabecalho">
                    <span className="sge-inspecao-sidebar-rotulo">Itens Conferidos</span>
                    <span className="sge-inspecao-contagem-tag">{itensConferidos.length}</span>
                  </div>

                  <div className="sge-inspecao-itens-lista" role="list">
                    {itensConferidos.map((item, idx) => (
                      <div key={item.materialId || idx} className="sge-inspecao-item-linha" role="listitem">
                        <div className="sge-inspecao-item-info">
                          <span className="sge-inspecao-item-sku">{item.codigo}</span>
                          <span className="sge-inspecao-item-nome" title={item.nome}>
                            {item.nome}
                          </span>
                        </div>
                        <span className="sge-inspecao-item-delta">
                          +{item.quantidade} {item.unidade}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          )}

          {/* Faixa Vertical Dedicada de Miniaturas (Thumbnail Rail) — Opção A: Ao lado esquerdo da imagem quando houver > 1 foto */}
          {fotos.length > 1 && (
            <aside className="sge-inspecao-rail" aria-label="Miniaturas dos comprovantes">
              <div className="sge-inspecao-rail-header">
                <span className="sge-inspecao-rail-rotulo">Fotos</span>
                <span className="sge-inspecao-rail-badge">{fotos.length}</span>
              </div>
              <div className="sge-inspecao-rail-lista">
                {fotos.map((f, i) => {
                  const anexoId = f.id || f.anexoId;
                  const isSelected = i === indiceAtivo;
                  const thumbUrl = blobCache[anexoId];
                  const tamanhoFormatado = formatarTamanho(f.tamanhoBytes);

                  return (
                    <button
                      key={anexoId || i}
                      type="button"
                      className={`sge-inspecao-rail-item ${isSelected ? 'sge-inspecao-rail-item--ativo' : ''}`}
                      onClick={() => {
                        setIndiceAtivo(i);
                        setRotacao(0);
                        setZoomNivel(1);
                      }}
                      title={`${f.nomeOriginal || `Foto ${i + 1}`}${tamanhoFormatado ? ` (${tamanhoFormatado})` : ''}`}
                      aria-label={`Visualizar comprovante ${i + 1}: ${f.nomeOriginal || ''}`}
                      aria-current={isSelected ? 'true' : undefined}
                    >
                      <div className="sge-inspecao-rail-thumb">
                        {thumbUrl ? (
                          <img src={thumbUrl} alt="" className="sge-inspecao-rail-thumb-img" />
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                            <circle cx="9" cy="9" r="2" />
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                          </svg>
                        )}
                      </div>
                      <span className="sge-inspecao-rail-numero">#{i + 1}</span>
                    </button>
                  );
                })}
              </div>
            </aside>
          )}

          {/* Área Principal de Inspeção do Documento */}
          <main className="sge-inspecao-viewer">
            {/* Navegação Rápida Esquerda */}
            {fotos.length > 1 && (
              <button
                type="button"
                className="sge-inspecao-nav sge-inspecao-nav--prev"
                onClick={handleAnterior}
                title="Comprovante anterior (Seta esquerda)"
                aria-label="Comprovante anterior"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}

            {/* Viewport da Imagem */}
            <div
              ref={viewportRef}
              className={`sge-inspecao-viewport ${zoomNivel > 1 ? 'sge-inspecao-viewport--arrastavel' : ''}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {carregando && (
                <div className="sge-inspecao-status" role="status">
                  <div className="sge-inspecao-spinner" />
                  <span>Carregando documento...</span>
                </div>
              )}

              {erro && !carregando && (
                <div className="sge-inspecao-status sge-inspecao-status--erro" role="alert">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{erro}</span>
                  <button
                    type="button"
                    className="sge-inspecao-retry-btn"
                    onClick={carregarFotoAtual}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {urlAtual && !carregando && !erro && (
                <div className="sge-inspecao-canvas-wrap">
                  <img
                    src={urlAtual}
                    alt={fotoAtual?.nomeOriginal || `Documento ${indiceAtivo + 1}`}
                    className="sge-inspecao-img"
                    style={{
                      maxWidth: `${maxLarguraEfetiva}px`,
                      maxHeight: `${maxAlturaEfetiva}px`,
                      transform: `rotate(${rotacao}deg) scale(${zoomNivel})`,
                      transformOrigin: 'center center'
                    }}
                    onDoubleClick={() => setZoomNivel((prev) => (prev === 1 ? 1.75 : 1))}
                    onError={() => {
                      setBlobCache((prev) => {
                        const next = { ...prev };
                        delete next[anexoIdAtual];
                        return next;
                      });
                      setErro('Falha ao renderizar a imagem. Tente carregar novamente.');
                    }}
                    title="Dê duplo clique para alternar zoom rápido"
                  />
                </div>
              )}
            </div>

            {/* Navegação Rápida Direita */}
            {fotos.length > 1 && (
              <button
                type="button"
                className="sge-inspecao-nav sge-inspecao-nav--next"
                onClick={handleProxima}
                title="Próximo comprovante (Seta direita)"
                aria-label="Próximo comprovante"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </main>
        </div>

        {/* Rodapé / Barra de Status Técnico */}
        <footer className="sge-inspecao-statusbar">
          <div className="sge-inspecao-statusbar__dicas">
            <span>Setas: navegar</span>
            <span>•</span>
            <span>R: girar</span>
            <span>•</span>
            <span>+/-: zoom</span>
            <span>•</span>
            <span>0: ajustar</span>
            <span>•</span>
            <span>Esc: fechar</span>
          </div>

          <div className="sge-inspecao-statusbar__indicadores">
            <span className="sge-inspecao-status-pill">
              Zoom: {Math.round(zoomNivel * 100)}%
            </span>
            <span className="sge-inspecao-status-pill">
              Orientação: {rotacao}°
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default FotoGaleriaModal;
