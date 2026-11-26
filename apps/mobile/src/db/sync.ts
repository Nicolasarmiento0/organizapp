import { AppState, Platform, type AppStateStatus } from 'react-native';
import type {
  SyncPushRequest,
  SyncBatchResponse,
} from '@organiza/shared/schema';
import { localStore } from './client';
import { API_BASE_URL, authClient } from '../services/authClient';

export type SyncStatusState = 'idle' | 'syncing' | 'synced' | 'error';

export interface SyncStatusSnapshot {
  status: SyncStatusState;
  lastSyncedAt: number;
  dirtyCount: number;
  lastError: string | null;
  isHydrated: boolean;
}

export interface SyncOptions {
  forceFullPull?: boolean;
  replaceOnCleanPull?: boolean;
  keepalive?: boolean;
}

const AUTO_SYNC_INTERVAL_MS = 20_000;
const MAX_RETRY_DELAY_MS = 30_000;
const BASE_RETRY_DELAY_MS = 3_000;

let isSyncInFlight = false;
let inFlightPromise: Promise<boolean> | null = null;
let pendingSyncRequested = false;
let pendingForceFullPull = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let autoSyncCleanup: (() => void) | null = null;

let currentSnapshot: SyncStatusSnapshot = {
  status: 'idle',
  lastSyncedAt: 0,
  dirtyCount: 0,
  lastError: null,
  isHydrated: false,
};

type SyncListener = (snapshot: SyncStatusSnapshot) => void;
const syncListeners = new Set<SyncListener>();

function emitSyncStatus(partial: Partial<SyncStatusSnapshot>): void {
  currentSnapshot = {
    ...currentSnapshot,
    ...partial,
    dirtyCount: countLocalDirtyRecords(),
  };
  for (const listener of syncListeners) {
    listener(currentSnapshot);
  }
}

function clearRetryTimer(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetryIfNeeded(): void {
  if (!localStore.getActiveUserId()) return;
  if (countLocalDirtyRecords() === 0 && currentSnapshot.isHydrated) return;

  clearRetryTimer();
  const delayMs = Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** retryAttempt);
  retryAttempt = Math.min(retryAttempt + 1, 6);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (localStore.getActiveUserId()) {
      void syncWithCloudflareD1();
    }
  }, delayMs);
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  syncListeners.add(listener);
  listener({
    ...currentSnapshot,
    lastSyncedAt: getLastSyncedTimestamp(),
    dirtyCount: countLocalDirtyRecords(),
  });
  return () => {
    syncListeners.delete(listener);
  };
}

export function getLastSyncedTimestamp(): number {
  return localStore.getLastSyncedAt();
}

export function countLocalDirtyRecords(): number {
  return localStore.countDirtyRecords();
}

/**
 * Ejecuta un ciclo Push/Pull Batch contra `/api/sync` en Cloudflare Workers + D1.
 * Encola solicitudes concurrentes para no perder ediciones en vuelo.
 */
export function syncWithCloudflareD1(options?: SyncOptions): Promise<boolean> {
  if (!localStore.getActiveUserId()) {
    return Promise.resolve(false);
  }

  if (isSyncInFlight && inFlightPromise) {
    pendingSyncRequested = true;
    if (options?.forceFullPull) {
      pendingForceFullPull = true;
    }
    return inFlightPromise;
  }

  isSyncInFlight = true;
  const runPromise = (async (): Promise<boolean> => {
    const activeUserId = localStore.getActiveUserId();
    if (!activeUserId) {
      return false;
    }

    const lastSyncedAt = options?.forceFullPull ? 0 : localStore.getLastSyncedAt();
    emitSyncStatus({ status: 'syncing', lastSyncedAt, lastError: null });

    try {
      const maybeExpoClient = authClient as unknown as {
        getCookie?: () => Promise<string> | string;
      };
      const cookieHeader =
        Platform.OS !== 'web' && typeof maybeExpoClient.getCookie === 'function'
          ? await maybeExpoClient.getCookie()
          : '';

      if (Platform.OS !== 'web' && !cookieHeader) {
        emitSyncStatus({
          status: 'error',
          lastSyncedAt,
          lastError: 'Sin sesión activa. Inicia sesión nuevamente.',
        });
        return false;
      }

      const dirtyChangeset = localStore.getDirtyChangeset();
      const totalSentDirty =
        dirtyChangeset.tasks.length +
        dirtyChangeset.habits.length +
        dirtyChangeset.habitLogs.length +
        dirtyChangeset.habitRewards.length +
        dirtyChangeset.workBlocks.length +
        dirtyChangeset.notePages.length;

      const payload: SyncPushRequest = {
        lastSyncedAt,
        changes: dirtyChangeset,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (cookieHeader) {
        headers.Cookie = cookieHeader;
      }

      const response = await fetch(`${API_BASE_URL}/api/sync`, {
        method: 'POST',
        headers,
        credentials: 'include',
        keepalive: Boolean(options?.keepalive),
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        clearRetryTimer();
        emitSyncStatus({
          status: 'error',
          lastSyncedAt,
          lastError: 'Sesión expirada. Vuelve a iniciar sesión.',
        });
        return false;
      }

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const data = (await response.json()) as SyncBatchResponse;
      if (!data.ok) {
        throw new Error('SYNC_RESPONSE_NOT_OK');
      }

      retryAttempt = 0;
      clearRetryTimer();

      if (
        options?.replaceOnCleanPull &&
        totalSentDirty === 0 &&
        countLocalDirtyRecords() === 0
      ) {
        localStore.replaceAllFromCloud(data);
      } else {
        localStore.applySyncBatchResponse(dirtyChangeset, data);
      }

      emitSyncStatus({
        status: 'synced',
        lastSyncedAt: data.serverTimestamp,
        lastError: null,
        isHydrated: true,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo sincronizar con Cloudflare D1';
      emitSyncStatus({
        status: 'error',
        lastSyncedAt,
        lastError: message,
      });
      scheduleRetryIfNeeded();
      return false;
    } finally {
      isSyncInFlight = false;
      inFlightPromise = null;
      if (pendingSyncRequested) {
        const nextForcePull = pendingForceFullPull;
        pendingSyncRequested = false;
        pendingForceFullPull = false;
        if (localStore.getActiveUserId()) {
          void syncWithCloudflareD1(
            nextForcePull ? { forceFullPull: true } : undefined
          );
        }
      }
    }
  })();

  inFlightPromise = runPromise;
  return runPromise;
}

export async function hydrateWorkspaceFromCloud(userId: string): Promise<boolean> {
  const cleanId = userId.trim();
  if (!cleanId) return false;
  localStore.resetForUser(cleanId);
  return syncWithCloudflareD1({
    forceFullPull: true,
    replaceOnCleanPull: true,
  });
}

export function stopCloudAutoSync(): void {
  if (autoSyncCleanup) {
    autoSyncCleanup();
    autoSyncCleanup = null;
  }
}

export function resetCloudSyncState(): void {
  stopCloudAutoSync();
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  clearRetryTimer();
  retryAttempt = 0;
  pendingSyncRequested = false;
  pendingForceFullPull = false;
  localStore.clearAll();
  emitSyncStatus({
    status: 'idle',
    lastSyncedAt: 0,
    lastError: null,
    isHydrated: false,
  });
}

export function startCloudAutoSync(
  userId: string,
  options?: { skipInitialHydrate?: boolean }
): () => void {
  stopCloudAutoSync();
  const cleanId = userId.trim();
  if (!cleanId) {
    return () => {};
  }

  localStore.resetForUser(cleanId);
  if (!options?.skipInitialHydrate) {
    void hydrateWorkspaceFromCloud(cleanId);
  }

  const intervalId = setInterval(() => {
    if (
      Platform.OS === 'web' &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden' &&
      countLocalDirtyRecords() === 0
    ) {
      return;
    }
    void syncWithCloudflareD1();
  }, AUTO_SYNC_INTERVAL_MS);

  const unsubscribers: Array<() => void> = [() => clearInterval(intervalId)];

  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncWithCloudflareD1();
      } else if (countLocalDirtyRecords() > 0) {
        void syncWithCloudflareD1({ keepalive: true });
      }
    };
    const handleWindowFocus = () => {
      void syncWithCloudflareD1();
    };
    const handleOnline = () => {
      void syncWithCloudflareD1();
    };
    const handlePageHide = () => {
      if (countLocalDirtyRecords() > 0) {
        void syncWithCloudflareD1({ keepalive: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('pagehide', handlePageHide);

    unsubscribers.push(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pagehide', handlePageHide);
    });
  } else {
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void syncWithCloudflareD1();
      } else if (
        (nextState === 'background' || nextState === 'inactive') &&
        countLocalDirtyRecords() > 0
      ) {
        void syncWithCloudflareD1();
      }
    });
    unsubscribers.push(() => {
      appStateSub.remove();
    });
  }

  const cleanup = () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
  autoSyncCleanup = cleanup;
  return cleanup;
}

export function triggerBackgroundSync(delayMs = 200): void {
  if (!localStore.getActiveUserId()) {
    return;
  }
  emitSyncStatus({ dirtyCount: countLocalDirtyRecords() });
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncWithCloudflareD1();
  }, delayMs);
}
