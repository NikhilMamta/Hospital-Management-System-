CREATE OR REPLACE FUNCTION public.fn_generate_nurse_shift_once_tasks()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_shift        text;
    v_now          time := (now() AT TIME ZONE 'Asia/Kolkata')::time;

    ipd_row        record;
    task_row       record;

    v_last_nurse   text;
    v_assign_nurse text;
    v_valid_nurses text[];
    v_nurse_name   text;
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
    -- Fixed: Select * to get all columns (patient_name, room, etc.)
    -------------------------------------------------------
    FOR ipd_row IN
        SELECT *
        FROM ipd_admissions
        WHERE planned1 IS NOT NULL
          AND actual1 IS NULL
    LOOP

        ---------------------------------------------------
        -- 3️⃣ Loop nurse shift-once tasks
        ---------------------------------------------------
        FOR task_row IN
            SELECT *
            FROM pre_defined_task
            WHERE staff = 'nurse'
              AND status = 'shift once'
        LOOP

            v_assign_nurse := NULL;
            v_valid_nurses := array[]::text[];

            ---------------------------------------------------
            -- FIX: Get valid roster nurses using JSONB logic
            ---------------------------------------------------
            FOR v_nurse_name IN
                SELECT jsonb_array_elements_text(
                    case
                        when lower(replace(ipd_row.ward_type,' ', '_')) like '%female%' 
                            then (CASE WHEN coalesce(female_general_ward,'') <> '' THEN female_general_ward::jsonb ELSE '{}'::jsonb END)->'nurse'
                        when lower(replace(ipd_row.ward_type,' ', '_')) like '%male%' 
                            then (CASE WHEN coalesce(male_general_ward,'') <> '' THEN male_general_ward::jsonb ELSE '{}'::jsonb END)->'nurse'
                        when lower(replace(ipd_row.ward_type,' ', '_')) like '%icu%' 
                            then (CASE WHEN coalesce(icu,'') <> '' THEN icu::jsonb ELSE '{}'::jsonb END)->'nurse'
                        when lower(replace(ipd_row.ward_type,' ', '_')) like '%hdu%' 
                            then (CASE WHEN coalesce(hdu,'') <> '' THEN hdu::jsonb ELSE '{}'::jsonb END)->'nurse'
                        when lower(replace(ipd_row.ward_type,' ', '_')) like '%private%' 
                            then (CASE WHEN coalesce(private_ward,'') <> '' THEN private_ward::jsonb ELSE '{}'::jsonb END)->'nurse'
                        when lower(replace(ipd_row.ward_type,' ', '_')) like '%nicu%' 
                            then (CASE WHEN coalesce(nicu,'') <> '' THEN nicu::jsonb ELSE '{}'::jsonb END)->'nurse'
                        else '[]'::jsonb
                    end
                )
                FROM roster
                WHERE shift = v_shift
                ORDER BY created_at DESC
                LIMIT 3
            LOOP
                v_valid_nurses := array_append(v_valid_nurses, v_nurse_name);
            END LOOP;

            -- Remove duplicates
            v_valid_nurses := array(
                select distinct unnest(v_valid_nurses)
            );

            -- Skip if no nurses in roster
            IF array_length(v_valid_nurses, 1) IS NULL THEN
                 -- Optional: Raise notice or continue
                 CONTINUE; 
            END IF;

            ---------------------------------------------------
            -- 4️⃣ Get last assigned nurse for this patient (using IPD number is safer than bed_no)
            ---------------------------------------------------
            SELECT nat.assign_nurse
            INTO v_last_nurse
            FROM nurse_assign_task nat
            WHERE nat."Ipd_number" = ipd_row.ipd_number 
              AND nat.shift = v_shift
            ORDER BY nat.timestamp DESC
            LIMIT 1;

            ---------------------------------------------------
            -- 5️⃣ Check if last nurse is available in valid nurses
            ---------------------------------------------------
            IF v_last_nurse IS NOT NULL AND v_last_nurse = ANY(v_valid_nurses) THEN
                v_assign_nurse := v_last_nurse;
            END IF;

            ---------------------------------------------------
            -- 6️⃣ If not, pick nurse with LEAST tasks
            ---------------------------------------------------
            IF v_assign_nurse IS NULL THEN
                SELECT nurse_name
                INTO v_assign_nurse
                FROM unnest(v_valid_nurses) as nurse_name
                ORDER BY (
                    SELECT count(*)
                    FROM nurse_assign_task nat
                    WHERE nat.assign_nurse = nurse_name
                      AND nat.shift = v_shift
                      AND nat.start_date = current_date
                      AND nat.status = 'shift once'
                ) ASC
                LIMIT 1;
            END IF;

            ---------------------------------------------------
            -- 7️⃣ Prevent duplicate task
            ---------------------------------------------------
            IF EXISTS (
                SELECT 1
                FROM nurse_assign_task
                WHERE "Ipd_number" = ipd_row.ipd_number
                  AND shift = v_shift
                  AND task = task_row.task
                  AND status = 'shift once'
                  AND start_date = CURRENT_DATE -- Added start_date check for daily shift once
            ) THEN
                CONTINUE;
            END IF;

            ---------------------------------------------------
            -- 8️⃣ Insert task
            ---------------------------------------------------
            IF v_assign_nurse IS NOT NULL THEN
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
                    status
                )
                VALUES (
                    now() at time zone 'Asia/Kolkata',
                    ipd_row.ipd_number,
                    ipd_row.patient_name,
                    ipd_row.ward_type,
                    ipd_row.bed_location,
                    ipd_row.room,
                    ipd_row.bed_no,
                    v_shift,
                    v_assign_nurse,
                    CURRENT_DATE,
                    'No',
                    task_row.task,
                    now() at time zone 'Asia/Kolkata',
                    'shift once'
                );
            END IF;

        END LOOP;
    END LOOP;
END;
$$;
