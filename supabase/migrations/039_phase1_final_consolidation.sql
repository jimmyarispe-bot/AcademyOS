-- =========================================
-- PHASE 1 FINAL CONSOLIDATION (039)
-- Extend can_access_school() usage to remaining core tables
-- Supabase / Postgres Migration
-- =========================================

-- =========================================
-- 1. SCHOOLS TABLE RLS (REPLACE OLD LOGIC)
-- =========================================

drop policy if exists "school_access" on schools;

create policy "schools_access_controlled"
on schools
for select
using (
  has_role('CEO')
  or can_access_school(id)
);

-- =========================================
-- 2. ENROLLMENTS TABLE RLS (MISSING SCOPING)
-- =========================================

drop policy if exists "enrollment_access" on enrollments;

create policy "enrollments_access_controlled"
on enrollments
for select
using (
  has_role('CEO')
  or (
    exists (
      select 1
      from classes c
      where c.id = enrollments.class_id
      and can_access_school(c.school_id)
    )
  )
  or (
    exists (
      select 1
      from student_family_link sfl
      where sfl.student_id = enrollments.student_id
      and sfl.user_id = auth.uid()
    )
  )
  or (
    exists (
      select 1
      from classes c
      where c.id = enrollments.class_id
      and c.teacher_id = auth.uid()
    )
  )
);

-- =========================================
-- 3. SCHOOL_SETTINGS (LOCK TO SCHOOL SCOPE)
-- =========================================

alter table school_settings enable row level security;

drop policy if exists "school_settings_access" on school_settings;

create policy "school_settings_access_controlled"
on school_settings
for select
using (
  has_role('CEO')
  or can_access_school(school_id)
);

-- =========================================
-- 4. STANDARDIZATION NOTE (NO NEW FEATURES)
-- =========================================
-- All school-level access decisions must now use:
--
-- can_access_school(school_id)
--
-- No inline:
-- - user_schools EXISTS
-- - has_role + is_assigned_to_school duplication
-- =========================================
