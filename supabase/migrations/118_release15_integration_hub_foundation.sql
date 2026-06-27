-- =========================================
-- RELEASE 15: INTEGRATION HUB & OPEN PLATFORM
-- Event bus, API gateway, developer portal, marketplace-ready connectors
-- Extends Enterprise Data Platform (does not replace)
-- =========================================

-- ---------------------------------------------------------------------------
-- 1. Event bus
-- ---------------------------------------------------------------------------

create table if not exists public.ihub_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  event_type text not null,
  event_source text not null,
  payload jsonb not null default '{}'::jsonb,
  correlation_id uuid,
  replayable boolean not null default true,
  published_at timestamptz not null default now()
);

create table if not exists public.ihub_event_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  subscription_name text not null,
  event_types jsonb not null default '[]'::jsonb,
  target_type text not null check (target_type in ('webhook','connector','internal')),
  target_ref uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, subscription_name)
);

-- ---------------------------------------------------------------------------
-- 2. OAuth, API audit, sync conflicts
-- ---------------------------------------------------------------------------

create table if not exists public.ihub_oauth_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  client_name text not null,
  client_id text not null unique,
  client_secret_hash text not null,
  redirect_uris jsonb not null default '[]'::jsonb,
  scopes jsonb not null default '[]'::jsonb,
  grant_types jsonb not null default '["authorization_code","client_credentials"]'::jsonb,
  api_version text not null default 'v1',
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ihub_api_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  api_version text not null default 'v1',
  method text not null,
  path text not null,
  auth_type text check (auth_type in ('api_key','oauth','sandbox')),
  status_code integer,
  latency_ms integer,
  rate_limited boolean not null default false,
  actor_id uuid references public.users(id) on delete set null,
  request_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.ihub_sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  sync_job_id uuid references public.edp_sync_jobs(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  field_name text not null,
  local_value jsonb,
  remote_value jsonb,
  resolution text check (resolution in ('local_wins','remote_wins','merged','pending')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ihub_sync_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  connector_instance_id uuid references public.edp_connector_instances(id) on delete cascade,
  schedule_name text not null,
  cron_expression text not null default '0 */6 * * *',
  sync_mode text not null default 'scheduled'
    check (sync_mode in ('realtime','scheduled','manual')),
  direction text not null default 'bidirectional'
    check (direction in ('import','export','bidirectional')),
  is_active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Mapping studio, developer portal, SDK
-- ---------------------------------------------------------------------------

create table if not exists public.ihub_mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  profile_name text not null,
  connector_key text,
  source_entity text not null,
  target_entity text not null,
  field_mappings jsonb not null default '[]'::jsonb,
  transformations jsonb not null default '[]'::jsonb,
  default_values jsonb not null default '{}'::jsonb,
  validation_rules jsonb not null default '[]'::jsonb,
  is_template boolean not null default false,
  edp_template_id uuid references public.edp_mapping_templates(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_name)
);

create table if not exists public.ihub_developer_apps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  app_name text not null,
  description text,
  app_type text not null default 'integration'
    check (app_type in ('integration','marketplace','internal')),
  status text not null default 'active'
    check (status in ('active','suspended','pending')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ihub_sandbox_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  developer_app_id uuid references public.ihub_developer_apps(id) on delete cascade,
  key_name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ihub_sdk_packages (
  id uuid primary key default gen_random_uuid(),
  language text not null unique
    check (language in ('typescript','javascript','python','dotnet','java','php')),
  package_name text not null,
  latest_version text not null default '1.0.0',
  download_url text,
  sample_repo text,
  architecture_notes text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Monitoring & marketplace
-- ---------------------------------------------------------------------------

create table if not exists public.ihub_monitoring_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  snapshot_at timestamptz not null default now(),
  connector_health_pct numeric(5,2) not null default 0,
  api_health_pct numeric(5,2) not null default 0,
  webhook_failure_count integer not null default 0,
  sync_latency_ms numeric(12,2),
  sync_failure_count integer not null default 0,
  retry_count integer not null default 0,
  api_usage_count integer not null default 0,
  rate_limit_hits integer not null default 0,
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.ihub_marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  publisher_org_id uuid references public.org_organizations(id) on delete set null,
  listing_key text not null unique,
  listing_name text not null,
  description text,
  connector_key text references public.edp_connector_definitions(connector_key) on delete set null,
  version text not null default '1.0.0',
  certification_status text not null default 'pending'
    check (certification_status in ('pending','certified','rejected')),
  approval_status text not null default 'draft'
    check (approval_status in ('draft','submitted','approved','rejected')),
  average_rating numeric(3,2) not null default 0,
  revenue_share_pct numeric(5,2) not null default 70,
  created_at timestamptz not null default now()
);

create index if not exists idx_ihub_events_org on public.ihub_events(organization_id, published_at desc);
create index if not exists idx_ihub_events_type on public.ihub_events(event_type, published_at desc);
create index if not exists idx_ihub_api_audit_org on public.ihub_api_audit_log(organization_id, created_at desc);

create or replace view public.rpt_ihub_monitoring_summary as
select
  organization_id,
  max(snapshot_at) as last_snapshot,
  avg(connector_health_pct) as avg_connector_health,
  avg(api_health_pct) as avg_api_health,
  sum(webhook_failure_count) as total_webhook_failures,
  sum(sync_failure_count) as total_sync_failures
from public.ihub_monitoring_snapshots
group by organization_id;

grant select on public.rpt_ihub_monitoring_summary to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Extended connector library
-- ---------------------------------------------------------------------------

insert into public.edp_connector_definitions (connector_key, display_name, category, supports_import, supports_export, supports_sync, auth_type, sort_order)
values
  ('stripe', 'Stripe', 'finance', true, true, true, 'api_key', 13),
  ('schoology', 'Schoology', 'lms', true, true, true, 'oauth', 71),
  ('facts', 'FACTS', 'sis', true, true, true, 'api_key', 53),
  ('infinite_campus', 'Infinite Campus', 'sis', true, true, true, 'api_key', 54),
  ('skyward', 'Skyward', 'sis', true, true, true, 'api_key', 55),
  ('zoom', 'Zoom', 'communication', false, false, true, 'oauth', 42),
  ('microsoft_teams', 'Microsoft Teams', 'communication', false, false, true, 'oauth', 43),
  ('twilio', 'Twilio', 'communication', false, true, true, 'api_key', 44),
  ('sendgrid', 'SendGrid', 'communication', false, true, true, 'api_key', 45),
  ('mailchimp', 'Mailchimp', 'marketing', true, true, true, 'api_key', 46),
  ('hubspot', 'HubSpot', 'crm', true, true, true, 'oauth', 47),
  ('salesforce', 'Salesforce', 'crm', true, true, true, 'oauth', 48),
  ('docusign', 'DocuSign', 'documents', false, true, true, 'oauth', 49),
  ('adobe_sign', 'Adobe Sign', 'documents', false, true, true, 'oauth', 50),
  ('dropbox', 'Dropbox', 'storage', true, true, true, 'oauth', 100),
  ('onedrive', 'OneDrive', 'storage', true, true, true, 'oauth', 101),
  ('google_drive', 'Google Drive', 'storage', true, true, true, 'oauth', 102),
  ('box', 'Box', 'storage', true, true, true, 'oauth', 103),
  ('aws_s3', 'AWS S3', 'storage', true, true, true, 'api_key', 104),
  ('medicaid_billing', 'Medicaid Billing', 'healthcare', true, true, true, 'api_key', 200),
  ('ehr', 'Electronic Health Records', 'healthcare', true, true, true, 'api_key', 201),
  ('therapy_billing', 'Therapy Billing', 'healthcare', true, true, true, 'api_key', 202),
  ('aba_platform', 'ABA Platform', 'healthcare', true, true, true, 'api_key', 203),
  ('insurance_eligibility', 'Insurance Eligibility', 'healthcare', true, false, true, 'api_key', 204),
  ('clinical_documentation', 'Clinical Documentation', 'healthcare', true, true, true, 'api_key', 205),
  ('esa_provider', 'ESA Provider', 'state_funding', true, true, true, 'api_key', 300),
  ('voucher_provider', 'Voucher Provider', 'state_funding', true, true, true, 'api_key', 301)
on conflict (connector_key) do nothing;

insert into public.ihub_sdk_packages (language, package_name, latest_version, download_url, sample_repo, architecture_notes)
values
  ('typescript', '@academyos/sdk', '1.0.0', '/api/integrations/sdk/typescript', 'github.com/academyos/sdk-ts', 'REST + webhook client with OAuth 2.0'),
  ('javascript', '@academyos/sdk-js', '1.0.0', '/api/integrations/sdk/javascript', 'github.com/academyos/sdk-js', 'Node.js and browser compatible'),
  ('python', 'academyos-sdk', '1.0.0', '/api/integrations/sdk/python', 'github.com/academyos/sdk-python', 'Async REST client with pydantic models'),
  ('dotnet', 'AcademyOS.Sdk', '1.0.0', '/api/integrations/sdk/dotnet', 'github.com/academyos/sdk-dotnet', '.NET 8 NuGet package'),
  ('java', 'com.academyos.sdk', '1.0.0', '/api/integrations/sdk/java', 'github.com/academyos/sdk-java', 'Maven artifact with OAuth support'),
  ('php', 'academyos/sdk', '1.0.0', '/api/integrations/sdk/php', 'github.com/academyos/sdk-php', 'Composer package for Laravel/Symfony')
on conflict (language) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('integration.view', 'Integration Hub View', 'View Integration Hub dashboards and logs', 'integration', 'integration_hub', 800),
  ('integration.manage', 'Integration Hub Manage', 'Manage connectors, sync, webhooks, and events', 'integration', 'integration_hub', 801),
  ('integration.admin', 'Integration Hub Admin', 'Full Integration Hub administration', 'integration', 'integration_hub', 802),
  ('developer.portal', 'Developer Portal', 'Access developer portal, sandbox keys, and SDK', 'integration', 'integration_hub', 803)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
  and p.permission_key in ('integration.view', 'integration.manage', 'integration.admin', 'developer.portal')
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name = 'SCHOOL_LEADER'
  and p.permission_key in ('integration.view')
on conflict do nothing;
