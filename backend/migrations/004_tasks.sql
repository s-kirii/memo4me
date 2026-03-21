CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'done')),
  source_note_id TEXT,
  source_selection_text TEXT,
  created_by TEXT NOT NULL CHECK (created_by IN ('manual', 'ai')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE SET NULL
);

CREATE INDEX idx_tasks_status_updated_at
  ON tasks(status, updated_at DESC);
