-- Migración V4: Notas & Documentos (blocks_json, sort_order, enlaces Nota -> Tarea)
ALTER TABLE tasks ADD COLUMN source_page_id TEXT;
ALTER TABLE tasks ADD COLUMN source_block_id TEXT;
ALTER TABLE note_pages ADD COLUMN blocks_json TEXT;
ALTER TABLE note_pages ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_note_pages_parent ON note_pages(parent_id);
