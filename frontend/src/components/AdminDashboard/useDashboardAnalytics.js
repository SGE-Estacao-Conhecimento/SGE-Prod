import { useState, useEffect, useCallback, useRef } from 'react';
import { obterAnalytics } from '../../services/dashboard/dashboardService';

const JANELAS_VALIDAS = [7, 15, 30, 60];

export function useDashboardAnalytics(janelaInicial = 30) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [janelaDias, setJanelaDiasState] = useState(() =>
    JANELAS_VALIDAS.includes(Number(janelaInicial)) ? Number(janelaInicial) : 30
  );
  const [retryCountdown, setRetryCountdown] = useState(0);

  const abortControllerRef = useRef(null);
  const retryCountdownRef = useRef(retryCountdown);

  useEffect(() => {
    retryCountdownRef.current = retryCountdown;
  }, [retryCountdown]);

  const setJanelaDias = useCallback((dias) => {
    const num = Number(dias);
    if (JANELAS_VALIDAS.includes(num)) {
      setLoading(true);
      setJanelaDiasState(num);
    }
  }, []);

  const processarErro = useCallback((err) => {
    if (err?.status === 429) {
      const retryAfter = Number(err?.details?.retryAfter ?? err?.retryAfter ?? 20) || 20;
      setRetryCountdown(retryAfter);
      setError('Aguarde antes de solicitar nova atualização forçada.');
    } else {
      setError(err?.message || 'Erro ao carregar dados analíticos do dashboard.');
    }
  }, []);

  // Carga reativa disparada pela mudança da janelaDias
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let cancelado = false;

    obterAnalytics(janelaDias, false, controller.signal)
      .then((resultado) => {
        if (cancelado || controller.signal.aborted) return;
        setData(resultado);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelado || controller.signal.aborted) return;
        processarErro(err);
        setLoading(false);
      });

    return () => {
      cancelado = true;
      controller.abort();
    };
  }, [janelaDias, processarErro]);

  // Contagem regressiva do rate limit (429)
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [retryCountdown]);

  const recarregar = useCallback(
    async (forcar = false) => {
      if (forcar && retryCountdownRef.current > 0) {
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const resultado = await obterAnalytics(janelaDias, forcar, controller.signal);
        if (controller.signal.aborted) return;
        setData(resultado);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        processarErro(err);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [janelaDias, processarErro]
  );

  return {
    data,
    loading,
    error,
    janelaDias,
    setJanelaDias,
    retryCountdown,
    recarregar
  };
}

export default useDashboardAnalytics;
