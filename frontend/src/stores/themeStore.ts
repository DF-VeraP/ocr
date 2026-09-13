import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  initTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: false,

  initTheme: () => {
    const saved = localStorage.getItem('sena_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ isDark });
  },

  toggleTheme: () => {
    const nextDark = !get().isDark;
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sena_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sena_theme', 'light');
    }
    set({ isDark: nextDark });
  },
}));
