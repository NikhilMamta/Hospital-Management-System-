-- ============================================================
-- DASHBOARD RPC FUNCTION
-- Run in Supabase SQL Editor AFTER running performance_indexes.sql
-- Replaces 7 parallel full-table fetches with a single server-side
-- aggregate — reduces dashboard payload from ~15MB to ~2KB.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Grant execute to the anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO anon, authenticated;

-- ── Quick test — run this to verify the function works:
-- SELECT get_dashboard_stats();
