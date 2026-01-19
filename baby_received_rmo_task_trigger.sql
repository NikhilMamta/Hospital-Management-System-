CREATE OR REPLACE FUNCTION public.fn_generate_rmo_task_baby_received()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_exists BOOLEAN;
    v_shift TEXT;
    v_now TIME := (now() AT TIME ZONE 'Asia/Kolkata')::time;
    v_rmo TEXT;
    v_task RECORD;
BEGIN
    /* --------------------------------------------------
       1. VALIDATION CHECKS
    -------------------------------------------------- */

    -- Must be 'Baby Received'
    IF LOWER(NEW.task) <> 'baby received' THEN
        RETURN NEW;
    END IF;

    -- Must be completed
    IF NEW.planned1 IS NULL OR NEW.actual1 IS NULL THEN
        RETURN NEW;
    END IF;

    -- Only trigger once (actual1 just updated)
    IF OLD.actual1 IS NOT NULL THEN
        RETURN NEW;
    END IF;

    /* --------------------------------------------------
       2. GLOBAL DUPLICATE CHECK (IPD + NICU)
    -------------------------------------------------- */
    SELECT EXISTS (
        SELECT 1
        FROM rmo_assign_task
        WHERE ipd_number = NEW."Ipd_number"
          AND status = 'nicu'
    )
    INTO v_exists;

    IF v_exists THEN
        RETURN NEW;
    END IF;

    /* --------------------------------------------------
       3. SHIFT DETECTION
    -------------------------------------------------- */
    IF v_now >= TIME '08:00' AND v_now < TIME '14:00' THEN
        v_shift := 'Shift A';
    ELSIF v_now >= TIME '14:00' AND v_now < TIME '20:00' THEN
        v_shift := 'Shift B';
    ELSE
        v_shift := 'Shift C';
    END IF;

    /* --------------------------------------------------
       4. PICK RMO (LOAD BALANCED)
    -------------------------------------------------- */
    SELECT rmo_name
    INTO v_rmo
    FROM (
        SELECT jsonb_array_elements_text(
            CASE
                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%picu%' 
                    THEN COALESCE(picu::jsonb, '{"rmo": []}'::jsonb)->'rmo'
                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%nicu%' 
                    THEN nicu::jsonb->'rmo'
                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%hdu%' 
                    THEN hdu::jsonb->'rmo'
                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%icu%' 
                    THEN icu::jsonb->'rmo'
                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%female%' 
                    THEN female_general_ward::jsonb->'rmo'
                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%male%' 
                    THEN male_general_ward::jsonb->'rmo'
                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%private%' 
                    THEN private_ward::jsonb->'rmo'
                ELSE '{"rmo": []}'::jsonb->'rmo'
            END
        ) AS rmo_name
        FROM roster
        WHERE shift = v_shift
          AND (start_date <= CURRENT_DATE OR start_date IS NULL)
        ORDER BY created_at DESC
        LIMIT 3
    ) rmos
    WHERE rmo_name IS NOT NULL
    GROUP BY rmo_name
    ORDER BY (
        SELECT COUNT(*)
        FROM rmo_assign_task rat
        WHERE rat.assign_rmo = rmo_name
          AND rat.shift = v_shift
          AND rat.start_date = CURRENT_DATE
          AND rat.status = 'nicu'
    ) ASC
    LIMIT 1;

    IF v_rmo IS NULL THEN
        RAISE NOTICE 'No RMO found for ward %, shift %', NEW.ward_type, v_shift;
        RETURN NEW;
    END IF;

    /* --------------------------------------------------
       5. INSERT RMO TASKS (FETCH NICU TASKS)
    -------------------------------------------------- */
    FOR v_task IN
        SELECT task
        FROM pre_defined_task
        WHERE staff = 'rmo'
          AND status = 'nicu'
    LOOP
        INSERT INTO rmo_assign_task (
            timestamp,
            ipd_number,
            patient_name,
            patient_location,
            ward_type,
            room,
            bed_no,
            shift,
            assign_rmo,
            reminder,
            start_date,
            task,
            planned1,
            status
        )
        SELECT
            now() AT TIME ZONE 'Asia/Kolkata',
            NEW."Ipd_number",
            NEW.patient_name,
            NEW.patient_location,
            NEW.ward_type,
            NEW.room,
            NEW.bed_no,
            v_shift,
            v_rmo,
            'No',
            CURRENT_DATE,
            v_task.task,
            now() AT TIME ZONE 'Asia/Kolkata',
            'nicu'
        WHERE NOT EXISTS (
            SELECT 1
            FROM rmo_assign_task rat
            WHERE rat.ipd_number = NEW."Ipd_number"
              AND rat.task = v_task.task
              AND rat.status = 'nicu'
        );
    END LOOP;

    RETURN NEW;
END;
$function$;

-- Trigger Definition
DROP TRIGGER IF EXISTS trg_baby_received_rmo_task_nicu ON nurse_assign_task;

CREATE TRIGGER trg_baby_received_rmo_task_nicu
AFTER UPDATE ON nurse_assign_task
FOR EACH ROW
EXECUTE FUNCTION fn_generate_rmo_task_baby_received();
