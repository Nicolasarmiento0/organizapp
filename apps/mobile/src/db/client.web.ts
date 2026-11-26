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
  buildDefaultRewardsSeed,
  buildInitialSeedDataset,
  createLocalId,
  getTodayDateKey,
  notifyDatabaseChanged,
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

export const DATABASE_NAME = 'organiza_local_web_v1';

interface WebDatabaseState {
  tasks: Record<string, TaskRecord>;
  habits: Record<string, HabitRecord>;
  habitLogs: Record<string, HabitLogRecord>;
  habitRewards: Record<string, HabitRewardRecord>;
  workBlocks: Record<string, WorkBlockRecord>;
  notePages: Record<string, NotePageRecord>;
  syncMeta: Record<string, string>;
}

let memoryState: WebDatabaseState = {
  tasks: {},
  habits: {},
  habitLogs: {},
  habitRewards: {},
  workBlocks: {},
  notePages: {},
  syncMeta: {},
};

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
  };
}

function normalizeHabitLogRecord(raw: HabitLogRecord): HabitLogRecord {
  return {
    ...raw,
    status: raw.status ?? (raw.isCompleted ? 'completed' : 'partial'),
  };
}

function loadWebStateFromStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const raw = window.localStorage.getItem(DATABASE_NAME);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<WebDatabaseState>;

    const normalizedHabits: Record<string, HabitRecord> = {};
    for (const [id, item] of Object.entries(parsed.habits ?? {})) {
      normalizedHabits[id] = normalizeHabitRecord(item);
    }

    const normalizedLogs: Record<string, HabitLogRecord> = {};
    for (const [id, item] of Object.entries(parsed.habitLogs ?? {})) {
      normalizedLogs[id] = normalizeHabitLogRecord(item);
    }

    memoryState = {
      tasks: parsed.tasks ?? {},
      habits: normalizedHabits,
      habitLogs: normalizedLogs,
      habitRewards: parsed.habitRewards ?? {},
      workBlocks: parsed.workBlocks ?? {},
      notePages: parsed.notePages ?? {},
      syncMeta: parsed.syncMeta ?? {},
    };
  } catch {
    // Si el almacenamiento está vacío o corrupto, conserva el estado limpio en memoria
  }
}

function persistWebStateToStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(DATABASE_NAME, JSON.stringify(memoryState));
  } catch {
    // Ignorar errores de cuota en modo privado
  }
}

/**
 * Motor Local-First Síncrono (0 ms) para Web (Chrome, Safari, Firefox, Edge).
 * Implementa exactamente el mismo contrato que `expo-sqlite` en iOS/Android
 * y sincroniza con el mismo endpoint `/api/sync` en Cloudflare D1.
 */
export const localStore: LocalDatabaseEngine = {
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
    memoryState.tasks[record.id] = { ...record };
    persistWebStateToStorage();
  },

  updateTask(id: string, patch: Partial<TaskRecord>): void {
    const existing = memoryState.tasks[id];
    if (!existing) return;
    memoryState.tasks[id] = { ...existing, ...patch };
    persistWebStateToStorage();
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
    persistWebStateToStorage();
  },

  updateHabit(id: string, patch: Partial<HabitRecord>): void {
    const existing = memoryState.habits[id];
    if (!existing) return;
    memoryState.habits[id] = normalizeHabitRecord({ ...existing, ...patch });
    persistWebStateToStorage();
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
    persistWebStateToStorage();
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
    persistWebStateToStorage();
  },

  updateHabitReward(id: string, patch: Partial<HabitRewardRecord>): void {
    const existing = memoryState.habitRewards[id];
    if (!existing) return;
    memoryState.habitRewards[id] = { ...existing, ...patch };
    persistWebStateToStorage();
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
    memoryState.workBlocks[record.id] = { ...record };
    persistWebStateToStorage();
  },

  updateWorkBlock(id: string, patch: Partial<WorkBlockRecord>): void {
    const existing = memoryState.workBlocks[id];
    if (!existing) return;
    memoryState.workBlocks[id] = { ...existing, ...patch };
    persistWebStateToStorage();
  },

  getNotePages(): NotePageRecord[] {
    return Object.values(memoryState.notePages)
      .filter((p) => !p.deletedAt)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
  },

  getNotePageById(id: string): NotePageRecord | undefined {
    return memoryState.notePages[id];
  },

  upsertNotePage(record: NotePageRecord): void {
    memoryState.notePages[record.id] = { ...record };
    persistWebStateToStorage();
  },

  updateNotePage(id: string, patch: Partial<NotePageRecord>): void {
    const existing = memoryState.notePages[id];
    if (!existing) return;
    memoryState.notePages[id] = { ...existing, ...patch };
    persistWebStateToStorage();
  },

  getSyncMeta(key: string): string | null {
    return memoryState.syncMeta[key] ?? null;
  },

  setSyncMeta(key: string, value: string): void {
    memoryState.syncMeta[key] = value;
    persistWebStateToStorage();
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
      if (!localRow || remoteTask.updatedAt >= localRow.updatedAt) {
        memoryState.tasks[remoteTask.id] = { ...remoteTask, isDirty: false };
      }
    }
    for (const remoteHabit of response.changes.habits ?? []) {
      const localRow = memoryState.habits[remoteHabit.id];
      if (!localRow || remoteHabit.updatedAt >= localRow.updatedAt) {
        memoryState.habits[remoteHabit.id] = normalizeHabitRecord({
          ...remoteHabit,
          isDirty: false,
        });
      }
    }
    for (const remoteLog of response.changes.habitLogs ?? []) {
      const localRow = memoryState.habitLogs[remoteLog.id];
      if (!localRow || remoteLog.updatedAt >= localRow.updatedAt) {
        memoryState.habitLogs[remoteLog.id] = normalizeHabitLogRecord({
          ...remoteLog,
          isDirty: false,
        });
      }
    }
    for (const remoteReward of response.changes.habitRewards ?? []) {
      const localRow = memoryState.habitRewards[remoteReward.id];
      if (!localRow || remoteReward.updatedAt >= localRow.updatedAt) {
        memoryState.habitRewards[remoteReward.id] = {
          ...remoteReward,
          isDirty: false,
        };
      }
    }
    for (const remoteBlock of response.changes.workBlocks ?? []) {
      const localRow = memoryState.workBlocks[remoteBlock.id];
      if (!localRow || remoteBlock.updatedAt >= localRow.updatedAt) {
        memoryState.workBlocks[remoteBlock.id] = { ...remoteBlock, isDirty: false };
      }
    }
    for (const remoteNote of response.changes.notePages ?? []) {
      const localRow = memoryState.notePages[remoteNote.id];
      if (!localRow || remoteNote.updatedAt >= localRow.updatedAt) {
        memoryState.notePages[remoteNote.id] = { ...remoteNote, isDirty: false };
      }
    }

    memoryState.syncMeta['cloudflare_d1_last_synced_at'] = String(response.serverTimestamp);
    persistWebStateToStorage();
  },

  claimLocalRecordsForUser(authenticatedUserId: string): void {
    if (!authenticatedUserId || authenticatedUserId === 'local-user') {
      return;
    }

    for (const task of Object.values(memoryState.tasks)) {
      if (task.userId === 'local-user') {
        task.userId = authenticatedUserId;
        task.isDirty = true;
      }
    }
    for (const habit of Object.values(memoryState.habits)) {
      if (habit.userId === 'local-user') {
        habit.userId = authenticatedUserId;
        habit.isDirty = true;
      }
    }
    for (const log of Object.values(memoryState.habitLogs)) {
      if (log.userId === 'local-user') {
        log.userId = authenticatedUserId;
        log.isDirty = true;
      }
    }
    for (const reward of Object.values(memoryState.habitRewards)) {
      if (reward.userId === 'local-user') {
        reward.userId = authenticatedUserId;
        reward.isDirty = true;
      }
    }
    for (const block of Object.values(memoryState.workBlocks)) {
      if (block.userId === 'local-user') {
        block.userId = authenticatedUserId;
        block.isDirty = true;
      }
    }
    for (const page of Object.values(memoryState.notePages)) {
      if (page.userId === 'local-user') {
        page.userId = authenticatedUserId;
        page.isDirty = true;
      }
    }
    persistWebStateToStorage();
  },
};

let isInitialized = false;

export function initializeLocalDatabase(defaultUserId = 'local-user'): void {
  if (isInitialized) {
    return;
  }

  loadWebStateFromStorage();

  if (!localStore.getSyncMeta('initial_seed_v1')) {
    const seed = buildInitialSeedDataset(defaultUserId);
    for (const item of seed.habits) memoryState.habits[item.id] = item;
    for (const item of seed.habitLogs) memoryState.habitLogs[item.id] = item;
    for (const item of seed.habitRewards) memoryState.habitRewards[item.id] = item;
    for (const item of seed.tasks) memoryState.tasks[item.id] = item;
    for (const item of seed.workBlocks) memoryState.workBlocks[item.id] = item;
    for (const item of seed.notePages) memoryState.notePages[item.id] = item;
    memoryState.syncMeta['initial_seed_v1'] = 'completed';
    memoryState.syncMeta['initial_rewards_v2'] = 'completed';
    persistWebStateToStorage();
  } else if (!localStore.getSyncMeta('initial_rewards_v2')) {
    if (Object.keys(memoryState.habitRewards).length === 0) {
      const defaults = buildDefaultRewardsSeed(defaultUserId);
      for (const reward of defaults) memoryState.habitRewards[reward.id] = reward;
    }
    memoryState.syncMeta['initial_rewards_v2'] = 'completed';
    persistWebStateToStorage();
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (event) => {
      if (event.key === DATABASE_NAME) {
        loadWebStateFromStorage();
        notifyDatabaseChanged();
      }
    });
  }

  isInitialized = true;
}
