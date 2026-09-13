import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Interceptor para agregar token Bearer
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar expiración de sesión (401) y caída de servidor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    const isAuthStoreAuth = useAuthStore.getState().isAuthenticated;

    if (error.response?.status === 401 && !isLoginRequest) {
      const code = error.response?.data?.code;
      if (code === 'SERVER_RESTARTED') {
        useAuthStore.getState().logout('SERVER_RESTARTED');
      } else {
        useAuthStore.getState().logout('INACTIVITY');
      }
    } else if ((error.code === 'ERR_NETWORK' || !error.response) && isAuthStoreAuth && !isLoginRequest) {
      // Servidor caído o inaccesible mientras el usuario tiene sesión activa
      useAuthStore.getState().logout('SERVER_DOWN');
    }

    return Promise.reject(error);
  }
);
