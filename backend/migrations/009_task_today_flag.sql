ALTER TABLE tasks
ADD COLUMN is_today_task INTEGER NOT NULL DEFAULT 0 CHECK (is_today_task IN (0, 1));
