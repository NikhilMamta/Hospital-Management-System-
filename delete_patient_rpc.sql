-- 1. Create Deletion Log Table (if not exists)
CREATE TABLE IF NOT EXISTS public.patient_deletion_log (
    id SERIAL PRIMARY KEY,
    deleted_by TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    ipd_number TEXT NOT NULL,
    admission_no TEXT NOT NULL,
    deletion_summary JSONB NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.patient_deletion_log ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to insert deletion logs') THEN
        CREATE POLICY "Allow authenticated users to insert deletion logs" 
        ON public.patient_deletion_log FOR INSERT TO authenticated WITH CHECK (TRUE);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow admins to view deletion logs') THEN
        CREATE POLICY "Allow admins to view deletion logs" 
        ON public.patient_deletion_log FOR SELECT TO authenticated USING (TRUE);
    END IF;
END $$;

-- 2. Transactional RPC for Deleting Patient
CREATE OR REPLACE FUNCTION delete_patient_completely(
  p_ipd_number TEXT,
  p_admission_no TEXT,
  p_admin_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_name TEXT;
  v_nursing_count INTEGER;
  v_rmo_count INTEGER;
  v_lab_count INTEGER;
  v_pharmacy_count INTEGER;
  v_discharge_count INTEGER;
  v_ot_count INTEGER;
  v_dressing_count INTEGER;
  v_admission_deleted BOOLEAN;
  v_ipd_deleted BOOLEAN;
  v_summary JSONB;
  v_floor TEXT;
  v_ward TEXT;
  v_room TEXT;
  v_bed TEXT;
BEGIN
  -- Step A: Capture details BEFORE deletion
  SELECT patient_name, floor, ward_type, room, bed_no
  INTO v_patient_name, v_floor, v_ward, v_room, v_bed
  FROM ipd_admissions
  WHERE ipd_number = p_ipd_number;

  IF v_patient_name IS NULL THEN
     -- Fallback to patient_admission if not in ipd_admissions
     SELECT patient_name INTO v_patient_name FROM patient_admission WHERE admission_no = p_admission_no;
  END IF;

  -- Step B: Delete children
  
  -- Nursing (Quoted because column name is "Ipd_number" in DB)
  DELETE FROM nurse_assign_task WHERE "Ipd_number" = p_ipd_number;
  GET DIAGNOSTICS v_nursing_count = ROW_COUNT;

  -- RMO
  DELETE FROM rmo_assign_task WHERE ipd_number = p_ipd_number;
  GET DIAGNOSTICS v_rmo_count = ROW_COUNT;

  -- Lab
  DELETE FROM lab WHERE ipd_number = p_ipd_number OR admission_no = p_admission_no;
  GET DIAGNOSTICS v_lab_count = ROW_COUNT;

  -- Pharmacy
  DELETE FROM pharmacy WHERE ipd_number = p_ipd_number;
  GET DIAGNOSTICS v_pharmacy_count = ROW_COUNT;

  -- Discharge (Only has admission_no)
  DELETE FROM discharge WHERE admission_no = p_admission_no;
  GET DIAGNOSTICS v_discharge_count = ROW_COUNT;

  -- OT
  DELETE FROM ot_information WHERE ipd_number = p_ipd_number;
  GET DIAGNOSTICS v_ot_count = ROW_COUNT;

  -- Dressing
  DELETE FROM dressing WHERE ipd_number = p_ipd_number;
  GET DIAGNOSTICS v_dressing_count = ROW_COUNT;

  -- Step C: Delete Parents
  DELETE FROM patient_admission WHERE admission_no = p_admission_no;
  v_admission_deleted := FOUND;

  DELETE FROM ipd_admissions WHERE ipd_number = p_ipd_number;
  v_ipd_deleted := FOUND;

  -- Step D: Free Bed
  IF v_floor IS NOT NULL THEN
    UPDATE all_floor_bed
    SET status = NULL
    WHERE floor = v_floor
      AND ward = v_ward
      AND room = v_room
      AND bed = v_bed;
  END IF;

  -- Step E: Logic Log
  v_summary := jsonb_build_object(
    'nursing_tasks', v_nursing_count,
    'rmo_tasks', v_rmo_count,
    'lab_records', v_lab_count,
    'pharmacy_indents', v_pharmacy_count,
    'discharge_records', v_discharge_count,
    'ot_tasks', v_ot_count,
    'dressing_tasks', v_dressing_count,
    'admission_record_deleted', v_admission_deleted,
    'ipd_record_deleted', v_ipd_deleted,
    'bed_freed', (v_floor IS NOT NULL)
  );

  INSERT INTO patient_deletion_log (
    deleted_by,
    patient_name,
    ipd_number,
    admission_no,
    deletion_summary
  ) VALUES (
    p_admin_name,
    COALESCE(v_patient_name, 'Unknown'),
    p_ipd_number,
    p_admission_no,
    v_summary
  );

  RETURN v_summary;
END;
$$;
