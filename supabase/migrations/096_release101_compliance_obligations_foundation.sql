-- =========================================
-- RELEASE 10.1: ENTERPRISE COMPLIANCE & OBLIGATION MANAGEMENT
-- Central deadline engine — idempotent, extends (does not replace) existing systems
-- =========================================

-- ---------------------------------------------------------------------------
-- 1. Categories (seeded + unlimited admin-created)
-- ---------------------------------------------------------------------------

create table if not exists public.compliance_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.compliance_categories(id) on delete set null,
  category_key text not null unique,
  name text not null,
  description text,
  domain text not null default 'general'
    check (domain in (
      'governance', 'accreditation', 'licensing', 'insurance', 'hr', 'finance',
      'facilities', 'technology', 'student_services', 'general'
    )),
  sort_order integer not null default 0,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_compliance_categories_parent on public.compliance_categories(parent_id, sort_order);

-- ---------------------------------------------------------------------------
-- 2. Admin configuration
-- ---------------------------------------------------------------------------

create table if not exists public.compliance_reminder_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  name text not null default 'Default',
  days_before integer[] not null default array[180,120,90,60,45,30,21,14,7,3,1,0],
  notify_daily_when_overdue boolean not null default true,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.compliance_escalation_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  name text not null default 'Default escalation',
  days_overdue integer not null,
  escalate_to_role text not null,
  severity text not null default 'normal'
    check (severity in ('low', 'normal', 'high', 'critical')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.compliance_obligation_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  category_id uuid references public.compliance_categories(id) on delete set null,
  title text not null,
  description text,
  default_frequency text not null default 'annual',
  default_priority text not null default 'normal',
  default_risk_level text not null default 'medium',
  required_document_types text[] not null default '{}',
  default_reminder_schedule_id uuid references public.compliance_reminder_schedules(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Obligations (single source of truth)
-- ---------------------------------------------------------------------------

create table if not exists public.compliance_obligations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  department text,
  program text,
  category_id uuid references public.compliance_categories(id) on delete set null,
  template_id uuid references public.compliance_obligation_templates(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'critical')),
  risk_level text not null default 'medium'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  status text not null default 'pending'
    check (status in (
      'draft', 'pending', 'in_review', 'approved', 'completed', 'overdue',
      'waived', 'cancelled', 'archived'
    )),
  frequency text not null default 'one_time'
    check (frequency in (
      'one_time', 'daily', 'weekly', 'monthly', 'quarterly', 'semiannual',
      'annual', 'every_x_days', 'custom_rrule'
    )),
  frequency_interval integer,
  rrule text,
  due_date date not null,
  completion_date date,
  owner_user_id uuid references public.users(id) on delete set null,
  backup_owner_user_id uuid references public.users(id) on delete set null,
  reviewer_user_id uuid references public.users(id) on delete set null,
  approver_user_id uuid references public.users(id) on delete set null,
  notes text,
  workflow_key text,
  approval_request_id uuid references public.platform_approval_requests(id) on delete set null,
  mission_control_item_id uuid,
  source_module text,
  source_entity_type text,
  source_entity_id uuid,
  parent_obligation_id uuid references public.compliance_obligations(id) on delete set null,
  occurrence_number integer not null default 1,
  reminder_schedule_id uuid references public.compliance_reminder_schedules(id) on delete set null,
  linked_policy_refs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_module, source_entity_type, source_entity_id, occurrence_number)
);

create index if not exists idx_compliance_obligations_due on public.compliance_obligations(school_id, due_date, status);
create index if not exists idx_compliance_obligations_owner on public.compliance_obligations(owner_user_id, status);
create index if not exists idx_compliance_obligations_overdue on public.compliance_obligations(status, due_date) where status in ('pending', 'overdue', 'in_review');

drop trigger if exists compliance_obligations_set_updated_at on public.compliance_obligations;
create trigger compliance_obligations_set_updated_at
  before update on public.compliance_obligations
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Documents, reminders, audit
-- ---------------------------------------------------------------------------

create table if not exists public.compliance_obligation_documents (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.compliance_obligations(id) on delete cascade,
  document_type text not null
    check (document_type in (
      'pdf', 'inspection_report', 'license', 'insurance_certificate',
      'signed_form', 'photo', 'spreadsheet', 'other'
    )),
  file_name text not null,
  storage_path text not null,
  version_number integer not null default 1,
  signature_id uuid references public.platform_digital_signatures(id) on delete set null,
  is_required boolean not null default false,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_compliance_obligation_documents_ob on public.compliance_obligation_documents(obligation_id);

create table if not exists public.compliance_obligation_reminders (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.compliance_obligations(id) on delete cascade,
  days_before integer not null,
  reminder_date date not null,
  channel text not null default 'mission_control'
    check (channel in ('email', 'sms', 'portal_notification', 'mission_control', 'push_notification')),
  recipient_user_id uuid references public.users(id) on delete set null,
  recipient_role text,
  sent_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  created_at timestamptz not null default now()
);

create index if not exists idx_compliance_obligation_reminders_pending
  on public.compliance_obligation_reminders(status, reminder_date) where status = 'pending';

create table if not exists public.compliance_obligation_escalations (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.compliance_obligations(id) on delete cascade,
  days_overdue integer not null,
  escalated_to_role text not null,
  escalated_at timestamptz not null default now(),
  mission_control_item_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.compliance_audit_log (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.compliance_obligations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  action_type text not null,
  actor_user_id uuid references public.users(id) on delete set null,
  summary text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_compliance_audit_ob on public.compliance_audit_log(obligation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Calendar linkage
-- ---------------------------------------------------------------------------

create table if not exists public.compliance_calendar_links (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.compliance_obligations(id) on delete cascade,
  calendar_id uuid references public.academic_calendars(id) on delete cascade,
  calendar_event_id uuid references public.academic_calendar_events(id) on delete set null,
  calendar_scope text not null default 'school'
    check (calendar_scope in ('enterprise', 'school', 'department', 'executive')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Executive compliance scores
-- ---------------------------------------------------------------------------

create table if not exists public.compliance_domain_scores (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  score_date date not null default current_date,
  domain text not null,
  score_pct numeric(5, 2) not null default 0,
  status_indicator text not null default 'yellow'
    check (status_indicator in ('green', 'yellow', 'red')),
  total_obligations integer not null default 0,
  completed_obligations integer not null default 0,
  overdue_obligations integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (school_id, score_date, domain)
);

-- ---------------------------------------------------------------------------
-- 7. Permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('compliance.view', 'Compliance View', 'View compliance center and obligations', 'compliance', 'compliance', 400),
  ('compliance.manage', 'Compliance Manage', 'Create and update obligations', 'compliance', 'compliance', 401),
  ('compliance.admin', 'Compliance Admin', 'Configure reminders, escalation, categories', 'compliance', 'compliance', 402),
  ('compliance.reports', 'Compliance Reports', 'Export compliance reports', 'compliance', 'compliance', 403)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR', 'SCHOOL_LEADER', 'HR')
  and p.permission_key in ('compliance.view', 'compliance.manage', 'compliance.reports')
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
  and p.permission_key = 'compliance.admin'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 8. Seed categories
-- ---------------------------------------------------------------------------

insert into public.compliance_categories (category_key, name, domain, is_system, sort_order) values
  ('governance', 'Governance', 'governance', true, 10),
  ('board_meetings', 'Board Meetings', 'governance', true, 11),
  ('board_policies', 'Board Policies', 'governance', true, 12),
  ('strategic_planning', 'Strategic Planning', 'governance', true, 13),
  ('accreditation', 'Accreditation', 'accreditation', true, 20),
  ('school_approval', 'School Approval', 'accreditation', true, 21),
  ('evidence_collection', 'Evidence Collection', 'accreditation', true, 22),
  ('site_visits', 'Site Visits', 'accreditation', true, 23),
  ('self_study', 'Self Study', 'accreditation', true, 24),
  ('licensing_business', 'Business License', 'licensing', true, 30),
  ('licensing_facility', 'Facility License', 'licensing', true, 31),
  ('licensing_state', 'State Approval', 'licensing', true, 32),
  ('insurance_general', 'General Liability', 'insurance', true, 40),
  ('insurance_professional', 'Professional Liability', 'insurance', true, 41),
  ('insurance_property', 'Property', 'insurance', true, 42),
  ('insurance_cyber', 'Cyber', 'insurance', true, 43),
  ('insurance_workers_comp', 'Workers Compensation', 'insurance', true, 44),
  ('insurance_student_accident', 'Student Accident', 'insurance', true, 45),
  ('insurance_vehicle', 'Vehicle', 'insurance', true, 46),
  ('hr_evaluations', 'Employee Evaluations', 'hr', true, 50),
  ('hr_teaching_license', 'Teaching License', 'hr', true, 51),
  ('hr_therapy_license', 'Therapy License', 'hr', true, 52),
  ('hr_cpr', 'CPR', 'hr', true, 53),
  ('hr_first_aid', 'First Aid', 'hr', true, 54),
  ('hr_background_check', 'Background Checks', 'hr', true, 55),
  ('hr_fingerprinting', 'Fingerprinting', 'hr', true, 56),
  ('hr_mandatory_training', 'Mandatory Training', 'hr', true, 57),
  ('finance_audit', 'Audit', 'finance', true, 60),
  ('finance_irs', 'IRS Filing', 'finance', true, 61),
  ('finance_state_filing', 'State Filing', 'finance', true, 62),
  ('finance_grant_reporting', 'Grant Reporting', 'finance', true, 63),
  ('finance_scholarship_reporting', 'Scholarship Reporting', 'finance', true, 64),
  ('finance_state_funding_recon', 'State Funding Reconciliation', 'finance', true, 65),
  ('facilities_fire', 'Fire Inspection', 'facilities', true, 70),
  ('facilities_hvac', 'HVAC', 'facilities', true, 71),
  ('facilities_elevator', 'Elevator', 'facilities', true, 72),
  ('facilities_security', 'Security', 'facilities', true, 73),
  ('facilities_playground', 'Playground', 'facilities', true, 74),
  ('facilities_vehicle', 'Vehicle Inspection', 'facilities', true, 75),
  ('tech_domain', 'Domain Renewal', 'technology', true, 80),
  ('tech_ssl', 'SSL Certificate', 'technology', true, 81),
  ('tech_software_license', 'Software License', 'technology', true, 82),
  ('tech_vendor_contracts', 'Vendor Contracts', 'technology', true, 83),
  ('tech_backups', 'Backups', 'technology', true, 84),
  ('student_iep', 'IEP Reviews', 'student_services', true, 90),
  ('student_504', '504 Reviews', 'student_services', true, 91),
  ('student_medical', 'Medical Plans', 'student_services', true, 92),
  ('student_immunizations', 'Immunizations', 'student_services', true, 93),
  ('student_reevaluations', 'Reevaluations', 'student_services', true, 94)
on conflict (category_key) do nothing;

-- Default reminder schedule (network-wide)
insert into public.compliance_reminder_schedules (name, is_default, days_before)
select 'Default Network Schedule', true, array[180,120,90,60,45,30,21,14,7,3,1,0]
where not exists (select 1 from public.compliance_reminder_schedules where is_default = true);

-- Default escalation rules
insert into public.compliance_escalation_rules (days_overdue, escalate_to_role, sort_order)
select v.days_overdue, v.escalate_to_role, v.sort_order
from (values
  (7, 'SCHOOL_LEADER', 1),
  (14, 'SCHOOL_LEADER', 2),
  (21, 'EXECUTIVE_DIRECTOR', 3),
  (30, 'EXECUTIVE_DIRECTOR', 4),
  (45, 'CEO', 5)
) as v(days_overdue, escalate_to_role, sort_order)
where not exists (select 1 from public.compliance_escalation_rules limit 1);

-- Reporting view
create or replace view public.rpt_compliance_summary as
select
  o.school_id,
  sch.name as school_name,
  c.domain,
  c.name as category_name,
  o.department,
  o.status,
  o.risk_level,
  o.priority,
  count(*) as obligation_count,
  count(*) filter (where o.status = 'completed') as completed_count,
  count(*) filter (where o.status = 'overdue' or (o.status = 'pending' and o.due_date < current_date)) as overdue_count,
  count(*) filter (where o.due_date between current_date and current_date + 30) as due_next_30
from public.compliance_obligations o
left join public.compliance_categories c on c.id = o.category_id
left join public.schools sch on sch.id = o.school_id
where o.status not in ('archived', 'cancelled', 'waived')
group by o.school_id, sch.name, c.domain, c.name, o.department, o.status, o.risk_level, o.priority;

grant select on public.rpt_compliance_summary to authenticated;
