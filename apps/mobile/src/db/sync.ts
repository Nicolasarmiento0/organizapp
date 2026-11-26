import { Platform } from 'react-native';
import type {
  SyncPushRequest,
  SyncBatchResponse,
} from '@organiza/shared/schema';
import { localStore, notifyDatabaseChanged } from './client';
import { API_BASE_URL, authClient } from '../services/authClient';

export type SyncStatusState = 'idle' | 'syncing' | 'synced' | 'offline';

export interface SyncStatusSnapshot {
  status: SyncStatusState;
  lastSyncedAt: number;
  dirtyCount: number;
  lastError: string | null;
}

const LAST_SYNC_META_KEY = 'cloudflare_d1_last_synced_at';

let isSyncInFlight = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentSnapshot: SyncStatusSnapshot = {
  status: 'idle',
  lastSyncedAt: 0,
  dirtyCount: 0,
  lastError: null,
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
  try {
    const raw = localStore.getSyncMeta(LAST_SYNC_META_KEY);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function countLocalDirtyRecords(): number {
  return localStore.countDirtyRecords();
}

export function claimLocalRecordsForUser(authenticatedUserId: string): void {
  localStore.claimLocalRecordsForUser(authenticatedUserId);
}

/**
 * Ejecuta un ciclo Push/Pull Batch contra `/api/sync` en Cloudflare Workers + D1.
 * Compatible con Web (cookies / fetch credentials), iOS y Android (@better-auth/expo).
 */
export async function syncWithCloudflareD1(): Promise<boolean> {
  if (isSyncInFlight) {
    return false;
  }

  isSyncInFlight = true;
  const lastSyncedAt = getLastSyncedTimestamp();
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
        status: 'offline',
        lastSyncedAt,
        lastError: null,
      });
      isSyncInFlight = false;
      return false;
    }

    const dirtyChangeset = localStore.getDirtyChangeset();

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
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    const data = (await response.json()) as SyncBatchResponse;
    if (!data.ok) {
      throw new Error('SYNC_RESPONSE_NOT_OK');
    }

    localStore.applySyncBatchResponse(dirtyChangeset, data);

    notifyDatabaseChanged();
    emitSyncStatus({
      status: 'synced',
      lastSyncedAt: data.serverTimestamp,
      lastError: null,
    });
    isSyncInFlight = false;
    return true;
  } catch (error) {
    emitSyncStatus({
      status: 'offline',
      lastSyncedAt,
      lastError: error instanceof Error ? error.message : 'OFFLINE',
    });
    isSyncInFlight = false;
    return false;
  }
}

export function triggerBackgroundSync(delayMs = 650): void {
  emitSyncStatus({ dirtyCount: countLocalDirtyRecords() });
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    void syncWithCloudflareD1();
  }, delayMs);
}
