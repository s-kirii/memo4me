ALTER TABLE tasks
ADD COLUMN workflow_stage TEXT NOT NULL DEFAULT 'open'
CHECK (workflow_stage IN ('open', 'in_progress'));
