-- =========================================
-- FUNDING JUNCTION RPC FIX (064)
-- Repairs 063 functions so PostgREST registers them
-- =========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n
      ON n.oid = t.typnamespace
    WHERE t.typname = 'lead_funding_link'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.lead_funding_link AS (
      lead_id uuid,
      funding_source_id uuid
    );
  END IF;
END
$$;

GRANT USAGE ON TYPE public.lead_funding_link
TO authenticated, anon, service_role;

DROP FUNCTION IF EXISTS public.list_admissions_lead_funding_sources(uuid[]);

CREATE OR REPLACE FUNCTION public.list_admissions_lead_funding_sources(
  p_lead_ids uuid[]
)
RETURNS SETOF public.lead_funding_link
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    alfs.lead_id,
    alfs.funding_source_id
  FROM public.admissions_lead_funding_sources alfs
  WHERE alfs.lead_id = ANY(p_lead_ids);
$$;

GRANT EXECUTE ON FUNCTION public.list_admissions_lead_funding_sources(uuid[])
TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';