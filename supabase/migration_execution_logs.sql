-- Migration: Add execution_logs column to workflows table
-- Run this in your Supabase SQL Editor

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS execution_logs jsonb DEFAULT '[]'::jsonb;

-- Optional index for faster queries if you later filter by run ID
CREATE INDEX IF NOT EXISTS idx_workflows_execution_logs
  ON workflows USING gin(execution_logs);

-- Optional: set a comment so the column is self-documenting
COMMENT ON COLUMN workflows.execution_logs IS
  'Stores the last 20 workflow run records as JSONB. Each record includes per-step, per-lead logs with status, duration, WhatsApp delivery result, and task creation details.';
