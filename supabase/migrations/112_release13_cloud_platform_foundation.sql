-- =========================================
-- RELEASE 13: ACADEMYOS CLOUD PLATFORM (Commercial SaaS)
-- Cloud Console — AcademyOS employees only
-- =========================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Customers & metrics
-- ---------------------------------------------------------------------------

create table if not exists public.cloud_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete set null,
  customer_name text not null,
  customer_slug text not null unique,
  status text not null default 'active'
    check (status in ('trial','active','suspended','churned','onboarding')),
  support_tier text not null default 'standard'
    check (support_tier in ('standard','priority','enterprise')),
  health_score numeric(5,2) not null default 100,
  risk_level text not null default 'low'
    check (risk_level in ('low','medium','high','critical')),
  customer_success_manager text,
  training_status text not null default 'not_started'
    check (training_status in ('not_started','in_progress','completed')),
  implementation_status text not null default 'pending'
    check (implementation_status in ('pending','in_progress','completed')),
  go_live_status text not null default 'not_started'
    check (go_live_status in ('not_started','scheduled','live')),
  student_count integer not null default 0,
  employee_count integer not null default 0,
  storage_used_bytes bigint not null default 0,
  api_usage_count integer not null default 0,
  modules_enabled jsonb not null default '[]'::jsonb,
  renewal_date date,
  is_white_label boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Subscription plans & subscriptions
-- ---------------------------------------------------------------------------

create table if not exists public.cloud_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  display_name text not null,
  description text,
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly','annual','custom')),
  base_price_usd numeric(12,2) not null default 0,
  student_price_usd numeric(12,4),
  is_usage_based boolean not null default false,
  included_modules jsonb not null default '[]'::jsonb,
  storage_limit_gb integer,
  api_limit_per_month integer,
  sort_order integer not null default 0
);

create table if not exists public.cloud_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cloud_customers(id) on delete cascade,
  plan_key text not null references public.cloud_subscription_plans(plan_key),
  status text not null default 'active'
    check (status in ('trial','active','past_due','cancelled','expired')),
  billing_cycle text not null default 'monthly',
  monthly_amount_usd numeric(12,2) not null default 0,
  student_limit integer,
  staff_limit integer,
  storage_limit_gb integer,
  api_limit_per_month integer,
  trial_ends_at timestamptz,
  current_period_start date,
  current_period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Licensing
-- ---------------------------------------------------------------------------

create table if not exists public.cloud_licenses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cloud_customers(id) on delete cascade,
  subscription_id uuid references public.cloud_subscriptions(id) on delete set null,
  license_key text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  licensed_modules jsonb not null default '[]'::jsonb,
  student_limit integer,
  staff_limit integer,
  storage_limit_gb integer,
  api_limit_per_month integer,
  feature_limits jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  renewed_at timestamptz,
  status text not null default 'active'
    check (status in ('active','expired','suspended','revoked')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Contracts & billing
-- ---------------------------------------------------------------------------

create table if not exists public.cloud_contracts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cloud_customers(id) on delete cascade,
  contract_number text not null unique,
  contract_type text not null default 'subscription',
  start_date date not null,
  end_date date,
  total_value_usd numeric(14,2),
  status text not null default 'active'
    check (status in ('draft','active','expired','terminated')),
  terms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cloud_invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cloud_customers(id) on delete cascade,
  subscription_id uuid references public.cloud_subscriptions(id) on delete set null,
  invoice_number text not null unique,
  amount_usd numeric(12,2) not null,
  status text not null default 'draft'
    check (status in ('draft','sent','paid','overdue','void','refunded')),
  due_date date,
  paid_at timestamptz,
  line_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Provisioning & onboarding
-- ---------------------------------------------------------------------------

create table if not exists public.cloud_provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.cloud_customers(id) on delete set null,
  blueprint_key text not null default 'standard',
  target_org_name text not null,
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed')),
  progress_pct integer not null default 0,
  provisioned_organization_id uuid references public.org_organizations(id) on delete set null,
  result_summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cloud_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cloud_customers(id) on delete cascade,
  current_step text not null default 'welcome',
  status text not null default 'in_progress'
    check (status in ('in_progress','completed','paused')),
  checklist jsonb not null default '[]'::jsonb,
  assigned_to uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Support desk
-- ---------------------------------------------------------------------------

create table if not exists public.cloud_support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cloud_customers(id) on delete cascade,
  ticket_number text not null unique,
  subject text not null,
  description text,
  ticket_type text not null default 'support'
    check (ticket_type in ('support','bug','feature_request','escalation')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  status text not null default 'open'
    check (status in ('open','in_progress','waiting','resolved','closed')),
  assigned_to uuid references public.users(id) on delete set null,
  internal_notes jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  knowledge_base_links jsonb not null default '[]'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. Customer success & analytics
-- ---------------------------------------------------------------------------

create table if not exists public.cloud_customer_success_snapshots (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cloud_customers(id) on delete cascade,
  snapshot_date date not null default current_date,
  health_score numeric(5,2) not null default 0,
  platform_adoption_pct numeric(5,2) not null default 0,
  active_users integer not null default 0,
  inactive_users integer not null default 0,
  training_completion_pct numeric(5,2) not null default 0,
  open_tickets integer not null default 0,
  renewal_probability_pct numeric(5,2),
  feature_adoption jsonb not null default '{}'::jsonb,
  implementation_progress_pct numeric(5,2) not null default 0,
  risk_indicators jsonb not null default '[]'::jsonb,
  unique (customer_id, snapshot_date)
);

create table if not exists public.cloud_usage_analytics (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.cloud_customers(id) on delete cascade,
  organization_id uuid references public.org_organizations(id) on delete cascade,
  metric_date date not null default current_date,
  daily_active_users integer not null default 0,
  monthly_active_users integer not null default 0,
  module_usage jsonb not null default '{}'::jsonb,
  storage_bytes bigint not null default 0,
  import_count integer not null default 0,
  export_count integer not null default 0,
  workflow_executions integer not null default 0,
  automation_volume integer not null default 0,
  unique (customer_id, metric_date)
);

create table if not exists public.cloud_product_analytics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null default current_date,
  feature_key text not null,
  usage_count integer not null default 0,
  unique_users integer not null default 0,
  avg_session_seconds integer,
  usage_by_role jsonb not null default '{}'::jsonb,
  usage_by_device jsonb not null default '{}'::jsonb,
  unique (metric_date, feature_key)
);

-- ---------------------------------------------------------------------------
-- 8. Platform health, releases, feature flags
-- ---------------------------------------------------------------------------

create table if not exists public.cloud_platform_health (
  id uuid primary key default gen_random_uuid(),
  snapshot_at timestamptz not null default now(),
  api_health text not null default 'healthy',
  database_health text not null default 'healthy',
  queue_health text not null default 'healthy',
  email_delivery_health text not null default 'healthy',
  webhook_health text not null default 'healthy',
  auth_health text not null default 'healthy',
  error_rate_pct numeric(5,4) not null default 0,
  avg_latency_ms integer not null default 0,
  metrics jsonb not null default '{}'::jsonb
);

create table if not exists public.cloud_releases (
  id uuid primary key default gen_random_uuid(),
  release_version text not null unique,
  release_type text not null default 'minor'
    check (release_type in ('major','minor','patch','hotfix','beta')),
  status text not null default 'planned'
    check (status in ('planned','beta','pilot','released','rolled_back')),
  release_notes text,
  deployment_window_start timestamptz,
  deployment_window_end timestamptz,
  pilot_customer_ids jsonb not null default '[]'::jsonb,
  rollback_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create table if not exists public.cloud_feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null unique,
  display_name text not null,
  description text,
  scope_type text not null default 'global'
    check (scope_type in ('global','organization','school','subscription','beta','internal')),
  scope_id uuid,
  is_enabled boolean not null default false,
  is_beta boolean not null default false,
  is_internal_only boolean not null default false,
  ab_test_ready boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 9. Incidents, deployments, marketplace, white-label
-- ---------------------------------------------------------------------------

create table if not exists public.cloud_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_number text not null unique,
  title text not null,
  severity text not null default 'minor'
    check (severity in ('minor','major','critical')),
  status text not null default 'investigating'
    check (status in ('investigating','identified','monitoring','resolved')),
  affected_customers jsonb not null default '[]'::jsonb,
  root_cause text,
  communications jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  post_incident_review jsonb,
  started_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.cloud_deployments (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('production','staging','testing')),
  release_id uuid references public.cloud_releases(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','approved','running','completed','failed','rolled_back')),
  approved_by uuid references public.users(id) on delete set null,
  deployed_by uuid references public.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  rollback_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cloud_marketplace_modules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  display_name text not null,
  description text,
  version text not null default '1.0.0',
  dependencies jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  billing_addon_usd numeric(12,2),
  sort_order integer not null default 0
);

create table if not exists public.cloud_marketplace_installations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cloud_customers(id) on delete cascade,
  module_key text not null references public.cloud_marketplace_modules(module_key),
  version text not null,
  status text not null default 'installed'
    check (status in ('installed','disabled','pending_upgrade')),
  installed_at timestamptz not null default now(),
  unique (customer_id, module_key)
);

create table if not exists public.cloud_white_label_settings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cloud_customers(id) on delete cascade unique,
  custom_logo_url text,
  primary_color text,
  secondary_color text,
  custom_domain text,
  email_branding jsonb not null default '{}'::jsonb,
  login_page_config jsonb not null default '{}'::jsonb,
  certificate_config jsonb not null default '{}'::jsonb,
  report_branding jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.cloud_system_status (
  id uuid primary key default gen_random_uuid(),
  component_key text not null unique,
  display_name text not null,
  status text not null default 'operational'
    check (status in ('operational','degraded','partial_outage','major_outage','maintenance')),
  uptime_pct numeric(5,2) not null default 100,
  last_incident_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.cloud_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  customer_id uuid references public.cloud_customers(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10. Triggers & views
-- ---------------------------------------------------------------------------

drop trigger if exists cloud_customers_set_updated_at on public.cloud_customers;
create trigger cloud_customers_set_updated_at
  before update on public.cloud_customers
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists cloud_subscriptions_set_updated_at on public.cloud_subscriptions;
create trigger cloud_subscriptions_set_updated_at
  before update on public.cloud_subscriptions
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists cloud_support_tickets_set_updated_at on public.cloud_support_tickets;
create trigger cloud_support_tickets_set_updated_at
  before update on public.cloud_support_tickets
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists cloud_feature_flags_set_updated_at on public.cloud_feature_flags;
create trigger cloud_feature_flags_set_updated_at
  before update on public.cloud_feature_flags
  for each row execute function public.trigger_set_updated_at();

create or replace view public.rpt_cloud_customer_summary as
select
  c.id,
  c.customer_name,
  c.status,
  c.health_score,
  c.risk_level,
  c.student_count,
  s.plan_key,
  s.status as subscription_status,
  c.renewal_date
from public.cloud_customers c
left join public.cloud_subscriptions s on s.customer_id = c.id and s.status in ('trial','active');

create or replace view public.rpt_cloud_mrr as
select
  date_trunc('month', current_date) as month,
  sum(monthly_amount_usd) as total_mrr
from public.cloud_subscriptions
where status in ('active','trial');

grant select on public.rpt_cloud_customer_summary to authenticated;
grant select on public.rpt_cloud_mrr to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Seed data
-- ---------------------------------------------------------------------------

insert into public.cloud_subscription_plans (plan_key, display_name, billing_cycle, base_price_usd, student_price_usd, storage_limit_gb, api_limit_per_month, sort_order)
values
  ('free_trial', 'Free Trial', 'monthly', 0, 0, 5, 1000, 10),
  ('starter', 'Starter', 'monthly', 299, 2, 25, 10000, 20),
  ('professional', 'Professional', 'monthly', 799, 1.5, 100, 50000, 30),
  ('enterprise', 'Enterprise', 'annual', 0, 0, 500, 500000, 40),
  ('custom', 'Custom', 'custom', 0, 0, null, null, 50)
on conflict (plan_key) do nothing;

insert into public.cloud_system_status (component_key, display_name, status, uptime_pct)
values
  ('api', 'API', 'operational', 99.99),
  ('database', 'Database', 'operational', 99.99),
  ('authentication', 'Authentication', 'operational', 99.98),
  ('email', 'Email Delivery', 'operational', 99.95),
  ('webhooks', 'Webhooks', 'operational', 99.90)
on conflict (component_key) do nothing;

insert into public.cloud_marketplace_modules (module_key, display_name, version, is_published, sort_order)
values
  ('admissions_pro', 'Admissions Pro', '1.0.0', true, 10),
  ('financial_intelligence', 'Financial Intelligence', '1.0.0', true, 20),
  ('executive_decisions', 'Executive Decision Intelligence', '1.0.0', true, 30),
  ('work_management', 'Work Management', '1.0.0', true, 40)
on conflict (module_key) do nothing;

-- ---------------------------------------------------------------------------
-- 12. Permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('cloud.admin', 'Cloud Admin', 'Full Cloud Console administration', 'cloud', 'cloud_platform', 600),
  ('cloud.support', 'Cloud Support', 'Support desk and customer tickets', 'cloud', 'cloud_platform', 601),
  ('cloud.operations', 'Cloud Operations', 'Platform health and deployments', 'cloud', 'cloud_platform', 602),
  ('cloud.sales', 'Cloud Sales', 'Customers and contracts', 'cloud', 'cloud_platform', 603),
  ('cloud.finance', 'Cloud Finance', 'Billing and invoices', 'cloud', 'cloud_platform', 604),
  ('cloud.engineering', 'Cloud Engineering', 'Releases and feature flags', 'cloud', 'cloud_platform', 605),
  ('cloud.analytics', 'Cloud Analytics', 'Usage and product analytics', 'cloud', 'cloud_platform', 606)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER')
  and p.permission_key like 'cloud.%'
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name = 'EXECUTIVE_DIRECTOR'
  and p.permission_key in ('cloud.support','cloud.analytics','cloud.operations')
on conflict do nothing;
