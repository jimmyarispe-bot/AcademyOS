-- =========================================
-- SPRINT 1: ORGANIZATION
-- campuses, school_years
-- =========================================

-- -----------------------------------------
-- CAMPUSES
-- -----------------------------------------

create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  code text,
  address text,
  timezone text not null default 'America/New_York',
  is_primary boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campuses_school_code_unique unique (school_id, code)
);

create index idx_campuses_school_id on public.campuses(school_id);

create trigger campuses_set_updated_at
  before update on public.campuses
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- SCHOOL YEARS
-- -----------------------------------------

create table public.school_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  school_start_month integer,
  is_current boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_years_date_range_check check (end_date > start_date),
  constraint school_years_school_name_unique unique (school_id, name)
);

create index idx_school_years_school_id on public.school_years(school_id);

create trigger school_years_set_updated_at
  before update on public.school_years
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- Link students to campus / school year
-- -----------------------------------------

alter table public.students
  add column if not exists campus_id uuid references public.campuses(id) on delete set null;

alter table public.students
  add column if not exists school_year_id uuid references public.school_years(id) on delete set null;

create index if not exists idx_students_campus_id on public.students(campus_id);
create index if not exists idx_students_school_year_id on public.students(school_year_id);
