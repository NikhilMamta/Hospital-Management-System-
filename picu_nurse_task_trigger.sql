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
                CASE
                    -- Explicitly match PICU ward type and select from picu column
                    WHEN lower(replace(new.ward_type,' ', '_')) LIKE '%picu%' 
                        THEN (CASE WHEN coalesce(picu,'') <> '' THEN picu::jsonb ELSE '{"nurse":[]}'::jsonb END)->'nurse'
                    ELSE '{"nurse":[]}'::jsonb -> 'nurse'
                END
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
$function$;

-- Trigger Definition
-- Check if trigger exists and drop it to ensure clean creation
DROP TRIGGER IF EXISTS trg_create_nurse_task ON ipd_admissions;

CREATE TRIGGER trg_create_nurse_task
AFTER INSERT ON ipd_admissions
FOR EACH ROW
WHEN (NEW.ward_type = 'PICU') -- Only run when ward_type is specifically 'PICU'
EXECUTE FUNCTION fn_create_nurse_tasks();
