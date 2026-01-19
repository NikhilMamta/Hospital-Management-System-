-- SQL to synchronize sequences for the task tables
-- Run this in the Supabase SQL Editor to resolve "duplicate key" errors

-- 1. Synchronize nurse_assign_task sequence
SELECT setval(
    pg_get_serial_sequence('nurse_assign_task', 'id'),
    COALESCE(MAX(id), 0) + 1,
    false
) FROM nurse_assign_task;

-- 2. Synchronize rmo_assign_task sequence
SELECT setval(
    pg_get_serial_sequence('rmo_assign_task', 'id'),
    COALESCE(MAX(id), 0) + 1,
    false
) FROM rmo_assign_task;

-- 3. If task_no itself has a sequence (often named table_column_seq)
-- This tries to find and sync any sequence that might be used for task_no
DO $$
DECLARE
    seq_name TEXT;
BEGIN
    SELECT pg_get_serial_sequence('rmo_assign_task', 'task_no') INTO seq_name;
    IF seq_name IS NOT NULL THEN
        EXECUTE format('SELECT setval(%L, COALESCE(MAX(id), 0) + 1, false) FROM rmo_assign_task', seq_name);
    END IF;
END $$;
