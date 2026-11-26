import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { and, asc, desc, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import * as schema from '@organiza/shared/schema';
import {
  LOCAL_SQLITE_BOOTSTRAP_SQL,
  LOCAL_SQLITE_MIGRATION_V2_SQL,
  LOCAL_SQLITE_MIGRATION_V3_SQL,
  LOCAL_SQLITE_MIGRATION_V4_SQL,
  tasks,
  habits,
  habitLogs,
  habitRewards,
  workBlocks,
  notePages,
  syncMeta,
  type TaskRecord,
  type HabitRecord,
  type HabitLogRecord,
  type HabitRewardRecord,
  type WorkBlockRecord,
  type NotePageRecord,
  type SyncChangeset,
  type SyncBatchResponse,
} from '@organiza/shared/schema';
import {
  buildDefaultRewardsSeed,
  buildInitialSeedDataset,
  createLocalId,
  extractPlainTextFromBlocksJson,
  getTodayDateKey,
  normalizeSearchText,
  notifyDatabaseChanged,
  parseTagsText,
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

export const DATABASE_NAME = 'organiza_local.db';

/**
 * Instancia nativa síncrona de Expo SQLite para iOS y Android (0 ms en modo WAL)
 */
export const expoSqliteDb = openDatabaseSync(DATABASE_NAME, {
  enableChangeListener: true,
});

export const db = drizzle(expoSqliteDb, { schema });

let isFtsReady = false;

function syncNotePageFts(record: NotePageRecord | undefined): void {
  if (!isFtsReady || !record) return;
  try {
    expoSqliteDb.runSync('DELETE FROM note_pages_fts WHERE page_id = ?;', [record.id]);
    if (!record.deletedAt) {
      const body = [
        record.contentMarkdown ?? '',
        extractPlainTextFromBlocksJson(record.blocksJson),
      ]
        .filter(Boolean)
        .join('\n');
      expoSqliteDb.runSync(
        'INSERT INTO note_pages_fts(page_id, title, tags, body) VALUES (?, ?, ?, ?);',
        [record.id, record.title ?? '', parseTagsText(record.tags), body]
      );
    }
  } catch {
    // FTS sync no bloquea el guardado instantáneo
  }
}

function buildFtsMatchQuery(rawQuery: string): string | null {
  const cleaned = normalizeSearchText(rawQuery)
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim();
  if (!cleaned) return null;
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.map((tok) => `"${tok.replace(/"/g, '')}"*`).join(' AND ');
}

export const localStore: LocalDatabaseEngine = {
  getTasks(): TaskRecord[] {
    return db
      .select()
      .from(tasks)
      .where(isNull(tasks.deletedAt))
      .orderBy(desc(tasks.priority), desc(tasks.createdAt))
      .all();
  },

  getTaskById(id: string): TaskRecord | undefined {
    return db.select().from(tasks).where(eq(tasks.id, id)).get();
  },

  upsertTask(record: TaskRecord): void {
    db.insert(tasks)
      .values(record)
      .onConflictDoUpdate({ target: tasks.id, set: record })
      .run();
  },

  updateTask(id: string, patch: Partial<TaskRecord>): void {
    db.update(tasks).set(patch).where(eq(tasks.id, id)).run();
  },

  getHabits(): HabitRecord[] {
    return db
      .select()
      .from(habits)
      .where(and(isNull(habits.deletedAt), eq(habits.isArchived, false)))
      .orderBy(desc(habits.streak), desc(habits.createdAt))
      .all();
  },

  getHabitById(id: string): HabitRecord | undefined {
    return db.select().from(habits).where(eq(habits.id, id)).get();
  },

  upsertHabit(record: HabitRecord): void {
    db.insert(habits)
      .values(record)
      .onConflictDoUpdate({ target: habits.id, set: record })
      .run();
  },

  updateHabit(id: string, patch: Partial<HabitRecord>): void {
    db.update(habits).set(patch).where(eq(habits.id, id)).run();
  },

  getHabitLogsForDate(dateKey: string): HabitLogRecord[] {
    return db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.dateKey, dateKey), isNull(habitLogs.deletedAt)))
      .all();
  },

  getHabitLogsInRange(startDateKey: string, endDateKey: string): HabitLogRecord[] {
    return db
      .select()
      .from(habitLogs)
      .where(
        and(
          gte(habitLogs.dateKey, startDateKey),
          lte(habitLogs.dateKey, endDateKey),
          isNull(habitLogs.deletedAt)
        )
      )
      .all();
  },

  getAllHabitLogs(): HabitLogRecord[] {
    return db
      .select()
      .from(habitLogs)
      .where(isNull(habitLogs.deletedAt))
      .all();
  },

  getHabitLogById(id: string): HabitLogRecord | undefined {
    return db.select().from(habitLogs).where(eq(habitLogs.id, id)).get();
  },

  upsertHabitLog(record: HabitLogRecord): void {
    db.insert(habitLogs)
      .values(record)
      .onConflictDoUpdate({ target: habitLogs.id, set: record })
      .run();
  },

  getHabitRewards(): HabitRewardRecord[] {
    return db
      .select()
      .from(habitRewards)
      .where(isNull(habitRewards.deletedAt))
      .orderBy(asc(habitRewards.costPoints), desc(habitRewards.createdAt))
      .all();
  },

  getHabitRewardById(id: string): HabitRewardRecord | undefined {
    return db.select().from(habitRewards).where(eq(habitRewards.id, id)).get();
  },

  upsertHabitReward(record: HabitRewardRecord): void {
    db.insert(habitRewards)
      .values(record)
      .onConflictDoUpdate({ target: habitRewards.id, set: record })
      .run();
  },

  updateHabitReward(id: string, patch: Partial<HabitRewardRecord>): void {
    db.update(habitRewards).set(patch).where(eq(habitRewards.id, id)).run();
  },

  getWorkBlocksForDate(dateKey: string): WorkBlockRecord[] {
    const exactRows = db
      .select()
      .from(workBlocks)
      .where(and(isNull(workBlocks.deletedAt), eq(workBlocks.dateKey, dateKey)))
      .orderBy(asc(workBlocks.startTime))
      .all();

    if (exactRows.length > 0) {
      return exactRows;
    }

    return db
      .select()
      .from(workBlocks)
      .where(and(isNull(workBlocks.deletedAt), eq(workBlocks.isRecurring, true)))
      .orderBy(asc(workBlocks.startTime))
      .all();
  },

  getWorkBlockById(id: string): WorkBlockRecord | undefined {
    return db.select().from(workBlocks).where(eq(workBlocks.id, id)).get();
  },

  upsertWorkBlock(record: WorkBlockRecord): void {
    db.insert(workBlocks)
      .values(record)
      .onConflictDoUpdate({ target: workBlocks.id, set: record })
      .run();
  },

  updateWorkBlock(id: string, patch: Partial<WorkBlockRecord>): void {
    db.update(workBlocks).set(patch).where(eq(workBlocks.id, id)).run();
  },

  getNotePages(): NotePageRecord[] {
    return db
      .select()
      .from(notePages)
      .where(isNull(notePages.deletedAt))
      .orderBy(desc(notePages.isPinned), asc(notePages.sortOrder), desc(notePages.updatedAt))
      .all();
  },

  getDeletedNotePages(): NotePageRecord[] {
    return db
      .select()
      .from(notePages)
      .where(isNotNull(notePages.deletedAt))
      .orderBy(desc(notePages.deletedAt))
      .all();
  },

  getNotePageById(id: string): NotePageRecord | undefined {
    return db.select().from(notePages).where(eq(notePages.id, id)).get();
  },

  searchNotePages(query: string, limit = 20): NotePageRecord[] {
    const ftsQuery = buildFtsMatchQuery(query);
    if (!ftsQuery) {
      return this.getNotePages().slice(0, limit);
    }

    if (isFtsReady) {
      try {
        const rows = expoSqliteDb.getAllSync<{ page_id: string }>(
          'SELECT page_id FROM note_pages_fts WHERE note_pages_fts MATCH ? ORDER BY bm25(note_pages_fts, 10.0, 4.0, 1.0) LIMIT ?;',
          [ftsQuery, limit]
        );
        if (rows.length > 0) {
          const allActive = new Map(this.getNotePages().map((p) => [p.id, p]));
          const ordered: NotePageRecord[] = [];
          for (const row of rows) {
            const match = allActive.get(row.page_id);
            if (match) ordered.push(match);
          }
          if (ordered.length > 0) return ordered;
        }
      } catch {
        // Fallback automático a búsqueda normalizada en memoria
      }
    }

    return rankNotePagesInMemory(this.getNotePages(), query, limit);
  },

  upsertNotePage(record: NotePageRecord): void {
    db.insert(notePages)
      .values(record)
      .onConflictDoUpdate({ target: notePages.id, set: record })
      .run();
    syncNotePageFts(record);
  },

  updateNotePage(id: string, patch: Partial<NotePageRecord>): void {
    db.update(notePages).set(patch).where(eq(notePages.id, id)).run();
    syncNotePageFts(this.getNotePageById(id));
  },

  getSyncMeta(key: string): string | null {
    const row = db.select().from(syncMeta).where(eq(syncMeta.key, key)).get();
    return row?.value ?? null;
  },

  setSyncMeta(key: string, value: string): void {
    const now = Date.now();
    db.insert(syncMeta)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: syncMeta.key,
        set: { value, updatedAt: now },
      })
      .run();
  },

  getDirtyChangeset(): SyncChangeset {
    return {
      tasks: db.select().from(tasks).where(eq(tasks.isDirty, true)).all(),
      habits: db.select().from(habits).where(eq(habits.isDirty, true)).all(),
      habitLogs: db.select().from(habitLogs).where(eq(habitLogs.isDirty, true)).all(),
      habitRewards: db
        .select()
        .from(habitRewards)
        .where(eq(habitRewards.isDirty, true))
        .all(),
      workBlocks: db.select().from(workBlocks).where(eq(workBlocks.isDirty, true)).all(),
      notePages: db.select().from(notePages).where(eq(notePages.isDirty, true)).all(),
    };
  },

  countDirtyRecords(): number {
    try {
      const dirty = this.getDirtyChangeset();
      return (
        dirty.tasks.length +
        dirty.habits.length +
        dirty.habitLogs.length +
        dirty.habitRewards.length +
        dirty.workBlocks.length +
        dirty.notePages.length
      );
    } catch {
      return 0;
    }
  },

  applySyncBatchResponse(sent: SyncChangeset, response: SyncBatchResponse): void {
    expoSqliteDb.withTransactionSync(() => {
      for (const item of sent.tasks) {
        db.update(tasks)
          .set({ isDirty: false })
          .where(and(eq(tasks.id, item.id), eq(tasks.updatedAt, item.updatedAt)))
          .run();
      }
      for (const item of sent.habits) {
        db.update(habits)
          .set({ isDirty: false })
          .where(and(eq(habits.id, item.id), eq(habits.updatedAt, item.updatedAt)))
          .run();
      }
      for (const item of sent.habitLogs) {
        db.update(habitLogs)
          .set({ isDirty: false })
          .where(and(eq(habitLogs.id, item.id), eq(habitLogs.updatedAt, item.updatedAt)))
          .run();
      }
      for (const item of sent.habitRewards) {
        db.update(habitRewards)
          .set({ isDirty: false })
          .where(
            and(
              eq(habitRewards.id, item.id),
              eq(habitRewards.updatedAt, item.updatedAt)
            )
          )
          .run();
      }
      for (const item of sent.workBlocks) {
        db.update(workBlocks)
          .set({ isDirty: false })
          .where(and(eq(workBlocks.id, item.id), eq(workBlocks.updatedAt, item.updatedAt)))
          .run();
      }
      for (const item of sent.notePages) {
        db.update(notePages)
          .set({ isDirty: false })
          .where(and(eq(notePages.id, item.id), eq(notePages.updatedAt, item.updatedAt)))
          .run();
      }

      for (const remoteTask of response.changes.tasks ?? []) {
        const localRow = this.getTaskById(remoteTask.id);
        if (!localRow || remoteTask.updatedAt >= localRow.updatedAt) {
          this.upsertTask({ ...remoteTask, isDirty: false });
        }
      }

      for (const remoteHabit of response.changes.habits ?? []) {
        const localRow = this.getHabitById(remoteHabit.id);
        if (!localRow || remoteHabit.updatedAt >= localRow.updatedAt) {
          this.upsertHabit({ ...remoteHabit, isDirty: false });
        }
      }

      for (const remoteLog of response.changes.habitLogs ?? []) {
        const localRow = this.getHabitLogById(remoteLog.id);
        if (!localRow || remoteLog.updatedAt >= localRow.updatedAt) {
          this.upsertHabitLog({ ...remoteLog, isDirty: false });
        }
      }

      for (const remoteReward of response.changes.habitRewards ?? []) {
        const localRow = this.getHabitRewardById(remoteReward.id);
        if (!localRow || remoteReward.updatedAt >= localRow.updatedAt) {
          this.upsertHabitReward({ ...remoteReward, isDirty: false });
        }
      }

      for (const remoteBlock of response.changes.workBlocks ?? []) {
        const localRow = this.getWorkBlockById(remoteBlock.id);
        if (!localRow || remoteBlock.updatedAt >= localRow.updatedAt) {
          this.upsertWorkBlock({ ...remoteBlock, isDirty: false });
        }
      }

      for (const remoteNote of response.changes.notePages ?? []) {
        const localRow = this.getNotePageById(remoteNote.id);
        if (!localRow || remoteNote.updatedAt >= localRow.updatedAt) {
          this.upsertNotePage({ ...remoteNote, isDirty: false });
        }
      }

      this.setSyncMeta('cloudflare_d1_last_synced_at', String(response.serverTimestamp));
    });
  },

  claimLocalRecordsForUser(authenticatedUserId: string): void {
    if (!authenticatedUserId || authenticatedUserId === 'local-user') {
      return;
    }

    expoSqliteDb.withTransactionSync(() => {
      db.update(tasks)
        .set({ userId: authenticatedUserId, isDirty: true })
        .where(eq(tasks.userId, 'local-user'))
        .run();
      db.update(habits)
        .set({ userId: authenticatedUserId, isDirty: true })
        .where(eq(habits.userId, 'local-user'))
        .run();
      db.update(habitLogs)
        .set({ userId: authenticatedUserId, isDirty: true })
        .where(eq(habitLogs.userId, 'local-user'))
        .run();
      db.update(habitRewards)
        .set({ userId: authenticatedUserId, isDirty: true })
        .where(eq(habitRewards.userId, 'local-user'))
        .run();
      db.update(workBlocks)
        .set({ userId: authenticatedUserId, isDirty: true })
        .where(eq(workBlocks.userId, 'local-user'))
        .run();
      db.update(notePages)
        .set({ userId: authenticatedUserId, isDirty: true })
        .where(eq(notePages.userId, 'local-user'))
        .run();
    });
  },
};

let isInitialized = false;

export function initializeLocalDatabase(defaultUserId = 'local-user'): void {
  if (isInitialized) {
    return;
  }

  expoSqliteDb.execSync('PRAGMA journal_mode = WAL;');
  expoSqliteDb.execSync('PRAGMA synchronous = NORMAL;');
  expoSqliteDb.execSync('PRAGMA foreign_keys = ON;');

  for (const sqlStatement of LOCAL_SQLITE_BOOTSTRAP_SQL) {
    expoSqliteDb.execSync(sqlStatement);
  }

  // Migración idempotente V2/V3/V4 para bases locales existentes
  for (const migrationSql of [
    ...LOCAL_SQLITE_MIGRATION_V2_SQL,
    ...LOCAL_SQLITE_MIGRATION_V3_SQL,
    ...LOCAL_SQLITE_MIGRATION_V4_SQL,
  ]) {
    try {
      expoSqliteDb.execSync(migrationSql);
    } catch {
      // La columna o tabla ya existe
    }
  }

  // Tabla virtual SQLite FTS5 para búsqueda instantánea offline de notas
  try {
    expoSqliteDb.execSync(
      `CREATE VIRTUAL TABLE IF NOT EXISTS note_pages_fts USING fts5(page_id UNINDEXED, title, tags, body, tokenize='unicode61 remove_diacritics 2');`
    );
    isFtsReady = true;
  } catch {
    isFtsReady = false;
  }

  if (!localStore.getSyncMeta('initial_seed_v1')) {
    const seed = buildInitialSeedDataset(defaultUserId);
    expoSqliteDb.withTransactionSync(() => {
      for (const item of seed.habits) localStore.upsertHabit(item);
      for (const item of seed.habitLogs) localStore.upsertHabitLog(item);
      for (const item of seed.habitRewards) localStore.upsertHabitReward(item);
      for (const item of seed.tasks) localStore.upsertTask(item);
      for (const item of seed.workBlocks) localStore.upsertWorkBlock(item);
      for (const item of seed.notePages) localStore.upsertNotePage(item);
      localStore.setSyncMeta('initial_seed_v1', 'completed');
      localStore.setSyncMeta('initial_rewards_v2', 'completed');
    });
  } else if (!localStore.getSyncMeta('initial_rewards_v2')) {
    const existingRewards = localStore.getHabitRewards();
    if (existingRewards.length === 0) {
      const defaults = buildDefaultRewardsSeed(defaultUserId);
      expoSqliteDb.withTransactionSync(() => {
        for (const reward of defaults) localStore.upsertHabitReward(reward);
        localStore.setSyncMeta('initial_rewards_v2', 'completed');
      });
    } else {
      localStore.setSyncMeta('initial_rewards_v2', 'completed');
    }
  }

  if (isFtsReady) {
    try {
      const ftsCountRow = expoSqliteDb.getFirstSync<{ cnt: number }>(
        'SELECT count(*) AS cnt FROM note_pages_fts;'
      );
      const activeNotes = localStore.getNotePages();
      if ((ftsCountRow?.cnt ?? 0) === 0 && activeNotes.length > 0) {
        expoSqliteDb.withTransactionSync(() => {
          for (const page of activeNotes) syncNotePageFts(page);
        });
      }
    } catch {
      // Ignorar si FTS backfill falla
    }
  }

  isInitialized = true;
}
