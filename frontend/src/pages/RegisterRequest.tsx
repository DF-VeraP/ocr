import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { UserPlus, Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Info } from 'lucide-react';

export const RegisterRequest: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMessage('Por favor ingresa tu correo institucional');
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.post('/auth/register', { email: trimmedEmail });
      setSuccessMessage(res.data.mensaje || 'Solicitud registrada con éxito. Una vez aprobada por el administrador, recibirás una contraseña temporal en tu correo.');
      setEmail('');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Error al enviar la solicitud');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-200 dark:border-slate-700">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Inicio de Sesión</span>
        </Link>

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sena-500 to-sena-700 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-sena-500/25">
            <UserPlus className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Solicitud de Acceso</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Ingresa tu correo institucional para solicitar acceso al sistema OCR
          </p>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3 text-emerald-700 dark:text-emerald-400 text-xs">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3 text-red-700 dark:text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sena-500/50"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <Info className="w-4 h-4 text-sena-600 dark:text-sena-400 flex-shrink-0 mt-0.5" />
            <span>
              Una vez enviada la solicitud, el administrador la revisará. Al ser aprobada, recibirás una <strong>contraseña temporal</strong> en tu correo con la cual podrás iniciar sesión por primera vez y configurar tu clave definitiva.
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-sena-500 to-sena-600 hover:from-sena-600 hover:to-sena-700 text-white font-semibold text-sm shadow-lg shadow-sena-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enviando Solicitud...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Enviar Solicitud de Acceso</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
