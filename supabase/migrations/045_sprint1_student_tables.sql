-- =========================================
-- SPRINT 1: STUDENT EXTENSIONS
-- student_learning_profiles, student_documents,
-- student_schedule_preferences
-- =========================================

-- -----------------------------------------
-- STUDENT LEARNING PROFILES
-- -----------------------------------------

create table public.student_learning_profiles (
  id uuid primary key default gen_random_uuid(),

  student_id uuid not null unique
    references public.students(id) on delete cascade,

  learning_style text,

  reading_level text,
  writing_level text,
  math_level text,
  science_level text,

  dyslexia boolean default false,
  adhd boolean default false,
  autism boolean default false,
  executive_function boolean default false,

  gifted boolean default false,

  primary_strengths text,
  primary_challenges text,

  career_interests text,

  accommodations jsonb not null default '{}'::jsonb,

  iep_status text not null default 'none'
    check (iep_status in ('none','pending','active','expired')),

  support_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_student_learning_profiles_student_id
on public.student_learning_profiles(student_id);

create trigger student_learning_profiles_set_updated_at
before update on public.student_learning_profiles
for each row
execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- STUDENT DOCUMENTS
-- -----------------------------------------

create table public.student_documents (
  id uuid primary key default gen_random_uuid(),

  student_id uuid not null
    references public.students(id) on delete cascade,

  document_type text not null,
  document_subtype text,

  file_name text not null,
  storage_path text not null,

  mime_type text,

  file_size_bytes bigint
    check (
      file_size_bytes is null
      or file_size_bytes >= 0
    ),

  uploaded_by uuid
    references public.users(id) on delete set null,

  status text not null default 'active'
    check (
      status in ('active','archived','deleted')
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_student_documents_student_id
on public.student_documents(student_id);

create index idx_student_documents_uploaded_by
on public.student_documents(uploaded_by);

create trigger student_documents_set_updated_at
before update on public.student_documents
for each row
execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- STUDENT SCHEDULE PREFERENCES
-- -----------------------------------------

create table public.student_schedule_preferences (
  id uuid primary key default gen_random_uuid(),

  student_id uuid not null
    references public.students(id) on delete cascade,

  school_year_id uuid
    references public.school_years(id) on delete cascade,

  timezone text not null default 'America/New_York',

  day_of_week smallint not null
    check (day_of_week between 0 and 6),

  preferred_start_time_local time,
  preferred_end_time_local time,

  preferred_start_time_et time,
  preferred_end_time_et time,

  availability_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint student_schedule_preferences_time_check
    check (
      preferred_start_time_local is null
      or preferred_end_time_local is null
      or preferred_end_time_local > preferred_start_time_local
    ),

  constraint student_schedule_preferences_unique_day
    unique (
      student_id,
      school_year_id,
      day_of_week
    )
);

create index idx_student_schedule_preferences_student_id
on public.student_schedule_preferences(student_id);

create index idx_student_schedule_preferences_school_year_id
on public.student_schedule_preferences(school_year_id);

create trigger student_schedule_preferences_set_updated_at
before update on public.student_schedule_preferences
for each row
execute function public.trigger_set_updated_at();