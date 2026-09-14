import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Home, Layers, Users } from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-around shadow-2xl safe-bottom">
      <NavLink
        to="/"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[11px] font-bold transition-all ${
            isActive
              ? 'text-sena-600 dark:text-sena-400 scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`
        }
      >
        <Home className="w-5 h-5" />
        <span>Panel</span>
      </NavLink>

      <NavLink
        to="/fichas"
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[11px] font-bold transition-all ${
            isActive
              ? 'text-sena-600 dark:text-sena-400 scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`
        }
      >
        <Layers className="w-5 h-5" />
        <span>Fichas</span>
      </NavLink>

      {user.role === 'ADMIN' && (
        <NavLink
          to="/admin/solicitudes"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[11px] font-bold transition-all ${
              isActive
                ? 'text-sena-600 dark:text-sena-400 scale-105'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`
          }
        >
          <Users className="w-5 h-5" />
          <span>Admin</span>
        </NavLink>
      )}
    </div>
  );
};
