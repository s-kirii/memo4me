ALTER TABLE ai_provider_configs
ADD COLUMN api_compatibility_mode TEXT NOT NULL DEFAULT 'auto';
