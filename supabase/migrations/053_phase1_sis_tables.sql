-- =========================================
-- PHASE 1: STUDENT INFORMATION SYSTEM
-- families, guardians, program enrollments
-- Idempotent: safe to re-run after partial apply
-- =========================================

-- -----------------------------------------
-- FAMILIES
-- -----------------------------------------

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),

  school_id uuid not null
    references public.schools(id) on delete cascade,

  family_name text not null,

  primary_address text,
  city text,
  state text,
  zip_code text,

  billing_email text,
  billing_phone text,

  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_families_school_id on public.families(school_id);

drop trigger if exists families_set_updated_at on public.families;

create trigger families_set_updated_at
  before update on public.families
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- GUARDIANS
-- -----------------------------------------

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),

  family_id uuid not null
    references public.families(id) on delete cascade,

  user_id uuid
    references public.users(id) on delete set null,

  first_name text not null,
  last_name text not null,

  relationship_to_student text,

  email text,
  phone text,

  is_primary boolean not null default false,
  receives_billing boolean not null default false,
  receives_communications boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_guardians_family_id on public.guardians(family_id);
create index if not exists idx_guardians_email on public.guardians(email);

drop trigger if exists guardians_set_updated_at on public.guardians;

create trigger guardians_set_updated_at
  before update on public.guardians
  for each row
  execute function public.trigger_set_updated_at();

-- Link students to families
alter table public.students
  add column if not exists family_id uuid
    references public.families(id) on delete set null;

alter table public.students
  add column if not exists program text
    check (
      program is null
      or program in (
        'academy_fl_campus',
        'academy_fl_virtual',
        'academy_ga_campus',
        'academy_ga_hybrid',
        'academy_hs',
        'academy_virtual'
      )
    );

alter table public.students
  add column if not exists enrollment_status text not null default 'pending'
    check (
      enrollment_status in (
        'pending',
        'enrolled',
        'waitlisted',
        'withdrawn',
        'graduated'
      )
    );

alter table public.students
  add column if not exists gender text;

alter table public.students
  add column if not exists preferred_name text;

create index if not exists idx_students_family_id on public.students(family_id);
create index if not exists idx_students_program on public.students(program);
create index if not exists idx_students_enrollment_status on public.students(enrollment_status);

-- -----------------------------------------
-- SIS ENROLLMENTS (program-level)
-- -----------------------------------------

create table if not exists public.sis_enrollments (
  id uuid primary key default gen_random_uuid(),

  student_id uuid not null
    references public.students(id) on delete cascade,

  school_year_id uuid not null
    references public.school_years(id) on delete restrict,

  program text not null
    check (
      program in (
        'academy_fl_campus',
        'academy_fl_virtual',
        'academy_ga_campus',
        'academy_ga_hybrid',
        'academy_hs',
        'academy_virtual'
      )
    ),

  enrollment_status text not null default 'pending'
    check (
      enrollment_status in (
        'pending',
        'enrolled',
        'waitlisted',
        'withdrawn',
        'graduated'
      )
    ),

  enrolled_at date,
  withdrawn_at date,

  lead_id uuid
    references public.admissions_leads(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sis_enrollments_student_year_unique
    unique (student_id, school_year_id)
);

create index if not exists idx_sis_enrollments_student_id on public.sis_enrollments(student_id);
create index if not exists idx_sis_enrollments_school_year_id on public.sis_enrollments(school_year_id);
create index if not exists idx_sis_enrollments_enrollment_status on public.sis_enrollments(enrollment_status);

drop trigger if exists sis_enrollments_set_updated_at on public.sis_enrollments;

create trigger sis_enrollments_set_updated_at
  before update on public.sis_enrollments
  for each row
  execute function public.trigger_set_updated_at();

create or replace function public.school_id_for_family(p_family_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select school_id
  from public.families
  where id = p_family_id;
$$;
