-- =========================================
-- SPRINT 2: STUDENT INFORMATION SYSTEM
-- Master record extensions, domain tables,
-- admissions conversion history, document vault
-- Idempotent: safe to re-run
-- =========================================

-- ---------------------------------------------------------------------------
-- Student master record extensions
-- ---------------------------------------------------------------------------

alter table public.students
  add column if not exists legal_middle_name text;

alter table public.students
  add column if not exists student_number text;

alter table public.students
  add column if not exists state_student_ids jsonb not null default '[]'::jsonb;

alter table public.students
  add column if not exists photo_url text;

alter table public.students
  add column if not exists photo_storage_path text;

alter table public.students
  add column if not exists enrollment_start_date date;

alter table public.students
  add column if not exists enrollment_exit_date date;

alter table public.students
  add column if not exists graduation_year smallint
    check (graduation_year is null or graduation_year between 2000 and 2100);

alter table public.students
  add column if not exists admissions_lead_id uuid
    references public.admissions_leads(id) on delete set null;

alter table public.students
  add column if not exists admissions_application_id uuid
    references public.admissions_applications(id) on delete set null;

create unique index if not exists idx_students_school_student_number
  on public.students(school_id, student_number)
  where student_number is not null;

create unique index if not exists idx_students_admissions_application
  on public.students(admissions_application_id)
  where admissions_application_id is not null;

create index if not exists idx_students_admissions_lead
  on public.students(admissions_lead_id);

-- Per-school student number generator
create or replace function public.generate_student_number(p_school_id uuid)
returns text
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_next integer;
begin
  select coalesce(max(
    nullif(regexp_replace(student_number, '\D', '', 'g'), '')::integer
  ), 0) + 1
  into v_next
  from public.students
  where school_id = p_school_id
    and student_number ~ '^\d+$';

  if v_next is null or v_next < 1 then
    select count(*) + 1 into v_next from public.students where school_id = p_school_id;
  end if;

  return lpad(v_next::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Admissions → SIS conversion audit (preserves admissions history link)
-- ---------------------------------------------------------------------------

create table if not exists public.sis_admissions_conversions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.admissions_applications(id) on delete restrict,
  lead_id uuid not null
    references public.admissions_leads(id) on delete restrict,
  student_id uuid not null
    references public.students(id) on delete restrict,
  family_id uuid
    references public.families(id) on delete set null,
  converted_at timestamptz not null default now(),
  converted_by uuid
    references public.users(id) on delete set null,
  conversion_source text not null default 'manual'
    check (conversion_source in ('manual', 'decision', 'automation', 'portal')),
  snapshot jsonb not null default '{}'::jsonb,
  constraint sis_admissions_conversions_application_unique unique (application_id)
);

create index if not exists idx_sis_admissions_conversions_student
  on public.sis_admissions_conversions(student_id);

create index if not exists idx_sis_admissions_conversions_lead
  on public.sis_admissions_conversions(lead_id);

-- ---------------------------------------------------------------------------
-- Extend authorized contacts for attorneys, therapists, case workers
-- ---------------------------------------------------------------------------

alter table public.student_authorized_contacts
  drop constraint if exists student_authorized_contacts_contact_type_check;

alter table public.student_authorized_contacts
  add constraint student_authorized_contacts_contact_type_check
  check (contact_type in (
    'guardian', 'parent', 'grandparent', 'case_worker', 'advocate',
    'attorney', 'therapist', 'transportation', 'emergency', 'other'
  ));

alter table public.guardians
  drop constraint if exists guardians_contact_type_check;

alter table public.guardians
  add constraint guardians_contact_type_check
  check (contact_type in (
    'guardian', 'parent', 'grandparent', 'case_worker', 'advocate',
    'attorney', 'therapist', 'transportation', 'emergency', 'other'
  ));

-- ---------------------------------------------------------------------------
-- Medical profile (FERPA: medical classification)
-- ---------------------------------------------------------------------------

create table if not exists public.student_medical_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique
    references public.students(id) on delete cascade,
  allergies jsonb not null default '[]'::jsonb,
  medications jsonb not null default '[]'::jsonb,
  diagnoses jsonb not null default '[]'::jsonb,
  physician_name text,
  physician_phone text,
  physician_practice text,
  insurance_carrier text,
  insurance_policy_number text,
  insurance_group_number text,
  emergency_medical_plan text,
  immunizations jsonb not null default '[]'::jsonb,
  health_alerts jsonb not null default '[]'::jsonb,
  seizure_plan text,
  diabetes_plan text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_medical_profiles_student
  on public.student_medical_profiles(student_id);

drop trigger if exists student_medical_profiles_set_updated_at on public.student_medical_profiles;
create trigger student_medical_profiles_set_updated_at
  before update on public.student_medical_profiles
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Special education (IEP / 504)
-- ---------------------------------------------------------------------------

create table if not exists public.student_special_education_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null
    references public.students(id) on delete cascade,
  plan_type text not null
    check (plan_type in ('iep', '504')),
  status text not null default 'active'
    check (status in ('draft', 'active', 'expired', 'archived')),
  eligibility_category text,
  service_minutes jsonb not null default '{}'::jsonb,
  related_services jsonb not null default '[]'::jsonb,
  accommodations jsonb not null default '[]'::jsonb,
  modifications jsonb not null default '[]'::jsonb,
  evaluation_date date,
  annual_review_date date,
  reevaluation_date date,
  last_meeting_date date,
  document_storage_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_sped_plans_student
  on public.student_special_education_plans(student_id, plan_type);

drop trigger if exists student_special_education_plans_set_updated_at on public.student_special_education_plans;
create trigger student_special_education_plans_set_updated_at
  before update on public.student_special_education_plans
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.student_special_education_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null
    references public.students(id) on delete cascade,
  plan_id uuid
    references public.student_special_education_plans(id) on delete set null,
  goal_area text not null,
  goal_text text not null,
  target_date date,
  progress_notes text,
  status text not null default 'active'
    check (status in ('active', 'met', 'discontinued', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_sped_goals_student
  on public.student_special_education_goals(student_id);

drop trigger if exists student_special_education_goals_set_updated_at on public.student_special_education_goals;
create trigger student_special_education_goals_set_updated_at
  before update on public.student_special_education_goals
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Academic profile extensions
-- ---------------------------------------------------------------------------

alter table public.student_learning_profiles
  add column if not exists structured_literacy_level text;

alter table public.student_learning_profiles
  add column if not exists plan_504_status text not null default 'none'
    check (plan_504_status in ('none', 'pending', 'active', 'expired'));

create table if not exists public.student_academic_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null
    references public.students(id) on delete cascade,
  assessment_type text not null
    check (assessment_type in (
      'map_reading', 'map_math', 'map_language', 'benchmark', 'progress_monitor', 'other'
    )),
  assessment_name text,
  score text,
  percentile numeric(5, 2),
  assessed_on date not null,
  school_year_id uuid references public.school_years(id) on delete set null,
  notes text,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_academic_assessments_student
  on public.student_academic_assessments(student_id, assessed_on desc);

drop trigger if exists student_academic_assessments_set_updated_at on public.student_academic_assessments;
create trigger student_academic_assessments_set_updated_at
  before update on public.student_academic_assessments
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.student_academic_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null
    references public.students(id) on delete cascade,
  domain text not null,
  goal_text text not null,
  target_date date,
  status text not null default 'active'
    check (status in ('active', 'met', 'discontinued')),
  progress_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_academic_goals_student
  on public.student_academic_goals(student_id);

drop trigger if exists student_academic_goals_set_updated_at on public.student_academic_goals;
create trigger student_academic_goals_set_updated_at
  before update on public.student_academic_goals
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.student_academic_interventions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null
    references public.students(id) on delete cascade,
  intervention_type text not null,
  provider_name text,
  provider_user_id uuid references public.users(id) on delete set null,
  start_date date,
  end_date date,
  frequency text,
  notes text,
  status text not null default 'active'
    check (status in ('active', 'completed', 'discontinued')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_academic_interventions_student
  on public.student_academic_interventions(student_id);

drop trigger if exists student_academic_interventions_set_updated_at on public.student_academic_interventions;
create trigger student_academic_interventions_set_updated_at
  before update on public.student_academic_interventions
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------

create table if not exists public.student_attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null
    references public.students(id) on delete cascade,
  attendance_date date not null,
  status text not null default 'present'
    check (status in (
      'present', 'absent_excused', 'absent_unexcused', 'tardy', 'early_dismissal'
    )),
  notes text,
  parent_notified_at timestamptz,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_attendance_records_unique unique (student_id, attendance_date)
);

create index if not exists idx_student_attendance_student_date
  on public.student_attendance_records(student_id, attendance_date desc);

drop trigger if exists student_attendance_records_set_updated_at on public.student_attendance_records;
create trigger student_attendance_records_set_updated_at
  before update on public.student_attendance_records
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.student_period_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null
    references public.students(id) on delete cascade,
  attendance_date date not null,
  period_number smallint not null check (period_number between 1 and 12),
  status text not null
    check (status in ('present', 'absent_excused', 'absent_unexcused', 'tardy', 'early_dismissal')),
  notes text,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint student_period_attendance_unique unique (student_id, attendance_date, period_number)
);

create index if not exists idx_student_period_attendance_student
  on public.student_period_attendance(student_id, attendance_date desc);

-- ---------------------------------------------------------------------------
-- Behavior
-- ---------------------------------------------------------------------------

create table if not exists public.student_behavior_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null
    references public.students(id) on delete cascade,
  event_type text not null
    check (event_type in (
      'positive', 'incident', 'intervention', 'restorative', 'suspension', 'expulsion'
    )),
  title text not null,
  description text,
  severity text not null default 'normal'
    check (severity in ('low', 'normal', 'high', 'critical')),
  occurred_at timestamptz not null default now(),
  intervention_notes text,
  restorative_action text,
  parent_notified_at timestamptz,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_behavior_events_student
  on public.student_behavior_events(student_id, occurred_at desc);

drop trigger if exists student_behavior_events_set_updated_at on public.student_behavior_events;
create trigger student_behavior_events_set_updated_at
  before update on public.student_behavior_events
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Student services (speech, OT, PT, counseling, etc.)
-- ---------------------------------------------------------------------------

create table if not exists public.student_service_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null
    references public.students(id) on delete cascade,
  service_type text not null
    check (service_type in (
      'speech', 'occupational_therapy', 'physical_therapy', 'counseling',
      'behavior_support', 'tutoring', 'other'
    )),
  provider_user_id uuid references public.users(id) on delete set null,
  provider_name text,
  scheduled_at timestamptz,
  delivered_at timestamptz,
  duration_minutes smallint check (duration_minutes is null or duration_minutes > 0),
  session_status text not null default 'scheduled'
    check (session_status in ('scheduled', 'delivered', 'missed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_service_sessions_student
  on public.student_service_sessions(student_id, scheduled_at desc);

drop trigger if exists student_service_sessions_set_updated_at on public.student_service_sessions;
create trigger student_service_sessions_set_updated_at
  before update on public.student_service_sessions
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Document vault extensions + storage bucket
-- ---------------------------------------------------------------------------

alter table public.student_documents
  add column if not exists source_type text not null default 'upload'
    check (source_type in ('upload', 'admissions', 'generated', 'imported'));

alter table public.student_documents
  add column if not exists application_document_id uuid
    references public.application_documents(id) on delete set null;

alter table public.student_documents
  add column if not exists inherited_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-documents',
  'student-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- SIS permissions seed
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order) values
  ('students.view', 'View Students', 'View student records', 'sis', 'students', 1),
  ('students.edit', 'Edit Students', 'Create and update student records', 'sis', 'students', 2),
  ('students.attendance', 'Manage Attendance', 'Record and edit attendance', 'sis', 'attendance', 3),
  ('students.behavior', 'Manage Behavior', 'Record behavior events', 'sis', 'behavior', 4),
  ('students.services', 'Manage Services', 'Schedule and document student services', 'sis', 'services', 5)
on conflict (permission_key) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('REGISTRAR', 'SCHOOL_LEADER', 'TEACHER', 'THERAPIST', 'SUPPORT_STAFF')
  and p.permission_key in (
    'students.view', 'students.edit', 'students.attendance', 'students.behavior', 'students.services'
  )
on conflict (role_id, permission_key) do nothing;

-- ---------------------------------------------------------------------------
-- SPED review reminder queue (processed by platform automation cron)
-- ---------------------------------------------------------------------------

create table if not exists public.sis_sped_review_reminders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  plan_id uuid not null references public.student_special_education_plans(id) on delete cascade,
  reminder_type text not null
    check (reminder_type in ('annual_review', 'reevaluation', 'evaluation')),
  due_date date not null,
  days_before integer not null default 30,
  mission_control_item_id uuid,
  is_sent boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sis_sped_review_reminders_unique unique (plan_id, reminder_type, due_date)
);

create index if not exists idx_sis_sped_review_reminders_due
  on public.sis_sped_review_reminders(due_date)
  where not is_sent;
