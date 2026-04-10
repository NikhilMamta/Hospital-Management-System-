CREATE OR REPLACE FUNCTION public.fn_generate_rmo_shift_once_tasks()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_shift        text;
    v_now          time := (now() AT TIME ZONE 'Asia/Kolkata')::time;

    ipd_row        record;
    task_row       record;

    v_last_rmo     text;
    v_assign_rmo   text;
    v_valid_rmos   text[];
    v_rmo_name     text;
BEGIN
    -------------------------------------------------------
    -- 1️⃣ Determine current shift
    -------------------------------------------------------
    IF v_now >= TIME '08:00' AND v_now < TIME '14:00' THEN
        v_shift := 'Shift A';
    ELSIF v_now >= TIME '14:00' AND v_now < TIME '20:00' THEN
        v_shift := 'Shift B';
    ELSE
        v_shift := 'Shift C';
    END IF;

    -------------------------------------------------------
    -- 2️⃣ Loop active IPD admissions
    -------------------------------------------------------
    FOR ipd_row IN
        SELECT *
        FROM ipd_admissions
        WHERE planned1 IS NOT NULL
          AND actual1 IS NULL
    LOOP

        ---------------------------------------------------
        -- 3️⃣ Loop RMO shift-once tasks
        ---------------------------------------------------
        FOR task_row IN
            SELECT *
            FROM pre_defined_task
            WHERE staff = 'rmo'
              AND status = 'shift once'
        LOOP

            v_assign_rmo := NULL;
            v_valid_rmos := ARRAY[]::text[];

            ---------------------------------------------------
            -- 4️⃣ Get valid RMOs from roster JSON
            ---------------------------------------------------
            FOR v_rmo_name IN
                SELECT jsonb_array_elements_text(
                    CASE
                        WHEN lower(replace(ipd_row.ward_type,' ', '_')) LIKE '%female%' 
                            THEN (female_general_ward::jsonb)->'rmo'
                        WHEN lower(replace(ipd_row.ward_type,' ', '_')) LIKE '%male%' 
                            THEN (male_general_ward::jsonb)->'rmo'
                        WHEN lower(replace(ipd_row.ward_type,' ', '_')) LIKE '%icu%' 
                            THEN (icu::jsonb)->'rmo'
                        WHEN lower(replace(ipd_row.ward_type,' ', '_')) LIKE '%hdu%' 
                            THEN (hdu::jsonb)->'rmo'
                        WHEN lower(replace(ipd_row.ward_type,' ', '_')) LIKE '%private%' 
                            THEN (private_ward::jsonb)->'rmo'
                        WHEN lower(replace(ipd_row.ward_type,' ', '_')) LIKE '%nicu%' 
                            THEN (nicu::jsonb)->'rmo'
                        ELSE '[]'::jsonb
                    END
                )
                FROM roster
                WHERE shift = v_shift
                  AND (start_date <= current_date OR start_date IS NULL) -- Added Date Logic
                ORDER BY created_at DESC
                LIMIT 3
            LOOP
                v_valid_rmos := array_append(v_valid_rmos, v_rmo_name);
            END LOOP;

            -- Remove duplicates
            v_valid_rmos := ARRAY(
                SELECT DISTINCT unnest(v_valid_rmos)
            );

            IF array_length(v_valid_rmos, 1) IS NULL THEN
                CONTINUE;
            END IF;

            ---------------------------------------------------
            -- 5️⃣ Last assigned RMO (THIS FIXES YOUR ERROR)
            ---------------------------------------------------
            SELECT rat.assign_rmo
            INTO v_last_rmo
            FROM rmo_assign_task rat
            WHERE rat.ipd_number = ipd_row.ipd_number
              AND rat.shift = v_shift
            ORDER BY rat.timestamp DESC
            LIMIT 1;

            ---------------------------------------------------
            -- 6️⃣ Reuse last RMO if available
            ---------------------------------------------------
            IF v_last_rmo IS NOT NULL AND v_last_rmo = ANY(v_valid_rmos) THEN
                v_assign_rmo := v_last_rmo;
            END IF;

            ---------------------------------------------------
            -- 7️⃣ Assign least-loaded RMO
            ---------------------------------------------------
            IF v_assign_rmo IS NULL THEN
                SELECT rmo_name
                INTO v_assign_rmo
                FROM unnest(v_valid_rmos) AS rmo_name
                ORDER BY (
                    SELECT COUNT(*)
                    FROM rmo_assign_task rat
                    WHERE rat.assign_rmo = rmo_name
                      AND rat.shift = v_shift
                      AND rat.start_date = CURRENT_DATE
                      AND rat.status = 'shift once'
                ) ASC
                LIMIT 1;
            END IF;

            ---------------------------------------------------
            -- 8️⃣ Prevent duplicate task
            ---------------------------------------------------
            IF EXISTS (
                SELECT 1
                FROM rmo_assign_task
                WHERE ipd_number = ipd_row.ipd_number
                  AND shift = v_shift
                  AND task = task_row.task
                  AND status = 'shift once'
                  AND start_date = CURRENT_DATE
            ) THEN
                CONTINUE;
            END IF;

            ---------------------------------------------------
            -- 9️⃣ Insert RMO task
            ---------------------------------------------------
            IF v_assign_rmo IS NOT NULL THEN
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
                    ipd_row.ipd_number,
                    ipd_row.patient_name,
                    ipd_row.bed_location,
                    ipd_row.ward_type,
                    ipd_row.room,
                    ipd_row.bed_no,
                    v_shift,
                    v_assign_rmo,
                    'No',
                    CURRENT_DATE,
                    task_row.task,
                    now() AT TIME ZONE 'Asia/Kolkata',
                    'shift once'
                );
            END IF;

        END LOOP;
    END LOOP;
END;
$function$
