


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_multiple_beds"("p_floor" "text", "p_ward" "text", "p_room" "text", "p_count" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  last_bed_num INT;
  last_serial_num INT;
  i INT;
BEGIN
  -- Get last bed number for this room
  SELECT COALESCE(MAX(
    CAST(REGEXP_REPLACE(bed, '\D', '', 'g') AS INT)
  ), 0)
  INTO last_bed_num
  FROM all_floor_bed
  WHERE floor = p_floor
    AND ward = p_ward
    AND room = p_room;

  -- Get last serial number globally
  SELECT COALESCE(MAX(
    CAST(REGEXP_REPLACE(serial_no, '\D', '', 'g') AS INT)
  ), 0)
  INTO last_serial_num
  FROM all_floor_bed;

  -- Insert multiple beds
  FOR i IN 1..p_count LOOP
    INSERT INTO all_floor_bed (
      floor,
      ward,
      room,
      bed,
      serial_no
    )
    VALUES (
      p_floor,
      p_ward,
      p_room,
      'BED-' || LPAD((last_bed_num + i)::text, 2, '0'),
      'SN-' || (last_serial_num + i)::text
    );
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."add_multiple_beds"("p_floor" "text", "p_ward" "text", "p_room" "text", "p_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cron_admin_eod_summary"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    -- 👇 यहाँ अपना नया नंबर डालें (with country code 91)
    v_admin_phone TEXT := '916267799443';
    v_today_start TIMESTAMPTZ := (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata');
    v_today_end   TIMESTAMPTZ := (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 day';
    v_completed INTEGER := 0;
    v_pending INTEGER := 0;
    v_overdue INTEGER := 0;
    v_rate NUMERIC := 0;
    v_date_str TEXT := to_char(CURRENT_DATE AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY');
    v_msg TEXT;
BEGIN
    SELECT COUNT(*) INTO v_completed
    FROM checklist
    WHERE submission_date >= v_today_start AND submission_date < v_today_end;

    SELECT COUNT(*) INTO v_pending
    FROM checklist
    WHERE planned_date >= v_today_start AND planned_date < v_today_end
      AND (submission_date IS NULL OR status NOT IN ('done', 'completed'));

    SELECT COUNT(*) INTO v_overdue
    FROM checklist
    WHERE planned_date < v_today_start
      AND submission_date IS NULL;

    IF (v_completed + v_pending) > 0 THEN
        v_rate := ROUND((v_completed::NUMERIC / (v_completed + v_pending)::NUMERIC) * 100, 1);
    ELSE
        v_rate := 100;
    END IF;

    v_msg := '📊 *DAILY OPERATIONS SUMMARY*' || E'\n' ||
             '📅 Date: *' || v_date_str || '*' || E'\n\n' ||
             'Executive summary of operational performance today:' || E'\n\n' ||
             '✅ *Tasks Completed Today:* ' || v_completed || E'\n' ||
             '⏳ *Pending in Progress:* ' || v_pending || E'\n' ||
             '🚨 *Overdue Items:* ' || v_overdue || E'\n' ||
             '📈 *Today’s Completion Rate:* ' || v_rate || '%' || E'\n\n' ||
             '👉 Detailed breakdown is available on your Admin Dashboard.';

    PERFORM send_maytapi_whatsapp(v_admin_phone, v_msg);
END;
$$;


ALTER FUNCTION "public"."cron_admin_eod_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cron_admin_pending_approvals"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    -- 👇 यहाँ अपना नया नंबर डालें (with country code 91)
    v_admin_phone TEXT := '916267799443'; 
    v_pending_checklist INTEGER := 0;
    v_pending_delegation INTEGER := 0;
    v_pending_ea INTEGER := 0;
    v_pending_repair INTEGER := 0;
    v_total_pending INTEGER := 0;
    v_msg TEXT;
BEGIN
    SELECT COUNT(*) INTO v_pending_checklist
    FROM checklist
    WHERE admin_done = false AND submission_date IS NOT NULL;

    SELECT COUNT(*) INTO v_pending_delegation
    FROM delegation_done
    WHERE admin_done = false;

    SELECT COUNT(*) INTO v_pending_ea
    FROM ea_tasks_done
    WHERE admin_done = false;

    SELECT COUNT(*) INTO v_pending_repair
    FROM repair_tasks
    WHERE admin_done = false AND (status ILIKE '%Pending Approval%' OR status ILIKE '%Completed%');

    v_total_pending := v_pending_checklist + v_pending_delegation + v_pending_ea + v_pending_repair;

    IF v_total_pending > 0 THEN
        v_msg := '🔔 *PENDING ADMIN APPROVALS*' || E'\n\n' ||
                 'Hello *Admin*, you have task submissions awaiting your verification:' || E'\n\n' ||
                 '▫️ *Checklist Submissions:* ' || v_pending_checklist || E'\n' ||
                 '▫️ *Delegated Submissions:* ' || v_pending_delegation || E'\n' ||
                 '▫️ *EA Tasks:* ' || v_pending_ea || E'\n' ||
                 '▫️ *Breakdown & Repairs:* ' || v_pending_repair || E'\n\n' ||
                 '📊 *Total Awaiting Approval:* ' || v_total_pending || ' item(s)' || E'\n' ||
                 '👉 Please open the Admin Approval Portal to review and approve.';

        PERFORM send_maytapi_whatsapp(v_admin_phone, v_msg);
    END IF;
END;
$$;


ALTER FUNCTION "public"."cron_admin_pending_approvals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_nurse_task_on_ot_cancel"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only act when status changes to 'cancel'
  IF NEW.status = 'Cancel' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    DELETE FROM nurse_assign_task
    WHERE ot_number = NEW.ot_number;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."delete_nurse_task_on_ot_cancel"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_patient_completely"("p_ipd_number" "text", "p_admission_no" "text", "p_deleted_by" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  v_patient_name TEXT;
  v_floor TEXT;
  v_ward TEXT;
  v_room TEXT;
  v_bed TEXT;
  v_dressing_count INT;
  v_nurse_count INT;
  v_rmo_count INT;
  v_ot_count INT;
  v_lab_count INT;
  v_pharmacy_count INT;
  v_discharge_count INT;
  v_ipd_count INT;
  v_admission_count INT;
  v_summary JSONB;
BEGIN
  -- Get patient info for audit + bed freeing
  SELECT patient_name, floor, ward_type, room, bed_no
  INTO v_patient_name, v_floor, v_ward, v_room, v_bed
  FROM ipd_admissions
  WHERE ipd_number = p_ipd_number
  LIMIT 1;

  IF v_patient_name IS NULL THEN
    RAISE EXCEPTION 'Patient with IPD number % not found', p_ipd_number;
  END IF;

  -- Delete dressing records
  DELETE FROM dressing WHERE ipd_number = p_ipd_number;
  GET DIAGNOSTICS v_dressing_count = ROW_COUNT;

  -- Delete nursing tasks (note: capital I in column name)
  DELETE FROM nurse_assign_task WHERE "Ipd_number" = p_ipd_number;
  GET DIAGNOSTICS v_nurse_count = ROW_COUNT;

  -- Delete RMO tasks
  DELETE FROM rmo_assign_task WHERE ipd_number = p_ipd_number;
  GET DIAGNOSTICS v_rmo_count = ROW_COUNT;

  -- Delete OT information
  DELETE FROM ot_information WHERE ipd_number = p_ipd_number;
  GET DIAGNOSTICS v_ot_count = ROW_COUNT;

  -- Delete lab records (match by ipd_number OR admission_no)
  DELETE FROM lab
  WHERE ipd_number = p_ipd_number
     OR admission_no = p_admission_no;
  GET DIAGNOSTICS v_lab_count = ROW_COUNT;

  -- Delete pharmacy records
  DELETE FROM pharmacy WHERE ipd_number = p_ipd_number;
  GET DIAGNOSTICS v_pharmacy_count = ROW_COUNT;

  -- Delete discharge records (match by admission_no OR ipd_number)
  DELETE FROM discharge
  WHERE admission_no = p_admission_no;
  GET DIAGNOSTICS v_discharge_count = ROW_COUNT;

  -- Delete IPD admission record
  DELETE FROM ipd_admissions WHERE ipd_number = p_ipd_number;
  GET DIAGNOSTICS v_ipd_count = ROW_COUNT;

  -- Delete patient admission record
  DELETE FROM patient_admission WHERE admission_no = p_admission_no;
  GET DIAGNOSTICS v_admission_count = ROW_COUNT;

  -- Free the bed (set status to null = available)
  IF v_floor IS NOT NULL AND v_ward IS NOT NULL AND v_room IS NOT NULL AND v_bed IS NOT NULL THEN
    UPDATE all_floor_bed
    SET status = NULL
    WHERE floor = v_floor
      AND ward = v_ward
      AND room = v_room
      AND bed = v_bed;
  END IF;

  -- Build summary
  v_summary := jsonb_build_object(
    'patient_name', v_patient_name,
    'ipd_number', p_ipd_number,
    'admission_no', p_admission_no,
    'deleted_records', jsonb_build_object(
      'dressing', v_dressing_count,
      'nurse_assign_task', v_nurse_count,
      'rmo_assign_task', v_rmo_count,
      'ot_information', v_ot_count,
      'lab', v_lab_count,
      'pharmacy', v_pharmacy_count,
      'discharge', v_discharge_count,
      'ipd_admissions', v_ipd_count,
      'patient_admission', v_admission_count
    ),
    'bed_freed', (v_floor IS NOT NULL)
  );

  -- Insert audit log
  INSERT INTO patient_deletion_log (ipd_number, admission_no, patient_name, deleted_by, deletion_summary)
  VALUES (p_ipd_number, p_admission_no, v_patient_name, p_deleted_by, v_summary);

  RETURN v_summary;
END;$$;


ALTER FUNCTION "public"."delete_patient_completely"("p_ipd_number" "text", "p_admission_no" "text", "p_deleted_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_block_unpaid_lab_start"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Block ONLY when trying to START lab (actual1 set)
    IF NEW.actual1 IS NOT NULL
       AND OLD.actual1 IS NULL
       AND NEW.payment_status <> 'Yes' THEN
        RAISE EXCEPTION 'Payment not completed. Cannot start lab process.';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_block_unpaid_lab_start"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_create_nurse_tasks"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
    v_shift text;
    v_now time := (now() at time zone 'Asia/Kolkata')::time;
    v_task record;
    v_nurse text;
    v_ward text;

    v_roster_column text;
    v_roster_json jsonb;
BEGIN
    -- 1. Detect shift
    IF v_now >= time '08:00' AND v_now < time '14:00' THEN
        v_shift := 'Shift A';
    ELSIF v_now >= time '14:00' AND v_now < time '20:00' THEN
        v_shift := 'Shift B';
    ELSE
        v_shift := 'Shift C';
    END IF;

    -- 2. Normalize ward
    v_ward := trim(
        both '_' from
        regexp_replace(
            lower(
                regexp_replace(trim(coalesce(new.ward_type, '')), '[()]', ' ', 'g')
            ),
            '\s+',
            '_',
            'g'
        )
    );

    -- 3. Roster column for this ward
    SELECT roster_column
    INTO v_roster_column
    FROM ward_config
    WHERE ward_name = v_ward;

    IF v_roster_column IS NULL THEN
        RAISE NOTICE 'No mapping for ward %', v_ward;
        RETURN NEW;
    END IF;

    -- 4. Latest roster on or before today that has nurses for this ward
    EXECUTE format(
        'SELECT NULLIF(btrim(%1$I), '''')::jsonb
           FROM roster
          WHERE shift = $1
            AND (start_date <= current_date OR start_date IS NULL)
            AND NULLIF(btrim(%1$I), '''') IS NOT NULL
          ORDER BY start_date DESC NULLS LAST, created_at DESC
          LIMIT 1',
        v_roster_column
    )
    INTO v_roster_json
    USING v_shift;

    IF v_roster_json IS NULL THEN
        RAISE NOTICE 'No roster found for ward %, shift %', v_ward, v_shift;
        RETURN NEW;
    END IF;

    -- 5. Least loaded nurse (filters inside the JOIN so idx_nat_assign_lookup is used)
    SELECT n.nurse_name
    INTO v_nurse
    FROM (
        SELECT jsonb_array_elements_text(v_roster_json->'nurse') AS nurse_name
    ) n
    LEFT JOIN nurse_assign_task nat
        ON nat.assign_nurse = n.nurse_name
       AND nat.shift = v_shift
       AND nat.start_date = current_date
       AND nat.status IN ('at once','picu','nicu','hdu','icu')
    GROUP BY n.nurse_name
    ORDER BY count(nat.id) ASC
    LIMIT 1;

    -- 6. Safety
    IF v_nurse IS NULL THEN
        RAISE NOTICE 'No nurse available for %, shift %', new.ward_type, v_shift;
        RETURN NEW;
    END IF;

    -- 6.5 Ward change: remove today's pending auto tasks for the old ward
    IF TG_OP = 'UPDATE' THEN
        IF OLD.ward_type IS DISTINCT FROM NEW.ward_type THEN
            DELETE FROM nurse_assign_task
            WHERE "Ipd_number" = NEW.ipd_number
              AND start_date = current_date
              AND actual1 IS NULL
              AND status IN ('at once', 'picu', 'nicu', 'hdu', 'icu')
              AND (staff IS NULL OR staff = 'nurse');
        END IF;
    END IF;

    -- 7. Standard tasks
    FOR v_task IN
        SELECT task
        FROM pre_defined_task
        WHERE staff = 'nurse'
          AND status = 'at once'
    LOOP
        INSERT INTO nurse_assign_task (
            timestamp, "Ipd_number", patient_location, patient_name,
            ward_type, reminder, room, bed_no, shift,
            assign_nurse, start_date, task, planned1, status
        )
        VALUES (
            now() at time zone 'Asia/Kolkata',
            new.ipd_number, new.bed_location, new.patient_name,
            new.ward_type, 'No', new.room, new.bed_no,
            v_shift, v_nurse, current_date,
            v_task.task, now() at time zone 'Asia/Kolkata', 'at once'
        );
    END LOOP;

    -- 8. PICU tasks
    IF v_ward = 'picu' THEN
        FOR v_task IN
            SELECT task FROM pre_defined_task
            WHERE staff = 'nurse' AND status = 'picu'
        LOOP
            INSERT INTO nurse_assign_task (
                timestamp, "Ipd_number", patient_location, patient_name,
                ward_type, reminder, room, bed_no, shift,
                assign_nurse, start_date, task, planned1, status
            )
            VALUES (
                now() at time zone 'Asia/Kolkata',
                new.ipd_number, new.bed_location, new.patient_name,
                new.ward_type, 'No', new.room, new.bed_no,
                v_shift, v_nurse, current_date,
                v_task.task, now() at time zone 'Asia/Kolkata', 'picu'
            );
        END LOOP;
    END IF;

    -- 9. NICU tasks
    IF v_ward = 'nicu' THEN
        FOR v_task IN
            SELECT task FROM pre_defined_task
            WHERE staff = 'nurse' AND status = 'nicu'
        LOOP
            INSERT INTO nurse_assign_task (
                timestamp, "Ipd_number", patient_location, patient_name,
                ward_type, reminder, room, bed_no, shift,
                assign_nurse, start_date, task, planned1, status
            )
            VALUES (
                now() at time zone 'Asia/Kolkata',
                new.ipd_number, new.bed_location, new.patient_name,
                new.ward_type, 'No', new.room, new.bed_no,
                v_shift, v_nurse, current_date,
                v_task.task, now() at time zone 'Asia/Kolkata', 'nicu'
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."fn_create_nurse_tasks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_create_nurse_tasks_picu"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
    v_shift text;
    v_now time := (now() at time zone 'Asia/Kolkata')::time;
    v_task record;
    v_nurse text;
begin
    -- 0. Guard Clause: Run only if ward_type is PICU
    -- (This is a secondary check, the primary check is in the TRIGGER condition)
    IF NEW.ward_type IS NULL OR lower(replace(NEW.ward_type,' ', '_')) NOT LIKE '%picu%' THEN
        RETURN NEW;
    END IF;

    -- 1. Detect shift
    if v_now >= time '08:00' and v_now < time '14:00' then
        v_shift := 'Shift A';
    elsif v_now >= time '14:00' and v_now < time '20:00' then
        v_shift := 'Shift B';
    else
        v_shift := 'Shift C';
    end if;

    /*
      STEP 1: PICK ONE NURSE WITH MINIMUM "picu" or "at once" TASKS
      We look for nurses in the 'picu' column of the roster.
    */
    select nurse_name
    into v_nurse
    from (
        select
            jsonb_array_elements_text(
                -- Check for 'picu' column. 
                -- We assume the roster table has a 'picu' column similar to 'icu' or 'nicu'.
                (CASE WHEN coalesce(picu,'') <> '' THEN picu::jsonb ELSE '{"nurse":[]}'::jsonb END)->'nurse'
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
          -- Balancing load based on tasks with 'picu' status. 
          -- If you want to balance against ALL tasks, remove the status check.
          and nat.status = 'picu' 
    )
    limit 1;

    -- SAFETY
    if v_nurse is null then
        raise notice 'No nurse found for PICU, ward %, shift %', new.ward_type, v_shift;
        return new;
    end if;

    /*
      STEP 2: ASSIGN TASKS TO THE SELECTED NURSE
      Fetching tasks where staff is 'nurse' and status is 'picu'
    */
    for v_task in
        select task
        from pre_defined_task
        where staff = 'nurse'
          and status = 'picu'
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
            'picu'
        );
    end loop;

    raise notice 'All PICU tasks assigned to nurse %', v_nurse;
    return new;
end;
$$;


ALTER FUNCTION "public"."fn_create_nurse_tasks_picu"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_create_rmo_tasks_from_nurse"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
    v_shift text;
    v_now time := (now() at time zone 'Asia/Kolkata')::time;
    v_rmo text;
    v_task record;
    v_exists boolean;
begin
    /* ------------------------------------------------
       RUN ONLY WHEN actual1 IS UPDATED
    ------------------------------------------------ */
    if tg_op <> 'UPDATE' then
        return new;
    end if;

    if old.actual1 is not null or new.actual1 is null then
        return new;
    end if;

    /* ------------------------------------------------
       REQUIRED CONDITIONS
    ------------------------------------------------ */
    if new.task <> 'Inform To RMO'
       or new.status <> 'at once' then
        return new;
    end if;

    /* ------------------------------------------------
       CHECK EXISTING RMO TASK (status = at once)
    ------------------------------------------------ */
    select exists (
        select 1
        from rmo_assign_task
        where ipd_number = new.ipd_number
          and status = 'at once'
    ) into v_exists;

    if v_exists then
        return new;
    end if;

    /* ------------------------------------------------
       SHIFT DETECTION
    ------------------------------------------------ */
    if v_now >= time '08:00' and v_now < time '14:00' then
        v_shift := 'Shift A';
    elsif v_now >= time '14:00' and v_now < time '20:00' then
        v_shift := 'Shift B';
    else
        v_shift := 'Shift C';
    end if;

    /* ------------------------------------------------
       PICK RMO (MIN LOAD)
    ------------------------------------------------ */
    select rmo_name
    into v_rmo
    from (
        select jsonb_array_elements_text(
            case
                when lower(replace(new.ward_type,' ', '_')) like '%male%' 
                    then (male_general_ward::jsonb)->'rmo'
                when lower(replace(new.ward_type,' ', '_')) like '%female%' 
                    then (female_general_ward::jsonb)->'rmo'
                when lower(replace(new.ward_type,' ', '_')) like '%icu%' 
                    then (icu::jsonb)->'rmo'
                when lower(replace(new.ward_type,' ', '_')) like '%hdu%' 
                    then (hdu::jsonb)->'rmo'
                when lower(replace(new.ward_type,' ', '_')) like '%private%' 
                    then (private_ward::jsonb)->'rmo'
                when lower(replace(new.ward_type,' ', '_')) like '%nicu%' 
                    then (nicu::jsonb)->'rmo'
            end
        ) as rmo_name
        from roster
        where shift = v_shift
        order by created_at desc
        limit 3
    ) rmos
    where rmo_name is not null
    group by rmo_name
    order by (
        select count(*)
        from rmo_assign_task rat
        where rat.assign_rmo = rmo_name
          and rat.shift = v_shift
          and rat.start_date = current_date
          and rat.status = 'at once'
    )
    limit 1;

    if v_rmo is null then
        return new;
    end if;

    /* ------------------------------------------------
       GENERATE RMO TASKS
    ------------------------------------------------ */
    for v_task in
        select task
        from pre_defined_task
        where staff = 'rmo'
          and status = 'at once'
    loop
        insert into rmo_assign_task (
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
        values (
            now() at time zone 'Asia/Kolkata',
            new.ipd_number,
            new.patient_name,
            new.patient_location,
            new.ward_type,
            new.room,
            new.bed_no,
            v_shift,
            v_rmo,
            'No',
            current_date,
            v_task.task,
            now() at time zone 'Asia/Kolkata',
            'at once'
        );
    end loop;

    return new;
end;
$$;


ALTER FUNCTION "public"."fn_create_rmo_tasks_from_nurse"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_generate_icu_two_hour_tasks"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$declare
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
FOR ipd_row IN
    SELECT ia.*
    FROM ipd_admissions ia
    JOIN ward_config wc
      ON lower(replace(ia.ward_type, ' ', '_')) = wc.ward_name
    WHERE ia.planned1 IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 
          FROM discharge d 
          WHERE d.admission_no = ia.admission_no
      )
      AND wc.ward_name = 'icu'
LOOP

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
end;$$;


ALTER FUNCTION "public"."fn_generate_icu_two_hour_tasks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_generate_nurse_shift_once_tasks"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$DECLARE
    v_shift        text;
    v_now          time := (now() AT TIME ZONE 'Asia/Kolkata')::time;

    ipd_row        record;
    task_row       record;

    v_last_nurse   text;
    v_assign_nurse text;
    v_valid_nurses text[];
    v_nurse_name   text;

    v_roster_column text;
    v_roster_json   jsonb;
    v_ward          text;
BEGIN
    -------------------------------------------------------
    -- 1️⃣ Determine shift
    -------------------------------------------------------
    IF v_now >= TIME '08:00' AND v_now < TIME '14:00' THEN
        v_shift := 'Shift A';
    ELSIF v_now >= TIME '14:00' AND v_now < TIME '20:00' THEN
        v_shift := 'Shift B';
    ELSE
        v_shift := 'Shift C';
    END IF;

    -------------------------------------------------------
    -- 2️⃣ Loop IPD patients
    -------------------------------------------------------
  FOR ipd_row IN
    SELECT ia.*
    FROM ipd_admissions ia
    WHERE ia.planned1 IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 
          FROM discharge d 
          WHERE d.admission_no = ia.admission_no
      )
LOOP
        -------------------------------------------------------
        -- ✅ NORMALIZE WARD (YOUR FIX APPLIED)
        -------------------------------------------------------
        v_ward := trim(
            both '_' from
            regexp_replace(
                lower(
                    regexp_replace(trim(coalesce(ipd_row.ward_type, '')), '[()]', ' ', 'g')
                ),
                '\s+',
                '_',
                'g'
            )
        );


        -------------------------------------------------------
        -- 3️⃣ Get roster column dynamically
        -------------------------------------------------------
        SELECT wc.roster_column
        INTO v_roster_column
        FROM ward_config wc
        WHERE wc.ward_name = v_ward
        LIMIT 1;

        -- Skip if no mapping found
        IF v_roster_column IS NULL THEN
            CONTINUE;
        END IF;

        -------------------------------------------------------
        -- 4️⃣ Fetch nurses dynamically from roster
        -------------------------------------------------------
        v_valid_nurses := ARRAY[]::text[];

        EXECUTE format(
            'SELECT %I FROM roster 
             WHERE shift = $1 
               AND (start_date <= current_date OR start_date IS NULL)
             ORDER BY created_at DESC 
             LIMIT 1',
            v_roster_column
        )
        INTO v_roster_json
        USING v_shift;

        -- Extract nurse list
        IF v_roster_json IS NOT NULL THEN
            FOR v_nurse_name IN
                SELECT jsonb_array_elements_text(v_roster_json->'nurse')
            LOOP
                v_valid_nurses := array_append(v_valid_nurses, v_nurse_name);
            END LOOP;
        END IF;

        -- Remove duplicates
        v_valid_nurses := ARRAY(
            SELECT DISTINCT unnest(v_valid_nurses)
        );

        -- Skip if no nurses available
        IF array_length(v_valid_nurses, 1) IS NULL THEN
            CONTINUE;
        END IF;

        -------------------------------------------------------
        -- 5️⃣ Loop tasks
        -------------------------------------------------------
        FOR task_row IN
            SELECT *
            FROM pre_defined_task
            WHERE staff = 'nurse'
              AND status = 'shift once'
        LOOP

            v_assign_nurse := NULL;

            ---------------------------------------------------
            -- 6️⃣ Get last assigned nurse
            ---------------------------------------------------
            SELECT nat.assign_nurse
            INTO v_last_nurse
            FROM nurse_assign_task nat
            WHERE nat."Ipd_number" = ipd_row.ipd_number 
              AND nat.shift = v_shift
            ORDER BY nat.timestamp DESC
            LIMIT 1;

            ---------------------------------------------------
            -- 7️⃣ Reuse if still valid
            ---------------------------------------------------
            IF v_last_nurse IS NOT NULL 
               AND v_last_nurse = ANY(v_valid_nurses) THEN
                v_assign_nurse := v_last_nurse;
            END IF;

            ---------------------------------------------------
            -- 8️⃣ Else assign least loaded nurse
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
            -- 9️⃣ Prevent duplicate tasks
            ---------------------------------------------------
            IF EXISTS (
                SELECT 1
                FROM nurse_assign_task
                WHERE "Ipd_number" = ipd_row.ipd_number
                  AND shift = v_shift
                  AND task = task_row.task
                  AND status = 'shift once'
                  AND start_date = CURRENT_DATE
            ) THEN
                CONTINUE;
            END IF;

            ---------------------------------------------------
            -- 🔟 Insert assignment
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
END;$_$;


ALTER FUNCTION "public"."fn_generate_nurse_shift_once_tasks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_generate_pre_ot_nurse_tasks"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$DECLARE
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

IF NEW.actual1 IS NULL
   OR NEW.planned2 IS NULL
   OR NEW.ot_time IS NULL
   OR NEW.ot_date IS NULL THEN
    RETURN NEW;
END IF;

v_ot_time := NEW.ot_time::time;

IF v_ot_time >= TIME '08:00' AND v_ot_time < TIME '14:00' THEN
    v_shift := 'Shift A';
ELSIF v_ot_time >= TIME '14:00' AND v_ot_time < TIME '20:00' THEN
    v_shift := 'Shift B';
ELSE
    v_shift := 'Shift C';
END IF;

FOR v_name IN
    WITH latest_roster AS (
        SELECT *
        FROM roster
        WHERE shift = v_shift
          AND (start_date <= current_date OR start_date IS NULL)
        ORDER BY created_at DESC
        LIMIT 3
    )
    SELECT jsonb_array_elements_text(
        CASE
            WHEN LOWER(NEW.ward_type) LIKE '%female%'  THEN (female_general_ward::jsonb)->'nurse'
            WHEN LOWER(NEW.ward_type) LIKE '%male%'    THEN (male_general_ward::jsonb)->'nurse'
            WHEN LOWER(NEW.ward_type) LIKE '%nicu%'    THEN (nicu::jsonb)->'nurse'
            WHEN LOWER(NEW.ward_type) LIKE '%picu%'    THEN (picu::jsonb)->'nurse'
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

FOR v_name IN
    WITH latest_roster AS (
        SELECT *
        FROM roster
        WHERE shift = v_shift
          AND (start_date <= current_date OR start_date IS NULL)
        ORDER BY created_at DESC
        LIMIT 3
    )
    SELECT jsonb_array_elements_text(
        CASE
            WHEN LOWER(NEW.ward_type) LIKE '%female%'  THEN (female_general_ward::jsonb)->'ot'
            WHEN LOWER(NEW.ward_type) LIKE '%male%'    THEN (male_general_ward::jsonb)->'ot'
            WHEN LOWER(NEW.ward_type) LIKE '%nicu%'    THEN (nicu::jsonb)->'ot'
            WHEN LOWER(NEW.ward_type) LIKE '%picu%'    THEN (picu::jsonb)->'ot'
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

FOR v_task IN
    SELECT task, status
    FROM pre_defined_task
    WHERE staff = 'nurse'
      AND status IN ('pre OT','post OT')
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

IF EXISTS (
    SELECT 1
    FROM nurse_assign_task
    WHERE "Ipd_number" = NEW.ipd_number
      AND staff = 'OT Staff'
      AND ot_number = NEW.ot_number
) THEN
    RETURN NEW;
END IF;

SELECT DISTINCT ot_name
INTO v_ot_staff
FROM unnest(v_valid_ot_staff) AS ot_name
WHERE ot_name IS NOT NULL
LIMIT 1;

IF v_ot_staff IS NULL THEN
    RETURN NEW;
END IF;

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
END;$$;


ALTER FUNCTION "public"."fn_generate_pre_ot_nurse_tasks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_generate_rmo_shift_once_tasks"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$DECLARE
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
    SELECT ia.*
    FROM ipd_admissions ia
    WHERE ia.planned1 IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 
          FROM discharge d 
          WHERE d.admission_no = ia.admission_no
      )
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
                        WHEN lower(replace(ipd_row.ward_type,' ', '_')) LIKE '%picu%' 
                            THEN (picu::jsonb)->'rmo'
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
END;$$;


ALTER FUNCTION "public"."fn_generate_rmo_shift_once_tasks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_generate_rmo_task"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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
                    WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%picu%' 
                        THEN (picu::jsonb)->'rmo'                 
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


ALTER FUNCTION "public"."fn_generate_rmo_task"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_generate_rmo_task_baby_received"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_exists BOOLEAN;
    v_shift  TEXT;
    v_now    TIME := (now() AT TIME ZONE 'Asia/Kolkata')::time;
    v_rmo    TEXT;
    v_task   RECORD;
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

    -- Only trigger once
    IF OLD.actual1 IS NOT NULL THEN
        RETURN NEW;
    END IF;

    /* --------------------------------------------------
       2. UNIQUENESS CHECK (IPD + PICU)
    -------------------------------------------------- */
    SELECT EXISTS (
        SELECT 1
        FROM rmo_assign_task
        WHERE ipd_number = NEW."Ipd_number"
          AND status = 'picu'
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
       4. PICK RMO FROM ROSTER (LOAD BALANCED)
    -------------------------------------------------- */
    SELECT rmo_name
    INTO v_rmo
    FROM (
        SELECT jsonb_array_elements_text(
            CASE
                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%picu%' THEN
                    (CASE
                        WHEN COALESCE(picu,'') <> '' THEN picu::jsonb
                        ELSE '{"rmo":[]}'::jsonb
                     END)->'rmo'

                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%icu%' THEN
                    icu::jsonb->'rmo'

                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%hdu%' THEN
                    hdu::jsonb->'rmo'

                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%nicu%' THEN
                    nicu::jsonb->'rmo'

                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%female%' THEN
                    female_general_ward::jsonb->'rmo'

                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%male%' THEN
                    male_general_ward::jsonb->'rmo'

                WHEN LOWER(REPLACE(NEW.ward_type,' ', '_')) LIKE '%private%' THEN
                    private_ward::jsonb->'rmo'

                ELSE
                    '{"rmo":[]}'::jsonb->'rmo'
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
          AND rat.status = 'picu'
    ) ASC
    LIMIT 1;

    IF v_rmo IS NULL THEN
        RAISE NOTICE
            'No RMO found for ward %, shift % (Baby Received Logic)',
            NEW.ward_type, v_shift;
        RETURN NEW;
    END IF;

    /* --------------------------------------------------
       5. INSERT RMO TASKS
    -------------------------------------------------- */
    FOR v_task IN
        SELECT task
        FROM pre_defined_task
        WHERE staff = 'rmo'
          AND status = 'picu'
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
            'picu'
        );
    END LOOP;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_generate_rmo_task_baby_received"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_generate_rmo_task_baby_received_nicu"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
    IF LOWER(NEW.task) <> 'baby received in nicu' THEN
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
$$;


ALTER FUNCTION "public"."fn_generate_rmo_task_baby_received_nicu"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_generate_two_hour_tasks"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$declare
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

    -- 2. Loop over IPD admissions (NON-ICU)
 FOR ipd_row IN
    SELECT ia.*
    FROM ipd_admissions ia
    JOIN ward_config wc
      ON lower(replace(ia.ward_type, ' ', '_')) = wc.ward_name
    WHERE ia.planned1 IS NOT NULL
      AND wc.ward_name <> 'icu'
      AND NOT EXISTS (
          SELECT 1
          FROM discharge d
          WHERE d.admission_no = ia.admission_no
      )
LOOP

        -- 3. Loop over two-hour nurse tasks
        for v_task in
            select *
            from pre_defined_task
            where staff = 'nurse'
              and status = 'two hours'
        loop
            v_valid_nurses := array[]::text[];

            -- STEP 1: Get nurses from latest 3 rosters
            for v_nurse_name in
                select jsonb_array_elements_text(
                    case
                        when lower(replace(ipd_row.ward_type,' ', '_')) like '%female%' 
                            then (case when coalesce(female_general_ward,'') <> '' then female_general_ward::jsonb else '{}'::jsonb end)->'nurse'
                        when lower(replace(ipd_row.ward_type,' ', '_')) like '%male%' 
                            then (case when coalesce(male_general_ward,'') <> '' then male_general_ward::jsonb else '{}'::jsonb end)->'nurse'
                        when lower(replace(ipd_row.ward_type,' ', '_')) like '%hdu%' 
                            then (case when coalesce(hdu,'') <> '' then hdu::jsonb else '{}'::jsonb end)->'nurse'
                        when lower(replace(ipd_row.ward_type,' ', '_')) like '%private%' 
                            then (case when coalesce(private_ward,'') <> '' then private_ward::jsonb else '{}'::jsonb end)->'nurse'
                        when lower(replace(ipd_row.ward_type,' ', '_')) like '%nicu%' 
                            then (case when coalesce(nicu,'') <> '' then nicu::jsonb else '{}'::jsonb end)->'nurse'
                        else '[]'::jsonb
                    end
                )
                from roster
                where shift = v_shift
                  and (start_date <= current_date or start_date is null)
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
                continue;
            end if;

            -- STEP 2: Get last nurse assigned
            select assign_nurse
            into v_nurse
            from nurse_assign_task
            where "Ipd_number" = ipd_row.ipd_number
              and shift = v_shift
            order by timestamp desc
            limit 1;

            -- STEP 3: Decide nurse
            if v_nurse is null or not v_nurse = any(v_valid_nurses) then
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

            -- STEP 4: INSERT ONLY IF NOT EXISTS  ✅ FIX
            if v_nurse is not null
               and not exists (
                   select 1
                   from nurse_assign_task
                   where "Ipd_number" = ipd_row.ipd_number
                     and shift = v_shift
                     and task = v_task.task
                     and start_date = current_date
                     and status = 'two hours'
               )
            then
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
end;$$;


ALTER FUNCTION "public"."fn_generate_two_hour_tasks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_handle_leave_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_staff_type TEXT := LOWER(NEW.staff_type);
    v_staff_name TEXT := NEW.staff_name;
    v_leave_date DATE := NEW.leave_date;

    v_shift TEXT;
    v_ward_type TEXT;
    v_new_staff TEXT;
    v_name TEXT;
    v_task RECORD;

    v_valid_staff TEXT[] := ARRAY[]::TEXT[];
BEGIN
    --------------------------------------------------
    -- NURSE / OT
    --------------------------------------------------
    IF v_staff_type IN ('nurse', 'ot') THEN

        -- Get shift & ward_type from existing tasks
        SELECT shift, ward_type
        INTO v_shift, v_ward_type
        FROM nurse_assign_task
        WHERE assign_nurse = v_staff_name
          AND start_date = v_leave_date
        LIMIT 1;

        -- If no tasks exist, exit safely
        IF v_shift IS NULL OR v_ward_type IS NULL THEN
            RETURN NEW;
        END IF;

        -- Fetch replacement staff from latest 3 roster rows
        FOR v_name IN
            WITH latest_roster AS (
                SELECT *
                FROM roster
                WHERE shift = v_shift
                ORDER BY created_at DESC
                LIMIT 3
            )
            SELECT jsonb_array_elements_text(
                CASE
                    WHEN v_staff_type = 'nurse' THEN
                        CASE
                            WHEN LOWER(v_ward_type) LIKE '%male%'    THEN (male_general_ward::jsonb)->'nurse'
                            WHEN LOWER(v_ward_type) LIKE '%female%'  THEN (female_general_ward::jsonb)->'nurse'
                            WHEN LOWER(v_ward_type) LIKE '%icu%'     THEN (icu::jsonb)->'nurse'
                            WHEN LOWER(v_ward_type) LIKE '%hdu%'     THEN (hdu::jsonb)->'nurse'
                            WHEN LOWER(v_ward_type) LIKE '%private%' THEN (private_ward::jsonb)->'nurse'
                            ELSE '[]'::jsonb
                        END
                    ELSE
                        CASE
                            WHEN LOWER(v_ward_type) LIKE '%male%'    THEN (male_general_ward::jsonb)->'ot'
                            WHEN LOWER(v_ward_type) LIKE '%female%'  THEN (female_general_ward::jsonb)->'ot'
                            WHEN LOWER(v_ward_type) LIKE '%icu%'     THEN (icu::jsonb)->'ot'
                            WHEN LOWER(v_ward_type) LIKE '%hdu%'     THEN (hdu::jsonb)->'ot'
                            WHEN LOWER(v_ward_type) LIKE '%private%' THEN (private_ward::jsonb)->'ot'
                            ELSE '[]'::jsonb
                        END
                END
            )
            FROM latest_roster
        LOOP
            v_valid_staff := array_append(v_valid_staff, trim(v_name));
        END LOOP;

        -- Pick staff with least task count
        SELECT s
        INTO v_new_staff
        FROM unnest(v_valid_staff) s
        ORDER BY (
            SELECT COUNT(*)
            FROM nurse_assign_task
            WHERE assign_nurse = s
              AND shift = v_shift
              AND start_date = v_leave_date
        )
        LIMIT 1;

        -- Reinsert SAME tasks with new staff
        FOR v_task IN
            SELECT *
            FROM nurse_assign_task
            WHERE assign_nurse = v_staff_name
              AND start_date = v_leave_date
              AND planned1 IS NOT NULL
              AND actual1 IS NULL
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
                v_task."Ipd_number",
                v_task.patient_name,
                v_task.ward_type,
                v_task.patient_location,
                v_task.room,
                v_task.bed_no,
                v_task.shift,
                v_new_staff,
                v_task.start_date,
                v_task.reminder,
                v_task.task,
                v_task.planned1,
                v_task.status,
                v_task.staff,
                v_task.ot_number
            );
        END LOOP;

        -- Delete old tasks
        DELETE FROM nurse_assign_task
        WHERE assign_nurse = v_staff_name
          AND start_date = v_leave_date
          AND planned1 IS NOT NULL
          AND actual1 IS NULL;

    --------------------------------------------------
    -- RMO
    --------------------------------------------------
    ELSIF v_staff_type = 'rmo' THEN

        -- Get shift from existing RMO tasks
        SELECT shift
        INTO v_shift
        FROM rmo_assign_task
        WHERE assign_rmo = v_staff_name
          AND start_date = v_leave_date
        LIMIT 1;

        IF v_shift IS NULL THEN
            RETURN NEW;
        END IF;

        -- Fetch RMOs from latest roster
        FOR v_name IN
            SELECT jsonb_array_elements_text((rmo::jsonb)->'rmo')
            FROM roster
            WHERE shift = v_shift
            ORDER BY created_at DESC
            LIMIT 1
        LOOP
            v_valid_staff := array_append(v_valid_staff, trim(v_name));
        END LOOP;

        -- Pick RMO with least tasks
        SELECT s
        INTO v_new_staff
        FROM unnest(v_valid_staff) s
        ORDER BY (
            SELECT COUNT(*)
            FROM rmo_assign_task
            WHERE assign_rmo = s
              AND start_date = v_leave_date
        )
        LIMIT 1;

        -- Reinsert SAME RMO tasks
        FOR v_task IN
            SELECT *
            FROM rmo_assign_task
            WHERE assign_rmo = v_staff_name
              AND start_date = v_leave_date
              AND planned1 IS NOT NULL
              AND actual1 IS NULL
        LOOP
            INSERT INTO rmo_assign_task (
                timestamp,
                patient_name,
                ward_type,
                room,
                bed_no,
                shift,
                assign_rmo,
                start_date,
                task,
                planned1,
                status,
                staff
            )
            VALUES (
                now() AT TIME ZONE 'Asia/Kolkata',
                v_task.patient_name,
                v_task.ward_type,
                v_task.room,
                v_task.bed_no,
                v_task.shift,
                v_new_staff,
                v_task.start_date,
                v_task.task,
                v_task.planned1,
                v_task.status,
                v_task.staff
            );
        END LOOP;

        -- Delete old RMO tasks
        DELETE FROM rmo_assign_task
        WHERE assign_rmo = v_staff_name
          AND start_date = v_leave_date
          AND planned1 IS NOT NULL
          AND actual1 IS NULL;

    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_handle_leave_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ipd_bed_occupancy"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.actual1 IS NULL THEN
            UPDATE all_floor_bed
            SET status = NULL
            WHERE floor = OLD.floor
              AND ward  = OLD.ward_type
              AND room  = OLD.room
              AND bed   = OLD.bed_no;
        END IF;
    END IF;

    IF NEW.actual1 IS NOT NULL OR coalesce(NEW.bed_no, '') = '' THEN
        RETURN NEW;
    END IF;

    -- 'Occupied' (capital O): the value the frontend used to write and that
    -- Assign Nursing / Medical Task look for (.eq('status', 'Occupied')).
    UPDATE all_floor_bed
    SET status = 'Occupied'
    WHERE floor = NEW.floor
      AND ward  = NEW.ward_type
      AND room  = NEW.room
      AND bed   = NEW.bed_no
      AND status IS NULL;

    IF NOT FOUND AND EXISTS (
        SELECT 1
        FROM all_floor_bed
        WHERE floor = NEW.floor
          AND ward  = NEW.ward_type
          AND room  = NEW.room
          AND bed   = NEW.bed_no
    ) THEN
        RAISE EXCEPTION 'Bed % (%, room %) is already occupied. Refresh the page and choose another bed.',
            NEW.bed_no, NEW.ward_type, NEW.room
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_ipd_bed_occupancy"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ipd_mark_patient_admitted"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE patient_admission
    SET actual2 = (now() AT TIME ZONE 'Asia/Kolkata')
    WHERE admission_no = NEW.admission_no
      AND actual2 IS NULL;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_ipd_mark_patient_admitted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_lab_generate_nurse_task"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$DECLARE
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
    -- 🔴 PAYMENT CHECK (ADDED ONLY THIS)
    --------------------------------------------------
    IF NEW.payment_status IS DISTINCT FROM 'Yes' THEN
        RETURN NEW;
    END IF;

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
    -- FETCH TASK BASED ON LAB CATEGORY
    --------------------------------------------------
    IF LOWER(NEW.category) = 'pathology' THEN
        SELECT task
        INTO v_task
        FROM pre_defined_task
        WHERE staff = 'nurse'
          AND status = 'lab'
        LIMIT 1;

    ELSIF LOWER(NEW.category) = 'radiology' THEN
        SELECT task
        INTO v_task
        FROM pre_defined_task
        WHERE staff = 'nurse'
          AND status = 'radiology'
        LIMIT 1;
    END IF;

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
              AND (start_date <= current_date OR start_date IS NULL)
            ORDER BY created_at DESC
            LIMIT 3
        )
        SELECT jsonb_array_elements_text(
            CASE
                WHEN LOWER(NEW.ward_type) LIKE '%female%'  THEN (female_general_ward::jsonb)->'nurse'
                WHEN LOWER(NEW.ward_type) LIKE '%male%'    THEN (male_general_ward::jsonb)->'nurse'
                WHEN LOWER(NEW.ward_type) LIKE '%icu%'     THEN (icu::jsonb)->'nurse'
                WHEN LOWER(NEW.ward_type) LIKE '%picu%'    THEN (picu::jsonb)->'nurse'
                WHEN LOWER(NEW.ward_type) LIKE '%nicu%'    THEN (nicu::jsonb)->'nurse'
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
END;$$;


ALTER FUNCTION "public"."fn_lab_generate_nurse_task"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_normalize_ward"("p_ward" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
    v text := lower(trim(p_ward));
begin
    if v like '%male%' and v like '%general%' then
        return 'male_general_ward';

    elsif v like '%female%' and v like '%general%' then
        return 'female_general_ward';

    elsif v like '%icu%' then
        return 'icu';

    elsif v like '%hdu%' then
        return 'hdu';

    elsif v like '%nicu%' then
        return 'nicu';

    elsif v like '%private%' then
        return 'private_ward';

    else
        return null;
    end if;
end;
$$;


ALTER FUNCTION "public"."fn_normalize_ward"("p_ward" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_set_time_in_ward_new_row"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.planned1 IS NOT NULL THEN
        NEW.time_in_ward :=
            CASE
                WHEN NEW.actual1 IS NULL THEN
                    GREATEST((CURRENT_DATE - NEW.planned1::date) + 1, 1)::text || ' days'
                ELSE
                    GREATEST((NEW.actual1::date - NEW.planned1::date) + 1, 1)::text || ' days'
            END;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_set_time_in_ward_new_row"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_update_ot_information_from_nurse_task"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Do nothing if ot_number is NULL
    IF NEW.ot_number IS NULL THEN
        RETURN NEW;
    END IF;

    -- If staff is OT Staff, update ot_staff only
    IF lower(NEW.staff) = 'ot staff' THEN
        UPDATE public.ot_information
        SET ot_staff = NEW.assign_nurse
        WHERE ot_number = NEW.ot_number;

    -- If staff is nurse, update assign_nurse only
    ELSIF lower(NEW.staff) = 'nurse' THEN
        UPDATE public.ot_information
        SET assign_nurse = NEW.assign_nurse
        WHERE ot_number = NEW.ot_number;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_update_ot_information_from_nurse_task"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_admission_no"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_val INTEGER;
    formatted_text TEXT;
BEGIN
    -- Get the next sequence value
    next_val := nextval('admission_no_seq');

    -- Format as ADM-0001, ADM-0002, etc.
    formatted_text := 'ADM-' || LPAD(next_val::TEXT, 4, '0');

    RETURN formatted_text;
END;
$$;


ALTER FUNCTION "public"."generate_admission_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_discharge_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_num BIGINT;
BEGIN
    -- If discharge_number is already set, don't overwrite
    IF NEW.discharge_number IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Get next sequence number
    next_num := nextval('discharge_number_seq');

    -- Format as DIS-001, DIS-002, DIS-1000, etc.
    NEW.discharge_number := 'DIS-' || LPAD(next_num::text, 3, '0');

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_discharge_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_dressing_task_no"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.task_no IS NULL OR NEW.task_no = '' THEN
        NEW.task_no := 'DT-' || LPAD(NEXTVAL('dressing_task_no_seq')::text, 3, '0');
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_dressing_task_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_indent_no"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_val INTEGER;
BEGIN
    -- Only generate if not already provided
    IF NEW.indent_no IS NULL OR NEW.indent_no = '' THEN
        
        -- Get next sequence value (THREAD SAFE ✅)
        next_val := nextval('pharmacy_indent_seq');
        
        -- Format: IND-20000
        NEW.indent_no := 'IND-' || next_val;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_indent_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_ipd_no"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_val INTEGER;
BEGIN
    -- Get next value
    next_val := nextval('ipd_no_seq');

    -- Format as IPD-001, IPD-002 ... IPD-1000 ...
    RETURN 'IPD-' || LPAD(next_val::TEXT, 3, '0');  
END;
$$;


ALTER FUNCTION "public"."generate_ipd_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_lab_no"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- ONLY generate lab_no, DO NOT validate payment here
  IF NEW.lab_no IS NULL OR NEW.lab_no = '' THEN
    NEW.lab_no := 'LAB-' || LPAD(nextval('lab_no_seq')::text, 3, '0');
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_lab_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_ot_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.ot_number IS NULL OR NEW.ot_number = '' THEN
        NEW.ot_number := 'OT-' || LPAD(NEXTVAL('ot_number_seq')::TEXT, 3, '0');
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_ot_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_rmo_task_no"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.task_no IS NULL THEN
        NEW.task_no :=
            'RMO-' || to_char(NOW(), 'YYYYMMDD') || '-' ||
            LPAD(nextval('rmo_assign_task_task_no_seq')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_rmo_task_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_serial_no"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_val INTEGER;
BEGIN
    next_val := nextval('serial_no_seq');
    RETURN 'SN-' || LPAD(next_val::TEXT, 3, '0');
END;
$$;


ALTER FUNCTION "public"."generate_serial_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_task_no"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.task_no IS NULL THEN
        NEW.task_no :=
            'TN-' || LPAD(nextval('nurse_task_no_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_task_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(

    -- ── Core counts ──────────────────────────────────────────
    'patientAdmissionCount',
      (SELECT COUNT(*) FROM patient_admission),

    'ipdAdmissionCount',
      (SELECT COUNT(*) FROM ipd_admissions),

    -- Active = planned1 set but not yet discharged (actual1 null)
    'activePatients',
      (SELECT COUNT(*) FROM ipd_admissions
       WHERE planned1 IS NOT NULL AND actual1 IS NULL),

    -- Discharged = both timestamps set
    'dischargedPatients',
      (SELECT COUNT(*) FROM ipd_admissions
       WHERE planned1 IS NOT NULL AND actual1 IS NOT NULL),

    -- ── Staff counts ─────────────────────────────────────────
    'doctorCount',
      (SELECT COUNT(*) FROM doctors),

    'nurseCount',
      (SELECT COUNT(*) FROM all_staff
       WHERE designation = 'Staff Nurse'),

    'rmoCount',
      (SELECT COUNT(*) FROM all_staff
       WHERE designation = 'RMO'),

    'otStaffCount',
      (SELECT COUNT(*) FROM all_staff
       WHERE designation = 'OT STAFF'),

    -- ── Distributions ────────────────────────────────────────
    'genderDistribution',
      (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
       FROM (
         SELECT
           gender                                        AS name,
           COUNT(*)                                      AS count,
           ROUND(COUNT(*) * 100.0 /
             NULLIF((SELECT COUNT(*) FROM patient_admission
                     WHERE gender IS NOT NULL), 0)
           )::int                                        AS percentage
         FROM patient_admission
         WHERE gender IS NOT NULL
         GROUP BY gender
         ORDER BY count DESC
       ) t),

    'wardDistribution',
      (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
       FROM (
         SELECT
           ward_type                                     AS name,
           COUNT(*)                                      AS count,
           ROUND(COUNT(*) * 100.0 /
             NULLIF((SELECT COUNT(*) FROM ipd_admissions
                     WHERE ward_type IS NOT NULL), 0)
           )::int                                        AS percentage
         FROM ipd_admissions
         WHERE ward_type IS NOT NULL
         GROUP BY ward_type
         ORDER BY count DESC
       ) t),

    'departmentDistribution',
      (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
       FROM (
         SELECT
           department                                    AS name,
           COUNT(*)                                      AS count,
           ROUND(COUNT(*) * 100.0 /
             NULLIF((SELECT COUNT(*) FROM ipd_admissions
                     WHERE department IS NOT NULL), 0)
           )::int                                        AS percentage
         FROM ipd_admissions
         WHERE department IS NOT NULL
         GROUP BY department
         ORDER BY count DESC
       ) t),

    -- ── 7-day admission trend ─────────────────────────────────
    'admissionTrends',
      (SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.date), '[]'::json)
       FROM (
         SELECT
           TO_CHAR(day_series::date, 'Dy DD')           AS date,
           COALESCE(daily.cnt, 0)                        AS count
         FROM generate_series(
           (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '6 days',
           (NOW() AT TIME ZONE 'Asia/Kolkata')::date,
           INTERVAL '1 day'
         ) AS day_series
         LEFT JOIN (
           SELECT
             DATE(timestamp AT TIME ZONE 'Asia/Kolkata') AS d,
             COUNT(*)                                     AS cnt
           FROM patient_admission
           WHERE timestamp >= NOW() - INTERVAL '7 days'
           GROUP BY d
         ) daily ON daily.d = day_series::date
       ) t),

    -- ── Bed statistics ───────────────────────────────────────
    'bedStats',
      (SELECT json_build_object(
        'totalBeds',
          COUNT(*),
        'occupiedBeds',
          COUNT(*) FILTER (WHERE LOWER(status) = 'occupied'),
        'availableBeds',
          COUNT(*) FILTER (WHERE LOWER(status) != 'occupied' OR status IS NULL),
        'occupancyRate',
          CASE WHEN COUNT(*) > 0
            THEN ROUND(
              COUNT(*) FILTER (WHERE LOWER(status) = 'occupied') * 100.0 / COUNT(*)
            )::int
            ELSE 0
          END,
        'wardBedStats',
          (SELECT COALESCE(json_agg(row_to_json(w) ORDER BY w.total DESC), '[]'::json)
           FROM (
             SELECT
               ward                                      AS name,
               COUNT(*)                                  AS total,
               COUNT(*) FILTER (WHERE LOWER(status) = 'occupied')
                                                         AS occupied,
               COUNT(*) FILTER (WHERE LOWER(status) != 'occupied' OR status IS NULL)
                                                         AS available,
               CASE WHEN COUNT(*) > 0
                 THEN ROUND(
                   COUNT(*) FILTER (WHERE LOWER(status) = 'occupied')
                   * 100.0 / COUNT(*)
                 )::int ELSE 0 END                       AS "occupancyRate",
               CASE WHEN COUNT(*) > 0
                 THEN ROUND(
                   COUNT(*) FILTER (WHERE LOWER(status) != 'occupied' OR status IS NULL)
                   * 100.0 / COUNT(*)
                 )::int ELSE 0 END                       AS "availabilityRate"
             FROM all_floor_bed
             GROUP BY ward
           ) w)
      )
      FROM all_floor_bed)

  ) INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_dashboard_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_ipd_number"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN 'IPD-' || LPAD(nextval('ipd_number_seq')::TEXT, 4, '0');
END;
$$;


ALTER FUNCTION "public"."get_next_ipd_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nurse_patient_ipds"("p_nurse" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $_$
DECLARE
    v_ipds text[];
BEGIN
    -- Distinct IPD numbers of every patient this nurse has tasks for.
    -- One array (not a set of rows) so the API's 1,000-row limit doesn't apply.
    -- EXECUTE plans with the real name, so the trigram index on assign_nurse is used.
    EXECUTE '
        SELECT coalesce(array_agg(DISTINCT btrim("Ipd_number")), ''{}'')
        FROM nurse_assign_task
        WHERE assign_nurse ILIKE $1
          AND "Ipd_number" IS NOT NULL
          AND btrim("Ipd_number") <> '''''
    INTO v_ipds
    USING '%' || btrim(coalesce(p_nurse, '')) || '%';
    RETURN v_ipds;
END;
$_$;


ALTER FUNCTION "public"."get_nurse_patient_ipds"("p_nurse" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_nurse_score_stats"("p_start" "date", "p_end" "date") RETURNS TABLE("name" "text", "total" bigint, "completed" bigint, "pending" bigint, "shifts" "text"[])
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $_$
BEGIN
    -- EXECUTE plans the query with the real dates each time (a generic plan was ~10x slower)
    RETURN QUERY EXECUTE '
        WITH per_shift AS (
            SELECT btrim(assign_nurse) AS name, shift,
                   count(*) AS total,
                   count(*) FILTER (WHERE planned1 IS NOT NULL AND actual1 IS NOT NULL) AS completed,
                   count(*) FILTER (WHERE planned1 IS NOT NULL AND actual1 IS NULL) AS pending
            FROM nurse_assign_task
            WHERE start_date BETWEEN $1 AND $2
              AND btrim(coalesce(assign_nurse, '''')) <> ''''
            GROUP BY 1, 2
        )
        SELECT name,
               sum(total)::bigint,
               sum(completed)::bigint,
               sum(pending)::bigint,
               array_agg(shift ORDER BY shift) FILTER (WHERE coalesce(shift, '''') <> '''')
        FROM per_shift
        GROUP BY name'
    USING p_start, p_end;
END;
$_$;


ALTER FUNCTION "public"."get_nurse_score_stats"("p_start" "date", "p_end" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_patient_card_nurses"("p_ipds" "text"[], "p_shift" "text") RETURNS TABLE("ipd" "text", "nurses" "text"[])
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    -- For each patient: nurses who had tasks for them in this shift, most recent first
    SELECT i.ipd,
           (SELECT array_agg(n.nurse ORDER BY n.last_seen DESC)
              FROM (SELECT btrim(t.assign_nurse) AS nurse, max(t."timestamp") AS last_seen
                      FROM nurse_assign_task t
                     WHERE t."Ipd_number" = i.ipd
                       AND t.shift = p_shift
                       AND btrim(coalesce(t.assign_nurse, '')) <> ''
                     GROUP BY btrim(t.assign_nurse)) n) AS nurses
    FROM unnest(p_ipds) AS i(ipd)
$$;


ALTER FUNCTION "public"."get_patient_card_nurses"("p_ipds" "text"[], "p_shift" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pharmacy_history_titles"() RETURNS "text"[]
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    -- Titles for the Approval "All Indents" dropdown (history rows), in the order the
    -- page listed them before: first appearance, patient indents by id, then departmental.
    -- Title rules mirror normalize*PharmacyIndent().displayTitle in pharmacyIndentUtils.js.
    WITH t AS (
        SELECT coalesce(nullif(patient_name, ''), nullif(indent_no, ''), 'Patient Indent') AS title,
               0 AS src, row_number() OVER (ORDER BY id) AS ord
        FROM pharmacy
        WHERE status IN ('approved', 'rejected')
        UNION ALL
        SELECT coalesce(nullif(ward, ''), nullif(ward_location, ''), nullif(indent_no, ''), 'Departmental Indent'),
               1, row_number() OVER (ORDER BY id)
        FROM departmental_pharmacy_indent
        WHERE status IN ('approved', 'rejected')
    )
    SELECT coalesce(array_agg(title ORDER BY src, ord), '{}')
    FROM (SELECT DISTINCT ON (title) title, src, ord FROM t ORDER BY title, src, ord) firsts
$$;


ALTER FUNCTION "public"."get_pharmacy_history_titles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pharmacy_store_filter_options"() RETURNS json
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    -- Titles and raw ward locations for the Store filters, in first-appearance order
    -- (newest first, patient indents then departmental), like getStoreFilterOptions did.
    -- The page still applies normalizeStoreWard() to the locations.
    WITH t AS (
        SELECT coalesce(nullif(patient_name, ''), nullif(indent_no, ''), 'Patient Indent') AS title,
               coalesce(ward_location, '') AS location,
               0 AS src,
               row_number() OVER (ORDER BY "timestamp" DESC, id DESC) AS ord
        FROM pharmacy
        WHERE planned2 IS NOT NULL AND status <> 'rejected'
        UNION ALL
        SELECT coalesce(nullif(ward, ''), nullif(ward_location, ''), nullif(indent_no, ''), 'Departmental Indent'),
               coalesce(nullif(ward_location, ''), nullif(ward, ''), 'Departmental'),
               1,
               row_number() OVER (ORDER BY "timestamp" DESC, id DESC)
        FROM departmental_pharmacy_indent
        WHERE planned2 IS NOT NULL AND status <> 'rejected'
    )
    SELECT json_build_object(
        'titles', (SELECT coalesce(array_agg(title ORDER BY src, ord), '{}')
                   FROM (SELECT DISTINCT ON (title) title, src, ord FROM t ORDER BY title, src, ord) a),
        'locations', (SELECT coalesce(array_agg(location ORDER BY src, ord), '{}')
                      FROM (SELECT DISTINCT ON (location) location, src, ord FROM t
                            WHERE btrim(location) <> '' ORDER BY location, src, ord) b)
    )
$$;


ALTER FUNCTION "public"."get_pharmacy_store_filter_options"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_rmo_score_stats"() RETURNS TABLE("name" "text", "total" bigint, "completed" bigint, "pending" bigint, "shifts" "text"[])
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    WITH per_shift AS (
        SELECT btrim(assign_rmo) AS name, shift,
               count(*) AS total,
               count(*) FILTER (WHERE planned1 IS NOT NULL AND actual1 IS NOT NULL) AS completed,
               count(*) FILTER (WHERE planned1 IS NOT NULL AND actual1 IS NULL) AS pending
        FROM rmo_assign_task
        WHERE btrim(coalesce(assign_rmo, '')) <> ''
        GROUP BY 1, 2
    )
    SELECT name,
           sum(total)::bigint,
           sum(completed)::bigint,
           sum(pending)::bigint,
           array_agg(shift ORDER BY shift) FILTER (WHERE coalesce(shift, '') <> '')
    FROM per_shift
    GROUP BY name
$$;


ALTER FUNCTION "public"."get_rmo_score_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_lab_tasks_unpaid"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If explicitly unpaid → clear workflow
  IF NEW.payment_status = 'No' THEN
    NEW.planned1 := NULL;
    NEW.actual1 := NULL;
    NEW.planned2 := NULL;
    NEW.actual2 := NULL;
    NEW.delay1 := NULL;
    NEW.delay2 := NULL;
    NEW.planned3 := NULL;
    NEW.actual3 := NULL;
    NEW.delay3 := NULL;
    NEW.planned4 := NULL;
    NEW.actual4 := NULL;
    NEW.receive_sample := NULL;
    NEW.bill_image_url := NULL;
  END IF;

  -- When payment becomes Yes → allow workflow
  IF NEW.payment_status = 'Yes'
     AND OLD.payment_status IS DISTINCT FROM 'Yes' THEN
    NEW.planned1 := COALESCE(
      NEW.planned1,
      NOW()::timestamp(0)::text
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_lab_tasks_unpaid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_admission_no"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.admission_no IS NULL OR NEW.admission_no = '' THEN
        NEW.admission_no := generate_admission_no();
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_admission_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_bed_status_null_on_actual1"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Only run when actual1 changed from NULL → NOT NULL
    IF NEW.actual1 IS NOT NULL AND OLD.actual1 IS NULL THEN
        UPDATE all_floor_bed
        SET status = NULL
        WHERE floor = NEW.floor
          AND ward = NEW.location_status
          AND room = NEW.room
          AND bed = NEW.bed_no;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_bed_status_null_on_actual1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_departmental_pharmacy_indent_no"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Keep existing value if provided
  IF COALESCE(trim(NEW.indent_no), '') <> '' THEN
    RETURN NEW;
  END IF;

  -- Generate new indent number
  NEW.indent_no := 'DPI-' || LPAD(
    nextval('public.departmental_indent_no_seq')::TEXT,
    5,
    '0'
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_departmental_pharmacy_indent_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_discharge_category"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only fill if category is not already provided
  IF NEW.category IS NULL OR TRIM(NEW.category) = '' THEN
    SELECT ia.pat_category
    INTO NEW.category
    FROM public.ipd_admissions ia
    WHERE ia.admission_no = NEW.admission_no
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_discharge_category"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_ipd_no"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.ipd_number IS NULL OR NEW.ipd_number = '' THEN
        NEW.ipd_number := generate_ipd_no();
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_ipd_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_serial_no"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.serial_no IS NULL OR NEW.serial_no = '' THEN
        NEW.serial_no := generate_serial_no();
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_serial_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_ticket_add_working_days"("ts" timestamp with time zone, "n" integer) RETURNS timestamp with time zone
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  d   timestamp := ts at time zone 'Asia/Kolkata';
  cnt int := 0;
begin
  while cnt < n loop
    d := d + interval '1 day';
    if extract(dow from d) <> 0 then   -- 0 = Sunday
      cnt := cnt + 1;
    end if;
  end loop;
  return d at time zone 'Asia/Kolkata';
end;
$$;


ALTER FUNCTION "public"."staff_ticket_add_working_days"("ts" timestamp with time zone, "n" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_ticket_updates_after_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.staff_tickets
     set status       = new.stage,
         completed_at = case when new.stage = 'completed' then new.created_at else null end
   where id = new.ticket_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."staff_ticket_updates_after_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_tickets_before_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_n   bigint;
  v_sla int;
begin
  if new.ticket_no is null or new.ticket_no = '' then
    v_n := nextval('public.staff_ticket_no_seq');
    new.ticket_no := 'IS-' || case when v_n < 10 then '0' || v_n::text else v_n::text end;
  end if;

  if new.planned_at is null then
    select sla_working_days into v_sla
      from public.staff_ticket_categories where id = new.category_id;
    new.planned_at := public.staff_ticket_add_working_days(coalesce(new.created_at, now()), coalesce(v_sla, 1));
  end if;

  new.status := 'open';
  new.completed_at := null;
  return new;
end;
$$;


ALTER FUNCTION "public"."staff_tickets_before_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_ipd_number_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  

    -- Update PATIENT_ADMISSION table
    UPDATE patient_admission
    SET ipd_number = NEW.ipd_number
    WHERE admission_no = NEW.admission_no;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_sync_ipd_number_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_update_ipd_time_in_ward"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM update_ipd_time_in_ward();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_update_ipd_time_in_ward"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_bed_status_on_actual1"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Run only when actual1 has a real value
    IF NEW.actual1 IS NOT NULL THEN
        UPDATE all_floor_bed
        SET status = null
        WHERE floor = NEW.floor
          AND ward = NEW.location_status
          AND room = NEW.room
          AND bed = NEW.bed_no;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_bed_status_on_actual1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ipd_from_pharmacy"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Update ipd_admissions using the latest pharmacy row for that ipd_number
    UPDATE ipd_admissions
    SET staff_name = p.staff_name,
        diagnosis = p.diagnosis
    FROM (
        SELECT staff_name, diagnosis
        FROM pharmacy
        WHERE ipd_number = NEW.ipd_number
        ORDER BY id DESC
        LIMIT 1
    ) p
    WHERE ipd_admissions.ipd_number = NEW.ipd_number;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ipd_from_pharmacy"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ipd_time_in_ward"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE ipd_admissions
    SET time_in_ward =
        CASE
            WHEN actual1 IS NULL THEN
                GREATEST((CURRENT_DATE - planned1::date) + 1, 1)::text || ' days'
            ELSE
                GREATEST((actual1::date - planned1::date) + 1, 1)::text || ' days'
        END
    WHERE planned1 IS NOT NULL
      AND time_in_ward IS DISTINCT FROM
        CASE
            WHEN actual1 IS NULL THEN
                GREATEST((CURRENT_DATE - planned1::date) + 1, 1)::text || ' days'
            ELSE
                GREATEST((actual1::date - planned1::date) + 1, 1)::text || ' days'
        END;
END;
$$;


ALTER FUNCTION "public"."update_ipd_time_in_ward"() OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."admission_no_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."admission_no_seq" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."all_floor_bed" (
    "id" bigint NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "serial_no" "text",
    "floor" "text",
    "ward" "text",
    "room" "text",
    "bed" "text",
    "status" "text"
);


ALTER TABLE "public"."all_floor_bed" OWNER TO "postgres";


ALTER TABLE "public"."all_floor_bed" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."all_floor_bed_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."all_staff" (
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "phone_number" "text",
    "email" "text",
    "designation" "text",
    "department" "text",
    "id" bigint NOT NULL
);


ALTER TABLE "public"."all_staff" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."all_staff_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."all_staff_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."all_staff_id_seq" OWNED BY "public"."all_staff"."id";



CREATE TABLE IF NOT EXISTS "public"."ayushman_portal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admission_no" "text" NOT NULL,
    "ipd_admission_id" bigint,
    "planned" timestamp with time zone,
    "actual" timestamp with time zone,
    "photos" "jsonb" DEFAULT '[]'::"jsonb",
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('Asia/Kolkata'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('Asia/Kolkata'::"text", "now"())
);


ALTER TABLE "public"."ayushman_portal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discharge" (
    "id" bigint NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    "discharge_number" "text",
    "admission_no" "text",
    "patient_name" "text",
    "department" "text",
    "consultant_name" "text",
    "staff_name" "text",
    "remark" "text",
    "planned1" timestamp without time zone,
    "actual1" timestamp without time zone,
    "delay1" "text",
    "rmo_status" "text",
    "rmo_name" "text",
    "summary_report_image" "text",
    "summary_report_image_name" "text",
    "planned2" timestamp without time zone,
    "actual2" timestamp without time zone,
    "delay2" "text",
    "work_file" "text",
    "planned3" timestamp without time zone,
    "actual3" timestamp without time zone,
    "delay3" "text",
    "concern_dept" "text",
    "planned4" timestamp without time zone,
    "actual4" timestamp without time zone,
    "delay4" "text",
    "concern_authority_work_file" "text",
    "planned5" timestamp without time zone,
    "actual5" timestamp without time zone,
    "delay5" "text",
    "bill_status" "text",
    "bill_image" "text",
    "category" "text"
);


ALTER TABLE "public"."discharge" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ipd_admissions" (
    "id" bigint NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    "admission_no" "text",
    "patient_name" "text",
    "father_husband_name" "text",
    "age" "text",
    "gender" "text",
    "date_of_birth" "text",
    "phone_no" "text",
    "whatsapp_no" "text",
    "email_id" "text",
    "house_no_street" "text",
    "area_colony" "text",
    "landmark" "text",
    "state" "text",
    "city" "text",
    "pincode" "text",
    "country" "text",
    "department" "text",
    "refer_by_dr" "text",
    "consultant_dr" "text",
    "pat_category" "text",
    "patient_case" "text",
    "medical_surgical" "text",
    "health_card_no" "text",
    "adm_purpose" "text",
    "location_status" "text",
    "ward_no" "text",
    "room_no" "text",
    "bed_no" "text",
    "bed_location" "text",
    "ward_type" "text",
    "room" "text",
    "bed_tariff" "text",
    "kin_name" "text",
    "kin_relation" "text",
    "kin_mobile_no" "text",
    "advance_amount" "text",
    "dr_visit_tariff" "text",
    "package_name" "text",
    "pkg_amount" "text",
    "exp_tariff" "text",
    "other_services" "text",
    "vip_details" "text",
    "religion" "text",
    "marital_status" "text",
    "attempt" "text",
    "remarks" "text",
    "planned1" timestamp without time zone,
    "actual1" timestamp without time zone,
    "delay" "text",
    "ipd_number" "text" DEFAULT "public"."get_next_ipd_number"() NOT NULL,
    "status" "text",
    "floor" "text",
    "staff_name" "text",
    "diagnosis" "text",
    "time_in_ward" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ipd_admissions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ayushman_portal_view" WITH ("security_invoker"='true') AS
 SELECT "ia"."timestamp" AS "admission_timestamp",
    "ia"."id" AS "ipd_admission_id",
    "ia"."admission_no",
    "ia"."patient_name",
    COALESCE(NULLIF(TRIM(BOTH FROM "ia"."ward_type"), ''::"text"), NULLIF(TRIM(BOTH FROM "ia"."bed_location"), ''::"text"), '-'::"text") AS "ward_number",
    COALESCE(NULLIF(TRIM(BOTH FROM "ia"."bed_no"), ''::"text"), '-'::"text") AS "bed_number",
    COALESCE(NULLIF(TRIM(BOTH FROM "ia"."kin_mobile_no"), ''::"text"), NULLIF(TRIM(BOTH FROM "ia"."whatsapp_no"), ''::"text"), NULLIF(TRIM(BOTH FROM "ia"."phone_no"), ''::"text"), '-'::"text") AS "attender_mobile_number",
    COALESCE(NULLIF(TRIM(BOTH FROM "ia"."adm_purpose"), ''::"text"), '-'::"text") AS "reason_for_visit",
    "ia"."age",
    "ia"."gender",
    "ia"."pat_category" AS "category",
    "ap"."planned",
    "ap"."actual",
    COALESCE("ap"."photos", '[]'::"jsonb") AS "photos",
    "ap"."id" AS "ayushman_record_id",
    "ia"."status" AS "ipd_status",
    "ia"."department",
    "ia"."consultant_dr"
   FROM ("public"."ipd_admissions" "ia"
     LEFT JOIN "public"."ayushman_portal" "ap" ON (("ia"."admission_no" = "ap"."admission_no")))
  WHERE (("upper"(TRIM(BOTH FROM COALESCE("ia"."pat_category", ''::"text"))) = ANY (ARRAY['BSKY'::"text", 'AYUSHMAN BHARAT'::"text", 'AYUSHMAN BHARAT(GJAY)'::"text", 'PRIVATE'::"text", 'ESIC'::"text"])) AND ("ia"."actual1" IS NULL) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."discharge" "d"
          WHERE (NOT ("d"."admission_no" IS DISTINCT FROM "ia"."admission_no"))))))
  ORDER BY "ia"."created_at" DESC NULLS LAST;


ALTER VIEW "public"."ayushman_portal_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."category" OWNER TO "postgres";


ALTER TABLE "public"."category" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."category_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."congratulations_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "nurse_name" "text" NOT NULL,
    "message" "text" NOT NULL,
    "photo_url" "text",
    "created_by" "text" DEFAULT 'Admin'::"text",
    "is_active" boolean DEFAULT true,
    "post_type" "text"
);


ALTER TABLE "public"."congratulations_posts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."departmental_indent_no_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."departmental_indent_no_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departmental_pharmacy_indent" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "indent_no" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "requested_by" "text" NOT NULL,
    "request_source" "text" DEFAULT 'departmental'::"text",
    "floor" "text",
    "ward" "text",
    "room" "text",
    "ward_location" "text",
    "category" "text",
    "remarks" "text",
    "request_types" "jsonb",
    "medicines" "jsonb",
    "investigations" "jsonb",
    "investigation_advice" "jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "planned1" timestamp with time zone,
    "actual1" timestamp with time zone,
    "planned2" timestamp with time zone,
    "actual2" timestamp with time zone,
    "approved_by" "text",
    "approved_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "slip_image" "text",
    "slip_image_url" "text",
    "indent_scope" "text",
    "surgical_date" "text"
);


ALTER TABLE "public"."departmental_pharmacy_indent" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."discharge_available_patients" WITH ("security_invoker"='true') AS
 SELECT "id",
    "admission_no",
    "patient_name",
    "department",
    "consultant_dr",
    "ipd_number",
    "timestamp"
   FROM "public"."ipd_admissions" "i"
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."discharge" "d"
          WHERE (NOT ("d"."admission_no" IS DISTINCT FROM "i"."admission_no")))));


ALTER VIEW "public"."discharge_available_patients" OWNER TO "postgres";


ALTER TABLE "public"."discharge" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."discharge_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."discharge_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."discharge_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doctors" (
    "id" bigint NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "phone_number" "text",
    "email" "text",
    "designation" "text",
    "department" "text"
);


ALTER TABLE "public"."doctors" OWNER TO "postgres";


ALTER TABLE "public"."doctors" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."doctors_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."dressing" (
    "id" bigint NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    "admission_number" "text",
    "ipd_number" "text",
    "patient_name" "text",
    "task_no" "text",
    "patient_location" "text",
    "ward_type" "text",
    "room" "text",
    "bed_no" "text",
    "planned1" timestamp without time zone,
    "actual1" timestamp without time zone,
    "remarks" "text",
    "status" "text",
    "submitted_by" "text"
);


ALTER TABLE "public"."dressing" OWNER TO "postgres";


ALTER TABLE "public"."dressing" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."dressing_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."dressing_task_no_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dressing_task_no_seq" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."indent_sequence"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."indent_sequence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."investigation" (
    "id" bigint NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text",
    "name" "text",
    "price" "text"
);


ALTER TABLE "public"."investigation" OWNER TO "postgres";


ALTER TABLE "public"."investigation" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."investigation_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."ipd_no_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ipd_no_seq" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ipd_number_seq"
    START WITH 5001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ipd_number_seq" OWNER TO "postgres";


ALTER TABLE "public"."ipd_admissions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ipd_patient_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."lab" (
    "id" bigint NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    "admission_no" "text",
    "lab_no" "text",
    "patient_name" "text",
    "phone_no" "text",
    "father_husband_name" "text",
    "age" "text",
    "gender" "text",
    "reason_for_visit" "text",
    "bed_no" "text",
    "location" "text",
    "ward_type" "text",
    "room" "text",
    "department" "text",
    "priority" "text",
    "category" "text",
    "pathology_tests" "jsonb",
    "radiology_type" "text",
    "radiology_tests" "jsonb",
    "remarks" "text",
    "status" "text",
    "consultant_dr" "text",
    "refer_by_dr" "text",
    "planned1" "text",
    "actual1" "text",
    "delay1" "text",
    "payment_status" "text",
    "bill_image_url" "text",
    "planned2" "text",
    "actual2" "text",
    "delay2" "text",
    "report_url" "text",
    "planned3" timestamp without time zone,
    "actual3" timestamp without time zone,
    "delay3" "text",
    "lab_report_remarks" "text",
    "ipd_number" "text",
    "actual4" timestamp without time zone,
    "receive_sample" "text",
    "planned4" timestamp without time zone,
    "created_by_nurse" "text"
);


ALTER TABLE "public"."lab" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."lab_advice_pending" WITH ("security_invoker"='true') AS
 SELECT "id",
    "timestamp"
   FROM "public"."ipd_admissions" "i"
  WHERE (("planned1" IS NOT NULL) AND ("actual1" IS NULL) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."lab" "l"
          WHERE ("l"."admission_no" = "i"."admission_no")))));


ALTER VIEW "public"."lab_advice_pending" OWNER TO "postgres";


ALTER TABLE "public"."lab" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."lab_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."lab_no_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."lab_no_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave" (
    "id" integer NOT NULL,
    "staff_name" "text" NOT NULL,
    "staff_type" "text" NOT NULL,
    "leave_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "leave_staff_type_check" CHECK (("staff_type" = ANY (ARRAY['nurse'::"text", 'rmo'::"text", 'ot'::"text"])))
);


ALTER TABLE "public"."leave" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."leave_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."leave_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."leave_id_seq" OWNED BY "public"."leave"."id";



CREATE TABLE IF NOT EXISTS "public"."master" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "department" "text",
    "nurse_task" "text",
    "rmo_task" "text"
);


ALTER TABLE "public"."master" OWNER TO "postgres";


ALTER TABLE "public"."master" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."master_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."medicine" (
    "id" bigint NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "medicine_name" "text",
    "price" "text"
);


ALTER TABLE "public"."medicine" OWNER TO "postgres";


ALTER TABLE "public"."medicine" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."medicine_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."nurse_assign_task" (
    "id" bigint NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    "task_no" "text",
    "Ipd_number" "text",
    "patient_name" "text",
    "patient_location" "text",
    "ward_type" "text",
    "room" "text",
    "bed_no" "text",
    "shift" "text",
    "assign_nurse" "text",
    "reminder" "text",
    "start_date" "date",
    "task" "text",
    "planned1" timestamp without time zone,
    "actual1" timestamp without time zone,
    "staff" "text",
    "ot_number" "text",
    "status" "text",
    "check_up" "text",
    "submitted_by" "text",
    "delegated_from" "text"
);


ALTER TABLE "public"."nurse_assign_task" OWNER TO "postgres";


ALTER TABLE "public"."nurse_assign_task" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."nurse_assign_task_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."nurse_monthly_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nurse_name" "text" NOT NULL,
    "month" "text" NOT NULL,
    "total_tasks" integer DEFAULT 0,
    "completed_tasks" integer DEFAULT 0,
    "pending_tasks" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."nurse_monthly_stats" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."nurse_task_no_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."nurse_task_no_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ot_information" (
    "id" bigint NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    "ot_number" "text",
    "ipd_number" "text",
    "patient_name" "text",
    "patient_location" "text",
    "ward_type" "text",
    "room" "text",
    "bed_no" "text",
    "planned1" timestamp without time zone,
    "actual1" timestamp without time zone,
    "ot_date" "date",
    "ot_time" "text",
    "ot_description" "text",
    "doctor" "text",
    "rmo" "text",
    "planned2" timestamp without time zone,
    "actual2" timestamp without time zone,
    "ot_staff" "text",
    "status" "text",
    "remark" "text",
    "actual3" timestamp without time zone,
    "assign_nurse" "text",
    "submitted_by" "text"
);


ALTER TABLE "public"."ot_information" OWNER TO "postgres";


ALTER TABLE "public"."ot_information" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."ot_information_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."ot_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ot_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_admission" (
    "id" bigint NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    "admission_no" "text",
    "patient_name" "text",
    "phone_no" "text",
    "attender_name" "text",
    "attender_mobile_no" "text",
    "reason_for_visit" "text",
    "date_of_birth" "text",
    "age" "text",
    "gender" "text",
    "status" "text",
    "planned1" "text",
    "actual1" "text",
    "delay" "text",
    "department" "text",
    "planned2" timestamp without time zone,
    "actual2" timestamp without time zone,
    "delay2" "text",
    "ipd_number" "text",
    "submitted_by" "text"
);


ALTER TABLE "public"."patient_admission" OWNER TO "postgres";


ALTER TABLE "public"."patient_admission" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."patient_admission_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."patient_deletion_log" (
    "id" bigint NOT NULL,
    "ipd_number" "text",
    "admission_no" "text",
    "patient_name" "text",
    "deleted_by" "text" NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"(),
    "deletion_summary" "jsonb"
);


ALTER TABLE "public"."patient_deletion_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."patient_deletion_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."patient_deletion_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."patient_deletion_log_id_seq" OWNED BY "public"."patient_deletion_log"."id";



CREATE TABLE IF NOT EXISTS "public"."pharmacy" (
    "id" bigint NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    "indent_no" "text",
    "admission_number" "text",
    "ipd_number" "text",
    "staff_name" "text",
    "consultant_name" "text",
    "patient_name" "text",
    "uhid_number" "text",
    "age" "text",
    "gender" "text",
    "ward_location" "text",
    "category" "text",
    "room" "text",
    "diagnosis" "text",
    "request_types" "text",
    "medicines" "text",
    "investigations" "text",
    "investigation_advice" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "delay" "text",
    "planned1" timestamp without time zone,
    "actual1" timestamp without time zone,
    "approved_by" "text",
    "slip_image" "text",
    "planned2" timestamp without time zone,
    "actual2" timestamp without time zone,
    "delay2" "text",
    "surgical_date" "text"
);


ALTER TABLE "public"."pharmacy" OWNER TO "postgres";


ALTER TABLE "public"."pharmacy" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pharmacy_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."pharmacy_indent_seq"
    START WITH 20000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pharmacy_indent_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pre_defined_task" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "task" "text",
    "staff" "text",
    "status" "text"
);


ALTER TABLE "public"."pre_defined_task" OWNER TO "postgres";


ALTER TABLE "public"."pre_defined_task" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pre_defined_task_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."rmo_assign_task" (
    "id" bigint NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    "task_no" "text",
    "ipd_number" "text",
    "patient_name" "text",
    "patient_location" "text",
    "ward_type" "text",
    "room" "text",
    "bed_no" "text",
    "shift" "text",
    "assign_rmo" "text",
    "reminder" "text",
    "start_date" "date",
    "task" "text",
    "planned1" timestamp without time zone,
    "actual1" timestamp without time zone,
    "ot_information" "text",
    "status" "text",
    "submitted_by" "text"
);


ALTER TABLE "public"."rmo_assign_task" OWNER TO "postgres";


ALTER TABLE "public"."rmo_assign_task" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."rmo_assign_task_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "public"."rmo_assign_task_task_no_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rmo_assign_task_task_no_seq" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."rmo_task_no_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rmo_task_no_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roster" (
    "id" integer NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "shift" character varying(20) NOT NULL,
    "male_general_ward" "text",
    "female_general_ward" "text",
    "icu" "text",
    "hdu" "text",
    "private_ward" "text",
    "nicu" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "start_date" "date",
    "picu" "text",
    "general_ward_5th_floor" "text",
    CONSTRAINT "roster_shift_check" CHECK ((("shift")::"text" = ANY ((ARRAY['Shift A'::character varying, 'Shift B'::character varying, 'Shift C'::character varying])::"text"[])))
);


ALTER TABLE "public"."roster" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."roster_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."roster_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."roster_id_seq" OWNED BY "public"."roster"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."serial_no_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."serial_no_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_ticket_assignees" (
    "id" integer NOT NULL,
    "category_id" integer,
    "person_name" "text" NOT NULL,
    "mobile" "text" NOT NULL,
    "role" "text" DEFAULT 'assignee'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "staff_ticket_assignees_role_check" CHECK (("role" = ANY (ARRAY['assignee'::"text", 'escalation'::"text", 'pc'::"text"])))
);


ALTER TABLE "public"."staff_ticket_assignees" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."staff_ticket_assignees_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."staff_ticket_assignees_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."staff_ticket_assignees_id_seq" OWNED BY "public"."staff_ticket_assignees"."id";



CREATE TABLE IF NOT EXISTS "public"."staff_ticket_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "update_id" "uuid",
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "uploaded_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."staff_ticket_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_ticket_categories" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "sla_working_days" integer DEFAULT 1 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "staff_ticket_categories_sla_working_days_check" CHECK (("sla_working_days" >= 0))
);


ALTER TABLE "public"."staff_ticket_categories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."staff_ticket_categories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."staff_ticket_categories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."staff_ticket_categories_id_seq" OWNED BY "public"."staff_ticket_categories"."id";



CREATE TABLE IF NOT EXISTS "public"."staff_ticket_departments" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."staff_ticket_departments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."staff_ticket_departments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."staff_ticket_departments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."staff_ticket_departments_id_seq" OWNED BY "public"."staff_ticket_departments"."id";



CREATE TABLE IF NOT EXISTS "public"."staff_ticket_issue_options" (
    "id" integer NOT NULL,
    "category_id" integer NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."staff_ticket_issue_options" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."staff_ticket_issue_options_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."staff_ticket_issue_options_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."staff_ticket_issue_options_id_seq" OWNED BY "public"."staff_ticket_issue_options"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."staff_ticket_no_seq"
    START WITH 15
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."staff_ticket_no_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_ticket_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "stage" "text" NOT NULL,
    "description" "text",
    "updated_by_name" "text",
    "updated_by_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_ticket_updates_completed_needs_text" CHECK ((("stage" <> 'completed'::"text") OR ("length"("btrim"(COALESCE("description", ''::"text"))) > 0))),
    CONSTRAINT "staff_ticket_updates_stage_check" CHECK (("stage" = ANY (ARRAY['analysis'::"text", 'working'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."staff_ticket_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_no" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "staff_name" "text" NOT NULL,
    "mobile" "text" NOT NULL,
    "designation" "text",
    "department" "text" NOT NULL,
    "category_id" integer NOT NULL,
    "issue_option_id" integer,
    "issue_other_text" "text",
    "problem_text" "text" NOT NULL,
    "is_confidential" boolean DEFAULT false NOT NULL,
    "planned_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "staff_tickets_mobile_check" CHECK (("mobile" ~ '^[0-9]{10}$'::"text")),
    CONSTRAINT "staff_tickets_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'analysis'::"text", 'working'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."staff_tickets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."staff_tickets_overview" WITH ("security_invoker"='true') AS
 SELECT "t"."id",
    "t"."ticket_no",
    "t"."created_at",
    "t"."email",
    "t"."staff_name",
    "t"."mobile",
    "t"."designation",
    "t"."department",
    "t"."category_id",
    "c"."name" AS "category_name",
    "t"."issue_option_id",
    "io"."name" AS "issue_name",
    "t"."issue_other_text",
    "t"."problem_text",
    "t"."is_confidential",
    "t"."planned_at",
    "t"."status",
    "t"."completed_at",
        CASE
            WHEN ("t"."completed_at" IS NOT NULL) THEN GREATEST((EXTRACT(epoch FROM ("t"."completed_at" - "t"."planned_at")) / 3600.0), (0)::numeric)
            ELSE (EXTRACT(epoch FROM ("now"() - "t"."planned_at")) / 3600.0)
        END AS "delay_hours",
    ((("t"."completed_at" IS NULL) AND ("now"() > "t"."planned_at")) OR (("t"."completed_at" IS NOT NULL) AND ("t"."completed_at" > "t"."planned_at"))) AS "is_overdue",
    "lu"."description" AS "last_update_text",
    "lu"."created_at" AS "last_update_at",
    COALESCE("uc"."cnt", 0) AS "updates_count"
   FROM (((("public"."staff_tickets" "t"
     JOIN "public"."staff_ticket_categories" "c" ON (("c"."id" = "t"."category_id")))
     LEFT JOIN "public"."staff_ticket_issue_options" "io" ON (("io"."id" = "t"."issue_option_id")))
     LEFT JOIN LATERAL ( SELECT "u"."description",
            "u"."created_at"
           FROM "public"."staff_ticket_updates" "u"
          WHERE ("u"."ticket_id" = "t"."id")
          ORDER BY "u"."created_at" DESC
         LIMIT 1) "lu" ON (true))
     LEFT JOIN LATERAL ( SELECT ("count"(*))::integer AS "cnt"
           FROM "public"."staff_ticket_updates" "u"
          WHERE ("u"."ticket_id" = "t"."id")) "uc" ON (true));


ALTER VIEW "public"."staff_tickets_overview" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."surgical_data" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ipd_number" "text",
    "patient_name" "text",
    "surgery_time" "text",
    "surgery_date" "date",
    "planned1" timestamp without time zone,
    "actual1" timestamp without time zone
);


ALTER TABLE "public"."surgical_data" OWNER TO "postgres";


ALTER TABLE "public"."surgical_data" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."surgical_data_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."trigger_debug_log" (
    "id" integer NOT NULL,
    "message" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."trigger_debug_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."trigger_debug_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."trigger_debug_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."trigger_debug_log_id_seq" OWNED BY "public"."trigger_debug_log"."id";



CREATE TABLE IF NOT EXISTS "public"."users" (
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_name" "text",
    "password" "text",
    "role" "text",
    "phone_no" "text",
    "email" "text",
    "pages" "text",
    "name" "text",
    "profile_image" "text",
    "id" bigint NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."users_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."users_id_seq" OWNED BY "public"."users"."id";



CREATE TABLE IF NOT EXISTS "public"."ward_config" (
    "id" integer NOT NULL,
    "ward_name" "text",
    "roster_column" "text"
);


ALTER TABLE "public"."ward_config" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ward_config_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ward_config_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ward_config_id_seq" OWNED BY "public"."ward_config"."id";



ALTER TABLE ONLY "public"."all_staff" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."all_staff_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."leave" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."leave_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."patient_deletion_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."patient_deletion_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."roster" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."roster_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."staff_ticket_assignees" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."staff_ticket_assignees_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."staff_ticket_categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."staff_ticket_categories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."staff_ticket_departments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."staff_ticket_departments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."staff_ticket_issue_options" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."staff_ticket_issue_options_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."trigger_debug_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."trigger_debug_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."users" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."users_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ward_config" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ward_config_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."all_floor_bed"
    ADD CONSTRAINT "all_floor_bed_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."all_staff"
    ADD CONSTRAINT "all_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ayushman_portal"
    ADD CONSTRAINT "ayushman_portal_admission_no_key" UNIQUE ("admission_no");



ALTER TABLE ONLY "public"."ayushman_portal"
    ADD CONSTRAINT "ayushman_portal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category"
    ADD CONSTRAINT "category_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."congratulations_posts"
    ADD CONSTRAINT "congratulations_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departmental_pharmacy_indent"
    ADD CONSTRAINT "departmental_pharmacy_indent_indent_no_key" UNIQUE ("indent_no");



ALTER TABLE ONLY "public"."departmental_pharmacy_indent"
    ADD CONSTRAINT "departmental_pharmacy_indent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discharge"
    ADD CONSTRAINT "discharge_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doctors"
    ADD CONSTRAINT "doctors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dressing"
    ADD CONSTRAINT "dressing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investigation"
    ADD CONSTRAINT "investigation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ipd_admissions"
    ADD CONSTRAINT "ipd_admissions_admission_no_unique" UNIQUE ("admission_no");



ALTER TABLE ONLY "public"."ipd_admissions"
    ADD CONSTRAINT "ipd_patient_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab"
    ADD CONSTRAINT "lab_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave"
    ADD CONSTRAINT "leave_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master"
    ADD CONSTRAINT "master_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medicine"
    ADD CONSTRAINT "medicine_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nurse_assign_task"
    ADD CONSTRAINT "nurse_assign_task_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nurse_monthly_stats"
    ADD CONSTRAINT "nurse_monthly_stats_nurse_name_month_key" UNIQUE ("nurse_name", "month");



ALTER TABLE ONLY "public"."nurse_monthly_stats"
    ADD CONSTRAINT "nurse_monthly_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ot_information"
    ADD CONSTRAINT "ot_information_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_admission"
    ADD CONSTRAINT "patient_admission_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_deletion_log"
    ADD CONSTRAINT "patient_deletion_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pharmacy"
    ADD CONSTRAINT "pharmacy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pre_defined_task"
    ADD CONSTRAINT "pre_defined_task_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rmo_assign_task"
    ADD CONSTRAINT "rmo_assign_task_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rmo_assign_task"
    ADD CONSTRAINT "rmo_assign_task_task_no_key" UNIQUE ("task_no");



ALTER TABLE ONLY "public"."roster"
    ADD CONSTRAINT "roster_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_ticket_assignees"
    ADD CONSTRAINT "staff_ticket_assignees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_ticket_attachments"
    ADD CONSTRAINT "staff_ticket_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_ticket_categories"
    ADD CONSTRAINT "staff_ticket_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."staff_ticket_categories"
    ADD CONSTRAINT "staff_ticket_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_ticket_departments"
    ADD CONSTRAINT "staff_ticket_departments_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."staff_ticket_departments"
    ADD CONSTRAINT "staff_ticket_departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_ticket_issue_options"
    ADD CONSTRAINT "staff_ticket_issue_options_category_id_name_key" UNIQUE ("category_id", "name");



ALTER TABLE ONLY "public"."staff_ticket_issue_options"
    ADD CONSTRAINT "staff_ticket_issue_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_ticket_updates"
    ADD CONSTRAINT "staff_ticket_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_tickets"
    ADD CONSTRAINT "staff_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_tickets"
    ADD CONSTRAINT "staff_tickets_ticket_no_key" UNIQUE ("ticket_no");



ALTER TABLE ONLY "public"."surgical_data"
    ADD CONSTRAINT "surgical_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trigger_debug_log"
    ADD CONSTRAINT "trigger_debug_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_admission"
    ADD CONSTRAINT "unique_admission_no" UNIQUE ("admission_no");



ALTER TABLE ONLY "public"."ipd_admissions"
    ADD CONSTRAINT "unique_ipd_number" UNIQUE ("ipd_number");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ward_config"
    ADD CONSTRAINT "ward_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ward_config"
    ADD CONSTRAINT "ward_config_ward_name_key" UNIQUE ("ward_name");



CREATE INDEX "idx_all_staff_designation" ON "public"."all_staff" USING "btree" ("designation");



CREATE INDEX "idx_all_staff_name_trgm" ON "public"."all_staff" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_ayushman_portal_admission_no" ON "public"."ayushman_portal" USING "btree" ("admission_no");



CREATE INDEX "idx_ayushman_portal_ipd_id" ON "public"."ayushman_portal" USING "btree" ("ipd_admission_id");



CREATE INDEX "idx_congrats_active_recent" ON "public"."congratulations_posts" USING "btree" ("created_at" DESC) WHERE ("is_active" = true);



CREATE INDEX "idx_congrats_post_type" ON "public"."congratulations_posts" USING "btree" ("post_type") WHERE ("is_active" = true);



CREATE INDEX "idx_dept_indent_pending" ON "public"."departmental_pharmacy_indent" USING "btree" ("timestamp" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_dept_indent_status" ON "public"."departmental_pharmacy_indent" USING "btree" ("status");



CREATE INDEX "idx_dept_indent_store_view" ON "public"."departmental_pharmacy_indent" USING "btree" ("timestamp" DESC) WHERE (("planned2" IS NOT NULL) AND ("status" <> 'rejected'::"text"));



CREATE INDEX "idx_dept_indent_timestamp" ON "public"."departmental_pharmacy_indent" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_discharge_active" ON "public"."discharge" USING "btree" ("planned1" DESC) WHERE (("planned1" IS NOT NULL) AND ("actual1" IS NULL));



CREATE INDEX "idx_discharge_admission_no" ON "public"."discharge" USING "btree" ("admission_no");



CREATE INDEX "idx_discharge_history" ON "public"."discharge" USING "btree" ("actual1" DESC) WHERE (("planned1" IS NOT NULL) AND ("actual1" IS NOT NULL) AND ("rmo_name" IS NOT NULL));



CREATE INDEX "idx_discharge_planned1" ON "public"."discharge" USING "btree" ("planned1" DESC) WHERE ("planned1" IS NOT NULL);



CREATE INDEX "idx_doctors_name" ON "public"."doctors" USING "btree" ("name");



CREATE INDEX "idx_dressing_ipd_number" ON "public"."dressing" USING "btree" ("ipd_number");



CREATE INDEX "idx_dressing_status" ON "public"."dressing" USING "btree" ("status");



CREATE INDEX "idx_floor_bed_location" ON "public"."all_floor_bed" USING "btree" ("floor", "ward", "room", "bed");



CREATE INDEX "idx_floor_bed_status" ON "public"."all_floor_bed" USING "btree" ("status");



CREATE INDEX "idx_investigation_name" ON "public"."investigation" USING "btree" ("name");



CREATE INDEX "idx_investigation_type" ON "public"."investigation" USING "btree" ("type");



CREATE INDEX "idx_ipd_admissions_active" ON "public"."ipd_admissions" USING "btree" ("planned1", "actual1") WHERE (("planned1" IS NOT NULL) AND ("actual1" IS NULL));



CREATE INDEX "idx_ipd_admissions_admission_no" ON "public"."ipd_admissions" USING "btree" ("admission_no");



CREATE INDEX "idx_ipd_admissions_consultant_dr" ON "public"."ipd_admissions" USING "btree" ("consultant_dr");



CREATE INDEX "idx_ipd_admissions_department" ON "public"."ipd_admissions" USING "btree" ("department");



CREATE INDEX "idx_ipd_admissions_fts" ON "public"."ipd_admissions" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((((COALESCE("patient_name", ''::"text") || ' '::"text") || COALESCE("ipd_number", ''::"text")) || ' '::"text") || COALESCE("phone_no", ''::"text"))));



CREATE INDEX "idx_ipd_admissions_ipd_number" ON "public"."ipd_admissions" USING "btree" ("ipd_number");



CREATE INDEX "idx_ipd_admissions_name_trgm" ON "public"."ipd_admissions" USING "gin" ("patient_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_ipd_admissions_status" ON "public"."ipd_admissions" USING "btree" ("status");



CREATE INDEX "idx_ipd_admissions_timestamp" ON "public"."ipd_admissions" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_ipd_admissions_ward_type" ON "public"."ipd_admissions" USING "btree" ("ward_type");



CREATE INDEX "idx_lab_admission_no" ON "public"."lab" USING "btree" ("admission_no");



CREATE INDEX "idx_lab_ipd_number" ON "public"."lab" USING "btree" ("ipd_number");



CREATE INDEX "idx_lab_status" ON "public"."lab" USING "btree" ("status");



CREATE INDEX "idx_lab_timestamp" ON "public"."lab" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_leave_date" ON "public"."leave" USING "btree" ("leave_date" DESC);



CREATE INDEX "idx_leave_staff_date" ON "public"."leave" USING "btree" ("staff_name", "leave_date");



CREATE INDEX "idx_medicine_name" ON "public"."medicine" USING "btree" ("medicine_name");



CREATE INDEX "idx_medicine_name_trgm" ON "public"."medicine" USING "gin" ("medicine_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_nat_assign_lookup" ON "public"."nurse_assign_task" USING "btree" ("assign_nurse", "shift", "start_date", "status");



CREATE INDEX "idx_nat_assign_nurse" ON "public"."nurse_assign_task" USING "btree" ("assign_nurse");



CREATE INDEX "idx_nat_ipd_lookup" ON "public"."nurse_assign_task" USING "btree" ("Ipd_number", "shift", "task", "start_date");



CREATE INDEX "idx_nat_ipd_number" ON "public"."nurse_assign_task" USING "btree" ("Ipd_number");



CREATE INDEX "idx_nat_ipd_number_trgm" ON "public"."nurse_assign_task" USING "gin" ("Ipd_number" "public"."gin_trgm_ops");



CREATE INDEX "idx_nat_nurse_planned1" ON "public"."nurse_assign_task" USING "btree" ("assign_nurse", "planned1" DESC);



CREATE INDEX "idx_nat_nurse_timestamp" ON "public"."nurse_assign_task" USING "btree" ("assign_nurse", "timestamp" DESC);



CREATE INDEX "idx_nat_nurse_trgm" ON "public"."nurse_assign_task" USING "gin" ("assign_nurse" "public"."gin_trgm_ops");



CREATE INDEX "idx_nat_patient_name_trgm" ON "public"."nurse_assign_task" USING "gin" ("patient_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_nat_planned1" ON "public"."nurse_assign_task" USING "btree" ("planned1" DESC);



CREATE INDEX "idx_nat_shift" ON "public"."nurse_assign_task" USING "btree" ("shift");



CREATE INDEX "idx_nat_staff" ON "public"."nurse_assign_task" USING "btree" ("staff", "timestamp" DESC) WHERE ("staff" IS NOT NULL);



CREATE INDEX "idx_nat_start_date" ON "public"."nurse_assign_task" USING "btree" ("start_date");



CREATE INDEX "idx_nat_status" ON "public"."nurse_assign_task" USING "btree" ("status");



CREATE INDEX "idx_nat_task_no_trgm" ON "public"."nurse_assign_task" USING "gin" ("task_no" "public"."gin_trgm_ops");



CREATE INDEX "idx_nat_task_trgm" ON "public"."nurse_assign_task" USING "gin" ("task" "public"."gin_trgm_ops");



CREATE INDEX "idx_nat_timestamp" ON "public"."nurse_assign_task" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_ot_actual2" ON "public"."ot_information" USING "btree" ("actual2" DESC) WHERE ("actual2" IS NOT NULL);



CREATE INDEX "idx_ot_ipd_number" ON "public"."ot_information" USING "btree" ("ipd_number");



CREATE INDEX "idx_ot_status" ON "public"."ot_information" USING "btree" ("status");



CREATE INDEX "idx_patient_admission_admission_no" ON "public"."patient_admission" USING "btree" ("admission_no");



CREATE INDEX "idx_patient_admission_department" ON "public"."patient_admission" USING "btree" ("department");



CREATE INDEX "idx_patient_admission_fts" ON "public"."patient_admission" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((COALESCE("patient_name", ''::"text") || ' '::"text") || COALESCE("phone_no", ''::"text"))));



CREATE INDEX "idx_patient_admission_name_trgm" ON "public"."patient_admission" USING "gin" ("patient_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_patient_admission_status" ON "public"."patient_admission" USING "btree" ("status");



CREATE INDEX "idx_patient_admission_timestamp" ON "public"."patient_admission" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_pharmacy_admission_number" ON "public"."pharmacy" USING "btree" ("admission_number");



CREATE INDEX "idx_pharmacy_history_actual1" ON "public"."pharmacy" USING "btree" ("actual1" DESC NULLS LAST, "id" DESC) WHERE ("status" = ANY (ARRAY['approved'::"text", 'rejected'::"text"]));



CREATE INDEX "idx_pharmacy_ipd_number" ON "public"."pharmacy" USING "btree" ("ipd_number");



CREATE INDEX "idx_pharmacy_pending" ON "public"."pharmacy" USING "btree" ("timestamp" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_pharmacy_status" ON "public"."pharmacy" USING "btree" ("status");



CREATE INDEX "idx_pharmacy_store_view" ON "public"."pharmacy" USING "btree" ("timestamp" DESC) WHERE (("planned2" IS NOT NULL) AND ("status" <> 'rejected'::"text"));



CREATE INDEX "idx_pharmacy_timestamp" ON "public"."pharmacy" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_rat_assign_rmo" ON "public"."rmo_assign_task" USING "btree" ("assign_rmo");



CREATE INDEX "idx_rat_ipd_number" ON "public"."rmo_assign_task" USING "btree" ("ipd_number");



CREATE INDEX "idx_rat_planned1" ON "public"."rmo_assign_task" USING "btree" ("planned1" DESC);



CREATE INDEX "idx_rat_rmo_planned1" ON "public"."rmo_assign_task" USING "btree" ("assign_rmo", "planned1" DESC);



CREATE INDEX "idx_rat_status" ON "public"."rmo_assign_task" USING "btree" ("status");



CREATE INDEX "idx_rat_task_no" ON "public"."rmo_assign_task" USING "btree" ("task_no");



CREATE INDEX "idx_rat_timestamp" ON "public"."rmo_assign_task" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_roster_shift" ON "public"."roster" USING "btree" ("shift");



CREATE INDEX "idx_roster_start_date" ON "public"."roster" USING "btree" ("start_date" DESC);



CREATE INDEX "idx_surgical_data_ipd_number" ON "public"."surgical_data" USING "btree" ("ipd_number");



CREATE UNIQUE INDEX "staff_ticket_assignees_uniq" ON "public"."staff_ticket_assignees" USING "btree" (COALESCE("category_id", 0), "mobile", "role");



CREATE INDEX "staff_ticket_attachments_ticket_idx" ON "public"."staff_ticket_attachments" USING "btree" ("ticket_id");



CREATE INDEX "staff_ticket_updates_ticket_idx" ON "public"."staff_ticket_updates" USING "btree" ("ticket_id", "created_at");



CREATE INDEX "staff_tickets_category_idx" ON "public"."staff_tickets" USING "btree" ("category_id");



CREATE INDEX "staff_tickets_created_idx" ON "public"."staff_tickets" USING "btree" ("created_at" DESC);



CREATE INDEX "staff_tickets_mobile_idx" ON "public"."staff_tickets" USING "btree" ("mobile");



CREATE INDEX "staff_tickets_status_idx" ON "public"."staff_tickets" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "pharmacy_ipd_update_trigger" AFTER INSERT OR UPDATE ON "public"."pharmacy" FOR EACH ROW EXECUTE FUNCTION "public"."update_ipd_from_pharmacy"();



CREATE OR REPLACE TRIGGER "set_dressing_task_no_before_insert" BEFORE INSERT ON "public"."dressing" FOR EACH ROW EXECUTE FUNCTION "public"."generate_dressing_task_no"();



CREATE OR REPLACE TRIGGER "set_lab_no" BEFORE INSERT ON "public"."lab" FOR EACH ROW WHEN ((("new"."lab_no" IS NULL) OR ("new"."lab_no" = ''::"text"))) EXECUTE FUNCTION "public"."generate_lab_no"();



CREATE OR REPLACE TRIGGER "set_ot_number_before_insert" BEFORE INSERT ON "public"."ot_information" FOR EACH ROW EXECUTE FUNCTION "public"."generate_ot_number"();



CREATE OR REPLACE TRIGGER "set_rmo_task_no_before_insert" BEFORE INSERT ON "public"."rmo_assign_task" FOR EACH ROW EXECUTE FUNCTION "public"."generate_rmo_task_no"();



CREATE OR REPLACE TRIGGER "set_task_no_before_insert" BEFORE INSERT ON "public"."nurse_assign_task" FOR EACH ROW EXECUTE FUNCTION "public"."generate_task_no"();



CREATE OR REPLACE TRIGGER "trg_baby_received_rmo_task" AFTER UPDATE ON "public"."nurse_assign_task" FOR EACH ROW EXECUTE FUNCTION "public"."fn_generate_rmo_task_baby_received"();



CREATE OR REPLACE TRIGGER "trg_baby_received_rmo_task_nicu" AFTER UPDATE ON "public"."nurse_assign_task" FOR EACH ROW EXECUTE FUNCTION "public"."fn_generate_rmo_task_baby_received_nicu"();



CREATE OR REPLACE TRIGGER "trg_create_nurse_task" AFTER INSERT ON "public"."ipd_admissions" FOR EACH ROW EXECUTE FUNCTION "public"."fn_create_nurse_tasks"();



CREATE OR REPLACE TRIGGER "trg_generate_discharge_number" BEFORE INSERT ON "public"."discharge" FOR EACH ROW EXECUTE FUNCTION "public"."generate_discharge_number"();



CREATE OR REPLACE TRIGGER "trg_generate_indent_no" BEFORE INSERT ON "public"."pharmacy" FOR EACH ROW EXECUTE FUNCTION "public"."generate_indent_no"();



CREATE OR REPLACE TRIGGER "trg_generate_pre_ot_nurse_task" AFTER UPDATE OF "actual1" ON "public"."ot_information" FOR EACH ROW EXECUTE FUNCTION "public"."fn_generate_pre_ot_nurse_tasks"();



CREATE OR REPLACE TRIGGER "trg_generate_rmo_task" AFTER UPDATE ON "public"."nurse_assign_task" FOR EACH ROW EXECUTE FUNCTION "public"."fn_generate_rmo_task"();



CREATE OR REPLACE TRIGGER "trg_generate_rmo_task_no" BEFORE INSERT ON "public"."rmo_assign_task" FOR EACH ROW EXECUTE FUNCTION "public"."generate_rmo_task_no"();



CREATE OR REPLACE TRIGGER "trg_ipd_bed_occupancy_insert" BEFORE INSERT ON "public"."ipd_admissions" FOR EACH ROW EXECUTE FUNCTION "public"."fn_ipd_bed_occupancy"();



CREATE OR REPLACE TRIGGER "trg_ipd_bed_occupancy_update" AFTER UPDATE OF "floor", "ward_type", "room", "bed_no" ON "public"."ipd_admissions" FOR EACH ROW WHEN ((("old"."floor" IS DISTINCT FROM "new"."floor") OR ("old"."ward_type" IS DISTINCT FROM "new"."ward_type") OR ("old"."room" IS DISTINCT FROM "new"."room") OR ("old"."bed_no" IS DISTINCT FROM "new"."bed_no"))) EXECUTE FUNCTION "public"."fn_ipd_bed_occupancy"();



CREATE OR REPLACE TRIGGER "trg_ipd_mark_patient_admitted" AFTER INSERT ON "public"."ipd_admissions" FOR EACH ROW EXECUTE FUNCTION "public"."fn_ipd_mark_patient_admitted"();



CREATE OR REPLACE TRIGGER "trg_lab_payment_confirmed" AFTER UPDATE OF "payment_status" ON "public"."lab" FOR EACH ROW WHEN ((("new"."payment_status" = 'Yes'::"text") AND ("old"."payment_status" IS DISTINCT FROM 'Yes'::"text"))) EXECUTE FUNCTION "public"."fn_lab_generate_nurse_task"();



CREATE OR REPLACE TRIGGER "trg_leave_insert" AFTER INSERT ON "public"."leave" FOR EACH ROW EXECUTE FUNCTION "public"."fn_handle_leave_insert"();



CREATE OR REPLACE TRIGGER "trg_nurse_assign_task_insert" AFTER INSERT ON "public"."nurse_assign_task" FOR EACH ROW EXECUTE FUNCTION "public"."fn_update_ot_information_from_nurse_task"();



CREATE OR REPLACE TRIGGER "trg_ot_cancel_delete_nurse_task" AFTER UPDATE OF "status" ON "public"."ot_information" FOR EACH ROW EXECUTE FUNCTION "public"."delete_nurse_task_on_ot_cancel"();



CREATE OR REPLACE TRIGGER "trg_prevent_lab_tasks_unpaid" BEFORE UPDATE ON "public"."lab" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_lab_tasks_unpaid"();



CREATE OR REPLACE TRIGGER "trg_reassign_on_ward_change" AFTER UPDATE OF "ward_type" ON "public"."ipd_admissions" FOR EACH ROW WHEN (("old"."ward_type" IS DISTINCT FROM "new"."ward_type")) EXECUTE FUNCTION "public"."fn_create_nurse_tasks"();



CREATE OR REPLACE TRIGGER "trg_set_bed_null" AFTER UPDATE OF "actual1" ON "public"."ipd_admissions" FOR EACH ROW WHEN ((("old"."actual1" IS NULL) AND ("new"."actual1" IS NOT NULL))) EXECUTE FUNCTION "public"."set_bed_status_null_on_actual1"();



CREATE OR REPLACE TRIGGER "trg_set_departmental_pharmacy_indent_no" BEFORE INSERT ON "public"."departmental_pharmacy_indent" FOR EACH ROW EXECUTE FUNCTION "public"."set_departmental_pharmacy_indent_no"();



CREATE OR REPLACE TRIGGER "trg_set_discharge_category" BEFORE INSERT ON "public"."discharge" FOR EACH ROW EXECUTE FUNCTION "public"."set_discharge_category"();



CREATE OR REPLACE TRIGGER "trg_set_time_in_ward_new_row" BEFORE INSERT ON "public"."ipd_admissions" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_time_in_ward_new_row"();



CREATE OR REPLACE TRIGGER "trg_staff_ticket_updates_after_insert" AFTER INSERT ON "public"."staff_ticket_updates" FOR EACH ROW EXECUTE FUNCTION "public"."staff_ticket_updates_after_insert"();



CREATE OR REPLACE TRIGGER "trg_staff_tickets_before_insert" BEFORE INSERT ON "public"."staff_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."staff_tickets_before_insert"();



CREATE OR REPLACE TRIGGER "trg_update_bed_status" AFTER INSERT OR UPDATE ON "public"."ipd_admissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_bed_status_on_actual1"();

ALTER TABLE "public"."ipd_admissions" DISABLE TRIGGER "trg_update_bed_status";



CREATE OR REPLACE TRIGGER "trigger_set_admission_no" BEFORE INSERT ON "public"."patient_admission" FOR EACH ROW EXECUTE FUNCTION "public"."set_admission_no"();



CREATE OR REPLACE TRIGGER "trigger_set_serial_no" BEFORE INSERT ON "public"."all_floor_bed" FOR EACH ROW EXECUTE FUNCTION "public"."set_serial_no"();

ALTER TABLE "public"."all_floor_bed" DISABLE TRIGGER "trigger_set_serial_no";



ALTER TABLE ONLY "public"."staff_ticket_assignees"
    ADD CONSTRAINT "staff_ticket_assignees_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."staff_ticket_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_ticket_attachments"
    ADD CONSTRAINT "staff_ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."staff_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_ticket_attachments"
    ADD CONSTRAINT "staff_ticket_attachments_update_id_fkey" FOREIGN KEY ("update_id") REFERENCES "public"."staff_ticket_updates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_ticket_issue_options"
    ADD CONSTRAINT "staff_ticket_issue_options_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."staff_ticket_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_ticket_updates"
    ADD CONSTRAINT "staff_ticket_updates_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."staff_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_tickets"
    ADD CONSTRAINT "staff_tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."staff_ticket_categories"("id");



ALTER TABLE ONLY "public"."staff_tickets"
    ADD CONSTRAINT "staff_tickets_issue_option_id_fkey" FOREIGN KEY ("issue_option_id") REFERENCES "public"."staff_ticket_issue_options"("id");



CREATE POLICY "Allow insert ayushman_portal" ON "public"."ayushman_portal" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Allow read ayushman_portal" ON "public"."ayushman_portal" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow update ayushman_portal" ON "public"."ayushman_portal" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "all" ON "public"."master" USING (true) WITH CHECK (true);



CREATE POLICY "all" ON "public"."nurse_assign_task" USING (true) WITH CHECK (true);



CREATE POLICY "all" ON "public"."ot_information" USING (true) WITH CHECK (true);



CREATE POLICY "all" ON "public"."patient_admission" USING (true) WITH CHECK (true);



CREATE POLICY "all" ON "public"."pre_defined_task" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."all_floor_bed" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."all_staff" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."discharge" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."doctors" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."dressing" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."investigation" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."ipd_admissions" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."lab" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."leave" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."master" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."medicine" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."pharmacy" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."roster" USING (true) WITH CHECK (true);



CREATE POLICY "all access" ON "public"."users" USING (true) WITH CHECK (true);



CREATE POLICY "all task " ON "public"."rmo_assign_task" USING (true) WITH CHECK (true);



ALTER TABLE "public"."all_floor_bed" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."all_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ayushman_portal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discharge" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doctors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dressing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."investigation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ipd_admissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."master" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medicine" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nurse_assign_task" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ot_information" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_admission" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pharmacy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pre_defined_task" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rmo_assign_task" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roster" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_ticket_all_access" ON "public"."staff_ticket_assignees" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "staff_ticket_all_access" ON "public"."staff_ticket_attachments" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "staff_ticket_all_access" ON "public"."staff_ticket_categories" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "staff_ticket_all_access" ON "public"."staff_ticket_departments" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "staff_ticket_all_access" ON "public"."staff_ticket_issue_options" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "staff_ticket_all_access" ON "public"."staff_ticket_updates" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "staff_ticket_all_access" ON "public"."staff_tickets" TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."staff_ticket_assignees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_ticket_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_ticket_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_ticket_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_ticket_issue_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_ticket_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."surgical_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."all_floor_bed";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."congratulations_posts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."discharge";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."investigation";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ipd_admissions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."lab";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."nurse_assign_task";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."patient_admission";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pharmacy";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."surgical_data";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."add_multiple_beds"("p_floor" "text", "p_ward" "text", "p_room" "text", "p_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."add_multiple_beds"("p_floor" "text", "p_ward" "text", "p_room" "text", "p_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_multiple_beds"("p_floor" "text", "p_ward" "text", "p_room" "text", "p_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cron_admin_eod_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."cron_admin_eod_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cron_admin_eod_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cron_admin_pending_approvals"() TO "anon";
GRANT ALL ON FUNCTION "public"."cron_admin_pending_approvals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cron_admin_pending_approvals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_nurse_task_on_ot_cancel"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_nurse_task_on_ot_cancel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_nurse_task_on_ot_cancel"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_patient_completely"("p_ipd_number" "text", "p_admission_no" "text", "p_deleted_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_patient_completely"("p_ipd_number" "text", "p_admission_no" "text", "p_deleted_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_patient_completely"("p_ipd_number" "text", "p_admission_no" "text", "p_deleted_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_block_unpaid_lab_start"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_block_unpaid_lab_start"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_block_unpaid_lab_start"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_create_nurse_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_create_nurse_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_create_nurse_tasks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_create_nurse_tasks_picu"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_create_nurse_tasks_picu"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_create_nurse_tasks_picu"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_create_rmo_tasks_from_nurse"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_create_rmo_tasks_from_nurse"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_create_rmo_tasks_from_nurse"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_generate_icu_two_hour_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generate_icu_two_hour_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generate_icu_two_hour_tasks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_generate_nurse_shift_once_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generate_nurse_shift_once_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generate_nurse_shift_once_tasks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_generate_pre_ot_nurse_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generate_pre_ot_nurse_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generate_pre_ot_nurse_tasks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_generate_rmo_shift_once_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generate_rmo_shift_once_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generate_rmo_shift_once_tasks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_generate_rmo_task"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generate_rmo_task"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generate_rmo_task"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_generate_rmo_task_baby_received"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generate_rmo_task_baby_received"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generate_rmo_task_baby_received"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_generate_rmo_task_baby_received_nicu"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generate_rmo_task_baby_received_nicu"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generate_rmo_task_baby_received_nicu"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_generate_two_hour_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_generate_two_hour_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_generate_two_hour_tasks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_handle_leave_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_handle_leave_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_handle_leave_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_ipd_bed_occupancy"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_ipd_bed_occupancy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ipd_bed_occupancy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_ipd_mark_patient_admitted"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_ipd_mark_patient_admitted"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ipd_mark_patient_admitted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_lab_generate_nurse_task"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_lab_generate_nurse_task"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_lab_generate_nurse_task"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_normalize_ward"("p_ward" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_normalize_ward"("p_ward" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_normalize_ward"("p_ward" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_set_time_in_ward_new_row"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_set_time_in_ward_new_row"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_set_time_in_ward_new_row"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_update_ot_information_from_nurse_task"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_update_ot_information_from_nurse_task"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_update_ot_information_from_nurse_task"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_admission_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_admission_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_admission_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_discharge_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_discharge_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_discharge_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_dressing_task_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_dressing_task_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_dressing_task_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_indent_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_indent_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_indent_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ipd_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ipd_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ipd_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_lab_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_lab_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_lab_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ot_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ot_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ot_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_rmo_task_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_rmo_task_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_rmo_task_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_serial_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_serial_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_serial_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_task_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_task_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_task_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_ipd_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_ipd_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_ipd_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_nurse_patient_ipds"("p_nurse" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_nurse_patient_ipds"("p_nurse" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nurse_patient_ipds"("p_nurse" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_nurse_score_stats"("p_start" "date", "p_end" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_nurse_score_stats"("p_start" "date", "p_end" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_nurse_score_stats"("p_start" "date", "p_end" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_patient_card_nurses"("p_ipds" "text"[], "p_shift" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_patient_card_nurses"("p_ipds" "text"[], "p_shift" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_patient_card_nurses"("p_ipds" "text"[], "p_shift" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pharmacy_history_titles"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pharmacy_history_titles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pharmacy_history_titles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pharmacy_store_filter_options"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pharmacy_store_filter_options"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pharmacy_store_filter_options"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_rmo_score_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_rmo_score_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rmo_score_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_lab_tasks_unpaid"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_lab_tasks_unpaid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_lab_tasks_unpaid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_admission_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_admission_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_admission_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_bed_status_null_on_actual1"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_bed_status_null_on_actual1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_bed_status_null_on_actual1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_departmental_pharmacy_indent_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_departmental_pharmacy_indent_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_departmental_pharmacy_indent_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_discharge_category"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_discharge_category"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_discharge_category"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_ipd_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_ipd_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_ipd_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_serial_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_serial_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_serial_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."staff_ticket_add_working_days"("ts" timestamp with time zone, "n" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."staff_ticket_add_working_days"("ts" timestamp with time zone, "n" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_ticket_add_working_days"("ts" timestamp with time zone, "n" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."staff_ticket_updates_after_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."staff_ticket_updates_after_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_ticket_updates_after_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."staff_tickets_before_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."staff_tickets_before_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_tickets_before_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_sync_ipd_number_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_sync_ipd_number_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_sync_ipd_number_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_update_ipd_time_in_ward"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_update_ipd_time_in_ward"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_update_ipd_time_in_ward"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_bed_status_on_actual1"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_bed_status_on_actual1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bed_status_on_actual1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ipd_from_pharmacy"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ipd_from_pharmacy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ipd_from_pharmacy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ipd_time_in_ward"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ipd_time_in_ward"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ipd_time_in_ward"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";
























GRANT ALL ON SEQUENCE "public"."admission_no_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."admission_no_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."admission_no_seq" TO "service_role";



GRANT ALL ON TABLE "public"."all_floor_bed" TO "anon";
GRANT ALL ON TABLE "public"."all_floor_bed" TO "authenticated";
GRANT ALL ON TABLE "public"."all_floor_bed" TO "service_role";



GRANT ALL ON SEQUENCE "public"."all_floor_bed_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."all_floor_bed_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."all_floor_bed_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."all_staff" TO "anon";
GRANT ALL ON TABLE "public"."all_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."all_staff" TO "service_role";



GRANT ALL ON SEQUENCE "public"."all_staff_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."all_staff_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."all_staff_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ayushman_portal" TO "anon";
GRANT ALL ON TABLE "public"."ayushman_portal" TO "authenticated";
GRANT ALL ON TABLE "public"."ayushman_portal" TO "service_role";



GRANT ALL ON TABLE "public"."discharge" TO "anon";
GRANT ALL ON TABLE "public"."discharge" TO "authenticated";
GRANT ALL ON TABLE "public"."discharge" TO "service_role";



GRANT ALL ON TABLE "public"."ipd_admissions" TO "anon";
GRANT ALL ON TABLE "public"."ipd_admissions" TO "authenticated";
GRANT ALL ON TABLE "public"."ipd_admissions" TO "service_role";



GRANT ALL ON TABLE "public"."ayushman_portal_view" TO "anon";
GRANT ALL ON TABLE "public"."ayushman_portal_view" TO "authenticated";
GRANT ALL ON TABLE "public"."ayushman_portal_view" TO "service_role";



GRANT ALL ON TABLE "public"."category" TO "anon";
GRANT ALL ON TABLE "public"."category" TO "authenticated";
GRANT ALL ON TABLE "public"."category" TO "service_role";



GRANT ALL ON SEQUENCE "public"."category_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."category_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."category_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."congratulations_posts" TO "anon";
GRANT ALL ON TABLE "public"."congratulations_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."congratulations_posts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."departmental_indent_no_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."departmental_indent_no_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."departmental_indent_no_seq" TO "service_role";



GRANT ALL ON TABLE "public"."departmental_pharmacy_indent" TO "anon";
GRANT ALL ON TABLE "public"."departmental_pharmacy_indent" TO "authenticated";
GRANT ALL ON TABLE "public"."departmental_pharmacy_indent" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."discharge_available_patients" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."discharge_available_patients" TO "authenticated";
GRANT ALL ON TABLE "public"."discharge_available_patients" TO "service_role";



GRANT ALL ON SEQUENCE "public"."discharge_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."discharge_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."discharge_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."discharge_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."discharge_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."discharge_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."doctors" TO "anon";
GRANT ALL ON TABLE "public"."doctors" TO "authenticated";
GRANT ALL ON TABLE "public"."doctors" TO "service_role";



GRANT ALL ON SEQUENCE "public"."doctors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."doctors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."doctors_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dressing" TO "anon";
GRANT ALL ON TABLE "public"."dressing" TO "authenticated";
GRANT ALL ON TABLE "public"."dressing" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dressing_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dressing_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dressing_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dressing_task_no_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dressing_task_no_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dressing_task_no_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."indent_sequence" TO "anon";
GRANT ALL ON SEQUENCE "public"."indent_sequence" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."indent_sequence" TO "service_role";



GRANT ALL ON TABLE "public"."investigation" TO "anon";
GRANT ALL ON TABLE "public"."investigation" TO "authenticated";
GRANT ALL ON TABLE "public"."investigation" TO "service_role";



GRANT ALL ON SEQUENCE "public"."investigation_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."investigation_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."investigation_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ipd_no_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ipd_no_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ipd_no_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ipd_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ipd_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ipd_number_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ipd_patient_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ipd_patient_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ipd_patient_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."lab" TO "anon";
GRANT ALL ON TABLE "public"."lab" TO "authenticated";
GRANT ALL ON TABLE "public"."lab" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."lab_advice_pending" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."lab_advice_pending" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_advice_pending" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lab_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lab_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lab_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lab_no_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lab_no_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lab_no_seq" TO "service_role";



GRANT ALL ON TABLE "public"."leave" TO "anon";
GRANT ALL ON TABLE "public"."leave" TO "authenticated";
GRANT ALL ON TABLE "public"."leave" TO "service_role";



GRANT ALL ON SEQUENCE "public"."leave_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."leave_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."leave_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."master" TO "anon";
GRANT ALL ON TABLE "public"."master" TO "authenticated";
GRANT ALL ON TABLE "public"."master" TO "service_role";



GRANT ALL ON SEQUENCE "public"."master_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."master_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."master_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."medicine" TO "anon";
GRANT ALL ON TABLE "public"."medicine" TO "authenticated";
GRANT ALL ON TABLE "public"."medicine" TO "service_role";



GRANT ALL ON SEQUENCE "public"."medicine_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."medicine_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."medicine_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."nurse_assign_task" TO "anon";
GRANT ALL ON TABLE "public"."nurse_assign_task" TO "authenticated";
GRANT ALL ON TABLE "public"."nurse_assign_task" TO "service_role";



GRANT ALL ON SEQUENCE "public"."nurse_assign_task_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."nurse_assign_task_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."nurse_assign_task_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."nurse_monthly_stats" TO "anon";
GRANT ALL ON TABLE "public"."nurse_monthly_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."nurse_monthly_stats" TO "service_role";



GRANT ALL ON SEQUENCE "public"."nurse_task_no_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."nurse_task_no_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."nurse_task_no_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ot_information" TO "anon";
GRANT ALL ON TABLE "public"."ot_information" TO "authenticated";
GRANT ALL ON TABLE "public"."ot_information" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ot_information_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ot_information_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ot_information_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ot_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ot_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ot_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."patient_admission" TO "anon";
GRANT ALL ON TABLE "public"."patient_admission" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_admission" TO "service_role";



GRANT ALL ON SEQUENCE "public"."patient_admission_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."patient_admission_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."patient_admission_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."patient_deletion_log" TO "anon";
GRANT ALL ON TABLE "public"."patient_deletion_log" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_deletion_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."patient_deletion_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."patient_deletion_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."patient_deletion_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pharmacy" TO "anon";
GRANT ALL ON TABLE "public"."pharmacy" TO "authenticated";
GRANT ALL ON TABLE "public"."pharmacy" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pharmacy_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pharmacy_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pharmacy_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pharmacy_indent_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pharmacy_indent_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pharmacy_indent_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pre_defined_task" TO "anon";
GRANT ALL ON TABLE "public"."pre_defined_task" TO "authenticated";
GRANT ALL ON TABLE "public"."pre_defined_task" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pre_defined_task_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pre_defined_task_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pre_defined_task_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rmo_assign_task" TO "anon";
GRANT ALL ON TABLE "public"."rmo_assign_task" TO "authenticated";
GRANT ALL ON TABLE "public"."rmo_assign_task" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rmo_assign_task_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rmo_assign_task_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rmo_assign_task_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rmo_assign_task_task_no_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rmo_assign_task_task_no_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rmo_assign_task_task_no_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rmo_task_no_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rmo_task_no_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rmo_task_no_seq" TO "service_role";



GRANT ALL ON TABLE "public"."roster" TO "anon";
GRANT ALL ON TABLE "public"."roster" TO "authenticated";
GRANT ALL ON TABLE "public"."roster" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roster_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roster_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roster_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."serial_no_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."serial_no_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."serial_no_seq" TO "service_role";



GRANT ALL ON TABLE "public"."staff_ticket_assignees" TO "anon";
GRANT ALL ON TABLE "public"."staff_ticket_assignees" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_ticket_assignees" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staff_ticket_assignees_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staff_ticket_assignees_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staff_ticket_assignees_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."staff_ticket_attachments" TO "anon";
GRANT ALL ON TABLE "public"."staff_ticket_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_ticket_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."staff_ticket_categories" TO "anon";
GRANT ALL ON TABLE "public"."staff_ticket_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_ticket_categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staff_ticket_categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staff_ticket_categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staff_ticket_categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."staff_ticket_departments" TO "anon";
GRANT ALL ON TABLE "public"."staff_ticket_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_ticket_departments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staff_ticket_departments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staff_ticket_departments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staff_ticket_departments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."staff_ticket_issue_options" TO "anon";
GRANT ALL ON TABLE "public"."staff_ticket_issue_options" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_ticket_issue_options" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staff_ticket_issue_options_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staff_ticket_issue_options_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staff_ticket_issue_options_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staff_ticket_no_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staff_ticket_no_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staff_ticket_no_seq" TO "service_role";



GRANT ALL ON TABLE "public"."staff_ticket_updates" TO "anon";
GRANT ALL ON TABLE "public"."staff_ticket_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_ticket_updates" TO "service_role";



GRANT ALL ON TABLE "public"."staff_tickets" TO "anon";
GRANT ALL ON TABLE "public"."staff_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."staff_tickets_overview" TO "anon";
GRANT ALL ON TABLE "public"."staff_tickets_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_tickets_overview" TO "service_role";



GRANT ALL ON TABLE "public"."surgical_data" TO "anon";
GRANT ALL ON TABLE "public"."surgical_data" TO "authenticated";
GRANT ALL ON TABLE "public"."surgical_data" TO "service_role";



GRANT ALL ON SEQUENCE "public"."surgical_data_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."surgical_data_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."surgical_data_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."trigger_debug_log" TO "anon";
GRANT ALL ON TABLE "public"."trigger_debug_log" TO "authenticated";
GRANT ALL ON TABLE "public"."trigger_debug_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."trigger_debug_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."trigger_debug_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."trigger_debug_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ward_config" TO "anon";
GRANT ALL ON TABLE "public"."ward_config" TO "authenticated";
GRANT ALL ON TABLE "public"."ward_config" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ward_config_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ward_config_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ward_config_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































