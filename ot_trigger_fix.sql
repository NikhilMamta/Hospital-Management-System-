CREATE OR REPLACE FUNCTION public.fn_generate_pre_ot_nurse_tasks()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_shift TEXT;
    v_ot_time TIME;

    v_task RECORD;

    v_nurse TEXT;
    v_preferred_nurse TEXT;

    v_ot_staff TEXT;

    v_valid_nurses TEXT[] := ARRAY[]::TEXT[];
    v_valid_ot_staff TEXT[] := ARRAY[]::TEXT[];

    v_name TEXT;
BEGIN
    --------------------------------------------------
    -- BASIC SAFETY CHECKS
    --------------------------------------------------
    IF NEW.actual1 IS NULL
       OR NEW.planned2 IS NULL
       OR NEW.ot_time IS NULL
       OR NEW.ot_date IS NULL THEN
        RETURN NEW;
    END IF;

    --------------------------------------------------
    -- CAST OT TIME (TEXT → TIME)
    --------------------------------------------------
    v_ot_time := NEW.ot_time::time;

    --------------------------------------------------
    -- SHIFT DETECTION
    --------------------------------------------------
    IF v_ot_time >= TIME '08:00' AND v_ot_time < TIME '14:00' THEN
        v_shift := 'Shift A';
    ELSIF v_ot_time >= TIME '14:00' AND v_ot_time < TIME '20:00' THEN
        v_shift := 'Shift B';
    ELSE
        v_shift := 'Shift C';
    END IF;

    --------------------------------------------------
    -- FETCH VALID NURSES (LATEST 3 ROSTER ONLY)
    -- BUG FIX: Check 'female' before 'male' because 'female' contains 'male'
    --------------------------------------------------
    FOR v_name IN
        WITH latest_roster AS (
            SELECT *
            FROM roster
            WHERE shift = v_shift
              AND (start_date <= current_date OR start_date IS NULL) -- Added Date Logic
            ORDER BY created_at DESC
            LIMIT 3
        )
        SELECT jsonb_array_elements_text(
            CASE
                WHEN LOWER(NEW.ward_type) LIKE '%female%'  THEN (female_general_ward::jsonb)->'nurse'
                WHEN LOWER(NEW.ward_type) LIKE '%male%'    THEN (male_general_ward::jsonb)->'nurse'
                WHEN LOWER(NEW.ward_type) LIKE '%icu%'     THEN (icu::jsonb)->'nurse'
                WHEN LOWER(NEW.ward_type) LIKE '%hdu%'     THEN (hdu::jsonb)->'nurse'
                WHEN LOWER(NEW.ward_type) LIKE '%private%' THEN (private_ward::jsonb)->'nurse'
                ELSE '[]'::jsonb
            END
        )
        FROM latest_roster
    LOOP
        v_valid_nurses := array_append(v_valid_nurses, trim(v_name));
    END LOOP;

    --------------------------------------------------
    -- FETCH VALID OT STAFF (LATEST 3 ROSTER ONLY)
    -- BUG FIX: Check 'female' before 'male'
    --------------------------------------------------
    FOR v_name IN
        WITH latest_roster AS (
            SELECT *
            FROM roster
            WHERE shift = v_shift
              AND (start_date <= current_date OR start_date IS NULL) -- Added Date Logic
            ORDER BY created_at DESC
            LIMIT 3
        )
        SELECT jsonb_array_elements_text(
            CASE
                WHEN LOWER(NEW.ward_type) LIKE '%female%'  THEN (female_general_ward::jsonb)->'ot'
                WHEN LOWER(NEW.ward_type) LIKE '%male%'    THEN (male_general_ward::jsonb)->'ot'
                WHEN LOWER(NEW.ward_type) LIKE '%icu%'     THEN (icu::jsonb)->'ot'
                WHEN LOWER(NEW.ward_type) LIKE '%hdu%'     THEN (hdu::jsonb)->'ot'
                WHEN LOWER(NEW.ward_type) LIKE '%private%' THEN (private_ward::jsonb)->'ot'
                ELSE '[]'::jsonb
            END
        )
        FROM latest_roster
    LOOP
        v_valid_ot_staff := array_append(v_valid_ot_staff, trim(v_name));
    END LOOP;

    --------------------------------------------------
    -- FIND LAST ASSIGNED NURSE FOR SAME BED + SHIFT
    --------------------------------------------------
    SELECT assign_nurse
    INTO v_preferred_nurse
    FROM nurse_assign_task
    WHERE bed_no = NEW.bed_no
      AND shift = v_shift
      AND staff = 'nurse'
    ORDER BY timestamp DESC
    LIMIT 1;

    IF v_preferred_nurse IS NOT NULL
       AND v_preferred_nurse = ANY(v_valid_nurses) THEN
        v_nurse := v_preferred_nurse;
    ELSE
        SELECT nurse_name
        INTO v_nurse
        FROM unnest(v_valid_nurses) AS nurse_name
        ORDER BY (
            SELECT COUNT(*)
            FROM nurse_assign_task
            WHERE assign_nurse = nurse_name
              AND shift = v_shift
              AND start_date = NEW.ot_date
        )
        LIMIT 1;
    END IF;

    --------------------------------------------------
    -- PRE-OT NURSE TASKS (SAFE – MULTIPLE ALLOWED)
    --------------------------------------------------
  FOR v_task IN
    SELECT task, status
    FROM pre_defined_task
    WHERE staff = 'nurse'
      AND status IN ('pre OT', 'post OT')
    LOOP
        INSERT INTO nurse_assign_task (
            timestamp,
            "Ipd_number",
            patient_name,
            ward_type,
            patient_location,
            room,
            bed_no,
            shift,
            assign_nurse,
            start_date,
            reminder,
            task,
            planned1,
            status,
            staff,
           ot_number
        )
        VALUES (
            now() AT TIME ZONE 'Asia/Kolkata',
            NEW.ipd_number,
            NEW.patient_name,
            NEW.ward_type,
            NEW.patient_location,
            NEW.room,
            NEW.bed_no,
            v_shift,
            v_nurse,
            NEW.ot_date,
            'No',
            v_task.task,
            now() AT TIME ZONE 'Asia/Kolkata',
            v_task.status,
            'nurse',
             NEW.ot_number
        );
    END LOOP;

    --------------------------------------------------
    -- 🚫 DUPLICATE GUARD FOR OT STAFF TASKS
    --------------------------------------------------
    IF EXISTS (
        SELECT 1
        FROM nurse_assign_task
        WHERE "Ipd_number" = NEW.ipd_number
          AND staff = 'OT Staff'
          AND ot_number = NEW.ot_number
    ) THEN
        RETURN NEW;
    END IF;

    --------------------------------------------------
    -- PICK ONE OT STAFF (DEDUPLICATED)
    --------------------------------------------------
    SELECT DISTINCT ot_name
    INTO v_ot_staff
    FROM unnest(v_valid_ot_staff) AS ot_name
    WHERE ot_name IS NOT NULL
    LIMIT 1;

    IF v_ot_staff IS NULL THEN
        RETURN NEW;
    END IF;

    --------------------------------------------------
    -- OT STAFF TASKS (GENERATED ONCE)
    --------------------------------------------------
    FOR v_task IN
        SELECT task
        FROM pre_defined_task
        WHERE staff = 'OT Staff'
          AND status = 'normal'
    LOOP
        INSERT INTO nurse_assign_task (
            timestamp,
            "Ipd_number",
            patient_name,
            ward_type,
            patient_location,
            room,
            bed_no,
            shift,
            assign_nurse,
            start_date,
            reminder,
            task,
            planned1,
            status,
            staff,
            ot_number
        )
        VALUES (
            now() AT TIME ZONE 'Asia/Kolkata',
            NEW.ipd_number,
            NEW.patient_name,
            NEW.ward_type,
            NEW.patient_location,
            NEW.room,
            NEW.bed_no,
            v_shift,
            v_ot_staff,
            NEW.ot_date,
            'No',
            v_task.task,
            now() AT TIME ZONE 'Asia/Kolkata',
            'normal',
            'OT Staff',
            NEW.ot_number
        );
    END LOOP;

    RETURN NEW;
END;
$function$
