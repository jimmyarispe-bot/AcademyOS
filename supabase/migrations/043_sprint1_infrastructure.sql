-- =========================================
-- SPRINT 1: INFRASTRUCTURE
-- AcademyOS — shared triggers and RLS helpers
-- =========================================

-- -----------------------------------------
-- Extensions required by Sprint 1 migrations
-- -----------------------------------------

create extension if not exists "pgcrypto" with schema "extensions";

-- -----------------------------------------
-- updated_at trigger function
-- -----------------------------------------

create or replace function public.trigger_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.trigger_set_updated_at() is
  'BEFORE UPDATE trigger function that sets updated_at to now().';

-- -----------------------------------------
-- updated_at trigger creation helper
-- -----------------------------------------

create or replace function public.attach_updated_at_trigger(p_table_name text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_trigger_name text := p_table_name || '_set_updated_at';
begin
  if to_regclass(format('public.%I', p_table_name)) is null then
    raise exception 'table public.% does not exist', p_table_name;
  end if;

  execute format(
    'drop trigger if exists %I on public.%I',
    v_trigger_name,
    p_table_name
  );

  execute format(
    'create trigger %I
       before update on public.%I
       for each row
       execute function public.trigger_set_updated_at()',
    v_trigger_name,
    p_table_name
  );
end;
$$;

comment on function public.attach_updated_at_trigger(text) is
  'Idempotently attaches a BEFORE UPDATE updated_at trigger to a public table.';

-- -----------------------------------------
-- School-scoping helper for RLS policies
-- -----------------------------------------

create or replace function public.school_id_for_student(p_student_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select school_id
  from public.students
  where id = p_student_id;
$$;

-- -----------------------------------------
-- Extend Phase 1 schools / students
-- -----------------------------------------

alter table public.schools
  add column if not exists updated_at timestamptz not null default now();

alter table public.schools
  alter column created_at type timestamptz using created_at::timestamptz;

alter table public.schools
  alter column created_at set default now();

alter table public.schools
  alter column created_at set not null;

drop trigger if exists schools_set_updated_at on public.schools;

create trigger schools_set_updated_at
  before update on public.schools
  for each row
  execute function public.trigger_set_updated_at();

alter table public.students
  add column if not exists updated_at timestamptz not null default now();

alter table public.students
  alter column created_at type timestamptz using created_at::timestamptz;

alter table public.students
  alter column created_at set default now();

alter table public.students
  alter column created_at set not null;

alter table public.students
  add column if not exists user_id uuid references public.users(id) on delete set null;

alter table public.students
  add column if not exists date_of_birth date;

drop trigger if exists students_set_updated_at on public.students;

create trigger students_set_updated_at
  before update on public.students
  for each row
  execute function public.trigger_set_updated_at();

create index if not exists idx_students_user_id on public.students(user_id);