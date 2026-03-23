ALTER TABLE tasks
ADD COLUMN estimated_hours REAL;

ALTER TABLE tasks
ADD COLUMN progress_percent INTEGER NOT NULL DEFAULT 0
CHECK (progress_percent >= 0 AND progress_percent <= 100);

UPDATE tasks
SET progress_percent = CASE
  WHEN status = 'done' THEN 100
  WHEN workflow_stage = 'in_progress' THEN 50
  ELSE 0
END;

UPDATE tasks
SET is_today_task = 0
WHERE progress_percent = 100;
