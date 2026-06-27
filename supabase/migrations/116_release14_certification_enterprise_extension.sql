-- =========================================
-- RELEASE 14.1: Enterprise Certification Center extensions
-- Scalability, PWA, bugs, support readiness, health reports
-- =========================================

alter table public.cert_workflow_tests
  add column if not exists errors jsonb not null default '[]'::jsonb,
  add column if not exists last_success_at timestamptz;

alter table public.cert_readiness_snapshots
  add column if not exists pwa_score numeric(5,2) not null default 0,
  add column if not exists support_score numeric(5,2) not null default 0,
  add column if not exists operational_score numeric(5,2) not null default 0;

alter table public.cert_security_checks
  add column if not exists recommendations jsonb not null default '[]'::jsonb,
  add column if not exists is_critical boolean not null default false;

alter table public.cert_documentation drop constraint if exists cert_documentation_doc_category_check;
alter table public.cert_documentation add constraint cert_documentation_doc_category_check
  check (doc_category in (
    'administrator','teacher','parent','student','finance','hr','executive','support',
    'cloud','developer','api','release_notes','changelog'
  ));

alter table public.cert_health_scans drop constraint if exists cert_health_scans_domain_check;
alter table public.cert_health_scans add constraint cert_health_scans_domain_check
  check (domain in (
    'platform','schools','finance','compliance','automation','scheduling','ssis','cloud',
    'admissions','teacher_workspace','hr','mission_control','enterprise_data'
  ));

create table if not exists public.cert_scalability_tests (
  id uuid primary key default gen_random_uuid(),
  cert_run_id uuid references public.cert_runs(id) on delete cascade,
  user_count integer not null,
  response_time_ms numeric(12,2),
  db_load_pct numeric(5,2),
  queue_load_pct numeric(5,2),
  memory_mb numeric(12,2),
  storage_growth_mb numeric(12,2),
  status text not null check (status in ('pass','warning','failure')),
  created_at timestamptz not null default now()
);

create table if not exists public.cert_pwa_checks (
  id uuid primary key default gen_random_uuid(),
  cert_run_id uuid references public.cert_runs(id) on delete cascade,
  check_key text not null,
  check_name text not null,
  status text not null check (status in ('pass','warning','failure')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cert_bugs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  title text not null,
  description text,
  severity text not null default 'medium'
    check (severity in ('critical','high','medium','low')),
  status text not null default 'open'
    check (status in ('open','regression','resolved','verified')),
  affected_module text not null,
  assigned_engineer text,
  release_fixed text,
  verification_status text default 'pending'
    check (verification_status in ('pending','verified','failed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.cert_support_readiness (
  id uuid primary key default gen_random_uuid(),
  cert_run_id uuid references public.cert_runs(id) on delete cascade,
  check_key text not null,
  check_name text not null,
  status text not null check (status in ('pass','warning','failure')),
  score numeric(5,2),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cert_health_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  report_type text not null check (report_type in ('daily','weekly','monthly')),
  report_date date not null default current_date,
  health_score numeric(5,2) not null default 0,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, report_type, report_date)
);

create index if not exists idx_cert_scalability_run on public.cert_scalability_tests(cert_run_id);
create index if not exists idx_cert_bugs_org on public.cert_bugs(organization_id, status);

insert into public.cert_documentation (doc_key, doc_title, doc_category, content_md)
values ('support_guide', 'Support Guide', 'support', '# Support Guide\n\nCustomer support workflows and escalation.')
on conflict (doc_key) do nothing;

insert into public.cert_university_paths (path_key, path_title, target_role, modules, estimated_minutes, sort_order)
values
  ('ceo', 'CEO Path', 'CEO', '["executive_dashboard","decision_intelligence","launch_readiness"]', 45, 5),
  ('executive_director', 'Executive Director Path', 'EXECUTIVE_DIRECTOR', '["compliance","mission_control","reporting"]', 50, 15),
  ('admissions', 'Admissions Path', 'ADMISSIONS', '["leads","enrollment","communications"]', 35, 25),
  ('registrar', 'Registrar Path', 'REGISTRAR', '["enrollment","ssis","records"]', 40, 28),
  ('hr', 'HR Path', 'HR', '["employees","payroll","compliance"]', 40, 35),
  ('therapist', 'Therapist Path', 'THERAPIST', '["iep","medical","progress"]', 35, 38),
  ('parent', 'Parent Path', 'PARENT', '["portal","finance","communications"]', 25, 42),
  ('student', 'Student Path', 'STUDENT', '["schedule","progress","portfolio"]', 20, 45),
  ('cloud_support', 'Cloud Support Path', 'CLOUD_SUPPORT', '["customers","tickets","onboarding"]', 55, 52),
  ('engineering', 'Engineering Path', 'ENGINEERING', '["api","integrations","certification"]', 60, 55)
on conflict (path_key) do nothing;
