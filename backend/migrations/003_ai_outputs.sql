CREATE TABLE ai_outputs (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  model TEXT NOT NULL,
  content_md TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_outputs_note_created_at
  ON ai_outputs(note_id, created_at DESC);
