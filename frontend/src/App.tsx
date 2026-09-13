import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';
import { SessionTimeoutModal } from './components/auth/SessionTimeoutModal';
import { Navbar } from './components/layout/Navbar';
import { Login } from './pages/Login';
import { RegisterRequest } from './pages/RegisterRequest';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { FichasHistory } from './pages/FichasHistory';
import { AdminRequests } from './pages/AdminRequests';

import { api } from './api/client';

// Monitor de inactividad de sesión (30 min), reinicio y caída de servidor
const SessionMonitor: React.FC = () => {
  const navigate = useNavigate();
  const { isSessionExpired, sessionExpiredReason, handleAcknowledgeExpiry } = useInactivityTimeout();
  const { isAuthenticated, setUser, logout } = useAuthStore();

  const handleLoginAgain = () => {
    handleAcknowledgeExpiry();
    navigate('/login', { replace: true });
  };

  // Validar sesión con el backend al arrancar la app y al enfocar la ventana
  useEffect(() => {
    if (!isAuthenticated) return;

    const verifySessionWithServer = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data?.user) {
          setUser(res.data.user);
        }
      } catch (err: any) {
        // Los errores 401 y de red ya son gestionados por el interceptor de api/client.ts
        if (err.response?.status === 401) {
          const code = err.response?.data?.code;
          logout(code === 'SERVER_RESTARTED' ? 'SERVER_RESTARTED' : 'INACTIVITY');
        } else if (err.code === 'ERR_NETWORK' || !err.response) {
          logout('SERVER_DOWN');
        }
      }
    };

    verifySessionWithServer();

    // Re-validar cuando la ventana recupera el foco o se vuelve visible
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        verifySessionWithServer();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [isAuthenticated, setUser, logout]);

  // Sondeo periódico ligero cada 15 segundos para detectar caídas o reinicios del servidor en tiempo real
  useEffect(() => {
    if (!isAuthenticated) return;

    const intervalId = setInterval(async () => {
      try {
        await api.get('/auth/me');
      } catch (err: any) {
        // Gestionado por el interceptor
      }
    }, 15000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  return (
    <SessionTimeoutModal
      isOpen={isSessionExpired}
      reason={sessionExpiredReason}
      onLoginAgain={handleLoginAgain}
    />
  );
};

// Componente guard para rutas autenticadas
const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAdmin?: boolean }> = ({
  children,
  requireAdmin,
}) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  const { initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SessionMonitor />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col font-['Outfit',sans-serif]">
        <Navbar />

        <main className="flex-1">
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/solicitar-registro" element={<RegisterRequest />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Rutas Protegidas */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fichas"
              element={
                <ProtectedRoute>
                  <FichasHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/solicitudes"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminRequests />
                </ProtectedRoute>
              }
            />

            {/* Redirección por defecto */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="py-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
          <div className="max-w-7xl mx-auto px-4">
            Servicio Nacional de Aprendizaje SENA • Sistema de Extracción y Validación OCR de Cédulas
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
