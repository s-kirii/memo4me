CREATE TABLE ai_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_provider TEXT NOT NULL DEFAULT 'openai_compatible',
  updated_at TEXT NOT NULL
);

INSERT INTO ai_settings (id, active_provider, updated_at)
VALUES (1, 'openai_compatible', CURRENT_TIMESTAMP);

CREATE TABLE ai_provider_configs (
  provider TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  secret_storage TEXT NOT NULL DEFAULT '',
  secret_ref TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
