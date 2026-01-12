CREATE OR REPLACE FUNCTION public.fn_lab_generate_nurse_task()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_shift TEXT;
    v_start_date DATE;
    v_task TEXT;
    v_current_time TIME;

    v_valid_nurses TEXT[] := ARRAY[]::TEXT[];
    v_selected_nurse TEXT;
    v_last_nurse TEXT;
    v_name TEXT;
BEGIN
    --------------------------------------------------
    -- FIRE ONLY WHEN CONDITIONS MATCH
    --------------------------------------------------
    IF OLD.actual1 IS NOT NULL
       OR NEW.actual1 IS NULL
       OR NEW.planned2 IS NULL
       OR NEW.actual2 IS NOT NULL THEN
        RETURN NEW;
    END IF;

    --------------------------------------------------
    -- DETERMINE SHIFT FROM CURRENT TIME (TRIGGER FIRE TIME)
    --------------------------------------------------
    -- Use current local time for shift determination as requested
    v_current_time := (now() AT TIME ZONE 'Asia/Kolkata')::time;
    
    IF v_current_time >= TIME '08:00'
       AND v_current_time < TIME '14:00' THEN
        v_shift := 'Shift A';
    ELSIF v_current_time >= TIME '14:00'
       AND v_current_time < TIME '20:00' THEN
        v_shift := 'Shift B';
    ELSE
        v_shift := 'Shift C';
    END IF;

    v_start_date := (now() AT TIME ZONE 'Asia/Kolkata')::date;

    --------------------------------------------------
    -- FETCH LAB TASK FOR NURSE
    --------------------------------------------------
    SELECT task
    INTO v_task
    FROM pre_defined_task
    WHERE staff = 'nurse'
      AND status = 'lab'
    LIMIT 1;

    IF v_task IS NULL THEN
        RETURN NEW;
    END IF;

    --------------------------------------------------
    -- FIND LAST ASSIGNED NURSE (CONTINUITY)
    --------------------------------------------------
    SELECT assign_nurse
    INTO v_last_nurse
    FROM nurse_assign_task
    WHERE "Ipd_number" = NEW.ipd_number
      AND start_date = v_start_date
    ORDER BY timestamp DESC
    LIMIT 1;

    --------------------------------------------------
    -- FETCH AVAILABLE NURSES FROM LATEST ROSTER
    --------------------------------------------------
    FOR v_name IN
        WITH latest_roster AS (
            SELECT *
            FROM roster
            WHERE shift = v_shift
              AND (start_date <= current_date OR start_date IS NULL) -- Added Date Logic
            ORDER BY created_at DESC
            LIMIT 3 -- Increased from 1 to 3 for fallback logic
        )
        SELECT jsonb_array_elements_text(
            CASE
                -- FIX: Check Female before Male to strictly match 'Female General Ward'
                -- 'Male General Ward' contains 'male' but 'Female General Ward' also contains 'male' (if case insensitive without boundaries)
                -- But specifically 'Female...' contains 'male' inside 'feMALE'.
                -- Checking Female first ensures we catch it.
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

    IF array_length(v_valid_nurses, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    --------------------------------------------------
    -- PRIORITY 1: REUSE LAST NURSE IF AVAILABLE
    --------------------------------------------------
    IF v_last_nurse = ANY (v_valid_nurses) THEN
        v_selected_nurse := v_last_nurse;
    ELSE
        --------------------------------------------------
        -- PRIORITY 2: LEAST TASK COUNT NURSE
        --------------------------------------------------
        SELECT n
        INTO v_selected_nurse
        FROM unnest(v_valid_nurses) n
        ORDER BY (
            SELECT COUNT(*)
            FROM nurse_assign_task
            WHERE assign_nurse = n
              AND shift = v_shift
              AND start_date = v_start_date
        )
        LIMIT 1;
    END IF;

    IF v_selected_nurse IS NULL THEN
        RETURN NEW;
    END IF;

    --------------------------------------------------
    -- INSERT LAB NURSE TASK
    --------------------------------------------------
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
        staff
    )
    VALUES (
        now() AT TIME ZONE 'Asia/Kolkata',
        NEW.ipd_number,
        NEW.patient_name,
        NEW.ward_type,
        NEW.location,
        NEW.room,
        NEW.bed_no,
        v_shift,
        v_selected_nurse,
        v_start_date,
        'No',
        v_task,
        now() AT TIME ZONE 'Asia/Kolkata',
        'lab',
        'nurse'
    );

    RETURN NEW;
END;
$function$
