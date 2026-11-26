-- Migración V2: Hábitos Inteligentes (cuantitativos, días programados, pausa, escudos y premios)

ALTER TABLE habits ADD COLUMN habit_type TEXT NOT NULL DEFAULT 'binary';
ALTER TABLE habits ADD COLUMN unit TEXT;
ALTER TABLE habits ADD COLUMN scheduled_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]';
ALTER TABLE habits ADD COLUMN best_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE habits ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0;
ALTER TABLE habits ADD COLUMN paused_until TEXT;
ALTER TABLE habits ADD COLUMN time_of_day TEXT NOT NULL DEFAULT 'any';

ALTER TABLE habit_logs ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';

CREATE TABLE IF NOT EXISTS habit_rewards (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cost_points INTEGER NOT NULL DEFAULT 250,
  icon TEXT NOT NULL DEFAULT 'Award',
  redeemed_count INTEGER NOT NULL DEFAULT 0,
  last_redeemed_at INTEGER,
  is_dirty INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_habit_rewards_user_updated ON habit_rewards(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_habit_rewards_dirty ON habit_rewards(is_dirty);
