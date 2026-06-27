-- =========================================
-- RELEASE 15.1: Enterprise Automation & Integration Platform (iPaaS)
-- Automation Studio, Command Center, Certification, Metering, DR
-- Extends Integration Hub — backward compatible
-- =========================================

-- Automation Studio
create table if not exists public.ihub_automation_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  workflow_key text not null,
  workflow_name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft','testing','published','archived')),
  version integer not null default 1,
  trigger_type text not null default 'event',
  steps jsonb not null default '[]'::jsonb,
  variables jsonb not null default '{}'::jsonb,
  is_template boolean not null default false,
  analytics jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, workflow_key, version)
);

create table if not exists public.ihub_automation_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.ihub_automation_workflows(id) on delete cascade,
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  status text not null default 'running'
    check (status in ('running','completed','failed','timeout','cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  step_results jsonb not null default '[]'::jsonb
);

-- Command Center snapshots
create table if not exists public.ihub_command_center_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  snapshot_at timestamptz not null default now(),
  connector_health_pct numeric(5,2) not null default 0,
  api_health_pct numeric(5,2) not null default 0,
  webhook_health_pct numeric(5,2) not null default 0,
  sync_queue_depth integer not null default 0,
  retry_queue_depth integer not null default 0,
  dead_letter_count integer not null default 0,
  daily_transactions integer not null default 0,
  hourly_transactions integer not null default 0,
  avg_latency_ms numeric(12,2) not null default 0,
  success_pct numeric(5,2) not null default 0,
  failure_pct numeric(5,2) not null default 0,
  storage_usage_mb numeric(12,2) not null default 0,
  bandwidth_usage_mb numeric(12,2) not null default 0,
  historical_uptime_pct numeric(5,2) not null default 99.9,
  details jsonb not null default '{}'::jsonb
);

-- Connector certification
create table if not exists public.ihub_connector_certifications (
  id uuid primary key default gen_random_uuid(),
  connector_key text not null references public.edp_connector_definitions(connector_key) on delete cascade,
  certification_status text not null default 'preview'
    check (certification_status in ('certified','verified','preview','beta','deprecated','unsupported')),
  reliability_score numeric(5,2) not null default 0,
  security_score numeric(5,2) not null default 0,
  performance_score numeric(5,2) not null default 0,
  health_rating numeric(3,2) not null default 0,
  marketplace_rating numeric(3,2) not null default 0,
  support_status text not null default 'community',
  version text not null default '1.0.0',
  compatibility jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (connector_key)
);

-- Tenant provisioning (iPaaS layer)
create table if not exists public.ihub_provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete set null,
  tenant_name text not null,
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed')),
  config_package text not null default 'enterprise',
  modules_installed jsonb not null default '[]'::jsonb,
  include_demo_data boolean not null default false,
  steps_completed jsonb not null default '[]'::jsonb,
  cloud_provisioning_job_id uuid,
  created_by uuid references public.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Usage metering
create table if not exists public.ihub_usage_metering (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  meter_date date not null default current_date,
  users_count integer not null default 0,
  students_count integer not null default 0,
  api_calls integer not null default 0,
  webhook_calls integer not null default 0,
  connector_executions integer not null default 0,
  sync_jobs integer not null default 0,
  workflow_runs integer not null default 0,
  automation_runs integer not null default 0,
  storage_mb numeric(12,2) not null default 0,
  bandwidth_mb numeric(12,2) not null default 0,
  subscription_limit jsonb not null default '{}'::jsonb,
  overages jsonb not null default '{}'::jsonb,
  forecast jsonb not null default '{}'::jsonb,
  unique (organization_id, meter_date)
);

-- Disaster recovery
create table if not exists public.ihub_dr_backups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  backup_type text not null default 'full_tenant'
    check (backup_type in ('full_tenant','point_in_time','sandbox','regional')),
  status text not null default 'pending'
    check (status in ('pending','running','completed','verified','failed')),
  storage_path text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ihub_dr_drills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  drill_type text not null default 'recovery_test',
  status text not null default 'scheduled'
    check (status in ('scheduled','running','passed','failed')),
  results jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Event bus extensions
create table if not exists public.ihub_event_retention_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  event_type text,
  retention_days integer not null default 90,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ihub_event_dead_letter (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  event_id uuid references public.ihub_events(id) on delete set null,
  event_type text not null,
  reason text,
  replayable boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_ihub_automation_workflows_org on public.ihub_automation_workflows(organization_id, status);
create index if not exists idx_ihub_automation_runs_workflow on public.ihub_automation_runs(workflow_id, started_at desc);
create index if not exists idx_ihub_usage_metering_org on public.ihub_usage_metering(organization_id, meter_date desc);

-- Seed workflow template
insert into public.ihub_automation_workflows (organization_id, workflow_key, workflow_name, description, status, is_template, trigger_type, steps)
select o.id, 'tuition_payment_received', 'Tuition Payment Received', 'Update Finance, Portal, Executive, send receipt and notifications', 'published', true, 'payment.received',
  '[{"type":"trigger","name":"Payment Received"},{"type":"action","name":"Update Finance"},{"type":"action","name":"Update Family Portal"},{"type":"action","name":"Update Executive Dashboard"},{"type":"action","name":"Send Receipt"},{"type":"action","name":"Send Parent Notification"},{"type":"action","name":"Notify School Leader"}]'::jsonb
from public.org_organizations o
limit 1
on conflict do nothing;

-- Seed connector certifications for key connectors
insert into public.ihub_connector_certifications (connector_key, certification_status, reliability_score, security_score, performance_score, health_rating, support_status, version)
values
  ('quickbooks_online', 'certified', 98, 97, 95, 4.8, 'enterprise', '1.0.0'),
  ('google_workspace', 'certified', 99, 98, 96, 4.9, 'enterprise', '1.0.0'),
  ('microsoft_365', 'certified', 98, 98, 95, 4.7, 'enterprise', '1.0.0'),
  ('clever', 'verified', 95, 96, 92, 4.5, 'standard', '1.0.0'),
  ('stripe', 'certified', 99, 99, 97, 4.9, 'enterprise', '1.0.0'),
  ('canvas', 'verified', 94, 95, 90, 4.4, 'standard', '1.0.0')
on conflict (connector_key) do nothing;

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('integration.operations', 'Integration Operations', 'Command center and operational monitoring', 'integration', 'integration_hub', 806),
  ('integration.security', 'Integration Security', 'Credential vault, rotation, and security admin', 'integration', 'integration_hub', 807)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
  and p.permission_key in ('integration.operations', 'integration.security')
on conflict do nothing;
