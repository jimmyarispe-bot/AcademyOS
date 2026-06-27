-- =========================================
-- SPRINT 1: EMPLOYEES
-- employees, employee_profiles,
-- employee_availability, employee_age_preferences
-- =========================================

-- -----------------------------------------
-- EMPLOYEES
-- -----------------------------------------

create table public.employees (
  id uuid primary key default gen_random_uuid(),

  school_id uuid not null
    references public.schools(id) on delete cascade,

  user_id uuid
    references public.users(id) on delete set null,

  employee_number text,

  employee_type text not null default 'teacher'
    check (
      employee_type in (
        'teacher',
        'contractor',
        'staff',
        'admin'
      )
    ),

  employment_status text not null default 'active'
    check (
      employment_status in (
        'active',
        'inactive',
        'terminated',
        'on_leave'
      )
    ),

  hire_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint employees_school_number_unique
    unique (school_id, employee_number)
);

create index idx_employees_school_id
on public.employees(school_id);

create index idx_employees_user_id
on public.employees(user_id);

create trigger employees_set_updated_at
before update on public.employees
for each row
execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- EMPLOYEE PROFILES
-- -----------------------------------------

create table public.employee_profiles (
  id uuid primary key default gen_random_uuid(),

  employee_id uuid not null unique
    references public.employees(id) on delete cascade,

  display_name text,

  bio text,

  certifications jsonb not null default '[]'::jsonb,

  specializations text[],

  contact_email text,
  contact_phone text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_employee_profiles_employee_id
on public.employee_profiles(employee_id);

create trigger employee_profiles_set_updated_at
before update on public.employee_profiles
for each row
execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- EMPLOYEE AVAILABILITY
-- -----------------------------------------

create table public.employee_availability (
  id uuid primary key default gen_random_uuid(),

  employee_id uuid not null
    references public.employees(id) on delete cascade,

  day_of_week smallint not null
    check (day_of_week between 0 and 6),

  start_time time not null,
  end_time time not null,

  is_available boolean not null default true,

  effective_from date,
  effective_to date,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint employee_availability_time_check
    check (end_time > start_time),

  constraint employee_availability_date_range_check
    check (
      effective_from is null
      or effective_to is null
      or effective_to >= effective_from
    )
);

create index idx_employee_availability_employee_id
on public.employee_availability(employee_id);

create trigger employee_availability_set_updated_at
before update on public.employee_availability
for each row
execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- EMPLOYEE AGE PREFERENCES
-- -----------------------------------------

create table public.employee_age_preferences (
  id uuid primary key default gen_random_uuid(),

  employee_id uuid not null
    references public.employees(id) on delete cascade,

  min_age smallint not null
    check (min_age >= 0),

  max_age smallint not null
    check (max_age >= min_age),

  preference_level text not null default 'preferred'
    check (
      preference_level in (
        'preferred',
        'acceptable',
        'avoid'
      )
    ),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_employee_age_preferences_employee_id
on public.employee_age_preferences(employee_id);

create trigger employee_age_preferences_set_updated_at
before update on public.employee_age_preferences
for each row
execute function public.trigger_set_updated_at();