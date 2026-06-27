-- =========================================
-- SPRINT 2: ADMISSIONS
-- prospects, guardians, applications, scholarships,
-- notes, tasks
-- Idempotent: safe on partially migrated / legacy databases
-- =========================================

-- -----------------------------------------
-- PROSPECTS
-- -----------------------------------------

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),

  school_id uuid not null
    references public.schools(id) on delete cascade,

  first_name text not null,
  last_name text not null,
  preferred_name text,

  date_of_birth date,

  current_grade text,
  applying_for_grade text,

  referral_source text,

  inquiry_date date not null default current_date,

  status text not null default 'inquiry'
    check (
      status in (
        'inquiry',
        'tour_scheduled',
        'application_started',
        'application_submitted',
        'accepted',
        'waitlisted',
        'declined',
        'withdrawn'
      )
    ),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prospects_school_id
  on public.prospects(school_id);

create index if not exists idx_prospects_status
  on public.prospects(status);

create index if not exists idx_prospects_inquiry_date
  on public.prospects(inquiry_date);

drop trigger if exists prospects_set_updated_at on public.prospects;

create trigger prospects_set_updated_at
  before update on public.prospects
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- PROSPECT GUARDIANS
-- -----------------------------------------

create table if not exists public.prospect_guardians (
  id uuid primary key default gen_random_uuid(),

  prospect_id uuid not null
    references public.prospects(id) on delete cascade,

  first_name text not null,
  last_name text not null,

  relationship_to_student text,

  email text,
  phone text,

  primary_guardian boolean not null default false,
  receives_billing boolean not null default false,
  receives_school_communications boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prospect_guardians_prospect_id
  on public.prospect_guardians(prospect_id);

create index if not exists idx_prospect_guardians_email
  on public.prospect_guardians(email);

drop trigger if exists prospect_guardians_set_updated_at on public.prospect_guardians;

create trigger prospect_guardians_set_updated_at
  before update on public.prospect_guardians
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- ADMISSIONS APPLICATIONS
-- -----------------------------------------

create table if not exists public.admissions_applications (
  id uuid primary key default gen_random_uuid(),

  prospect_id uuid not null
    references public.prospects(id) on delete cascade,

  school_year_id uuid not null
    references public.school_years(id) on delete restrict,

  application_date date not null default current_date,

  application_status text not null default 'draft'
    check (
      application_status in (
        'draft',
        'in_progress',
        'submitted',
        'under_review',
        'accepted',
        'waitlisted',
        'denied',
        'withdrawn'
      )
    ),

  admissions_decision_date date,

  accepted_by_user_id uuid
    references public.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint admissions_applications_prospect_year_unique
    unique (prospect_id, school_year_id)
);

create index if not exists idx_admissions_applications_prospect_id
  on public.admissions_applications(prospect_id);

create index if not exists idx_admissions_applications_school_year_id
  on public.admissions_applications(school_year_id);

create index if not exists idx_admissions_applications_accepted_by_user_id
  on public.admissions_applications(accepted_by_user_id);

create index if not exists idx_admissions_applications_application_status
  on public.admissions_applications(application_status);

drop trigger if exists admissions_applications_set_updated_at on public.admissions_applications;

create trigger admissions_applications_set_updated_at
  before update on public.admissions_applications
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- APPLICATION DOCUMENTS
-- -----------------------------------------

create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),

  application_id uuid not null
    references public.admissions_applications(id) on delete cascade,

  document_type text not null,
  document_subtype text,

  file_name text not null,
  storage_path text not null,

  uploaded_by uuid
    references public.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_application_documents_application_id
  on public.application_documents(application_id);

create index if not exists idx_application_documents_uploaded_by
  on public.application_documents(uploaded_by);

drop trigger if exists application_documents_set_updated_at on public.application_documents;

create trigger application_documents_set_updated_at
  before update on public.application_documents
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- SCHOLARSHIP APPLICATIONS
-- Preserve legacy prototype table (student_name / parent_email schema)
-- -----------------------------------------

do $$
begin
  if to_regclass('public.scholarship_applications') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'scholarship_applications'
         and column_name = 'application_id'
     )
  then
    alter table public.scholarship_applications
      rename to scholarship_applications_legacy;

    comment on table public.scholarship_applications_legacy is
      'Legacy scholarship prototype (pre-admissions FK). Preserved during migration 050.';
  end if;
end $$;

create table if not exists public.scholarship_applications (
  id uuid primary key default gen_random_uuid(),

  application_id uuid not null unique
    references public.admissions_applications(id) on delete cascade,

  requested_amount numeric(12, 2)
    check (
      requested_amount is null
      or requested_amount >= 0
    ),

  approved_amount numeric(12, 2)
    check (
      approved_amount is null
      or approved_amount >= 0
    ),

  scholarship_status text not null default 'draft'
    check (
      scholarship_status in (
        'draft',
        'submitted',
        'under_review',
        'approved',
        'denied'
      )
    ),

  reviewed_by_user_id uuid
    references public.users(id) on delete set null,

  reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scholarship_applications_application_id
  on public.scholarship_applications(application_id);

create index if not exists idx_scholarship_applications_reviewed_by_user_id
  on public.scholarship_applications(reviewed_by_user_id);

create index if not exists idx_scholarship_applications_scholarship_status
  on public.scholarship_applications(scholarship_status);

drop trigger if exists scholarship_applications_set_updated_at on public.scholarship_applications;

create trigger scholarship_applications_set_updated_at
  before update on public.scholarship_applications
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- SCHOLARSHIP DOCUMENTS
-- -----------------------------------------

create table if not exists public.scholarship_documents (
  id uuid primary key default gen_random_uuid(),

  scholarship_application_id uuid not null
    references public.scholarship_applications(id) on delete cascade,

  document_type text not null,

  file_name text not null,
  storage_path text not null,

  uploaded_by uuid
    references public.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scholarship_documents_scholarship_application_id
  on public.scholarship_documents(scholarship_application_id);

create index if not exists idx_scholarship_documents_uploaded_by
  on public.scholarship_documents(uploaded_by);

drop trigger if exists scholarship_documents_set_updated_at on public.scholarship_documents;

create trigger scholarship_documents_set_updated_at
  before update on public.scholarship_documents
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- ADMISSIONS NOTES
-- -----------------------------------------

create table if not exists public.admissions_notes (
  id uuid primary key default gen_random_uuid(),

  prospect_id uuid not null
    references public.prospects(id) on delete cascade,

  created_by uuid
    references public.users(id) on delete set null,

  note_text text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admissions_notes_prospect_id
  on public.admissions_notes(prospect_id);

create index if not exists idx_admissions_notes_created_by
  on public.admissions_notes(created_by);

drop trigger if exists admissions_notes_set_updated_at on public.admissions_notes;

create trigger admissions_notes_set_updated_at
  before update on public.admissions_notes
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- ADMISSIONS TASKS
-- -----------------------------------------

create table if not exists public.admissions_tasks (
  id uuid primary key default gen_random_uuid(),

  prospect_id uuid not null
    references public.prospects(id) on delete cascade,

  assigned_to_user_id uuid
    references public.users(id) on delete set null,

  task_name text not null,

  due_date date,

  task_status text not null default 'open'
    check (
      task_status in (
        'open',
        'completed',
        'cancelled'
      )
    ),

  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint admissions_tasks_completed_at_check
    check (
      completed_at is null
      or task_status = 'completed'
    )
);

create index if not exists idx_admissions_tasks_prospect_id
  on public.admissions_tasks(prospect_id);

create index if not exists idx_admissions_tasks_assigned_to_user_id
  on public.admissions_tasks(assigned_to_user_id);

create index if not exists idx_admissions_tasks_task_status
  on public.admissions_tasks(task_status);

create index if not exists idx_admissions_tasks_due_date
  on public.admissions_tasks(due_date);

drop trigger if exists admissions_tasks_set_updated_at on public.admissions_tasks;

create trigger admissions_tasks_set_updated_at
  before update on public.admissions_tasks
  for each row
  execute function public.trigger_set_updated_at();
