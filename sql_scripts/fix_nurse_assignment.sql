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
                        -- ICU case removed/ignored here effectively because we filter it out in the outer loop loop, 
                        -- but keeping the logic below safe or we can remove the ICU case branch if desired. 
                        -- Leaving it doesn't hurt as the outer loop filters it.
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
