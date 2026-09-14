import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { Sun, Moon, LogOut, ShieldCheck, FileCheck2, Users, Layers } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 glass border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Marca SENA */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sena-500 to-sena-700 flex items-center justify-center text-white shadow-lg shadow-sena-500/20 group-hover:scale-105 transition-transform">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              SENA <span className="text-sena-500 font-semibold text-sm px-2 py-0.5 rounded-full bg-sena-100 dark:bg-sena-900/40 text-sena-700 dark:text-sena-400">OCR Cédulas</span>
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Extracción y Validación Automatizada</p>
          </div>
        </Link>

        {/* Acciones del Usuario */}
        <div className="flex items-center gap-2 sm:gap-4">
          {user && (
            <nav className="hidden md:flex items-center gap-1 sm:gap-2 mr-2">
              <Link
                to="/"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Panel
              </Link>
              <Link
                to="/fichas"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <Layers className="w-4 h-4 text-sena-500" />
                <span>Cargues por Ficha</span>
              </Link>
              {user.role === 'ADMIN' && (
                <Link
                  to="/admin/solicitudes"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4 text-sena-500" />
                  <span>Solicitudes</span>
                </Link>
              )}
            </nav>
          )}

          {/* Selector de Modo Oscuro */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          {user && (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-800">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.email}</span>
                <span className="text-xs font-medium text-sena-600 dark:text-sena-400 flex items-center justify-end gap-1">
                  {user.role === 'ADMIN' ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" /> Administrador
                    </>
                  ) : (
                    'Usuario Estándar'
                  )}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
