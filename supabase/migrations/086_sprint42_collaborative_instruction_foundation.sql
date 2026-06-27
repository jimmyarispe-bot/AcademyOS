-- =========================================
-- SPRINT 4.2: COLLABORATIVE INSTRUCTION & STUDENT GROWTH
-- Teams, unified growth plan, session outcomes, meetings,
-- collaboration feed, intervention effectiveness
-- Idempotent: safe to re-run
-- =========================================

-- ---------------------------------------------------------------------------
-- 15. Collaborative instructional teams
-- ---------------------------------------------------------------------------

create table if not exists public.student_instructional_teams (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_instructional_teams_school on public.student_instructional_teams(school_id);

drop trigger if exists student_instructional_teams_set_updated_at on public.student_instructional_teams;
create trigger student_instructional_teams_set_updated_at
  before update on public.student_instructional_teams
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.student_instructional_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.student_instructional_teams(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  team_role text not null check (team_role in (
    'classroom_teacher', 'reading_teacher', 'math_teacher', 'structured_literacy_teacher',
    'speech_therapist', 'occupational_therapist', 'physical_therapist', 'counselor',
    'behavior_specialist', 'school_leader', 'case_manager', 'interventionist', 'other'
  )),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  starts_on date,
  ends_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_instructional_team_members_unique unique (team_id, employee_id, team_role)
);

create index if not exists idx_team_members_employee on public.student_instructional_team_members(employee_id);

drop trigger if exists student_instructional_team_members_set_updated_at on public.student_instructional_team_members;
create trigger student_instructional_team_members_set_updated_at
  before update on public.student_instructional_team_members
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 16. Unified Student Growth Plan
-- ---------------------------------------------------------------------------

create table if not exists public.student_growth_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  goal_source text not null check (goal_source in (
    'academic', 'iep', '504', 'intervention', 'parent', 'student', 'therapy'
  )),
  title text not null,
  description text,
  baseline text,
  target text,
  progress_pct numeric(5, 2) not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  progress_notes text,
  success_criteria text,
  status text not null default 'active'
    check (status in ('active', 'on_track', 'at_risk', 'met', 'discontinued')),
  review_date date,
  assigned_employee_id uuid references public.employees(id) on delete set null,
  source_entity_type text,
  source_entity_id uuid,
  evidence jsonb not null default '[]'::jsonb,
  subject_domain text check (subject_domain is null or subject_domain in (
    'reading', 'writing', 'math', 'structured_literacy', 'speech', 'behavior', 'social_emotional', 'other'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_growth_goals_student on public.student_growth_goals(student_id, status);
create index if not exists idx_student_growth_goals_assigned on public.student_growth_goals(assigned_employee_id);

drop trigger if exists student_growth_goals_set_updated_at on public.student_growth_goals;
create trigger student_growth_goals_set_updated_at
  before update on public.student_growth_goals
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 17. Session outcomes
-- ---------------------------------------------------------------------------

create table if not exists public.instructional_session_outcomes (
  id uuid primary key default gen_random_uuid(),
  instructional_session_id uuid not null references public.instructional_sessions(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  skills_addressed jsonb not null default '[]'::jsonb,
  learning_objectives jsonb not null default '[]'::jsonb,
  student_response text,
  mastery_level text check (mastery_level is null or mastery_level in (
    'not_demonstrated', 'emerging', 'developing', 'proficient', 'advanced'
  )),
  evidence_collected jsonb not null default '[]'::jsonb,
  recommended_next_steps text,
  homework_practice text,
  follow_up_tasks jsonb not null default '[]'::jsonb,
  growth_goal_id uuid references public.student_growth_goals(id) on delete set null,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instructional_session_outcomes_unique unique (instructional_session_id, student_id)
);

create index if not exists idx_session_outcomes_session on public.instructional_session_outcomes(instructional_session_id);
create index if not exists idx_session_outcomes_student on public.instructional_session_outcomes(student_id);

drop trigger if exists instructional_session_outcomes_set_updated_at on public.instructional_session_outcomes;
create trigger instructional_session_outcomes_set_updated_at
  before update on public.instructional_session_outcomes
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 18. Intervention effectiveness tracking
-- ---------------------------------------------------------------------------

create table if not exists public.intervention_effectiveness_records (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.student_academic_interventions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  period_start date,
  period_end date,
  minutes_delivered integer not null default 0 check (minutes_delivered >= 0),
  sessions_delivered integer not null default 0 check (sessions_delivered >= 0),
  progress_score numeric(5, 2),
  progress_trend text check (progress_trend is null or progress_trend in (
    'improving', 'stable', 'declining', 'insufficient_data'
  )),
  effectiveness_rating text check (effectiveness_rating is null or effectiveness_rating in (
    'strong', 'moderate', 'weak', 'pending'
  )),
  outcome_notes text,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_intervention_effectiveness_intervention
  on public.intervention_effectiveness_records(intervention_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- 20. Meeting center
-- ---------------------------------------------------------------------------

create table if not exists public.student_instructional_meetings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  meeting_type text not null check (meeting_type in (
    'parent_conference', 'iep', 'student_success_team', 'intervention_review', 'other'
  )),
  title text not null,
  scheduled_at timestamptz,
  completed_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  agenda text,
  notes text,
  decisions text,
  follow_up_date date,
  ssis_event_id uuid,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_instructional_meetings_student on public.student_instructional_meetings(student_id, scheduled_at desc);

drop trigger if exists student_instructional_meetings_set_updated_at on public.student_instructional_meetings;
create trigger student_instructional_meetings_set_updated_at
  before update on public.student_instructional_meetings
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.student_instructional_meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.student_instructional_meetings(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  participant_name text,
  participant_role text,
  attended boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.student_instructional_meeting_tasks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.student_instructional_meetings(id) on delete cascade,
  assigned_employee_id uuid references public.employees(id) on delete set null,
  title text not null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 22. Collaboration feed
-- ---------------------------------------------------------------------------

create table if not exists public.student_collaboration_feed_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  actor_employee_id uuid references public.employees(id) on delete set null,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  title text not null,
  body text,
  related_entity_type text,
  related_entity_id uuid,
  classification text not null default 'internal'
    check (classification in ('public', 'internal', 'confidential', 'restricted')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_collaboration_feed_student on public.student_collaboration_feed_events(student_id, occurred_at desc);
create index if not exists idx_collaboration_feed_school on public.student_collaboration_feed_events(school_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 21. Evidence library extensions
-- ---------------------------------------------------------------------------

alter table public.student_learning_artifacts
  add column if not exists growth_goal_id uuid references public.student_growth_goals(id) on delete set null;

alter table public.student_learning_artifacts
  add column if not exists intervention_id uuid references public.student_academic_interventions(id) on delete set null;

alter table public.student_learning_artifacts
  add column if not exists subject_domain text;

alter table public.student_learning_artifacts
  add column if not exists recorded_by_employee_id uuid references public.employees(id) on delete set null;

create index if not exists idx_learning_artifacts_goal on public.student_learning_artifacts(growth_goal_id);
create index if not exists idx_learning_artifacts_intervention on public.student_learning_artifacts(intervention_id);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order) values
  ('instruction.team', 'Instructional Teams', 'View and manage collaborative student teams', 'teacher_portal', 'instruction', 10),
  ('instruction.growth_plan', 'Student Growth Plan', 'Manage unified growth goals', 'teacher_portal', 'instruction', 11),
  ('instruction.meetings', 'Meeting Center', 'Schedule and document instructional meetings', 'teacher_portal', 'instruction', 12),
  ('instruction.quality', 'Instructional Quality', 'View instructional quality metrics', 'teacher_portal', 'instruction', 13),
  ('instruction.executive', 'Executive Instruction', 'Organization-wide instructional dashboards', 'executive', 'instruction', 14)
on conflict (permission_key) do update set name = excluded.name, description = excluded.description;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r cross join public.platform_permissions p
where r.name in ('TEACHER', 'THERAPIST', 'SUPPORT_STAFF', 'SCHOOL_LEADER', 'REGISTRAR')
  and p.permission_key in ('instruction.team', 'instruction.growth_plan', 'instruction.meetings', 'instruction.quality')
on conflict (role_id, permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r cross join public.platform_permissions p
where r.name in ('SCHOOL_LEADER', 'CEO', 'EXECUTIVE_DIRECTOR', 'FOUNDER')
  and p.permission_key = 'instruction.executive'
on conflict (role_id, permission_key) do nothing;
