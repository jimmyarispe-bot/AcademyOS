-- =========================================
-- PHASE 1: HUMAN RESOURCES
-- positions, certifications, payroll records
-- Idempotent: safe to re-run after partial apply
-- =========================================

-- -----------------------------------------
-- POSITIONS
-- -----------------------------------------

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),

  school_id uuid not null
    references public.schools(id) on delete cascade,

  title text not null,
  department text,
  description text,

  employment_type text not null default 'full_time'
    check (
      employment_type in (
        'full_time',
        'part_time',
        'contractor',
        'intern'
      )
    ),

  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_positions_school_id on public.positions(school_id);

drop trigger if exists positions_set_updated_at on public.positions;

create trigger positions_set_updated_at
  before update on public.positions
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- EMPLOYEE POSITION ASSIGNMENTS
-- -----------------------------------------

create table if not exists public.employee_positions (
  id uuid primary key default gen_random_uuid(),

  employee_id uuid not null
    references public.employees(id) on delete cascade,

  position_id uuid not null
    references public.positions(id) on delete cascade,

  is_primary boolean not null default true,

  effective_from date,
  effective_to date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint employee_positions_unique
    unique (employee_id, position_id)
);

create index if not exists idx_employee_positions_employee_id on public.employee_positions(employee_id);
create index if not exists idx_employee_positions_position_id on public.employee_positions(position_id);

drop trigger if exists employee_positions_set_updated_at on public.employee_positions;

create trigger employee_positions_set_updated_at
  before update on public.employee_positions
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- EMPLOYEE CERTIFICATIONS
-- -----------------------------------------

create table if not exists public.employee_certifications (
  id uuid primary key default gen_random_uuid(),

  employee_id uuid not null
    references public.employees(id) on delete cascade,

  certification_name text not null,
  issuing_body text,
  certification_number text,

  issued_date date,
  expiration_date date,

  status text not null default 'active'
    check (
      status in (
        'active',
        'expired',
        'pending',
        'revoked'
      )
    ),

  document_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employee_certifications_employee_id
  on public.employee_certifications(employee_id);

create index if not exists idx_employee_certifications_status
  on public.employee_certifications(status);

drop trigger if exists employee_certifications_set_updated_at on public.employee_certifications;

create trigger employee_certifications_set_updated_at
  before update on public.employee_certifications
  for each row
  execute function public.trigger_set_updated_at();

-- Extend employee profiles with name fields
alter table public.employee_profiles
  add column if not exists first_name text;

alter table public.employee_profiles
  add column if not exists last_name text;

alter table public.employee_profiles
  add column if not exists job_title text;

-- -----------------------------------------
-- PAYROLL RECORDS
-- -----------------------------------------

create table if not exists public.payroll_records (
  id uuid primary key default gen_random_uuid(),

  school_id uuid not null
    references public.schools(id) on delete cascade,

  employee_id uuid not null
    references public.employees(id) on delete cascade,

  pay_period_start date not null,
  pay_period_end date not null,

  gross_pay numeric(12, 2) not null default 0
    check (gross_pay >= 0),

  deductions numeric(12, 2) not null default 0
    check (deductions >= 0),

  net_pay numeric(12, 2) not null default 0
    check (net_pay >= 0),

  hours_worked numeric(8, 2)
    check (hours_worked is null or hours_worked >= 0),

  pay_status text not null default 'pending'
    check (
      pay_status in (
        'pending',
        'approved',
        'paid',
        'void'
      )
    ),

  paid_at timestamptz,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payroll_records_period_check
    check (pay_period_end >= pay_period_start)
);

create index if not exists idx_payroll_records_school_id on public.payroll_records(school_id);
create index if not exists idx_payroll_records_employee_id on public.payroll_records(employee_id);
create index if not exists idx_payroll_records_pay_status on public.payroll_records(pay_status);

drop trigger if exists payroll_records_set_updated_at on public.payroll_records;

create trigger payroll_records_set_updated_at
  before update on public.payroll_records
  for each row
  execute function public.trigger_set_updated_at();

create or replace function public.school_id_for_position(p_position_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select school_id
  from public.positions
  where id = p_position_id;
$$;
