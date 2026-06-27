-- =========================================
-- SSIS: STUDENT SUCCESS INFORMATION SYSTEM
-- Lifecycle, family center, funding, timeline,
-- success score, parent engagement, extensions
-- Idempotent: safe to re-run
-- =========================================

-- ---------------------------------------------------------------------------
-- Lifecycle stage (Transition Engine)
-- ---------------------------------------------------------------------------

alter table public.students
  add column if not exists lifecycle_stage text not null default 'active'
    check (lifecycle_stage in (
      'inquiry', 'applicant', 'accepted', 'enrolled', 'active',
      'graduating', 'withdrawn', 'alumni'
    ));

create index if not exists idx_students_lifecycle_stage
  on public.students(lifecycle_stage);

create table if not exists public.ssis_lifecycle_transitions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  from_stage text not null,
  to_stage text not null,
  trigger_source text not null default 'manual'
    check (trigger_source in ('manual', 'admissions', 'automation', 'workflow', 'system')),
  triggered_by uuid references public.users(id) on delete set null,
  workflow_execution_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ssis_lifecycle_transitions_student
  on public.ssis_lifecycle_transitions(student_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Family Relationship Center
-- ---------------------------------------------------------------------------

alter table public.guardians
  add column if not exists communication_preferences jsonb not null default '{}'::jsonb;

alter table public.guardians
  add column if not exists financial_responsibility_percent numeric(5, 2)
    check (financial_responsibility_percent is null or financial_responsibility_percent between 0 and 100);

alter table public.guardians
  add column if not exists household_id uuid references public.family_households(id) on delete set null;

alter table public.student_authorized_contacts
  drop constraint if exists student_authorized_contacts_contact_type_check;

alter table public.student_authorized_contacts
  add constraint student_authorized_contacts_contact_type_check
  check (contact_type in (
    'mother', 'father', 'guardian', 'parent', 'grandparent', 'foster_parent',
    'case_worker', 'advocate', 'attorney', 'therapist', 'transportation',
    'emergency', 'other'
  ));

alter table public.guardians
  drop constraint if exists guardians_contact_type_check;

alter table public.guardians
  add constraint guardians_contact_type_check
  check (contact_type in (
    'mother', 'father', 'guardian', 'parent', 'grandparent', 'foster_parent',
    'case_worker', 'advocate', 'attorney', 'therapist', 'transportation',
    'emergency', 'other'
  ));

create table if not exists public.ssis_student_sibling_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  sibling_student_id uuid not null references public.students(id) on delete cascade,
  relationship_label text not null default 'sibling',
  created_at timestamptz not null default now(),
  constraint ssis_sibling_links_unique unique (student_id, sibling_student_id),
  constraint ssis_sibling_links_not_self check (student_id <> sibling_student_id)
);

create index if not exists idx_ssis_sibling_links_student
  on public.ssis_student_sibling_links(student_id);

-- ---------------------------------------------------------------------------
-- Medical Center extensions
-- ---------------------------------------------------------------------------

alter table public.student_medical_profiles
  add column if not exists dietary_restrictions jsonb not null default '[]'::jsonb;

alter table public.student_medical_profiles
  add column if not exists primary_physician jsonb not null default '{}'::jsonb;

create table if not exists public.ssis_medication_administration_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  medication_name text not null,
  dosage text,
  administered_at timestamptz not null default now(),
  administered_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ssis_med_admin_student
  on public.ssis_medication_administration_logs(student_id, administered_at desc);

alter table public.student_documents
  add column if not exists expires_at date;

alter table public.student_documents
  add column if not exists version_number integer not null default 1;

alter table public.student_documents
  add column if not exists parent_document_id uuid
    references public.student_documents(id) on delete set null;

alter table public.student_documents
  add column if not exists signature_id uuid
    references public.platform_digital_signatures(id) on delete set null;

create table if not exists public.ssis_medical_expiry_alerts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  document_id uuid references public.student_documents(id) on delete cascade,
  alert_type text not null default 'document_expiry',
  expires_on date not null,
  notified_at timestamptz,
  mission_control_item_id uuid,
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ssis_medical_expiry_alerts_unique unique (student_id, document_id, expires_on)
);

-- ---------------------------------------------------------------------------
-- Special Education Center extensions
-- ---------------------------------------------------------------------------

alter table public.student_special_education_plans
  add column if not exists present_levels jsonb not null default '{}'::jsonb;

alter table public.student_special_education_plans
  add column if not exists progress_monitoring jsonb not null default '[]'::jsonb;

alter table public.student_special_education_plans
  add column if not exists meeting_dates jsonb not null default '[]'::jsonb;

create table if not exists public.ssis_sped_objectives (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  plan_id uuid not null references public.student_special_education_plans(id) on delete cascade,
  goal_id uuid references public.student_special_education_goals(id) on delete set null,
  objective_text text not null,
  target_date date,
  progress_notes text,
  status text not null default 'active'
    check (status in ('active', 'met', 'discontinued')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ssis_sped_objectives_plan
  on public.ssis_sped_objectives(plan_id);

drop trigger if exists ssis_sped_objectives_set_updated_at on public.ssis_sped_objectives;
create trigger ssis_sped_objectives_set_updated_at
  before update on public.ssis_sped_objectives
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Academic Growth Center
-- ---------------------------------------------------------------------------

create table if not exists public.ssis_academic_observations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  observed_by uuid references public.users(id) on delete set null,
  domain text not null,
  observation_text text not null,
  observed_at timestamptz not null default now(),
  school_year_id uuid references public.school_years(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ssis_academic_observations_student
  on public.ssis_academic_observations(student_id, observed_at desc);

create table if not exists public.ssis_academic_artifacts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  artifact_type text not null default 'work_sample',
  storage_path text,
  file_name text,
  linked_assessment_id uuid references public.student_academic_assessments(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ssis_academic_artifacts_student
  on public.ssis_academic_artifacts(student_id);

drop trigger if exists ssis_academic_artifacts_set_updated_at on public.ssis_academic_artifacts;
create trigger ssis_academic_artifacts_set_updated_at
  before update on public.ssis_academic_artifacts
  for each row execute function public.trigger_set_updated_at();

-- Extend assessment types
alter table public.student_academic_assessments
  drop constraint if exists student_academic_assessments_assessment_type_check;

alter table public.student_academic_assessments
  add constraint student_academic_assessments_assessment_type_check
  check (assessment_type in (
    'map_reading', 'map_math', 'map_language', 'benchmark', 'progress_monitor',
    'curriculum', 'teacher_observation', 'other'
  ));

-- ---------------------------------------------------------------------------
-- Attendance Center extensions
-- ---------------------------------------------------------------------------

alter table public.student_attendance_records
  drop constraint if exists student_attendance_records_status_check;

alter table public.student_attendance_records
  add constraint student_attendance_records_status_check
  check (status in (
    'present', 'virtual_present', 'therapy_present',
    'absent_excused', 'absent_unexcused', 'tardy', 'early_dismissal'
  ));

alter table public.student_attendance_records
  add column if not exists attendance_context text not null default 'daily'
    check (attendance_context in ('daily', 'period', 'virtual', 'therapy'));

alter table public.student_attendance_records
  add column if not exists parent_notified boolean not null default false;

-- ---------------------------------------------------------------------------
-- Behavior & Student Support extensions
-- ---------------------------------------------------------------------------

create table if not exists public.ssis_behavior_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  plan_summary text,
  strategies jsonb not null default '[]'::jsonb,
  start_date date,
  end_date date,
  status text not null default 'active'
    check (status in ('draft', 'active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ssis_behavior_plans_student
  on public.ssis_behavior_plans(student_id);

drop trigger if exists ssis_behavior_plans_set_updated_at on public.ssis_behavior_plans;
create trigger ssis_behavior_plans_set_updated_at
  before update on public.ssis_behavior_plans
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Student Services extensions
-- ---------------------------------------------------------------------------

alter table public.student_service_sessions
  drop constraint if exists student_service_sessions_service_type_check;

alter table public.student_service_sessions
  add constraint student_service_sessions_service_type_check
  check (service_type in (
    'speech', 'occupational_therapy', 'physical_therapy', 'counseling',
    'behavior_support', 'reading_intervention', 'math_intervention',
    'tutoring', 'other'
  ));

alter table public.student_service_sessions
  add column if not exists minutes_delivered smallint
    check (minutes_delivered is null or minutes_delivered >= 0);

alter table public.student_service_sessions
  add column if not exists progress_notes text;

alter table public.student_service_sessions
  add column if not exists missed_reason text;

-- ---------------------------------------------------------------------------
-- Student Funding Center
-- ---------------------------------------------------------------------------

create table if not exists public.ssis_student_funding_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  funding_category text not null
    check (funding_category in (
      'school_scholarship', 'outside_scholarship', 'state_funding',
      'esa_voucher', 'grant', 'parent_pay', 'other'
    )),
  source_entity_type text,
  source_entity_id uuid,
  program_name text,
  state_code text,
  award_amount numeric(12, 2),
  award_year text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'expired', 'denied')),
  payment_status text not null default 'unknown'
    check (payment_status in ('unknown', 'expected', 'partial', 'paid', 'overdue')),
  renewal_date date,
  award_letter_document_id uuid references public.student_documents(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ssis_funding_records_student
  on public.ssis_student_funding_records(student_id, funding_category);

drop trigger if exists ssis_student_funding_records_set_updated_at on public.ssis_student_funding_records;
create trigger ssis_student_funding_records_set_updated_at
  before update on public.ssis_student_funding_records
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Parent Engagement
-- ---------------------------------------------------------------------------

create table if not exists public.ssis_parent_engagement_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  guardian_id uuid references public.guardians(id) on delete set null,
  event_type text not null
    check (event_type in (
      'portal_login', 'message_sent', 'message_read', 'document_upload',
      'meeting_attended', 'meeting_missed', 'volunteer', 'survey_completed',
      'payment_made', 'other'
    )),
  engagement_score smallint not null default 1 check (engagement_score between -5 and 5),
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_ssis_parent_engagement_student
  on public.ssis_parent_engagement_events(student_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Student Success Score
-- ---------------------------------------------------------------------------

create table if not exists public.ssis_success_score_config (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools(id) on delete cascade,
  weights jsonb not null default '{
    "attendance": 20,
    "academic_growth": 20,
    "behavior": 15,
    "intervention_progress": 10,
    "parent_engagement": 10,
    "funding_status": 10,
    "missing_documents": 10,
    "compliance": 5
  }'::jsonb,
  green_threshold numeric(5, 2) not null default 80,
  yellow_threshold numeric(5, 2) not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ssis_success_score_config_set_updated_at on public.ssis_success_score_config;
create trigger ssis_success_score_config_set_updated_at
  before update on public.ssis_success_score_config
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.ssis_student_success_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  overall_score numeric(5, 2) not null,
  status_indicator text not null check (status_indicator in ('green', 'yellow', 'red')),
  component_scores jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  config_snapshot jsonb not null default '{}'::jsonb
);

create index if not exists idx_ssis_success_scores_student
  on public.ssis_student_success_scores(student_id, computed_at desc);

-- ---------------------------------------------------------------------------
-- Communication timeline (indexed student events)
-- ---------------------------------------------------------------------------

create table if not exists public.ssis_communication_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  channel text not null
    check (channel in (
      'email', 'sms', 'portal', 'phone', 'meeting', 'document', 'note',
      'behavior', 'attendance', 'funding', 'scholarship', 'approval',
      'workflow', 'audit', 'system'
    )),
  direction text not null default 'outbound'
    check (direction in ('inbound', 'outbound', 'internal')),
  subject text not null,
  body text not null default '',
  actor_user_id uuid references public.users(id) on delete set null,
  related_entity_type text,
  related_entity_id uuid,
  platform_timeline_event_id uuid,
  searchable_text tsvector generated always as (
    to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body, ''))
  ) stored,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_ssis_communication_student
  on public.ssis_communication_events(student_id, occurred_at desc);

create index if not exists idx_ssis_communication_search
  on public.ssis_communication_events using gin (searchable_text);

-- ---------------------------------------------------------------------------
-- SSIS permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order) values
  ('ssis.view', 'View Student Success', 'Access SSIS student success profiles', 'sis', 'ssis', 10),
  ('ssis.score.view', 'View Success Score', 'View student success score indicators', 'sis', 'ssis', 11),
  ('ssis.funding.view', 'View Student Funding', 'View student funding center', 'sis', 'funding', 12),
  ('ssis.timeline.view', 'View Communication Timeline', 'View unified student communication timeline', 'sis', 'communication', 13)
on conflict (permission_key) do update set name = excluded.name, description = excluded.description;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r cross join public.platform_permissions p
where r.name in ('REGISTRAR', 'SCHOOL_LEADER', 'TEACHER', 'FINANCE', 'STATE_FUNDING_MANAGER', 'SCHOLARSHIP_MANAGER')
  and p.permission_key in ('ssis.view', 'ssis.score.view', 'ssis.funding.view', 'ssis.timeline.view')
on conflict (role_id, permission_key) do nothing;

-- Default score config for existing schools
insert into public.ssis_success_score_config (school_id)
select s.id from public.schools s
on conflict (school_id) do nothing;

-- Sync medical expiry alerts when document expires_at set
create or replace function public.ssis_sync_medical_expiry_alert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.expires_at is not null and new.document_type in ('medical', 'immunization', 'iep', '504') then
    insert into public.ssis_medical_expiry_alerts (student_id, document_id, expires_on)
    values (new.student_id, new.id, new.expires_at)
    on conflict (student_id, document_id, expires_on) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ssis_medical_expiry on public.student_documents;
create trigger trg_ssis_medical_expiry
  after insert or update of expires_at on public.student_documents
  for each row execute function public.ssis_sync_medical_expiry_alert();
