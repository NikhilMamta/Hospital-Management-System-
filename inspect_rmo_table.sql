-- SQL to inspect rmo_assign_task table structure and triggers
-- Run this in the Supabase SQL Editor and share the result

-- 1. Check column definitions and default values
SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'rmo_assign_task'
ORDER BY ordinal_position;

-- 2. Check for triggers on the table
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement, 
    action_orientation,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'rmo_assign_task';

-- 3. Check for the function code of those triggers
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN (
    SELECT tgfunction::regproc::text
    FROM pg_trigger
    WHERE tgrelid = 'rmo_assign_task'::regclass
);
