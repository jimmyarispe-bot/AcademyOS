-- =========================================
-- PLATFORM ENTERPRISE AUTOMATION FOUNDATION (072)
-- Extends admissions automation; adds cross-module platform services
-- Idempotent: safe to re-run
-- =========================================

-- Extend admissions workflows with enterprise lifecycle (never edit live directly)
alter table public.admissions_workflows
  add column if not exists lifecycle_status text not null default 'active'
    check (lifecycle_status in ('draft', 'testing', 'active', 'archived'));

alter table public.admissions_workflows
  add column if not exists published_at timestamptz;

alter table public.admissions_workflows
  add column if not exists archived_at timestamptz;

alter table public.admissions_workflows
  add column if not exists parent_workflow_id uuid references public.admissions_workflows(id) on delete set null;

alter table public.admissions_workflows
  add column if not exists module text not null default 'admissions';

-- Backfill: existing active workflows stay active
update public.admissions_workflows
  set lifecycle_status = 'active', published_at = coalesce(published_at, created_at)
  where lifecycle_status = 'active' and published_at is null;

-- Extend admissions audit for platform fields
alter table public.admissions_automation_audit_log
  add column if not exists module text not null default 'admissions';

alter table public.admissions_automation_audit_log
  add column if not exists entity_type text;

alter table public.admissions_automation_audit_log
  add column if not exists entity_id uuid;

alter table public.admissions_automation_audit_log
  add column if not exists before_state jsonb;

alter table public.admissions_automation_audit_log
  add column if not exists after_state jsonb;

alter table public.admissions_automation_audit_log
  add column if not exists ip_address text;

alter table public.admissions_automation_audit_log
  add column if not exists user_role text;

-- =========================================
-- PLATFORM AUDIT (cross-module, searchable)
-- =========================================
create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  module text not null,
  entity_type text not null,
  entity_id uuid not null,
  workflow_id uuid,
  workflow_key text,
  action_type text not null,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role text,
  ip_address text,
  summary text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_system_event boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_audit_entity
  on public.platform_audit_events(module, entity_type, entity_id, created_at desc);

create index if not exists idx_platform_audit_school
  on public.platform_audit_events(school_id, created_at desc);

create index if not exists idx_platform_audit_search
  on public.platform_audit_events using gin (to_tsvector('english', summary));

-- =========================================
-- PLATFORM TIMELINE (every object has a timeline)
-- =========================================
create table if not exists public.platform_timeline_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  module text not null,
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  title text not null,
  body text not null default '',
  actor_user_id uuid references public.users(id) on delete set null,
  related_entity_type text,
  related_entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_timeline_entity
  on public.platform_timeline_events(module, entity_type, entity_id, occurred_at desc);

create index if not exists idx_platform_timeline_search
  on public.platform_timeline_events using gin (to_tsvector('english', title || ' ' || body));

-- =========================================
-- PLATFORM QUEUE (unified job tracking)
-- =========================================
create table if not exists public.platform_queue_jobs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  module text not null,
  job_type text not null,
  entity_type text,
  entity_id uuid,
  source_table text,
  source_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'retrying', 'cancelled')),
  priority integer not null default 0,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_platform_queue_status
  on public.platform_queue_jobs(status, scheduled_for)
  where status in ('pending', 'running', 'retrying');

create index if not exists idx_platform_queue_module
  on public.platform_queue_jobs(module, status);

drop trigger if exists platform_queue_jobs_set_updated_at on public.platform_queue_jobs;
create trigger platform_queue_jobs_set_updated_at
  before update on public.platform_queue_jobs
  for each row execute function public.trigger_set_updated_at();

-- =========================================
-- PLATFORM NOTIFICATION TEMPLATES (central library)
-- =========================================
create table if not exists public.platform_notification_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  module text not null,
  template_key text not null,
  name text not null,
  category text not null default 'general',
  channel text not null default 'email'
    check (channel in ('email', 'sms', 'portal_notification', 'dashboard_notification', 'teacher_portal_notification', 'push_notification')),
  subject text not null default '',
  body text not null,
  merge_fields jsonb not null default '[]'::jsonb,
  version_number integer not null default 1,
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('draft', 'testing', 'active', 'archived')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_notification_templates_key unique (school_id, module, template_key)
);

create index if not exists idx_platform_templates_module
  on public.platform_notification_templates(module, category);

drop trigger if exists platform_notification_templates_set_updated_at on public.platform_notification_templates;
create trigger platform_notification_templates_set_updated_at
  before update on public.platform_notification_templates
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.platform_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.platform_notification_templates(id) on delete cascade,
  version_number integer not null,
  subject text not null default '',
  body text not null,
  changed_by uuid references public.users(id) on delete set null,
  change_notes text,
  created_at timestamptz not null default now(),
  constraint platform_template_versions_unique unique (template_id, version_number)
);

-- =========================================
-- BUSINESS HOURS & HOLIDAYS
-- =========================================
create table if not exists public.platform_business_hours (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete cascade,
  schedule_type text not null default 'business'
    check (schedule_type in ('business', 'school', 'support')),
  timezone text not null default 'America/New_York',
  day_of_week integer not null check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_platform_business_hours_school
  on public.platform_business_hours(school_id, schedule_type);

drop trigger if exists platform_business_hours_set_updated_at on public.platform_business_hours;
create trigger platform_business_hours_set_updated_at
  before update on public.platform_business_hours
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.platform_holidays (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  name text not null,
  holiday_date date not null,
  is_school_break boolean not null default false,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_holidays_school_date
  on public.platform_holidays(school_id, holiday_date);

-- =========================================
-- PLATFORM ESCALATION RULES (generic, module-scoped)
-- =========================================
create table if not exists public.platform_escalation_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  module text not null,
  rule_key text not null,
  name text not null,
  trigger_event text not null,
  after_hours integer not null default 72 check (after_hours >= 0),
  condition_config jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_escalation_rules_key unique (school_id, module, rule_key)
);

drop trigger if exists platform_escalation_rules_set_updated_at on public.platform_escalation_rules;
create trigger platform_escalation_rules_set_updated_at
  before update on public.platform_escalation_rules
  for each row execute function public.trigger_set_updated_at();

-- =========================================
-- WORKFLOW MARKETPLACE (architecture — reusable templates)
-- =========================================
create table if not exists public.platform_workflow_marketplace (
  id uuid primary key default gen_random_uuid(),
  marketplace_key text not null unique,
  name text not null,
  description text,
  module text not null,
  category text not null,
  trigger_event text not null,
  workflow_definition jsonb not null default '{}'::jsonb,
  step_definitions jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  is_published boolean not null default true,
  install_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists platform_workflow_marketplace_set_updated_at on public.platform_workflow_marketplace;
create trigger platform_workflow_marketplace_set_updated_at
  before update on public.platform_workflow_marketplace
  for each row execute function public.trigger_set_updated_at();

-- Seed marketplace templates (architecture demonstration)
insert into public.platform_workflow_marketplace
  (marketplace_key, name, description, module, category, trigger_event, workflow_definition, step_definitions, tags)
values
  ('mp_admissions_esa_enrollment', 'ESA Enrollment Workflow', 'Florida ESA document collection and verification', 'admissions', 'funding', 'state_funding_selected',
   '{"name":"ESA Enrollment","category":"funding"}'::jsonb,
   '[{"step_type":"action","action_type":"request_document","config":{"documents":["award_letter","state_student_id"]}}]'::jsonb,
   ARRAY['esa','florida','funding']),
  ('mp_hr_teacher_onboarding', 'Teacher Hiring Onboarding', 'Employee onboarding checklist for new teachers', 'hr', 'onboarding', 'employee_hired',
   '{"name":"Teacher Onboarding","category":"hr"}'::jsonb,
   '[{"step_type":"action","action_type":"create_internal_task","config":{"task_name":"Complete background check","due_days":5}}]'::jsonb,
   ARRAY['hr','teacher','onboarding']),
  ('mp_finance_tuition_overdue', 'Tuition Overdue Reminder', 'Escalating tuition payment reminders', 'finance', 'billing', 'tuition_overdue',
   '{"name":"Tuition Overdue","category":"finance"}'::jsonb,
   '[{"step_type":"action","action_type":"send_email","config":{"template_key":"tuition_overdue_reminder"}}]'::jsonb,
   ARRAY['finance','tuition','billing']),
  ('mp_admissions_annual_reenrollment', 'Annual Re-enrollment', 'Returning family re-enrollment campaign', 'admissions', 'enrollment', 'enrollment_completed',
   '{"name":"Annual Re-enrollment","category":"enrollment"}'::jsonb,
   '[]'::jsonb,
   ARRAY['enrollment','annual','admissions'])
on conflict (marketplace_key) do update set
  name = excluded.name,
  description = excluded.description,
  step_definitions = excluded.step_definitions;

-- =========================================
-- MISSION CONTROL (role-specific ops dashboard feed)
-- =========================================
create table if not exists public.platform_mission_control_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  module text not null,
  item_type text not null
    check (item_type in (
      'pending_task', 'overdue_task', 'failed_automation', 'funding_alert',
      'scholarship_alert', 'admissions_alert', 'finance_alert', 'hr_alert',
      'scheduling_alert', 'executive_alert', 'escalation'
    )),
  severity text not null default 'normal'
    check (severity in ('low', 'normal', 'high', 'critical')),
  title text not null,
  body text not null default '',
  entity_type text,
  entity_id uuid,
  assigned_role text,
  assigned_user_id uuid references public.users(id) on delete set null,
  href text,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_mission_control_open
  on public.platform_mission_control_items(school_id, is_resolved, severity, created_at desc)
  where is_resolved = false;

create index if not exists idx_mission_control_role
  on public.platform_mission_control_items(assigned_role, is_resolved)
  where is_resolved = false;

-- Mirror admissions escalation rules into platform (one-time seed)
insert into public.platform_escalation_rules
  (school_id, module, rule_key, name, trigger_event, after_hours, actions)
select school_id, 'admissions', rule_key, name, trigger_event, after_hours, actions
from public.admissions_escalation_rules
on conflict (school_id, module, rule_key) do nothing;

notify pgrst, 'reload schema';
