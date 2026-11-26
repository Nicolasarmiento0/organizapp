import { Platform } from 'react-native';
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (envUrl) return envUrl;
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location
  ) {
    if (window.location.hostname === 'localhost') {
      return 'http://localhost:8787';
    }
    if (window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8787';
    }
    if (window.location.origin) {
      return window.location.origin;
    }
  }
  return 'http://localhost:8787';
}

export const API_BASE_URL = resolveApiBaseUrl();

const OFFLINE_MODE_STORAGE_KEY = 'organiza_offline_guest_enabled';
const LOCAL_DEFAULT_USER_ID = 'local-user';

/**
 * Adaptador de almacenamiento seguro multiplataforma:
 * - iOS / Android: Keychain / Keystore nativo mediante `expo-secure-store`
 * - Web: `window.localStorage`
 */
const crossPlatformStorage = {
  getItem: (key: string): string | null => {
    if (Platform.OS === 'web') {
      try {
        return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value);
        }
      } catch {
        // Ignorar errores de cuota en navegador privado
      }
      return;
    }
    SecureStore.setItem(key, value);
  },
  getItemAsync: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value);
        }
      } catch {
        // Ignorar errores de cuota en navegador privado
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
};

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  fetchOptions: {
    credentials: 'include',
    timeout: 10000,
  },
  plugins:
    Platform.OS === 'web'
      ? []
      : [
          expoClient({
            scheme: 'organizaapp',
            storagePrefix: 'organiza_auth',
            storage: crossPlatformStorage,
          }),
        ],
});

type OfflineModeListener = (isOfflineGuest: boolean) => void;
const offlineModeListeners = new Set<OfflineModeListener>();
let cachedOfflineGuestMode = false;

export async function loadOfflineGuestPreference(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const stored =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(OFFLINE_MODE_STORAGE_KEY)
          : null;
      if (stored === null) {
        cachedOfflineGuestMode = false;
        return false;
      }
      cachedOfflineGuestMode = stored === 'true';
      return cachedOfflineGuestMode;
    }

    const stored = await SecureStore.getItemAsync(OFFLINE_MODE_STORAGE_KEY);
    if (stored === null) {
      cachedOfflineGuestMode = false;
      return false;
    }
    cachedOfflineGuestMode = stored === 'true';
    return cachedOfflineGuestMode;
  } catch {
    return cachedOfflineGuestMode;
  }
}

export async function setOfflineGuestPreference(enabled: boolean): Promise<void> {
  cachedOfflineGuestMode = enabled;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          OFFLINE_MODE_STORAGE_KEY,
          enabled ? 'true' : 'false'
        );
      }
    } else {
      await SecureStore.setItemAsync(
        OFFLINE_MODE_STORAGE_KEY,
        enabled ? 'true' : 'false'
      );
    }
  } catch {
    // Continuar en memoria si el dispositivo bloquea almacenamiento
  }
  for (const listener of offlineModeListeners) {
    listener(enabled);
  }
}

export function getOfflineGuestPreferenceSync(): boolean {
  return cachedOfflineGuestMode;
}

export function subscribeOfflineGuestPreference(
  listener: OfflineModeListener
): () => void {
  offlineModeListeners.add(listener);
  return () => {
    offlineModeListeners.delete(listener);
  };
}

export async function signOutAndReset(): Promise<void> {
  try {
    await authClient.signOut();
  } catch {
    // Permitir cierre de sesión local incluso sin conexión
  }
  await setOfflineGuestPreference(false);
}

export function getUserInitials(
  name?: string | null,
  email?: string | null
): string {
  const source = name?.trim() || email?.trim() || 'O';
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function resolveActiveUserId(authenticatedUserId?: string | null): string {
  return authenticatedUserId && authenticatedUserId.trim().length > 0
    ? authenticatedUserId
    : LOCAL_DEFAULT_USER_ID;
}
