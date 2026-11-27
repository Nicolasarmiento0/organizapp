-- Migración V5: Recordatorios (is_flagged, notified) y Suscripciones Web Push
ALTER TABLE tasks ADD COLUMN is_flagged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN notified INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_pending ON tasks(reminder_at, notified, is_completed, deleted_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
