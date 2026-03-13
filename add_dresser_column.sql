-- Add dresser column to dressing table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dressing' AND column_name = 'dresser') THEN
        ALTER TABLE dressing ADD COLUMN dresser text;
    END IF;
END $$;

-- Enable RLS for dressing table
ALTER TABLE dressing ENABLE ROW LEVEL SECURITY;

-- Create policy for all access
DROP POLICY IF EXISTS "Enable all access for all users" ON dressing;
CREATE POLICY "Enable all access for all users" ON dressing FOR ALL USING (true) WITH CHECK (true);