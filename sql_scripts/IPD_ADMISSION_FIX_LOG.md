# IPD Admission fix — full change log (single source of truth)

Every change for the IPD Admission timeout fix is recorded here: database SQL, frontend
changes, test results and the production checklist. To repeat the fix on production,
follow this file top to bottom.

## Why

"Admit patient" on `/admin/ipd/admission` timed out. The app runs every request as the
`anon` role, which has a **3 second** statement timeout. One admission INSERT fired:

- `after_insert_update_ipd_time_in_ward`: rewrote `time_in_ward` on **all ~2,338**
  admissions (2,338 trigger calls and 2,338 realtime events per admission).
- `fn_create_nurse_tasks`: the "least busy nurse" query read **all ~500,000** nurse tasks.
  Measured **2,257 ms**. The rewritten query uses `idx_nat_assign_lookup`: **2.4 ms**.

Other problems fixed at the same time:

| Problem | Data on testing (23 Sep 2026) |
|---|---|
| Bed marked occupied by label only (`BED-10` exists in 6 wards) | 74 repeated labels; 54 beds occupied with nobody in them; 9 free beds with a patient |
| No double-booking check | 45 beds with 2+ patients recorded |
| Moving a patient to another bed never freed the old bed | |
| Roster lookup crashed on an empty cell, found nothing if today's roster was missing | |
| `trg_set_bed_null` ran on every update of every admission | |
| Save not atomic: bed and `patient_admission.actual2` were updated by the browser after the insert, and their errors were ignored | |
| Editing a patient reset `planned1` / `timestamp` / `status` to now | |
| Realtime table names passed as arrays: every render (every keystroke in the form) re-subscribed | |
| Deleting an admission (Patient Profile page) left the bed occupied, left pending tasks behind, and the patient could not be admitted again | |
| The admissions list downloaded every row with `select *`; Supabase caps that at 1,000 rows, so older patients never showed and search could not find them | 2,338 admissions |
| A timeout showed a raw database error and the list was not refreshed | |

## Environments

| | Project ref | Org | Status |
|---|---|---|---|
| Testing | `wblnbqkavhthtzvimtnp` | mamta-testing-account | see status table |
| Production | `cyjxqoxcufmvlyigldbl` ("Hospital Management System") | NikhilMamta's Org (Pro plan) | pre-flight passed 26 Sep 2026 |

**Rule:** every SQL call must use the project ref of the environment being changed. Check it with `list_projects` first.
Connectors (26 Sep 2026): the claude.ai Supabase connector is on **testing**; the Supabase **plugin** connector
(`mcp__plugin_supabase_supabase__*`) is on production. The same org also has `store_fms` (`kfdtcqjkesvdfzncfbns`),
a different app — never touch it.

## Status

| Step | Testing | Production |
|---|---|---|
| Pre-flight (PF-1…PF-9) | validated 26 Sep 2026 | **passed 26 Sep 2026** (PF-9 by user) |
| 0. Backup + baseline | **done 25 Sep 2026** | **done 26 Sep 2026** (pg_dump, verified) |
| 1. Apply DB fix | **done 25 Sep 2026** | **done 26 Sep 2026** — without section 6 |
| 1b. Daily cron job | **done 25 Sep 2026** (job 1) | **done 26 Sep 2026** (job 8) |
| 2. Verify | **passed 25 Sep 2026** | 2a **passed 26 Sep 2026**; 2c after the first real admission |
| 3. Bed status repair (data) | **done 25 Sep 2026** (62 beds) | **skip** (preview: 64 of 104 beds would become occupied) |
| 4. Frontend changes | **done in code (24 Sep 2026)**, build passes | DB ready (26 Sep 2026) — **can be deployed now** |

## Deploy order (important)

The frontend no longer updates the bed or `patient_admission.actual2` itself; the database
triggers from step 1 do it. So on any environment: **run step 1 first, then deploy the
frontend.** If the new frontend runs against a database without step 1, patients stay in
the "eligible" list after admission.

---

## Step 0 — Backup and baseline (read-only)

### 0a. Take a full backup (production only; testing is a copy)

```
npx supabase db dump --db-url "<connection string>" -f supabase_backup/prod_schema_<date>.sql
npx supabase db dump --db-url "<connection string>" --data-only -f supabase_backup/prod_data_<date>.sql
```

`supabase_backup/` is git-ignored because it contains patient data.

Used for production (26 Sep 2026): the Supabase CLI is not installed here, but `pg_dump`/`psql` 18.4 are.
The connection string (Dashboard → Connect → Session pooler, with the password) goes in `.env.production.local`
as `PROD_DB_URL=...` (git-ignored). Backup = `pg_dump --schema=public -Fc` (schema + data) +
`pg_dump --schema=public --schema-only` (exact definitions) + cron job list + row counts, all into
`supabase_backup/prod_*_20260926.*`. `pg_dump` only reads (no app blocking). To restore into an empty
project, run `CREATE EXTENSION pg_trgm;` first (it lives in `public` but is not part of the dump).
The dump includes the `users` table (plain-text passwords) — keep the files private.
Second layer: Supabase Pro daily backup (Dashboard → Database → Backups).

### 0b. Save current definitions and compare md5 with testing

If any md5 on production differs from the testing values recorded in the run log below,
**stop**: production has changes that testing does not, and step 1 would overwrite them.

```sql
SELECT 'function' AS kind, p.proname AS name,
       md5(pg_get_functiondef(p.oid)) AS md5,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('fn_create_nurse_tasks', 'update_ipd_time_in_ward',
                    'trg_update_ipd_time_in_ward', 'set_bed_status_null_on_actual1',
                    'get_next_ipd_number')
UNION ALL
SELECT 'trigger', t.tgname, md5(pg_get_triggerdef(t.oid)), pg_get_triggerdef(t.oid) || ';'
FROM pg_trigger t
WHERE t.tgrelid = 'public.ipd_admissions'::regclass AND NOT t.tgisinternal
ORDER BY 1, 2;
```

### 0c. Existing scheduled jobs

```sql
SELECT jobid, jobname, schedule, active, command FROM cron.job ORDER BY jobid;
```

### 0d. Admission test (TESTING ONLY — everything is rolled back)

Inserts one test admission, measures it, tries a double booking and a bed move, then
raises an error on purpose so **nothing is saved**. The result comes back as the error
message. Do **not** run this on production: it uses up one IPD number and task numbers.

```sql
DO $test$
DECLARE
    v_ward    text;
    b1        record;
    b2        record;
    p         record;
    t0        timestamptz;
    ms        numeric;
    v_ipd     text;
    v_tiw     text;
    n_tasks   int;
    lbl_before int;
    lbl_after  int;
    v_actual2 text := 'n/a';
    v_double  text := 'ALLOWED (bad)';
    v_move    text := 'not tested';
BEGIN
    SELECT ward INTO v_ward
    FROM all_floor_bed WHERE status IS NULL
    GROUP BY ward HAVING count(*) >= 2 ORDER BY count(*) DESC LIMIT 1;

    SELECT * INTO b1 FROM all_floor_bed
    WHERE status IS NULL AND ward = v_ward ORDER BY id LIMIT 1;
    SELECT * INTO b2 FROM all_floor_bed
    WHERE status IS NULL AND ward = v_ward AND id <> b1.id ORDER BY id LIMIT 1;

    SELECT pa.admission_no, pa.patient_name INTO p
    FROM patient_admission pa
    WHERE pa.actual2 IS NULL
      AND NOT EXISTS (SELECT 1 FROM ipd_admissions i WHERE i.admission_no = pa.admission_no)
    ORDER BY pa.id DESC LIMIT 1;

    SELECT count(*) INTO lbl_before FROM all_floor_bed WHERE bed = b1.bed AND status IS NOT NULL;

    t0 := clock_timestamp();
    INSERT INTO ipd_admissions (timestamp, admission_no, patient_name, floor, ward_type,
                                location_status, room, bed_no, bed_location, planned1, status)
    VALUES (now() AT TIME ZONE 'Asia/Kolkata', coalesce(p.admission_no, 'TEST-ROLLBACK-1'),
            coalesce(p.patient_name, 'Test Patient'), b1.floor, b1.ward, b1.ward, b1.room,
            b1.bed, b1.floor || ' - ' || b1.ward, now() AT TIME ZONE 'Asia/Kolkata', 'active')
    RETURNING ipd_number, time_in_ward INTO v_ipd, v_tiw;
    ms := round(extract(epoch FROM clock_timestamp() - t0) * 1000);

    SELECT count(*) INTO n_tasks FROM nurse_assign_task WHERE "Ipd_number" = v_ipd;
    SELECT count(*) INTO lbl_after FROM all_floor_bed WHERE bed = b1.bed AND status IS NOT NULL;
    IF p.admission_no IS NOT NULL THEN
        SELECT CASE WHEN actual2 IS NULL THEN 'NOT set' ELSE 'set' END INTO v_actual2
        FROM patient_admission WHERE admission_no = p.admission_no;
    END IF;

    -- Second patient into the same bed must fail
    BEGIN
        INSERT INTO ipd_admissions (timestamp, admission_no, patient_name, floor, ward_type,
                                    location_status, room, bed_no, planned1, status)
        VALUES (now() AT TIME ZONE 'Asia/Kolkata', 'TEST-ROLLBACK-2', 'Test Patient 2',
                b1.floor, b1.ward, b1.ward, b1.room, b1.bed, now() AT TIME ZONE 'Asia/Kolkata', 'active');
    EXCEPTION WHEN OTHERS THEN
        v_double := 'blocked: ' || SQLERRM;
    END;

    -- Move the first patient to another free bed in the same ward
    IF b2.id IS NOT NULL THEN
        UPDATE ipd_admissions SET floor = b2.floor, room = b2.room, bed_no = b2.bed
        WHERE ipd_number = v_ipd;
        SELECT 'old bed ' || coalesce((SELECT status FROM all_floor_bed WHERE id = b1.id), 'free')
            || ', new bed ' || coalesce((SELECT status FROM all_floor_bed WHERE id = b2.id), 'free')
        INTO v_move;
    END IF;

    RAISE EXCEPTION E'TEST RESULT (everything rolled back)\n insert_ms=%\n ipd_number=%\n time_in_ward=%\n nurse_tasks=%\n beds labelled % occupied: before=% after=%\n patient_admission.actual2=%\n double booking=%\n bed move=%',
        ms, v_ipd, v_tiw, n_tasks, b1.bed, lbl_before, lbl_after, v_actual2, v_double, v_move;
END
$test$;
```

---

## Step 1 — Apply the database fix (code only, no rows changed)

Run as one script at a quiet time. One transaction: if anything fails, nothing changes.

> **Production (user decision, 26 Sep 2026): leave out section 6** (between the `SECTION 6 START` / `END`
> markers below). It is the only part that deletes rows (pending tasks of an admission that staff delete). Without
> it, deleting an admission behaves exactly as today. Everything else in the script is the same on production.

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';

-- 1. time_in_ward: daily refresh only writes rows whose value changed
CREATE OR REPLACE FUNCTION public.update_ipd_time_in_ward()
RETURNS void
LANGUAGE plpgsql
AS $function$
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
$function$;

-- 1b. New admission: set time_in_ward on the new row only
CREATE OR REPLACE FUNCTION public.fn_set_time_in_ward_new_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
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
$function$;

DROP TRIGGER IF EXISTS after_insert_update_ipd_time_in_ward ON public.ipd_admissions;
DROP TRIGGER IF EXISTS trg_set_time_in_ward_new_row ON public.ipd_admissions;
CREATE TRIGGER trg_set_time_in_ward_new_row
BEFORE INSERT ON public.ipd_admissions
FOR EACH ROW EXECUTE FUNCTION public.fn_set_time_in_ward_new_row();

-- 2. Bed occupancy: exact bed, no double booking, free old bed on move
CREATE OR REPLACE FUNCTION public.fn_ipd_bed_occupancy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
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
$function$;

DROP TRIGGER IF EXISTS trg_ipd_bed_occupancy_insert ON public.ipd_admissions;
CREATE TRIGGER trg_ipd_bed_occupancy_insert
BEFORE INSERT ON public.ipd_admissions
FOR EACH ROW EXECUTE FUNCTION public.fn_ipd_bed_occupancy();

DROP TRIGGER IF EXISTS trg_ipd_bed_occupancy_update ON public.ipd_admissions;
CREATE TRIGGER trg_ipd_bed_occupancy_update
AFTER UPDATE OF floor, ward_type, room, bed_no ON public.ipd_admissions
FOR EACH ROW
WHEN (OLD.floor     IS DISTINCT FROM NEW.floor
   OR OLD.ward_type IS DISTINCT FROM NEW.ward_type
   OR OLD.room      IS DISTINCT FROM NEW.room
   OR OLD.bed_no    IS DISTINCT FROM NEW.bed_no)
EXECUTE FUNCTION public.fn_ipd_bed_occupancy();

-- 3. Mark the patient as admitted in the same transaction (was done by the browser)
CREATE OR REPLACE FUNCTION public.fn_ipd_mark_patient_admitted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    UPDATE patient_admission
    SET actual2 = (now() AT TIME ZONE 'Asia/Kolkata')
    WHERE admission_no = NEW.admission_no
      AND actual2 IS NULL;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ipd_mark_patient_admitted ON public.ipd_admissions;
CREATE TRIGGER trg_ipd_mark_patient_admitted
AFTER INSERT ON public.ipd_admissions
FOR EACH ROW EXECUTE FUNCTION public.fn_ipd_mark_patient_admitted();

-- 4. Nurse "at once" tasks: no bed logic, safer roster lookup, fast nurse pick
CREATE OR REPLACE FUNCTION public.fn_create_nurse_tasks()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
$function$;

-- 5. Free the bed only when the Discharge Bill sets actual1
DROP TRIGGER IF EXISTS trg_set_bed_null ON public.ipd_admissions;
CREATE TRIGGER trg_set_bed_null
AFTER UPDATE OF actual1 ON public.ipd_admissions
FOR EACH ROW
WHEN (OLD.actual1 IS NULL AND NEW.actual1 IS NOT NULL)
EXECUTE FUNCTION public.set_bed_status_null_on_actual1();

-- >>> SECTION 6 START (testing only — NOT on production, user decision 26 Sep 2026)
-- 6. Deleting an admission (Patient Profile page): free the bed, remove tasks
--    that were never done, and put the patient back in the "eligible" list.
--    Completed tasks are kept as a record of care given.
--    (delete_patient_completely already removes these itself; this trigger then does nothing extra.)
CREATE OR REPLACE FUNCTION public.fn_ipd_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    IF OLD.actual1 IS NULL AND coalesce(OLD.bed_no, '') <> '' THEN
        UPDATE all_floor_bed
        SET status = NULL
        WHERE floor = OLD.floor
          AND ward  = OLD.ward_type
          AND room  = OLD.room
          AND bed   = OLD.bed_no;
    END IF;

    DELETE FROM nurse_assign_task
    WHERE "Ipd_number" = OLD.ipd_number
      AND actual1 IS NULL;

    DELETE FROM rmo_assign_task
    WHERE ipd_number = OLD.ipd_number
      AND actual1 IS NULL;

    UPDATE patient_admission
    SET actual2 = NULL
    WHERE admission_no = OLD.admission_no
      AND actual2 IS NOT NULL;

    RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ipd_after_delete ON public.ipd_admissions;
CREATE TRIGGER trg_ipd_after_delete
AFTER DELETE ON public.ipd_admissions
FOR EACH ROW EXECUTE FUNCTION public.fn_ipd_after_delete();
-- <<< SECTION 6 END

COMMIT;
```

### 1b. Daily time-in-ward job (after step 1 committed)

Skip if 0c already shows a job that updates time in ward.
00:05 UTC = 05:35 IST, just after the database date (UTC) changes.

```sql
SELECT cron.schedule('ipd-time-in-ward-daily', '5 0 * * *', $$SELECT public.update_ipd_time_in_ward()$$);
SELECT public.update_ipd_time_in_ward();  -- once now; only changed rows are written
```

---

## Step 2 — Verify

### 2a. Triggers on ipd_admissions (read-only)

(Production: no `trg_ipd_after_delete` — section 6 is left out there.)

Expected: `trg_create_nurse_task`, `trg_ipd_after_delete`, `trg_ipd_bed_occupancy_insert`, `trg_ipd_bed_occupancy_update`,
`trg_ipd_mark_patient_admitted`, `trg_reassign_on_ward_change`, `trg_set_bed_null` (UPDATE OF actual1),
`trg_set_time_in_ward_new_row`, `trg_update_bed_status` (disabled, unchanged).
`after_insert_update_ipd_time_in_ward` must be gone.

```sql
SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.ipd_admissions'::regclass AND NOT tgisinternal
ORDER BY tgname;
```

### 2b. Testing only: run the step 0d test again

Expected: `insert_ms` well under 1000, `time_in_ward=1 days`, nurse_tasks > 0,
`beds labelled … occupied: after = before + 1`, `actual2=set`, `double booking=blocked: Bed …`,
`bed move=old bed free, new bed occupied`.

### 2c. Production: check with one real admission (read-only)

Let staff admit the next patient normally, then:

```sql
SELECT i.ipd_number, i.time_in_ward, pa.actual2,
       (SELECT count(*) FROM nurse_assign_task n WHERE n."Ipd_number" = i.ipd_number) AS nurse_tasks,
       (SELECT status FROM all_floor_bed b
         WHERE b.floor = i.floor AND b.ward = i.ward_type AND b.room = i.room AND b.bed = i.bed_no) AS bed_status
FROM ipd_admissions i
LEFT JOIN patient_admission pa ON pa.admission_no = i.admission_no
ORDER BY i.id DESC
LIMIT 1;

SELECT calls, round(mean_exec_time) AS avg_ms, round(max_exec_time) AS max_ms
FROM pg_stat_statements
WHERE query ILIKE 'WITH pgrst_source AS (INSERT INTO "public"."ipd_admissions"%';
```

---

## Rollback (puts the old code back; changes no rows)

Definitions below are what was live on testing on 23 Sep 2026. For production, use them
only if the step 0b md5 values matched testing; otherwise use the definitions saved in 0b.

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP TRIGGER IF EXISTS trg_set_time_in_ward_new_row ON public.ipd_admissions;
DROP TRIGGER IF EXISTS trg_ipd_bed_occupancy_insert ON public.ipd_admissions;
DROP TRIGGER IF EXISTS trg_ipd_bed_occupancy_update ON public.ipd_admissions;
DROP TRIGGER IF EXISTS trg_ipd_mark_patient_admitted ON public.ipd_admissions;
DROP TRIGGER IF EXISTS trg_ipd_after_delete ON public.ipd_admissions;

DROP TRIGGER IF EXISTS trg_set_bed_null ON public.ipd_admissions;
CREATE TRIGGER trg_set_bed_null
AFTER UPDATE ON public.ipd_admissions
FOR EACH ROW EXECUTE FUNCTION set_bed_status_null_on_actual1();

DROP TRIGGER IF EXISTS after_insert_update_ipd_time_in_ward ON public.ipd_admissions;
CREATE TRIGGER after_insert_update_ipd_time_in_ward
AFTER INSERT ON public.ipd_admissions
FOR EACH ROW EXECUTE FUNCTION trg_update_ipd_time_in_ward();

CREATE OR REPLACE FUNCTION public.update_ipd_time_in_ward()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE ipd_admissions
    SET time_in_ward =
        CASE
            WHEN planned1 IS NOT NULL AND actual1 IS NULL THEN
                (GREATEST((CURRENT_DATE - planned1::date) + 1, 1))::text || ' days'
            WHEN planned1 IS NOT NULL AND actual1 IS NOT NULL THEN
                (GREATEST((actual1::date - planned1::date) + 1, 1))::text || ' days'
        END
    WHERE planned1 IS NOT NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_create_nurse_tasks()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_shift text;
    v_now time := (now() at time zone 'Asia/Kolkata')::time;
    v_task record;
    v_nurse text;
    v_ward text;

    v_roster_column text;
    v_roster_json jsonb;
BEGIN
    -- 0. BED MANAGEMENT
    IF TG_OP = 'UPDATE' THEN
        IF OLD.bed_no IS DISTINCT FROM NEW.bed_no THEN
            UPDATE all_floor_bed
            SET status = NULL
            WHERE bed = OLD.bed_no;
        END IF;
    END IF;

    UPDATE all_floor_bed
    SET status = 'occupied'
    WHERE bed = NEW.bed_no;

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

    -- 3. Get roster column dynamically
    SELECT roster_column
    INTO v_roster_column
    FROM ward_config
    WHERE ward_name = v_ward;

    IF v_roster_column IS NULL THEN
        RAISE NOTICE 'No mapping for ward %', v_ward;
        RETURN NEW;
    END IF;

    -- 4. Fetch roster JSON dynamically
    EXECUTE format(
        'SELECT %I FROM roster
         WHERE shift = $1
           AND (start_date = current_date OR start_date IS NULL)
         ORDER BY created_at DESC
         LIMIT 1',
        v_roster_column
    )
    INTO v_roster_json
    USING v_shift;

    IF v_roster_json IS NULL THEN
        RAISE NOTICE 'No roster found for ward %, shift %', v_ward, v_shift;
        RETURN NEW;
    END IF;

    -- 5. Pick least loaded nurse
    SELECT nurse_name
    INTO v_nurse
    FROM (
        SELECT
            n.nurse_name,
            count(nat.*) FILTER (
                WHERE nat.assign_nurse = n.nurse_name
                  AND nat.shift = v_shift
                  AND nat.start_date = current_date
                  AND nat.status IN ('at once','picu','nicu','hdu','icu')
            ) AS task_count
        FROM (
            SELECT jsonb_array_elements_text(v_roster_json->'nurse') AS nurse_name
        ) n
        LEFT JOIN nurse_assign_task nat
            ON nat.assign_nurse = n.nurse_name
        GROUP BY n.nurse_name
    ) ranked
    ORDER BY task_count ASC
    LIMIT 1;

    -- 6. Safety
    IF v_nurse IS NULL THEN
        RAISE NOTICE 'No nurse available for %, shift %', new.ward_type, v_shift;
        RETURN NEW;
    END IF;

    -- 6.5 Safe delete only relevant pending auto nurse tasks
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

    -- 7. Assign standard tasks
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
$function$;

DROP FUNCTION IF EXISTS public.fn_set_time_in_ward_new_row();
DROP FUNCTION IF EXISTS public.fn_ipd_bed_occupancy();
DROP FUNCTION IF EXISTS public.fn_ipd_mark_patient_admitted();
DROP FUNCTION IF EXISTS public.fn_ipd_after_delete();

COMMIT;

SELECT cron.unschedule('ipd-time-in-ward-daily');  -- only if 1b created it
```

If the database is rolled back, the frontend must be rolled back too (see Deploy order).

---

## Step 3 — Bed status repair (changes `all_floor_bed.status` only)

"Patient is in the bed" = admitted (`planned1` set), Discharge Bill not done (`actual1` empty),
and discharge not started more than 3 days ago. Run A → B, read B, then C. D is for staff.

> **Production (checked 26 Sep 2026): do NOT run C with this rule.** Preview on production: 5 beds → free,
> **64 of 104 beds → occupied**, and 55 beds with 2+ "current" patients. Many old admissions on production
> never got `actual1`, so the rule counts patients who have left. Running C would hide most beds from the
> admission form. Bed status is not needed for the fix to work (the new trigger only looks at the exact bed),
> so step 3 is skipped on production unless staff first clean up old admissions.

```sql
-- A. Backup copy (RLS on, no policies: the app's public key cannot read it)
CREATE TABLE IF NOT EXISTS public.backup_all_floor_bed_20260924 AS
SELECT * FROM public.all_floor_bed;
ALTER TABLE public.backup_all_floor_bed_20260924 ENABLE ROW LEVEL SECURITY;
```

```sql
-- B. Preview (read-only)
WITH holders AS (
    SELECT DISTINCT i.floor, i.ward_type, i.room, i.bed_no
    FROM ipd_admissions i
    WHERE i.planned1 IS NOT NULL
      AND i.actual1 IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM discharge d
          WHERE d.admission_no = i.admission_no
            AND d.timestamp < (now() AT TIME ZONE 'Asia/Kolkata') - interval '3 days')
)
SELECT b.id, b.floor, b.ward, b.room, b.bed,
       b.status AS current_status,
       CASE WHEN h.bed_no IS NULL THEN NULL ELSE 'Occupied' END AS new_status
FROM all_floor_bed b
LEFT JOIN holders h
       ON h.floor = b.floor AND h.ward_type = b.ward AND h.room = b.room AND h.bed_no = b.bed
WHERE (h.bed_no IS NULL AND b.status IS NOT NULL)
   OR (h.bed_no IS NOT NULL AND b.status IS NULL)
ORDER BY b.floor, b.ward, b.room, b.bed;
```

```sql
-- C. Apply (same rule as B)
BEGIN;
WITH holders AS (
    SELECT DISTINCT i.floor, i.ward_type, i.room, i.bed_no
    FROM ipd_admissions i
    WHERE i.planned1 IS NOT NULL
      AND i.actual1 IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM discharge d
          WHERE d.admission_no = i.admission_no
            AND d.timestamp < (now() AT TIME ZONE 'Asia/Kolkata') - interval '3 days')
),
target AS (
    SELECT b.id, CASE WHEN h.bed_no IS NULL THEN NULL ELSE 'Occupied' END AS new_status
    FROM all_floor_bed b
    LEFT JOIN holders h
           ON h.floor = b.floor AND h.ward_type = b.ward AND h.room = b.room AND h.bed_no = b.bed
    WHERE (h.bed_no IS NULL AND b.status IS NOT NULL)
       OR (h.bed_no IS NOT NULL AND b.status IS NULL)
)
UPDATE all_floor_bed b
SET status = t.new_status
FROM target t
WHERE b.id = t.id;
COMMIT;
```

```sql
-- D. Beds with 2+ patients recorded (read-only, for staff to check)
SELECT i.floor, i.ward_type, i.room, i.bed_no, count(*) AS patients,
       string_agg(i.admission_no || ' - ' || coalesce(i.patient_name, '')
                  || ' (admitted ' || i.planned1::date || ')', ' | ' ORDER BY i.planned1) AS who
FROM ipd_admissions i
WHERE i.planned1 IS NOT NULL
  AND i.actual1 IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM discharge d
      WHERE d.admission_no = i.admission_no
        AND d.timestamp < (now() AT TIME ZONE 'Asia/Kolkata') - interval '3 days')
GROUP BY i.floor, i.ward_type, i.room, i.bed_no
HAVING count(*) > 1
ORDER BY i.floor, i.ward_type, i.room, i.bed_no;
```

```sql
-- Undo C
UPDATE all_floor_bed b
SET status = k.status
FROM backup_all_floor_bed_20260924 k
WHERE b.id = k.id;
```

---

## Step 4 — Frontend changes (git; same code deploys to production)

| File | Change | Why |
|---|---|---|
| `src/hooks/useRealtimeTable.js` | Accepts array table names (uses the last element); waits 1 s after the last change, then calls the page's reload once | Pages passing `['public', 'x']` re-subscribed on every render and sent an invalid filter; bulk inserts caused one full reload per row |
| `src/hooks/useRealtimeQuery.js` | Its filter is now checked for every event (passed to `useRealtimeTable`); removed its own extra 300 ms delay | With the debounce, a filter inside the callback would only see the last event of a burst |
| `src/pages/admin/IPD/IPDAdmission.jsx` (`handleSubmit`) | Sends `timestamp`, `planned1`, `status` only when creating, not when editing | Editing reset the admission time |
| `src/api/ipdAdmission.js` (`saveIpdAdmission`) | Removed the browser's own bed update and `patient_admission.actual2` update | Step 1 triggers do both inside the insert transaction; the old calls ignored errors |
| `src/api/ipdAdmission.js` (`getIpdAdmissions`) | Returns one page of 50 (`range` + `count: 'exact'`); search (name, admission no, IPD no, phone, WhatsApp) and date filter run on the server | The old full-table fetch was capped at 1,000 of 2,338 rows |
| `src/pages/admin/IPD/IPDAdmission.jsx` (list) | Page state, search debounced 400 ms (`useDebounce`), Previous/Next bar with "Showing x–y of N", previous page kept on screen while the next loads (`keepPreviousData`) | Works with the server paging above |
| `src/pages/admin/IPD/IPDAdmission.jsx` (`onError`) | Clear messages for timeout (`57014`) and connection errors; reloads the list, eligible patients and beds after any error | Users saw raw database text and a stale list |

Pages whose realtime starts working because of the hook fix: IPD Admission, Patient Profile,
Patient Profile Details, Departmental Indent, Pharmacy Store, Pharmacy Workflow Dashboard,
Pharmacy Approval.

---

## Run log

### Testing — `wblnbqkavhthtzvimtnp`

- 23 Sep 2026: diagnosis (read-only). Findings in "Why" above.
- 24 Sep 2026: frontend changes made (step 4).
- 25 Sep 2026: steps 0–3 run through the claude.ai Supabase connector (org **mamta-testing-account**, project `wblnbqkavhthtzvimtnp`).

| Step | Date | Result |
|---|---|---|
| 0b md5 values | 25 Sep 2026 | Before the fix (production must match these before step 1): see table below |
| 0c cron jobs | 25 Sep 2026 | None |
| 0d baseline test | 25 Sep 2026 | insert **600 ms**; time_in_ward empty; nurse tasks 0 (testing had no roster for today, so the slow nurse query did not run); actual2 NOT set; double booking ALLOWED; bed move left old bed occupied |
| 1 apply | 25 Sep 2026 | Committed, no errors |
| 1b cron | 25 Sep 2026 | `ipd-time-in-ward-daily` = job 1, `5 0 * * *`, active. First run updated 1,628 rows (day count had moved on since the copy); 0 rows wrong afterwards |
| 2a triggers | 25 Sep 2026 | Exactly the expected list; `after_insert_update_ipd_time_in_ward` gone |
| 2b test after fix | 25 Sep 2026 | First run **363 ms** (cold) with 11 nurse tasks (PICU); warm runs **35 ms** and **12 ms**; time_in_ward `1 days`; one bed occupied; actual2 set; double booking **blocked**; bed move **old bed freed, new bed occupied** |
| 3 bed repair | 25 Sep 2026 | Backup 210/210 rows (RLS on). Preview: 53 → free, 9 → occupied. Applied: 62 rows changed; occupied 154 → 110. Part D: 45 beds still have 2+ patients recorded (113 admissions) for staff to check |
| Advisors (new issues only) | 25 Sep 2026 | 3 new `function_search_path_mutable` warnings on the new functions → fixed with `ALTER FUNCTION … SET search_path = public` (now built into step 1). Backup table: `rls_enabled_no_policy` and `no_primary_key` (INFO, expected). Re-test after the fix: 67 ms, all checks pass |

md5 values on testing before the fix (step 0b):

| Object | md5 |
|---|---|
| function `fn_create_nurse_tasks` | `5959d5d3c791325f055780c99e0c5232` |
| function `get_next_ipd_number` | `c48aaa65c9076a55413c59c13c80d1d6` |
| function `set_bed_status_null_on_actual1` | `f41bc03aaab3351eba06d45ae13a53a2` |
| function `trg_update_ipd_time_in_ward` | `55f1318ccddeb230afa6a293e52cd860` |
| function `update_ipd_time_in_ward` | `42a747372ffbfa4ed906f912ed40aa32` |
| trigger `after_insert_update_ipd_time_in_ward` | `69bda3653ae1feff59a2b9be2449495d` |
| trigger `trg_create_nurse_task` | `209b7d2f30ee2bc06e55d00ba3a6a4a5` |
| trigger `trg_reassign_on_ward_change` | `90a9a7ea23390b8f4f29a3122a2ab3bb` |
| trigger `trg_set_bed_null` | `abe958b234c994e45f9b90d8d0da6cd9` |
| trigger `trg_update_bed_status` (disabled) | `196e342e73f582e503c9d5634de541b8` |

Notes from the testing run:
- `get_next_ipd_number()` uses a sequence (`nextval('ipd_number_seq')`), so two admissions at once cannot get the same IPD number. No change needed.
- The 0d/2b tests used up IPD numbers IPD-8915 … about IPD-8921 on testing (rolled back, so they are skipped). This is why 0d must not run on production.
- Pre-existing security issues seen in the advisors (not changed by this fix, worth a separate task): 7 `public` tables without RLS, and `SECURITY DEFINER` functions callable by `anon`, including `delete_patient_completely`.

Second round, 25 Sep 2026 (step 1 section 6 + list paging + error messages):

| Check | Result |
|---|---|
| Section 6 (`trg_ipd_after_delete`) applied on testing | Committed, no errors (applied as its own transaction; on production it is part of the step 1 script) |
| Delete test (rolled back) | After admit: 7 tasks, bed occupied, actual2 set. One task marked done, then admission deleted: bed **free**, pending tasks **0**, completed task **kept (1)**, actual2 **cleared** (patient eligible again) |
| Paged list query with the app's anon key | Page 1: 50 of **2,338**; page 30 works (beyond the old 1,000 cap); last page 38 rows; search with spaces works; commas/brackets in search don't break the query; date 2026-09-22: 24 rows |
| `npm run build` | Passes |
| 4 lint / build | 24 Sep 2026 | `npm run build` passes. ESLint cannot run in this repo (`eslint.config.js` imports `eslint-plugin-react`, which is not installed; not caused by this change). |

Fix, 26 Sep 2026 (found during the production pre-flight): the new bed trigger wrote `'occupied'`, but the old
frontend wrote `'Occupied'` and Assign Nursing Task / Assign Medical Task only list beds with
`status = 'Occupied'` (exact match, in the live code too). With the new frontend, newly admitted patients would
have been missing from those two pages. `fn_ipd_bed_occupancy` now writes `'Occupied'` (step 1 SQL above updated;
applied on testing with `CREATE OR REPLACE`). Rolled-back test on testing: bed status after admit = `Occupied`,
the Assign Task filter finds it, double booking still blocked. The dashboard counts with `LOWER(status)` and the
IPD page only checks `status IS NULL`, so neither is affected. Testing still has 45 older beds with lowercase
`occupied` (from the step 3 repair and earlier test admissions) — those stay hidden on the Assign Task pages there.

### Production — `cyjxqoxcufmvlyigldbl`

Pre-flight, 26 Sep 2026 (read-only, Supabase plugin connector, project confirmed by the user):

| Check | Result |
|---|---|
| PF-1 project | `cyjxqoxcufmvlyigldbl` "Hospital Management System", NikhilMamta's Org (Pro plan) — confirmed by user |
| PF-2 tables/columns | **pass** — all 27 tables identical to testing |
| PF-3 extensions / timeout | **pass** — pg_trgm 1.6 (public), pg_cron 1.6.4, anon `statement_timeout=3s` |
| PF-4 existing indexes | **pass** — all 12 present |
| PF-5 our names | **pass** — none exist yet |
| PF-6 anon can read | **pass** |
| PF-7 md5 (0b) | **pass** — all 10 functions/triggers match testing's pre-fix values; `trg_update_bed_status` disabled (same as testing) |
| 0c cron jobs | 6 jobs `cleanup-nurse-tasks-1…6`, all **inactive**; no time-in-ward job → step 1b needed |
| PF-8 column check | covered by PF-2 (identical columns) + the testing column check; can be run after P2-15 |
| PF-9 Vercel env | to be checked by the user in the Vercel dashboard |
| Realtime publication | same 10 tables as testing |
| Data | ipd_admissions 2,374; discharge 2,192; lab 1,273; pharmacy 12,608; rmo_assign_task 9,165; nurse_assign_task ~411k (247 MB); beds 104 (16 marked occupied: 9 `occupied`, 7 `Occupied`) |
| Step 3 preview | 5 → free, **64 → occupied**, 55 beds with 2+ patients → **step 3 not to be run** (see step 3) |
| Table statistics | activity counters were reset (`last_analyze` empty) but column statistics exist; run `ANALYZE` on the big tables after the P2-1 indexes (safe: reads a sample, does not block the app) |

Rollout, 26 Sep 2026, 15:40–16:25 IST (user asked: backup first, nothing deleted, no errors; quiet time:
0 admissions in the last hour, no long transactions):

| Step | Time (UTC) | Result |
|---|---|---|
| Backup (local `pg_dump` 18.4 via the direct connection) | 10:12 | `supabase_backup/prod_public_20260926.dump` (15 MB, 27 tables with data), `prod_schema_20260926.sql` (45 functions, 27 triggers), cron list, row counts. Verified: rows in the dump = live counts (nurse_assign_task 519,019; ipd_admissions 2,374; pharmacy 12,609; beds 104) |
| Part 1 step 1 **without section 6** (psql, one transaction, `ON_ERROR_STOP`) | 10:16 | COMMIT, no errors. Script = log step 1 minus section 6; the 5 function bodies were md5-checked against testing before running |
| 2a check | 10:17 | all 5 functions and 8 triggers **identical to testing** (md5); `after_insert_update_ipd_time_in_ward` gone; no `trg_ipd_after_delete`; `trg_update_bed_status` still disabled |
| 1b cron | 10:18 | job 8 `ipd-time-in-ward-daily` (`5 0 * * *`, active); first run wrote 0 rows (values were already current); the 6 old cleanup jobs untouched (inactive) |
| P2-1 + 15a/15b indexes (10, `CONCURRENTLY`, one by one) | 10:18–10:19 | all valid, 1–7 s each, ~60 MB total |
| `ANALYZE` of the 9 main tables | 10:21 | 3 s |
| P2-2, P2-5, 15c–15g (6 functions, 2 views, grants) | 10:21 | COMMIT, no errors; md5 of all 6 bodies and both views **identical to testing**; views: `security_invoker`, anon = SELECT only |
| Anon smoke test (3 s limit, rolled back) | 10:23 | slowest 595 ms (nurse score 30 days); nurse patients 544 ms; Add Discharge 282 ms; others 24–117 ms |
| Totals | 10:23 | nurse score 112,298 = direct count; RMO 9,165 = direct count; Add Discharge 198 = direct count |
| Advisors | 10:22 | no finding for any new object (all listed items are the pre-existing ones, same as testing) |
| Logs 09:30–10:50 UTC | 10:50 | postgres: only `LOG` level (no ERROR/FATAL); API: 200/204 as before, no 5xx; the only 4xx are `406` on `patient_admission` at the same rate before and after (existing `.single()` lookups) |
| PF-8 column check with the production anon key | 10:52 | only the dead `pms.jsx` (same as testing) |

Not done on production (by decision): section 6 (`trg_ipd_after_delete`), step 3 bed repair, step 0d test.
Still to do: frontend deploy (user), then step 2c after the first real admission.
Files used: scratchpad `prod_step1.sql`, `prod_part2_objects.sql` (generated from this log).

---

## Production pre-flight (read-only — run before anything else)

Every query below only reads. Each has the testing values built in and returns **only problems**:
**0 rows = pass**. Any row → stop, look at it, fix it on testing first, update this file.
Reference values were taken from testing on 26 Sep 2026 (before any production work).

Why this is needed: everything was verified on testing, a copy of production. These checks make sure production
still looks like that copy (nobody changed it since) and has what the new SQL relies on.

Queries validated on testing (26 Sep 2026): PF-2, PF-3, PF-4, PF-6 return 0 rows; PF-5 finds all 28 objects
(expected there, they exist on testing — on production it must be 0 before step 1); PF-8 script gives the known
`pms.jsx` result.

### PF-1. Right project

`list_projects` → the production ref and org. Write the ref in "Environments" above. Never `iyvbjmecoihcqfzyhkgq` (mis449).

### PF-2. Tables and columns are the same as testing

```sql
WITH expected(table_name, cols_md5, n_cols) AS (VALUES
  ('all_floor_bed','f817b39750cef3edc9d8cd19744377de',8),
  ('all_staff','ecb5f91d368ee0da7594bcaa501e6e5e',7),
  ('category','ef8c41ff9f3bfe97917d5b786c268f1b',3),
  ('congratulations_posts','64463ebac4ad3965710822700551c6e4',8),
  ('departmental_pharmacy_indent','c47927c0c99174072445ec45cf83d22c',27),
  ('discharge','aba4302ffa025267ce96662bf02f5127',34),
  ('doctors','ecb5f91d368ee0da7594bcaa501e6e5e',7),
  ('dressing','fc81e323e6972690188a62f0d14abdb0',15),
  ('investigation','8669fed4fb056b0ff079a5cf9aa53f5a',5),
  ('ipd_admissions','64f53e1ed12d645cebc3ee3a1eb72b42',58),
  ('lab','4ef28bb03b16db06d6979d421d9a8a74',42),
  ('leave','61e02b025bedcc804eca2b0721c46b28',5),
  ('master','90d84e3a8bd5eef39aaca673e445ab29',5),
  ('medicine','63e324dbcf7a44c55fc6282603cc3e5c',4),
  ('nurse_assign_task','6c0844b5150d43e7dad44dd029d77303',22),
  ('nurse_monthly_stats','e8deb364168531f09762b03ac29153c9',8),
  ('ot_information','158acc99ff24b1818b338676cfeac9b1',24),
  ('patient_admission','def49d1db37797087c99ac6fbca33c9b',21),
  ('patient_deletion_log','6e3fc46b01ad55eed5cd52c319323ac9',7),
  ('pharmacy','aa75a60dddc54e38319438132c112b6c',28),
  ('pre_defined_task','d689339105af7d28053db01ce8ec18fb',5),
  ('rmo_assign_task','c0e1d17d4a4bfdbb9008f82c0d50aa64',19),
  ('roster','5d46099df5922ce0f0c5c985ab91ec03',13),
  ('surgical_data','9f36d9faacd3422a55c621a2f4edf8fd',8),
  ('trigger_debug_log','2836e98f245453777e3f46fe37e49258',3),
  ('users','590665a4149f8a7335e83436ffd9f96e',10),
  ('ward_config','5ace7705d3dbefe16baf773840785ab4',3)
), actual AS (
  SELECT c.table_name::text AS table_name,
         md5(string_agg(c.column_name || ':' || c.data_type, ',' ORDER BY c.column_name)) AS cols_md5,
         count(*)::int AS n_cols,
         string_agg(c.column_name, ', ' ORDER BY c.column_name) AS cols
  FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    AND c.table_name NOT LIKE 'backup\_%'
  GROUP BY c.table_name
)
SELECT coalesce(e.table_name, a.table_name) AS table_name,
       CASE WHEN a.table_name IS NULL THEN 'MISSING on production'
            WHEN e.table_name IS NULL THEN 'only on production (fine)'
            ELSE 'columns differ' END AS problem,
       e.n_cols AS testing_cols, a.n_cols AS production_cols, a.cols AS production_columns
FROM expected e
FULL JOIN actual a ON a.table_name = e.table_name
WHERE e.cols_md5 IS DISTINCT FROM a.cols_md5
ORDER BY 1;
```

"only on production (fine)" rows are OK. For "columns differ", compare `production_columns` with the testing list:

| Table | Columns on testing |
|---|---|
| all_floor_bed | bed, floor, id, room, serial_no, status, timestamp, ward |
| departmental_pharmacy_indent | actual1, actual2, approved_at, approved_by, category, floor, id, indent_no, indent_scope, investigation_advice, investigations, medicines, planned1, planned2, rejected_at, remarks, request_source, request_types, requested_by, room, slip_image, slip_image_url, status, timestamp, updated_at, ward, ward_location |
| discharge | actual1–actual5, admission_no, bill_image, bill_status, category, concern_authority_work_file, concern_dept, consultant_name, delay1–delay5, department, discharge_number, id, patient_name, planned1–planned5, remark, rmo_name, rmo_status, staff_name, summary_report_image, summary_report_image_name, timestamp, work_file |
| ipd_admissions | actual1, adm_purpose, admission_no, advance_amount, age, area_colony, attempt, bed_location, bed_no, bed_tariff, city, consultant_dr, country, created_at, date_of_birth, delay, department, diagnosis, dr_visit_tariff, email_id, exp_tariff, father_husband_name, floor, gender, health_card_no, house_no_street, id, ipd_number, kin_mobile_no, kin_name, kin_relation, landmark, location_status, marital_status, medical_surgical, other_services, package_name, pat_category, patient_case, patient_name, phone_no, pincode, pkg_amount, planned1, refer_by_dr, religion, remarks, room, room_no, staff_name, state, status, time_in_ward, timestamp, vip_details, ward_no, ward_type, whatsapp_no |
| lab | actual1–actual4, admission_no, age, bed_no, bill_image_url, category, consultant_dr, created_by_nurse, delay1–delay3, department, father_husband_name, gender, id, ipd_number, lab_no, lab_report_remarks, location, pathology_tests, patient_name, payment_status, phone_no, planned1–planned4, priority, radiology_tests, radiology_type, reason_for_visit, receive_sample, refer_by_dr, remarks, report_url, room, status, timestamp, ward_type |
| nurse_assign_task | Ipd_number, actual1, assign_nurse, bed_no, check_up, delegated_from, id, ot_number, patient_location, patient_name, planned1, reminder, room, shift, staff, start_date, status, submitted_by, task, task_no, timestamp, ward_type |
| patient_admission | actual1, actual2, admission_no, age, attender_mobile_no, attender_name, date_of_birth, delay, delay2, department, gender, id, ipd_number, patient_name, phone_no, planned1, planned2, reason_for_visit, status, submitted_by, timestamp |
| pharmacy | actual1, actual2, admission_number, age, approved_by, category, consultant_name, delay, delay2, diagnosis, gender, id, indent_no, investigation_advice, investigations, ipd_number, medicines, patient_name, planned1, planned2, request_types, room, slip_image, staff_name, status, timestamp, uhid_number, ward_location |
| rmo_assign_task | actual1, assign_rmo, bed_no, id, ipd_number, ot_information, patient_location, patient_name, planned1, reminder, room, shift, start_date, status, submitted_by, task, task_no, timestamp, ward_type |
| roster | created_at, female_general_ward, general_ward_5th_floor, hdu, icu, id, male_general_ward, nicu, picu, private_ward, shift, start_date, timestamp |
| ward_config | id, roster_column, ward_name |
| pre_defined_task | created_at, id, staff, status, task |

A column **missing** on production that the app or the new SQL uses → stop. An **extra** column on production is fine.

### PF-3. Extensions and the anon time limit

```sql
WITH expected(kind, name, value) AS (VALUES
  ('extension', 'pg_trgm', 'installed'),
  ('extension', 'pg_cron', 'installed'),
  ('role', 'anon', 'statement_timeout=3s')
)
SELECT e.kind, e.name, e.value AS expected
FROM expected e
WHERE (e.kind = 'extension' AND NOT EXISTS (SELECT 1 FROM pg_extension x WHERE x.extname = e.name))
   OR (e.kind = 'role' AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = e.name AND e.value = ANY (r.rolconfig)));
```

Testing: `pg_trgm` 1.6 (schema public), `pg_cron` 1.6.4, anon `statement_timeout=3s`, authenticated `8s`.
- `pg_trgm` missing → `CREATE EXTENSION IF NOT EXISTS pg_trgm;` before P2-1 (needed by the search indexes).
- `pg_cron` missing → enable it in Dashboard → Database → Extensions before step 1b (ask first).
- anon timeout different (e.g. 8s) → not a blocker, just note it.

### PF-4. Existing indexes the new SQL relies on

These were already on testing before this work (copied from production). Without them the new triggers/functions
still work but can be slow enough to hit the 3 s limit.

```sql
WITH needed(purpose, def) AS (VALUES
  ('admission: least-busy nurse (fn_create_nurse_tasks)', 'ON public.nurse_assign_task USING btree (assign_nurse, shift, start_date, status)'),
  ('Patient Profile nurse list (get_nurse_patient_ipds)', 'ON public.nurse_assign_task USING gin (assign_nurse gin_trgm_ops)'),
  ('patient cards, delete trigger', 'ON public.nurse_assign_task USING btree ("Ipd_number")'),
  ('bed trigger (exact bed)', 'ON public.all_floor_bed USING btree (floor, ward, room, bed)'),
  ('mark-admitted trigger', 'ON public.patient_admission USING btree (admission_no)'),
  ('Add Discharge view', 'ON public.discharge USING btree (admission_no)'),
  ('Lab Advice pending view', 'ON public.lab USING btree (admission_no)'),
  ('Lab Advice pending view', 'ON public.ipd_admissions USING btree (planned1, actual1) WHERE ((planned1 IS NOT NULL) AND (actual1 IS NULL))'),
  ('delete trigger (RMO tasks)', 'ON public.rmo_assign_task USING btree (ipd_number)'),
  ('Store filter options', 'ON public.pharmacy USING btree ("timestamp" DESC) WHERE ((planned2 IS NOT NULL) AND (status <> ''rejected''::text))'),
  ('Store filter options', 'ON public.departmental_pharmacy_indent USING btree ("timestamp" DESC) WHERE ((planned2 IS NOT NULL) AND (status <> ''rejected''::text))'),
  ('roster lookup', 'ON public.roster USING btree (start_date DESC)')
)
SELECT n.purpose, n.def AS missing_index
FROM needed n
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes i
  WHERE i.schemaname = 'public'
    AND regexp_replace(i.indexdef, '^CREATE (UNIQUE )?INDEX \S+ ', '') = n.def
);
```

If one is missing, create it the same way as on testing (each statement on its own), e.g.
`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nat_assign_lookup ON public.nurse_assign_task (assign_nurse, shift, start_date, status);`
— testing names: `idx_nat_assign_lookup`, `idx_nat_nurse_trgm`, `idx_nat_ipd_number`, `idx_floor_bed_location`,
`idx_patient_admission_admission_no`, `idx_discharge_admission_no`, `idx_lab_admission_no`, `idx_ipd_admissions_active`,
`idx_rat_ipd_number`, `idx_pharmacy_store_view`, `idx_dept_indent_store_view`, `idx_roster_start_date`.

### PF-5. Nothing with our names exists yet

Everything we create uses `CREATE OR REPLACE` / `IF NOT EXISTS`. If production already had an object with the same
name but different content, it would be replaced (function) or silently kept (index). Expected: **0 rows**.

```sql
SELECT 'function' AS kind, proname::text AS name FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('fn_set_time_in_ward_new_row', 'fn_ipd_bed_occupancy', 'fn_ipd_mark_patient_admitted', 'fn_ipd_after_delete',
                  'get_nurse_score_stats', 'get_rmo_score_stats', 'get_patient_card_nurses', 'get_nurse_patient_ipds',
                  'get_pharmacy_history_titles', 'get_pharmacy_store_filter_options')
UNION ALL
SELECT 'view/table', relname::text FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('discharge_available_patients', 'lab_advice_pending', 'backup_all_floor_bed_20260924')
UNION ALL
SELECT 'index', indexname::text FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_nat_timestamp', 'idx_nat_nurse_timestamp', 'idx_nat_start_date', 'idx_rat_timestamp',
                    'idx_nat_patient_name_trgm', 'idx_nat_ipd_number_trgm', 'idx_nat_task_no_trgm', 'idx_nat_task_trgm',
                    'idx_nat_staff', 'idx_pharmacy_history_actual1')
UNION ALL
SELECT 'trigger', tgname::text FROM pg_trigger
WHERE tgrelid = 'public.ipd_admissions'::regclass
  AND tgname IN ('trg_set_time_in_ward_new_row', 'trg_ipd_bed_occupancy_insert', 'trg_ipd_bed_occupancy_update',
                 'trg_ipd_mark_patient_admitted', 'trg_ipd_after_delete');
```

If a row comes back: save its definition first (`pg_get_functiondef` / `indexdef`), compare with this file, then decide.

### PF-6. The app can read the tables the new functions and views read

The new functions and views run with the caller's rights (anon). Expected: **0 rows**.

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_select,
       (SELECT string_agg(p.polname || ' [' || p.polcmd || '] ' || coalesce(pg_get_expr(p.polqual, p.polrelid), ''), '; ')
          FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('ipd_admissions', 'discharge', 'lab', 'nurse_assign_task', 'rmo_assign_task',
                    'pharmacy', 'departmental_pharmacy_indent')
  AND (NOT has_table_privilege('anon', c.oid, 'SELECT')
       OR (c.relrowsecurity AND NOT EXISTS (
             SELECT 1 FROM pg_policy p
             WHERE p.polrelid = c.oid AND p.polcmd IN ('r', '*') AND p.polpermissive
               AND pg_get_expr(p.polqual, p.polrelid) = 'true')));
```

(Testing: all readable by anon; tables with RLS have a policy `USING (true)`.) A row here is not always a blocker —
it means the policy is not a plain `true`; read it and check the app's list pages still show rows for anon.

### PF-7. Part 1 md5 values (step 0b) and cron jobs (step 0c)

Run step 0b and compare every md5 with the testing values in the Run log. **Different → stop.** Run step 0c
(if a time-in-ward job already exists, skip step 1b).

### PF-8. Every query of the new frontend works on the production schema (from this PC)

`sql_scripts/column_check.cjs` asks Supabase for every table/column the code in `src/` uses, with `limit=0`
(no rows are read, nothing is written). Put the production URL and anon key in a file
`.env.production.local` (git-ignored by `*.local`; same two variable names as `.env`), then:

```
node sql_scripts/column_check.cjs .env.production.local
```

Expected **before** P2-15: only `discharge_available_patients`, `lab_advice_pending` (not created yet) and the
dead `src/pages/pms.jsx` (`discharge.ipd_number`, `pre_defined_task.ot_task`). **After** P2-15: only `pms.jsx`.
The script prints only the project ref, never the key.

### PF-9. Vercel points to production

Vercel → Project → Settings → Environment Variables: `VITE_SUPABASE_URL` (Production) must contain the
production ref, not `wblnbqkavhthtzvimtnp`. `.env` (testing) is git-ignored, so it is never deployed.

### Old frontend + new database (the time between the DB change and the deploy)

Checked on the live code (`git show HEAD:src/api/ipdAdmission.js`): the old frontend inserts the admission
**first** and only then marks the exact bed `Occupied` and sets `patient_admission.actual2`. With step 1 in place
the triggers do both inside the insert; the old frontend's second update is then harmless (same bed, `actual2`
overwritten with nearly the same time). Part 2 objects are new and the old frontend never calls them. So the old
site keeps working while the database is being changed; the opposite order (new frontend first) does **not** work.

---

## Production checklist

0. Run the **Production pre-flight** section above. Any unexplained row → stop.
1. Confirm the production project ref and check it with `list_projects`.
2. Pick a quiet time and tell the staff.
3. Step 0a: full backup.
4. Step 0b: compare every md5 with testing's run log. Different → stop.
5. Step 0c: note existing cron jobs.
6. Step 1, then 1b (only if no time-in-ward job exists).
7. Step 2a, then 2c after the next real admission. Do **not** run 0d on production.
8. If anything goes wrong: Rollback, and do not deploy the frontend.
9. Deploy the frontend (step 4) only after steps 1–2 pass.
10. Step 3 only if decided; run A → B, review, then C.
11. Run the advisors (security + performance). Only the backup table's two INFO notes should be new.
12. After a few days without problems, drop the backup table: `DROP TABLE public.backup_all_floor_bed_20260924;`
13. Then run **Part 2** below (app-wide optimization), database first, frontend last:
    1. P2-1 indexes (each `CONCURRENTLY` statement on its own), then warm up with one Task List search.
    2. P2-2 score functions, P2-5 `get_patient_card_nurses`.
    3. P2-15 (15a → 15g), then the 15h checks.
    4. Advisors (security + performance): nothing new should be listed for these objects.
    5. Only then deploy the frontend (it needs all of the above). Click-test with the Tier 1, Tier 2 and P2-15 lists.

---

# Part 2 — App-wide Supabase optimization (started 25 Sep 2026)

Goal: less database work and data transfer on every page, **same screens and workflows**.
Decisions (user, 25 Sep 2026): lists that were silently cut at 1,000 rows become complete
(with paging) and stats become correct; roll out Tier 1 first, then page by page.

## Part 2 status

| Step | Testing | Production |
|---|---|---|
| P2-1 Indexes | **done 25 Sep 2026** | **done 26 Sep 2026** |
| P2-2 Score dashboard RPCs | **done 25 Sep 2026** | **done 26 Sep 2026** |
| P2-3 Task List server paging (frontend only; needs P2-1 trigram indexes) | **done 25 Sep 2026** | deploy after P2-1 |
| P2-4 Patient tabs reload only for their own patient (frontend only) | **done 25 Sep 2026** | deploy with frontend |
| P2-5 Patient cards: one request per page instead of 2 per card (RPC + frontend) | **done 25 Sep 2026** | **RPC done 26 Sep 2026**; frontend with deploy |
| P2-6 Patient Care Dashboard: quiet realtime refresh (frontend only) | **done 25 Sep 2026** | deploy with frontend |
| P2-7 Nurse/RMO Complete Detail: correct totals, own-person realtime, RMO load bug fixed (frontend only) | **done 25 Sep 2026** | deploy with frontend |
| P2-8 Shift Handover: only needed columns (frontend only) | **done 25 Sep 2026** | deploy with frontend |
| **Tier 1 finished** — user click-test before Tier 2 | 25 Sep 2026 | |
| P2-9 Shared helpers + small fixes (medicine cache, v5 invalidateQueries, store SO number) (frontend only) | **done 25 Sep 2026** | deploy with frontend |
| P2-10 Tier 2: Masters / Admission / RMO (frontend only) | **done 26 Sep 2026** | deploy with frontend |
| P2-11 Tier 2: Discharge (frontend only) | **done 26 Sep 2026** | deploy with frontend |
| P2-12 Tier 2: Lab (frontend only) | **done 26 Sep 2026** | deploy with frontend |
| P2-13 Tier 2: Pharmacy (frontend only) | **done 26 Sep 2026** | deploy with frontend |
| **Tier 2 finished** — full `npm run build` passes; user click-test next | 26 Sep 2026 | |
| P2-14 Final audit: column check of every query, Patient Profile list, Lab tab fix (frontend only) | **done 26 Sep 2026** | deploy with frontend |
| P2-15 DB items: `idx_nat_staff`, `idx_pharmacy_history_actual1`, 3 functions, 2 read-only views (+ frontend switched to them) | **done 26 Sep 2026** | **done 26 Sep 2026** |

## P2-1 — Indexes (no data change, no UI change)

`CREATE INDEX CONCURRENTLY` does not block inserts/updates while it builds, but it
**cannot run inside a transaction**: run each statement on its own (SQL Editor: one at a time).

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nat_timestamp       ON public.nurse_assign_task ("timestamp" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nat_nurse_timestamp ON public.nurse_assign_task (assign_nurse, "timestamp" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nat_start_date      ON public.nurse_assign_task (start_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rat_timestamp       ON public.rmo_assign_task ("timestamp" DESC);

-- Search on Task List (ilike '%term%' on 500k rows). Without these the search timed out.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nat_patient_name_trgm ON public.nurse_assign_task USING gin (patient_name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nat_ipd_number_trgm   ON public.nurse_assign_task USING gin ("Ipd_number" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nat_task_no_trgm      ON public.nurse_assign_task USING gin (task_no gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nat_task_trgm         ON public.nurse_assign_task USING gin (task gin_trgm_ops);
```

Check (read-only): all eight exist and are valid:

```sql
SELECT c.relname AS index, i.indisvalid AS valid
FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname IN ('idx_nat_timestamp','idx_nat_nurse_timestamp','idx_nat_start_date','idx_rat_timestamp',
                    'idx_nat_patient_name_trgm','idx_nat_ipd_number_trgm','idx_nat_task_no_trgm','idx_nat_task_trgm');
```

After creating the trigram indexes, run one search in the app to warm them up: the first
search after creation read the new indexes from disk and took ~3 s on testing.

If a build fails half-way, the index stays `valid = false`: `DROP INDEX CONCURRENTLY <name>;` and run it again.

Rollback: `DROP INDEX CONCURRENTLY IF EXISTS <name>;` for each (no data is affected).

Results on testing (EXPLAIN ANALYZE, 25 Sep 2026):

| Query (used by) | Before | After |
|---|---|---|
| newest 1,000 nurse tasks (Task List, Patient Care Dashboard) | 1,681 ms, full scan + sort | **1.4 ms** |
| occupied beds from tasks (Task List add-task modal) | 1,274 ms, sort spilled 21 MB to disk | **0.6 ms** |
| one nurse's tasks, newest first (Complete Detail) | full scan | **1.1 ms** |

## P2-2 — Score dashboard functions (read-only functions, no data change)

The Nurse and RMO Score Dashboards downloaded raw task rows and counted them in the browser.
Supabase returns at most 1,000 rows, so the per-person numbers were wrong (testing, last 30 days:
96,844 tasks, the dashboard counted 1,000). These functions return one row per nurse/RMO.
The frontend (`ScoreDashboard.jsx`, `RMOScoreDashboard.jsx`) calls them via `supabase.rpc(...)`,
so **run this before deploying that frontend**.

```sql
CREATE OR REPLACE FUNCTION public.get_nurse_score_stats(p_start date, p_end date)
RETURNS TABLE (name text, total bigint, completed bigint, pending bigint, shifts text[])
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_rmo_score_stats()
RETURNS TABLE (name text, total bigint, completed bigint, pending bigint, shifts text[])
LANGUAGE sql
STABLE
SET search_path = public
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
```

Check (read-only): the totals must equal a direct count.

```sql
SELECT (SELECT sum(total) FROM public.get_nurse_score_stats(current_date - 29, current_date)) AS rpc_total,
       (SELECT count(*) FROM nurse_assign_task
         WHERE start_date BETWEEN current_date - 29 AND current_date
           AND btrim(coalesce(assign_nurse, '')) <> '') AS direct_count;
```

Rollback: `DROP FUNCTION IF EXISTS public.get_nurse_score_stats(date, date); DROP FUNCTION IF EXISTS public.get_rmo_score_stats();`
(and roll back the two dashboard files at the same time).

Results on testing (25 Sep 2026): monthly nurse totals 96,844 = direct count; RMO 9,088 = direct count.
Through the app's anon key: nurse monthly **124 ms**, RMO **98 ms** (before: 1,753 ms for 1,000 rows and wrong numbers).
One change in display: the "Shifts" column now lists shifts alphabetically (it used to be in the order rows arrived).

## P2-3 — Nurse Task List: server paging (frontend only)

`src/pages/admin/nurseStation/TaskList.jsx` used to download the newest 1,000 tasks with `select *`
on every load and every realtime event, then filter tabs/search/date in the browser. Now:
- Pending/History tab, date and nurse filters run in the query; one page of 10 rows with only the
  17 columns the table uses; `count: 'estimated'` (exact for small results, planner estimate for
  100k+ rows, because an exact count of all pending tasks took 0.8 s).
- Search: up to 1,000 matches fetched **without ORDER BY**, sorted newest-first and paged in the
  browser. Reason (learned on testing): the app runs as `anon`, and under RLS Postgres does not use
  column statistics for `ilike`, so `ORDER BY timestamp LIMIT 10` walked all 500k rows when few rows
  matched (7.6 s → timeout). Without ORDER BY the trigram indexes answer in milliseconds.
- Page/search/date changes swap rows without the full-screen spinner; tab changes still show it.
- Completing a task still removes it from Pending at once.

Results on testing with the anon key: page 1 Pending 113 ms (117,552 pending), History 59 ms,
page 500 149 ms, search with no match 189 ms (was a timeout), common search 308 ms, date 199 ms.
Known difference: a search matching more than 1,000 tasks shows 1,000 of them (before, search only
looked inside the newest 1,000 tasks at all).

## P2-4 — Patient tabs reload only for their own patient (frontend only)

New helper `src/utils/realtimeFilters.js` → `isChangeForPatient(payload, keys, patientId)`. Used as the
realtime predicate in PatientProfile `Nursing.jsx`, `OT.jsx`, `RMOTask.jsx`, `Pharmacy.jsx`,
`ProfilePatientDetails.jsx` (admission by row `id`, pharmacy by `ipd_number`/`admission_number`) and
`GivenTask.jsx` (replaces its own copy). Before, each of these reloaded on any change for any patient
in the hospital (e.g. every cron-generated nurse task). DELETE events carry only the row id, so they
always reload (as before). Unit-checked with 8 cases.

## P2-5 — Patient cards: one request for the whole page

`components/PatientCard.jsx` (used by Patient Profile) ran 2 queries per card: nurses in the current
shift (whole history of the patient) and OT days. **The OT result was never shown on screen**, so that
query is removed. Nurses now come from one RPC for all visible cards (`src/hooks/usePatientCardNurses.js`,
`getPatientCardNurses` in `src/api/patientProfile.js`). A card used without the `nurses` prop still
loads its own, as before. Run this before deploying the frontend:

```sql
CREATE OR REPLACE FUNCTION public.get_patient_card_nurses(p_ipds text[], p_shift text)
RETURNS TABLE (ipd text, nurses text[])
LANGUAGE sql
STABLE
SET search_path = public
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
```

Rollback: `DROP FUNCTION IF EXISTS public.get_patient_card_nurses(text[], text);` (and roll back the frontend).

Results on testing: nurse lists identical to the old per-card query for 20 of 20 patients; 12 cards in
**78 ms** with the anon key (before: 24 separate requests per 12 cards, +24 on every scroll).

## P2-6 — Patient Care Dashboard (frontend only)

`nurseStation/PatientCareDashboard.jsx`: its query (newest 1,000 tasks) is now fast because of
`idx_nat_timestamp` (1.4 ms). Realtime refreshes are quiet: no spinner and the "show more" count is
not reset to 10 on every task change. The Refresh button still shows the spinner.

## P2-7 — Nurse / RMO Complete Detail (frontend only)

`nurseStation/CompleteDetail.jsx`, `rmo/RMOCompleteDetail.jsx` (the window opened from the score dashboards):
- The list is unchanged (newest tasks, max 1,000).
- Totals / completed / pending / completion % now come from `count: 'exact', head: true` queries, so they
  cover all of the person's tasks (testing: a nurse with **6,282** tasks showed 1,000 before).
- Realtime reloads only when that nurse's / RMO's tasks change.
- **Bug fixed:** RMOCompleteDetail asked for `Ipd_number`, but `rmo_assign_task` only has `ipd_number`,
  so the request always failed ("column rmo_assign_task.Ipd_number does not exist") and the window
  showed "Failed to load RMO tasks". Now it loads (testing: 3,331 tasks for one RMO).

## P2-8 — Shift Handover (frontend only)

`pages/admin/ShiftHandover.jsx` (the routed one): selects the 9 columns the patient list and the
handover use instead of `*`. Same rows, same behaviour. Query plan checked as `anon`: trigram index,
48 ms warm (2.4 s the first time after a restart, cold cache).
`pages/admin/nurseStation/ShiftHandover.jsx` is not used by any route and was left unchanged.

## P2-9 — Shared helpers and small fixes (frontend only)

New shared pieces used by the Tier 2 pages:
- `src/utils/supabaseQuery.js`: `cleanSearchTerm`, `ilikeAny` (server-side search across columns),
  `fetchAllRows` (fetch a full list 1,000 rows at a time, for dropdowns that need everything).
- `src/components/Pagination.jsx`: the Previous/Next bar ("Showing x–y of N").

Fixes:
- `src/lib/masterCache.js` medicines: one request returned **1,000 of 4,543** names (A–D only), so
  pharmacy forms/dropdowns were missing ~3,500 medicines. Now fetched in chunks: 4,543 names, 793 ms,
  cached 30 minutes as before.
- `invalidateQueries(['x'])` is the old v4 form; in TanStack Query v5 it has no key filter and
  **refetches every active query**. Fixed to `invalidateQueries({ queryKey: [...] })` in
  `Dashboard/Dashboard.jsx`, `Dashboard/CongratulationsFeed.jsx` (3×), `Pharmacy/PharmacyWorkflowDashboard.jsx`.
- `src/api/store.js` `getNextStoreOutIndentNo`: read every issue number (stopped at 1,000) to find the
  max → possible **duplicate SO numbers** after 1,000 requests. Now `order=issue_no.desc&limit=50`
  (numbers are zero-padded, so text order = number order up to SO-9999). This is the separate store
  Supabase project; not testable from here.

## P2-10 — Masters / Admission / RMO (frontend only)

All verified with the anon key against testing (old vs new), no database changes.

| Page / file | Change | Before → after (testing) |
|---|---|---|
| `masters/Medicine.jsx` | 50 per page from the server, server search (name, price), 4 columns | list and search covered 1,000 of 4,543 → all 4,543 |
| `masters/DeletePatient.jsx` | 50 per page, server search (name, IPD, admission no, phone), 11 columns, counts | 1000/1000 → 2338/2338; data per load 1,251 KB → 13 KB |
| `api/patients.js` + `Admission/Admission.jsx` | `getPatients({page, search, date})` → `{rows, total}`, 12 columns, server search + date filter, Pagination | 1,000 → 2,409 rows; "ram" 174 → 478 matches; 508 KB → 15 KB |
| `Admission/DepartmentSelection.jsx` | pending loaded in full (small), history 50 per page + server search, stats via counts, own channel replaced by shared debounced hook | stats 1000/8/992 → 2409/48/2361 |
| `rmo/RMOTaskList.jsx` | tab/role/date/search on the server, 50 per page, exact count, Pagination, quiet realtime | Pending 909 → **7,727**, History 91 → 1,361; 472 KB → 21 KB per page |
| `nurseStation/AssignTask.jsx`, `rmo/RMOAssignTask.jsx` | bed cards: only active admissions whose bed is occupied, 12 columns (fetchAllRows) | same 65 beds as an uncapped query; 1,251 KB → 359 KB |
| `PatientProfile/Dressing.jsx` | patient picker searches the server (10 results) instead of loading 1,000 of 2,338; dressing list 14 columns and always filtered to the patient | "Mrs. YOGITA SAHU" not findable → found; a failed lookup no longer loads every patient's dressings |

Bugs fixed here:
- **RMO Task List table cut off rows:** the desktop box had `lg:block` overriding `flex`, so the inner list never scrolled. Now `hidden lg:flex` (mobile unchanged).
- **RMO Task List "Add Task" never saved** (fixed by the main session after the agent's report): the insert sent
  `ot_information_type`, a column that does not exist in `rmo_assign_task` (checked on testing), so PostgREST
  rejected the whole insert; and `otMatch` was used outside the block it was declared in (ReferenceError for
  OT tasks). Now it writes `ot_information: 'surgical' | 'non-surgical'` — the format existing rows use (183 + 9)
  and the page reads.

Not changed (decision needed): the "occupied beds" list in the RMO Add Task modal is built from the newest
1,000 RMO tasks (covers 28 of 115 beds on testing). Making it complete changes which beds are offered.

## P2-11 — Discharge (frontend only)

All verified with the anon key against testing, no database changes.

| Page / file | Change | Before → after (testing) |
|---|---|---|
| `api/discharge.js` + `InitiationRMO.jsx` | pending/history fetched 50 at a time with server search; badges from counts; only the open tab loads; "10 more on scroll" feel kept | Pending 1,052 and History 1,100 were both cut at 1,000 (the 52 newest pending never showed) |
| `Dischargepatient.jsx` | records 50 per page; "available patients" list loaded in full only when the Add Discharge form opens | **Bug:** 999 "available" patients offered, only 202 really not discharged (797 could be discharged twice; 16 duplicate admission_no rows exist) → 202 |
| `DischargeBill.jsx`, `ConcernAuthority.jsx`, `ConcernDepartment.jsx`, `CompleteFileWork.jsx` | only the open tab loads; badges from counts; history 50 per page; pending loaded in full (can't be cut at 1,000); explicit columns | history 466–923 KB → ~30 KB per page |
| same three stage pages | submit sends one update per Yes/No value (`.in(...)`) instead of one request per record | same rows and fields as before (checked: old code set the same 3 fields per row, matched by the same id / admission_no) |
| `DischargeWorkflowDashboard.jsx` | loads all cases in chunks (stats need all of them), 28 columns, no 17 KB `.in()` URL; realtime fetches only the changed rows; IPD changes for patients not on the dashboard ignored | stats from 1,000 → 2,152 cases (completed 0 → 104, blocked 0 → 4, at billing 95 → 885); 931 KB on every change → ~2 KB per change |

Other fix: Complete File Work pending order was arbitrary (sorted by `actual2`, empty for all pending rows);
`id` added as a tie-break.

Proposed for later: a `discharge_available_patients` view (1 request instead of 6 when the form opens) —
**applied in P2-15 (15e)**; a `discharge_workflow_cases` view so the dashboard could page on the server — not applied.

## P2-12 — Lab (frontend only)

All 8 files in `src/pages/admin/Lab/`. Verified with the anon key against testing, no database changes.
Common pattern: history 50 per page on the server (+ Pagination), pending queues loaded in full in
chunks (they are small: 0–401 rows), stats from count queries, explicit columns, each page keeps its
own realtime channel that patches the pending queue; history re-read once (1 s debounce) instead of
`await loadData()` on top of the realtime update.

| Page | Bug / change | Before → after (testing) |
|---|---|---|
| `Labadvice.jsx` | pending (admissions without a lab record) and history were cut at 1,000; own channel re-ran all queries on every event → shared debounced hook | pending 998 → **1,593**, history 1,000 → 1,267; ~2.3 MB → ~144 KB |
| `Labpaymentslip.jsx` | history cut at 1,000 of 1,255 → paged; stats wrong | Comp Path 850 → 1,065, Comp Rad 150 → 190 |
| `ReceiveSample.jsx` | history `.limit(100)` and stats counted from those 100 | Comp Path 99 → **810**, Comp Rad 1 → 44, Total Path 354 → 1,065 |
| `Pathology.jsx`, `Labxray.jsx`, `LabCT.jsx`, `Labusg.jsx` | history paged, stats from counts, Refresh also re-reads history | Pathology history 878 KB per visit → 31 KB page |
| `LabWorkflowDashboard.jsx` | cut at 1,000 of 1,255; infinite scroll kept but fetched from the server; search/category on the server; stats from 4 counts | Total Active 1,000 → 1,255; search "Baba" 127 = old JS filter over the full list |

Also fixed: the date filter in Pathology and Payment Slip compared the **UTC** date of `planned1`, so records
between 00:00 and 05:30 IST showed under the previous day (176 Pathology records). Now the local date, as the
other lab pages already did.

Known, unchanged: `lab` has no `planned5`/`actual5`, so "Report Released" never completes on the Lab dashboard
(the "completed" filter is always empty). This was already so; noted in a code comment.

Proposed for later: a `lab_advice_pending` view (one call instead of two id lists) — **applied in P2-15 (15f)**.

## P2-13 — Pharmacy (frontend only)

`src/api/pharmacy.js` + `Pharmacy/PharmacyIndent.jsx`, `DepartmentalIndent.jsx`, `PharmacyApproval.jsx`,
`PharmacyStore.jsx`, `PharmacyWorkflowDashboard.jsx`. 70/70 old-vs-new comparisons pass against testing
(anon key), no database changes. Removed API functions (`getHistoryIndents`, `getStoreIndents`,
`getWorkflowData`) are not used anywhere else (checked). `getPatientPharmacyIndents` unchanged (Patient Profile).

| Page | Bug / change | Before → after (testing) |
|---|---|---|
| Store | **pending indents older than the newest 1,000 were hidden** (one capped list split in the browser) → pending loaded in full, history paged with server filters | history 1,065 of 12,233 visible → all |
| Approval | history cut at 1,000 and loaded even on the Pending tab → loads only on its tab, paged; dropdown titles complete (1,870 vs 214), lazy + cached 30 min | mount 1,708 KB / 1.9 s → 48 KB / 92 ms |
| Workflow Dashboard | stats from a partial list → 5 count queries; "Load More" fetches from the server | Total 1,065 → 12,432; Completed 1,016 → 12,233; mount 1,670 KB → 86 KB |
| Indent | search only saw loaded pages ("fever" 3 of 176) → server search; realtime re-reads only changed rows instead of every loaded page; admissions dropdown cut at 1,000 of 1,628 → complete | realtime event 313 KB → 1 KB |
| Approval / Store / Dashboard realtime | subscribed only to `departmental_pharmacy_indent` (which is not even in the realtime publication) → now also `pharmacy`, so patient indents appear live | never updated live → live |
| Departmental Indent | plain table name for realtime, narrowed columns | 88 KB → 45 KB |

Known, unchanged: the Store date filter matches `planned2`'s UTC day (as before), so indents approved
00:00–05:30 IST count under the previous day.

Proposed for later:
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.departmental_pharmacy_indent;` (live departmental
  indents) — **not applied** (user: leave realtime as is).
- history index — **applied in P2-15 (15b)** as `idx_pharmacy_history_actual1`.
- dropdown functions — **applied in P2-15 (15d)** as `get_pharmacy_history_titles()` and
  `get_pharmacy_store_filter_options()`.

## Realtime publication (finding, not changed)

Tables in `supabase_realtime` on testing: all_floor_bed, congratulations_posts, discharge, investigation,
ipd_admissions, lab, nurse_assign_task, patient_admission, pharmacy, surgical_data.
**Not** in it: `rmo_assign_task`, `departmental_pharmacy_indent`, `all_staff`, `medicine`, `doctors`, `master`,
`category`, `users`, `dressing`, `roster`. Pages that subscribe to those (RMO Task List / Score / Complete
Detail, Patient Profile RMO tab, masters pages, Roster) never receive live updates — this was already the
case. Adding them would make those pages live but also adds realtime traffic; decide per table. Check on
production with: `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`

## P2-14 — Final audit (26 Sep 2026)

**Automatic column check** (scratchpad `column_check.cjs`): collects every `.from(table)` + `.select(...)`
and filter column in `src/`, and asks Supabase for those columns with `limit=0` using the anon key
(read-only, no rows). Result: 23 tables, 270 columns — all exist, except in `src/pages/pms.jsx`
(`discharge.ipd_number`, `pre_defined_task.ot_task`), a file that no route imports (dead code, left as is).

Fixed in this round:
- `PatientProfile/Lab.jsx`: asked `patient_admission` for `ward_type` (no such column), so the request failed
  and `reason_for_visit` was never used when ordering a test from the patient's Lab tab. Column removed.
- `api/patientProfile.js` (Patient Profile list):
  - discharged admission numbers now loaded in full (1,000 at a time). **Bug:** only 993 of 2,136 were loaded,
    so the Active tab showed 999 patients of which **797 were already discharged**. Now Active = 202.
  - patient list loaded in full with the 17 columns the list/cards use (was `select *`, 1,000 of 2,338):
    1,251 KB → 989 KB and complete.
  - nurse / OT role: the nurse's patients come from all her tasks (1,000 at a time) instead of an arbitrary
    1,000 tasks (testing nurse: 50 → 230 patients), cached 2 minutes; the patient lookup is sent in batches of
    200 IPD numbers so the URL stays short. (Later replaced by one function call — P2-15, 15c.)

## P2-15 — Database items: 2 indexes, 3 functions, 2 views (26 Sep 2026)

All read-only objects: **no rows change, no triggers, no RLS change.** Run the whole section on production
**before** deploying the frontend (the new frontend calls these functions/views; the old frontend ignores them,
so running them early is safe).

Rules learned on testing:
- Each `CREATE INDEX CONCURRENTLY` in its own call (it cannot run inside a transaction).
- Never put a `CREATE` in the same call as a `BEGIN; ... ROLLBACK;` test — the rollback undoes the `CREATE`
  too (this happened once on testing with `get_nurse_patient_ipds`).
- Supabase gives new views ALL rights for `anon`/`authenticated` by default, and a simple view is
  updatable (writes go to `ipd_admissions`). Step 15g makes both views read-only.

### 15a. Index for OT Staff Assign (fixes an existing timeout)

`OT/OtStaffAssign.jsx:47` and `PatientProfile/GivenTask.jsx:461` filter `staff = 'OT Staff'`; with no index
every load scanned the whole 194 MB task table. No frontend change needed.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nat_staff
    ON public.nurse_assign_task (staff, "timestamp" DESC) WHERE staff IS NOT NULL;
```

### 15b. Index for Pharmacy Approval history pages

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pharmacy_history_actual1
    ON public.pharmacy (actual1 DESC NULLS LAST, id DESC) WHERE status IN ('approved', 'rejected');
```

### 15c. Nurse's patients in Patient Profile (frontend: `api/patientProfile.js` `getNurseAssignedIpds`)

```sql
CREATE OR REPLACE FUNCTION public.get_nurse_patient_ipds(p_nurse text)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
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
$function$;
```

### 15d. Pharmacy dropdown options (frontend: `api/pharmacy.js` `getApprovalHistoryTitles`, `getStoreFilterOptions`)

```sql
CREATE OR REPLACE FUNCTION public.get_pharmacy_history_titles()
 RETURNS text[]
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_pharmacy_store_filter_options()
 RETURNS json
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
$function$;
```

(`departmental_pharmacy_indent.id` is a uuid, so both sides use `row_number()`; casting it to bigint fails.)

### 15e. Add Discharge patient list (frontend: `Discharge/Dischargepatient.jsx` `fetchAvailablePatients`)

`IS NOT DISTINCT FROM` on purpose: the old code's `Set.has()` also treated a discharge row with an empty
admission number as matching admissions with an empty admission number.

```sql
CREATE OR REPLACE VIEW public.discharge_available_patients WITH (security_invoker = true) AS
SELECT i.id, i.admission_no, i.patient_name, i.department, i.consultant_dr, i.ipd_number, i."timestamp"
FROM public.ipd_admissions i
WHERE NOT EXISTS (SELECT 1 FROM public.discharge d WHERE d.admission_no IS NOT DISTINCT FROM i.admission_no);
```

### 15f. Lab Advice pending list (frontend: `Lab/Labadvice.jsx` `loadPendingIds`)

Plain `=` on purpose: the old code dropped empty lab admission numbers (`.filter(Boolean)`), so they never matched.

```sql
CREATE OR REPLACE VIEW public.lab_advice_pending WITH (security_invoker = true) AS
SELECT i.id, i."timestamp"
FROM public.ipd_admissions i
WHERE i.planned1 IS NOT NULL
  AND i.actual1 IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.lab l WHERE l.admission_no = i.admission_no);
```

### 15g. View permissions: read-only (run after 15e and 15f)

```sql
GRANT SELECT ON public.discharge_available_patients, public.lab_advice_pending TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.discharge_available_patients, public.lab_advice_pending FROM anon, authenticated;
```

### 15h. Check (read-only)

```sql
SELECT c.relname AS index, i.indisvalid AS valid
FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname IN ('idx_nat_staff', 'idx_pharmacy_history_actual1');          -- 2 rows, both true

SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('get_nurse_patient_ipds', 'get_pharmacy_history_titles', 'get_pharmacy_store_filter_options');  -- 3 rows

SELECT table_name, string_agg(grantee || ':' || privilege_type, ', ') FROM information_schema.role_table_grants
WHERE table_name IN ('discharge_available_patients', 'lab_advice_pending') AND grantee IN ('anon', 'authenticated')
GROUP BY 1;                                                                      -- only SELECT for each

-- Counts to compare with the old logic (production numbers will differ from testing's 202 / 1,593):
SELECT (SELECT count(*) FROM public.discharge_available_patients) AS add_discharge_list,
       (SELECT count(*) FROM public.lab_advice_pending)           AS lab_pending;
```

### 15i. Rollback (no data is affected)

Roll back the frontend **first** (the new frontend needs these objects), then:

```sql
DROP VIEW IF EXISTS public.lab_advice_pending;
DROP VIEW IF EXISTS public.discharge_available_patients;
DROP FUNCTION IF EXISTS public.get_pharmacy_store_filter_options();
DROP FUNCTION IF EXISTS public.get_pharmacy_history_titles();
DROP FUNCTION IF EXISTS public.get_nurse_patient_ipds(text);
DROP INDEX CONCURRENTLY IF EXISTS public.idx_pharmacy_history_actual1;   -- each on its own
DROP INDEX CONCURRENTLY IF EXISTS public.idx_nat_staff;                  -- each on its own
```

The two indexes can stay even if the frontend is rolled back (they only speed up reads).

### 15j. Results on testing (26 Sep 2026)

Every new query was compared with the old code's result using the anon key (the same way the app connects).

| Item | Before | After | Same result? |
|---|---|---|---|
| 15a OT Staff Assign history | 5.2 s (over the 3 s limit → **timeout**) | **0.2 ms**, loads (HTTP 200) | — |
| 15b Pharmacy Approval history page | 1,535 ms | **6.8 ms** | same rows |
| 15c Nurse's patients (Patient Profile) | 13 requests, ~300 KB, 0.7–3 s | **1 request**, 92–583 ms | identical for 4 nurses |
| 15d Approval dropdown titles | ~13 requests, 3.3 s | **1 request**, 131–575 ms | 1,870 titles, same order |
| 15d Store filter options | ~13 requests | **1 request** | 1,857 titles + 45 wards, same order |
| 15e Add Discharge list | 6 requests, 428 KB, 891 ms | **1 request, 32 KB, 299 ms** | 202 patients, same order |
| 15f Lab Advice pending ids | 4 requests, 94 KB, 564 ms | **2 requests, 7 KB, 172 ms** | 1,593 ids, same order |
| 15g Writes through the views | allowed (Supabase default) | refused (42501) | reads unchanged |

After all of the above: advisors (security + performance) show **no new findings** for these objects (views
are `security_invoker`, functions have a fixed `search_path`, neither new index is listed as unused);
column check of every query in `src/` passes (only the dead `pms.jsx` fails, as before); `npm run build` passes.

`pg_stat_statements` check: the remaining > 1 s entries were my own "before" tests, plus two app queries
(Complete Detail nurse count, Pharmacy dashboard stats) that took 1.1–1.5 s once while testing was busy.
Measured again as `anon`: **13 ms** and **15 ms** — no index needed.

Decisions (user, 26 Sep 2026) — deliberately **not** changed:
- Realtime publication: leave as is (Still open #4).
- Old nurse tasks cleanup: not now (#5).
- Patient Profile list server paging: keep as is (#3).
- Dead files: keep (#9).

## Still open (needs a decision or the Supabase connector on the testing account)

| # | Item | Why | SQL / action |
|---|---|---|---|
| 1 | ~~OT Staff Assign history times out~~ | — | **done in P2-15 (15a)** |
| 2 | ~~Nurse's patient list in Patient Profile: 13 requests~~ | — | **done in P2-15 (15c)** |
| 3 | Patient Profile list still loads all 2,338 patients on every admission change | Active/Discharged is decided in the browser | **user decided 26 Sep 2026: keep as is** |
| 4 | Realtime publication missing `rmo_assign_task`, `departmental_pharmacy_indent`, masters tables | those pages never update live (already so) | **user decided 26 Sep 2026: leave as is** |
| 5 | Old nurse tasks: 500k rows, 87% of discharged patients | table/index size, slower scans | **user decided 26 Sep 2026: not now** (the existing monthly `cleanup-discharged-nurse-tasks` function archives to Google Sheet, then deletes) |
| 6 | ~~Optional views/indexes proposed per section~~ | — | **done in P2-15**: history index (15b), dropdown functions (15d), Add Discharge view (15e), Lab pending view (15f). Not done: a `discharge_workflow_cases` view (dashboard already correct, small gain) and adding `departmental_pharmacy_indent` to realtime (#4) |
| 7 | Roster `leave` query reads all leave history, so anyone who ever took leave counts as on leave | behaviour question | decide the rule, then filter by date |
| 8 | Security (anon key can call `delete_patient_completely`, plain-text passwords, `users select *`; 44 functions without a fixed `search_path`; 7 tables without RLS) | user asked to leave for now | separate task |
| 9 | Dead files: `src/pages/pms.jsx`, `src/pages/admin/nurseStation/ShiftHandover.jsx`, unused `src/api/nurseTasks.js` functions | not routed/used | **user decided 26 Sep 2026: keep** |

## Tier 2 — what to click-test (testing project, `npm run dev`)

- Masters → Medicine (search a medicine starting with Z), Delete Patient (search, paging).
- Admission: list pages, search, date filter; Department Selection pending/history + stats.
- RMO Task List: tabs, paging, search, **Add Task (incl. "OT Information (surgical)")** — it now saves.
- Assign Nursing Task / Assign Medical Task: bed cards show the right patients.
- Discharge: Discharge Patient (Add Discharge dropdown lists only not-yet-discharged), Initiation, Complete
  File Work, Concern Dept/Authority (select several + submit), Discharge Bill, Workflow Dashboard numbers.
- Lab: Advice (pending count), Payment Slip, Receive Sample (stats), Pathology/X-ray/CT/USG (history paging,
  date filter), Lab Workflow dashboard (scroll, search).
- Pharmacy: Indent (search, scroll, new indent → admission dropdown), Approval (Pending + History tabs),
  Store (pending + history filters), Workflow Dashboard (Load More), Departmental Indent.

## P2-15 — what to click-test (testing project, `npm run dev`)

- OT → OT Staff Assign: history loads (it used to time out). Patient Profile → a patient → Given Task (OT Staff part).
- Log in as a nurse → Patient Profile: her patients are listed (same list as before, now 1 request).
- Pharmacy Approval → History tab → "All Indents" dropdown; Pharmacy Store → title and ward filters.
- Discharge → Discharge Patient → Add Discharge: dropdown shows only not-yet-discharged patients; add one →
  it disappears from the dropdown.
- Lab → Lab Advice: Pending count and pages; create an advice → the patient leaves Pending.

## Tier 1 — what to click-test (testing project, `npm run dev`)

- Nurse Station → Task List: Pending/History tabs, next/previous page, search (name, IPD, task name),
  date filter, complete a task (it leaves Pending), add a task (bed list opens fast).
- Nursing Score Dashboard: weekly / monthly / custom; click a nurse → totals match the new numbers.
- RMO Score Dashboard: numbers per RMO; click an RMO → the window now loads.
- Patient Profile: cards show nurse names; scroll loads more cards; open a patient → Nursing / OT /
  RMO / Pharmacy tabs update when that patient's tasks change.
- Patient Care Dashboard: scroll down, wait for a task change → list stays where you are.
- Shift Handover: pick nurse + shift → patients listed; hand over works.
