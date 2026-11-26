import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { localStore } from '../db/client';
import { getThemePalette, type ThemeMode, type ThemePalette } from './tokens';

const THEME_META_KEY = 'ui_theme_mode';

export interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  theme: ThemePalette;
  setMode: (nextMode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  isDark: true,
  theme: getThemePalette('dark'),
  setMode: () => {},
  toggleTheme: () => {},
});

function readPersistedThemeMode(): ThemeMode {
  try {
    const stored = localStore.getSyncMeta(THEME_META_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // Fallback al modo por defecto si la DB local no está inicializada todavía
  }
  return 'dark';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => readPersistedThemeMode());

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    try {
      localStore.setSyncMeta(THEME_META_KEY, nextMode);
    } catch {
      // Ignorar si falla persistencia
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      try {
        localStore.setSyncMeta(THEME_META_KEY, next);
      } catch {
        // Ignorar si falla persistencia
      }
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark: mode === 'dark',
      theme: getThemePalette(mode),
      setMode,
      toggleTheme,
    }),
    [mode, setMode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
