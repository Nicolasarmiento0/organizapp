import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getThemePalette, type ThemeMode, type ThemePalette } from './tokens';

const THEME_STORAGE_KEY = 'organiza_ui_theme_mode';

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
    const stored =
      Platform.OS === 'web'
        ? typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(THEME_STORAGE_KEY)
          : null
        : SecureStore.getItem(THEME_STORAGE_KEY);

    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // Fallback al modo por defecto si falla la lectura
  }
  return 'dark';
}

function writePersistedThemeMode(nextMode: ThemeMode): void {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
      }
      return;
    }
    SecureStore.setItem(THEME_STORAGE_KEY, nextMode);
  } catch {
    // Ignorar si falla la persistencia visual
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => readPersistedThemeMode());

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    writePersistedThemeMode(nextMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      writePersistedThemeMode(next);
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
