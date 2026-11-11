import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
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
 * - Rotação em passos contínuos de 90° (horário e anti-horário) sem giro reverso em 360°
 * - Zoom escalonado (50% a 350%) com roda do mouse, gesto de pinça e ponto focal preservado
 * - Modo tela cheia expansivo para inspeção limpa de documentos no desktop e celular
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
  const [rotacao, setRotacao] = useState(0); // ângulo acumulado em múltiplos de 90°
  const [zoomNivel, setZoomNivel] = useState(1); // 1 = 100% (fit)
  const [telaCheia, setTelaCheia] = useState(false);
  const [dimensoesNaturais, setDimensoesNaturais] = useState(null);
  const [viewportDimensoes, setViewportDimensoes] = useState({
    largura: 800,
    altura: 600,
    padL: 16,
    padT: 16,
    padH: 32,
    padV: 32
  });
  const [isArrastando, setIsArrastando] = useState(false);

  const closeButtonRef = useRef(null);
  const viewportRef = useRef(null);
  const urlsCriadasRef = useRef(new Set());
  const blobCacheRef = useRef({});
  const emAndamentoRef = useRef(new Map());
  const sessaoIdRef = useRef(0);
  const posArrastoRef = useRef({ startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const zoomNivelRef = useRef(1);
  const layoutMetricasRef = useRef({
    wrapW: null,
    wrapH: null,
    padL: 16,
    padT: 16
  });
  const pendenteScrollAncoraRef = useRef(null);
  const pinchRef = useRef({
    ativo: false,
    distanciaInicial: 0,
    zoomInicial: 1
  });

  const dialogRef = useDialogAccessibility({
    isOpen,
    onClose,
    initialFocusRef: closeButtonRef
  });

  // Descarte seguro de todos os Blobs mantidos na sessão do modal
  const revogarTodosBlobs = useCallback(() => {
    sessaoIdRef.current += 1;
    emAndamentoRef.current.clear();
    blobCacheRef.current = {};
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

  // Monitora dimensões e paddings reais do viewport com ResizeObserver
  useEffect(() => {
    if (!isOpen || !viewportRef.current) return undefined;

    const atualizarDimensoes = () => {
      const vp = viewportRef.current;
      if (!vp) return;
      const cs = window.getComputedStyle(vp);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      const padT = parseFloat(cs.paddingTop) || 0;
      const padB = parseFloat(cs.paddingBottom) || 0;

      setViewportDimensoes({
        largura: vp.clientWidth,
        altura: vp.clientHeight,
        padL,
        padT,
        padH: padL + padR,
        padV: padT + padB
      });
    };

    atualizarDimensoes();
    const ro = new ResizeObserver(atualizarDimensoes);
    ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, [isOpen, telaCheia]);

  // Reseta visualizações ao abrir ou mudar de lote
  useEffect(() => {
    if (isOpen) {
      pendenteScrollAncoraRef.current = null;
      zoomNivelRef.current = 1;
      setIndiceAtivo(0);
      setRotacao(0);
      setZoomNivel(1);
      setTelaCheia(false);
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
    const emAndamento = emAndamentoRef.current;
    return () => {
      sessaoIdRef.current += 1;
      emAndamento.clear();
      blobCacheRef.current = {};
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
  const urlAtual = anexoIdAtual ? blobCache[anexoIdAtual] : undefined;

  // Compartilha download em curso por anexo e descarta com segurança se a sessão fechar antes do retorno
  const garantirFotoNoCache = useCallback(async (recId, anexoId) => {
    if (!recId || !anexoId) return null;
    if (blobCacheRef.current[anexoId]) return blobCacheRef.current[anexoId];

    const emCurso = emAndamentoRef.current.get(anexoId);
    if (emCurso) return emCurso;

    const sessaoLocal = sessaoIdRef.current;
    const promessa = obterFotoBlobUrl(recId, anexoId)
      .then((url) => {
        if (sessaoLocal !== sessaoIdRef.current) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // ignore
          }
          return null;
        }
        urlsCriadasRef.current.add(url);
        blobCacheRef.current = { ...blobCacheRef.current, [anexoId]: url };
        setBlobCache((prev) => (prev[anexoId] === url ? prev : { ...prev, [anexoId]: url }));
        return url;
      })
      .finally(() => {
        if (emAndamentoRef.current.get(anexoId) === promessa) {
          emAndamentoRef.current.delete(anexoId);
        }
      });

    emAndamentoRef.current.set(anexoId, promessa);
    return promessa;
  }, []);

  // Carregamento autenticado da foto ativa sob demanda
  const carregarFotoAtual = useCallback(async () => {
    if (!fotoAtual || !anexoIdAtual || !recIdEfetivo) return;

    if (blobCacheRef.current[anexoIdAtual]) {
      setCarregando(false);
      setErro(null);
      return;
    }

    const sessaoLocal = sessaoIdRef.current;
    setCarregando(true);
    setErro(null);

    try {
      await garantirFotoNoCache(recIdEfetivo, anexoIdAtual);
    } catch (err) {
      if (sessaoLocal === sessaoIdRef.current) {
        setErro(err?.message || 'Não foi possível carregar este documento.');
      }
    } finally {
      if (sessaoLocal === sessaoIdRef.current) {
        setCarregando(false);
      }
    }
  }, [fotoAtual, anexoIdAtual, recIdEfetivo, garantirFotoNoCache]);

  useEffect(() => {
    if (isOpen && fotoAtual) {
      carregarFotoAtual();
    }
  }, [isOpen, indiceAtivo, carregarFotoAtual, fotoAtual]);

  // Pré-carrega miniaturas em segundo plano com concorrência limitada após a primeira tentativa da foto ativa
  useEffect(() => {
    if (!isOpen || fotos.length <= 1 || (!urlAtual && !erro)) return undefined;

    const pendentes = fotos
      .map((f) => ({
        recId: f?.recebimentoId || recebimentoId,
        anexoId: f?.id || f?.anexoId
      }))
      .filter((item) => item.recId && item.anexoId && !blobCacheRef.current[item.anexoId]);

    if (pendentes.length === 0) return undefined;

    let cancelado = false;
    const sessaoLocal = sessaoIdRef.current;
    const fila = [...pendentes];

    const executarWorker = async () => {
      while (!cancelado && sessaoLocal === sessaoIdRef.current && fila.length > 0) {
        const proximo = fila.shift();
        if (!proximo) break;
        try {
          await garantirFotoNoCache(proximo.recId, proximo.anexoId);
        } catch {
          // Falha silenciosa em segundo plano; ao clicar na miniatura ocorre nova tentativa visível
        }
      }
    };

    const qtdWorkers = Math.min(2, fila.length);
    for (let i = 0; i < qtdWorkers; i += 1) {
      executarWorker();
    }

    return () => {
      cancelado = true;
    };
  }, [isOpen, fotos, recebimentoId, urlAtual, erro, garantirFotoNoCache]);

  // Aplica zoom preservando sob o cursor/pinça o mesmo ponto proporcional do documento
  const aplicarZoomComAncora = useCallback((novoZoomBruto, focalVpX = null, focalVpY = null) => {
    const novoZoom = Math.min(3.5, Math.max(0.5, +Number(novoZoomBruto).toFixed(3)));
    if (Math.abs(novoZoom - zoomNivelRef.current) < 0.0005) return;

    const vp = viewportRef.current;
    const metricas = layoutMetricasRef.current;

    if (vp && metricas.wrapW > 0 && metricas.wrapH > 0) {
      const fx = focalVpX ?? vp.clientWidth / 2;
      const fy = focalVpY ?? vp.clientHeight / 2;
      const startX1 = Math.max(metricas.padL, (vp.clientWidth - metricas.wrapW) / 2);
      const startY1 = Math.max(metricas.padT, (vp.clientHeight - metricas.wrapH) / 2);

      pendenteScrollAncoraRef.current = {
        u: (vp.scrollLeft + fx - startX1) / metricas.wrapW,
        v: (vp.scrollTop + fy - startY1) / metricas.wrapH,
        focalVpX: fx,
        focalVpY: fy
      };
    }

    zoomNivelRef.current = novoZoom;
    setZoomNivel(novoZoom);
  }, []);

  // Funções de controle de navegação e manipulação de imagem
  const handleAnterior = useCallback(() => {
    pendenteScrollAncoraRef.current = null;
    zoomNivelRef.current = 1;
    setIndiceAtivo((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
    setRotacao(0);
    setZoomNivel(1);
  }, [fotos.length]);

  const handleProxima = useCallback(() => {
    pendenteScrollAncoraRef.current = null;
    zoomNivelRef.current = 1;
    setIndiceAtivo((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
    setRotacao(0);
    setZoomNivel(1);
  }, [fotos.length]);

  const handleGirarHorario = useCallback(() => {
    setRotacao((prev) => prev + 90);
  }, []);

  const handleGirarAntiHorario = useCallback(() => {
    setRotacao((prev) => prev - 90);
  }, []);

  const handleZoomIn = useCallback(() => {
    aplicarZoomComAncora(zoomNivelRef.current + 0.25);
  }, [aplicarZoomComAncora]);

  const handleZoomOut = useCallback(() => {
    aplicarZoomComAncora(zoomNivelRef.current - 0.25);
  }, [aplicarZoomComAncora]);

  const handleZoomReset = useCallback(() => {
    pendenteScrollAncoraRef.current = null;
    zoomNivelRef.current = 1;
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

  // Cálculo real de dimensões encaixadas no viewport considerando rotação e zoom
  const naturaisAtuais =
    dimensoesNaturais &&
    dimensoesNaturais.anexoId === anexoIdAtual &&
    dimensoesNaturais.width > 0 &&
    dimensoesNaturais.height > 0
      ? dimensoesNaturais
      : null;
  const rotacaoNormalizada = ((rotacao % 360) + 360) % 360;
  const isRotacionado90 = rotacaoNormalizada === 90 || rotacaoNormalizada === 270;

  let imgW = null;
  let imgH = null;
  let wrapW = null;
  let wrapH = null;

  if (naturaisAtuais) {
    const dispLarguraVp = Math.max(120, viewportDimensoes.largura - viewportDimensoes.padH);
    const dispAlturaVp = Math.max(120, viewportDimensoes.altura - viewportDimensoes.padV);
    const baseVisW = isRotacionado90 ? naturaisAtuais.height : naturaisAtuais.width;
    const baseVisH = isRotacionado90 ? naturaisAtuais.width : naturaisAtuais.height;
    const fitScale = Math.min(dispLarguraVp / baseVisW, dispAlturaVp / baseVisH);

    imgW = Math.max(1, Math.round(naturaisAtuais.width * fitScale * zoomNivel));
    imgH = Math.max(1, Math.round(naturaisAtuais.height * fitScale * zoomNivel));
    wrapW = isRotacionado90 ? imgH : imgW;
    wrapH = isRotacionado90 ? imgW : imgH;
  }

  // Sincroniza métricas reais do layout e reposiciona scroll na âncora antes da pintura
  useLayoutEffect(() => {
    zoomNivelRef.current = zoomNivel;
    layoutMetricasRef.current = {
      wrapW,
      wrapH,
      padL: viewportDimensoes.padL,
      padT: viewportDimensoes.padT
    };

    const ancora = pendenteScrollAncoraRef.current;
    const vp = viewportRef.current;
    if (!ancora || !vp || !wrapW || !wrapH) return;

    pendenteScrollAncoraRef.current = null;
    const startX2 = Math.max(viewportDimensoes.padL, (vp.clientWidth - wrapW) / 2);
    const startY2 = Math.max(viewportDimensoes.padT, (vp.clientHeight - wrapH) / 2);
    vp.scrollLeft = Math.max(0, startX2 + ancora.u * wrapW - ancora.focalVpX);
    vp.scrollTop = Math.max(0, startY2 + ancora.v * wrapH - ancora.focalVpY);
  }, [zoomNivel, wrapW, wrapH, viewportDimensoes.padL, viewportDimensoes.padT]);

  // Listeners nativos não-passivos para zoom via roda do mouse (PC) e pinça com 2 dedos (celular)
  useEffect(() => {
    const vp = viewportRef.current;
    if (!isOpen || !vp) return undefined;

    const pinchState = pinchRef.current;
    const obterDistanciaTouches = (t1, t2) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    const handleWheel = (e) => {
      if (!vp.querySelector('.sge-inspecao-img')) return;

      const normDeltaY =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
            ? e.deltaY * vp.clientHeight
            : e.deltaY;
      if (!normDeltaY) return;

      e.preventDefault();
      const intensidade = Math.min(Math.max(Math.abs(normDeltaY) / 100, 0.05), 1.5);
      const fator = Math.pow(1.18, normDeltaY < 0 ? intensidade : -intensidade);
      const rect = vp.getBoundingClientRect();
      aplicarZoomComAncora(zoomNivelRef.current * fator, e.clientX - rect.left, e.clientY - rect.top);
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 2 && vp.querySelector('.sge-inspecao-img')) {
        if (e.cancelable) e.preventDefault();
        const distancia = obterDistanciaTouches(e.touches[0], e.touches[1]);
        pinchState.ativo = distancia > 0;
        pinchState.distanciaInicial = distancia;
        pinchState.zoomInicial = zoomNivelRef.current;
      } else if (e.touches.length < 2 && pinchState.ativo) {
        pinchState.ativo = false;
      }
    };

    const handleTouchMove = (e) => {
      if (pinchState.ativo && e.touches.length === 2) {
        if (e.cancelable) e.preventDefault();
        const distanciaAtual = obterDistanciaTouches(e.touches[0], e.touches[1]);
        if (pinchState.distanciaInicial <= 0) return;

        const fator = distanciaAtual / pinchState.distanciaInicial;
        const rect = vp.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        aplicarZoomComAncora(pinchState.zoomInicial * fator, midX, midY);
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length < 2) {
        pinchState.ativo = false;
      }
    };

    const handleGesturePrevent = (e) => {
      if (vp.querySelector('.sge-inspecao-img') && e.cancelable) {
        e.preventDefault();
      }
    };

    vp.addEventListener('wheel', handleWheel, { passive: false });
    vp.addEventListener('touchstart', handleTouchStart, { passive: false });
    vp.addEventListener('touchmove', handleTouchMove, { passive: false });
    vp.addEventListener('touchend', handleTouchEnd);
    vp.addEventListener('touchcancel', handleTouchEnd);
    vp.addEventListener('gesturestart', handleGesturePrevent, { passive: false });
    vp.addEventListener('gesturechange', handleGesturePrevent, { passive: false });

    return () => {
      pinchState.ativo = false;
      vp.removeEventListener('wheel', handleWheel);
      vp.removeEventListener('touchstart', handleTouchStart);
      vp.removeEventListener('touchmove', handleTouchMove);
      vp.removeEventListener('touchend', handleTouchEnd);
      vp.removeEventListener('touchcancel', handleTouchEnd);
      vp.removeEventListener('gesturestart', handleGesturePrevent);
      vp.removeEventListener('gesturechange', handleGesturePrevent);
    };
  }, [isOpen, fotos.length, aplicarZoomComAncora]);

  if (!isOpen || !fotos || fotos.length === 0) {
    return null;
  }

  // Fallback de dimensões máximas apenas até onLoad informar naturalWidth/naturalHeight
  const maxLarguraEfetivaFallback = isRotacionado90
    ? Math.max(160, viewportDimensoes.altura - viewportDimensoes.padV)
    : Math.max(160, viewportDimensoes.largura - viewportDimensoes.padH);
  const maxAlturaEfetivaFallback = isRotacionado90
    ? Math.max(160, viewportDimensoes.largura - viewportDimensoes.padH)
    : Math.max(160, viewportDimensoes.altura - viewportDimensoes.padV);

  const itensConferidos = dadosOperacao?.itens || [];

  return (
    <div
      className={`sge-inspecao-backdrop ${telaCheia ? 'sge-inspecao-backdrop--tela-cheia' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onTouchCancel={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div
        className={`sge-inspecao-modal ${telaCheia ? 'sge-inspecao-modal--tela-cheia' : ''}`}
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
            {/* Alternar Modo Tela Cheia */}
            <button
              type="button"
              className={`sge-inspecao-btn-tool ${telaCheia ? 'sge-inspecao-btn-tool--ativo' : ''}`}
              onClick={() => setTelaCheia((prev) => !prev)}
              title={telaCheia ? 'Sair da tela cheia' : 'Exibir imagem em tela cheia'}
              aria-label={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
              aria-pressed={telaCheia}
            >
              {telaCheia ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
              <span className="sge-inspecao-btn-label">
                {telaCheia ? 'Sair' : 'Tela cheia'}
              </span>
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
              disabled={zoomNivel >= 3.5}
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
              className="sge-inspecao-btn-tool"
              onClick={handleGirarHorario}
              title="Girar 90° à direita (R)"
              aria-label="Girar 90° à direita"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
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
          </div>

          {/* Botão Fechar isolado para fixar no topo direito em telas estreitas */}
          <div className="sge-inspecao-header__fechar-bloco">
            <span className="sge-inspecao-toolbar-divisoria" />
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
          {!telaCheia && (
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
                        pendenteScrollAncoraRef.current = null;
                        zoomNivelRef.current = 1;
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
                <div
                  className="sge-inspecao-canvas-wrap"
                  style={wrapW && wrapH ? { width: `${wrapW}px`, height: `${wrapH}px` } : undefined}
                >
                  <img
                    key={anexoIdAtual ?? indiceAtivo}
                    src={urlAtual}
                    alt={fotoAtual?.nomeOriginal || `Documento ${indiceAtivo + 1}`}
                    className="sge-inspecao-img"
                    draggable={false}
                    style={
                      imgW && imgH
                        ? {
                            width: `${imgW}px`,
                            height: `${imgH}px`,
                            maxWidth: 'none',
                            maxHeight: 'none',
                            flexShrink: 0,
                            transform: `rotate(${rotacao}deg)`,
                            transformOrigin: 'center center'
                          }
                        : {
                            maxWidth: `${maxLarguraEfetivaFallback}px`,
                            maxHeight: `${maxAlturaEfetivaFallback}px`,
                            transform: `rotate(${rotacao}deg)`,
                            transformOrigin: 'center center'
                          }
                    }
                    onLoad={(e) => {
                      const { naturalWidth, naturalHeight } = e.currentTarget;
                      if (naturalWidth > 0 && naturalHeight > 0) {
                        setDimensoesNaturais({
                          anexoId: anexoIdAtual,
                          width: naturalWidth,
                          height: naturalHeight
                        });
                      }
                    }}
                    onDoubleClick={(e) => {
                      const vp = viewportRef.current;
                      const proximoZoom = zoomNivelRef.current <= 1.05 ? 2 : 1;
                      if (!vp) {
                        aplicarZoomComAncora(proximoZoom);
                        return;
                      }
                      const rect = vp.getBoundingClientRect();
                      aplicarZoomComAncora(proximoZoom, e.clientX - rect.left, e.clientY - rect.top);
                    }}
                    onError={() => {
                      const urlComErro = blobCacheRef.current[anexoIdAtual];
                      if (urlComErro) {
                        delete blobCacheRef.current[anexoIdAtual];
                        urlsCriadasRef.current.delete(urlComErro);
                        try {
                          URL.revokeObjectURL(urlComErro);
                        } catch {
                          // ignore
                        }
                      }
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
        {!telaCheia && (
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
                Orientação: {rotacaoNormalizada}°
              </span>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};

export default FotoGaleriaModal;
