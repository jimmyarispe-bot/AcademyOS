# EduOS — School Platform

Education Operating System (EduOS) Phase 1, built with **Next.js 16** and **Supabase**.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind v4)
- `@supabase/supabase-js`

## Phase 1 schema

Run migrations in order in your Supabase project (`001` → … → `042`).

| Migration | Purpose |
|-----------|---------|
| `001_phase1_core_foundation.sql` | Core tables + indexes |
| `002_users_auth_fkey.sql` | Links `public.users.id` → `auth.users(id)` (`users_auth_fk`) |
| `003_enable_rls.sql` | Enables RLS on all Phase 1 tables |
| `004_students_self_or_family_policy.sql` | *(superseded by `012`)* family-only student read |
| `005_school_scoped_access_policy.sql` | *(superseded by `011`)* profile-based school read |
| `006_unique_student_class.sql` | Unique `(student_id, class_id)` as `unique_student_class_enrollment` |
| `007_users_auth_fk_rename.sql` | Renames auth FK to `users_auth_fk` (if `002` used old name) |
| `008_enable_rls_remaining.sql` | Enables RLS on `school_settings`, `roles`, `user_roles` (if `003` ran earlier) |
| `009_has_role_function.sql` | `has_role(text)` helper for RLS policies |
| `010_is_school_member_function.sql` | `is_school_member(uuid)` — family, teacher, CEO, or school leader |
| `011_school_access_policy.sql` | *(superseded by `039`)* `school_access` |
| `012_student_access_family_or_staff_policy.sql` | *(superseded by `024`)* includes teacher read access |
| `013_class_access_policy.sql` | *(superseded by `033`)* blanket school leader read |
| `014_enrollment_access_policy.sql` | *(superseded by `039`)* `enrollment_access` |
| `015_user_self_access_policy.sql` | Own profile, or CEO / school leader read all |
| `016_unique_student_class_enrollment_rename.sql` | Renames enrollment unique constraint (if `006` used old name) |
| `017_students_authenticated_insert_policy.sql` | *(superseded by `018`)* any authenticated insert |
| `018_school_leader_or_ceo_create_students_policy.sql` | *(superseded by `019`)* CEO / school leader insert |
| `019_school_scoped_student_insert_policy.sql` | *(superseded by `020`)* CEO / school leader insert |
| `020_school_scoped_student_insert_valid_school.sql` | *(superseded by `021`)* valid `school_id` insert |
| `021_students_insert_scoped_to_school_policy.sql` | *(superseded by `023`)* insert without `user_schools` |
| `022_user_schools.sql` | User ↔ school assignments (`user_schools`) |
| `023_students_insert_school_scoped_policy.sql` | *(superseded by `025`)* leader insert without profile check |
| `024_students_select_school_scoped_policy.sql` | *(superseded by `025`)* leader read without profile check |
| `025_students_school_leader_profile_check.sql` | *(superseded by `026`)* inline `user_schools` check |
| `026_is_assigned_to_school_function.sql` | *(superseded by `031`)* assignment without CEO |
| `027_students_insert_school_scoped_policy.sql` | Insert policy — CEO or assigned school leader |
| `028_students_select_school_scoped_policy.sql` | Select policy — CEO, assigned leader, or family |
| `029_user_schools_enable_rls.sql` | Enables RLS on `user_schools` |
| `030_user_schools_select_policy.sql` | *(superseded by `035`)* `user_can_view_own_school_links` |
| `031_is_assigned_to_school_ceo.sql` | `is_assigned_to_school(uuid)` includes CEO |
| `032_students_policies_use_is_assigned_to_school.sql` | *(superseded by `033`)* uses `students.school_id` |
| `033_is_assigned_to_school_school_id.sql` | *(superseded by `038`)* inline role + assignment checks |
| `034_user_id_auth_uid_policies.sql` | *(superseded by `040` for user_roles)* family link read |
| `035_user_schools_select_policy.sql` | `user_schools_select` — own links or CEO |
| `036_user_schools_manage_ceo_only_policy.sql` | CEO-only write on `user_schools` |
| `037_can_access_school_function.sql` | `can_access_school(uuid)` — CEO or assigned leader/teacher |
| `038_policies_use_can_access_school.sql` | Student + class policies use `can_access_school(school_id)` |
| `039_phase1_final_consolidation.sql` | *(school_settings read superseded by `040`)* |
| `040_final_rls_hardening.sql` | *(roles read superseded by `041`)* user_roles, school_settings |
| `041_roles_rbac_fix.sql` | *(superseded by `042` for roles read)* authenticated `roles` read |
| `042_rbac_integrity_lock.sql` | Phase 1 RBAC/RLS integrity lock + policy rename |

Tables:

| Domain | Tables |
|--------|--------|
| Schools | `schools`, `school_settings` |
| Identity | `users`, `roles`, `user_roles`, `user_schools` |
| Students | `students`, `student_family_link` |
| Academics | `classes`, `enrollments` |

Seed roles: `CEO`, `SCHOOL_LEADER`, `TEACHER`, `PARENT`, `STUDENT`, `EMPLOYEE`

## Quick start

```bash
cp .env.example .env.local
# Add Supabase URL + anon key from project settings

npm install
npm run dev
```

Open http://localhost:3000

## Apply migration

**Supabase Dashboard:** SQL Editor → paste `supabase/migrations/001_phase1_core_foundation.sql` → Run

**Supabase CLI:**

```bash
supabase db push
```

## Project layout

```
school-platform/
├── supabase/migrations/
│   ├── 001_phase1_core_foundation.sql
│   ├── 002_users_auth_fkey.sql
│   ├── 003_enable_rls.sql
│   ├── 004_students_self_or_family_policy.sql
│   ├── 005_school_scoped_access_policy.sql
│   ├── 006_unique_student_class.sql
│   ├── 007_users_auth_fk_rename.sql
│   ├── 008_enable_rls_remaining.sql
│   ├── 009_has_role_function.sql
│   ├── 010_is_school_member_function.sql
│   ├── 011_school_access_policy.sql
│   ├── 012_student_access_family_or_staff_policy.sql
│   ├── 013_class_access_policy.sql
│   ├── 014_enrollment_access_policy.sql
│   ├── 015_user_self_access_policy.sql
│   ├── 016_unique_student_class_enrollment_rename.sql
│   ├── 017_students_authenticated_insert_policy.sql
│   ├── 018_school_leader_or_ceo_create_students_policy.sql
│   ├── 019_school_scoped_student_insert_policy.sql
│   ├── 020_school_scoped_student_insert_valid_school.sql
│   ├── 021_students_insert_scoped_to_school_policy.sql
│   ├── 022_user_schools.sql
│   ├── 023_students_insert_school_scoped_policy.sql
│   ├── 024_students_select_school_scoped_policy.sql
│   ├── 025_students_school_leader_profile_check.sql
│   ├── 026_is_assigned_to_school_function.sql
│   ├── 027_students_insert_school_scoped_policy.sql
│   ├── 028_students_select_school_scoped_policy.sql
│   ├── 029_user_schools_enable_rls.sql
│   ├── 030_user_schools_select_policy.sql
│   ├── 031_is_assigned_to_school_ceo.sql
│   ├── 032_students_policies_use_is_assigned_to_school.sql
│   ├── 033_is_assigned_to_school_school_id.sql
│   ├── 034_user_id_auth_uid_policies.sql
│   ├── 035_user_schools_select_policy.sql
│   ├── 036_user_schools_manage_ceo_only_policy.sql
│   ├── 037_can_access_school_function.sql
│   ├── 038_policies_use_can_access_school.sql
│   ├── 039_phase1_final_consolidation.sql
│   ├── 040_final_rls_hardening.sql
│   ├── 041_roles_rbac_fix.sql
│   └── 042_rbac_integrity_lock.sql
├── src/
│   ├── app/              # Next.js pages
│   ├── lib/supabase/     # Browser + server clients
│   └── types/database.ts # TypeScript types
└── .env.example
```

## Note on `create-next-app .`

Do **not** run `create-next-app` in the parent `academyOS/` monorepo root — that folder already contains