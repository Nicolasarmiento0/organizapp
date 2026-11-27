-- Migración V6: Calendario v2 (Todo el día, alertas escalonadas, linked_task_id y plantillas de turnos)
ALTER TABLE work_blocks ADD COLUMN is_all_day INTEGER NOT NULL DEFAULT 0;
ALTER TABLE work_blocks ADD COLUMN alert_minutes_before INTEGER;
ALTER TABLE work_blocks ADD COLUMN notification_id TEXT;
ALTER TABLE work_blocks ADD COLUMN color TEXT;
ALTER TABLE work_blocks ADD COLUMN linked_task_id TEXT;

CREATE TABLE IF NOT EXISTS shift_templates (
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
);
CREATE INDEX IF NOT EXISTS idx_shift_templates_user_updated ON shift_templates(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_shift_templates_dirty ON shift_templates(is_dirty);
