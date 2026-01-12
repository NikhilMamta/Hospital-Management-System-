-- Drop existing function and trigger to ensure clean replacement
DROP TRIGGER IF EXISTS trg_generate_rmo_task ON nurse_assign_task;
DROP FUNCTION IF EXISTS public.fn_generate_rmo_task() CASCADE;

-- Create the revised function
CREATE OR REPLACE FUNCTION public.fn_generate_rmo_task()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_exists boolean;
    v_shift text;
    v_now time := (now() AT TIME ZONE 'Asia/Kolkata')::time;
    v_rmo text;
    v_task record;
BEGIN
    /* --------------------------------------------------
       1. VALIDATION CHECKS
    -------------------------------------------------- */
    
    -- Check 1: Must be 'Inform to RMO' task (Case Insensitive)
    IF LOWER(NEW.task) <> 'inform to rmo' THEN
        RETURN NEW;
    END IF;

    -- REMOVED: Status check (LOWER(NEW.status) <> 'at once')
    -- Reason: Frontend updates status to 'Completed' when finishing the task,
    -- which would cause the trigger to fail if we returned here.

    -- Check 2: Both planned1 and actual1 must be present (completed task)
    IF NEW.planned1 IS NULL OR NEW.actual1 IS NULL THEN
        RETURN NEW;
    END IF;

    /* --------------------------------------------------
       2. UNIQUENESS CHECK
       Prevent generating duplicate RMO tasks for the same IPD
       NOTE: Using NEW."Ipd_number" because the column is case-sensitive
    -------------------------------------------------- */
    SELECT EXISTS (
        SELECT 1
        FROM rmo_assign_task
        WHERE ipd_number = NEW."Ipd_number"
          AND status = 'at once'
    ) INTO v_exists;

    IF v_exists THEN
        RETURN NEW;
    END IF;

    /* --------------------------------------------------
       3. SHIFT DETECTION
    -------------------------------------------------- */
    IF v_now >= time '08:00' AND v_now < time '14:00' THEN
        v_shift := 'Shift A';
    ELSIF v_now >= time '14:00' AND v_now < time '20:00' THEN
        v_shift := 'Shift B';
    ELSE
        v_shift := 'Shift C';
    END IF;

    /* --------------------------------------------------
       4. PICK ONE RMO FROM ROSTER (LOAD BALANCED)
       Selects the RMO with the minimum number of "at once" tasks
       for the current shift.
    -------------------------------------------------- */
    SELECT rmo_name
    INTO v_rmo
    FROM (
        SELECT
            jsonb_array_elements_text(
                CASE
                    -- Specific units (Check first for specificity)
                    WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%icu%' 
                        THEN (icu::jsonb)->'rmo'
                    WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%hdu%' 
                        THEN (hdu::jsonb)->'rmo'
                    WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%nicu%' 
                        THEN (nicu::jsonb)->'rmo'
                    
                    -- General Wards: Check FEMALE before MALE
                    WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%female%' 
                        THEN (female_general_ward::jsonb)->'rmo'
                    WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%male%' 
                        THEN (male_general_ward::jsonb)->'rmo'
                        
                    -- Other wards
                    WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%private%' 
                        THEN (private_ward::jsonb)->'rmo'
                END
            ) AS rmo_name
        FROM roster
        WHERE shift = v_shift
          AND (start_date <= current_date OR start_date IS NULL)
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
          AND rat.start_date = current_date
          AND rat.status = 'at once'
    ) ASC
    LIMIT 1;

    -- SAFETY: If no RMO found in roster, warn and exit
    IF v_rmo IS NULL THEN
        RAISE NOTICE 'No RMO found for ward %, shift %', NEW.ward_type, v_shift;
        RETURN NEW;
    END IF;

    /* --------------------------------------------------
       5. INSERT RMO TASKS
    -------------------------------------------------- */
    FOR v_task IN
        SELECT task
        FROM pre_defined_task
        WHERE staff = 'rmo'
          AND status = 'at once'
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
        VALUES (
            now() AT TIME ZONE 'Asia/Kolkata',
            NEW."Ipd_number", -- Use quoted column name here too
            NEW.patient_name,
            NEW.patient_location,
            NEW.ward_type,
            NEW.room,
            NEW.bed_no,
            v_shift,
            v_rmo,
            'No',
            current_date,
            v_task.task,
            now() AT TIME ZONE 'Asia/Kolkata',
            'at once'
        );
    END LOOP;

    RETURN NEW;
END;
$$;

-- Create the trigger to fire on ANY update
CREATE TRIGGER trg_generate_rmo_task
AFTER UPDATE
ON public.nurse_assign_task
FOR EACH ROW
EXECUTE FUNCTION public.fn_generate_rmo_task();
