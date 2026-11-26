import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

/**
 * ============================================================================
 * 1. BETTER AUTH TABLES (Cloudflare D1 Edge Authentication - $0 Cost)
 * ============================================================================
 */
export const users = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const sessions = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [index('idx_session_user_id').on(table.userId)]
);

export const accounts = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('idx_account_user_id').on(table.userId)]
);

export const verifications = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
});

/**
 * ============================================================================
 * 2. FASE 1: TAREAS Y RECORDATORIOS (Cockpit "Hoy" + Apple Reminders Style)
 * ============================================================================
 */
export type TaskCategory = 'today' | 'reminder' | 'inbox' | 'work' | 'personal';
export type TaskPriority = 1 | 2 | 3; // 1 = Baja, 2 = Media, 3 = Alta

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    notes: text('notes'),
    category: text('category').$type<TaskCategory>().notNull().default('today'),
    priority: integer('priority').$type<TaskPriority>().notNull().default(2),
    isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
    completedAt: integer('completed_at'),
    dueDate: text('due_date'), // Formato YYYY-MM-DD
    reminderAt: integer('reminder_at'), // Epoch ms para expo-notifications
    notificationId: text('notification_id'), // Identificador local de expo-notifications
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(true),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_tasks_user_updated').on(table.userId, table.updatedAt),
    index('idx_tasks_dirty').on(table.isDirty),
    index('idx_tasks_due_date').on(table.dueDate),
  ]
);

/**
 * ============================================================================
 * 3. FASE 1: HÁBITOS Y REGISTRO DIARIO (Streak & Daily Tracking)
 * ============================================================================
 */
export type HabitFrequency = 'daily' | 'weekdays' | 'weekends';

export const habits = sqliteTable(
  'habits',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    icon: text('icon').notNull().default('Sparkles'),
    frequency: text('frequency').$type<HabitFrequency>().notNull().default('daily'),
    targetPerDay: integer('target_per_day').notNull().default(1),
    streak: integer('streak').notNull().default(0),
    reminderTime: text('reminder_time'), // Formato HH:mm
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(true),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_habits_user_updated').on(table.userId, table.updatedAt),
    index('idx_habits_dirty').on(table.isDirty),
  ]
);

export const habitLogs = sqliteTable(
  'habit_logs',
  {
    id: text('id').primaryKey(), // Determinístico: `${habitId}_${dateKey}` o UUID
    habitId: text('habit_id').notNull(),
    userId: text('user_id').notNull(),
    dateKey: text('date_key').notNull(), // YYYY-MM-DD
    completedCount: integer('completed_count').notNull().default(1),
    isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(true),
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(true),
    deletedAt: integer('deleted_at'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_habit_logs_date').on(table.dateKey, table.habitId),
    index('idx_habit_logs_dirty').on(table.isDirty),
  ]
);

/**
 * ============================================================================
 * 4. FASE 2: CALENDARIO VISUAL & HORARIOS DE TRABAJO (Time-Blocking)
 * ============================================================================
 */
export type WorkBlockType = 'work_shift' | 'deep_work' | 'meeting' | 'break' | 'personal';

export const workBlocks = sqliteTable(
  'work_blocks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    blockType: text('block_type').$type<WorkBlockType>().notNull().default('deep_work'),
    dateKey: text('date_key').notNull(), // YYYY-MM-DD
    startTime: text('start_time').notNull(), // HH:mm
    endTime: text('end_time').notNull(), // HH:mm
    locationOrLink: text('location_or_link'),
    isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull().default(false),
    recurrenceDays: text('recurrence_days'), // JSON array de días [1,2,3,4,5]
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(true),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_work_blocks_date').on(table.dateKey, table.startTime),
    index('idx_work_blocks_dirty').on(table.isDirty),
  ]
);

/**
 * ============================================================================
 * 5. FASE 2: NOTAS ESTILO NOTION & BLOC MARKDOWN
 * ============================================================================
 */
export const notePages = sqliteTable(
  'note_pages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    parentId: text('parent_id'),
    title: text('title').notNull(),
    icon: text('icon').notNull().default('FileText'),
    contentMarkdown: text('content_markdown').notNull().default(''),
    tags: text('tags').notNull().default('[]'),
    isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(true),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_note_pages_user_updated').on(table.userId, table.updatedAt),
    index('idx_note_pages_dirty').on(table.isDirty),
  ]
);

/**
 * ============================================================================
 * 6. METADATOS LOCALES DE SINCRONIZACIÓN (Expo SQLite Local Engine)
 * ============================================================================
 */
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * ============================================================================
 * 7. TIPOS INFERIDOS Y CONTRATOS DE SINCRONIZACIÓN BATCH (PUSH / PULL)
 * ============================================================================
 */
export type TaskRecord = typeof tasks.$inferSelect;
export type NewTaskRecord = typeof tasks.$inferInsert;

export type HabitRecord = typeof habits.$inferSelect;
export type NewHabitRecord = typeof habits.$inferInsert;

export type HabitLogRecord = typeof habitLogs.$inferSelect;
export type NewHabitLogRecord = typeof habitLogs.$inferInsert;

export type WorkBlockRecord = typeof workBlocks.$inferSelect;
export type NewWorkBlockRecord = typeof workBlocks.$inferInsert;

export type NotePageRecord = typeof notePages.$inferSelect;
export type NewNotePageRecord = typeof notePages.$inferInsert;

export interface SyncChangeset {
  tasks: TaskRecord[];
  habits: HabitRecord[];
  habitLogs: HabitLogRecord[];
  workBlocks: WorkBlockRecord[];
  notePages: NotePageRecord[];
}

export interface SyncPushRequest {
  lastSyncedAt: number;
  changes: Partial<SyncChangeset>;
}

export interface SyncBatchResponse {
  ok: boolean;
  serverTimestamp: number;
  acceptedCount: number;
  changes: SyncChangeset;
}

/**
 * Sentencias DDL idempotentes para inicializar `expo-sqlite` en 0 ms al arrancar la app
 * y para migraciones rápidas en Cloudflare D1.
 */
export const LOCAL_SQLITE_BOOTSTRAP_SQL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    category TEXT NOT NULL DEFAULT 'today',
    priority INTEGER NOT NULL DEFAULT 2,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    due_date TEXT,
    reminder_at INTEGER,
    notification_id TEXT,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_user_updated ON tasks(user_id, updated_at);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_dirty ON tasks(is_dirty);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);`,

  `CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'Sparkles',
    frequency TEXT NOT NULL DEFAULT 'daily',
    target_per_day INTEGER NOT NULL DEFAULT 1,
    streak INTEGER NOT NULL DEFAULT 0,
    reminder_time TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_habits_user_updated ON habits(user_id, updated_at);`,
  `CREATE INDEX IF NOT EXISTS idx_habits_dirty ON habits(is_dirty);`,

  `CREATE TABLE IF NOT EXISTS habit_logs (
    id TEXT PRIMARY KEY NOT NULL,
    habit_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date_key TEXT NOT NULL,
    completed_count INTEGER NOT NULL DEFAULT 1,
    is_completed INTEGER NOT NULL DEFAULT 1,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    deleted_at INTEGER,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date_key, habit_id);`,
  `CREATE INDEX IF NOT EXISTS idx_habit_logs_dirty ON habit_logs(is_dirty);`,

  `CREATE TABLE IF NOT EXISTS work_blocks (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    block_type TEXT NOT NULL DEFAULT 'deep_work',
    date_key TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location_or_link TEXT,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_days TEXT,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_work_blocks_date ON work_blocks(date_key, start_time);`,
  `CREATE INDEX IF NOT EXISTS idx_work_blocks_dirty ON work_blocks(is_dirty);`,

  `CREATE TABLE IF NOT EXISTS note_pages (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    parent_id TEXT,
    title TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'FileText',
    content_markdown TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    is_pinned INTEGER NOT NULL DEFAULT 0,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_note_pages_user_updated ON note_pages(user_id, updated_at);`,
  `CREATE INDEX IF NOT EXISTS idx_note_pages_dirty ON note_pages(is_dirty);`,

  `CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
];
