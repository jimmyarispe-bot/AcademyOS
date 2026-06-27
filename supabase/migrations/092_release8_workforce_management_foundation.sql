-- =========================================
-- RELEASE 8: HUMAN CAPITAL & WORKFORCE MANAGEMENT
-- Extends Phase 1 HR — idempotent
-- =========================================

-- ---------------------------------------------------------------------------
-- 1. Employee profile extensions
-- ---------------------------------------------------------------------------

alter table public.employees
  add column if not exists supervisor_employee_id uuid references public.employees(id) on delete set null;

alter table public.employees
  add column if not exists separation_date date;

alter table public.employees
  add column if not exists department text;

alter table public.employees
  add column if not exists program text;

alter table public.employee_profiles
  add column if not exists emergency_contact_name text;

alter table public.employee_profiles
  add column if not exists emergency_contact_phone text;

alter table public.employee_certifications
  add column if not exists certification_type text
    check (certification_type is null or certification_type in (
      'teaching_license', 'therapy_license', 'cpr', 'first_aid', 'background_check',
      'fingerprint', 'professional', 'continuing_education', 'other'
    ));

create table if not exists public.employee_service_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  event_type text not null check (event_type in (
    'hire', 'promotion', 'transfer', 'leave', 'return', 'separation', 'other'
  )),
  title text not null,
  description text,
  effective_date date not null,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_employee_service_history_employee
  on public.employee_service_history(employee_id, effective_date desc);

-- ---------------------------------------------------------------------------
-- 2. Recruiting & applicant tracking
-- ---------------------------------------------------------------------------

create table if not exists public.hr_job_postings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  department text,
  program text,
  employment_type text not null default 'full_time',
  description text,
  requirements text,
  status text not null default 'open'
    check (status in ('draft', 'open', 'closed', 'filled')),
  posted_at timestamptz,
  closes_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists hr_job_postings_set_updated_at on public.hr_job_postings;
create trigger hr_job_postings_set_updated_at
  before update on public.hr_job_postings
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.hr_job_applications (
  id uuid primary key default gen_random_uuid(),
  job_posting_id uuid not null references public.hr_job_postings(id) on delete cascade,
  candidate_name text not null,
  candidate_email text not null,
  candidate_phone text,
  resume_path text,
  pipeline_stage text not null default 'applied'
    check (pipeline_stage in (
      'applied', 'screening', 'interview', 'reference_check', 'background_check',
      'offer', 'hired', 'rejected', 'withdrawn'
    )),
  offer_letter_path text,
  background_check_status text default 'pending'
    check (background_check_status is null or background_check_status in ('pending', 'in_progress', 'cleared', 'failed')),
  reference_check_status text default 'pending'
    check (reference_check_status is null or reference_check_status in ('pending', 'in_progress', 'completed', 'failed')),
  notes text,
  hired_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hr_job_applications_posting on public.hr_job_applications(job_posting_id, pipeline_stage);

drop trigger if exists hr_job_applications_set_updated_at on public.hr_job_applications;
create trigger hr_job_applications_set_updated_at
  before update on public.hr_job_applications
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.hr_candidate_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.hr_job_applications(id) on delete cascade,
  scheduled_at timestamptz not null,
  interview_type text not null default 'general',
  location_or_link text,
  interviewer_user_id uuid references public.users(id) on delete set null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Onboarding
-- ---------------------------------------------------------------------------

create table if not exists public.hr_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  task_key text not null,
  title text not null,
  category text not null default 'general'
    check (category in ('paperwork', 'policy', 'technology', 'training', 'credential', 'equipment', 'other')),
  requires_signature boolean not null default false,
  signature_id uuid references public.platform_digital_signatures(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'waived')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_hr_onboarding_tasks_employee on public.hr_onboarding_tasks(employee_id, status);

-- ---------------------------------------------------------------------------
-- 4. Time & attendance
-- ---------------------------------------------------------------------------

create table if not exists public.employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  entry_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  hours_worked numeric(6, 2) check (hours_worked is null or hours_worked >= 0),
  entry_type text not null default 'regular'
    check (entry_type in ('regular', 'overtime', 'holiday', 'exception')),
  notes text,
  approved_by uuid references public.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists idx_employee_time_entries_employee on public.employee_time_entries(employee_id, entry_date desc);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  leave_type text not null
    check (leave_type in ('pto', 'sick', 'personal', 'bereavement', 'fmla', 'unpaid', 'other')),
  start_date date not null,
  end_date date not null,
  hours_requested numeric(6, 2),
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'cancelled')),
  approved_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leave_requests_employee on public.leave_requests(employee_id, status);

drop trigger if exists leave_requests_set_updated_at on public.leave_requests;
create trigger leave_requests_set_updated_at
  before update on public.leave_requests
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Performance management
-- ---------------------------------------------------------------------------

create table if not exists public.performance_evaluations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  evaluation_type text not null default 'annual'
    check (evaluation_type in ('annual', 'mid_year', 'probationary', 'improvement', 'informal')),
  evaluation_period_start date,
  evaluation_period_end date,
  overall_rating text,
  summary text,
  coaching_notes text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'acknowledged', 'completed')),
  evaluator_user_id uuid references public.users(id) on delete set null,
  employee_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_goals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  evaluation_id uuid references public.performance_evaluations(id) on delete set null,
  title text not null,
  description text,
  target_date date,
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  progress_notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Professional development
-- ---------------------------------------------------------------------------

create table if not exists public.pd_courses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  title text not null,
  description text,
  is_required boolean not null default false,
  ceu_credits numeric(4, 2) default 0,
  delivery_mode text default 'online'
    check (delivery_mode is null or delivery_mode in ('online', 'in_person', 'hybrid')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_training_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  course_id uuid references public.pd_courses(id) on delete set null,
  course_title text not null,
  completed_at timestamptz,
  certificate_path text,
  ceu_earned numeric(4, 2) default 0,
  status text not null default 'assigned'
    check (status in ('assigned', 'in_progress', 'completed', 'expired')),
  created_at timestamptz not null default now()
);

create index if not exists idx_employee_training_records_employee on public.employee_training_records(employee_id);

-- ---------------------------------------------------------------------------
-- 7. Substitute & volunteer management
-- ---------------------------------------------------------------------------

create table if not exists public.substitute_pool_members (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  school_id uuid not null references public.schools(id) on delete cascade,
  substitute_name text not null,
  contact_email text,
  contact_phone text,
  credentials_verified boolean not null default false,
  availability_notes text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default now()
);

create table if not exists public.substitute_assignments (
  id uuid primary key default gen_random_uuid(),
  substitute_id uuid not null references public.substitute_pool_members(id) on delete cascade,
  instructional_session_id uuid references public.instructional_sessions(id) on delete set null,
  assigned_at timestamptz not null default now(),
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'completed', 'cancelled')),
  lesson_plan_notes text,
  performance_notes text,
  hours_worked numeric(6, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.volunteers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  contact_email text,
  contact_phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  background_check_status text not null default 'pending'
    check (background_check_status in ('pending', 'cleared', 'failed', 'expired')),
  training_completed boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table if not exists public.volunteer_hours (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers(id) on delete cascade,
  assignment_description text not null,
  served_at date not null,
  hours_served numeric(5, 2) not null check (hours_served > 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. Employee document vault
-- ---------------------------------------------------------------------------

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  document_type text not null
    check (document_type in (
      'contract', 'license', 'certification', 'performance_review', 'training',
      'payroll_form', 'benefits', 'disciplinary', 'policy_acknowledgement', 'other'
    )),
  file_name text not null,
  storage_path text not null,
  version_number integer not null default 1,
  signature_id uuid references public.platform_digital_signatures(id) on delete set null,
  uploaded_by uuid references public.users(id) on delete set null,
  expires_at date,
  created_at timestamptz not null default now()
);

create index if not exists idx_employee_documents_employee on public.employee_documents(employee_id, document_type);

-- ---------------------------------------------------------------------------
-- 9. Permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('hr.recruiting', 'HR Recruiting', 'Manage job postings and applicant tracking', 'hr', 'workforce', 220),
  ('hr.compliance', 'HR Compliance', 'Monitor licenses, training, and compliance', 'hr', 'workforce', 221),
  ('hr.analytics', 'HR Analytics', 'View workforce analytics dashboards', 'hr', 'workforce', 222),
  ('employee.self_service', 'Employee Self-Service', 'Access employee portal features', 'hr', 'workforce', 223)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name = 'HR' and p.permission_key in ('hr.recruiting', 'hr.compliance', 'hr.analytics')
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('TEACHER', 'THERAPIST', 'SUPPORT_STAFF', 'SCHOOL_LEADER', 'FINANCE', 'HR')
  and p.permission_key = 'employee.self_service'
on conflict do nothing;

-- Seed default onboarding tasks template function via insert on hire (app layer)
