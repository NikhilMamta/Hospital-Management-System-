-- Add bed_id to ipd_admissions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ipd_admissions' AND column_name = 'bed_id') THEN
        ALTER TABLE ipd_admissions ADD COLUMN bed_id bigint;
    END IF;
END $$;

-- Ensure all_floor_bed allows updates
ALTER TABLE all_floor_bed ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for all users" ON all_floor_bed;
DROP POLICY IF EXISTS "Enable insert access for all users" ON all_floor_bed;
DROP POLICY IF EXISTS "Enable update access for all users" ON all_floor_bed;
DROP POLICY IF EXISTS "Enable delete access for all users" ON all_floor_bed;
DROP POLICY IF EXISTS "Enable all access for all users" ON all_floor_bed;

-- Create a permissive policy for all_floor_bed
CREATE POLICY "Enable all access for all users" ON all_floor_bed FOR ALL USING (true) WITH CHECK (true);

-- Ensure ipd_admissions allows all access too just in case
ALTER TABLE ipd_admissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON ipd_admissions;
CREATE POLICY "Enable all access for all users" ON ipd_admissions FOR ALL USING (true) WITH CHECK (true);
