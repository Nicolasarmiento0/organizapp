import * as Crypto from 'expo-crypto';
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

export function createLocalId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getTodayDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type DbListener = () => void;
const listeners = new Set<DbListener>();

export function subscribeDatabaseChanges(listener: DbListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyDatabaseChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function extractPlainTextFromBlocksJson(blocksJson?: string | null): string {
  if (!blocksJson) return '';
  try {
    const parsed = JSON.parse(blocksJson) as unknown;
    if (!Array.isArray(parsed)) return '';
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return '';
        const rec = item as Record<string, unknown>;
        const chunks: string[] = [];
        if (typeof rec.text === 'string') chunks.push(rec.text);
        if (typeof rec.content === 'string') chunks.push(rec.content);
        if (typeof rec.caption === 'string') chunks.push(rec.caption);
        return chunks.join(' ');
      })
      .filter(Boolean)
      .join('\n');
  } catch {
    return '';
  }
}

export function parseTagsText(tagsJson?: string | null): string {
  if (!tagsJson) return '';
  try {
    const parsed = JSON.parse(tagsJson) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === 'string').join(' ')
      : '';
  } catch {
    return '';
  }
}

export function rankNotePagesInMemory(
  pages: NotePageRecord[],
  rawQuery: string,
  limit = 20
): NotePageRecord[] {
  const normalizedQuery = normalizeSearchText(rawQuery);
  if (!normalizedQuery) {
    return pages.slice(0, limit);
  }
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return pages.slice(0, limit);
  }

  const scored: Array<{ page: NotePageRecord; score: number }> = [];
  for (const page of pages) {
    if (page.deletedAt) continue;
    const titleNorm = normalizeSearchText(page.title);
    const tagsNorm = normalizeSearchText(parseTagsText(page.tags));
    const bodyNorm = normalizeSearchText(
      `${page.contentMarkdown}\n${extractPlainTextFromBlocksJson(page.blocksJson)}`
    );

    const allMatch = tokens.every(
      (tok) =>
        titleNorm.includes(tok) || tagsNorm.includes(tok) || bodyNorm.includes(tok)
    );
    if (!allMatch) continue;

    let score = page.isPinned ? 8 : 0;
    if (titleNorm === normalizedQuery) score += 200;
    else if (titleNorm.startsWith(normalizedQuery)) score += 120;
    else if (titleNorm.includes(normalizedQuery)) score += 80;

    for (const tok of tokens) {
      if (titleNorm.includes(tok)) score += 30;
      if (tagsNorm.includes(tok)) score += 15;
      if (bodyNorm.includes(tok)) score += 5;
    }
    scored.push({ page, score });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return b.page.updatedAt - a.page.updatedAt;
  });

  return scored.slice(0, limit).map((entry) => entry.page);
}

export interface LocalDatabaseEngine {
  getActiveUserId(): string;
  getLastSyncedAt(): number;
  resetForUser(userId: string): void;
  clearAll(): void;
  replaceAllFromCloud(response: SyncBatchResponse): void;

  getTasks(): TaskRecord[];
  getTaskById(id: string): TaskRecord | undefined;
  upsertTask(record: TaskRecord): void;
  updateTask(id: string, patch: Partial<TaskRecord>): void;

  getHabits(): HabitRecord[];
  getHabitById(id: string): HabitRecord | undefined;
  upsertHabit(record: HabitRecord): void;
  updateHabit(id: string, patch: Partial<HabitRecord>): void;

  getHabitLogsForDate(dateKey: string): HabitLogRecord[];
  getHabitLogsInRange(startDateKey: string, endDateKey: string): HabitLogRecord[];
  getAllHabitLogs(): HabitLogRecord[];
  getHabitLogById(id: string): HabitLogRecord | undefined;
  upsertHabitLog(record: HabitLogRecord): void;

  getHabitRewards(): HabitRewardRecord[];
  getHabitRewardById(id: string): HabitRewardRecord | undefined;
  upsertHabitReward(record: HabitRewardRecord): void;
  updateHabitReward(id: string, patch: Partial<HabitRewardRecord>): void;

  getWorkBlocksForDate(dateKey: string): WorkBlockRecord[];
  getWorkBlockById(id: string): WorkBlockRecord | undefined;
  upsertWorkBlock(record: WorkBlockRecord): void;
  updateWorkBlock(id: string, patch: Partial<WorkBlockRecord>): void;

  getNotePages(): NotePageRecord[];
  getDeletedNotePages(): NotePageRecord[];
  getNotePageById(id: string): NotePageRecord | undefined;
  searchNotePages(query: string, limit?: number): NotePageRecord[];
  upsertNotePage(record: NotePageRecord): void;
  updateNotePage(id: string, patch: Partial<NotePageRecord>): void;

  getDirtyChangeset(): SyncChangeset;
  countDirtyRecords(): number;
  applySyncBatchResponse(sent: SyncChangeset, response: SyncBatchResponse): void;
}
