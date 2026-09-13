import React from 'react';
import { Clock, ShieldAlert, ArrowRight, ServerCrash, WifiOff } from 'lucide-react';
import { SessionExpiredReason } from '../../stores/authStore';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  reason?: SessionExpiredReason;
  onLoginAgain: () => void;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  isOpen,
  reason = 'INACTIVITY',
  onLoginAgain,
}) => {
  if (!isOpen) return null;

  const isRestart = reason === 'SERVER_RESTARTED';
  const isDown = reason === 'SERVER_DOWN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 text-center space-y-6">
        <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center shadow-inner ${
          isDown
            ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
            : isRestart
            ? 'bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400'
            : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
        }`}>
          {isDown ? (
            <WifiOff className="w-8 h-8 animate-pulse" />
          ) : isRestart ? (
            <ServerCrash className="w-8 h-8 animate-pulse" />
          ) : (
            <Clock className="w-8 h-8 animate-pulse" />
          )}
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
            <ShieldAlert className="w-3.5 h-3.5 text-sena-500" />
            <span>Control de Seguridad SENA</span>
          </div>

          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            {isDown
              ? 'Servidor Desconectado'
              : isRestart
              ? 'Servidor Reiniciado'
              : 'Sesión Expirada por Inactividad'}
          </h3>

          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {isDown ? (
              <>
                Se interrumpió la conexión con el servidor backend o se encuentra fuera de servicio.
                Por seguridad, tu sesión local ha sido cerrada automáticamente.
              </>
            ) : isRestart ? (
              <>
                El servidor del sistema fue reiniciado. Por política de seguridad,
                todas las sesiones previas han sido invalidadas de forma automática.
              </>
            ) : (
              <>
                Tu sesión ha finalizado automáticamente tras superar el límite de{' '}
                <strong className="text-slate-700 dark:text-slate-200">30 minutos de inactividad</strong>{' '}
                o tras encender/reanudar el equipo.
              </>
            )}
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onLoginAgain}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sena-500 to-sena-600 hover:from-sena-600 hover:to-sena-700 text-white text-sm font-semibold shadow-lg shadow-sena-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-98"
          >
            <span>Iniciar Sesión Nuevamente</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
