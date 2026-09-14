import React, { useEffect, useState, useRef } from 'react';
import { Loader2, CheckCircle, AlertTriangle, Cpu, Clock, Pause, Play, XCircle } from 'lucide-react';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

interface BatchProgressProps {
  batchId: string;
  onCompleted: (durationSeconds?: number) => void;
  onCancelled?: () => void;
  onError?: (errorMsg: string) => void;
}

export const BatchProgress: React.FC<BatchProgressProps> = ({ batchId, onCompleted, onCancelled, onError }) => {
  const [percentage, setPercentage] = useState<number>(0);
  const [status, setStatus] = useState<string>('PROCESSING');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [processedPages, setProcessedPages] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados de acciones (Pausa, Reanudar, Cancelar)
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [controlError, setControlError] = useState<string | null>(null);

  // Contabilizador de tiempo transcurrido (en segundos)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const timerIntervalRef = useRef<any>(null);

  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  const elapsedSecondsRef = useRef(elapsedSeconds);
  elapsedSecondsRef.current = elapsedSeconds;

  // Formateador de tiempo mm:ss
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Cronómetro activo que se congela cuando el lote está en pausa
  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (status === 'PROCESSING' && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [batchId, status, isPaused]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: any = null;

    const checkStatusNow = async () => {
      try {
        const res = await api.get(`/batches/${batchId}/status`);
        const b = res.data?.batch;
        if (b) {
          setStatus(b.status);
          if (b.isPaused !== undefined) setIsPaused(Boolean(b.isPaused));
          setTotalPages(b.totalPages);
          setProcessedPages(b.processedPages);
          if (b.status === 'COMPLETED') {
            setPercentage(100);
            setIsPaused(false);
            eventSource?.close();
            if (pollInterval) clearInterval(pollInterval);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            onCompletedRef.current(elapsedSecondsRef.current);
          } else if (b.status === 'FAILED') {
            setIsPaused(false);
            const errMsg = b.errorMessage || 'Error en el lote';
            setErrorMessage(errMsg);
            eventSource?.close();
            if (pollInterval) clearInterval(pollInterval);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            onError?.(errMsg);
          } else {
            const estPct = res.data?.percentage !== undefined
              ? res.data.percentage
              : (b.totalPages > 0 ? Math.round((b.processedPages / b.totalPages) * 100) : 0);
            setPercentage((prev) => Math.max(prev, estPct));
          }
        }
      } catch (e) {
        console.error('Error en status check:', e);
      }
    };

    const handleWakeUp = () => {
      if (document.visibilityState === 'visible') {
        checkStatusNow();
      }
    };

    document.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('online', handleWakeUp);

    try {
      // Conectar a Server-Sent Events (SSE) con token para autenticación
      const token = useAuthStore.getState().token;
      const streamUrl = token
        ? `/api/batches/${batchId}/stream?token=${encodeURIComponent(token)}`
        : `/api/batches/${batchId}/stream`;

      eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.percentage !== undefined) {
            setPercentage((prev) => Math.max(prev, data.percentage));
          }
          if (data.status) setStatus(data.status);
          if (data.isPaused !== undefined) setIsPaused(Boolean(data.isPaused));
          if (data.totalPages) setTotalPages(data.totalPages);
          if (data.processedPages !== undefined) setProcessedPages(data.processedPages);

          if (data.status === 'COMPLETED') {
            setPercentage(100);
            setIsPaused(false);
            eventSource?.close();
            if (pollInterval) clearInterval(pollInterval);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            onCompletedRef.current(elapsedSecondsRef.current);
          } else if (data.status === 'FAILED') {
            setIsPaused(false);
            const errMsg = data.error || 'El procesamiento del lote ha fallado';
            setErrorMessage(errMsg);
            eventSource?.close();
            if (pollInterval) clearInterval(pollInterval);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            onError?.(errMsg);
          }
        } catch (err) {
          console.error('Error parseando SSE data:', err);
        }
      };

      eventSource.onerror = () => {
        // Si SSE falla o se interrumpe por suspensión, usar polling como fallback seguro
        eventSource?.close();
        checkStatusNow();
        if (!pollInterval) {
          pollInterval = setInterval(checkStatusNow, 2500);
        }
      };
    } catch (e) {
      console.warn('No se pudo iniciar EventSource:', e);
      checkStatusNow();
      pollInterval = setInterval(checkStatusNow, 2500);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('online', handleWakeUp);
    };
  }, [batchId]);

  // Manejadores de Control
  const handlePause = async () => {
    try {
      setIsActionLoading(true);
      setControlError(null);
      await api.post(`/batches/${batchId}/pause`);
      setIsPaused(true);
    } catch (err: any) {
      setControlError(err.response?.data?.error || 'No se pudo pausar el lote');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setIsActionLoading(true);
      setControlError(null);
      await api.post(`/batches/${batchId}/resume`);
      setIsPaused(false);
    } catch (err: any) {
      setControlError(err.response?.data?.error || 'No se pudo reanudar el lote');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setIsActionLoading(true);
      setControlError(null);
      await api.post(`/batches/${batchId}/cancel`);
      setStatus('FAILED');
      setIsPaused(false);
      setErrorMessage('Procesamiento cancelado por el usuario');
      setShowCancelConfirm(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      onCancelled?.();
    } catch (err: any) {
      setControlError(err.response?.data?.error || 'No se pudo cancelar el lote');
    } finally {
      setIsActionLoading(false);
    }
  };

  const isCancelled = status === 'FAILED' && errorMessage?.includes('cancelado');

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden">
      {/* Modal de confirmación para cancelar procesamiento */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  ¿Deseas cancelar el procesamiento?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  El análisis OCR de las cédulas y el cruce con el archivo Excel se detendrán por completo. Podrás iniciar una nueva carga en cualquier momento.
                </p>
              </div>
            </div>

            {controlError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-400">
                {controlError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCancelConfirm(false);
                  setControlError(null);
                }}
                disabled={isActionLoading}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Continuar Procesando
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={isActionLoading}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg shadow-red-600/25 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isActionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Cancelando...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Sí, Cancelar Procesamiento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabecera de estado y botones de control */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        <div className="flex items-start sm:items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${
            status === 'COMPLETED'
              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              : isCancelled
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-500'
              : status === 'FAILED'
              ? 'bg-red-100 dark:bg-red-950/60 text-red-500'
              : isPaused
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
              : 'bg-sena-100 dark:bg-sena-950/60 text-sena-600'
          }`}>
            {status === 'COMPLETED' ? (
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            ) : isCancelled ? (
              <XCircle className="w-6 h-6 text-slate-500" />
            ) : status === 'FAILED' ? (
              <AlertTriangle className="w-6 h-6 text-red-500" />
            ) : isPaused ? (
              <Pause className="w-6 h-6 text-amber-500" />
            ) : (
              <Cpu className="w-6 h-6 animate-pulse text-sena-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {status === 'COMPLETED'
                  ? '¡Procesamiento Completado!'
                  : isCancelled
                  ? 'Procesamiento Cancelado'
                  : status === 'FAILED'
                  ? 'Procesamiento Fallido'
                  : isPaused
                  ? 'Procesamiento en Pausa'
                  : 'Analizando y Validando Documentos...'}
              </h3>
              {isPaused && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  En Pausa
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {status === 'COMPLETED'
                ? 'Todos los documentos fueron procesados, clasificados y cruzados contra el Excel.'
                : isCancelled
                ? 'El procesamiento de este lote fue detenido por el usuario.'
                : status === 'FAILED'
                ? errorMessage
                : isPaused
                ? 'El escaneo está en pausa. Puedes pulsar "Reanudar" para seguir procesando o "Cancelar" para detenerlo.'
                : processedPages === 0
                ? `Iniciando análisis del PDF (${totalPages > 0 ? `${totalPages} páginas detectadas` : 'analizando PDF'})...`
                : `Procesando OCR, códigos de barras y validando (${processedPages} de ${totalPages || '?'} páginas • ${percentage}%)...`}
            </p>
          </div>
        </div>

        {/* Acciones y métricas */}
        <div className="flex items-center gap-3 self-end lg:self-center flex-wrap">
          {/* Botones de Control: Pausar, Reanudar, Cancelar */}
          {status === 'PROCESSING' && (
            <div className="flex items-center gap-2">
              {isPaused ? (
                <button
                  type="button"
                  onClick={handleResume}
                  disabled={isActionLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/25 transition-all disabled:opacity-50"
                  title="Reanudar el procesamiento"
                >
                  {isActionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  <span>Reanudar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  disabled={isActionLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/25 transition-all disabled:opacity-50"
                  title="Pausar temporalmente el procesamiento"
                >
                  {isActionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Pause className="w-4 h-4 fill-current" />
                  )}
                  <span>Pausar</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                disabled={isActionLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 text-xs font-bold transition-all disabled:opacity-50"
                title="Cancelar todo el procesamiento"
              >
                <XCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Cancelar</span>
              </button>
            </div>
          )}

          {/* Contabilizador de tiempo transcurrido */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/80 border border-slate-200/80 dark:border-slate-600 shadow-inner">
            <Clock className={`w-4 h-4 text-sena-600 dark:text-sena-400 ${status === 'PROCESSING' && !isPaused ? 'animate-spin' : ''}`} />
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                {status === 'COMPLETED' ? 'Tiempo total' : isPaused ? 'Tiempo (Pausado)' : 'Tiempo de carga'}
              </span>
              <span className="text-sm font-extrabold font-mono text-slate-800 dark:text-slate-100">
                {formatTime(elapsedSeconds)}
              </span>
            </div>
          </div>

          <span className={`text-2xl font-extrabold font-mono ${
            isPaused ? 'text-amber-500' : 'text-sena-600 dark:text-sena-400'
          }`}>
            {percentage}%
          </span>
        </div>
      </div>

      {/* Notificación de error en caso de fallo en comandos de control */}
      {controlError && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-400 flex items-center justify-between">
          <span>{controlError}</span>
          <button onClick={() => setControlError(null)} className="underline ml-2">Cerrar</button>
        </div>
      )}

      {/* Barra de progreso interactiva */}
      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3.5 overflow-hidden p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isCancelled
              ? 'bg-slate-400'
              : status === 'FAILED'
              ? 'bg-red-500'
              : status === 'COMPLETED'
              ? 'bg-emerald-500'
              : isPaused
              ? 'bg-amber-500'
              : 'bg-gradient-to-r from-sena-500 to-sena-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {status === 'PROCESSING' && (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
          {isPaused ? (
            <span className="font-medium text-amber-600 dark:text-amber-400">
              ⏸️ Procesamiento en pausa. No se están consumiendo recursos.
            </span>
          ) : (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-sena-500" />
              <span>La interfaz se mantiene interactiva y no se bloqueará durante el procesamiento.</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
