-- =========================================
-- RELEASE 12: ENTERPRISE DATA PLATFORM, INTEGRATION HUB & MIGRATION CENTER
-- Central data exchange — extends (does not replace) operational modules
-- =========================================

-- ---------------------------------------------------------------------------
-- 1. Import batches & records
-- ---------------------------------------------------------------------------

create table if not exists public.edp_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  import_type text not null
    check (import_type in (
      'organization','school','campus','program','student','family','guardian',
      'employee','teacher','course','section','schedule','attendance','behavior',
      'medical','iep','504_plan','intervention','assessment','scholarship',
      'state_funding','financial_transaction','payroll','vendor','asset','inventory',
      'project','task','document','communication','historical','quickbooks','configuration'
    )),
  source_format text not null default 'csv'
    check (source_format in ('csv','excel','json','xml','zip','quickbooks','google_sheets','api')),
  source_system text,
  file_name text,
  status text not null default 'pending'
    check (status in ('pending','mapping','validating','preview','importing','completed','failed','rolled_back')),
  row_count integer not null default 0,
  success_count integer not null default 0,
  error_count integer not null default 0,
  warning_count integer not null default 0,
  mapping_template_id uuid,
  validation_summary jsonb not null default '{}'::jsonb,
  imported_by uuid references public.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.edp_import_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.edp_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  mapped_data jsonb,
  status text not null default 'pending'
    check (status in ('pending','valid','warning','error','imported','skipped')),
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  target_entity_type text,
  target_entity_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_edp_import_batches_org on public.edp_import_batches(organization_id, started_at desc);
create index if not exists idx_edp_import_records_batch on public.edp_import_records(batch_id, row_number);

-- ---------------------------------------------------------------------------
-- 2. Export batches
-- ---------------------------------------------------------------------------

create table if not exists public.edp_export_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  export_type text not null,
  export_format text not null default 'csv'
    check (export_format in ('csv','excel','json','xml','zip')),
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed')),
  row_count integer not null default 0,
  file_path text,
  exported_by uuid references public.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- 3. Data mapping templates
-- ---------------------------------------------------------------------------

create table if not exists public.edp_mapping_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  template_name text not null,
  import_type text not null,
  source_format text not null default 'csv',
  is_default boolean not null default false,
  field_mappings jsonb not null default '[]'::jsonb,
  transformation_rules jsonb not null default '[]'::jsonb,
  lookup_tables jsonb not null default '{}'::jsonb,
  conditional_mappings jsonb not null default '[]'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_name, import_type)
);

-- ---------------------------------------------------------------------------
-- 4. Connector library
-- ---------------------------------------------------------------------------

create table if not exists public.edp_connector_definitions (
  id uuid primary key default gen_random_uuid(),
  connector_key text not null unique,
  display_name text not null,
  description text,
  category text not null default 'general',
  supports_import boolean not null default true,
  supports_export boolean not null default false,
  supports_sync boolean not null default false,
  auth_type text not null default 'api_key'
    check (auth_type in ('api_key','oauth','ftp','webhook','none')),
  default_config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0
);

create table if not exists public.edp_connector_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  connector_key text not null references public.edp_connector_definitions(connector_key) on delete cascade,
  instance_name text not null,
  status text not null default 'inactive'
    check (status in ('active','inactive','error','pending_auth')),
  sync_direction text not null default 'import'
    check (sync_direction in ('import','export','bidirectional')),
  config jsonb not null default '{}'::jsonb,
  credentials_ref text,
  last_sync_at timestamptz,
  health_status text not null default 'unknown'
    check (health_status in ('healthy','degraded','unhealthy','unknown')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, connector_key, instance_name)
);

-- ---------------------------------------------------------------------------
-- 5. Sync engine
-- ---------------------------------------------------------------------------

create table if not exists public.edp_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  connector_instance_id uuid references public.edp_connector_instances(id) on delete set null,
  sync_type text not null default 'manual'
    check (sync_type in ('manual','scheduled','incremental','full')),
  direction text not null default 'import'
    check (direction in ('import','export','bidirectional')),
  status text not null default 'queued'
    check (status in ('queued','running','completed','failed','conflict')),
  records_processed integer not null default 0,
  conflicts_detected integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.edp_sync_logs (
  id uuid primary key default gen_random_uuid(),
  sync_job_id uuid not null references public.edp_sync_jobs(id) on delete cascade,
  log_level text not null default 'info' check (log_level in ('info','warning','error')),
  message text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. API keys & webhooks
-- ---------------------------------------------------------------------------

create table if not exists public.edp_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  key_name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes jsonb not null default '[]'::jsonb,
  rate_limit_per_minute integer not null default 60,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.edp_webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  webhook_name text not null,
  direction text not null check (direction in ('incoming','outgoing')),
  endpoint_url text,
  secret_key_ref text,
  event_types jsonb not null default '[]'::jsonb,
  retry_policy jsonb not null default '{"max_retries":3,"backoff_ms":1000}'::jsonb,
  is_active boolean not null default true,
  signing_enabled boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.edp_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.edp_webhooks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','delivered','failed','retrying')),
  response_code integer,
  response_body text,
  attempt_count integer not null default 0,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. Backups, archives, clones
-- ---------------------------------------------------------------------------

create table if not exists public.edp_backups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  backup_type text not null default 'full'
    check (backup_type in ('full','school','configuration','database_snapshot')),
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed','restored')),
  backup_size_bytes bigint,
  snapshot_data jsonb,
  storage_path text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  restored_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.edp_archives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  archive_type text not null
    check (archive_type in (
      'school_year','graduates','withdrawn_students','payroll','finance',
      'projects','communications','documents'
    )),
  entity_type text,
  entity_id uuid,
  retention_policy text,
  archived_data jsonb not null default '{}'::jsonb,
  archived_at timestamptz not null default now(),
  archived_by uuid references public.users(id) on delete set null,
  expires_at timestamptz
);

create table if not exists public.edp_clone_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  source_scope jsonb not null default '{}'::jsonb,
  target_scope jsonb not null default '{}'::jsonb,
  clone_type text not null default 'organization'
    check (clone_type in ('organization','school','campus','program','blueprint')),
  include_users boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed')),
  progress_pct integer not null default 0,
  result_summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. Migration wizard sessions
-- ---------------------------------------------------------------------------

create table if not exists public.edp_migration_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  current_step text not null default 'upload'
    check (current_step in ('upload','mapping','validation','preview','conflicts','import','verification','report')),
  import_batch_id uuid references public.edp_import_batches(id) on delete set null,
  mapping_template_id uuid references public.edp_mapping_templates(id) on delete set null,
  status text not null default 'in_progress'
    check (status in ('in_progress','completed','failed','rolled_back')),
  session_data jsonb not null default '{}'::jsonb,
  started_by uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 9. Data quality & warehouse
-- ---------------------------------------------------------------------------

create table if not exists public.edp_quality_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  quality_score numeric(5,2) not null default 0,
  duplicate_students integer not null default 0,
  duplicate_families integer not null default 0,
  missing_contacts integer not null default 0,
  broken_relationships integer not null default 0,
  incomplete_records integer not null default 0,
  orphaned_files integer not null default 0,
  issues jsonb not null default '[]'::jsonb,
  corrective_actions jsonb not null default '[]'::jsonb,
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (organization_id, school_id, snapshot_date)
);

create table if not exists public.edp_warehouse_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  snapshot_date date not null,
  domain text not null
    check (domain in (
      'enrollment','finance','attendance','behavior','student_growth','hr',
      'scheduling','compliance','executive_kpi','financial_kpi'
    )),
  metrics jsonb not null default '{}'::jsonb,
  period_type text not null default 'monthly'
    check (period_type in ('daily','weekly','monthly','quarterly','annual')),
  created_at timestamptz not null default now(),
  unique (organization_id, school_id, snapshot_date, domain, period_type)
);

-- ---------------------------------------------------------------------------
-- 10. Validation results
-- ---------------------------------------------------------------------------

create table if not exists public.edp_validation_results (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.edp_import_batches(id) on delete cascade,
  validation_type text not null,
  severity text not null check (severity in ('error','warning','info','recommendation')),
  message text not null,
  field_name text,
  row_number integer,
  resolution_hint text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 11. Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists edp_mapping_templates_set_updated_at on public.edp_mapping_templates;
create trigger edp_mapping_templates_set_updated_at
  before update on public.edp_mapping_templates
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists edp_connector_instances_set_updated_at on public.edp_connector_instances;
create trigger edp_connector_instances_set_updated_at
  before update on public.edp_connector_instances
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists edp_webhooks_set_updated_at on public.edp_webhooks;
create trigger edp_webhooks_set_updated_at
  before update on public.edp_webhooks
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists edp_migration_sessions_set_updated_at on public.edp_migration_sessions;
create trigger edp_migration_sessions_set_updated_at
  before update on public.edp_migration_sessions
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 12. Reporting views
-- ---------------------------------------------------------------------------

create or replace view public.rpt_edp_import_summary as
select
  b.organization_id,
  b.import_type,
  b.source_format,
  b.status,
  count(*) as batch_count,
  sum(b.row_count) as total_rows,
  sum(b.success_count) as total_success,
  sum(b.error_count) as total_errors,
  max(b.started_at) as last_import_at
from public.edp_import_batches b
group by b.organization_id, b.import_type, b.source_format, b.status;

create or replace view public.rpt_edp_connector_health as
select
  i.organization_id,
  i.connector_key,
  d.display_name,
  i.status,
  i.health_status,
  i.last_sync_at,
  i.sync_direction
from public.edp_connector_instances i
join public.edp_connector_definitions d on d.connector_key = i.connector_key;

create or replace view public.rpt_edp_quality_summary as
select
  organization_id,
  school_id,
  snapshot_date,
  quality_score,
  duplicate_students + duplicate_families as duplicate_count,
  missing_contacts + incomplete_records as data_gaps
from public.edp_quality_snapshots;

grant select on public.rpt_edp_import_summary to authenticated;
grant select on public.rpt_edp_connector_health to authenticated;
grant select on public.rpt_edp_quality_summary to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Seed connector definitions
-- ---------------------------------------------------------------------------

insert into public.edp_connector_definitions (connector_key, display_name, category, supports_import, supports_export, supports_sync, auth_type, sort_order)
values
  ('quickbooks_online', 'QuickBooks Online', 'finance', true, true, true, 'oauth', 10),
  ('quickbooks_desktop', 'QuickBooks Desktop', 'finance', true, false, false, 'none', 11),
  ('square', 'Square', 'finance', true, true, true, 'api_key', 12),
  ('google_workspace', 'Google Workspace', 'productivity', true, true, true, 'oauth', 20),
  ('microsoft_365', 'Microsoft 365', 'productivity', true, true, true, 'oauth', 21),
  ('google_calendar', 'Google Calendar', 'scheduling', true, true, true, 'oauth', 30),
  ('google_classroom', 'Google Classroom', 'lms', true, true, true, 'oauth', 40),
  ('google_meet', 'Google Meet', 'communication', false, false, true, 'oauth', 41),
  ('clever', 'Clever', 'sis', true, true, true, 'api_key', 50),
  ('classlink', 'ClassLink', 'sis', true, true, true, 'api_key', 51),
  ('powerschool', 'PowerSchool', 'sis', true, true, true, 'api_key', 52),
  ('nwea_map', 'NWEA MAP', 'assessment', true, true, false, 'api_key', 60),
  ('canvas', 'Canvas', 'lms', true, true, true, 'oauth', 70),
  ('blackbaud', 'Blackbaud', 'sis', true, true, true, 'api_key', 80),
  ('ftp_sftp', 'FTP/SFTP', 'general', true, true, true, 'ftp', 90),
  ('webhook', 'Webhook Endpoint', 'general', true, true, true, 'webhook', 91),
  ('rest_api', 'REST API', 'general', true, true, true, 'api_key', 92)
on conflict (connector_key) do nothing;

-- ---------------------------------------------------------------------------
-- 14. Permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('data.view', 'Data Platform View', 'View data platform dashboards and history', 'data', 'enterprise_data', 510),
  ('data.manage', 'Data Platform Manage', 'Manage mappings, connectors, and sync', 'data', 'enterprise_data', 511),
  ('data.import', 'Data Platform Import', 'Run imports and migration wizard', 'data', 'enterprise_data', 512),
  ('data.export', 'Data Platform Export', 'Run exports and backups', 'data', 'enterprise_data', 513),
  ('data.admin', 'Data Platform Admin', 'Full data platform administration', 'data', 'enterprise_data', 514)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
  and p.permission_key in ('data.view', 'data.manage', 'data.import', 'data.export', 'data.admin')
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name = 'SCHOOL_LEADER'
  and p.permission_key in ('data.view', 'data.import', 'data.export')
on conflict do nothing;
