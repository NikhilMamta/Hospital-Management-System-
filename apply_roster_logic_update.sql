-- =============================================
-- Roster Logic Update Script
-- This script updates the functions to respect the 'start_date' column.
-- It filters out roster entries with a future start_date.
-- =============================================

-- 1. Update fn_generate_two_hour_tasks
create or replace function public.fn_generate_two_hour_tasks()
returns void
language plpgsql
as $$
declare
    v_now time := (now() at time zone 'Asia/Kolkata')::time;
    v_shift text;
    ipd_row record;
    v_task record;
    v_nurse text;
    v_valid_nurses text[];
    v_nurse_name text;
begin
    -- 1. Determine current shift
    if v_now >= time '08:00' and v_now < time '14:00' then
        v_shift := 'Shift A';
    elsif v_now >= time '14:00' and v_now < time '20:00' then
        v_shift := 'Shift B';
    else
        v_shift := 'Shift C';
    end if;

    -- 2. Loop over IPD admissions with planned1 not null and actual1 null
    -- Added check to SKIP ICU wards
    for ipd_row in
        select *
        from ipd_admissions
        where planned1 is not null
          and actual1 is null
          and lower(ward_type) not like '%icu%' 
    loop
        -- 3. Loop over tasks with staff = nurse and status = 'two hours'
        for v_task in
            select *
            from pre_defined_task
            where staff = 'nurse'
              and status = 'two hours'
        loop
            v_valid_nurses := array[]::text[];

            -- STEP 1: Get all nurses in this ward for the current shift from latest 3 roster rows
            for v_nurse_name in
                select jsonb_array_elements_text(
                    case
                        -- FIX: Check for 'female' BEFORE 'male' to avoid partial match issues
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
                        else '[]'::jsonb -- Default to empty array if no match
                    end
                ) as nurse_name
                from roster
                where shift = v_shift
                  and (start_date <= current_date OR start_date is null)
                order by created_at desc
                limit 3
            loop
                v_valid_nurses := array_append(v_valid_nurses, v_nurse_name);
            end loop;

            -- Remove duplicates
            v_valid_nurses := array(
                select distinct unnest(v_valid_nurses)
            );

            if array_length(v_valid_nurses, 1) is null then
                raise notice 'No valid nurses found for ward % and shift %', ipd_row.ward_type, v_shift;
                continue;
            end if;

            -- STEP 2: Get last nurse assigned for this patient on this shift
            select assign_nurse
            into v_nurse
            from nurse_assign_task
            where "Ipd_number" = ipd_row.ipd_number
              and shift = v_shift
            order by timestamp desc
            limit 1;

            -- STEP 3: Decide which nurse to assign
            if v_nurse is null or not v_nurse = any(v_valid_nurses) then
                -- Assign the nurse with least tasks today from valid roster nurses
                select nurse_name
                into v_nurse
                from unnest(v_valid_nurses) as nurse_name
                order by (
                    select count(*)
                    from nurse_assign_task nat
                    where nat.assign_nurse = nurse_name
                      and nat.shift = v_shift
                      and nat.start_date = current_date
                      and nat.status = 'two hours'
                )
                limit 1;
            end if;

            -- STEP 4: Insert task if a nurse is found
            if v_nurse is not null then
                insert into nurse_assign_task (
                    timestamp,
                    "Ipd_number",
                    patient_name,
                    ward_type,
                    room,
                    bed_no,
                    shift,
                    assign_nurse,
                    start_date,
                    task,
                    planned1,
                    status
                )
                values (
                    now() at time zone 'Asia/Kolkata',
                    ipd_row.ipd_number,
                    ipd_row.patient_name,
                    ipd_row.ward_type,
                    ipd_row.room,
                    ipd_row.bed_no,
                    v_shift,
                    v_nurse,
                    current_date,
                    v_task.task,
                    now() at time zone 'Asia/Kolkata',
                    'two hours'
                );
            end if;

        end loop;
    end loop;
end;
$$;


-- 2. Update fn_generate_nurse_shift_once_tasks
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
    -- 1ï¸âƒ£ Determine current shift
    -------------------------------------------------------
    IF v_now >= TIME '08:00' AND v_now < TIME '14:00' THEN
        v_shift := 'Shift A';
    ELSIF v_now >= TIME '14:00' AND v_now < TIME '20:00' THEN
        v_shift := 'Shift B';
    ELSE
        v_shift := 'Shift C';
    END IF;

    -------------------------------------------------------
    -- 2ï¸âƒ£ Loop active IPD admissions
    -- Fixed: Select * to get all columns (patient_name, room, etc.)
    -------------------------------------------------------
    FOR ipd_row IN
        SELECT *
        FROM ipd_admissions
        WHERE planned1 IS NOT NULL
          AND actual1 IS NULL
    LOOP

        ---------------------------------------------------
        -- 3ï¸âƒ£ Loop nurse shift-once tasks
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
                  AND (start_date <= current_date OR start_date IS NULL)
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
            -- 4ï¸âƒ£ Get last assigned nurse for this patient (using IPD number is safer than bed_no)
            ---------------------------------------------------
            SELECT nat.assign_nurse
            INTO v_last_nurse
            FROM nurse_assign_task nat
            WHERE nat."Ipd_number" = ipd_row.ipd_number 
              AND nat.shift = v_shift
            ORDER BY nat.timestamp DESC
            LIMIT 1;

            ---------------------------------------------------
            -- 5ï¸âƒ£ Check if last nurse is available in valid nurses
            ---------------------------------------------------
            IF v_last_nurse IS NOT NULL AND v_last_nurse = ANY(v_valid_nurses) THEN
                v_assign_nurse := v_last_nurse;
            END IF;

            ---------------------------------------------------
            -- 6ï¸âƒ£ If not, pick nurse with LEAST tasks
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
            -- 7ï¸âƒ£ Prevent duplicate task
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
            -- 8ï¸âƒ£ Insert task
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


-- 3. Update fn_create_nurse_tasks (Trigger Function)
CREATE OR REPLACE FUNCTION public.fn_create_nurse_tasks()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
    v_shift text;
    v_now time := (now() at time zone 'Asia/Kolkata')::time;
    v_task record;
    v_nurse text;
begin
    -- Detect shift
    if v_now >= time '08:00' and v_now < time '14:00' then
        v_shift := 'Shift A';
    elsif v_now >= time '14:00' and v_now < time '20:00' then
        v_shift := 'Shift B';
    else
        v_shift := 'Shift C';
    end if;

    /*
      STEP 1: PICK ONE NURSE WITH MINIMUM "at once" TASKS
    */
    select nurse_name
    into v_nurse
    from (
        select
            jsonb_array_elements_text(
                case
                    -- CRITICAL FIX: Check for 'female' BEFORE 'male' 
                    -- because 'female' contains the string 'male'
                    when lower(replace(new.ward_type,' ', '_')) like '%female%' 
                        then (CASE WHEN coalesce(female_general_ward,'') <> '' THEN female_general_ward::jsonb ELSE '{"nurse":[]}'::jsonb END)->'nurse'
                    when lower(replace(new.ward_type,' ', '_')) like '%male%' 
                        then (CASE WHEN coalesce(male_general_ward,'') <> '' THEN male_general_ward::jsonb ELSE '{"nurse":[]}'::jsonb END)->'nurse'
                    when lower(replace(new.ward_type,' ', '_')) like '%icu%' 
                        then (CASE WHEN coalesce(icu,'') <> '' THEN icu::jsonb ELSE '{"nurse":[]}'::jsonb END)->'nurse'
                    when lower(replace(new.ward_type,' ', '_')) like '%hdu%' 
                        then (CASE WHEN coalesce(hdu,'') <> '' THEN hdu::jsonb ELSE '{"nurse":[]}'::jsonb END)->'nurse'
                    when lower(replace(new.ward_type,' ', '_')) like '%private%' 
                        then (CASE WHEN coalesce(private_ward,'') <> '' THEN private_ward::jsonb ELSE '{"nurse":[]}'::jsonb END)->'nurse'
                    when lower(replace(new.ward_type,' ', '_')) like '%nicu%' 
                        then (CASE WHEN coalesce(nicu,'') <> '' THEN nicu::jsonb ELSE '{"nurse":[]}'::jsonb END)->'nurse'
                    else '{"nurse":[]}'::jsonb -> 'nurse'
                end
            ) as nurse_name
        from roster
        where shift = v_shift
          and (start_date <= current_date OR start_date is null)
        order by created_at desc
        limit 3
    ) nurses
    where nurse_name is not null
    group by nurse_name
    order by (
        select count(*)
        from nurse_assign_task nat
        where nat.assign_nurse = nurse_name
          and nat.shift = v_shift
          and nat.start_date = current_date
          and nat.status = 'at once'
    )
    limit 1;

    -- SAFETY
    if v_nurse is null then
        raise notice 'No nurse found for ward %, shift %', new.ward_type, v_shift;
        return new;
    end if;

    /*
      STEP 2: ASSIGN *ALL* TASKS TO SAME NURSE
    */
    for v_task in
        select task
        from pre_defined_task
        where staff = 'nurse'
          and status = 'at once'
    loop
        insert into nurse_assign_task (
            timestamp,
            "Ipd_number",
            patient_location,
            patient_name,
            ward_type,
            reminder,
            room,
            bed_no,
            shift,
            assign_nurse,
            start_date,
            task,
            planned1,
            status
        )
        values (
            now() at time zone 'Asia/Kolkata',
            new.ipd_number,
            new.bed_location,
            new.patient_name,
            new.ward_type,
            'No',
            new.room,
            new.bed_no,
            v_shift,
            v_nurse,
            current_date,
            v_task.task,
            now() at time zone 'Asia/Kolkata',
            'at once'
        );
    end loop;

    raise notice 'All tasks assigned to nurse %', v_nurse;
    return new;
end;
$function$;


-- 4. Update fn_generate_rmo_task (Trigger Function)
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


-- 5. Update fn_generate_icu_two_hour_tasks
create or replace function public.fn_generate_icu_two_hour_tasks()
returns void
language plpgsql
as $$
declare
    v_now time := (now() at time zone 'Asia/Kolkata')::time;
    v_shift text;
    ipd_row record;
    v_task record;
    v_nurse text;
    v_valid_nurses text[];
    v_nurse_name text;
begin
    -- 1. Determine current shift
    if v_now >= time '08:00' and v_now < time '14:00' then
        v_shift := 'Shift A';
    elsif v_now >= time '14:00' and v_now < time '20:00' then
        v_shift := 'Shift B';
    else
        v_shift := 'Shift C';
    end if;

    -- 2. Loop over IPD admissions with planned1 not null and actual1 null
    -- RESTRICT TO ICU WARDS ONLY
    for ipd_row in
        select *
        from ipd_admissions
        where planned1 is not null
          and actual1 is null
          and lower(ward_type) like '%icu%' 
    loop
        -- 3. Loop over tasks with staff = nurse and status = 'one hour' (Changed from two hours as per request)
        for v_task in
            select *
            from pre_defined_task
            where staff = 'nurse'
              and status = 'one hour'
        loop
            v_valid_nurses := array[]::text[];

            -- STEP 1: Get all nurses in this ward for the current shift from latest 3 roster rows
            for v_nurse_name in
                select jsonb_array_elements_text(
                    case
                        -- We only need to handle ICU here since we filtered for it in the loop
                        when lower(replace(ipd_row.ward_type,' ', '_')) like '%icu%' 
                            then (CASE WHEN coalesce(icu,'') <> '' THEN icu::jsonb ELSE '{}'::jsonb END)->'nurse'
                        else '[]'::jsonb -- Should not happen given the loop filter, but safe fallback
                    end
                ) as nurse_name
                from roster
                where shift = v_shift
                  and (start_date <= current_date OR start_date is null)
                order by created_at desc
                limit 3
            loop
                v_valid_nurses := array_append(v_valid_nurses, v_nurse_name);
            end loop;

            -- Remove duplicates
            v_valid_nurses := array(
                select distinct unnest(v_valid_nurses)
            );

            if array_length(v_valid_nurses, 1) is null then
                raise notice 'No valid nurses found for ward % and shift %', ipd_row.ward_type, v_shift;
                continue;
            end if;

            -- STEP 2: Get last nurse assigned for this patient on this shift
            select assign_nurse
            into v_nurse
            from nurse_assign_task
            where "Ipd_number" = ipd_row.ipd_number
              and shift = v_shift
            order by timestamp desc
            limit 1;

            -- STEP 3: Decide which nurse to assign
            if v_nurse is null or not v_nurse = any(v_valid_nurses) then
                -- Assign the nurse with least tasks today from valid roster nurses
                select nurse_name
                into v_nurse
                from unnest(v_valid_nurses) as nurse_name
                order by (
                    select count(*)
                    from nurse_assign_task nat
                    where nat.assign_nurse = nurse_name
                      and nat.shift = v_shift
                      and nat.start_date = current_date
                      and nat.status = 'one hour'
                )
                limit 1;
            end if;

            -- STEP 4: Insert task if a nurse is found
            if v_nurse is not null then
                insert into nurse_assign_task (
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
                values (
                   now() at time zone 'Asia/Kolkata',
                    ipd_row.ipd_number,
                    ipd_row.patient_name,
                    ipd_row.ward_type,
                    ipd_row.bed_location,
                    ipd_row.room,
                    ipd_row.bed_no,
                    v_shift,
                    v_nurse,
                    current_date,
                    'No',
                    v_task.task,
                    now() at time zone 'Asia/Kolkata',
                    'one hour'
                );
            end if;

        end loop;
    end loop;
end;
$$;

-- 6. Update fn_generate_pre_ot_nurse_tasks (Trigger Function)
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
    -- CAST OT TIME (TEXT â†’ TIME)
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
    -- PRE-OT NURSE TASKS (SAFE â€“ MULTIPLE ALLOWED)
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
    -- ðŸš« DUPLICATE GUARD FOR OT STAFF TASKS
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
$function$;
C R E A T E   O R   R E P L A C E   F U N C T I O N   p u b l i c . f n _ l a b _ g e n e r a t e _ n u r s e _ t a s k ( )  
   R E T U R N S   t r i g g e r  
   L A N G U A G E   p l p g s q l  
 A S   $ f u n c t i o n $  
 D E C L A R E  
         v _ s h i f t   T E X T ;  
         v _ s t a r t _ d a t e   D A T E ;  
         v _ t a s k   T E X T ;  
         v _ c u r r e n t _ t i m e   T I M E ;  
  
         v _ v a l i d _ n u r s e s   T E X T [ ]   : =   A R R A Y [ ] : : T E X T [ ] ;  
         v _ s e l e c t e d _ n u r s e   T E X T ;  
         v _ l a s t _ n u r s e   T E X T ;  
         v _ n a m e   T E X T ;  
 B E G I N  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         - -   F I R E   O N L Y   W H E N   C O N D I T I O N S   M A T C H  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         I F   O L D . a c t u a l 1   I S   N O T   N U L L  
               O R   N E W . a c t u a l 1   I S   N U L L  
               O R   N E W . p l a n n e d 2   I S   N U L L  
               O R   N E W . a c t u a l 2   I S   N O T   N U L L   T H E N  
                 R E T U R N   N E W ;  
         E N D   I F ;  
  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         - -   D E T E R M I N E   S H I F T   F R O M   C U R R E N T   T I M E   ( T R I G G E R   F I R E   T I M E )  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         - -   U s e   c u r r e n t   l o c a l   t i m e   f o r   s h i f t   d e t e r m i n a t i o n   a s   r e q u e s t e d  
         v _ c u r r e n t _ t i m e   : =   ( n o w ( )   A T   T I M E   Z O N E   ' A s i a / K o l k a t a ' ) : : t i m e ;  
          
         I F   v _ c u r r e n t _ t i m e   > =   T I M E   ' 0 8 : 0 0 '  
               A N D   v _ c u r r e n t _ t i m e   <   T I M E   ' 1 4 : 0 0 '   T H E N  
                 v _ s h i f t   : =   ' S h i f t   A ' ;  
         E L S I F   v _ c u r r e n t _ t i m e   > =   T I M E   ' 1 4 : 0 0 '  
               A N D   v _ c u r r e n t _ t i m e   <   T I M E   ' 2 0 : 0 0 '   T H E N  
                 v _ s h i f t   : =   ' S h i f t   B ' ;  
         E L S E  
                 v _ s h i f t   : =   ' S h i f t   C ' ;  
         E N D   I F ;  
  
         v _ s t a r t _ d a t e   : =   ( n o w ( )   A T   T I M E   Z O N E   ' A s i a / K o l k a t a ' ) : : d a t e ;  
  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         - -   F E T C H   L A B   T A S K   F O R   N U R S E  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         S E L E C T   t a s k  
         I N T O   v _ t a s k  
         F R O M   p r e _ d e f i n e d _ t a s k  
         W H E R E   s t a f f   =   ' n u r s e '  
             A N D   s t a t u s   =   ' l a b '  
         L I M I T   1 ;  
  
         I F   v _ t a s k   I S   N U L L   T H E N  
                 R E T U R N   N E W ;  
         E N D   I F ;  
  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         - -   F I N D   L A S T   A S S I G N E D   N U R S E   ( C O N T I N U I T Y )  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         S E L E C T   a s s i g n _ n u r s e  
         I N T O   v _ l a s t _ n u r s e  
         F R O M   n u r s e _ a s s i g n _ t a s k  
         W H E R E   " I p d _ n u m b e r "   =   N E W . i p d _ n u m b e r  
             A N D   s t a r t _ d a t e   =   v _ s t a r t _ d a t e  
         O R D E R   B Y   t i m e s t a m p   D E S C  
         L I M I T   1 ;  
  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         - -   F E T C H   A V A I L A B L E   N U R S E S   F R O M   L A T E S T   R O S T E R  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         F O R   v _ n a m e   I N  
                 W I T H   l a t e s t _ r o s t e r   A S   (  
                         S E L E C T   *  
                         F R O M   r o s t e r  
                         W H E R E   s h i f t   =   v _ s h i f t  
                             A N D   ( s t a r t _ d a t e   < =   c u r r e n t _ d a t e   O R   s t a r t _ d a t e   I S   N U L L )   - -   A d d e d   D a t e   L o g i c  
                         O R D E R   B Y   c r e a t e d _ a t   D E S C  
                         L I M I T   3   - -   I n c r e a s e d   f r o m   1   t o   3   f o r   f a l l b a c k   l o g i c  
                 )  
                 S E L E C T   j s o n b _ a r r a y _ e l e m e n t s _ t e x t (  
                         C A S E  
                                 - -   F I X :   C h e c k   F e m a l e   b e f o r e   M a l e   t o   s t r i c t l y   m a t c h   ' F e m a l e   G e n e r a l   W a r d '  
                                 - -   ' M a l e   G e n e r a l   W a r d '   c o n t a i n s   ' m a l e '   b u t   ' F e m a l e   G e n e r a l   W a r d '   a l s o   c o n t a i n s   ' m a l e '   ( i f   c a s e   i n s e n s i t i v e   w i t h o u t   b o u n d a r i e s )  
                                 - -   B u t   s p e c i f i c a l l y   ' F e m a l e . . . '   c o n t a i n s   ' m a l e '   i n s i d e   ' f e M A L E ' .  
                                 - -   C h e c k i n g   F e m a l e   f i r s t   e n s u r e s   w e   c a t c h   i t .  
                                 W H E N   L O W E R ( N E W . w a r d _ t y p e )   L I K E   ' % f e m a l e % '     T H E N   ( f e m a l e _ g e n e r a l _ w a r d : : j s o n b ) - > ' n u r s e '  
                                 W H E N   L O W E R ( N E W . w a r d _ t y p e )   L I K E   ' % m a l e % '         T H E N   ( m a l e _ g e n e r a l _ w a r d : : j s o n b ) - > ' n u r s e '  
                                 W H E N   L O W E R ( N E W . w a r d _ t y p e )   L I K E   ' % i c u % '           T H E N   ( i c u : : j s o n b ) - > ' n u r s e '  
                                 W H E N   L O W E R ( N E W . w a r d _ t y p e )   L I K E   ' % h d u % '           T H E N   ( h d u : : j s o n b ) - > ' n u r s e '  
                                 W H E N   L O W E R ( N E W . w a r d _ t y p e )   L I K E   ' % p r i v a t e % '   T H E N   ( p r i v a t e _ w a r d : : j s o n b ) - > ' n u r s e '  
                                 E L S E   ' [ ] ' : : j s o n b  
                         E N D  
                 )  
                 F R O M   l a t e s t _ r o s t e r  
         L O O P  
                 v _ v a l i d _ n u r s e s   : =   a r r a y _ a p p e n d ( v _ v a l i d _ n u r s e s ,   t r i m ( v _ n a m e ) ) ;  
         E N D   L O O P ;  
  
         I F   a r r a y _ l e n g t h ( v _ v a l i d _ n u r s e s ,   1 )   I S   N U L L   T H E N  
                 R E T U R N   N E W ;  
         E N D   I F ;  
  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         - -   P R I O R I T Y   1 :   R E U S E   L A S T   N U R S E   I F   A V A I L A B L E  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         I F   v _ l a s t _ n u r s e   =   A N Y   ( v _ v a l i d _ n u r s e s )   T H E N  
                 v _ s e l e c t e d _ n u r s e   : =   v _ l a s t _ n u r s e ;  
         E L S E  
                 - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                 - -   P R I O R I T Y   2 :   L E A S T   T A S K   C O U N T   N U R S E  
                 - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                 S E L E C T   n  
                 I N T O   v _ s e l e c t e d _ n u r s e  
                 F R O M   u n n e s t ( v _ v a l i d _ n u r s e s )   n  
                 O R D E R   B Y   (  
                         S E L E C T   C O U N T ( * )  
                         F R O M   n u r s e _ a s s i g n _ t a s k  
                         W H E R E   a s s i g n _ n u r s e   =   n  
                             A N D   s h i f t   =   v _ s h i f t  
                             A N D   s t a r t _ d a t e   =   v _ s t a r t _ d a t e  
                 )  
                 L I M I T   1 ;  
         E N D   I F ;  
  
         I F   v _ s e l e c t e d _ n u r s e   I S   N U L L   T H E N  
                 R E T U R N   N E W ;  
         E N D   I F ;  
  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         - -   I N S E R T   L A B   N U R S E   T A S K  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         I N S E R T   I N T O   n u r s e _ a s s i g n _ t a s k   (  
                 t i m e s t a m p ,  
                 " I p d _ n u m b e r " ,  
                 p a t i e n t _ n a m e ,  
                 w a r d _ t y p e ,  
                 p a t i e n t _ l o c a t i o n ,  
                 r o o m ,  
                 b e d _ n o ,  
                 s h i f t ,  
                 a s s i g n _ n u r s e ,  
                 s t a r t _ d a t e ,  
                 r e m i n d e r ,  
                 t a s k ,  
                 p l a n n e d 1 ,  
                 s t a t u s ,  
                 s t a f f  
         )  
         V A L U E S   (  
                 n o w ( )   A T   T I M E   Z O N E   ' A s i a / K o l k a t a ' ,  
                 N E W . i p d _ n u m b e r ,  
                 N E W . p a t i e n t _ n a m e ,  
                 N E W . w a r d _ t y p e ,  
                 N E W . l o c a t i o n ,  
                 N E W . r o o m ,  
                 N E W . b e d _ n o ,  
                 v _ s h i f t ,  
                 v _ s e l e c t e d _ n u r s e ,  
                 v _ s t a r t _ d a t e ,  
                 ' N o ' ,  
                 v _ t a s k ,  
                 n o w ( )   A T   T I M E   Z O N E   ' A s i a / K o l k a t a ' ,  
                 ' l a b ' ,  
                 ' n u r s e '  
         ) ;  
  
         R E T U R N   N E W ;  
 E N D ;  
 $ f u n c t i o n $  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p u b l i c . f n _ g e n e r a t e _ r m o _ s h i f t _ o n c e _ t a s k s ( )  
   R E T U R N S   v o i d  
   L A N G U A G E   p l p g s q l  
 A S   $ f u n c t i o n $  
 D E C L A R E  
         v _ s h i f t                 t e x t ;  
         v _ n o w                     t i m e   : =   ( n o w ( )   A T   T I M E   Z O N E   ' A s i a / K o l k a t a ' ) : : t i m e ;  
  
         i p d _ r o w                 r e c o r d ;  
         t a s k _ r o w               r e c o r d ;  
  
         v _ l a s t _ r m o           t e x t ;  
         v _ a s s i g n _ r m o       t e x t ;  
         v _ v a l i d _ r m o s       t e x t [ ] ;  
         v _ r m o _ n a m e           t e x t ;  
 B E G I N  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         - -   1 ï ¸  â ’£   D e t e r m i n e   c u r r e n t   s h i f t  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         I F   v _ n o w   > =   T I M E   ' 0 8 : 0 0 '   A N D   v _ n o w   <   T I M E   ' 1 4 : 0 0 '   T H E N  
                 v _ s h i f t   : =   ' S h i f t   A ' ;  
         E L S I F   v _ n o w   > =   T I M E   ' 1 4 : 0 0 '   A N D   v _ n o w   <   T I M E   ' 2 0 : 0 0 '   T H E N  
                 v _ s h i f t   : =   ' S h i f t   B ' ;  
         E L S E  
                 v _ s h i f t   : =   ' S h i f t   C ' ;  
         E N D   I F ;  
  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         - -   2 ï ¸  â ’£   L o o p   a c t i v e   I P D   a d m i s s i o n s  
         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
         F O R   i p d _ r o w   I N  
                 S E L E C T   *  
                 F R O M   i p d _ a d m i s s i o n s  
                 W H E R E   p l a n n e d 1   I S   N O T   N U L L  
                     A N D   a c t u a l 1   I S   N U L L  
         L O O P  
  
                 - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                 - -   3 ï ¸  â ’£   L o o p   R M O   s h i f t - o n c e   t a s k s  
                 - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                 F O R   t a s k _ r o w   I N  
                         S E L E C T   *  
                         F R O M   p r e _ d e f i n e d _ t a s k  
                         W H E R E   s t a f f   =   ' r m o '  
                             A N D   s t a t u s   =   ' s h i f t   o n c e '  
                 L O O P  
  
                         v _ a s s i g n _ r m o   : =   N U L L ;  
                         v _ v a l i d _ r m o s   : =   A R R A Y [ ] : : t e x t [ ] ;  
  
                         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                         - -   4 ï ¸  â ’£   G e t   v a l i d   R M O s   f r o m   r o s t e r   J S O N  
                         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                         F O R   v _ r m o _ n a m e   I N  
                                 S E L E C T   j s o n b _ a r r a y _ e l e m e n t s _ t e x t (  
                                         C A S E  
                                                 W H E N   l o w e r ( r e p l a c e ( i p d _ r o w . w a r d _ t y p e , '   ' ,   ' _ ' ) )   L I K E   ' % f e m a l e % '    
                                                         T H E N   ( f e m a l e _ g e n e r a l _ w a r d : : j s o n b ) - > ' r m o '  
                                                 W H E N   l o w e r ( r e p l a c e ( i p d _ r o w . w a r d _ t y p e , '   ' ,   ' _ ' ) )   L I K E   ' % m a l e % '    
                                                         T H E N   ( m a l e _ g e n e r a l _ w a r d : : j s o n b ) - > ' r m o '  
                                                 W H E N   l o w e r ( r e p l a c e ( i p d _ r o w . w a r d _ t y p e , '   ' ,   ' _ ' ) )   L I K E   ' % i c u % '    
                                                         T H E N   ( i c u : : j s o n b ) - > ' r m o '  
                                                 W H E N   l o w e r ( r e p l a c e ( i p d _ r o w . w a r d _ t y p e , '   ' ,   ' _ ' ) )   L I K E   ' % h d u % '    
                                                         T H E N   ( h d u : : j s o n b ) - > ' r m o '  
                                                 W H E N   l o w e r ( r e p l a c e ( i p d _ r o w . w a r d _ t y p e , '   ' ,   ' _ ' ) )   L I K E   ' % p r i v a t e % '    
                                                         T H E N   ( p r i v a t e _ w a r d : : j s o n b ) - > ' r m o '  
                                                 W H E N   l o w e r ( r e p l a c e ( i p d _ r o w . w a r d _ t y p e , '   ' ,   ' _ ' ) )   L I K E   ' % n i c u % '    
                                                         T H E N   ( n i c u : : j s o n b ) - > ' r m o '  
                                                 E L S E   ' [ ] ' : : j s o n b  
                                         E N D  
                                 )  
                                 F R O M   r o s t e r  
                                 W H E R E   s h i f t   =   v _ s h i f t  
                                     A N D   ( s t a r t _ d a t e   < =   c u r r e n t _ d a t e   O R   s t a r t _ d a t e   I S   N U L L )   - -   A d d e d   D a t e   L o g i c  
                                 O R D E R   B Y   c r e a t e d _ a t   D E S C  
                                 L I M I T   3  
                         L O O P  
                                 v _ v a l i d _ r m o s   : =   a r r a y _ a p p e n d ( v _ v a l i d _ r m o s ,   v _ r m o _ n a m e ) ;  
                         E N D   L O O P ;  
  
                         - -   R e m o v e   d u p l i c a t e s  
                         v _ v a l i d _ r m o s   : =   A R R A Y (  
                                 S E L E C T   D I S T I N C T   u n n e s t ( v _ v a l i d _ r m o s )  
                         ) ;  
  
                         I F   a r r a y _ l e n g t h ( v _ v a l i d _ r m o s ,   1 )   I S   N U L L   T H E N  
                                 C O N T I N U E ;  
                         E N D   I F ;  
  
                         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                         - -   5 ï ¸  â ’£   L a s t   a s s i g n e d   R M O   ( T H I S   F I X E S   Y O U R   E R R O R )  
                         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                         S E L E C T   r a t . a s s i g n _ r m o  
                         I N T O   v _ l a s t _ r m o  
                         F R O M   r m o _ a s s i g n _ t a s k   r a t  
                         W H E R E   r a t . i p d _ n u m b e r   =   i p d _ r o w . i p d _ n u m b e r  
                             A N D   r a t . s h i f t   =   v _ s h i f t  
                         O R D E R   B Y   r a t . t i m e s t a m p   D E S C  
                         L I M I T   1 ;  
  
                         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                         - -   6 ï ¸  â ’£   R e u s e   l a s t   R M O   i f   a v a i l a b l e  
                         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                         I F   v _ l a s t _ r m o   I S   N O T   N U L L   A N D   v _ l a s t _ r m o   =   A N Y ( v _ v a l i d _ r m o s )   T H E N  
                                 v _ a s s i g n _ r m o   : =   v _ l a s t _ r m o ;  
                         E N D   I F ;  
  
                         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                         - -   7 ï ¸  â ’£   A s s i g n   l e a s t - l o a d e d   R M O  
                         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                         I F   v _ a s s i g n _ r m o   I S   N U L L   T H E N  
                                 S E L E C T   r m o _ n a m e  
                                 I N T O   v _ a s s i g n _ r m o  
                                 F R O M   u n n e s t ( v _ v a l i d _ r m o s )   A S   r m o _ n a m e  
                                 O R D E R   B Y   (  
                                         S E L E C T   C O U N T ( * )  
                                         F R O M   r m o _ a s s i g n _ t a s k   r a t  
                                         W H E R E   r a t . a s s i g n _ r m o   =   r m o _ n a m e  
                                             A N D   r a t . s h i f t   =   v _ s h i f t  
                                             A N D   r a t . s t a r t _ d a t e   =   C U R R E N T _ D A T E  
                                             A N D   r a t . s t a t u s   =   ' s h i f t   o n c e '  
                                 )   A S C  
                                 L I M I T   1 ;  
                         E N D   I F ;  
  
                         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                         - -   8 ï ¸  â ’£   P r e v e n t   d u p l i c a t e   t a s k  
                         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                         I F   E X I S T S   (  
                                 S E L E C T   1  
                                 F R O M   r m o _ a s s i g n _ t a s k  
                                 W H E R E   i p d _ n u m b e r   =   i p d _ r o w . i p d _ n u m b e r  
                                     A N D   s h i f t   =   v _ s h i f t  
                                     A N D   t a s k   =   t a s k _ r o w . t a s k  
                                     A N D   s t a t u s   =   ' s h i f t   o n c e '  
                                     A N D   s t a r t _ d a t e   =   C U R R E N T _ D A T E  
                         )   T H E N  
                                 C O N T I N U E ;  
                         E N D   I F ;  
  
                         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                         - -   9 ï ¸  â ’£   I n s e r t   R M O   t a s k  
                         - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
                         I F   v _ a s s i g n _ r m o   I S   N O T   N U L L   T H E N  
                                 I N S E R T   I N T O   r m o _ a s s i g n _ t a s k   (  
                                         t i m e s t a m p ,  
                                         i p d _ n u m b e r ,  
                                         p a t i e n t _ n a m e ,  
                                         p a t i e n t _ l o c a t i o n ,  
                                         w a r d _ t y p e ,  
                                         r o o m ,  
                                         b e d _ n o ,  
                                         s h i f t ,  
                                         a s s i g n _ r m o ,  
                                         r e m i n d e r ,  
                                         s t a r t _ d a t e ,  
                                         t a s k ,  
                                         p l a n n e d 1 ,  
                                         s t a t u s  
                                 )  
                                 V A L U E S   (  
                                         n o w ( )   A T   T I M E   Z O N E   ' A s i a / K o l k a t a ' ,  
                                         i p d _ r o w . i p d _ n u m b e r ,  
                                         i p d _ r o w . p a t i e n t _ n a m e ,  
                                         i p d _ r o w . b e d _ l o c a t i o n ,  
                                         i p d _ r o w . w a r d _ t y p e ,  
                                         i p d _ r o w . r o o m ,  
                                         i p d _ r o w . b e d _ n o ,  
                                         v _ s h i f t ,  
                                         v _ a s s i g n _ r m o ,  
                                         ' N o ' ,  
                                         C U R R E N T _ D A T E ,  
                                         t a s k _ r o w . t a s k ,  
                                         n o w ( )   A T   T I M E   Z O N E   ' A s i a / K o l k a t a ' ,  
                                         ' s h i f t   o n c e '  
                                 ) ;  
                         E N D   I F ;  
  
                 E N D   L O O P ;  
         E N D   L O O P ;  
 E N D ;  
 $ f u n c t i o n $  
 