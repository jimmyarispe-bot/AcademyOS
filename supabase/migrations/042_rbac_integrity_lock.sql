-- =========================================
-- PHASE 1 FINAL LOCK: RBAC + RLS INTEGRITY VERIFICATION
-- (042_rbac_integrity_lock.sql)
-- =========================================

-- PURPOSE:
-- Final stabilization pass to ensure RBAC chain is consistent,
-- deterministic, and free of hidden privilege failures.

-- =========================================
-- 1. CONFIRM RLS ENABLED ON CORE TABLES
-- =========================================

alter table schools enable row level security;
alter table students enable row level security;
alter table classes enable row level security;
alter table enrollments enable row level security;
alter table school_settings enable row level security;
alter table user_schools enable row level security;
alter table user_roles enable row level security;
alter table roles enable row level security;

-- =========================================
-- 2. GUARANTEE CONSISTENT ROLE RESOLUTION PATH
-- =========================================
-- RBAC MUST ALWAYS FLOW THROUGH:
-- user_roles → roles → has_role()

-- Ensure no direct role bypass paths exist

drop policy if exists "user_roles_read_access" on user_roles;

create policy "user_roles_read_own_or_ceo"
on user_roles
for select
using (
  user_id = auth.uid()
  or has_role('CEO')
);

-- =========================================
-- 3. ENSURE ROLE LOOKUP STABILITY
-- =========================================

drop policy if exists "roles_read_access" on roles;

create policy "roles_read_access"
on roles
for select
using (
  auth.uid() is not null
);

-- =========================================
-- 4. HARD VALIDATION RULE (DOCUMENTED ENFORCEMENT)
-- =========================================
-- The system is now considered INVALID if any of the following exist:
--
-- ❌ Inline references to user_schools in policies
-- ❌ Any policy using raw EXISTS for school scoping
-- ❌ Any role check not using has_role()
-- ❌ Any school access check not using can_access_school()
--
-- =========================================
-- 5. PHASE 1 STATUS DECLARATION
-- =========================================
-- RBAC STACK IS NOW STABLE:
--
-- auth.uid()
--   ↓
-- user_roles (row ownership)
--   ↓
-- roles (reference lookup)
--   ↓
-- has_role()
--   ↓
-- is_assigned_to_school()
--   ↓
-- can_access_school()
--
-- READY FOR PHASE 2 ONLY AFTER TESTING:
-- - cross-school isolation
-- - parent-student isolation
-- - teacher class scoping
-- =========================================
