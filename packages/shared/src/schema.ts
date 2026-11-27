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
    isFlagged: integer('is_flagged', { mode: 'boolean' }).notNull().default(false),
    isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
    completedAt: integer('completed_at'),
    dueDate: text('due_date'), // Formato YYYY-MM-DD
    reminderAt: integer('reminder_at'), // Epoch ms para expo-notifications y Web Push
    notified: integer('notified', { mode: 'boolean' }).notNull().default(false),
    notificationId: text('notification_id'), // Identificador local de expo-notifications
    sourcePageId: text('source_page_id'), // Enlace opcional a la nota de origen (Paso 4)
    sourceBlockId: text('source_block_id'), // Bloque origen en la nota (Paso 4)
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(true),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_tasks_user_updated').on(table.userId, table.updatedAt),
    index('idx_tasks_dirty').on(table.isDirty),
    index('idx_tasks_due_date').on(table.dueDate),
    index('idx_tasks_reminder_pending').on(
      table.reminderAt,
      table.notified,
      table.isCompleted,
      table.deletedAt
    ),
  ]
);

/**
 * ============================================================================
 * 3. FASE 1 / 4: HÁBITOS INTELIGENTES, RACHAS, ESCUDOS Y PREMIOS
 * ============================================================================
 */
export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'custom';
export type HabitType = 'binary' | 'quantitative';
export type HabitTimeOfDay = 'any' | 'morning' | 'afternoon' | 'evening';
export type HabitLogStatus = 'completed' | 'partial' | 'rest_shield' | 'paused';

export const habits = sqliteTable(
  'habits',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    icon: text('icon').notNull().default('Sparkles'),
    habitType: text('habit_type').$type<HabitType>().notNull().default('binary'),
    unit: text('unit'),
    frequency: text('frequency').$type<HabitFrequency>().notNull().default('daily'),
    scheduledDays: text('scheduled_days').notNull().default('[0,1,2,3,4,5,6]'),
    targetPerDay: integer('target_per_day').notNull().default(1),
    weeklyGoal: integer('weekly_goal'), // Opcional: 1..7 veces por semana
    streak: integer('streak').notNull().default(0),
    bestStreak: integer('best_streak').notNull().default(0),
    isPaused: integer('is_paused', { mode: 'boolean' }).notNull().default(false),
    pausedUntil: text('paused_until'), // YYYY-MM-DD o null (indefinido)
    timeOfDay: text('time_of_day').$type<HabitTimeOfDay>().notNull().default('any'),
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
    status: text('status').$type<HabitLogStatus>().notNull().default('completed'),
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(true),
    deletedAt: integer('deleted_at'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_habit_logs_date').on(table.dateKey, table.habitId),
    index('idx_habit_logs_dirty').on(table.isDirty),
  ]
);

export const habitRewards = sqliteTable(
  'habit_rewards',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    costPoints: integer('cost_points').notNull().default(250),
    icon: text('icon').notNull().default('Award'),
    redeemedCount: integer('redeemed_count').notNull().default(0),
    lastRedeemedAt: integer('last_redeemed_at'),
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(true),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_habit_rewards_user_updated').on(table.userId, table.updatedAt),
    index('idx_habit_rewards_dirty').on(table.isDirty),
  ]
);

/**
 * ============================================================================
 * 4. FASE 2: CALENDARIO VISUAL & HORARIOS DE TRABAJO (Time-Blocking)
 * ============================================================================
 */
export type WorkBlockType = 'work_shift' | 'deep_work' | 'meeting' | 'break' | 'personal';
export type WorkBlockAlertMinutes = 0 | 15 | 60;

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
    isAllDay: integer('is_all_day', { mode: 'boolean' }).notNull().default(false),
    alertMinutesBefore: integer('alert_minutes_before'), // null | 0 | 15 | 60
    notificationId: text('notification_id'),
    color: text('color'),
    linkedTaskId: text('linked_task_id'),
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
 * 4b. PLANTILLAS DE TURNOS DE TRABAJO (1-Tap Shift Painter)
 * ============================================================================
 */
export const shiftTemplates = sqliteTable(
  'shift_templates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    startTime: text('start_time').notNull(), // HH:mm
    endTime: text('end_time').notNull(), // HH:mm
    color: text('color').notNull().default('#7C3AED'),
    alertMinutesBefore: integer('alert_minutes_before'), // null | 0 | 15 | 60
    locationOrLink: text('location_or_link'),
    sortOrder: integer('sort_order').notNull().default(0),
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(true),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_shift_templates_user_updated').on(table.userId, table.updatedAt),
    index('idx_shift_templates_dirty').on(table.isDirty),
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
    blocksJson: text('blocks_json'),
    tags: text('tags').notNull().default('[]'),
    isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    isDirty: integer('is_dirty', { mode: 'boolean' }).notNull().default(true),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_note_pages_user_updated').on(table.userId, table.updatedAt),
    index('idx_note_pages_dirty').on(table.isDirty),
    index('idx_note_pages_parent').on(table.parentId),
  ]
);

/**
 * ============================================================================
 * 5b. SUSCRIPCIONES WEB PUSH (VAPID Zero-Cost en Cloudflare D1)
 * ============================================================================
 */
export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('idx_push_subscriptions_user_id').on(table.userId)]
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

export type PushSubscriptionRecord = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscriptionRecord = typeof pushSubscriptions.$inferInsert;

export type HabitRecord = typeof habits.$inferSelect;
export type NewHabitRecord = typeof habits.$inferInsert;

export type HabitLogRecord = typeof habitLogs.$inferSelect;
export type NewHabitLogRecord = typeof habitLogs.$inferInsert;

export type HabitRewardRecord = typeof habitRewards.$inferSelect;
export type NewHabitRewardRecord = typeof habitRewards.$inferInsert;

export type WorkBlockRecord = typeof workBlocks.$inferSelect;
export type NewWorkBlockRecord = typeof workBlocks.$inferInsert;

export type ShiftTemplateRecord = typeof shiftTemplates.$inferSelect;
export type NewShiftTemplateRecord = typeof shiftTemplates.$inferInsert;

export type NotePageRecord = typeof notePages.$inferSelect;
export type NewNotePageRecord = typeof notePages.$inferInsert;

export interface SyncChangeset {
  tasks: TaskRecord[];
  habits: HabitRecord[];
  habitLogs: HabitLogRecord[];
  habitRewards: HabitRewardRecord[];
  workBlocks: WorkBlockRecord[];
  shiftTemplates: ShiftTemplateRecord[];
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
    is_flagged INTEGER NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    due_date TEXT,
    reminder_at INTEGER,
    notified INTEGER NOT NULL DEFAULT 0,
    notification_id TEXT,
    source_page_id TEXT,
    source_block_id TEXT,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_user_updated ON tasks(user_id, updated_at);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_dirty ON tasks(is_dirty);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_reminder_pending ON tasks(reminder_at, notified, is_completed, deleted_at);`,

  `CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'Sparkles',
    habit_type TEXT NOT NULL DEFAULT 'binary',
    unit TEXT,
    frequency TEXT NOT NULL DEFAULT 'daily',
    scheduled_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
    target_per_day INTEGER NOT NULL DEFAULT 1,
    weekly_goal INTEGER,
    streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    is_paused INTEGER NOT NULL DEFAULT 0,
    paused_until TEXT,
    time_of_day TEXT NOT NULL DEFAULT 'any',
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
    status TEXT NOT NULL DEFAULT 'completed',
    is_dirty INTEGER NOT NULL DEFAULT 1,
    deleted_at INTEGER,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date_key, habit_id);`,
  `CREATE INDEX IF NOT EXISTS idx_habit_logs_dirty ON habit_logs(is_dirty);`,

  `CREATE TABLE IF NOT EXISTS habit_rewards (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cost_points INTEGER NOT NULL DEFAULT 250,
    icon TEXT NOT NULL DEFAULT 'Award',
    redeemed_count INTEGER NOT NULL DEFAULT 0,
    last_redeemed_at INTEGER,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_habit_rewards_user_updated ON habit_rewards(user_id, updated_at);`,
  `CREATE INDEX IF NOT EXISTS idx_habit_rewards_dirty ON habit_rewards(is_dirty);`,

  `CREATE TABLE IF NOT EXISTS work_blocks (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    block_type TEXT NOT NULL DEFAULT 'deep_work',
    date_key TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_all_day INTEGER NOT NULL DEFAULT 0,
    alert_minutes_before INTEGER,
    notification_id TEXT,
    color TEXT,
    linked_task_id TEXT,
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

  `CREATE TABLE IF NOT EXISTS shift_templates (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#7C3AED',
    alert_minutes_before INTEGER,
    location_or_link TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_shift_templates_user_updated ON shift_templates(user_id, updated_at);`,
  `CREATE INDEX IF NOT EXISTS idx_shift_templates_dirty ON shift_templates(is_dirty);`,

  `CREATE TABLE IF NOT EXISTS note_pages (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    parent_id TEXT,
    title TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'FileText',
    content_markdown TEXT NOT NULL DEFAULT '',
    blocks_json TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    is_pinned INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_note_pages_user_updated ON note_pages(user_id, updated_at);`,
  `CREATE INDEX IF NOT EXISTS idx_note_pages_dirty ON note_pages(is_dirty);`,
  `CREATE INDEX IF NOT EXISTS idx_note_pages_parent ON note_pages(parent_id);`,

  `CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
];

/**
 * Sentencias de migración incremental V2 para bases `expo-sqlite` existentes.
 * Cada sentencia se ejecuta dentro de un `try/catch` individual (idempotente).
 */
export const LOCAL_SQLITE_MIGRATION_V2_SQL: readonly string[] = [
  `ALTER TABLE habits ADD COLUMN habit_type TEXT NOT NULL DEFAULT 'binary';`,
  `ALTER TABLE habits ADD COLUMN unit TEXT;`,
  `ALTER TABLE habits ADD COLUMN scheduled_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]';`,
  `ALTER TABLE habits ADD COLUMN best_streak INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE habits ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE habits ADD COLUMN paused_until TEXT;`,
  `ALTER TABLE habits ADD COLUMN time_of_day TEXT NOT NULL DEFAULT 'any';`,
  `ALTER TABLE habit_logs ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';`,
  `CREATE TABLE IF NOT EXISTS habit_rewards (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cost_points INTEGER NOT NULL DEFAULT 250,
    icon TEXT NOT NULL DEFAULT 'Award',
    redeemed_count INTEGER NOT NULL DEFAULT 0,
    last_redeemed_at INTEGER,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_habit_rewards_user_updated ON habit_rewards(user_id, updated_at);`,
  `CREATE INDEX IF NOT EXISTS idx_habit_rewards_dirty ON habit_rewards(is_dirty);`,
];

/**
 * Sentencias de migración incremental V3 (Objetivo semanal opcional en hábitos).
 */
export const LOCAL_SQLITE_MIGRATION_V3_SQL: readonly string[] = [
  `ALTER TABLE habits ADD COLUMN weekly_goal INTEGER;`,
];

/**
 * Sentencias de migración incremental V4 (Notas Notion + Obsidian: blocksJson, orden, enlaces Nota->Tarea).
 */
export const LOCAL_SQLITE_MIGRATION_V4_SQL: readonly string[] = [
  `ALTER TABLE tasks ADD COLUMN source_page_id TEXT;`,
  `ALTER TABLE tasks ADD COLUMN source_block_id TEXT;`,
  `ALTER TABLE note_pages ADD COLUMN blocks_json TEXT;`,
  `ALTER TABLE note_pages ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;`,
  `CREATE INDEX IF NOT EXISTS idx_note_pages_parent ON note_pages(parent_id);`,
];

/**
 * Sentencias de migración incremental V5 (Recordatorios: bandera is_flagged y estado notified).
 */
export const LOCAL_SQLITE_MIGRATION_V5_SQL: readonly string[] = [
  `ALTER TABLE tasks ADD COLUMN is_flagged INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE tasks ADD COLUMN notified INTEGER NOT NULL DEFAULT 0;`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_reminder_pending ON tasks(reminder_at, notified, is_completed, deleted_at);`,
];

/**
 * Sentencias de migración incremental V6 (Calendario v2: todo el día, alertas escalonadas, linkedTaskId y plantillas de turnos).
 */
export const LOCAL_SQLITE_MIGRATION_V6_SQL: readonly string[] = [
  `ALTER TABLE work_blocks ADD COLUMN is_all_day INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE work_blocks ADD COLUMN alert_minutes_before INTEGER;`,
  `ALTER TABLE work_blocks ADD COLUMN notification_id TEXT;`,
  `ALTER TABLE work_blocks ADD COLUMN color TEXT;`,
  `ALTER TABLE work_blocks ADD COLUMN linked_task_id TEXT;`,
  `CREATE TABLE IF NOT EXISTS shift_templates (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#7C3AED',
    alert_minutes_before INTEGER,
    location_or_link TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_shift_templates_user_updated ON shift_templates(user_id, updated_at);`,
  `CREATE INDEX IF NOT EXISTS idx_shift_templates_dirty ON shift_templates(is_dirty);`,
];
