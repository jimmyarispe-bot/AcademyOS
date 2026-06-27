-- =========================================
-- RELEASE 14: VERSION 1.0 CERTIFICATION & LAUNCH READINESS
-- Certification Center — validate, document, certify
-- =========================================

-- ---------------------------------------------------------------------------
-- 1. Certification runs & workflow tests
-- ---------------------------------------------------------------------------

create table if not exists public.cert_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  run_type text not null default 'full'
    check (run_type in ('full','e2e','security','performance','nightly','manual')),
  status text not null default 'running'
    check (status in ('running','completed','failed')),
  overall_score numeric(5,2),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  triggered_by uuid references public.users(id) on delete set null,
  summary jsonb not null default '{}'::jsonb
);

create table if not exists public.cert_workflow_tests (
  id uuid primary key default gen_random_uuid(),
  cert_run_id uuid references public.cert_runs(id) on delete cascade,
  workflow_key text not null,
  workflow_name text not null,
  status text not null default 'pending'
    check (status in ('pass','warning','failure','pending','skipped')),
  execution_time_ms integer,
  evidence jsonb not null default '{}'::jsonb,
  message text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Security, performance, accessibility, mobile
-- ---------------------------------------------------------------------------

create table if not exists public.cert_security_checks (
  id uuid primary key default gen_random_uuid(),
  cert_run_id uuid references public.cert_runs(id) on delete cascade,
  check_key text not null,
  check_name text not null,
  status text not null check (status in ('pass','warning','failure')),
  score numeric(5,2),
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cert_performance_metrics (
  id uuid primary key default gen_random_uuid(),
  cert_run_id uuid references public.cert_runs(id) on delete cascade,
  metric_key text not null,
  metric_name text not null,
  value_ms numeric(12,2),
  threshold_ms numeric(12,2),
  status text not null check (status in ('pass','warning','failure')),
  recommendation text,
  created_at timestamptz not null default now()
);

create table if not exists public.cert_accessibility_checks (
  id uuid primary key default gen_random_uuid(),
  cert_run_id uuid references public.cert_runs(id) on delete cascade,
  wcag_criterion text not null,
  check_name text not null,
  status text not null check (status in ('pass','warning','failure')),
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cert_mobile_checks (
  id uuid primary key default gen_random_uuid(),
  cert_run_id uuid references public.cert_runs(id) on delete cascade,
  viewport_key text not null,
  device_type text not null,
  orientation text not null default 'portrait',
  status text not null check (status in ('pass','warning','failure')),
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Integrations & disaster recovery
-- ---------------------------------------------------------------------------

create table if not exists public.cert_integration_health (
  id uuid primary key default gen_random_uuid(),
  cert_run_id uuid references public.cert_runs(id) on delete cascade,
  integration_key text not null,
  integration_name text not null,
  status text not null check (status in ('healthy','warning','failure')),
  last_checked_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.cert_dr_tests (
  id uuid primary key default gen_random_uuid(),
  cert_run_id uuid references public.cert_runs(id) on delete cascade,
  test_key text not null,
  test_name text not null,
  status text not null check (status in ('pass','warning','failure')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Documentation & university
-- ---------------------------------------------------------------------------

create table if not exists public.cert_documentation (
  id uuid primary key default gen_random_uuid(),
  doc_key text not null unique,
  doc_title text not null,
  doc_category text not null
    check (doc_category in (
      'administrator','teacher','parent','student','finance','hr','executive',
      'cloud','developer','api','release_notes','changelog'
    )),
  content_md text,
  version text not null default '1.0',
  auto_generated boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.cert_university_paths (
  id uuid primary key default gen_random_uuid(),
  path_key text not null unique,
  path_title text not null,
  target_role text not null,
  modules jsonb not null default '[]'::jsonb,
  estimated_minutes integer not null default 30,
  sort_order integer not null default 0
);

create table if not exists public.cert_university_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  path_key text not null references public.cert_university_paths(path_key),
  progress_pct integer not null default 0,
  completed_modules jsonb not null default '[]'::jsonb,
  certificate_issued_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, path_key)
);

-- ---------------------------------------------------------------------------
-- 5. Demo environments & readiness
-- ---------------------------------------------------------------------------

create table if not exists public.cert_demo_environments (
  id uuid primary key default gen_random_uuid(),
  demo_name text not null,
  organization_id uuid references public.org_organizations(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','generating','ready','expired')),
  artifact_summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cert_readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  snapshot_date date not null default current_date,
  overall_score numeric(5,2) not null default 0,
  security_score numeric(5,2) not null default 0,
  performance_score numeric(5,2) not null default 0,
  accessibility_score numeric(5,2) not null default 0,
  mobile_score numeric(5,2) not null default 0,
  testing_score numeric(5,2) not null default 0,
  integration_score numeric(5,2) not null default 0,
  documentation_score numeric(5,2) not null default 0,
  dr_score numeric(5,2) not null default 0,
  cloud_score numeric(5,2) not null default 0,
  training_score numeric(5,2) not null default 0,
  is_v1_certified boolean not null default false,
  domain_scores jsonb not null default '{}'::jsonb,
  unique (organization_id, snapshot_date)
);

create table if not exists public.cert_health_scans (
  id uuid primary key default gen_random_uuid(),
  scan_date date not null default current_date,
  domain text not null
    check (domain in ('platform','schools','finance','compliance','automation','scheduling','ssis','cloud')),
  health_score numeric(5,2) not null default 0,
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (scan_date, domain)
);

create index if not exists idx_cert_runs_org on public.cert_runs(organization_id, started_at desc);
create index if not exists idx_cert_workflow_tests_run on public.cert_workflow_tests(cert_run_id);

-- ---------------------------------------------------------------------------
-- 6. Views
-- ---------------------------------------------------------------------------

create or replace view public.rpt_cert_readiness_summary as
select
  organization_id,
  snapshot_date,
  overall_score,
  is_v1_certified,
  security_score + performance_score + accessibility_score as quality_avg
from public.cert_readiness_snapshots
order by snapshot_date desc;

grant select on public.rpt_cert_readiness_summary to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Seed documentation & university paths
-- ---------------------------------------------------------------------------

insert into public.cert_documentation (doc_key, doc_title, doc_category, content_md)
values
  ('admin_guide', 'Administrator Guide', 'administrator', '# Administrator Guide\n\nAcademyOS enterprise administration.'),
  ('teacher_guide', 'Teacher Guide', 'teacher', '# Teacher Guide\n\nDaily instructional workspace.'),
  ('parent_guide', 'Parent Guide', 'parent', '# Parent Guide\n\nParent portal usage.'),
  ('finance_guide', 'Finance Guide', 'finance', '# Finance Guide\n\nBilling and scholarships.'),
  ('cloud_ops_guide', 'Cloud Operations Guide', 'cloud', '# Cloud Operations Guide\n\nAcademyOS Cloud Console.'),
  ('developer_guide', 'Developer Guide', 'developer', '# Developer Guide\n\nAPI and integration architecture.'),
  ('release_notes_v1', 'Release Notes v1.0', 'release_notes', '# AcademyOS v1.0 Release Notes')
on conflict (doc_key) do nothing;

insert into public.cert_university_paths (path_key, path_title, target_role, modules, estimated_minutes, sort_order)
values
  ('founder', 'Founder Path', 'FOUNDER', '["platform_overview","executive_intelligence","cloud_console"]', 60, 10),
  ('school_leader', 'School Leader Path', 'SCHOOL_LEADER', '["admissions","ssis","scheduling","compliance"]', 45, 20),
  ('teacher', 'Teacher Path', 'TEACHER', '["teacher_workspace","attendance","progress"]', 30, 30),
  ('finance', 'Finance Path', 'FINANCE', '["billing","scholarships","state_funding"]', 40, 40),
  ('cloud_ops', 'Cloud Operations Path', 'CLOUD_OPS', '["customers","provisioning","support"]', 50, 50)
on conflict (path_key) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('certification.view', 'Certification View', 'View certification center and readiness scores', 'certification', 'certification', 700),
  ('certification.manage', 'Certification Manage', 'Run certification scans and manage documentation', 'certification', 'certification', 701),
  ('certification.admin', 'Certification Admin', 'Full certification center administration', 'certification', 'certification', 702)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
  and p.permission_key in ('certification.view', 'certification.manage', 'certification.admin')
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name = 'SCHOOL_LEADER'
  and p.permission_key in ('certification.view')
on conflict do nothing;
