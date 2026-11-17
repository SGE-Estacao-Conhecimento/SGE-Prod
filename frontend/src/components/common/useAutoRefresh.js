import { useEffect, useRef } from 'react';

/**
 * useAutoRefresh
 * Executa revalidacao silenciosa de dados:
 * 1. Ao focar a janela ou quando a aba se torna visivel (visibilitychange e window focus).
 * 2. Em intervalos periodicos controlados, apenas enquanto a aba estiver ativa.
 */
const useAutoRefresh = (callback, { intervalMs = 20000, enabled = true } = {}) => {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const executarRevalidacao = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (typeof savedCallback.current === 'function') {
        savedCallback.current();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        executarRevalidacao();
      }
    };

    const handleWindowFocus = () => {
      executarRevalidacao();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    let intervalId = null;
    if (intervalMs && intervalMs > 0) {
      intervalId = window.setInterval(executarRevalidacao, intervalMs);
    }

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs]);
};

export default useAutoRefresh;
