-- =========================================
-- SPRINT 4: TEACHER WORKSPACE & INSTRUCTIONAL DELIVERY
-- Session workspace, progress, artifacts, lesson plans,
-- parent outreach, assessments, AI readiness hooks
-- Idempotent: safe to re-run
-- =========================================

-- ---------------------------------------------------------------------------
-- Session delivery workspace (extends scheduling sessions — no duplication)
-- ---------------------------------------------------------------------------

create table if not exists public.instructional_session_deliveries (
  id uuid primary key default gen_random_uuid(),
  instructional_session_id uuid not null unique
    references public.instructional_sessions(id) on delete cascade,
  lesson_status text not null default 'not_started'
    check (lesson_status in ('not_started', 'in_progress', 'completed', 'cancelled')),
  lesson_objectives jsonb not null default '[]'::jsonb,
  standards text[] not null default '{}'::text[],
  learning_targets jsonb not null default '[]'::jsonb,
  activities jsonb not null default '[]'::jsonb,
  session_notes text,
  homework text,
  attachment_refs jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  started_by uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_session_deliveries_session
  on public.instructional_session_deliveries(instructional_session_id);

drop trigger if exists instructional_session_deliveries_set_updated_at on public.instructional_session_deliveries;
create trigger instructional_session_deliveries_set_updated_at
  before update on public.instructional_session_deliveries
  for each row execute function public.trigger_set_updated_at();

-- Per-student session records (participation, behavior, assessment in session)
create table if not exists public.instructional_session_student_records (
  id uuid primary key default gen_random_uuid(),
  instructional_session_id uuid not null
    references public.instructional_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  participation_level text
    check (participation_level is null or participation_level in (
      'active', 'moderate', 'minimal', 'absent', 'not_applicable'
    )),
  behavior_observation text,
  assessment_result jsonb not null default '{}'::jsonb,
  session_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instructional_session_student_records_unique
    unique (instructional_session_id, student_id)
);

create index if not exists idx_session_student_records_session
  on public.instructional_session_student_records(instructional_session_id);

drop trigger if exists instructional_session_student_records_set_updated_at on public.instructional_session_student_records;
create trigger instructional_session_student_records_set_updated_at
  before update on public.instructional_session_student_records
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Academy Way academic progress (Reading, Writing, Math, Structured Literacy)
-- ---------------------------------------------------------------------------

create table if not exists public.student_academic_progress_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  domain text not null check (domain in ('reading', 'writing', 'math', 'structured_literacy')),
  current_level smallint not null,
  previous_level smallint,
  growth_summary text,
  assessment_date date not null default current_date,
  teacher_notes text,
  evidence jsonb not null default '[]'::jsonb,
  instructional_session_id uuid references public.instructional_sessions(id) on delete set null,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_academic_progress_student_domain
  on public.student_academic_progress_records(student_id, domain, assessment_date desc);

drop trigger if exists student_academic_progress_records_set_updated_at on public.student_academic_progress_records;
create trigger student_academic_progress_records_set_updated_at
  before update on public.student_academic_progress_records
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.structured_literacy_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  literacy_level smallint not null check (literacy_level between 1 and 5),
  literacy_step smallint not null check (literacy_step between 1 and 10),
  mastery_date date,
  instructional_minutes integer not null default 0 check (instructional_minutes >= 0),
  lesson_history jsonb not null default '[]'::jsonb,
  artifact_refs jsonb not null default '[]'::jsonb,
  teacher_notes text,
  next_step_recommendation text,
  instructional_session_id uuid references public.instructional_sessions(id) on delete set null,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_structured_literacy_student
  on public.structured_literacy_progress(student_id, created_at desc);

drop trigger if exists structured_literacy_progress_set_updated_at on public.structured_literacy_progress;
create trigger structured_literacy_progress_set_updated_at
  before update on public.structured_literacy_progress
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Student learning artifacts
-- ---------------------------------------------------------------------------

create table if not exists public.student_learning_artifacts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  instructional_session_id uuid references public.instructional_sessions(id) on delete set null,
  lesson_plan_id uuid,
  learning_objective text,
  assessment_id uuid references public.student_academic_assessments(id) on delete set null,
  artifact_type text not null check (artifact_type in (
    'writing_sample', 'reading_recording', 'math_work', 'project',
    'photo', 'video', 'scanned_work', 'other'
  )),
  title text not null,
  description text,
  storage_path text not null,
  file_name text,
  mime_type text,
  visible_to_parent boolean not null default false,
  uploaded_by uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_learning_artifacts_student
  on public.student_learning_artifacts(student_id, created_at desc);

drop trigger if exists student_learning_artifacts_set_updated_at on public.student_learning_artifacts;
create trigger student_learning_artifacts_set_updated_at
  before update on public.student_learning_artifacts
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Teacher instructional notes
-- ---------------------------------------------------------------------------

create table if not exists public.teacher_instructional_notes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  instructional_session_id uuid references public.instructional_sessions(id) on delete set null,
  category text not null check (category in (
    'academic', 'behavior', 'parent_communication', 'intervention', 'observation', 'planning'
  )),
  title text not null,
  body text not null,
  tags text[] not null default '{}'::text[],
  is_private boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teacher_notes_employee
  on public.teacher_instructional_notes(employee_id, created_at desc);

create index if not exists idx_teacher_notes_tags
  on public.teacher_instructional_notes using gin (tags);

drop trigger if exists teacher_instructional_notes_set_updated_at on public.teacher_instructional_notes;
create trigger teacher_instructional_notes_set_updated_at
  before update on public.teacher_instructional_notes
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Lesson plans (reusable across sections)
-- ---------------------------------------------------------------------------

create table if not exists public.teacher_lesson_plans (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  subject_domain text check (subject_domain is null or subject_domain in (
    'reading', 'writing', 'math', 'structured_literacy', 'science', 'other'
  )),
  objectives jsonb not null default '[]'::jsonb,
  materials jsonb not null default '[]'::jsonb,
  activities jsonb not null default '[]'::jsonb,
  assessments jsonb not null default '[]'::jsonb,
  differentiation text,
  accommodations text,
  homework text,
  artifact_refs jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_reusable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teacher_lesson_plans_employee
  on public.teacher_lesson_plans(employee_id, status);

drop trigger if exists teacher_lesson_plans_set_updated_at on public.teacher_lesson_plans;
create trigger teacher_lesson_plans_set_updated_at
  before update on public.teacher_lesson_plans
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.teacher_lesson_plan_sections (
  id uuid primary key default gen_random_uuid(),
  lesson_plan_id uuid not null references public.teacher_lesson_plans(id) on delete cascade,
  course_section_id uuid not null references public.course_sections(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint teacher_lesson_plan_sections_unique unique (lesson_plan_id, course_section_id)
);

-- FK for artifacts → lesson plans
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'student_learning_artifacts_lesson_plan_fk'
  ) then
    alter table public.student_learning_artifacts
      add constraint student_learning_artifacts_lesson_plan_fk
      foreign key (lesson_plan_id) references public.teacher_lesson_plans(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Session assessments (Assessment Center)
-- ---------------------------------------------------------------------------

create table if not exists public.session_assessment_records (
  id uuid primary key default gen_random_uuid(),
  instructional_session_id uuid not null
    references public.instructional_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  assessment_type text not null check (assessment_type in (
    'quick_check', 'benchmark', 'map', 'teacher_created', 'rubric', 'mastery'
  )),
  title text not null,
  score text,
  rubric jsonb not null default '{}'::jsonb,
  mastery_level text,
  notes text,
  sis_assessment_id uuid references public.student_academic_assessments(id) on delete set null,
  recorded_by uuid references public.users(id) on delete set null,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_session_assessments_session
  on public.session_assessment_records(instructional_session_id);

drop trigger if exists session_assessment_records_set_updated_at on public.session_assessment_records;
create trigger session_assessment_records_set_updated_at
  before update on public.session_assessment_records
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Parent outreach from teacher workspace
-- ---------------------------------------------------------------------------

create table if not exists public.teacher_parent_outreach (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  message_type text not null check (message_type in (
    'message', 'artifact_share', 'conference_request', 'progress_update', 'meeting_schedule'
  )),
  subject text not null,
  body text not null,
  artifact_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'draft' check (status in ('draft', 'sent')),
  sent_at timestamptz,
  ssis_event_id uuid,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teacher_parent_outreach_student
  on public.teacher_parent_outreach(student_id, created_at desc);

drop trigger if exists teacher_parent_outreach_set_updated_at on public.teacher_parent_outreach;
create trigger teacher_parent_outreach_set_updated_at
  before update on public.teacher_parent_outreach
  for each row execute function public.trigger_set_updated_at();

-- Extend interventions for teacher workspace
alter table public.student_academic_interventions
  add column if not exists intervention_category text
    check (intervention_category is null or intervention_category in (
      'reading', 'math', 'behavior', 'executive_functioning',
      'attendance', 'social_emotional', 'writing', 'structured_literacy', 'other'
    ));

alter table public.student_academic_interventions
  add column if not exists goal_text text;

alter table public.student_academic_interventions
  add column if not exists duration_weeks integer;

alter table public.student_academic_interventions
  add column if not exists evidence jsonb not null default '{}'::jsonb;

alter table public.student_academic_interventions
  add column if not exists outcome text;

alter table public.student_academic_interventions
  add column if not exists review_date date;

alter table public.student_academic_interventions
  add column if not exists assigned_employee_id uuid references public.employees(id) on delete set null;

-- ---------------------------------------------------------------------------
-- AI readiness (architecture only — no AI implementation)
-- ---------------------------------------------------------------------------

create table if not exists public.teacher_ai_readiness_config (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools(id) on delete cascade,
  capabilities jsonb not null default '{
    "lesson_plan_generation": false,
    "progress_summaries": false,
    "report_card_narratives": false,
    "parent_communication_drafts": false,
    "intervention_recommendations": false,
    "risk_identification": false
  }'::jsonb,
  integration_hooks jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.teacher_ai_readiness_config (school_id)
select id from public.schools
on conflict (school_id) do nothing;

drop trigger if exists teacher_ai_readiness_config_set_updated_at on public.teacher_ai_readiness_config;
create trigger teacher_ai_readiness_config_set_updated_at
  before update on public.teacher_ai_readiness_config
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Teacher workspace permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order) values
  ('teacher.view', 'Teacher Workspace', 'Access teacher workspace and My Day dashboard', 'teacher_portal', 'teacher', 1),
  ('teacher.manage', 'Manage Instruction', 'Edit sessions, notes, progress, and lesson plans', 'teacher_portal', 'teacher', 2),
  ('teacher.attendance', 'Session Attendance', 'Take attendance from teacher workspace', 'teacher_portal', 'attendance', 3),
  ('teacher.communicate', 'Parent Communication', 'Send messages and share artifacts with parents', 'teacher_portal', 'communication', 4),
  ('teacher.compliance', 'Teacher Compliance', 'View compliance and documentation dashboards', 'teacher_portal', 'compliance', 5)
on conflict (permission_key) do update set name = excluded.name, description = excluded.description;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r cross join public.platform_permissions p
where r.name in ('TEACHER', 'THERAPIST', 'SUPPORT_STAFF')
  and p.permission_key in ('teacher.view', 'teacher.attendance', 'teacher.manage', 'teacher.communicate', 'teacher.compliance')
on conflict (role_id, permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r cross join public.platform_permissions p
where r.name in ('SCHOOL_LEADER', 'REGISTRAR')
  and p.permission_key in ('teacher.view', 'teacher.compliance')
on conflict (role_id, permission_key) do nothing;
