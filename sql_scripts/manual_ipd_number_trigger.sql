-- ============================================================================
-- MANUAL IPD NUMBER SUPPORT
-- Modify the BEFORE INSERT trigger on ipd_admissions so that:
--   • If ipd_number is already set (staff typed one manually) → keep it as-is
--   • If ipd_number is NULL or blank → auto-assign from ipd_number_seq (existing behaviour)
--
-- This is a NON-DESTRUCTIVE change. The sequence and all downstream triggers
-- (nurse tasks, RMO tasks, lab, OT, pharmacy, discharge) are UNCHANGED.
-- ============================================================================

-- Step 1: Replace the get_next_ipd_number trigger function so it honours
--         a manually supplied value.
--
-- NOTE: The exact function body below assumes the existing function assigns
--       ipd_number via nextval('ipd_number_seq'). Adjust the sequence name if
--       yours differs (check with: SELECT * FROM pg_sequences WHERE sequencename ILIKE '%ipd%')

CREATE OR REPLACE FUNCTION public.get_next_ipd_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If staff already provided an IPD number, honour it and skip auto-assignment.
  IF NEW.ipd_number IS NOT NULL AND btrim(NEW.ipd_number) <> '' THEN
    RETURN NEW;
  END IF;

  -- Auto-assign from the sequence (original behaviour).
  NEW.ipd_number := 'IPD-' || to_char(nextval('ipd_number_seq'), 'FM000000');
  RETURN NEW;
END;
$$;

-- Step 2: Ensure the trigger is still wired correctly (BEFORE INSERT only).
--         Drop + recreate only if needed; safe to run on any environment.
DROP TRIGGER IF EXISTS trg_assign_ipd_number ON public.ipd_admissions;

CREATE TRIGGER trg_assign_ipd_number
  BEFORE INSERT ON public.ipd_admissions
  FOR EACH ROW
  EXECUTE FUNCTION public.get_next_ipd_number();

-- ============================================================================
-- VERIFICATION
-- After running, confirm the trigger exists:
-- SELECT tgname, tgenabled FROM pg_trigger
-- WHERE tgrelid = 'public.ipd_admissions'::regclass
--   AND tgname = 'trg_assign_ipd_number';
-- ============================================================================
