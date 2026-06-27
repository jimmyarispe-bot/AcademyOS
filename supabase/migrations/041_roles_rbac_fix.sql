-- =========================================
-- PHASE 1 FIX: ROLES READ ACCESS FOR RBAC SYSTEM
-- (041_roles_rbac_fix.sql)
-- =========================================

-- This fixes a critical issue where has_role()
-- can fail for non-CEO users due to restricted roles visibility

drop policy if exists "roles_read_access" on roles;

create policy "roles_read_access"
on roles
for select
using (
  auth.uid() is not null
);

-- =========================================
-- SAFETY NOTE
-- roles is a reference table used ONLY for RBAC evaluation.
-- It must be readable by all authenticated users.
-- Otherwise has_role() will return false incorrectly.
-- =========================================
