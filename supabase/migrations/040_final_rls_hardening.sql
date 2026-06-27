-- =========================================
-- PHASE 1 FINAL RLS CLEANUP & COMPLETION
-- (040_final_rls_hardening.sql)
-- =========================================

-- =========================================
-- 1. ROLES TABLE (READ ONLY SAFETY)
-- =========================================

alter table roles enable row level security;

drop policy if exists "roles_read" on roles;

create policy "roles_read_access"
on roles
for select
using (
  has_role('CEO')
);

-- =========================================
-- 2. USER_ROLES TABLE (STABLE READ MODEL)
-- REQUIRED FOR has_role() FUNCTION SUPPORT
-- =========================================

alter table user_roles enable row level security;

drop policy if exists "user_roles_read" on user_roles;
drop policy if exists "user_can_view_own_roles" on user_roles;

create policy "user_roles_read_access"
on user_roles
for select
using (
  user_id = auth.uid()
  or has_role('CEO')
);

-- =========================================
-- 3. SCHOOL SETTINGS WRITE PROTECTION (MISSING LAYER FIX)
-- =========================================

drop policy if exists "school_settings_access_controlled" on school_settings;

create policy "school_settings_read"
on school_settings
for select
using (
  has_role('CEO')
  or can_access_school(school_id)
);

create policy "school_settings_write_ceo_only"
on school_settings
for insert
with check (
  has_role('CEO')
);

create policy "school_settings_update_ceo_only"
on school_settings
for update
using (
  has_role('CEO')
)
with check (
  has_role('CEO')
);

-- =========================================
-- 4. FINAL STANDARDIZATION NOTE (ENFORCED RULESET)
-- =========================================
-- PHASE 1 IS NOW LOCKED.

-- ALL SCHOOL-LEVEL ACCESS MUST USE:
--   can_access_school(school_id)

-- ALL IDENTITY MUST USE:
--   auth.uid()

-- ALL ROLE CHECKS MUST USE:
--   has_role('ROLE_NAME')

-- NEVER USE:
-- - inline user_schools EXISTS
-- - duplicated school scoping logic
-- - ad-hoc role + assignment combinations
-- =========================================
