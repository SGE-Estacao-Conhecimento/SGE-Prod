import React, { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StatusBadge, BottomSheetModal } from '../common';
import './MeusPedidos.css';

const MESES_PTBR = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Normaliza e gera um rótulo legível para agrupamento de datas ("Hoje", "Ontem" ou "DD de Mês de AAAA").
 */
const obterRotuloGrupoData = (dataIso, dataTexto) => {
  let dateObj = null;

  if (dataIso) {
    const d = new Date(dataIso);
    if (!isNaN(d.getTime())) {
      dateObj = d;
    }
  }

  if (!dateObj && dataTexto) {
    const parts = String(dataTexto).trim().split(/[/.-]/);
    if (parts.length === 3) {
      const dia = parseInt(parts[0], 10);
      const mes = parseInt(parts[1], 10) - 1;
      const ano = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
      const d = new Date(ano, mes, dia);
      if (!isNaN(d.getTime())) {
        dateObj = d;
      }
    }
  }

  if (!dateObj) {
    return dataTexto || 'Data anterior';
  }

  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);

  const mesmoDia = (d1, d2) =>
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();

  if (mesmoDia(dateObj, hoje)) {
    return 'Hoje';
  }
  if (mesmoDia(dateObj, ontem)) {
    return 'Ontem';
  }

  const dia = String(dateObj.getDate()).padStart(2, '0');
  const mesNome = MESES_PTBR[dateObj.getMonth()];
  const ano = dateObj.getFullYear();
  return `${dia} de ${mesNome} de ${ano}`;
};

/**
 * Retorna uma chave serializável YYYY-MM-DD para agrupamento cronológico.
 */
const obterChaveGrupoData = (dataIso, dataTexto) => {
  if (dataIso) {
    const d = new Date(dataIso);
    if (!isNaN(d.getTime())) {
      const ano = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    }
  }
  if (dataTexto) {
    const parts = String(dataTexto).trim().split(/[/.-]/);
    if (parts.length === 3) {
      const dia = parts[0].padStart(2, '0');
      const mes = parts[1].padStart(2, '0');
      const ano = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${ano}-${mes}-${dia}`;
    }
  }
  return dataTexto || 'sem-data';
};

/**
 * Renderiza o status inline com mini ícone vetorial (sem badge/pílula de fundo).
 * Atende à diretriz: "Pedido entregue" com mini V verde, e respectivos para outros status.
 */
const renderStatusHistorico = (statusNorm) => {
  switch (statusNorm) {
    case 'entregue':
      return (
        <span className="pedido-status-inline pedido-status-inline--entregue">
          <svg className="pedido-status-inline__icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Pedido entregue
        </span>
      );
    case 'cancelado':
      return (
        <span className="pedido-status-inline pedido-status-inline--cancelado">
          <svg className="pedido-status-inline__icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
          </svg>
          Pedido cancelado
        </span>
      );
    case 'estoque-insuficiente':
      return (
        <span className="pedido-status-inline pedido-status-inline--insuficiente">
          <svg className="pedido-status-inline__icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Estoque insuficiente
        </span>
      );
    case 'atendido-parcialmente':
      return (
        <span className="pedido-status-inline pedido-status-inline--parcial">
          <svg className="pedido-status-inline__icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Atendido parcialmente
        </span>
      );
    case 'parcialmente-disponivel':
      return (
        <span className="pedido-status-inline pedido-status-inline--parcial">
          <svg className="pedido-status-inline__icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Parcialmente disponível
        </span>
      );
    case 'em-separacao':
      return (
        <span className="pedido-status-inline pedido-status-inline--separacao">
          <svg className="pedido-status-inline__icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Em separação
        </span>
      );
    case 'pronto':
      return (
        <span className="pedido-status-inline pedido-status-inline--pronto">
          <svg className="pedido-status-inline__icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Pronto para retirada
        </span>
      );
    case 'aguardando-separacao':
    default:
      return (
        <span className="pedido-status-inline pedido-status-inline--pendente">
          <svg className="pedido-status-inline__icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Aguardando separação
        </span>
      );
  }
};

/**
 * Dispara um efeito visual ripple (onda expansiva circular) a partir da coordenada de clique/toque.
 * Permanece preenchido enquanto o ponteiro/dedo estiver pressionado, esvanecendo ao soltar.
 */
const dispararRipple = (e, cor = 'rgba(15, 23, 42, 0.14)') => {
  const container = e.currentTarget;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const clientX = typeof e.clientX === 'number' && e.clientX > 0 ? e.clientX : rect.left + rect.width / 2;
  const clientY = typeof e.clientY === 'number' && e.clientY > 0 ? e.clientY : rect.top + rect.height / 2;

  const diameter = Math.max(rect.width, rect.height) * 2.4;
  const radius = diameter / 2;

  // Remove ondas residuais anteriores no container
  const antigas = container.getElementsByClassName('sge-ripple-wave');
  while (antigas.length > 0) {
    antigas[0].remove();
  }

  const ripple = document.createElement('span');
  ripple.className = 'sge-ripple-wave';
  ripple.style.width = `${diameter}px`;
  ripple.style.height = `${diameter}px`;
  ripple.style.left = `${clientX - rect.left - radius}px`;
  ripple.style.top = `${clientY - rect.top - radius}px`;
  if (cor) {
    ripple.style.backgroundColor = cor;
  }

  container.appendChild(ripple);

  const startTime = Date.now();
  const minExpansionTime = 280; // Tempo mínimo de expansão suave para toques rápidos

  let liberado = false;
  const finalizarRipple = () => {
    if (liberado) return;
    liberado = true;

    window.removeEventListener('pointerup', finalizarRipple);
    window.removeEventListener('pointercancel', finalizarRipple);
    window.removeEventListener('blur', finalizarRipple);

    const elapsed = Date.now() - startTime;
    const restante = Math.max(0, minExpansionTime - elapsed);

    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.classList.add('sge-ripple-wave--leave');
      }
      setTimeout(() => {
        if (ripple.parentNode) {
          ripple.remove();
        }
      }, 400);
    }, restante);
  };

  window.addEventListener('pointerup', finalizarRipple, { once: true });
  window.addEventListener('pointercancel', finalizarRipple, { once: true });
  window.addEventListener('blur', finalizarRipple, { once: true });
};

/**
 * MeusPedidos — Gestão e Visualização Modernizada de Pedidos do Usuário (SGE)
 * 
 * - Fonte da verdade única (centralizada em Usuario.jsx, consumida via props).
 * - Hero Status Card no topo para pedido ativo (status direto e orientações operacionais sem steppers artificiais).
 * - Histórico permanente com agrupamento cronológico por datas ("Hoje", "Ontem", "DD de Mês de AAAA").
 * - Cards uniformes de altura padronizada (142px) com resumo truncado e modal de detalhes completos (BottomSheetModal).
 * - Ação de repetição ágil ("Pedir Novamente") com confirmação em modal.
 * - Foco suave e destaque luminoso acionado por pedidoFocadoId.
 * - Zero caracteres Unicode decorativos ou emojis.
 */
const MeusPedidos = ({
  pedidos = [],
  _user,
  onCancelarPedido,
  onNavigateToEstoque,
  onPedirNovamente,
  pedidoFocadoId = null,
  onLimparFocoPedido
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cancelModalPedido, setCancelModalPedido] = useState(null);
  const [cancelandoPedido, setCancelandoPedido] = useState(false);
  const [reorderModalPedido, setReorderModalPedido] = useState(null);
  const [reordenandoPedido, setReordenandoPedido] = useState(false);
  const [detalhesModalPedido, setDetalhesModalPedido] = useState(null);
  const [toastFeedback, setToastFeedback] = useState(null);

  const [activePedidoId, setActivePedidoId] = useState(null);
  const [pedidoDestaqueId, setPedidoDestaqueId] = useState(null);

  // Normalização semântica do status do pedido
  const normalizarStatus = (status = '') => {
    const s = String(status).toLowerCase().trim();
    if (s.includes('insuficiente') || s.includes('falta') || s.includes('recusad')) return 'estoque-insuficiente';
    if (s === 'atendido-parcialmente' || s === 'atendido parcialmente' || s.includes('atendido parc')) return 'atendido-parcialmente';
    if (s.includes('parcial')) return 'parcialmente-disponivel';
    if (s.includes('pronto')) return 'pronto';
    if (s.includes('separ')) return 'em-separacao';
    if (s.includes('pendent') || s.includes('aguard')) return 'aguardando-separacao';
    if (s.includes('atendid') || s.includes('entreg') || s.includes('conclui')) return 'entregue';
    if (s.includes('cancel')) return 'cancelado';
    return s || 'aguardando-separacao';
  };

  const isStatusAndamento = (status) => {
    const norm = normalizarStatus(status);
    return norm === 'aguardando-separacao' || norm === 'em-separacao' || norm === 'pronto' || norm === 'parcialmente-disponivel';
  };

  const obterEtapaStatus = (status = '') => {
    const norm = normalizarStatus(status);
    if (norm === 'pronto' || norm === 'parcialmente-disponivel' || norm === 'entregue') return 3;
    if (norm === 'em-separacao') return 2;
    return 1;
  };

  // Separação em pedidos ativos e histórico
  const pedidosAtivos = useMemo(() => {
    return pedidos.filter(p => isStatusAndamento(p.status));
  }, [pedidos]);

  const pedidosHistorico = useMemo(() => {
    return pedidos.filter(p => !isStatusAndamento(p.status));
  }, [pedidos]);

  // Pedido ativo selecionado para o Hero Tracker
  const pedidoHero = useMemo(() => {
    if (pedidosAtivos.length === 0) return null;
    if (activePedidoId) {
      const found = pedidosAtivos.find(p => p.id === activePedidoId);
      if (found) return found;
    }
    return pedidosAtivos[0];
  }, [pedidosAtivos, activePedidoId]);

  // Estado e controle do Carrossel Infinito de Pedidos Ativos
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragDelta, setDragDelta] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState(null);

  const carouselContainerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return Math.min(window.innerWidth, 900);
    }
    return 390;
  });

  const pointerStartX = useRef(0);
  const pointerStartY = useRef(0);
  const pointerStartTime = useRef(0);
  const isDraggingRef = useRef(false);
  const isHorizontalDragRef = useRef(false);

  // Monitora largura do container responsivamente
  useEffect(() => {
    const el = carouselContainerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth || (typeof window !== 'undefined' ? window.innerWidth : 390);
      if (w > 0) {
        setContainerWidth(w);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [pedidosAtivos.length]);

  // Sincroniza currentIndex caso a quantidade de pedidos ativos mude
  useEffect(() => {
    if (currentIndex >= pedidosAtivos.length && pedidosAtivos.length > 0) {
      setCurrentIndex(pedidosAtivos.length - 1);
    }
  }, [pedidosAtivos.length, currentIndex]);

  // Sincroniza activePedidoId com currentIndex
  useEffect(() => {
    if (activePedidoId && pedidosAtivos.length > 0) {
      const idx = pedidosAtivos.findIndex(p => p.id === activePedidoId);
      if (idx !== -1 && idx !== currentIndex) {
        setCurrentIndex(idx);
      }
    }
  }, [activePedidoId, pedidosAtivos, currentIndex]);

  const isDesktop = containerWidth > 900;
  const PEEK_SIDE = 18;
  const GAP_CAROUSEL = 10;

  const cardWidth = useMemo(() => {
    if (containerWidth <= 0) return 340;
    if (isDesktop) return containerWidth;
    // No mobile/tablet, mantém o respiro de peek estritamente fixo em 18px de cada lado (18px peek + 10px gap de cada lado = 56px)
    return Math.max(260, containerWidth - (PEEK_SIDE + GAP_CAROUSEL) * 2);
  }, [containerWidth, isDesktop]);

  const gap = GAP_CAROUSEL;
  const step = cardWidth + gap;
  const baseOffset = isDesktop ? 0 : (containerWidth - cardWidth) / 2 - step;

  const navegarPara = useCallback((dir) => {
    if (isAnimating || pedidosAtivos.length <= 1) return;
    setIsAnimating(true);
    setSlideDirection(dir);

    setTimeout(() => {
      setCurrentIndex(prev => {
        const nextIdx = dir === 'next'
          ? (prev + 1) % pedidosAtivos.length
          : (prev - 1 + pedidosAtivos.length) % pedidosAtivos.length;
        setActivePedidoId(pedidosAtivos[nextIdx]?.id);
        return nextIdx;
      });
      setSlideDirection(null);
      setDragDelta(0);
      setIsAnimating(false);
    }, 260);
  }, [isAnimating, pedidosAtivos]);

  const snapBack = useCallback(() => {
    setIsAnimating(true);
    setDragDelta(0);
    setTimeout(() => {
      setIsAnimating(false);
    }, 200);
  }, []);

  const handlePointerDown = (e) => {
    if (isAnimating || pedidosAtivos.length <= 1 || isDesktop) return;
    if (e.target.closest('.hero-tracker__footer') || e.target.closest('button')) {
      return;
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignora caso o navegador não suporte
    }
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    pointerStartTime.current = Date.now();
    isDraggingRef.current = true;
    isHorizontalDragRef.current = false;
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current || isAnimating || isDesktop) return;
    const dx = e.clientX - pointerStartX.current;
    const dy = e.clientY - pointerStartY.current;

    if (!isHorizontalDragRef.current) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
        isDraggingRef.current = false;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch { }
        return;
      }
      if (Math.abs(dx) > 8) {
        isHorizontalDragRef.current = true;
      }
    }

    if (isHorizontalDragRef.current) {
      setDragDelta(dx);
    }
  };

  const handlePointerUp = useCallback((e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (e?.currentTarget && e?.pointerId !== undefined) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch { }
    }

    if (!isHorizontalDragRef.current) {
      setDragDelta(0);
      return;
    }

    const currentDx = (e?.clientX !== undefined && pointerStartX.current)
      ? (e.clientX - pointerStartX.current)
      : dragDelta;
    const threshold = Math.min(45, cardWidth * 0.12);
    const elapsed = Date.now() - pointerStartTime.current;
    const isFlick = elapsed < 280 && Math.abs(currentDx) > 25;

    if (currentDx < -threshold || (isFlick && currentDx < 0)) {
      navegarPara('next');
    } else if (currentDx > threshold || (isFlick && currentDx > 0)) {
      navegarPara('prev');
    } else {
      snapBack();
    }
  }, [cardWidth, dragDelta, navegarPara, snapBack]);

  // Listener global para garantir que soltar o dedo ou ponteiro em qualquer lugar finalize o arraste
  useEffect(() => {
    const handleGlobalPointerUp = (e) => {
      if (isDraggingRef.current) {
        handlePointerUp(e);
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [handlePointerUp]);

  let currentOffset = baseOffset + dragDelta;
  let transitionStyle = 'none';
  let slotTransitionStyle = 'none';

  // Progresso normalizado (-1: prev, 0: center, 1: next) para foco gradual dos cards
  let animProgress = 0;

  if (isAnimating) {
    if (slideDirection === 'next') {
      currentOffset = baseOffset - step;
      transitionStyle = 'transform 0.26s cubic-bezier(0.2, 0.9, 0.3, 1)';
      slotTransitionStyle = 'opacity 0.26s cubic-bezier(0.2, 0.9, 0.3, 1), transform 0.26s cubic-bezier(0.2, 0.9, 0.3, 1)';
      animProgress = 1;
    } else if (slideDirection === 'prev') {
      currentOffset = baseOffset + step;
      transitionStyle = 'transform 0.26s cubic-bezier(0.2, 0.9, 0.3, 1)';
      slotTransitionStyle = 'opacity 0.26s cubic-bezier(0.2, 0.9, 0.3, 1), transform 0.26s cubic-bezier(0.2, 0.9, 0.3, 1)';
      animProgress = -1;
    } else {
      currentOffset = baseOffset;
      transitionStyle = 'transform 0.2s ease-out';
      slotTransitionStyle = 'opacity 0.2s ease-out, transform 0.2s ease-out';
      animProgress = 0;
    }
  } else if (step > 0) {
    // Durante o arraste manual do usuário, calcula a interpolação contínua proporcional ao deslocamento do dedo
    animProgress = Math.max(-1, Math.min(1, -dragDelta / step));
  }

  // Interpolação gradual de opacidade (0.65 -> 1.0) e escala (0.97 -> 1.0) para cada slot
  const MIN_OPACITY = 0.65;
  const OPACITY_RANGE = 0.35;
  const MIN_SCALE = 0.97;
  const SCALE_RANGE = 0.03;

  // Slot 1 (Centro / Atual): atinge 1.0 quando animProgress está em 0 e diminui para 0.65 ao se afastar
  const slot1Factor = Math.max(0, Math.min(1, 1 - Math.abs(animProgress)));
  const slot1Opacity = MIN_OPACITY + slot1Factor * OPACITY_RANGE;
  const slot1Scale = MIN_SCALE + slot1Factor * SCALE_RANGE;

  // Slot 2 (Direita / Próximo): aumenta gradualmente para 1.0 conforme se aproxima do centro (animProgress > 0)
  const slot2Factor = animProgress > 0 ? Math.min(1, animProgress) : 0;
  const slot2Opacity = MIN_OPACITY + slot2Factor * OPACITY_RANGE;
  const slot2Scale = MIN_SCALE + slot2Factor * SCALE_RANGE;

  // Slot 0 (Esquerda / Anterior): aumenta gradualmente para 1.0 conforme se aproxima do centro (animProgress < 0)
  const slot0Factor = animProgress < 0 ? Math.min(1, -animProgress) : 0;
  const slot0Opacity = MIN_OPACITY + slot0Factor * OPACITY_RANGE;
  const slot0Scale = MIN_SCALE + slot0Factor * SCALE_RANGE;

  // Medição síncrona de alturas máximas para alinhamento uniforme perfeito
  const topProbesRef = useRef(new Map());
  const bannerProbesRef = useRef(new Map());
  const [syncedTopHeight, setSyncedTopHeight] = useState(0);
  const [syncedBannerHeight, setSyncedBannerHeight] = useState(0);

  const registrarTopProbe = useCallback((id, el) => {
    if (el) topProbesRef.current.set(id, el);
    else topProbesRef.current.delete(id);
  }, []);

  const registrarBannerProbe = useCallback((id, el) => {
    if (el) bannerProbesRef.current.set(id, el);
    else bannerProbesRef.current.delete(id);
  }, []);

  useLayoutEffect(() => {
    if (pedidosAtivos.length <= 1) {
      if (syncedTopHeight !== 0) setSyncedTopHeight(0);
      if (syncedBannerHeight !== 0) setSyncedBannerHeight(0);
      return;
    }

    let maxTop = 0;
    for (const el of topProbesRef.current.values()) {
      if (el) {
        const h = el.offsetHeight;
        if (h > maxTop) maxTop = h;
      }
    }

    let maxBanner = 0;
    for (const el of bannerProbesRef.current.values()) {
      if (el) {
        const h = el.offsetHeight;
        if (h > maxBanner) maxBanner = h;
      }
    }

    if (maxTop > 0 && Math.abs(maxTop - syncedTopHeight) > 1) {
      setSyncedTopHeight(maxTop);
    }
    if (maxBanner > 0 && Math.abs(maxBanner - syncedBannerHeight) > 1) {
      setSyncedBannerHeight(maxBanner);
    }
  }, [pedidosAtivos, cardWidth, syncedTopHeight, syncedBannerHeight]);

  // Foco suave ao receber pedidoFocadoId vindo de notificações
  useEffect(() => {
    if (!pedidoFocadoId) return;
    const pedidoAlvo = pedidos.find(p => String(p.id) === String(pedidoFocadoId));
    if (!pedidoAlvo) return;

    if (isStatusAndamento(pedidoAlvo.status)) {
      setActivePedidoId(pedidoAlvo.id);
      const targetIdx = pedidosAtivos.findIndex(p => String(p.id) === String(pedidoAlvo.id));
      if (targetIdx !== -1) {
        setCurrentIndex(targetIdx);
      }
      const heroElem = document.getElementById(`pedido-hero-tracker-${pedidoAlvo.id}`) || document.getElementById('pedido-hero-tracker');
      if (heroElem) {
        heroElem.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      setPedidoDestaqueId(pedidoAlvo.id);
    } else {
      const timerScroll = setTimeout(() => {
        const cardElem = document.getElementById(`pedido-${pedidoAlvo.id}`);
        if (cardElem) {
          cardElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setPedidoDestaqueId(pedidoAlvo.id);
      }, 150);
      return () => clearTimeout(timerScroll);
    }

    const timerClear = setTimeout(() => {
      setPedidoDestaqueId(null);
      onLimparFocoPedido?.();
    }, 3000);
    return () => clearTimeout(timerClear);
  }, [pedidoFocadoId, pedidos, pedidosAtivos, onLimparFocoPedido]);

  // Extrai lista uniforme de materiais/itens de um pedido
  const getItensPedido = (p) => {
    if (!p) return [];

    const resolverNome = (it) => {
      const nome = it?.materialNome || it?.nome || it?.material;
      if (nome && String(nome).trim() && nome !== 'undefined') return nome;
      const id = it?.produtoId || it?.id;
      return id ? `Material #${id}` : 'Material Solicitado';
    };

    const resolverUnidade = (it) => {
      const unid = it?.unidade;
      if (unid && String(unid).trim() && unid !== 'undefined') return unid;
      return 'UN';
    };

    if (Array.isArray(p.itens) && p.itens.length > 0) {
      return p.itens.map(it => ({
        materialNome: resolverNome(it),
        quantidade: it.quantidade || 1,
        unidade: resolverUnidade(it),
        produtoId: it.produtoId || it.id,
        disponivel: it.disponivel !== false && it.status !== 'falta',
        quantidadeAtendida: it.quantidadeAtendida
      }));
    }
    if (Array.isArray(p.materiais) && p.materiais.length > 0) {
      return p.materiais.map(m => typeof m === 'string' ? { materialNome: m, quantidade: 1, unidade: 'UN', disponivel: true } : {
        materialNome: resolverNome(m),
        quantidade: m.quantidade || 1,
        unidade: resolverUnidade(m),
        produtoId: m.produtoId || m.id,
        disponivel: m.disponivel !== false && m.status !== 'falta',
        quantidadeAtendida: m.quantidadeAtendida
      });
    }
    return [{
      materialNome: p.material || 'Material Solicitado',
      quantidade: p.quantidade || 1,
      unidade: p.unidade || 'UN',
      produtoId: p.produtoId,
      disponivel: true,
      quantidadeAtendida: p.quantidadeAtendida
    }];
  };

  // Confirmação e repetição de pedido via API
  const handleConfirmarPedirNovamente = async () => {
    if (!reorderModalPedido || reordenandoPedido) return;
    setReordenandoPedido(true);

    try {
      const itensOriginais = getItensPedido(reorderModalPedido);
      const totalQtd = itensOriginais.reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);
      const unidadePadrao = itensOriginais[0]?.unidade || 'UN';

      if (onPedirNovamente) {
        const criado = await onPedirNovamente({
          material: itensOriginais.map(m => m.materialNome).join(', '),
          quantidade: totalQtd,
          unidade: unidadePadrao,
          itens: itensOriginais,
          materiais: itensOriginais,
          justificativa: `Repetição do Pedido #${reorderModalPedido.id}: ${reorderModalPedido.justificativa || 'Uso contínuo'}`,
          prioridade: reorderModalPedido.prioridade || 'Normal',
          urgente: !!reorderModalPedido.urgente
        });

        const novoId = criado?.id;
        if (novoId) {
          setActivePedidoId(novoId);
        }
        setReorderModalPedido(null);

        setToastFeedback({
          id: novoId || reorderModalPedido.id,
          titulo: `Pedido #${novoId || ''} enviado com sucesso!`,
          detalhe: `${itensOriginais.length} ${itensOriginais.length === 1 ? 'material enviado' : 'materiais enviados'} para o almoxarifado.`,
          tipo: 'sucesso'
        });

        setTimeout(() => setToastFeedback(null), 4500);
      }
    } catch (error) {
      setToastFeedback({
        id: `err-${Date.now()}`,
        titulo: 'Erro ao repetir pedido',
        detalhe: error?.message || 'Tente novamente mais tarde.',
        tipo: 'erro'
      });
      setTimeout(() => setToastFeedback(null), 4500);
    } finally {
      setReordenandoPedido(false);
    }
  };

  // Confirmação de cancelamento via API
  const handleConfirmCancel = async () => {
    if (!cancelModalPedido || cancelandoPedido) return;
    const pedidoId = cancelModalPedido.id;
    setCancelandoPedido(true);

    try {
      if (onCancelarPedido) {
        await onCancelarPedido(pedidoId);
      }

      setToastFeedback({
        id: `cancel-${pedidoId}`,
        titulo: `Pedido #${pedidoId} cancelado`,
        detalhe: 'A solicitação foi removida da fila de atendimento.',
        tipo: 'aviso'
      });

      setTimeout(() => setToastFeedback(null), 4500);
      setCancelModalPedido(null);
    } catch (error) {
      setToastFeedback({
        id: `cancel-error-${pedidoId}`,
        titulo: `Não foi possível cancelar o Pedido #${pedidoId}`,
        detalhe: error?.message || 'Verifique se o pedido ainda está na fila inicial.',
        tipo: 'erro'
      });
      setTimeout(() => setToastFeedback(null), 5000);
    } finally {
      setCancelandoPedido(false);
    }
  };

  // Filtragem e ordenação do histórico
  const pedidosHistoricoFiltrados = useMemo(() => {
    return pedidosHistorico.filter(p => {
      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      const idMatch = String(p.id || '').toLowerCase().includes(term);
      const justMatch = (p.justificativa || '').toLowerCase().includes(term);
      const itens = getItensPedido(p);
      const materialMatch = itens.some(it => (it.materialNome || '').toLowerCase().includes(term));

      return idMatch || materialMatch || justMatch;
    }).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  }, [pedidosHistorico, searchTerm]);

  // Agrupamento cronológico dos pedidos históricos por data
  const historicoAgrupado = useMemo(() => {
    const mapa = new Map();

    for (const pedido of pedidosHistoricoFiltrados) {
      const chave = obterChaveGrupoData(pedido.dataIso, pedido.data);
      const label = obterRotuloGrupoData(pedido.dataIso, pedido.data);

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          label,
          pedidos: []
        });
      }
      mapa.get(chave).pedidos.push(pedido);
    }

    return Array.from(mapa.values());
  }, [pedidosHistoricoFiltrados]);

  // Renderiza o card individual de pedido ativo para reutilização nos slots do carrossel
  const renderHeroCard = (p, slotKey = '', isActive = true) => {
    if (!p) return null;
    const isDestacado = p.id === pedidoDestaqueId;
    const statusNorm = normalizarStatus(p.status);
    const etapaAtual = obterEtapaStatus(p.status);
    const podeCancelar = statusNorm === 'aguardando-separacao';
    const itens = getItensPedido(p);
    const isUrgente = (p.prioridade || '').toLowerCase() === 'urgente' || !!p.urgente;

    return (
      <section
        key={slotKey || p.id}
        id={`pedido-hero-tracker-${p.id}`}
        className={`pedido-hero-tracker ${isActive ? 'pedido-hero-tracker--clicavel' : ''} ${isDestacado ? 'pedido-hero-tracker--destacado' : ''}`}
        aria-label={`Pedido em andamento #${p.id}`}
        onClick={() => {
          if (isActive && !isHorizontalDragRef.current) {
            setDetalhesModalPedido(p);
          }
        }}
        onPointerDown={(e) => {
          if (isActive) {
            dispararRipple(e);
          }
        }}
        role={isActive ? 'button' : undefined}
        tabIndex={isActive ? 0 : undefined}
        onKeyDown={(e) => {
          if (isActive && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setDetalhesModalPedido(p);
          }
        }}
      >
        {/* Topo do Card: Cabeçalho e Materiais */}
        <div
          className="hero-tracker__top"
          style={syncedTopHeight > 0 ? { minHeight: `${syncedTopHeight}px` } : undefined}
        >
          <div className="hero-tracker__header">
            <div className="hero-tracker__title-group">
              {isUrgente && (
                <div className="hero-tracker__badges">
                  <StatusBadge status="urgente" />
                </div>
              )}
              <h2 className="hero-tracker__order-id">
                Pedido #{p.id}
              </h2>
            </div>
          </div>

          <div className="hero-tracker__summary">
            <p className="hero-tracker__summary-preview">
              {itens.map(it => `${it.quantidade}x ${it.materialNome}`).join(', ')}
            </p>
          </div>
        </div>

        {/* Faixa Central de Status (Retângulo divisor de ponta a ponta) */}
        <div
          className={`hero-status-banner hero-status-banner--${statusNorm}`}
          style={syncedBannerHeight > 0 ? { minHeight: `${syncedBannerHeight}px` } : undefined}
        >
          <div
            className="hero-status-tracker-lines"
            role="progressbar"
            aria-valuenow={etapaAtual}
            aria-valuemin={1}
            aria-valuemax={3}
            aria-label={`Etapa ${etapaAtual} de 3`}
          >
            <div className={`hero-status-tracker-line ${etapaAtual >= 1 ? 'hero-status-tracker-line--active' : ''}`} />
            <div className={`hero-status-tracker-line ${etapaAtual >= 2 ? 'hero-status-tracker-line--active' : ''}`} />
            <div className={`hero-status-tracker-line ${etapaAtual >= 3 ? 'hero-status-tracker-line--active' : ''}`} />
          </div>

          <div className="hero-status-banner__top">
            <span className="hero-status-banner__badge-title">
              {statusNorm === 'aguardando-separacao' && 'Aguardando Atendimento'}
              {statusNorm === 'em-separacao' && 'Em Separação no Estoque'}
              {statusNorm === 'pronto' && 'Pronto para Retirada'}
              {statusNorm === 'parcialmente-disponivel' && 'Disponível Parcialmente'}
            </span>
          </div>
          <p className="hero-status-banner__desc">
            {statusNorm === 'aguardando-separacao' && (
              'Sua solicitação está registrada na fila de atendimento do almoxarifado aguardando liberação.'
            )}
            {statusNorm === 'em-separacao' && (
              'O almoxarife já está conferindo os itens e separando os materiais nas prateleiras.'
            )}
            {statusNorm === 'pronto' && (
              <>
                Todos os itens foram separados e estão disponíveis no balcão do <strong>Almoxarifado Central (Prédio A)</strong>. Apresente o número <strong>#{p.id}</strong> para retirar.
              </>
            )}
            {statusNorm === 'parcialmente-disponivel' && (
              <>
                Parte dos materiais solicitados já está separada no balcão do <strong>Almoxarifado Central (Prédio A)</strong>. Apresente o número <strong>#{p.id}</strong> para conferência.
              </>
            )}
          </p>
          {p.mensagemAlmoxarife && (
            <div className="hero-status-banner__msg">
              <span className="hero-status-banner__msg-label">Orientações do Almoxarife:</span>
              <p className="hero-status-banner__msg-text">"{p.mensagemAlmoxarife}"</p>
            </div>
          )}
        </div>

        {/* Rodapé com botões Cancelar Pedido e Ver Detalhes */}
        <div
          className="hero-tracker__footer"
          style={!isActive ? { pointerEvents: 'none' } : undefined}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {podeCancelar && (
            <button
              type="button"
              className="pedido-card__btn-action pedido-card__btn-action--cancel"
              onPointerDown={(e) => {
                e.stopPropagation();
                dispararRipple(e);
              }}
              onClick={() => setCancelModalPedido(p)}
            >
              <span className="pedido-card__btn-text">Cancelar Pedido</span>
            </button>
          )}
          <button
            type="button"
            className="pedido-card__btn-action"
            onPointerDown={(e) => {
              e.stopPropagation();
              dispararRipple(e);
            }}
            onClick={() => setDetalhesModalPedido(p)}
          >
            <span className="pedido-card__btn-text">Ver detalhes</span>
          </button>
        </div>
      </section>
    );
  };

  return (
    <div className="meus-pedidos-container">
      {/* Toast flutuante de feedback */}
      <AnimatePresence>
        {toastFeedback && (
          <motion.div
            className={`sge-toast meus-pedidos__toast ${toastFeedback.tipo === 'erro' ? 'sge-toast--erro' : toastFeedback.tipo === 'aviso' ? 'sge-toast--aviso' : 'sge-toast--sucesso'}`}
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
          >
            <div className="meus-pedidos__toast-icon">
              {toastFeedback.tipo === 'erro' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              ) : toastFeedback.tipo === 'aviso' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div className="meus-pedidos__toast-content">
              <span className="meus-pedidos__toast-title">{toastFeedback.titulo}</span>
              <span className="meus-pedidos__toast-desc">{toastFeedback.detalhe}</span>
              {toastFeedback.acao && (
                <button
                  type="button"
                  className="meus-pedidos__toast-btn"
                  onClick={() => {
                    setToastFeedback(null);
                    toastFeedback.acao.onClick();
                  }}
                >
                  {toastFeedback.acao.label}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="meus-pedidos__action-arrow">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="button"
              className="meus-pedidos__toast-close"
              onClick={() => setToastFeedback(null)}
              aria-label="Fechar notificação"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== SELETOR DESKTOP (FORA DO CARD) ===== */}
      {pedidosAtivos.length > 1 && (
        <div className="hero-tracker__desktop-selector" role="tablist" aria-label="Seletor de pedidos ativos">
          <span className="hero-tracker__selector-label">Pedidos em andamento:</span>
          <div className="hero-tracker__selector-chips">
            {pedidosAtivos.map((p, idx) => {
              const isSel = idx === currentIndex;
              const normSt = normalizarStatus(p.status);
              const rotuloCurto = normSt === 'pronto' ? 'Pronto' : normSt === 'em-separacao' ? 'Separação' : 'Solicitado';
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={isSel}
                  className={`hero-chip-btn ${isSel ? 'hero-chip-btn--active' : ''}`}
                  onClick={() => {
                    setActivePedidoId(p.id);
                    setCurrentIndex(idx);
                  }}
                >
                  <span className="hero-chip-btn__id">#{p.id}</span>
                  <span className="hero-chip-btn__status">{rotuloCurto}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== CARROSSEL INFINITO DE PEDIDOS EM ANDAMENTO ===== */}
      {pedidosAtivos.length === 1 && (
        <div className="hero-tracker-carousel-wrapper hero-tracker-carousel-wrapper--single">
          {renderHeroCard(pedidosAtivos[0], `single-${pedidosAtivos[0].id}`, true)}
        </div>
      )}

      {pedidosAtivos.length > 1 && (
        <div
          ref={carouselContainerRef}
          className="hero-tracker-carousel-wrapper"
          aria-roledescription="carousel"
          aria-label="Carrossel infinito de pedidos em andamento"
        >
          <div
            className="hero-tracker-carousel-track"
            style={{
              transform: `translate3d(${currentOffset}px, 0, 0)`,
              transition: transitionStyle,
              gap: `${gap}px`
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {isDesktop ? (
              <div
                className="hero-tracker-slot hero-tracker-slot--active"
                style={{ width: '100%', opacity: 1, transform: 'scale(1)' }}
              >
                {renderHeroCard(pedidosAtivos[currentIndex] || pedidosAtivos[0], `desktop-${pedidosAtivos[currentIndex]?.id}`, true)}
              </div>
            ) : (
              <>
                {/* Slot 0: Pedido Anterior (Peek à esquerda, com foco gradual) */}
                {(() => {
                  const prevIdx = (currentIndex - 1 + pedidosAtivos.length) % pedidosAtivos.length;
                  const prevP = pedidosAtivos[prevIdx];
                  return (
                    <div
                      className="hero-tracker-slot hero-tracker-slot--peek hero-tracker-slot--prev"
                      style={{
                        width: `${cardWidth}px`,
                        opacity: slot0Opacity,
                        transform: `scale(${slot0Scale})`,
                        transition: isAnimating ? slotTransitionStyle : 'none'
                      }}
                      onClick={() => !isHorizontalDragRef.current && navegarPara('prev')}
                      role="button"
                      tabIndex={-1}
                      aria-label={`Ver pedido anterior #${prevP.id}`}
                    >
                      {renderHeroCard(prevP, `prev-${prevP.id}`, false)}
                    </div>
                  );
                })()}

                {/* Slot 1: Pedido Atual (Centro Ativo, com foco gradual) */}
                {(() => {
                  const currP = pedidosAtivos[currentIndex] || pedidosAtivos[0];
                  return (
                    <div
                      className="hero-tracker-slot hero-tracker-slot--active"
                      style={{
                        width: `${cardWidth}px`,
                        opacity: slot1Opacity,
                        transform: `scale(${slot1Scale})`,
                        transition: isAnimating ? slotTransitionStyle : 'none'
                      }}
                    >
                      {renderHeroCard(currP, `curr-${currP.id}`, true)}
                    </div>
                  );
                })()}

                {/* Slot 2: Próximo Pedido (Peek à direita, com foco gradual) */}
                {(() => {
                  const nextIdx = (currentIndex + 1) % pedidosAtivos.length;
                  const nextP = pedidosAtivos[nextIdx];
                  return (
                    <div
                      className="hero-tracker-slot hero-tracker-slot--peek hero-tracker-slot--next"
                      style={{
                        width: `${cardWidth}px`,
                        opacity: slot2Opacity,
                        transform: `scale(${slot2Scale})`,
                        transition: isAnimating ? slotTransitionStyle : 'none'
                      }}
                      onClick={() => !isHorizontalDragRef.current && navegarPara('next')}
                      role="button"
                      tabIndex={-1}
                      aria-label={`Ver próximo pedido #${nextP.id}`}
                    >
                      {renderHeroCard(nextP, `next-${nextP.id}`, false)}
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* Indicadores de Paginação (Dots) no celular */}
          <div className="hero-tracker__carousel-dots" role="tablist" aria-label="Navegação dos pedidos em andamento">
            {pedidosAtivos.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={idx === currentIndex}
                aria-label={`Ir para pedido #${p.id}`}
                className={`hero-tracker-dot ${idx === currentIndex ? 'hero-tracker-dot--active' : ''}`}
                onClick={() => {
                  if (idx === currentIndex) return;
                  if (idx === (currentIndex + 1) % pedidosAtivos.length) {
                    navegarPara('next');
                  } else if (idx === (currentIndex - 1 + pedidosAtivos.length) % pedidosAtivos.length) {
                    navegarPara('prev');
                  } else {
                    setCurrentIndex(idx);
                    setActivePedidoId(p.id);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Container invisível de medição para calcular as alturas máximas com 100% de precisão */}
      {pedidosAtivos.length > 1 && (
        <div
          className="hero-tracker-measure-container"
          style={{ width: `${cardWidth}px` }}
          aria-hidden="true"
        >
          {pedidosAtivos.map(p => {
            const statusNorm = normalizarStatus(p.status);
            const etapaAtual = obterEtapaStatus(p.status);
            const itens = getItensPedido(p);
            const isUrgente = (p.prioridade || '').toLowerCase() === 'urgente' || !!p.urgente;

            return (
              <div key={`probe-${p.id}`} className="pedido-hero-tracker" style={{ width: `${cardWidth}px` }}>
                <div
                  className="hero-tracker__top"
                  ref={(el) => registrarTopProbe(p.id, el)}
                >
                  <div className="hero-tracker__header">
                    <div className="hero-tracker__title-group">
                      {isUrgente && (
                        <div className="hero-tracker__badges">
                          <StatusBadge status="urgente" />
                        </div>
                      )}
                      <h2 className="hero-tracker__order-id">
                        Pedido #{p.id}
                      </h2>
                    </div>
                  </div>

                  <div className="hero-tracker__summary">
                    <p className="hero-tracker__summary-preview">
                      {itens.map(it => `${it.quantidade}x ${it.materialNome}`).join(', ')}
                    </p>
                  </div>
                </div>

                <div
                  className={`hero-status-banner hero-status-banner--${statusNorm}`}
                  ref={(el) => registrarBannerProbe(p.id, el)}
                >
                  <div className="hero-status-tracker-lines">
                    <div className={`hero-status-tracker-line ${etapaAtual >= 1 ? 'hero-status-tracker-line--active' : ''}`} />
                    <div className={`hero-status-tracker-line ${etapaAtual >= 2 ? 'hero-status-tracker-line--active' : ''}`} />
                    <div className={`hero-status-tracker-line ${etapaAtual >= 3 ? 'hero-status-tracker-line--active' : ''}`} />
                  </div>

                  <div className="hero-status-banner__top">
                    <span className="hero-status-banner__badge-title">
                      {statusNorm === 'aguardando-separacao' && 'Aguardando Atendimento'}
                      {statusNorm === 'em-separacao' && 'Em Separação no Estoque'}
                      {statusNorm === 'pronto' && 'Pronto para Retirada'}
                      {statusNorm === 'parcialmente-disponivel' && 'Disponível Parcialmente'}
                    </span>
                  </div>
                  <p className="hero-status-banner__desc">
                    {statusNorm === 'aguardando-separacao' && (
                      'Sua solicitação está registrada na fila de atendimento do almoxarifado aguardando liberação.'
                    )}
                    {statusNorm === 'em-separacao' && (
                      'O almoxarife já está conferindo os itens e separando os materiais nas prateleiras.'
                    )}
                    {statusNorm === 'pronto' && (
                      <>
                        Todos os itens foram separados e estão disponíveis no balcão do <strong>Almoxarifado Central (Prédio A)</strong>. Apresente o número <strong>#{p.id}</strong> para retirar.
                      </>
                    )}
                    {statusNorm === 'parcialmente-disponivel' && (
                      <>
                        Parte dos materiais solicitados já está separada no balcão do <strong>Almoxarifado Central (Prédio A)</strong>. Apresente o número <strong>#{p.id}</strong> para conferência.
                      </>
                    )}
                  </p>
                  {p.mensagemAlmoxarife && (
                    <div className="hero-status-banner__msg">
                      <span className="hero-status-banner__msg-label">Orientações do Almoxarife:</span>
                      <p className="hero-status-banner__msg-text">"{p.mensagemAlmoxarife}"</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State Global (quando não há nenhum pedido ativo nem histórico) */}
      {pedidos.length === 0 && (
        <div className="sge-empty-state pedidos-empty-state">
          <div className="sge-empty-state__icon-wrap empty-state-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h3 className="sge-empty-state__title empty-state-title">Nenhum pedido registrado</h3>
          <p className="sge-empty-state__desc empty-state-desc">
            Você ainda não realizou solicitações de material. Navegue pelo catálogo do almoxarifado para solicitar os itens necessários para o seu setor.
          </p>
          {onNavigateToEstoque && (
            <button
              type="button"
              className="sge-empty-state__btn btn-ir-estoque"
              onClick={onNavigateToEstoque}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              Consultar Catálogo e Fazer Pedido
            </button>
          )}
        </div>
      )}

      {/* ===== SEÇÃO INFERIOR PERMANENTE DE HISTÓRICO ===== */}
      {pedidosHistorico.length > 0 && (
        <section className="meus-pedidos__historico-section">
          {/* Toolbar de Busca e Ordenação no Histórico */}
          <div className="meus-pedidos__toolbar">
            <div className="meus-pedidos__search-wrap">
              <svg className="meus-pedidos__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="meus-pedidos__search-input"
                placeholder="Buscar por número do pedido ou material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="meus-pedidos__clear-btn"
                  onClick={() => setSearchTerm('')}
                  aria-label="Limpar busca"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Lista de Grupos Separados por Data */}
          {pedidosHistoricoFiltrados.length === 0 ? (
            <div className="historico-empty-search">
              <p>Nenhum pedido histórico encontrado com o termo "{searchTerm}".</p>
            </div>
          ) : (
            <div className="historico-grupos-container">
              {historicoAgrupado.map((grupo) => (
                <div key={grupo.chave} className="historico-date-group">
                  <div className="historico-date-header">
                    <h3 className="historico-date-header__title">{grupo.label}</h3>
                  </div>

                  <div className="historico-cards-grid">
                    {grupo.pedidos.map((pedido) => {
                      const statusNorm = normalizarStatus(pedido.status);
                      const itens = getItensPedido(pedido);
                      const isUrgente = (pedido.prioridade || '').toLowerCase() === 'urgente' || !!pedido.urgente;
                      const isDestacado = pedido.id === pedidoDestaqueId;

                      return (
                        <div
                          key={pedido.id}
                          id={`pedido-${pedido.id}`}
                          className={`pedido-card pedido-card--historico ${isDestacado ? 'pedido-card--destacado' : ''} ${statusNorm === 'cancelado' ? 'pedido-card--cancelado' : ''} ${statusNorm === 'estoque-insuficiente' ? 'pedido-card--insuficiente' : ''}`}
                          onPointerDown={(e) => dispararRipple(e)}
                          onClick={() => setDetalhesModalPedido(pedido)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setDetalhesModalPedido(pedido);
                            }
                          }}
                          aria-label={`Ver detalhes do pedido #${pedido.id}`}
                        >
                          <div className="pedido-card__header">
                            <div className="pedido-card__status-wrap">
                              {renderStatusHistorico(statusNorm)}
                              {isUrgente && <span className="pedido-tag-urgente">Urgente</span>}
                            </div>
                            <span className="pedido-card__meta-id">#{pedido.id}</span>
                          </div>

                          <div className="pedido-card__summary">
                            <p className="pedido-card__summary-preview">
                              {itens.map(it => `${it.quantidade}x ${it.materialNome}`).join(', ')}
                            </p>
                          </div>

                          <div className="pedido-card__footer" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="pedido-card__btn-action"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                dispararRipple(e);
                              }}
                              onClick={() => setDetalhesModalPedido(pedido)}
                            >
                              <span className="pedido-card__btn-text">Ver detalhes</span>
                            </button>
                            <button
                              type="button"
                              className="pedido-card__btn-action"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                dispararRipple(e);
                              }}
                              onClick={() => setReorderModalPedido(pedido)}
                            >
                              <span className="pedido-card__btn-text">Pedir novamente</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Modal / Dialog de Confirmação de Cancelamento */}
      <BottomSheetModal
        isOpen={!!cancelModalPedido}
        onClose={() => setCancelModalPedido(null)}
        className="cancel-order-modal"
        title={cancelModalPedido ? `Cancelar Pedido #${cancelModalPedido.id}?` : ''}
        subtitle="Confirmação de Cancelamento"
        variant="dialog"
        maxWidth="440px"
        footer={
          <div className="cancel-modal-actions" style={{ display: 'flex', width: '100%', gap: '10px' }}>
            <motion.button
              type="button"
              className="btn-cancel-modal-voltar"
              onClick={() => setCancelModalPedido(null)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              Manter Pedido
            </motion.button>
            <motion.button
              type="button"
              className="btn-cancel-modal-confirmar"
              disabled={cancelandoPedido}
              onClick={handleConfirmCancel}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {cancelandoPedido ? 'Cancelando...' : 'Sim, Cancelar'}
            </motion.button>
          </div>
        }
      >
        <div className="cancel-modal-body">
          <p className="cancel-modal-desc">
            Esta solicitação será removida da fila de atendimento do almoxarifado. Esta ação não poderá ser desfeita.
          </p>
          {cancelModalPedido && (
            <div className="cancel-modal-pedido-info">
              <span className="cancel-modal-meta">
                Pedido <strong>#{cancelModalPedido.id}</strong>
                <span className="pedido-card__meta-sep" aria-hidden="true" />
                {getItensPedido(cancelModalPedido).length} {getItensPedido(cancelModalPedido).length === 1 ? 'material' : 'materiais'}
              </span>
            </div>
          )}
        </div>
      </BottomSheetModal>

      {/* Modal / Dialog de Confirmação de Repetir Pedido */}
      <BottomSheetModal
        isOpen={!!reorderModalPedido}
        onClose={() => setReorderModalPedido(null)}
        className="reorder-order-modal"
        title={reorderModalPedido ? `Repetir Pedido #${reorderModalPedido.id}?` : ''}
        subtitle="Nova Solicitação Idêntica"
        variant="dialog"
        maxWidth="460px"
        footer={
          <div className="reorder-modal-actions" style={{ display: 'flex', width: '100%', gap: '10px' }}>
            <motion.button
              type="button"
              className="btn-reorder-modal-voltar"
              onClick={() => setReorderModalPedido(null)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              Cancelar
            </motion.button>
            <motion.button
              type="button"
              className="btn-reorder-modal-confirmar"
              disabled={reordenandoPedido}
              onClick={handleConfirmarPedirNovamente}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {reordenandoPedido ? 'Enviando...' : 'Confirmar e Enviar'}
            </motion.button>
          </div>
        }
      >
        <div className="reorder-modal-body">
          <p className="reorder-modal-desc">
            Uma nova solicitação com os mesmos materiais e quantidades será enviada diretamente para a fila de atendimento do almoxarifado.
          </p>
          {reorderModalPedido && (
            <div className="reorder-modal-itens-resumo">
              <span className="reorder-modal-itens-title">Itens que serão solicitados:</span>
              <ul className="reorder-modal-itens-list">
                {getItensPedido(reorderModalPedido).map((item, idx) => (
                  <li key={`reorder-item-${idx}`} className="reorder-modal-item">
                    <span>{item.materialNome}</span>
                    <strong>{item.quantidade} {item.unidade || 'UN'}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </BottomSheetModal>

      {/* Modal / Bottom Sheet de Detalhes Completos do Pedido */}
      <BottomSheetModal
        isOpen={Boolean(detalhesModalPedido)}
        onClose={() => setDetalhesModalPedido(null)}
        title={detalhesModalPedido ? `Detalhes do Pedido #${detalhesModalPedido.id}` : ''}
        subtitle={detalhesModalPedido ? `Registrado em ${detalhesModalPedido.data || 'Hoje'}` : ''}
        badge={
          detalhesModalPedido ? (
            renderStatusHistorico(normalizarStatus(detalhesModalPedido.status))
          ) : null
        }
        maxWidth="540px"
        footer={
          detalhesModalPedido ? (
            <div className="detalhes-modal-footer">
              <button
                type="button"
                className="sge-modal-btn sge-modal-btn--cancel"
                onClick={() => setDetalhesModalPedido(null)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="sge-modal-btn sge-modal-btn--primary"
                onClick={() => {
                  const p = detalhesModalPedido;
                  setDetalhesModalPedido(null);
                  setReorderModalPedido(p);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                Pedir Novamente
              </button>
            </div>
          ) : null
        }
      >
        {detalhesModalPedido && (
          <div className="pedido-detalhes-body">
            {normalizarStatus(detalhesModalPedido.status) === 'estoque-insuficiente' && (
              <div className="pedido-detalhes-alerta alerta--insuficiente">
                <strong>Estoque Insuficiente:</strong> {detalhesModalPedido.observacaoAlmoxarife || 'Os itens solicitados encontravam-se temporariamente sem saldo no estoque.'}
              </div>
            )}
            {detalhesModalPedido.motivoCancelamento && (
              <div className="pedido-detalhes-alerta alerta--cancelado">
                <strong>Motivo do Cancelamento:</strong> {detalhesModalPedido.motivoCancelamento}
              </div>
            )}
            {detalhesModalPedido.mensagemAlmoxarife && (
              <div className="pedido-detalhes-alerta alerta--mensagem">
                <strong>Orientações do Almoxarifado:</strong> "{detalhesModalPedido.mensagemAlmoxarife}"
              </div>
            )}

            <div className="pedido-detalhes-secao">
              <h4 className="pedido-detalhes-secao-title">Materiais Solicitados</h4>
              <div className="pedido-detalhes-itens-list">
                {getItensPedido(detalhesModalPedido).map((item, idx) => {
                  const hasParcial = item.quantidadeAtendida !== undefined && item.quantidadeAtendida !== null;
                  return (
                    <div key={`modal-item-${idx}`} className="detalhes-item-row">
                      <div className="detalhes-item-info">
                        <span className="detalhes-item-nome">{item.materialNome}</span>
                        {hasParcial && (
                          <span className="detalhes-item-atendido">
                            Entregue: {item.quantidadeAtendida} de {item.quantidade} {item.unidade}
                          </span>
                        )}
                      </div>
                      <span className="detalhes-item-qtd">
                        {item.quantidade} {item.unidade || 'UN'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {detalhesModalPedido.justificativa && (
              <div className="pedido-detalhes-secao">
                <h4 className="pedido-detalhes-secao-title">Finalidade / Justificativa</h4>
                <p className="pedido-detalhes-justificativa-text">{detalhesModalPedido.justificativa}</p>
              </div>
            )}

            <div className="pedido-detalhes-meta-footer">
              <span>Registrado em: <strong>{detalhesModalPedido.data || 'Hoje'}</strong></span>
              {detalhesModalPedido.dataEntrega && (
                <span>Atendido/Entregue em: <strong>{detalhesModalPedido.dataEntrega}</strong></span>
              )}
            </div>
          </div>
        )}
      </BottomSheetModal>
    </div>
  );
};

export default MeusPedidos;
