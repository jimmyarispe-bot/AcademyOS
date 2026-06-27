-- =========================================
-- API GRANTS + SCHEMA RELOAD (058)
-- Supabase no longer auto-exposes new tables to
-- anon/authenticated/service_role without explicit GRANTs.
-- Idempotent: safe to re-run.
-- =========================================

grant usage on schema public to postgres, anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to authenticated;
grant all on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant select on tables to anon;

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to authenticated;

alter default privileges in schema public
  grant all on sequences to service_role;

-- RLS helper functions must be executable by API roles
grant execute on all functions in schema public to authenticated, anon, service_role;

notify pgrst, 'reload schema';
