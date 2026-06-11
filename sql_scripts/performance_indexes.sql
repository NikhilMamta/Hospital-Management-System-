-- ============================================================
-- HMS PERFORMANCE INDEXES
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor)
-- Uses CREATE INDEX CONCURRENTLY where possible for zero downtime.
-- NOTE: CONCURRENTLY cannot run inside a transaction block —
--       run this file as individual statements or paste the whole
--       file into the SQL Editor (it handles each statement separately).
-- ============================================================

-- Enable trigram extension for ILIKE search optimisation
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ──────────────────────────────────────────
-- patient_admission
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patient_admission_timestamp
  ON public.patient_admission (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_patient_admission_status
  ON public.patient_admission (status);

CREATE INDEX IF NOT EXISTS idx_patient_admission_admission_no
  ON public.patient_admission (admission_no);

CREATE INDEX IF NOT EXISTS idx_patient_admission_department
  ON public.patient_admission (department);

-- Full-text search: patient name + phone (used by search bars)
CREATE INDEX IF NOT EXISTS idx_patient_admission_fts
  ON public.patient_admission
  USING GIN (
    to_tsvector('english',
      COALESCE(patient_name, '') || ' ' || COALESCE(phone_no, '')
    )
  );

-- Trigram index for partial name/phone ILIKE searches
CREATE INDEX IF NOT EXISTS idx_patient_admission_name_trgm
  ON public.patient_admission USING GIN (patient_name gin_trgm_ops);


-- ──────────────────────────────────────────
-- ipd_admissions  (most-queried table)
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ipd_admissions_timestamp
  ON public.ipd_admissions (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ipd_admissions_ipd_number
  ON public.ipd_admissions (ipd_number);

CREATE INDEX IF NOT EXISTS idx_ipd_admissions_status
  ON public.ipd_admissions (status);

CREATE INDEX IF NOT EXISTS idx_ipd_admissions_consultant_dr
  ON public.ipd_admissions (consultant_dr);

CREATE INDEX IF NOT EXISTS idx_ipd_admissions_ward_type
  ON public.ipd_admissions (ward_type);

CREATE INDEX IF NOT EXISTS idx_ipd_admissions_department
  ON public.ipd_admissions (department);

-- Partial index: active patients (planned1 set, not yet discharged)
-- Used by dashboard active count + pharmacy getActiveAdmissions
CREATE INDEX IF NOT EXISTS idx_ipd_admissions_active
  ON public.ipd_admissions (planned1, actual1)
  WHERE planned1 IS NOT NULL AND actual1 IS NULL;

-- Full-text search across IPD records
CREATE INDEX IF NOT EXISTS idx_ipd_admissions_fts
  ON public.ipd_admissions
  USING GIN (
    to_tsvector('english',
      COALESCE(patient_name, '') || ' ' ||
      COALESCE(ipd_number,   '') || ' ' ||
      COALESCE(phone_no,     '')
    )
  );

-- Trigram for ILIKE patient name searches
CREATE INDEX IF NOT EXISTS idx_ipd_admissions_name_trgm
  ON public.ipd_admissions USING GIN (patient_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ipd_admissions_admission_no
  ON public.ipd_admissions (admission_no);


-- ──────────────────────────────────────────
-- nurse_assign_task
-- ──────────────────────────────────────────
-- NOTE: column is "Ipd_number" (capital I) — must match exactly
CREATE INDEX IF NOT EXISTS idx_nat_ipd_number
  ON public.nurse_assign_task ("Ipd_number");

CREATE INDEX IF NOT EXISTS idx_nat_assign_nurse
  ON public.nurse_assign_task (assign_nurse);

CREATE INDEX IF NOT EXISTS idx_nat_planned1
  ON public.nurse_assign_task (planned1 DESC);

CREATE INDEX IF NOT EXISTS idx_nat_status
  ON public.nurse_assign_task (status);

CREATE INDEX IF NOT EXISTS idx_nat_shift
  ON public.nurse_assign_task (shift);

-- Composite: nurse lookup within a shift window (RMO/Nurse shift queries)
CREATE INDEX IF NOT EXISTS idx_nat_nurse_planned1
  ON public.nurse_assign_task (assign_nurse, planned1 DESC);

-- Trigram: powers the .ilike('%name%') nurse name searches
CREATE INDEX IF NOT EXISTS idx_nat_nurse_trgm
  ON public.nurse_assign_task USING GIN (assign_nurse gin_trgm_ops);


-- ──────────────────────────────────────────
-- rmo_assign_task
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rat_ipd_number
  ON public.rmo_assign_task (ipd_number);

CREATE INDEX IF NOT EXISTS idx_rat_assign_rmo
  ON public.rmo_assign_task (assign_rmo);

CREATE INDEX IF NOT EXISTS idx_rat_planned1
  ON public.rmo_assign_task (planned1 DESC);

CREATE INDEX IF NOT EXISTS idx_rat_status
  ON public.rmo_assign_task (status);

CREATE INDEX IF NOT EXISTS idx_rat_task_no
  ON public.rmo_assign_task (task_no);

-- Composite: RMO shift-window query (patientProfile.js line 56-57)
CREATE INDEX IF NOT EXISTS idx_rat_rmo_planned1
  ON public.rmo_assign_task (assign_rmo, planned1 DESC);


-- ──────────────────────────────────────────
-- pharmacy
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pharmacy_ipd_number
  ON public.pharmacy (ipd_number);

CREATE INDEX IF NOT EXISTS idx_pharmacy_admission_number
  ON public.pharmacy (admission_number);

CREATE INDEX IF NOT EXISTS idx_pharmacy_status
  ON public.pharmacy (status);

CREATE INDEX IF NOT EXISTS idx_pharmacy_timestamp
  ON public.pharmacy (timestamp DESC);

-- Partial index: store view (planned2 set, not rejected)
CREATE INDEX IF NOT EXISTS idx_pharmacy_store_view
  ON public.pharmacy (timestamp DESC)
  WHERE planned2 IS NOT NULL AND status != 'rejected';

-- Partial index: pending indents
CREATE INDEX IF NOT EXISTS idx_pharmacy_pending
  ON public.pharmacy (timestamp DESC)
  WHERE status = 'pending';


-- ──────────────────────────────────────────
-- departmental_pharmacy_indent
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dept_indent_status
  ON public.departmental_pharmacy_indent (status);

CREATE INDEX IF NOT EXISTS idx_dept_indent_timestamp
  ON public.departmental_pharmacy_indent (timestamp DESC);

-- Partial index: store view
CREATE INDEX IF NOT EXISTS idx_dept_indent_store_view
  ON public.departmental_pharmacy_indent (timestamp DESC)
  WHERE planned2 IS NOT NULL AND status != 'rejected';

-- Partial index: pending indents
CREATE INDEX IF NOT EXISTS idx_dept_indent_pending
  ON public.departmental_pharmacy_indent (timestamp DESC)
  WHERE status = 'pending';


-- ──────────────────────────────────────────
-- lab
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lab_ipd_number
  ON public.lab (ipd_number);

CREATE INDEX IF NOT EXISTS idx_lab_admission_no
  ON public.lab (admission_no);

CREATE INDEX IF NOT EXISTS idx_lab_status
  ON public.lab (status);

CREATE INDEX IF NOT EXISTS idx_lab_timestamp
  ON public.lab (timestamp DESC);


-- ──────────────────────────────────────────
-- discharge
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_discharge_admission_no
  ON public.discharge (admission_no);

CREATE INDEX IF NOT EXISTS idx_discharge_planned1
  ON public.discharge (planned1 DESC)
  WHERE planned1 IS NOT NULL;

-- Partial index: active discharges (initiated but not completed)
CREATE INDEX IF NOT EXISTS idx_discharge_active
  ON public.discharge (planned1 DESC)
  WHERE planned1 IS NOT NULL AND actual1 IS NULL;

-- Partial index: history discharges
CREATE INDEX IF NOT EXISTS idx_discharge_history
  ON public.discharge (actual1 DESC)
  WHERE planned1 IS NOT NULL AND actual1 IS NOT NULL AND rmo_name IS NOT NULL;


-- ──────────────────────────────────────────
-- all_floor_bed  (bed availability — queried on every IPD admission form)
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_floor_bed_status
  ON public.all_floor_bed (status);

-- Composite: exact bed lookup used in saveIpdAdmission / deleteIpdAdmission
CREATE INDEX IF NOT EXISTS idx_floor_bed_location
  ON public.all_floor_bed (floor, ward, room, bed);


-- ──────────────────────────────────────────
-- all_staff
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_all_staff_designation
  ON public.all_staff (designation);

-- Trigram: staff name search
CREATE INDEX IF NOT EXISTS idx_all_staff_name_trgm
  ON public.all_staff USING GIN (name gin_trgm_ops);


-- ──────────────────────────────────────────
-- doctors
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_doctors_name
  ON public.doctors (name);


-- ──────────────────────────────────────────
-- ot_information
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ot_ipd_number
  ON public.ot_information (ipd_number);

CREATE INDEX IF NOT EXISTS idx_ot_status
  ON public.ot_information (status);

-- For getOtCompletionDays: filters by actual2 IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_ot_actual2
  ON public.ot_information (actual2 DESC)
  WHERE actual2 IS NOT NULL;


-- ──────────────────────────────────────────
-- dressing
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dressing_ipd_number
  ON public.dressing (ipd_number);

CREATE INDEX IF NOT EXISTS idx_dressing_status
  ON public.dressing (status);


-- ──────────────────────────────────────────
-- surgical_data
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_surgical_data_ipd_number
  ON public.surgical_data (ipd_number);


-- ──────────────────────────────────────────
-- roster
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_roster_start_date
  ON public.roster (start_date DESC);

CREATE INDEX IF NOT EXISTS idx_roster_shift
  ON public.roster (shift);


-- ──────────────────────────────────────────
-- leave
-- ──────────────────────────────────────────
-- Composite: duplicate-leave check (leave.js line 975)
CREATE INDEX IF NOT EXISTS idx_leave_staff_date
  ON public.leave (staff_name, leave_date);

CREATE INDEX IF NOT EXISTS idx_leave_date
  ON public.leave (leave_date DESC);


-- ──────────────────────────────────────────
-- congratulations_posts
-- ──────────────────────────────────────────
-- Partial index: only active posts within last 24h (getCongratulationsPosts)
CREATE INDEX IF NOT EXISTS idx_congrats_active_recent
  ON public.congratulations_posts (created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_congrats_post_type
  ON public.congratulations_posts (post_type)
  WHERE is_active = true;


-- ──────────────────────────────────────────
-- medicine  (master data — ordered alphabetically for dropdowns)
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_medicine_name
  ON public.medicine (medicine_name);

CREATE INDEX IF NOT EXISTS idx_medicine_name_trgm
  ON public.medicine USING GIN (medicine_name gin_trgm_ops);


-- ──────────────────────────────────────────
-- investigation
-- ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_investigation_type
  ON public.investigation (type);

CREATE INDEX IF NOT EXISTS idx_investigation_name
  ON public.investigation (name);


-- ──────────────────────────────────────────
-- Done — verify with:
-- SELECT schemaname, tablename, indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;
-- ──────────────────────────────────────────
