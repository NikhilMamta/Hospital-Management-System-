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
                    when lower(replace(new.ward_type,' ', '_')) like '%nicu%' 
                        then (CASE WHEN coalesce(nicu,'') <> '' THEN nicu::jsonb ELSE '{"nurse":[]}'::jsonb END)->'nurse'
                    when lower(replace(new.ward_type,' ', '_')) like '%picu%' 
                        then (CASE WHEN coalesce(picu,'') <> '' THEN picu::jsonb ELSE '{"nurse":[]}'::jsonb END)->'nurse'
                    when lower(replace(new.ward_type,' ', '_')) like '%icu%' 
                        then (CASE WHEN coalesce(icu,'') <> '' THEN icu::jsonb ELSE '{"nurse":[]}'::jsonb END)->'nurse'
                    when lower(replace(new.ward_type,' ', '_')) like '%hdu%' 
                        then (CASE WHEN coalesce(hdu,'') <> '' THEN hdu::jsonb ELSE '{"nurse":[]}'::jsonb END)->'nurse'
                    when lower(replace(new.ward_type,' ', '_')) like '%private%' 
                        then (CASE WHEN coalesce(private_ward,'') <> '' THEN private_ward::jsonb ELSE '{"nurse":[]}'::jsonb END)->'nurse'
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
          and nat.status IN ('at once', 'picu', 'nicu')
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

    -- Additional tasks for PICU
    if lower(replace(new.ward_type,' ', '_')) like '%picu%' then
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
    end if;

    -- Additional tasks for NICU
    if lower(replace(new.ward_type,' ', '_')) like '%nicu%' then
        for v_task in
            select task
            from pre_defined_task
            where staff = 'nurse'
              and status = 'nicu'
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
                'nicu'
            );
        end loop;
    end if;

    raise notice 'All tasks assigned to nurse %', v_nurse;
    return new;
end;
$function$;
