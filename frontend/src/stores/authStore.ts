import { create } from 'zustand';
import { User } from '../types';

export type SessionExpiredReason = 'INACTIVITY' | 'SERVER_RESTARTED' | 'SERVER_DOWN' | null;

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  sessionExpiredReason: SessionExpiredReason;
  setAuth: (user: User, token: string) => void;
  setUser: (user: User) => void;
  logout: (reason?: SessionExpiredReason) => void;
  clearSessionExpiredReason: () => void;
}

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

function getInitialAuthState() {
  const storedToken = localStorage.getItem('sena_token');
  const storedUser = localStorage.getItem('sena_user');
  const storedLastActivity = localStorage.getItem('sena_last_activity');

  if (storedToken && storedLastActivity) {
    const elapsed = Date.now() - parseInt(storedLastActivity, 10);
    if (elapsed < INACTIVITY_TIMEOUT_MS) {
      try {
        return {
          user: storedUser ? JSON.parse(storedUser) : null,
          token: storedToken,
          isAuthenticated: true,
          sessionExpiredReason: null as SessionExpiredReason,
        };
      } catch (e) {
        // Formato inválido
      }
    }
  }

  // Si superó los 30 min o no tiene registro, limpiar residuos
  if (storedToken) {
    localStorage.removeItem('sena_token');
    localStorage.removeItem('sena_user');
    localStorage.removeItem('sena_last_activity');
    localStorage.removeItem('sena_current_batch_id');
  }

  return {
    user: null,
    token: null,
    isAuthenticated: false,
    sessionExpiredReason: storedToken ? ('INACTIVITY' as SessionExpiredReason) : null,
  };
}

const initial = getInitialAuthState();

export const useAuthStore = create<AuthState>((set) => {
  return {
    user: initial.user,
    token: initial.token,
    isAuthenticated: initial.isAuthenticated,
    sessionExpiredReason: initial.sessionExpiredReason,

    setAuth: (user, token) => {
      localStorage.setItem('sena_token', token);
      localStorage.setItem('sena_user', JSON.stringify(user));
      localStorage.setItem('sena_last_activity', Date.now().toString());
      set({ user, token, isAuthenticated: true, sessionExpiredReason: null });
    },

    setUser: (user) => {
      localStorage.setItem('sena_user', JSON.stringify(user));
      set({ user });
    },

    logout: (reason = null) => {
      localStorage.removeItem('sena_token');
      localStorage.removeItem('sena_user');
      localStorage.removeItem('sena_last_activity');
      localStorage.removeItem('sena_current_batch_id');
      set({ user: null, token: null, isAuthenticated: false, sessionExpiredReason: reason });
    },

    clearSessionExpiredReason: () => {
      set({ sessionExpiredReason: null });
    },
  };
});
