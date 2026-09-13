import { useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

// 30 minutos de inactividad máxima en milisegundos
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
export const ACTIVITY_STORAGE_KEY = 'sena_last_activity';

export function useInactivityTimeout() {
  const { isAuthenticated, sessionExpiredReason, logout, clearSessionExpiredReason } = useAuthStore();
  const lastThrottleRef = useRef<number>(Date.now());

  // Función para registrar actividad del usuario de forma amortiguada (throttle 2s)
  const recordActivity = useCallback(() => {
    if (!useAuthStore.getState().isAuthenticated) return;
    const now = Date.now();
    if (now - lastThrottleRef.current > 2000) {
      lastThrottleRef.current = now;
      try {
        localStorage.setItem(ACTIVITY_STORAGE_KEY, now.toString());
      } catch (e) {
        // Ignorar posibles errores en private browsing
      }
    }
  }, []);

  // Función para verificar si ya pasaron los 30 minutos
  const checkInactivity = useCallback((): boolean => {
    if (!useAuthStore.getState().isAuthenticated) return false;

    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    const lastActivity = raw ? parseInt(raw, 10) : Date.now();
    const elapsed = Date.now() - lastActivity;

    if (elapsed >= INACTIVITY_TIMEOUT_MS) {
      // Sesión expirada por inactividad o suspensión prolongada
      logout('INACTIVITY');
      return true;
    }
    return false;
  }, [logout]);

  // Manejador del botón en el modal para ir a login
  const handleAcknowledgeExpiry = useCallback(() => {
    clearSessionExpiredReason();
  }, [clearSessionExpiredReason]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // 1. Verificación inmediata e incondicional al montar
    const isExpired = checkInactivity();
    if (isExpired) {
      return;
    }

    // Asegurar que exista una marca inicial si no existía
    if (!localStorage.getItem(ACTIVITY_STORAGE_KEY)) {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, Date.now().toString());
    }

    // Escuchar eventos de interacción del usuario
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleUserInteraction = () => {
      recordActivity();
    };

    events.forEach((evt) => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    // Intervalo regular de verificación (cada 5 segundos)
    const intervalId = setInterval(() => {
      checkInactivity();
    }, 5000);

    // Eventos clave para cuando el equipo se suspende o reanuda o cambia de pestaña
    const handleVisibilityOrFocus = () => {
      const expired = checkInactivity();
      if (!expired) {
        recordActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [isAuthenticated, recordActivity, checkInactivity]);

  return {
    isSessionExpired: Boolean(sessionExpiredReason),
    sessionExpiredReason,
    handleAcknowledgeExpiry,
  };
}
