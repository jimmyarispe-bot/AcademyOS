-- =========================================
-- SPRINT 1.7: ENTERPRISE IDENTITY, ORGANIZATIONS & PERMISSIONS (074)
-- Extends existing auth/RBAC — does not replace roles or user_schools
-- Idempotent: safe to re-run
-- =========================================

-- -----------------------------------------
-- ORGANIZATION HIERARCHY
-- The Academy Way → Region (future) → School → Campus → Program → Department
-- -----------------------------------------

create table if not exists public.org_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists org_organizations_set_updated_at on public.org_organizations;
create trigger org_organizations_set_updated_at
  before update on public.org_organizations
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.org_regions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  name text not null,
  code text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_regions_org_code_unique unique (organization_id, code)
);

drop trigger if exists org_regions_set_updated_at on public.org_regions;
create trigger org_regions_set_updated_at
  before update on public.org_regions
  for each row execute function public.trigger_set_updated_at();

alter table public.schools
  add column if not exists organization_id uuid references public.org_organizations(id) on delete set null;

alter table public.schools
  add column if not exists region_id uuid references public.org_regions(id) on delete set null;

create table if not exists public.org_programs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_programs_school_code_unique unique (school_id, code)
);

create index if not exists idx_org_programs_school_id on public.org_programs(school_id);

drop trigger if exists org_programs_set_updated_at on public.org_programs;
create trigger org_programs_set_updated_at
  before update on public.org_programs
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.org_departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  name text not null,
  code text not null,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_departments_school_code_unique unique (school_id, code)
);

create index if not exists idx_org_departments_school_id on public.org_departments(school_id);

drop trigger if exists org_departments_set_updated_at on public.org_departments;
create trigger org_departments_set_updated_at
  before update on public.org_departments
  for each row execute function public.trigger_set_updated_at();

-- Seed root organization
insert into public.org_organizations (name, slug)
values ('The Academy Way', 'the-academy-way')
on conflict (slug) do update set name = excluded.name;

-- Link existing schools to root org
update public.schools s
set organization_id = o.id
from public.org_organizations o
where o.slug = 'the-academy-way'
  and s.organization_id is null;

-- Seed programs from legacy student.program enum values per school
insert into public.org_programs (school_id, name, code)
select s.id, p.label, p.code
from public.schools s
cross join (
  values
    ('Academy FL Campus', 'academy_fl_campus'),
    ('Academy FL Virtual', 'academy_fl_virtual'),
    ('Academy GA Campus', 'academy_ga_campus'),
    ('Academy GA Hybrid', 'academy_ga_hybrid'),
    ('Academy HS', 'academy_hs'),
    ('Academy Virtual', 'academy_virtual')
) as p(label, code)
on conflict (school_id, code) do nothing;

-- -----------------------------------------
-- EXTEND ROLES (configurable RBAC — preserves existing 6 roles)
-- -----------------------------------------

alter table public.roles
  add column if not exists display_name text;

alter table public.roles
  add column if not exists description text;

alter table public.roles
  add column if not exists is_system boolean not null default true;

alter table public.roles
  add column if not exists is_custom boolean not null default false;

alter table public.roles
  add column if not exists parent_role_id uuid references public.roles(id) on delete set null;

alter table public.roles
  add column if not exists sort_order integer not null default 0;

update public.roles set display_name = 'Chief Executive Officer', sort_order = 10
  where name = 'CEO' and display_name is null;
update public.roles set display_name = 'School Leader', sort_order = 50
  where name = 'SCHOOL_LEADER' and display_name is null;
update public.roles set display_name = 'Teacher', sort_order = 120
  where name = 'TEACHER' and display_name is null;
update public.roles set display_name = 'Parent', sort_order = 200
  where name = 'PARENT' and display_name is null;
update public.roles set display_name = 'Student', sort_order = 210
  where name = 'STUDENT' and display_name is null;
update public.roles set display_name = 'Employee', sort_order = 130
  where name = 'EMPLOYEE' and display_name is null;

-- Expanded default roles (legacy names preserved; new roles added)
insert into public.roles (name, display_name, description, is_system, sort_order) values
  ('FOUNDER', 'Founder', 'Organization founder with full enterprise access', true, 1),
  ('EXECUTIVE_DIRECTOR', 'Executive Director', 'Executive leadership across schools', true, 20),
  ('REGIONAL_DIRECTOR', 'Regional Director', 'Regional oversight (future regions)', true, 30),
  ('ADMISSIONS', 'Admissions', 'Admissions pipeline and enrollment', true, 60),
  ('FINANCE', 'Finance', 'Billing, tuition, and financial operations', true, 70),
  ('HR', 'Human Resources', 'Staff records, hiring, and payroll', true, 80),
  ('SCHOLARSHIP_MANAGER', 'Scholarship Manager', 'Scholarship review and awards', true, 90),
  ('STATE_FUNDING_MANAGER', 'State Funding Manager', 'State funding verification and reporting', true, 100),
  ('REGISTRAR', 'Registrar', 'Student records and enrollment', true, 110),
  ('THERAPIST', 'Therapist', 'Therapeutic services staff', true, 125),
  ('SUPPORT_STAFF', 'Support Staff', 'General support operations', true, 140),
  ('BOARD_MEMBER', 'Board Member', 'Board governance read access', true, 180),
  ('AUDITOR', 'Auditor', 'Audit and compliance read access', true, 190),
  ('GUEST', 'Guest', 'Limited guest access', true, 220)
on conflict (name) do update set
  display_name = coalesce(excluded.display_name, roles.display_name),
  description = coalesce(excluded.description, roles.description),
  sort_order = excluded.sort_order;

-- Role inheritance (child inherits parent permissions)
update public.roles set parent_role_id = (select id from public.roles where name = 'CEO')
  where name = 'EXECUTIVE_DIRECTOR' and parent_role_id is null;
update public.roles set parent_role_id = (select id from public.roles where name = 'EXECUTIVE_DIRECTOR')
  where name = 'REGIONAL_DIRECTOR' and parent_role_id is null;
update public.roles set parent_role_id = (select id from public.roles where name = 'REGIONAL_DIRECTOR')
  where name = 'SCHOOL_LEADER' and parent_role_id is null;
update public.roles set parent_role_id = (select id from public.roles where name = 'EMPLOYEE')
  where name = 'TEACHER' and parent_role_id is null;
update public.roles set parent_role_id = (select id from public.roles where name = 'SCHOOL_LEADER')
  where name = 'ADMISSIONS' and parent_role_id is null;

-- -----------------------------------------
-- PERMISSION MATRIX
-- -----------------------------------------

create table if not exists public.platform_permissions (
  permission_key text primary key,
  name text not null,
  description text,
  module text not null,
  category text not null default 'general',
  sort_order integer not null default 0
);

create table if not exists public.platform_role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.platform_permissions(permission_key) on delete cascade,
  effect text not null default 'allow'
    check (effect in ('allow', 'deny')),
  created_at timestamptz not null default now(),
  constraint platform_role_permissions_unique unique (role_id, permission_key)
);

create index if not exists idx_platform_role_permissions_role
  on public.platform_role_permissions(role_id);

-- Seed permissions
insert into public.platform_permissions (permission_key, name, description, module, category, sort_order) values
  ('org.view', 'View Organization', 'View org hierarchy and settings', 'organization', 'organization', 1),
  ('org.manage', 'Manage Organization', 'Edit org hierarchy and assignments', 'organization', 'organization', 2),
  ('users.view', 'View Users', 'View user directory and assignments', 'organization', 'users', 10),
  ('users.manage', 'Manage Users', 'Create and edit users and role assignments', 'organization', 'users', 11),
  ('roles.view', 'View Roles', 'View roles and permission matrix', 'organization', 'roles', 20),
  ('roles.manage', 'Manage Roles', 'Create custom roles and edit permissions', 'organization', 'roles', 21),
  ('security.view', 'View Security Dashboard', 'View security events and audit stats', 'organization', 'security', 30),
  ('impersonate.users', 'Impersonate Users', 'Act as another user for support', 'organization', 'security', 31),
  ('students.view', 'View Students', 'View student records', 'sis', 'students', 40),
  ('students.edit', 'Edit Students', 'Edit student records', 'sis', 'students', 41),
  ('admissions.view', 'View Admissions', 'View admissions pipeline', 'admissions', 'admissions', 50),
  ('admissions.accept', 'Accept Applicants', 'Accept or reject applicants', 'admissions', 'admissions', 51),
  ('admissions.manage', 'Manage Admissions Settings', 'Configure admissions workflows and checklists', 'admissions', 'admissions', 52),
  ('scholarships.view', 'View Scholarships', 'View scholarship applications', 'scholarships', 'scholarships', 60),
  ('scholarships.approve', 'Approve Scholarships', 'Approve scholarship awards', 'scholarships', 'scholarships', 61),
  ('funding.view', 'View State Funding', 'View state funding records', 'state_funding', 'funding', 70),
  ('funding.verify', 'Verify State Funding', 'Verify and reconcile state funding', 'state_funding', 'funding', 71),
  ('funding.export', 'Export Funding Reports', 'Export funding reports by state/program', 'state_funding', 'funding', 72),
  ('finance.view', 'View Finance', 'View billing and revenue', 'finance', 'finance', 80),
  ('finance.override_tuition', 'Override Tuition', 'Override tuition amounts', 'finance', 'finance', 81),
  ('finance.export', 'Export Financial Reports', 'Export financial data', 'finance', 'finance', 82),
  ('hr.view', 'View HR', 'View employee records', 'hr', 'hr', 90),
  ('hr.manage', 'Manage HR', 'Edit employee records', 'hr', 'hr', 91),
  ('payroll.run', 'Run Payroll', 'Process payroll', 'hr', 'payroll', 92),
  ('workflows.view', 'View Workflows', 'View automation workflows', 'automation', 'workflows', 100),
  ('workflows.manage', 'Create Workflows', 'Create and edit workflows', 'automation', 'workflows', 101),
  ('templates.manage', 'Manage Templates', 'Edit communication templates', 'automation', 'templates', 102),
  ('mission_control.access', 'Access Mission Control', 'View Mission Control dashboard', 'mission_control', 'operations', 110),
  ('executive.dashboard', 'View Executive Dashboards', 'Access executive metrics and dashboards', 'executive', 'executive', 120),
  ('school.configure', 'Configure School', 'Edit school branding and settings', 'organization', 'school', 15),
  ('directory.view', 'View Staff Directory', 'View enterprise staff directory', 'hr', 'directory', 95)
on conflict (permission_key) do update set
  name = excluded.name,
  description = excluded.description,
  module = excluded.module;

-- Grant all permissions to CEO and FOUNDER
insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER')
on conflict (role_id, permission_key) do nothing;

-- SCHOOL_LEADER bundle
insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name = 'SCHOOL_LEADER'
  and p.permission_key in (
    'org.view', 'users.view', 'students.view', 'students.edit',
    'admissions.view', 'admissions.accept', 'admissions.manage',
    'scholarships.view', 'funding.view', 'finance.view',
    'hr.view', 'workflows.view', 'templates.manage',
    'mission_control.access', 'school.configure', 'directory.view'
  )
on conflict (role_id, permission_key) do nothing;

-- Module-specific role bundles
insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where (r.name, p.permission_key) in (
  ('ADMISSIONS', 'admissions.view'), ('ADMISSIONS', 'admissions.accept'), ('ADMISSIONS', 'admissions.manage'),
  ('ADMISSIONS', 'mission_control.access'), ('ADMISSIONS', 'workflows.view'), ('ADMISSIONS', 'templates.manage'),
  ('FINANCE', 'finance.view'), ('FINANCE', 'finance.override_tuition'), ('FINANCE', 'finance.export'),
  ('FINANCE', 'mission_control.access'),
  ('HR', 'hr.view'), ('HR', 'hr.manage'), ('HR', 'payroll.run'), ('HR', 'directory.view'), ('HR', 'mission_control.access'),
  ('SCHOLARSHIP_MANAGER', 'scholarships.view'), ('SCHOLARSHIP_MANAGER', 'scholarships.approve'), ('SCHOLARSHIP_MANAGER', 'mission_control.access'),
  ('STATE_FUNDING_MANAGER', 'funding.view'), ('STATE_FUNDING_MANAGER', 'funding.verify'), ('STATE_FUNDING_MANAGER', 'funding.export'), ('STATE_FUNDING_MANAGER', 'mission_control.access'),
  ('REGISTRAR', 'students.view'), ('REGISTRAR', 'students.edit'), ('REGISTRAR', 'mission_control.access'),
  ('TEACHER', 'students.view'), ('TEACHER', 'directory.view'),
  ('EXECUTIVE_DIRECTOR', 'executive.dashboard'), ('EXECUTIVE_DIRECTOR', 'mission_control.access'),
  ('BOARD_MEMBER', 'executive.dashboard'), ('AUDITOR', 'security.view'), ('AUDITOR', 'executive.dashboard')
)
on conflict (role_id, permission_key) do nothing;

-- Impersonation limited to CEO, FOUNDER, EXECUTIVE_DIRECTOR
insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, 'impersonate.users', 'allow'
from public.roles r
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
on conflict (role_id, permission_key) do nothing;

-- -----------------------------------------
-- MULTI-SCHOOL / ORG ASSIGNMENTS (extends user_schools)
-- -----------------------------------------

create table if not exists public.user_org_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete cascade,
  program_id uuid references public.org_programs(id) on delete cascade,
  department_id uuid references public.org_departments(id) on delete cascade,
  all_campuses boolean not null default false,
  all_programs boolean not null default false,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint user_org_assignments_unique unique (user_id, school_id, campus_id, program_id, department_id)
);

create index if not exists idx_user_org_assignments_user
  on public.user_org_assignments(user_id);

create index if not exists idx_user_org_assignments_school
  on public.user_org_assignments(school_id);

-- Mirror existing user_schools into user_org_assignments
insert into public.user_org_assignments (user_id, school_id, all_campuses, all_programs, is_primary)
select us.user_id, us.school_id, true, true, false
from public.user_schools us
where not exists (
  select 1 from public.user_org_assignments uoa
  where uoa.user_id = us.user_id and uoa.school_id = us.school_id
    and uoa.campus_id is null and uoa.program_id is null and uoa.department_id is null
);

-- -----------------------------------------
-- IMPERSONATION
-- -----------------------------------------

create table if not exists public.platform_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  reason text not null default '',
  ip_address text,
  user_agent text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  is_active boolean not null default true
);

create index if not exists idx_impersonation_active
  on public.platform_impersonation_sessions(actor_user_id, is_active)
  where is_active = true;

-- -----------------------------------------
-- USER PREFERENCES
-- -----------------------------------------

create table if not exists public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  timezone text not null default 'America/New_York',
  language text not null default 'en',
  theme text not null default 'system'
    check (theme in ('light', 'dark', 'system')),
  dashboard_layout jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  accessibility jsonb not null default '{}'::jsonb,
  communication jsonb not null default '{}'::jsonb,
  mission_control_widgets jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- SCHOOL CONFIGURATION / BRANDING
-- -----------------------------------------

create table if not exists public.school_branding (
  school_id uuid primary key references public.schools(id) on delete cascade,
  logo_url text,
  primary_color text default '#4F46E5',
  secondary_color text default '#6366F1',
  accent_color text default '#818CF8',
  custom_css text,
  updated_at timestamptz not null default now()
);

drop trigger if exists school_branding_set_updated_at on public.school_branding;
create trigger school_branding_set_updated_at
  before update on public.school_branding
  for each row execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- FAMILY & CONTACT RELATIONSHIPS
-- -----------------------------------------

alter table public.guardians
  add column if not exists contact_type text not null default 'guardian'
    check (contact_type in (
      'guardian', 'parent', 'grandparent', 'case_worker', 'advocate',
      'transportation', 'emergency', 'other'
    ));

alter table public.guardians
  add column if not exists custody_status text
    check (custody_status is null or custody_status in ('full', 'joint', 'restricted', 'none', 'shared'));

alter table public.guardians
  add column if not exists can_pick_up boolean not null default true;

alter table public.guardians
  add column if not exists is_emergency_contact boolean not null default false;

alter table public.guardians
  add column if not exists is_transportation_contact boolean not null default false;

alter table public.guardians
  add column if not exists legal_restrictions text;

alter table public.guardians
  add column if not exists household_label text;

create table if not exists public.family_households (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  label text not null,
  address text,
  city text,
  state text,
  zip_code text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_family_households_family
  on public.family_households(family_id);

create table if not exists public.student_authorized_contacts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  contact_type text not null default 'other'
    check (contact_type in (
      'guardian', 'parent', 'grandparent', 'case_worker', 'advocate',
      'transportation', 'emergency', 'other'
    )),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  custody_notes text,
  can_pick_up boolean not null default false,
  receives_communications boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_student_authorized_contacts_student
  on public.student_authorized_contacts(student_id);

-- -----------------------------------------
-- STAFF DIRECTORY EXTENSIONS
-- -----------------------------------------

alter table public.employee_profiles
  add column if not exists photo_url text;

alter table public.employee_profiles
  add column if not exists phone_extension text;

alter table public.employee_profiles
  add column if not exists meet_link text;

alter table public.employee_profiles
  add column if not exists campus_id uuid references public.campuses(id) on delete set null;

alter table public.employee_profiles
  add column if not exists directory_visible boolean not null default true;

alter table public.employee_profiles
  add column if not exists directory_sort_order integer not null default 0;

-- -----------------------------------------
-- SECURITY EVENTS
-- -----------------------------------------

create table if not exists public.platform_security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in (
      'failed_login', 'permission_change', 'role_assignment', 'role_removal',
      'impersonation_start', 'impersonation_end', 'export', 'sensitive_access',
      'org_assignment_change', 'school_config_change'
    )),
  user_id uuid references public.users(id) on delete set null,
  actor_user_id uuid references public.users(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  ip_address text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_security_events_type
  on public.platform_security_events(event_type, created_at desc);

create index if not exists idx_platform_security_events_user
  on public.platform_security_events(user_id, created_at desc);

-- -----------------------------------------
-- PERMISSION HELPERS (extends has_role — backward compatible)
-- -----------------------------------------

create or replace function public.user_role_ids(check_user_id uuid)
returns setof uuid
language sql
stable
as $$
  with recursive role_tree as (
    select r.id, r.parent_role_id
    from public.roles r
    join public.user_roles ur on ur.role_id = r.id
    where ur.user_id = check_user_id
    union
    select p.id, p.parent_role_id
    from public.roles p
    join role_tree rt on p.id = rt.parent_role_id
  )
  select id from role_tree;
$$;

create or replace function public.has_permission(permission_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return false;
  end if;

  if has_role('CEO') or has_role('FOUNDER') then
    return true;
  end if;

  if exists (
    select 1
    from public.user_role_ids(uid) rt
    join public.platform_role_permissions prp on prp.role_id = rt
    where prp.permission_key = has_permission.permission_key
      and prp.effect = 'deny'
  ) then
    return false;
  end if;

  return exists (
    select 1
    from public.user_role_ids(uid) rt
    join public.platform_role_permissions prp on prp.role_id = rt
    where prp.permission_key = has_permission.permission_key
      and prp.effect = 'allow'
  );
end;
$$;

create or replace function public.can_access_school(school_id uuid)
returns boolean
language sql
stable
as $$
  select
    has_role('CEO')
    or has_role('FOUNDER')
    or has_role('EXECUTIVE_DIRECTOR')
    or (
      (has_role('SCHOOL_LEADER') or has_role('TEACHER') or has_role('ADMISSIONS')
        or has_role('FINANCE') or has_role('HR') or has_role('REGISTRAR'))
      and (
        is_assigned_to_school(school_id)
        or exists (
          select 1 from public.user_org_assignments uoa
          where uoa.user_id = auth.uid() and uoa.school_id = can_access_school.school_id
        )
      )
    );
$$;

create or replace function public.user_can_access_school(check_user_id uuid, check_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = check_user_id
      and r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
  )
  or exists (
    select 1 from public.user_schools us
    where us.user_id = check_user_id and us.school_id = check_school_id
  )
  or exists (
    select 1 from public.user_org_assignments uoa
    where uoa.user_id = check_user_id and uoa.school_id = check_school_id
  );
$$;

notify pgrst, 'reload schema';
