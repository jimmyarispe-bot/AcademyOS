-- =========================================
-- RELEASE 12.5: ENTERPRISE INTELLIGENCE & AI READINESS FRAMEWORK
-- Architecture only — no AI provider implementation
-- =========================================

-- ---------------------------------------------------------------------------
-- 1. Provider registry
-- ---------------------------------------------------------------------------

create table if not exists public.aip_provider_definitions (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  display_name text not null,
  description text,
  supports_chat boolean not null default true,
  supports_embeddings boolean not null default false,
  supports_reasoning boolean not null default false,
  supports_image_analysis boolean not null default false,
  supports_document_analysis boolean not null default false,
  supports_speech boolean not null default false,
  auth_type text not null default 'api_key'
    check (auth_type in ('api_key','oauth','azure_ad','aws_iam','local')),
  default_config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0
);

create table if not exists public.aip_provider_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  provider_key text not null references public.aip_provider_definitions(provider_key) on delete cascade,
  instance_name text not null,
  status text not null default 'inactive'
    check (status in ('active','inactive','error','pending_config')),
  config jsonb not null default '{}'::jsonb,
  credentials_ref text,
  health_status text not null default 'unknown'
    check (health_status in ('healthy','degraded','unhealthy','unknown')),
  last_health_check_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider_key, instance_name)
);

-- ---------------------------------------------------------------------------
-- 2. Prompt registry & versioning
-- ---------------------------------------------------------------------------

create table if not exists public.aip_prompts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.org_organizations(id) on delete cascade,
  prompt_key text not null,
  name text not null,
  description text,
  category text not null
    check (category in (
      'admissions','teacher','parent','student','finance','scholarships',
      'state_funding','executive','hr','scheduling','ssis','compliance',
      'work_management','communications','reports','future'
    )),
  module text not null,
  status text not null default 'draft'
    check (status in ('draft','pending_review','approved','published','archived','rejected')),
  owner_id uuid references public.users(id) on delete set null,
  current_version integer not null default 1,
  rollback_version integer,
  tags jsonb not null default '[]'::jsonb,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, prompt_key)
);

create table if not exists public.aip_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.aip_prompts(id) on delete cascade,
  version_number integer not null,
  prompt_template text not null,
  system_instructions text,
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  change_summary text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (prompt_id, version_number)
);

-- ---------------------------------------------------------------------------
-- 3. Policies & knowledge registry
-- ---------------------------------------------------------------------------

create table if not exists public.aip_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  policy_key text not null,
  policy_name text not null,
  description text,
  policy_type text not null default 'usage'
    check (policy_type in ('usage','security','ferpa','classification','cost','approval')),
  rules jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, policy_key)
);

create table if not exists public.aip_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  source_key text not null,
  source_name text not null,
  source_type text not null
    check (source_type in (
      'policy','handbook','iep','curriculum','financial_policy',
      'compliance_manual','hr_manual','strategic_plan','other'
    )),
  classification text not null default 'internal',
  status text not null default 'registered'
    check (status in ('registered','indexed','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, source_key)
);

-- ---------------------------------------------------------------------------
-- 4. Settings (org, school, module)
-- ---------------------------------------------------------------------------

create table if not exists public.aip_org_settings (
  organization_id uuid primary key references public.org_organizations(id) on delete cascade,
  ai_enabled boolean not null default false,
  default_provider_key text references public.aip_provider_definitions(provider_key) on delete set null,
  max_tokens_per_request integer not null default 4096,
  max_monthly_cost_usd numeric(12,2),
  require_human_review boolean not null default true,
  ferpa_masking_enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.aip_school_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  ai_enabled boolean not null default false,
  allowed_modules jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, school_id)
);

create table if not exists public.aip_module_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  module_key text not null,
  ai_enabled boolean not null default false,
  allowed_categories jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, school_id, module_key)
);

-- ---------------------------------------------------------------------------
-- 5. Queue engine & jobs
-- ---------------------------------------------------------------------------

create table if not exists public.aip_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  job_type text not null default 'inference'
    check (job_type in ('inference','embedding','test','scheduled','batch')),
  module text not null,
  prompt_id uuid references public.aip_prompts(id) on delete set null,
  prompt_version_id uuid references public.aip_prompt_versions(id) on delete set null,
  provider_instance_id uuid references public.aip_provider_instances(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued','running','completed','failed','cancelled','retrying')),
  priority integer not null default 5,
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  depends_on_job_id uuid references public.aip_jobs(id) on delete set null,
  requested_by uuid references public.users(id) on delete set null,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.aip_job_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.aip_jobs(id) on delete cascade,
  log_level text not null default 'info' check (log_level in ('info','warning','error')),
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Token usage & audit
-- ---------------------------------------------------------------------------

create table if not exists public.aip_token_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  module text not null,
  prompt_id uuid references public.aip_prompts(id) on delete set null,
  provider_key text,
  job_id uuid references public.aip_jobs(id) on delete set null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  execution_time_ms integer,
  status text not null default 'completed'
    check (status in ('completed','failed','cancelled','simulated')),
  usage_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.aip_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  requested_by uuid references public.users(id) on delete set null,
  prompt_id uuid references public.aip_prompts(id) on delete set null,
  prompt_version_id uuid references public.aip_prompt_versions(id) on delete set null,
  job_id uuid references public.aip_jobs(id) on delete set null,
  provider_key text,
  context_sources jsonb not null default '[]'::jsonb,
  response_status text not null default 'simulated',
  approval_status text,
  user_feedback text,
  execution_time_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7. Approvals & testing lab
-- ---------------------------------------------------------------------------

create table if not exists public.aip_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('prompt','policy','provider','job')),
  entity_id uuid not null,
  approval_type text not null default 'human_review'
    check (approval_type in ('auto_approved','human_review','executive_review','founder_approval')),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','published','rolled_back')),
  requested_by uuid references public.users(id) on delete set null,
  reviewed_by uuid references public.users(id) on delete set null,
  review_notes text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.aip_test_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.org_organizations(id) on delete cascade,
  prompt_id uuid references public.aip_prompts(id) on delete set null,
  prompt_version_id uuid references public.aip_prompt_versions(id) on delete set null,
  provider_key text,
  test_input jsonb not null default '{}'::jsonb,
  simulated_output jsonb not null default '{}'::jsonb,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  latency_ms integer,
  status text not null default 'simulated',
  run_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. Indexes & triggers
-- ---------------------------------------------------------------------------

create index if not exists idx_aip_prompts_org on public.aip_prompts(organization_id, category);
create index if not exists idx_aip_jobs_queue on public.aip_jobs(status, priority, scheduled_at);
create index if not exists idx_aip_token_usage_org_date on public.aip_token_usage(organization_id, usage_date desc);
create index if not exists idx_aip_audit_logs_org on public.aip_audit_logs(organization_id, created_at desc);

drop trigger if exists aip_provider_instances_set_updated_at on public.aip_provider_instances;
create trigger aip_provider_instances_set_updated_at
  before update on public.aip_provider_instances
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists aip_prompts_set_updated_at on public.aip_prompts;
create trigger aip_prompts_set_updated_at
  before update on public.aip_prompts
  for each row execute function public.trigger_set_updated_at();

drop trigger if exists aip_policies_set_updated_at on public.aip_policies;
create trigger aip_policies_set_updated_at
  before update on public.aip_policies
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Reporting views
-- ---------------------------------------------------------------------------

create or replace view public.rpt_aip_cost_summary as
select
  organization_id,
  school_id,
  usage_date,
  sum(tokens_in) as total_tokens_in,
  sum(tokens_out) as total_tokens_out,
  sum(estimated_cost_usd) as total_cost_usd,
  count(*) as request_count
from public.aip_token_usage
group by organization_id, school_id, usage_date;

create or replace view public.rpt_aip_usage_by_module as
select
  organization_id,
  module,
  date_trunc('month', usage_date::timestamptz) as month,
  sum(tokens_in + tokens_out) as total_tokens,
  sum(estimated_cost_usd) as total_cost_usd
from public.aip_token_usage
group by organization_id, module, date_trunc('month', usage_date::timestamptz);

create or replace view public.rpt_aip_queue_health as
select
  organization_id,
  status,
  count(*) as job_count,
  avg(extract(epoch from (completed_at - started_at))) as avg_duration_sec
from public.aip_jobs
where started_at is not null
group by organization_id, status;

grant select on public.rpt_aip_cost_summary to authenticated;
grant select on public.rpt_aip_usage_by_module to authenticated;
grant select on public.rpt_aip_queue_health to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Seed provider definitions
-- ---------------------------------------------------------------------------

insert into public.aip_provider_definitions (provider_key, display_name, supports_chat, supports_embeddings, supports_reasoning, auth_type, sort_order)
values
  ('openai', 'OpenAI', true, true, true, 'api_key', 10),
  ('anthropic', 'Anthropic', true, false, true, 'api_key', 20),
  ('google_gemini', 'Google Gemini', true, true, true, 'api_key', 30),
  ('azure_openai', 'Azure OpenAI', true, true, true, 'azure_ad', 40),
  ('aws_bedrock', 'AWS Bedrock', true, true, true, 'aws_iam', 50),
  ('local_llm', 'Local LLM', true, true, false, 'local', 60)
on conflict (provider_key) do nothing;

-- ---------------------------------------------------------------------------
-- 11. Permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('ai.view', 'AI Platform View', 'View intelligence platform dashboards', 'ai', 'intelligence', 520),
  ('ai.use', 'AI Platform Use', 'Use future AI capabilities through the platform', 'ai', 'intelligence', 521),
  ('ai.manage', 'AI Platform Manage', 'Manage prompts, policies, and settings', 'ai', 'intelligence', 522),
  ('ai.providers', 'AI Providers', 'Configure AI provider adapters', 'ai', 'intelligence', 523),
  ('ai.prompts', 'AI Prompts', 'Manage prompt registry and versions', 'ai', 'intelligence', 524),
  ('ai.testing', 'AI Testing Lab', 'Run prompt tests in the testing lab', 'ai', 'intelligence', 525),
  ('ai.admin', 'AI Platform Admin', 'Full intelligence platform administration', 'ai', 'intelligence', 526),
  ('ai.executive', 'AI Executive', 'Executive-scoped future AI access', 'ai', 'intelligence', 527),
  ('ai.finance', 'AI Finance', 'Finance-scoped future AI access', 'ai', 'intelligence', 528),
  ('ai.student', 'AI Student', 'Student-scoped future AI access', 'ai', 'intelligence', 529),
  ('ai.teacher', 'AI Teacher', 'Teacher-scoped future AI access', 'ai', 'intelligence', 530),
  ('ai.parent', 'AI Parent', 'Parent-scoped future AI access', 'ai', 'intelligence', 531)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
  and p.permission_key in ('ai.view','ai.use','ai.manage','ai.providers','ai.prompts','ai.testing','ai.admin','ai.executive','ai.finance')
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name = 'SCHOOL_LEADER'
  and p.permission_key in ('ai.view','ai.use','ai.prompts','ai.testing')
on conflict do nothing;
