-- =========================================
-- RELEASE 15.1: Enterprise Integration Hub extensions
-- Credential vault, custom connectors, marketplace reviews, executive dashboard
-- =========================================

alter table public.ihub_events
  add column if not exists event_version text not null default '1.0';

create table if not exists public.ihub_integration_registry (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  integration_key text not null,
  integration_name text not null,
  integration_type text not null check (integration_type in ('connector','api','webhook','custom')),
  status text not null default 'active' check (status in ('active','disabled','error','pending')),
  connector_instance_id uuid references public.edp_connector_instances(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, integration_key)
);

create table if not exists public.ihub_credential_vault (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  vault_key text not null,
  credential_type text not null check (credential_type in ('api_key','oauth','certificate','webhook_secret','jwt')),
  encrypted_ref text not null,
  scopes jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  last_rotated_at timestamptz,
  rotation_due_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, vault_key)
);

create table if not exists public.ihub_custom_connectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  connector_name text not null,
  protocol text not null check (protocol in ('rest','soap','csv','xml','ftp','sftp','webhook','sql')),
  config jsonb not null default '{}'::jsonb,
  field_mappings jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','disabled')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, connector_name)
);

create table if not exists public.ihub_webhook_dead_letter (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  webhook_id uuid references public.edp_webhooks(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  failure_reason text,
  attempt_count integer not null default 0,
  replayable boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ihub_marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.ihub_marketplace_listings(id) on delete cascade,
  reviewer_org_id uuid references public.org_organizations(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  review_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.ihub_executive_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  snapshot_date date not null default current_date,
  connected_systems integer not null default 0,
  connector_health_pct numeric(5,2) not null default 0,
  failed_syncs integer not null default 0,
  daily_transactions integer not null default 0,
  webhook_success_rate numeric(5,2) not null default 0,
  api_usage_count integer not null default 0,
  external_data_volume_mb numeric(12,2) not null default 0,
  marketplace_revenue numeric(12,2) not null default 0,
  unique (organization_id, snapshot_date)
);

create index if not exists idx_ihub_integration_registry_org on public.ihub_integration_registry(organization_id);
create index if not exists idx_ihub_credential_vault_org on public.ihub_credential_vault(organization_id);
create index if not exists idx_ihub_webhook_dlq_org on public.ihub_webhook_dead_letter(organization_id, created_at desc);

insert into public.edp_connector_definitions (connector_key, display_name, category, supports_import, supports_export, supports_sync, auth_type, sort_order)
values
  ('outlook_calendar', 'Outlook Calendar', 'scheduling', true, true, true, 'oauth', 31),
  ('gmail', 'Gmail', 'communication', true, true, true, 'oauth', 32),
  ('exchange', 'Microsoft Exchange', 'communication', true, true, true, 'oauth', 33),
  ('authorize_net', 'Authorize.net', 'finance', true, true, true, 'api_key', 14),
  ('schoolmint', 'SchoolMint', 'sis', true, true, true, 'api_key', 56),
  ('azure_storage', 'Azure Storage', 'storage', true, true, true, 'api_key', 105),
  ('aba_billing', 'ABA Billing', 'healthcare', true, true, true, 'api_key', 206),
  ('therapy_scheduling', 'Therapy Scheduling', 'healthcare', true, true, true, 'api_key', 207),
  ('scholarship_org', 'Scholarship Organizations', 'state_funding', true, true, true, 'api_key', 302),
  ('grant_provider', 'Grant Providers', 'state_funding', true, true, true, 'api_key', 303),
  ('payment_portal', 'Payment Portals', 'state_funding', true, true, true, 'api_key', 304)
on conflict (connector_key) do nothing;

alter table public.ihub_sdk_packages drop constraint if exists ihub_sdk_packages_language_check;
alter table public.ihub_sdk_packages add constraint ihub_sdk_packages_language_check
  check (language in ('typescript','javascript','python','dotnet','java','php','go'));

insert into public.ihub_sdk_packages (language, package_name, latest_version, download_url, sample_repo, architecture_notes)
values ('go', 'github.com/academyos/sdk-go', '1.0.0', '/api/integrations/sdk/go', 'github.com/academyos/sdk-go', 'Go module with REST client and webhook verification')
on conflict (language) do update set latest_version = excluded.latest_version;

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('integration.developer', 'Integration Developer', 'Developer portal, sandbox, SDK, and testing lab', 'integration', 'integration_hub', 804),
  ('integration.marketplace', 'Integration Marketplace', 'Install and publish marketplace connectors', 'integration', 'integration_hub', 805)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
  and p.permission_key in ('integration.developer', 'integration.marketplace')
on conflict do nothing;
