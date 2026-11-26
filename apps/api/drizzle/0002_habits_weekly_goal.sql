-- Migración V3: Objetivo semanal opcional en hábitos
ALTER TABLE habits ADD COLUMN weekly_goal INTEGER;
