-- Migración Inicial D1 para organiza-app (Better Auth + Dominio Offline-First)

CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(user_id);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS tasks (
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
  is_dirty INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_updated ON tasks(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_dirty ON tasks(is_dirty);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Sparkles',
  frequency TEXT NOT NULL DEFAULT 'daily',
  target_per_day INTEGER NOT NULL DEFAULT 1,
  streak INTEGER NOT NULL DEFAULT 0,
  reminder_time TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  is_dirty INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_habits_user_updated ON habits(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_habits_dirty ON habits(is_dirty);

CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  habit_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date_key TEXT NOT NULL,
  completed_count INTEGER NOT NULL DEFAULT 1,
  is_completed INTEGER NOT NULL DEFAULT 1,
  is_dirty INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date_key, habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_dirty ON habit_logs(is_dirty);

CREATE TABLE IF NOT EXISTS work_blocks (
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
  is_dirty INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_work_blocks_date ON work_blocks(date_key, start_time);
CREATE INDEX IF NOT EXISTS idx_work_blocks_dirty ON work_blocks(is_dirty);

CREATE TABLE IF NOT EXISTS note_pages (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  parent_id TEXT,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'FileText',
  content_markdown TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_dirty INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_note_pages_user_updated ON note_pages(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_note_pages_dirty ON note_pages(is_dirty);
