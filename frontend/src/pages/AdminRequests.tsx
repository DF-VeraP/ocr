import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { RegistrationRequest, User } from '../types';
import { Check, X, Users, UserCheck, Shield, AlertCircle, Loader2 } from 'lucide-react';

export const AdminRequests: React.FC = () => {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'solicitudes' | 'usuarios'>('solicitudes');
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [reqRes, usrRes] = await Promise.all([
        api.get('/admin/requests/pending'),
        api.get('/admin/users'),
      ]);
      setRequests(reqRes.data.requests || []);
      setUsers(usrRes.data.users || []);
    } catch (err: any) {
      console.error('Error cargando datos de admin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAccept = async (requestId: string, email: string) => {
    setActionLoadingId(requestId);
    setBannerMessage(null);
    try {
      const res = await api.post(`/admin/requests/${requestId}/accept`);
      setBannerMessage(res.data.mensaje || `Solicitud de ${email} aceptada con éxito.`);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al aceptar la solicitud');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (requestId: string, email: string) => {
    if (!confirm(`¿Está seguro de rechazar la solicitud de ${email}? No se emitirá ningún correo.`)) return;

    setActionLoadingId(requestId);
    setBannerMessage(null);
    try {
      const res = await api.post(`/admin/requests/${requestId}/reject`);
      setBannerMessage(res.data.mensaje || `Solicitud de ${email} rechazada.`);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al rechazar la solicitud');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleUser = async (userId: string) => {
    try {
      const res = await api.patch(`/admin/users/${userId}/toggle-status`);
      setBannerMessage(res.data.mensaje);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al modificar estado del usuario');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-sena-500" />
            <span>Panel de Administración</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestión de solicitudes de acceso, contraseñas temporales y usuarios del sistema
          </p>
        </div>

        {/* Pestañas */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('solicitudes')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'solicitudes'
                ? 'bg-white dark:bg-slate-700 text-sena-600 dark:text-sena-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Solicitudes ({requests.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'usuarios'
                ? 'bg-white dark:bg-slate-700 text-sena-600 dark:text-sena-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Usuarios ({users.length})</span>
          </button>
        </div>
      </div>

      {bannerMessage && (
        <div className="mb-6 p-4 rounded-xl bg-sena-50 dark:bg-sena-950/40 border border-sena-200 dark:border-sena-900/60 text-sena-800 dark:text-sena-300 text-xs flex items-center gap-3">
          <Check className="w-4 h-4 text-sena-600 flex-shrink-0" />
          <span>{bannerMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-sena-500 mb-2" />
          <span className="text-xs">Cargando registros...</span>
        </div>
      ) : activeTab === 'solicitudes' ? (
        <div>
          {requests.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs border border-slate-200 dark:border-slate-700">
              No hay solicitudes pendientes de aprobación en este momento.
            </div>
          ) : (
            <>
              {/* Vista TRANSFORMADA para Móviles: Tarjetas táctiles individuales */}
              <div className="block md:hidden space-y-3">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-bold text-slate-900 dark:text-white block truncate">
                          {req.email}
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          {new Date(req.createdAt).toLocaleString('es-CO')}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                        Pendiente
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <button
                        onClick={() => handleAccept(req.id, req.email)}
                        disabled={actionLoadingId === req.id}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                      >
                        {actionLoadingId === req.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Aceptar</span>
                      </button>

                      <button
                        onClick={() => handleReject(req.id, req.email)}
                        disabled={actionLoadingId === req.id}
                        className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-700 dark:text-slate-300 hover:text-red-600 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Rechazar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Vista para Pantallas Medianas y Grandes: Tabla clásica */}
              <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4">Correo Solicitante</th>
                      <th className="px-6 py-4">Fecha de Solicitud</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {requests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">
                          {req.email}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {new Date(req.createdAt).toLocaleString('es-CO')}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-medium">
                            Pendiente
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleAccept(req.id, req.email)}
                              disabled={actionLoadingId === req.id}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                              title="Aceptar solicitud y enviar contraseña temporal por correo"
                            >
                              {actionLoadingId === req.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Aceptar</span>
                            </button>

                            <button
                              onClick={() => handleReject(req.id, req.email)}
                              disabled={actionLoadingId === req.id}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-600 dark:text-slate-300 hover:text-red-600 font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              title="Rechazar solicitud silenciosamente"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Rechazar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          {/* Vista Móvil TRANSFORMADA para Usuarios */}
          <div className="block md:hidden space-y-3">
            {users.map((usr) => (
              <div
                key={usr.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-bold text-slate-900 dark:text-white block truncate">
                      {usr.email}
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Rol: <strong>{usr.role}</strong> • {usr.requiresPasswordChange ? 'Clave pendiente de cambio' : 'Clave activa'}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      usr.isActive
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                    }`}
                  >
                    {usr.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {usr.email !== 'admin@sena.edu.co' && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                    <button
                      onClick={() => handleToggleUser(usr.id)}
                      className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors border ${
                        usr.isActive
                          ? 'border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                          : 'border-emerald-200 dark:border-emerald-900 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                      }`}
                    >
                      {usr.isActive ? 'Desactivar Usuario' : 'Activar Usuario'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Vista Tabla para Desktop */}
          <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4">Correo</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Requiere Cambio Clave</th>
                  <th className="px-6 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {users.map((usr) => (
                  <tr key={usr.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">
                      {usr.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-slate-500">{usr.role}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full font-medium ${
                          usr.isActive
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {usr.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {usr.requiresPasswordChange ? 'Sí (Pendiente)' : 'No'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {usr.email !== 'admin@sena.edu.co' && (
                        <button
                          onClick={() => handleToggleUser(usr.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            usr.isActive
                              ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                              : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                          }`}
                        >
                          {usr.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
