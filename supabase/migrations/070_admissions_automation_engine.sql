-- =========================================
-- ADMISSIONS AUTOMATION ENGINE (070)
-- Configurable workflows, audit, interviews, template versions
-- Idempotent: safe to re-run
-- =========================================

-- Extend communication templates for template manager
alter table public.admissions_communication_templates
  add column if not exists category text not null default 'general';

alter table public.admissions_communication_templates
  add column if not exists version_number integer not null default 1;

alter table public.admissions_communication_templates
  add column if not exists description text;

-- Template version history
create table if not exists public.admissions_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.admissions_communication_templates(id) on delete cascade,
  version_number integer not null,
  subject text not null default '',
  body text not null,
  changed_by uuid references public.users(id) on delete set null,
  change_notes text,
  created_at timestamptz not null default now(),
  constraint admissions_template_versions_unique unique (template_id, version_number)
);

-- Interviews (first-class entity for automation triggers)
create table if not exists public.admissions_interviews (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.admissions_leads(id) on delete cascade,
  application_id uuid references public.admissions_applications(id) on delete set null,
  scheduled_at timestamptz not null,
  completed_at timestamptz,
  interview_type text not null default 'virtual'
    check (interview_type in ('virtual', 'in_person', 'phone')),
  interview_status text not null default 'scheduled'
    check (interview_status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  campus_id uuid references public.campuses(id) on delete set null,
  host_user_id uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admissions_interviews_lead
  on public.admissions_interviews(lead_id);

drop trigger if exists admissions_interviews_set_updated_at on public.admissions_interviews;
create trigger admissions_interviews_set_updated_at
  before update on public.admissions_interviews
  for each row execute function public.trigger_set_updated_at();

-- Configurable workflow definitions
create table if not exists public.admissions_workflows (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  workflow_key text not null,
  name text not null,
  description text,
  trigger_event text not null,
  category text not null default 'general',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  version_number integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admissions_workflows_key_unique unique (school_id, workflow_key)
);

create index if not exists idx_admissions_workflows_trigger
  on public.admissions_workflows(trigger_event, is_active);

drop trigger if exists admissions_workflows_set_updated_at on public.admissions_workflows;
create trigger admissions_workflows_set_updated_at
  before update on public.admissions_workflows
  for each row execute function public.trigger_set_updated_at();

-- Workflow steps (conditions, actions, delays, notifications, escalations)
create table if not exists public.admissions_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.admissions_workflows(id) on delete cascade,
  step_order integer not null default 0,
  step_type text not null
    check (step_type in ('condition', 'action', 'delay', 'notification', 'escalation')),
  action_type text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workflow_steps_workflow
  on public.admissions_workflow_steps(workflow_id, step_order);

drop trigger if exists admissions_workflow_steps_set_updated_at on public.admissions_workflow_steps;
create trigger admissions_workflow_steps_set_updated_at
  before update on public.admissions_workflow_steps
  for each row execute function public.trigger_set_updated_at();

-- Workflow execution log
create table if not exists public.admissions_workflow_executions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.admissions_workflows(id) on delete set null,
  lead_id uuid not null references public.admissions_leads(id) on delete cascade,
  application_id uuid references public.admissions_applications(id) on delete set null,
  trigger_event text not null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'cancelled', 'partial')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflow_executions_lead
  on public.admissions_workflow_executions(lead_id, started_at desc);

create index if not exists idx_workflow_executions_status
  on public.admissions_workflow_executions(status, started_at desc);

-- Workflow queue (delays, retries, escalations)
create table if not exists public.admissions_workflow_queue (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid references public.admissions_workflow_executions(id) on delete cascade,
  workflow_id uuid references public.admissions_workflows(id) on delete set null,
  workflow_step_id uuid references public.admissions_workflow_steps(id) on delete set null,
  lead_id uuid not null references public.admissions_leads(id) on delete cascade,
  application_id uuid references public.admissions_applications(id) on delete set null,
  trigger_event text not null,
  step_payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workflow_queue_scheduled
  on public.admissions_workflow_queue(scheduled_for)
  where status in ('pending', 'processing');

create index if not exists idx_workflow_queue_lead
  on public.admissions_workflow_queue(lead_id);

drop trigger if exists admissions_workflow_queue_set_updated_at on public.admissions_workflow_queue;
create trigger admissions_workflow_queue_set_updated_at
  before update on public.admissions_workflow_queue
  for each row execute function public.trigger_set_updated_at();

-- Escalation rules (configurable per school)
create table if not exists public.admissions_escalation_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  rule_key text not null,
  name text not null,
  trigger_event text not null,
  after_hours integer not null default 72 check (after_hours >= 0),
  condition_config jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admissions_escalation_rules_key_unique unique (school_id, rule_key)
);

drop trigger if exists admissions_escalation_rules_set_updated_at on public.admissions_escalation_rules;
create trigger admissions_escalation_rules_set_updated_at
  before update on public.admissions_escalation_rules
  for each row execute function public.trigger_set_updated_at();

-- Comprehensive automation audit log
create table if not exists public.admissions_automation_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  lead_id uuid references public.admissions_leads(id) on delete set null,
  application_id uuid references public.admissions_applications(id) on delete set null,
  execution_id uuid references public.admissions_workflow_executions(id) on delete set null,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  event_category text not null default 'automation',
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_audit_lead
  on public.admissions_automation_audit_log(lead_id, created_at desc);

create index if not exists idx_automation_audit_school
  on public.admissions_automation_audit_log(school_id, created_at desc);

-- Backfill template categories
update public.admissions_communication_templates set category = 'inquiry'
  where trigger_event in ('inquiry_submitted', 'staff_new_inquiry') and category = 'general';
update public.admissions_communication_templates set category = 'tour'
  where trigger_event like 'tour_%' and category = 'general';
update public.admissions_communication_templates set category = 'application'
  where trigger_event like 'application_%' and category = 'general';
update public.admissions_communication_templates set category = 'funding'
  where trigger_event like '%funding%' or trigger_event like 'state_%' and category = 'general';
update public.admissions_communication_templates set category = 'financial_aid'
  where trigger_event like 'financial_%' and category = 'general';
update public.admissions_communication_templates set category = 'interview'
  where trigger_event like 'interview_%' and category = 'general';
update public.admissions_communication_templates set category = 'acceptance'
  where trigger_event in ('student_accepted', 'staff_application_accepted') and category = 'general';
update public.admissions_communication_templates set category = 'waitlist'
  where trigger_event = 'student_waitlisted' and category = 'general';
update public.admissions_communication_templates set category = 'denial'
  where trigger_event = 'student_declined' and category = 'general';
update public.admissions_communication_templates set category = 'enrollment'
  where trigger_event = 'enrollment_completed' and category = 'general';

-- Seed default org-wide workflows (configurable by admins)
insert into public.admissions_workflows
  (school_id, workflow_key, name, description, trigger_event, category, sort_order)
values
  (null, 'wf_inquiry_submitted', 'Inquiry Submitted Automation', 'Thank parent, notify staff, create follow-up task', 'inquiry_submitted', 'inquiry', 10),
  (null, 'wf_tour_scheduled', 'Tour Scheduled Automation', 'Confirm tour, schedule reminders, assign staff', 'tour_scheduled', 'tour', 20),
  (null, 'wf_application_started', 'Application Started Automation', 'Welcome email, incomplete reminders, staff alert', 'application_started', 'application', 30),
  (null, 'wf_application_submitted', 'Application Submitted Automation', 'Confirmation, staff review task', 'application_submitted', 'application', 40),
  (null, 'wf_documents_uploaded', 'Documents Uploaded Automation', 'Notify staff, check missing documents', 'documents_uploaded', 'application', 50),
  (null, 'wf_funding_verified', 'Funding Verified Automation', 'Notify parent and staff', 'funding_verified', 'funding', 60),
  (null, 'wf_funding_rejected', 'Funding Rejected Automation', 'Request corrections from parent', 'funding_rejected', 'funding', 70),
  (null, 'wf_interview_scheduled', 'Interview Scheduled Automation', 'Confirm interview, schedule reminders', 'interview_scheduled', 'interview', 80),
  (null, 'wf_accepted', 'Student Accepted Automation', 'Congratulations, enrollment packet, staff tasks', 'accepted', 'acceptance', 90),
  (null, 'wf_waitlisted', 'Waitlisted Automation', 'Waitlist notification and monthly follow-up', 'waitlisted', 'waitlist', 100),
  (null, 'wf_declined', 'Declined Automation', 'Respectful decision letter', 'declined', 'denial', 110),
  (null, 'wf_enrollment_completed', 'Enrollment Completed Automation', 'Welcome and onboarding communications', 'enrollment_completed', 'enrollment', 120)
on conflict (school_id, workflow_key) do update set
  name = excluded.name,
  description = excluded.description,
  trigger_event = excluded.trigger_event,
  category = excluded.category;

-- Seed workflow steps for inquiry_submitted
insert into public.admissions_workflow_steps (workflow_id, step_order, step_type, action_type, config)
select w.id, s.step_order, s.step_type, s.action_type, s.config::jsonb
from public.admissions_workflows w
cross join (values
  (1, 'action', 'trigger_communications', '{"events":["inquiry_submitted","staff_new_inquiry"]}'),
  (2, 'action', 'create_internal_task', '{"task_name":"Follow up on new inquiry","due_days":1,"assign_to":"assigned_counselor"}'),
  (3, 'action', 'audit_log_entry', '{"summary":"Inquiry automation completed"}')
) as s(step_order, step_type, action_type, config)
where w.workflow_key = 'wf_inquiry_submitted'
  and not exists (
    select 1 from public.admissions_workflow_steps ws where ws.workflow_id = w.id
  );

insert into public.admissions_workflow_steps (workflow_id, step_order, step_type, action_type, config)
select w.id, s.step_order, s.step_type, s.action_type, s.config::jsonb
from public.admissions_workflows w
cross join (values
  (1, 'action', 'trigger_communications', '{"events":["tour_scheduled"],"schedule_tour_reminders":true}'),
  (2, 'action', 'create_internal_task', '{"task_name":"Prepare for campus tour","due_days":0,"assign_to":"assigned_counselor"}'),
  (3, 'action', 'audit_log_entry', '{"summary":"Tour scheduled automation completed"}')
) as s(step_order, step_type, action_type, config)
where w.workflow_key = 'wf_tour_scheduled'
  and not exists (select 1 from public.admissions_workflow_steps ws where ws.workflow_id = w.id);

insert into public.admissions_workflow_steps (workflow_id, step_order, step_type, action_type, config)
select w.id, s.step_order, s.step_type, s.action_type, s.config::jsonb
from public.admissions_workflows w
cross join (values
  (1, 'action', 'sync_checklist', '{}'),
  (2, 'action', 'trigger_communications', '{"events":["application_started","staff_application_started"],"schedule_incomplete_reminders":true,"state_funding_check":true}'),
  (3, 'action', 'audit_log_entry', '{"summary":"Application started automation completed"}')
) as s(step_order, step_type, action_type, config)
where w.workflow_key = 'wf_application_started'
  and not exists (select 1 from public.admissions_workflow_steps ws where ws.workflow_id = w.id);

insert into public.admissions_workflow_steps (workflow_id, step_order, step_type, action_type, config)
select w.id, s.step_order, s.step_type, s.action_type, s.config::jsonb
from public.admissions_workflows w
cross join (values
  (1, 'action', 'trigger_communications', '{"events":["application_submitted","staff_application_submitted"]}'),
  (2, 'action', 'create_internal_task', '{"task_name":"Review submitted application","due_days":2,"assign_to":"assigned_counselor"}'),
  (3, 'action', 'audit_log_entry', '{"summary":"Application submitted automation completed"}')
) as s(step_order, step_type, action_type, config)
where w.workflow_key = 'wf_application_submitted'
  and not exists (select 1 from public.admissions_workflow_steps ws where ws.workflow_id = w.id);

insert into public.admissions_workflow_steps (workflow_id, step_order, step_type, action_type, config)
select w.id, s.step_order, s.step_type, s.action_type, s.config::jsonb
from public.admissions_workflows w
cross join (values
  (1, 'action', 'trigger_communications', '{"events":["staff_documents_uploaded"],"check_missing_documents":true}'),
  (2, 'action', 'audit_log_entry', '{"summary":"Documents uploaded automation completed"}')
) as s(step_order, step_type, action_type, config)
where w.workflow_key = 'wf_documents_uploaded'
  and not exists (select 1 from public.admissions_workflow_steps ws where ws.workflow_id = w.id);

insert into public.admissions_workflow_steps (workflow_id, step_order, step_type, action_type, config)
select w.id, s.step_order, s.step_type, s.action_type, s.config::jsonb
from public.admissions_workflows w
cross join (values
  (1, 'action', 'trigger_communications', '{"events":["funding_verification_approved","staff_funding_verified"]}'),
  (2, 'action', 'audit_log_entry', '{"summary":"Funding verified automation completed"}')
) as s(step_order, step_type, action_type, config)
where w.workflow_key = 'wf_funding_verified'
  and not exists (select 1 from public.admissions_workflow_steps ws where ws.workflow_id = w.id);

insert into public.admissions_workflow_steps (workflow_id, step_order, step_type, action_type, config)
select w.id, s.step_order, s.step_type, s.action_type, s.config::jsonb
from public.admissions_workflows w
cross join (values
  (1, 'action', 'trigger_communications', '{"events":["funding_verification_rejected"]}'),
  (2, 'action', 'create_internal_task', '{"task_name":"Follow up on funding rejection","due_days":3}'),
  (3, 'action', 'audit_log_entry', '{"summary":"Funding rejected automation completed"}')
) as s(step_order, step_type, action_type, config)
where w.workflow_key = 'wf_funding_rejected'
  and not exists (select 1 from public.admissions_workflow_steps ws where ws.workflow_id = w.id);

insert into public.admissions_workflow_steps (workflow_id, step_order, step_type, action_type, config)
select w.id, s.step_order, s.step_type, s.action_type, s.config::jsonb
from public.admissions_workflows w
cross join (values
  (1, 'action', 'trigger_communications', '{"events":["interview_scheduled","staff_interview_scheduled"],"schedule_interview_reminders":true}'),
  (2, 'action', 'create_internal_task', '{"task_name":"Prepare for admissions interview","due_days":0}'),
  (3, 'action', 'audit_log_entry', '{"summary":"Interview scheduled automation completed"}')
) as s(step_order, step_type, action_type, config)
where w.workflow_key = 'wf_interview_scheduled'
  and not exists (select 1 from public.admissions_workflow_steps ws where ws.workflow_id = w.id);

insert into public.admissions_workflow_steps (workflow_id, step_order, step_type, action_type, config)
select w.id, s.step_order, s.step_type, s.action_type, s.config::jsonb
from public.admissions_workflows w
cross join (values
  (1, 'action', 'trigger_communications', '{"events":["student_accepted","staff_application_accepted"]}'),
  (2, 'action', 'generate_enrollment_packet', '{}'),
  (3, 'action', 'create_internal_task', '{"task_name":"Enrollment follow-up — accepted student","due_days":3}'),
  (4, 'action', 'audit_log_entry', '{"summary":"Acceptance automation completed"}')
) as s(step_order, step_type, action_type, config)
where w.workflow_key = 'wf_accepted'
  and not exists (select 1 from public.admissions_workflow_steps ws where ws.workflow_id = w.id);

insert into public.admissions_workflow_steps (workflow_id, step_order, step_type, action_type, config)
select w.id, s.step_order, s.step_type, s.action_type, s.config::jsonb
from public.admissions_workflows w
cross join (values
  (1, 'action', 'trigger_communications', '{"events":["student_waitlisted"]}'),
  (2, 'delay', null, '{"delay_hours":720,"resume_action":"trigger_communications","resume_config":{"events":["student_waitlisted"]}}'),
  (3, 'action', 'audit_log_entry', '{"summary":"Waitlist automation completed"}')
) as s(step_order, step_type, action_type, config)
where w.workflow_key = 'wf_waitlisted'
  and not exists (select 1 from public.admissions_workflow_steps ws where ws.workflow_id = w.id);

insert into public.admissions_workflow_steps (workflow_id, step_order, step_type, action_type, config)
select w.id, s.step_order, s.step_type, s.action_type, s.config::jsonb
from public.admissions_workflows w
cross join (values
  (1, 'action', 'trigger_communications', '{"events":["student_declined"]}'),
  (2, 'action', 'audit_log_entry', '{"summary":"Decline automation completed"}')
) as s(step_order, step_type, action_type, config)
where w.workflow_key = 'wf_declined'
  and not exists (select 1 from public.admissions_workflow_steps ws where ws.workflow_id = w.id);

insert into public.admissions_workflow_steps (workflow_id, step_order, step_type, action_type, config)
select w.id, s.step_order, s.step_type, s.action_type, s.config::jsonb
from public.admissions_workflows w
cross join (values
  (1, 'action', 'trigger_communications', '{"events":["enrollment_completed"]}'),
  (2, 'action', 'audit_log_entry', '{"summary":"Enrollment completed automation completed"}')
) as s(step_order, step_type, action_type, config)
where w.workflow_key = 'wf_enrollment_completed'
  and not exists (select 1 from public.admissions_workflow_steps ws where ws.workflow_id = w.id);

-- Default escalation rules
insert into public.admissions_escalation_rules
  (school_id, rule_key, name, trigger_event, after_hours, actions)
values
  (null, 'esc_application_incomplete', 'Application Incomplete Escalation', 'application_started', 168,
   '[{"type":"notify_admissions"},{"type":"create_internal_task","task_name":"Escalation: incomplete application","due_days":1},{"type":"notify_school_leader"}]'::jsonb),
  (null, 'esc_missing_documents', 'Missing Documents Escalation', 'missing_documents', 120,
   '[{"type":"notify_admissions"},{"type":"create_internal_task","task_name":"Escalation: missing documents","due_days":1}]'::jsonb),
  (null, 'esc_no_parent_response', 'No Parent Response Escalation', 'additional_info_requested', 168,
   '[{"type":"notify_school_leader"},{"type":"create_internal_task","task_name":"Escalation: no parent response","due_days":0},{"type":"flag_executive_dashboard"}]'::jsonb)
on conflict (school_id, rule_key) do update set
  name = excluded.name,
  after_hours = excluded.after_hours,
  actions = excluded.actions;

notify pgrst, 'reload schema';
