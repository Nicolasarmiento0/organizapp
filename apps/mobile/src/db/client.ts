import { Platform } from 'react-native';
import type {
  TaskRecord,
  HabitRecord,
  HabitLogRecord,
  HabitRewardRecord,
  WorkBlockRecord,
  NotePageRecord,
  SyncChangeset,
  SyncBatchResponse,
} from '@organiza/shared/schema';
import {
  createLocalId,
  getTodayDateKey,
  notifyDatabaseChanged,
  rankNotePagesInMemory,
  subscribeDatabaseChanges,
  type LocalDatabaseEngine,
} from './seedData';

export {
  createLocalId,
  getTodayDateKey,
  notifyDatabaseChanged,
  subscribeDatabaseChanges,
  type LocalDatabaseEngine,
};

const LEGACY_STORAGE_KEYS = [
  'organiza_local_web_v1',
  'organiza_offline_guest_enabled',
] as const;

interface CloudCacheState {
  activeUserId: string;
  lastSyncedAt: number;
  tasks: Record<string, TaskRecord>;
  habits: Record<string, HabitRecord>;
  habitLogs: Record<string, HabitLogRecord>;
  habitRewards: Record<string, HabitRewardRecord>;
  workBlocks: Record<string, WorkBlockRecord>;
  notePages: Record<string, NotePageRecord>;
}

let memoryState: CloudCacheState = {
  activeUserId: '',
  lastSyncedAt: 0,
  tasks: {},
  habits: {},
  habitLogs: {},
  habitRewards: {},
  workBlocks: {},
  notePages: {},
};

function createEmptyCollections(): Pick<
  CloudCacheState,
  'tasks' | 'habits' | 'habitLogs' | 'habitRewards' | 'workBlocks' | 'notePages'
> {
  return {
    tasks: {},
    habits: {},
    habitLogs: {},
    habitRewards: {},
    workBlocks: {},
    notePages: {},
  };
}

function normalizeHabitRecord(raw: HabitRecord): HabitRecord {
  return {
    ...raw,
    habitType: raw.habitType ?? 'binary',
    unit: raw.unit ?? null,
    scheduledDays:
      raw.scheduledDays ??
      (raw.frequency === 'weekdays'
        ? '[1,2,3,4,5]'
        : raw.frequency === 'weekends'
          ? '[0,6]'
          : '[0,1,2,3,4,5,6]'),
    bestStreak: raw.bestStreak ?? raw.streak ?? 0,
    weeklyGoal: raw.weeklyGoal ?? null,
    isPaused: Boolean(raw.isPaused),
    pausedUntil: raw.pausedUntil ?? null,
    timeOfDay: raw.timeOfDay ?? 'any',
    isArchived: Boolean(raw.isArchived),
  };
}

function normalizeHabitLogRecord(raw: HabitLogRecord): HabitLogRecord {
  return {
    ...raw,
    isCompleted: Boolean(raw.isCompleted),
    status: raw.status ?? (raw.isCompleted ? 'completed' : 'partial'),
  };
}

function normalizeTaskRecord(raw: TaskRecord): TaskRecord {
  return {
    ...raw,
    isFlagged: Boolean(raw.isFlagged),
    isCompleted: Boolean(raw.isCompleted),
    notified: Boolean(raw.notified),
    sourcePageId: raw.sourcePageId ?? null,
    sourceBlockId: raw.sourceBlockId ?? null,
  };
}

function normalizeNotePageRecord(raw: NotePageRecord): NotePageRecord {
  return {
    ...raw,
    blocksJson: raw.blocksJson ?? null,
    isPinned: Boolean(raw.isPinned),
    sortOrder: raw.sortOrder ?? 0,
  };
}

/**
 * Garantiza marcas de tiempo estrictamente crecientes para evitar conflictos
 * por desfase de reloj entre dispositivos.
 */
export function nextMonotonicTimestamp(previousUpdatedAt?: number | null): number {
  return Math.max(Date.now(), (previousUpdatedAt ?? 0) + 1);
}

/**
 * Elimina claves heredadas del antiguo modo local en Web.
 */
export function clearLegacyLocalStorageData(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignorar restricciones de almacenamiento del navegador
  }
}

/**
 * Caché reactivo en memoria sincronizado 100% con Cloudflare D1.
 * Unificado para Web, iOS y Android sin persistencia local independiente.
 */
export const localStore: LocalDatabaseEngine = {
  getActiveUserId(): string {
    return memoryState.activeUserId;
  },

  getLastSyncedAt(): number {
    return memoryState.lastSyncedAt;
  },

  resetForUser(userId: string): void {
    const cleanId = userId.trim();
    if (memoryState.activeUserId === cleanId) {
      return;
    }
    memoryState = {
      activeUserId: cleanId,
      lastSyncedAt: 0,
      ...createEmptyCollections(),
    };
    notifyDatabaseChanged();
  },

  clearAll(): void {
    memoryState = {
      activeUserId: '',
      lastSyncedAt: 0,
      ...createEmptyCollections(),
    };
    notifyDatabaseChanged();
  },

  replaceAllFromCloud(response: SyncBatchResponse): void {
    const nextCollections = createEmptyCollections();

    for (const remoteTask of response.changes.tasks ?? []) {
      nextCollections.tasks[remoteTask.id] = normalizeTaskRecord({
        ...remoteTask,
        isDirty: false,
      });
    }
    for (const remoteHabit of response.changes.habits ?? []) {
      nextCollections.habits[remoteHabit.id] = normalizeHabitRecord({
        ...remoteHabit,
        isDirty: false,
      });
    }
    for (const remoteLog of response.changes.habitLogs ?? []) {
      nextCollections.habitLogs[remoteLog.id] = normalizeHabitLogRecord({
        ...remoteLog,
        isDirty: false,
      });
    }
    for (const remoteReward of response.changes.habitRewards ?? []) {
      nextCollections.habitRewards[remoteReward.id] = {
        ...remoteReward,
        isDirty: false,
      };
    }
    for (const remoteBlock of response.changes.workBlocks ?? []) {
      nextCollections.workBlocks[remoteBlock.id] = {
        ...remoteBlock,
        isRecurring: Boolean(remoteBlock.isRecurring),
        isDirty: false,
      };
    }
    for (const remoteNote of response.changes.notePages ?? []) {
      nextCollections.notePages[remoteNote.id] = normalizeNotePageRecord({
        ...remoteNote,
        isDirty: false,
      });
    }

    memoryState = {
      activeUserId: memoryState.activeUserId,
      lastSyncedAt: response.serverTimestamp,
      ...nextCollections,
    };
    notifyDatabaseChanged();
  },

  getTasks(): TaskRecord[] {
    return Object.values(memoryState.tasks)
      .filter((t) => !t.deletedAt)
      .sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return b.createdAt - a.createdAt;
      });
  },

  getTaskById(id: string): TaskRecord | undefined {
    return memoryState.tasks[id];
  },

  upsertTask(record: TaskRecord): void {
    memoryState.tasks[record.id] = normalizeTaskRecord({ ...record });
  },

  updateTask(id: string, patch: Partial<TaskRecord>): void {
    const existing = memoryState.tasks[id];
    if (!existing) return;
    memoryState.tasks[id] = normalizeTaskRecord({ ...existing, ...patch });
  },

  getHabits(): HabitRecord[] {
    return Object.values(memoryState.habits)
      .filter((h) => !h.deletedAt && !h.isArchived)
      .map(normalizeHabitRecord)
      .sort((a, b) => {
        if (a.streak !== b.streak) return b.streak - a.streak;
        return b.createdAt - a.createdAt;
      });
  },

  getHabitById(id: string): HabitRecord | undefined {
    const found = memoryState.habits[id];
    return found ? normalizeHabitRecord(found) : undefined;
  },

  upsertHabit(record: HabitRecord): void {
    memoryState.habits[record.id] = normalizeHabitRecord({ ...record });
  },

  updateHabit(id: string, patch: Partial<HabitRecord>): void {
    const existing = memoryState.habits[id];
    if (!existing) return;
    memoryState.habits[id] = normalizeHabitRecord({ ...existing, ...patch });
  },

  getHabitLogsForDate(dateKey: string): HabitLogRecord[] {
    return Object.values(memoryState.habitLogs)
      .filter((log) => log.dateKey === dateKey && !log.deletedAt)
      .map(normalizeHabitLogRecord);
  },

  getHabitLogsInRange(startDateKey: string, endDateKey: string): HabitLogRecord[] {
    return Object.values(memoryState.habitLogs)
      .filter(
        (log) =>
          !log.deletedAt &&
          log.dateKey >= startDateKey &&
          log.dateKey <= endDateKey
      )
      .map(normalizeHabitLogRecord);
  },

  getAllHabitLogs(): HabitLogRecord[] {
    return Object.values(memoryState.habitLogs)
      .filter((log) => !log.deletedAt)
      .map(normalizeHabitLogRecord);
  },

  getHabitLogById(id: string): HabitLogRecord | undefined {
    const found = memoryState.habitLogs[id];
    return found ? normalizeHabitLogRecord(found) : undefined;
  },

  upsertHabitLog(record: HabitLogRecord): void {
    memoryState.habitLogs[record.id] = normalizeHabitLogRecord({ ...record });
  },

  getHabitRewards(): HabitRewardRecord[] {
    return Object.values(memoryState.habitRewards)
      .filter((r) => !r.deletedAt)
      .sort((a, b) => {
        if (a.costPoints !== b.costPoints) return a.costPoints - b.costPoints;
        return b.createdAt - a.createdAt;
      });
  },

  getHabitRewardById(id: string): HabitRewardRecord | undefined {
    return memoryState.habitRewards[id];
  },

  upsertHabitReward(record: HabitRewardRecord): void {
    memoryState.habitRewards[record.id] = { ...record };
  },

  updateHabitReward(id: string, patch: Partial<HabitRewardRecord>): void {
    const existing = memoryState.habitRewards[id];
    if (!existing) return;
    memoryState.habitRewards[id] = { ...existing, ...patch };
  },

  getWorkBlocksForDate(dateKey: string): WorkBlockRecord[] {
    const allActive = Object.values(memoryState.workBlocks).filter((b) => !b.deletedAt);
    const exactRows = allActive
      .filter((b) => b.dateKey === dateKey)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (exactRows.length > 0) {
      return exactRows;
    }

    return allActive
      .filter((b) => b.isRecurring)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  },

  getWorkBlockById(id: string): WorkBlockRecord | undefined {
    return memoryState.workBlocks[id];
  },

  upsertWorkBlock(record: WorkBlockRecord): void {
    memoryState.workBlocks[record.id] = {
      ...record,
      isRecurring: Boolean(record.isRecurring),
    };
  },

  updateWorkBlock(id: string, patch: Partial<WorkBlockRecord>): void {
    const existing = memoryState.workBlocks[id];
    if (!existing) return;
    memoryState.workBlocks[id] = {
      ...existing,
      ...patch,
      isRecurring: Boolean(patch.isRecurring ?? existing.isRecurring),
    };
  },

  getNotePages(): NotePageRecord[] {
    return Object.values(memoryState.notePages)
      .filter((p) => !p.deletedAt)
      .map(normalizeNotePageRecord)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return b.updatedAt - a.updatedAt;
      });
  },

  getDeletedNotePages(): NotePageRecord[] {
    return Object.values(memoryState.notePages)
      .filter((p) => Boolean(p.deletedAt))
      .map(normalizeNotePageRecord)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  },

  getNotePageById(id: string): NotePageRecord | undefined {
    const found = memoryState.notePages[id];
    return found ? normalizeNotePageRecord(found) : undefined;
  },

  searchNotePages(query: string, limit = 20): NotePageRecord[] {
    return rankNotePagesInMemory(this.getNotePages(), query, limit);
  },

  upsertNotePage(record: NotePageRecord): void {
    memoryState.notePages[record.id] = normalizeNotePageRecord({ ...record });
  },

  updateNotePage(id: string, patch: Partial<NotePageRecord>): void {
    const existing = memoryState.notePages[id];
    if (!existing) return;
    memoryState.notePages[id] = normalizeNotePageRecord({ ...existing, ...patch });
  },

  getDirtyChangeset(): SyncChangeset {
    return {
      tasks: Object.values(memoryState.tasks).filter((r) => r.isDirty),
      habits: Object.values(memoryState.habits).filter((r) => r.isDirty),
      habitLogs: Object.values(memoryState.habitLogs).filter((r) => r.isDirty),
      habitRewards: Object.values(memoryState.habitRewards).filter((r) => r.isDirty),
      workBlocks: Object.values(memoryState.workBlocks).filter((r) => r.isDirty),
      notePages: Object.values(memoryState.notePages).filter((r) => r.isDirty),
    };
  },

  countDirtyRecords(): number {
    const dirty = this.getDirtyChangeset();
    return (
      dirty.tasks.length +
      dirty.habits.length +
      dirty.habitLogs.length +
      dirty.habitRewards.length +
      dirty.workBlocks.length +
      dirty.notePages.length
    );
  },

  applySyncBatchResponse(sent: SyncChangeset, response: SyncBatchResponse): void {
    for (const item of sent.tasks) {
      const current = memoryState.tasks[item.id];
      if (current && current.updatedAt === item.updatedAt) {
        current.isDirty = false;
      }
    }
    for (const item of sent.habits) {
      const current = memoryState.habits[item.id];
      if (current && current.updatedAt === item.updatedAt) {
        current.isDirty = false;
      }
    }
    for (const item of sent.habitLogs) {
      const current = memoryState.habitLogs[item.id];
      if (current && current.updatedAt === item.updatedAt) {
        current.isDirty = false;
      }
    }
    for (const item of sent.habitRewards) {
      const current = memoryState.habitRewards[item.id];
      if (current && current.updatedAt === item.updatedAt) {
        current.isDirty = false;
      }
    }
    for (const item of sent.workBlocks) {
      const current = memoryState.workBlocks[item.id];
      if (current && current.updatedAt === item.updatedAt) {
        current.isDirty = false;
      }
    }
    for (const item of sent.notePages) {
      const current = memoryState.notePages[item.id];
      if (current && current.updatedAt === item.updatedAt) {
        current.isDirty = false;
      }
    }

    for (const remoteTask of response.changes.tasks ?? []) {
      const localRow = memoryState.tasks[remoteTask.id];
      if (!localRow) {
        memoryState.tasks[remoteTask.id] = normalizeTaskRecord({
          ...remoteTask,
          isDirty: false,
        });
      } else if (localRow.isDirty) {
        localRow.updatedAt = Math.max(localRow.updatedAt, remoteTask.updatedAt + 1);
      } else if (remoteTask.updatedAt >= localRow.updatedAt) {
        memoryState.tasks[remoteTask.id] = normalizeTaskRecord({
          ...remoteTask,
          isDirty: false,
        });
      }
    }

    for (const remoteHabit of response.changes.habits ?? []) {
      const localRow = memoryState.habits[remoteHabit.id];
      if (!localRow) {
        memoryState.habits[remoteHabit.id] = normalizeHabitRecord({
          ...remoteHabit,
          isDirty: false,
        });
      } else if (localRow.isDirty) {
        localRow.updatedAt = Math.max(localRow.updatedAt, remoteHabit.updatedAt + 1);
      } else if (remoteHabit.updatedAt >= localRow.updatedAt) {
        memoryState.habits[remoteHabit.id] = normalizeHabitRecord({
          ...remoteHabit,
          isDirty: false,
        });
      }
    }

    for (const remoteLog of response.changes.habitLogs ?? []) {
      const localRow = memoryState.habitLogs[remoteLog.id];
      if (!localRow) {
        memoryState.habitLogs[remoteLog.id] = normalizeHabitLogRecord({
          ...remoteLog,
          isDirty: false,
        });
      } else if (localRow.isDirty) {
        localRow.updatedAt = Math.max(localRow.updatedAt, remoteLog.updatedAt + 1);
      } else if (remoteLog.updatedAt >= localRow.updatedAt) {
        memoryState.habitLogs[remoteLog.id] = normalizeHabitLogRecord({
          ...remoteLog,
          isDirty: false,
        });
      }
    }

    for (const remoteReward of response.changes.habitRewards ?? []) {
      const localRow = memoryState.habitRewards[remoteReward.id];
      if (!localRow) {
        memoryState.habitRewards[remoteReward.id] = {
          ...remoteReward,
          isDirty: false,
        };
      } else if (localRow.isDirty) {
        localRow.updatedAt = Math.max(localRow.updatedAt, remoteReward.updatedAt + 1);
      } else if (remoteReward.updatedAt >= localRow.updatedAt) {
        memoryState.habitRewards[remoteReward.id] = {
          ...remoteReward,
          isDirty: false,
        };
      }
    }

    for (const remoteBlock of response.changes.workBlocks ?? []) {
      const localRow = memoryState.workBlocks[remoteBlock.id];
      if (!localRow) {
        memoryState.workBlocks[remoteBlock.id] = {
          ...remoteBlock,
          isRecurring: Boolean(remoteBlock.isRecurring),
          isDirty: false,
        };
      } else if (localRow.isDirty) {
        localRow.updatedAt = Math.max(localRow.updatedAt, remoteBlock.updatedAt + 1);
      } else if (remoteBlock.updatedAt >= localRow.updatedAt) {
        memoryState.workBlocks[remoteBlock.id] = {
          ...remoteBlock,
          isRecurring: Boolean(remoteBlock.isRecurring),
          isDirty: false,
        };
      }
    }

    for (const remoteNote of response.changes.notePages ?? []) {
      const localRow = memoryState.notePages[remoteNote.id];
      if (!localRow) {
        memoryState.notePages[remoteNote.id] = normalizeNotePageRecord({
          ...remoteNote,
          isDirty: false,
        });
      } else if (localRow.isDirty) {
        localRow.updatedAt = Math.max(localRow.updatedAt, remoteNote.updatedAt + 1);
      } else if (remoteNote.updatedAt >= localRow.updatedAt) {
        memoryState.notePages[remoteNote.id] = normalizeNotePageRecord({
          ...remoteNote,
          isDirty: false,
        });
      }
    }

    memoryState.lastSyncedAt = Math.max(
      memoryState.lastSyncedAt,
      response.serverTimestamp
    );
    notifyDatabaseChanged();
  },
};
