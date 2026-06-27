-- =========================================
-- RELEASE 15.2: AcademyOS Operations Platform
-- Enterprise Operations & SaaS Management
-- Extends Cloud Platform — backward compatible
-- =========================================

create table if not exists public.ops_executive_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  organizations_count integer not null default 0,
  students_managed integer not null default 0,
  employees_managed integer not null default 0,
  mrr numeric(14,2) not null default 0,
  arr numeric(14,2) not null default 0,
  churn_pct numeric(5,2) not null default 0,
  renewals_due integer not null default 0,
  platform_health_pct numeric(5,2) not null default 99.9,
  support_health_pct numeric(5,2) not null default 95,
  customer_health_pct numeric(5,2) not null default 90,
  marketplace_revenue numeric(14,2) not null default 0,
  implementation_pipeline integer not null default 0,
  forecast_mrr numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (snapshot_date)
);

create table if not exists public.ops_customer_health_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cloud_customers(id) on delete cascade,
  profile_date date not null default current_date,
  health_score numeric(5,2) not null default 100,
  risk_score numeric(5,2) not null default 0,
  adoption_score numeric(5,2) not null default 0,
  training_score numeric(5,2) not null default 0,
  implementation_progress_pct numeric(5,2) not null default 0,
  support_satisfaction numeric(5,2) not null default 0,
  renewal_probability_pct numeric(5,2) not null default 0,
  expansion_opportunity_pct numeric(5,2) not null default 0,
  recommended_actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (customer_id, profile_date)
);

create table if not exists public.ops_revenue_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  mrr numeric(14,2) not null default 0,
  arr numeric(14,2) not null default 0,
  revenue_growth_pct numeric(5,2) not null default 0,
  customer_lifetime_value numeric(14,2) not null default 0,
  customer_acquisition_cost numeric(14,2) not null default 0,
  net_revenue_retention_pct numeric(5,2) not null default 100,
  gross_revenue_retention_pct numeric(5,2) not null default 100,
  expansion_revenue numeric(14,2) not null default 0,
  marketplace_revenue numeric(14,2) not null default 0,
  professional_services_revenue numeric(14,2) not null default 0,
  implementation_revenue numeric(14,2) not null default 0,
  training_revenue numeric(14,2) not null default 0,
  support_revenue numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (snapshot_date)
);

create table if not exists public.ops_platform_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_at timestamptz not null default now(),
  platform_uptime_pct numeric(5,2) not null default 99.9,
  api_uptime_pct numeric(5,2) not null default 99.9,
  database_health text not null default 'healthy',
  queue_health text not null default 'healthy',
  storage_used_gb numeric(12,2) not null default 0,
  bandwidth_used_gb numeric(12,2) not null default 0,
  cpu_usage_pct numeric(5,2) not null default 0,
  memory_usage_pct numeric(5,2) not null default 0,
  avg_response_ms numeric(12,2) not null default 0,
  regional_health jsonb not null default '{}'::jsonb,
  active_users integer not null default 0,
  concurrent_users integer not null default 0,
  organizations_online integer not null default 0
);

create table if not exists public.ops_security_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  security_score numeric(5,2) not null default 95,
  threat_alerts integer not null default 0,
  suspicious_logins integer not null default 0,
  permission_escalations integer not null default 0,
  credential_rotations_due integer not null default 0,
  api_abuse_events integer not null default 0,
  ddos_readiness_pct numeric(5,2) not null default 98,
  audit_reviews_pending integer not null default 0,
  encryption_health_pct numeric(5,2) not null default 100,
  created_at timestamptz not null default now(),
  unique (snapshot_date)
);

create table if not exists public.ops_support_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  open_tickets integer not null default 0,
  escalations integer not null default 0,
  sla_breaches integer not null default 0,
  avg_response_minutes numeric(12,2) not null default 0,
  avg_resolution_hours numeric(12,2) not null default 0,
  customer_satisfaction numeric(5,2) not null default 0,
  support_load_pct numeric(5,2) not null default 0,
  knowledge_articles integer not null default 0,
  created_at timestamptz not null default now(),
  unique (snapshot_date)
);

create table if not exists public.ops_deployment_rollouts (
  id uuid primary key default gen_random_uuid(),
  release_version text not null,
  deployment_strategy text not null default 'rolling'
    check (deployment_strategy in ('rolling','blue_green','canary','regional')),
  status text not null default 'pending'
    check (status in ('pending','deploying','active','rolled_back','failed')),
  feature_flags jsonb not null default '[]'::jsonb,
  regions jsonb not null default '[]'::jsonb,
  maintenance_window jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ops_partners (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  partner_type text not null default 'implementation'
    check (partner_type in ('implementation','technology','marketplace_developer','state_consultant','training_provider')),
  certification_status text not null default 'pending'
    check (certification_status in ('pending','certified','premium','suspended')),
  revenue_share_pct numeric(5,2) not null default 0,
  performance_score numeric(5,2) not null default 0,
  total_revenue numeric(14,2) not null default 0,
  active_customers integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ops_university_courses (
  id uuid primary key default gen_random_uuid(),
  course_key text not null unique,
  course_name text not null,
  role_path text not null,
  is_required boolean not null default false,
  certification_credits integer not null default 1,
  renewal_months integer not null default 12,
  sort_order integer not null default 0
);

create table if not exists public.ops_university_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  course_id uuid not null references public.ops_university_courses(id) on delete cascade,
  status text not null default 'enrolled'
    check (status in ('enrolled','in_progress','completed','expired')),
  progress_pct numeric(5,2) not null default 0,
  certified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ops_marketplace_business (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  paid_modules integer not null default 0,
  active_subscriptions integer not null default 0,
  revenue_sharing_total numeric(14,2) not null default 0,
  developer_payments numeric(14,2) not null default 0,
  total_downloads integer not null default 0,
  avg_rating numeric(3,2) not null default 0,
  top_modules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_date)
);

create table if not exists public.ops_backup_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete set null,
  backup_type text not null default 'full_tenant',
  status text not null default 'completed'
    check (status in ('pending','running','completed','verified','failed')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ops_customer_health_customer on public.ops_customer_health_profiles(customer_id, profile_date desc);
create index if not exists idx_ops_platform_snapshots_at on public.ops_platform_snapshots(snapshot_at desc);

-- Seed university courses
insert into public.ops_university_courses (course_key, course_name, role_path, is_required, sort_order)
values
  ('founder_basics', 'AcademyOS for Founders', 'founder', true, 1),
  ('ceo_operations', 'CEO Operations Dashboard', 'ceo', true, 2),
  ('school_leader_setup', 'School Leader Setup', 'school_leader', true, 3),
  ('admissions_mastery', 'Admissions Mastery', 'admissions', true, 4),
  ('finance_operations', 'Finance Operations', 'finance', true, 5),
  ('hr_workforce', 'HR & Workforce', 'hr', false, 6),
  ('teacher_workspace', 'Teacher Workspace', 'teacher', true, 7),
  ('therapist_documentation', 'Therapist Documentation', 'therapist', false, 8),
  ('parent_portal', 'Parent Portal Guide', 'parent', false, 9),
  ('board_governance', 'Board Governance', 'board_member', false, 10)
on conflict (course_key) do nothing;

-- Seed partners
insert into public.ops_partners (partner_name, partner_type, certification_status, performance_score, revenue_share_pct)
values
  ('EduTech Implementations', 'implementation', 'certified', 92, 15),
  ('State Funding Consultants LLC', 'state_consultant', 'premium', 95, 20),
  ('AcademyOS Marketplace Dev Co', 'marketplace_developer', 'certified', 88, 30)
on conflict do nothing;

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('operations.view', 'Operations View', 'View AcademyOS Operations Center', 'operations', 'operations', 900),
  ('operations.manage', 'Operations Manage', 'Manage platform operations', 'operations', 'operations', 901),
  ('operations.executive', 'Operations Executive', 'Executive operations dashboard', 'operations', 'operations', 902),
  ('operations.security', 'Operations Security', 'Security operations center', 'operations', 'operations', 903),
  ('operations.support', 'Operations Support', 'Support operations center', 'operations', 'operations', 904),
  ('operations.billing', 'Operations Billing', 'Billing and revenue operations', 'operations', 'operations', 905),
  ('operations.analytics', 'Operations Analytics', 'Platform analytics', 'operations', 'operations', 906),
  ('operations.partners', 'Operations Partners', 'Partner platform management', 'operations', 'operations', 907)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
  and p.permission_key like 'operations.%'
on conflict do nothing;
