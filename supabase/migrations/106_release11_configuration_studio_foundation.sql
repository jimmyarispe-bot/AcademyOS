-- =========================================
-- RELEASE 11: CONFIGURATION STUDIO & ORGANIZATION BUILDER
-- Database-backed configuration — no code changes required
-- =========================================

-- ---------------------------------------------------------------------------
-- 1. Organization configuration profiles (by section)
-- ---------------------------------------------------------------------------

create table if not exists public.config_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  section_key text not null
    check (section_key in (
      'organization','branding','academic','admissions','finance','hr',
      'communications','workflows','integrations','security','automation',
      'compliance','playbooks','mission_control','executive','scheduling','portals'
    )),
  config_data jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  is_active boolean not null default true,
  requires_approval boolean not null default false,
  approval_status text not null default 'approved'
    check (approval_status in ('draft','pending_approval','approved','rejected')),
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, school_id, section_key)
);

create index if not exists idx_config_sections_org on public.config_sections(organization_id, section_key);

-- ---------------------------------------------------------------------------
-- 2. Configuration version history & audit
-- ---------------------------------------------------------------------------

create table if not exists public.config_version_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  section_key text not null,
  config_section_id uuid references public.config_sections(id) on delete set null,
  version_number integer not null default 1,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  change_summary text,
  changed_by uuid references public.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  is_rollback boolean not null default false,
  audit_event_id uuid
);

create index if not exists idx_config_version_history_org on public.config_version_history(organization_id, section_key, changed_at desc);

-- ---------------------------------------------------------------------------
-- 3. Module marketplace registry
-- ---------------------------------------------------------------------------

create table if not exists public.config_module_definitions (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  display_name text not null,
  description text,
  category text not null default 'core',
  dependencies jsonb not null default '[]'::jsonb,
  platform_version text not null default '11.0',
  is_platform_module boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.config_module_installations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  module_key text not null references public.config_module_definitions(module_key) on delete cascade,
  status text not null default 'disabled'
    check (status in ('installed','enabled','disabled','uninstalled')),
  installed_version text not null default '11.0',
  module_settings jsonb not null default '{}'::jsonb,
  installed_at timestamptz,
  enabled_at timestamptz,
  disabled_at timestamptz,
  installed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, module_key)
);

-- ---------------------------------------------------------------------------
-- 4. Setup wizard sessions (save & resume)
-- ---------------------------------------------------------------------------

create table if not exists public.config_setup_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  current_step text not null default 'organization',
  steps_completed jsonb not null default '[]'::jsonb,
  draft_config jsonb not null default '{}'::jsonb,
  status text not null default 'in_progress'
    check (status in ('in_progress','completed','abandoned')),
  started_by uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_config_setup_org on public.config_setup_sessions(organization_id, status);

-- ---------------------------------------------------------------------------
-- 5. Go-live validation snapshots
-- ---------------------------------------------------------------------------

create table if not exists public.config_go_live_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  check_key text not null,
  check_category text not null,
  title text not null,
  status text not null default 'pending'
    check (status in ('green','yellow','red','pending')),
  message text,
  resolve_href text,
  is_required boolean not null default true,
  checked_at timestamptz not null default now(),
  unique (organization_id, check_key)
);

create table if not exists public.config_go_live_launches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  launched_by uuid references public.users(id) on delete set null,
  launch_status text not null default 'ready'
    check (launch_status in ('ready','launched','rolled_back')),
  validation_snapshot jsonb not null default '{}'::jsonb,
  launched_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Configuration packages (import/export)
-- ---------------------------------------------------------------------------

create table if not exists public.config_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete set null,
  package_name text not null,
  package_type text not null default 'full'
    check (package_type in ('full','school','campus','program','playbooks','templates','workflows')),
  source_scope jsonb not null default '{}'::jsonb,
  package_data jsonb not null default '{}'::jsonb,
  format text not null default 'json' check (format in ('json','csv','excel')),
  exported_by uuid references public.users(id) on delete set null,
  imported_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. Organization templates
-- ---------------------------------------------------------------------------

create table if not exists public.config_organization_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  description text,
  tenant_type text not null default 'single_school'
    check (tenant_type in (
      'single_school','multi_campus','school_network','charter','nonprofit','district','international'
    )),
  default_config jsonb not null default '{}'::jsonb,
  default_modules jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists config_sections_set_updated_at on public.config_sections;
create trigger config_sections_set_updated_at
  before update on public.config_sections
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists config_module_installations_set_updated_at on public.config_module_installations;
create trigger config_module_installations_set_updated_at
  before update on public.config_module_installations
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists config_setup_sessions_set_updated_at on public.config_setup_sessions;
create trigger config_setup_sessions_set_updated_at
  before update on public.config_setup_sessions
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Reporting views
-- ---------------------------------------------------------------------------

create or replace view public.rpt_config_module_status as
select
  i.organization_id,
  o.name as organization_name,
  i.module_key,
  d.display_name,
  i.status,
  i.installed_version,
  d.dependencies,
  i.enabled_at,
  i.updated_at
from public.config_module_installations i
join public.org_organizations o on o.id = i.organization_id
join public.config_module_definitions d on d.module_key = i.module_key;

create or replace view public.rpt_config_go_live_summary as
select
  organization_id,
  count(*) filter (where status = 'green') as green_count,
  count(*) filter (where status = 'yellow') as yellow_count,
  count(*) filter (where status = 'red') as red_count,
  count(*) filter (where is_required and status != 'green') as blocking_count,
  max(checked_at) as last_checked_at
from public.config_go_live_checks
group by organization_id;

grant select on public.rpt_config_module_status to authenticated;
grant select on public.rpt_config_go_live_summary to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Seed module definitions
-- ---------------------------------------------------------------------------

insert into public.config_module_definitions (module_key, display_name, description, category, dependencies, sort_order)
values
  ('admissions', 'Admissions', 'Admissions CRM and enrollment funnel', 'core', '[]'::jsonb, 10),
  ('ssis', 'SSIS', 'Student Success Information System', 'core', '["admissions"]'::jsonb, 20),
  ('scheduling', 'Scheduling', 'Academic operations and scheduling', 'core', '["ssis"]'::jsonb, 30),
  ('teacher_workspace', 'Teacher Workspace', 'Instructional staff daily hub', 'core', '["scheduling"]'::jsonb, 40),
  ('parent_portal', 'Parent Portal', 'Guardian portal experience', 'portal', '["ssis"]'::jsonb, 50),
  ('student_portal', 'Student Portal', 'Student portal experience', 'portal', '["ssis"]'::jsonb, 55),
  ('hr', 'HR & Workforce', 'Human capital management', 'operations', '[]'::jsonb, 60),
  ('finance', 'Finance', 'Billing and financial operations', 'operations', '["admissions"]'::jsonb, 70),
  ('scholarships', 'Scholarships', 'Financial aid management', 'operations', '["finance"]'::jsonb, 75),
  ('state_funding', 'State Funding', 'State funding programs', 'operations', '["finance"]'::jsonb, 76),
  ('transportation', 'Transportation', 'Transportation management', 'extended', '[]'::jsonb, 80),
  ('food_service', 'Food Service', 'Meal programs', 'extended', '[]'::jsonb, 81),
  ('facilities', 'Facilities', 'Facility management', 'extended', '[]'::jsonb, 82),
  ('volunteer', 'Volunteer Management', 'Volunteer coordination', 'extended', '[]'::jsonb, 83),
  ('grants', 'Grants', 'Grant management', 'extended', '["finance"]'::jsonb, 84),
  ('fundraising', 'Fundraising', 'Development and fundraising', 'extended', '["finance"]'::jsonb, 85),
  ('compliance', 'Compliance', 'Enterprise compliance center', 'intelligence', '[]'::jsonb, 90),
  ('executive_intelligence', 'Executive Intelligence', 'Executive dashboards and KPIs', 'intelligence', '[]'::jsonb, 91),
  ('financial_intelligence', 'Financial Intelligence', 'Profitability and FI analytics', 'intelligence', '["finance"]'::jsonb, 92),
  ('decision_intelligence', 'Decision Intelligence', 'Executive decision support', 'intelligence', '["executive_intelligence"]'::jsonb, 93),
  ('work_management', 'Work Management', 'Projects, tasks, and playbooks', 'operations', '[]'::jsonb, 94)
on conflict (module_key) do nothing;

insert into public.config_organization_templates (template_key, name, description, tenant_type, default_modules)
values
  ('single_school', 'Single School', 'One school deployment', 'single_school', '["admissions","ssis","scheduling","finance","hr"]'::jsonb),
  ('multi_campus', 'Multi-Campus', 'Multiple campuses under one organization', 'multi_campus', '["admissions","ssis","scheduling","teacher_workspace","finance","hr","compliance"]'::jsonb),
  ('charter_network', 'Charter Network', 'Charter organization with multiple schools', 'charter', '["admissions","ssis","scheduling","finance","scholarships","state_funding","executive_intelligence"]'::jsonb),
  ('district', 'District', 'District-wide deployment', 'district', '["admissions","ssis","scheduling","hr","finance","compliance","work_management"]'::jsonb)
on conflict (template_key) do nothing;

-- ---------------------------------------------------------------------------
-- 11. Permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('configuration.view', 'Configuration View', 'View configuration studio settings', 'admin', 'configuration', 500),
  ('configuration.manage', 'Configuration Manage', 'Edit organization configuration', 'admin', 'configuration', 501),
  ('configuration.admin', 'Configuration Admin', 'Full configuration studio access', 'admin', 'configuration', 502),
  ('configuration.launch', 'Configuration Launch', 'Go-live and organization launch', 'admin', 'configuration', 503)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
  and p.permission_key in ('configuration.view', 'configuration.manage', 'configuration.admin', 'configuration.launch')
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name = 'SCHOOL_LEADER'
  and p.permission_key in ('configuration.view', 'configuration.manage')
on conflict do nothing;
