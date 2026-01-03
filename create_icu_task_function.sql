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
