-- =========================================
-- SPRINT 1: SCHEDULING & PAY
-- instructional_sessions, contractor_pay_ledger
-- =========================================

-- -----------------------------------------
-- INSTRUCTIONAL SESSIONS
-- -----------------------------------------

create table public.instructional_sessions (
  id uuid primary key default gen_random_uuid(),

  course_section_id uuid not null
    references public.course_sections(id) on delete cascade,

  instructor_employee_id uuid not null
    references public.employees(id) on delete restrict,

  campus_id uuid
    references public.campuses(id) on delete set null,

  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,

  actual_start timestamptz,
  actual_end timestamptz,

  session_status text not null default 'scheduled'
    check (
      session_status in (
        'scheduled',
        'in_progress',
        'completed',
        'cancelled',
        'no_show'
      )
    ),

  session_type text not null default 'instruction'
    check (
      session_type in (
        'instruction',
        'lab',
        'tutoring',
        'assessment',
        'other'
      )
    ),

  attendance_notes text,

  student_count integer default 0,

  session_completed boolean default false,

  payroll_processed boolean default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint instructional_sessions_scheduled_range_check
    check (scheduled_end > scheduled_start),

  constraint instructional_sessions_actual_range_check
    check (
      actual_start is null
      or actual_end is null
      or actual_end > actual_start
    )
);

create index idx_instructional_sessions_course_section_id
  on public.instructional_sessions(course_section_id);

create index idx_instructional_sessions_instructor_employee_id
  on public.instructional_sessions(instructor_employee_id);

create index idx_instructional_sessions_campus_id
  on public.instructional_sessions(campus_id);

create index idx_instructional_sessions_scheduled_start
  on public.instructional_sessions(scheduled_start);

create trigger instructional_sessions_set_updated_at
  before update on public.instructional_sessions
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- CONTRACTOR PAY LEDGER
-- -----------------------------------------

create table public.contractor_pay_ledger (
  id uuid primary key default gen_random_uuid(),

  school_id uuid not null
    references public.schools(id) on delete cascade,

  employee_id uuid not null
    references public.employees(id) on delete cascade,

  instructional_session_id uuid
    references public.instructional_sessions(id) on delete set null,

  pay_period_start date not null,
  pay_period_end date not null,

  student_count integer default 0,

  pay_rate_per_student numeric(10,2) default 0,

  gross_amount numeric(12,2) not null default 0
    check (gross_amount >= 0),

  payroll_batch_date date,

  payroll_reported boolean default false,

  payment_status text not null default 'pending'
    check (
      payment_status in (
        'pending',
        'approved',
        'paid',
        'void'
      )
    ),

  approved_by uuid
    references public.users(id) on delete set null,

  approved_at timestamptz,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint contractor_pay_ledger_period_check
    check (pay_period_end >= pay_period_start)
);

create index idx_contractor_pay_ledger_school_id
  on public.contractor_pay_ledger(school_id);

create index idx_contractor_pay_ledger_employee_id
  on public.contractor_pay_ledger(employee_id);

create index idx_contractor_pay_ledger_instructional_session_id
  on public.contractor_pay_ledger(instructional_session_id);

create trigger contractor_pay_ledger_set_updated_at
  before update on public.contractor_pay_ledger
  for each row
  execute function public.trigger_set_updated_at();