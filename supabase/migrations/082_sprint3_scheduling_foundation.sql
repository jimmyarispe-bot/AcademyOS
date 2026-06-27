-- =========================================
-- SPRINT 3: ACADEMIC OPERATIONS & SCHEDULING
-- Calendars, rooms, staff assignments, session
-- generation audit, Academy Way rules, therapy
-- Idempotent: safe to re-run
-- =========================================

-- ---------------------------------------------------------------------------
-- Academic terms
-- ---------------------------------------------------------------------------

create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_year_id uuid not null references public.school_years(id) on delete cascade,
  name text not null,
  term_type text not null check (term_type in ('semester', 'quarter', 'trimester', 'summer', 'rolling')),
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_terms_date_range check (end_date >= start_date),
  constraint academic_terms_school_year_name unique (school_id, school_year_id, name)
);

create index if not exists idx_academic_terms_school_year on public.academic_terms(school_year_id);

drop trigger if exists academic_terms_set_updated_at on public.academic_terms;
create trigger academic_terms_set_updated_at
  before update on public.academic_terms
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Master academic calendars
-- ---------------------------------------------------------------------------

create table if not exists public.academic_calendars (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  calendar_scope text not null default 'school'
    check (calendar_scope in (
      'school', 'campus', 'program', 'teacher', 'student', 'parent',
      'therapy', 'executive'
    )),
  campus_id uuid references public.campuses(id) on delete cascade,
  program text,
  employee_id uuid references public.employees(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  school_year_id uuid references public.school_years(id) on delete set null,
  timezone text not null default 'America/New_York',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_academic_calendars_school on public.academic_calendars(school_id, calendar_scope);

drop trigger if exists academic_calendars_set_updated_at on public.academic_calendars;
create trigger academic_calendars_set_updated_at
  before update on public.academic_calendars
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.academic_calendar_events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.academic_calendars(id) on delete cascade,
  event_type text not null check (event_type in (
    'holiday', 'workday', 'professional_development', 'testing_window',
    'graduation', 'orientation', 'field_trip', 'parent_conference', 'school_event', 'no_school'
  )),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  blocks_scheduling boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_calendar_events_range check (ends_at > starts_at)
);

create index if not exists idx_academic_calendar_events_calendar on public.academic_calendar_events(calendar_id, starts_at);

drop trigger if exists academic_calendar_events_set_updated_at on public.academic_calendar_events;
create trigger academic_calendar_events_set_updated_at
  before update on public.academic_calendar_events
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Rooms & resources
-- ---------------------------------------------------------------------------

create table if not exists public.schedule_rooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  name text not null,
  room_type text not null default 'classroom'
    check (room_type in (
      'classroom', 'therapy', 'testing', 'conference', 'virtual', 'equipment', 'other'
    )),
  capacity integer not null default 20 check (capacity > 0),
  is_virtual boolean not null default false,
  meet_link text,
  equipment jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'inactive', 'maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_rooms_school_name unique (school_id, name)
);

create index if not exists idx_schedule_rooms_school on public.schedule_rooms(school_id);

drop trigger if exists schedule_rooms_set_updated_at on public.schedule_rooms;
create trigger schedule_rooms_set_updated_at
  before update on public.schedule_rooms
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Extend courses & sections for Academy Way
-- ---------------------------------------------------------------------------

alter table public.courses
  add column if not exists program text;

alter table public.courses
  add column if not exists delivery_mode text not null default 'virtual'
    check (delivery_mode in ('virtual', 'hybrid', 'in_person', 'independent_study', 'tutoring', 'therapy'));

alter table public.courses
  add column if not exists term_type text
    check (term_type is null or term_type in ('semester', 'quarter', 'trimester', 'rolling', 'summer'));

alter table public.courses
  add column if not exists academy_subject text
    check (academy_subject is null or academy_subject in (
      'reading', 'writing', 'math', 'structured_literacy', 'other'
    ));

alter table public.courses
  add column if not exists grade_levels text[] not null default '{}'::text[];

alter table public.course_sections
  add column if not exists program text;

alter table public.course_sections
  add column if not exists delivery_mode text not null default 'virtual'
    check (delivery_mode in ('virtual', 'hybrid', 'in_person', 'independent_study', 'tutoring', 'therapy'));

alter table public.course_sections
  add column if not exists min_capacity integer not null default 4 check (min_capacity >= 1);

alter table public.course_sections
  add column if not exists structured_literacy_level smallint
    check (structured_literacy_level is null or structured_literacy_level between 1 and 5);

alter table public.course_sections
  add column if not exists structured_literacy_step smallint
    check (structured_literacy_step is null or structured_literacy_step between 1 and 10);

alter table public.course_sections
  add column if not exists academy_level smallint
    check (academy_level is null or academy_level between 1 and 3);

alter table public.course_sections
  add column if not exists term_id uuid references public.academic_terms(id) on delete set null;

alter table public.course_sections
  add column if not exists room_id uuid references public.schedule_rooms(id) on delete set null;

alter table public.course_sections
  add column if not exists meet_link text;

alter table public.course_sections
  drop constraint if exists course_sections_instructional_minutes_check;

alter table public.course_sections
  add constraint course_sections_instructional_minutes_check
  check (instructional_minutes > 0 and instructional_minutes <= 120);

-- ---------------------------------------------------------------------------
-- Section staff assignments
-- ---------------------------------------------------------------------------

create table if not exists public.section_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  course_section_id uuid not null references public.course_sections(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  assignment_role text not null check (assignment_role in (
    'primary', 'co_teacher', 'therapist', 'substitute', 'teaching_assistant', 'observer'
  )),
  is_active boolean not null default true,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint section_staff_assignments_unique unique (course_section_id, employee_id, assignment_role)
);

create index if not exists idx_section_staff_section on public.section_staff_assignments(course_section_id);
create index if not exists idx_section_staff_employee on public.section_staff_assignments(employee_id);

drop trigger if exists section_staff_assignments_set_updated_at on public.section_staff_assignments;
create trigger section_staff_assignments_set_updated_at
  before update on public.section_staff_assignments
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Extend instructional sessions
-- ---------------------------------------------------------------------------

alter table public.instructional_sessions
  add column if not exists room_id uuid references public.schedule_rooms(id) on delete set null;

alter table public.instructional_sessions
  add column if not exists meet_link text;

alter table public.instructional_sessions
  add column if not exists student_id uuid references public.students(id) on delete set null;

alter table public.instructional_sessions
  add column if not exists therapy_service_type text
    check (therapy_service_type is null or therapy_service_type in (
      'speech', 'occupational_therapy', 'physical_therapy', 'counseling',
      'behavior_support', 'reading_intervention', 'math_intervention', 'tutoring'
    ));

alter table public.instructional_sessions
  add column if not exists rescheduled_from_id uuid references public.instructional_sessions(id) on delete set null;

alter table public.instructional_sessions
  add column if not exists cancellation_reason text;

alter table public.instructional_sessions
  add column if not exists generation_run_id uuid;

alter table public.instructional_sessions
  add column if not exists time_display text;

alter table public.instructional_sessions
  drop constraint if exists instructional_sessions_session_type_check;

alter table public.instructional_sessions
  add constraint instructional_sessions_session_type_check
  check (session_type in (
    'instruction', 'lab', 'tutoring', 'assessment', 'therapy', 'other'
  ));

-- Session generation audit
create table if not exists public.schedule_session_generation_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  course_section_id uuid references public.course_sections(id) on delete set null,
  generated_by uuid references public.users(id) on delete set null,
  date_from date not null,
  date_to date not null,
  sessions_created integer not null default 0,
  sessions_skipped integer not null default 0,
  status text not null default 'completed' check (status in ('running', 'completed', 'failed')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Session attendance → SSIS bridge
create table if not exists public.session_attendance_records (
  id uuid primary key default gen_random_uuid(),
  instructional_session_id uuid not null references public.instructional_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_status text not null check (attendance_status in (
    'present', 'virtual_present', 'absent_excused', 'absent_unexcused', 'tardy', 'early_dismissal'
  )),
  sis_attendance_record_id uuid references public.student_attendance_records(id) on delete set null,
  recorded_by uuid references public.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  notes text,
  constraint session_attendance_unique unique (instructional_session_id, student_id)
);

create index if not exists idx_session_attendance_session on public.session_attendance_records(instructional_session_id);
create index if not exists idx_session_attendance_student on public.session_attendance_records(student_id);

-- Scheduling conflicts log
create table if not exists public.schedule_conflicts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  conflict_type text not null check (conflict_type in (
    'teacher', 'student', 'room', 'therapy', 'capacity', 'funding', 'compliance', 'academy_way'
  )),
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  entity_type text not null,
  entity_id uuid not null,
  related_entity_type text,
  related_entity_id uuid,
  title text not null,
  description text,
  recommendation text,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  detected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_schedule_conflicts_school on public.schedule_conflicts(school_id, is_resolved, detected_at desc);

-- Room bookings
create table if not exists public.schedule_room_bookings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.schedule_rooms(id) on delete cascade,
  instructional_session_id uuid references public.instructional_sessions(id) on delete cascade,
  booked_start timestamptz not null,
  booked_end timestamptz not null,
  booking_status text not null default 'confirmed' check (booking_status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint schedule_room_bookings_range check (booked_end > booked_start)
);

create index if not exists idx_schedule_room_bookings_room on public.schedule_room_bookings(room_id, booked_start);

-- Academy Way school config
create table if not exists public.schedule_academy_way_config (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools(id) on delete cascade,
  virtual_start_on_hour boolean not null default true,
  virtual_end_at_minute integer not null default 50,
  use_12_hour_display boolean not null default true,
  min_reading_size integer not null default 4,
  min_writing_size integer not null default 4,
  min_math_size integer not null default 4,
  min_structured_literacy_size integer not null default 2,
  tutoring_max_size integer not null default 1,
  allow_hs_in_virtual boolean not null default true,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists schedule_academy_way_config_set_updated_at on public.schedule_academy_way_config;
create trigger schedule_academy_way_config_set_updated_at
  before update on public.schedule_academy_way_config
  for each row execute function public.trigger_set_updated_at();

insert into public.schedule_academy_way_config (school_id)
select id from public.schools
on conflict (school_id) do nothing;

-- Scheduling permissions
insert into public.platform_permissions (permission_key, name, description, module, category, sort_order) values
  ('scheduling.view', 'View Scheduling', 'View academic schedules and calendars', 'scheduling', 'scheduling', 1),
  ('scheduling.manage', 'Manage Scheduling', 'Create and edit schedules, sections, sessions', 'scheduling', 'scheduling', 2),
  ('scheduling.generate', 'Generate Sessions', 'Run session generation engine', 'scheduling', 'scheduling', 3),
  ('scheduling.attendance', 'Session Attendance', 'Take attendance from scheduled sessions', 'scheduling', 'attendance', 4),
  ('scheduling.executive', 'Executive Scheduling', 'View utilization and intelligence dashboards', 'scheduling', 'executive', 5)
on conflict (permission_key) do update set name = excluded.name, description = excluded.description;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r cross join public.platform_permissions p
where r.name in ('SCHOOL_LEADER', 'REGISTRAR', 'TEACHER', 'THERAPIST', 'SUPPORT_STAFF')
  and p.permission_key in ('scheduling.view', 'scheduling.attendance')
on conflict (role_id, permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r cross join public.platform_permissions p
where r.name in ('SCHOOL_LEADER', 'REGISTRAR')
  and p.permission_key in ('scheduling.manage', 'scheduling.generate', 'scheduling.executive')
on conflict (role_id, permission_key) do nothing;

-- Link generation runs FK after table exists
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'instructional_sessions_generation_run_fk'
  ) then
    alter table public.instructional_sessions
      add constraint instructional_sessions_generation_run_fk
      foreign key (generation_run_id) references public.schedule_session_generation_runs(id) on delete set null;
  end if;
end $$;
