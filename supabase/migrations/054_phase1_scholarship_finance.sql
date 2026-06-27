-- =========================================
-- PHASE 1: SCHOLARSHIP & FINANCE
-- Scholarship workflow extensions, billing, sibling discount
-- Idempotent: safe to re-run after partial apply
-- =========================================

-- Scholarship review workflow extensions
alter table public.scholarship_applications
  add column if not exists household_income numeric(12, 2)
    check (household_income is null or household_income >= 0);

alter table public.scholarship_applications
  add column if not exists review_notes text;

alter table public.scholarship_applications
  add column if not exists approver_name text;

alter table public.scholarship_applications
  add column if not exists submitted_at timestamptz;

alter table public.scholarship_applications
  add column if not exists approved_at timestamptz;

-- Tax return document type is enforced at application layer;
-- scholarship_documents.document_type accepts 'tax_return' among others.

-- -----------------------------------------
-- FAMILY BILLING ACCOUNTS
-- -----------------------------------------

create table if not exists public.family_billing_accounts (
  id uuid primary key default gen_random_uuid(),

  family_id uuid not null unique
    references public.families(id) on delete cascade,

  school_id uuid not null
    references public.schools(id) on delete cascade,

  account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'closed')),

  balance numeric(12, 2) not null default 0,

  sibling_discount_student_id uuid
    references public.students(id) on delete set null,

  sibling_discount_percent numeric(5, 2) not null default 5.00
    check (sibling_discount_percent >= 0 and sibling_discount_percent <= 100),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_billing_accounts_family_id
  on public.family_billing_accounts(family_id);

create index if not exists idx_family_billing_accounts_school_id
  on public.family_billing_accounts(school_id);

drop trigger if exists family_billing_accounts_set_updated_at on public.family_billing_accounts;

create trigger family_billing_accounts_set_updated_at
  before update on public.family_billing_accounts
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- TUITION PLANS
-- -----------------------------------------

create table if not exists public.tuition_plans (
  id uuid primary key default gen_random_uuid(),

  school_id uuid not null
    references public.schools(id) on delete cascade,

  name text not null,
  description text,

  program text
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
    ),

  annual_amount numeric(12, 2) not null
    check (annual_amount >= 0),

  payment_schedule text not null default 'monthly'
    check (
      payment_schedule in (
        'annual',
        'semester',
        'quarterly',
        'monthly'
      )
    ),

  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tuition_plans_school_id on public.tuition_plans(school_id);

drop trigger if exists tuition_plans_set_updated_at on public.tuition_plans;

create trigger tuition_plans_set_updated_at
  before update on public.tuition_plans
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- INVOICES
-- -----------------------------------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),

  billing_account_id uuid not null
    references public.family_billing_accounts(id) on delete cascade,

  tuition_plan_id uuid
    references public.tuition_plans(id) on delete set null,

  student_id uuid
    references public.students(id) on delete set null,

  invoice_number text not null,

  description text,

  subtotal numeric(12, 2) not null default 0
    check (subtotal >= 0),

  sibling_discount_amount numeric(12, 2) not null default 0
    check (sibling_discount_amount >= 0),

  total_amount numeric(12, 2) not null default 0
    check (total_amount >= 0),

  amount_paid numeric(12, 2) not null default 0
    check (amount_paid >= 0),

  due_date date not null,

  invoice_status text not null default 'draft'
    check (
      invoice_status in (
        'draft',
        'sent',
        'partial',
        'paid',
        'overdue',
        'void'
      )
    ),

  issued_at date,
  paid_at date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_billing_account_id on public.invoices(billing_account_id);
create index if not exists idx_invoices_invoice_status on public.invoices(invoice_status);
create index if not exists idx_invoices_due_date on public.invoices(due_date);

drop trigger if exists invoices_set_updated_at on public.invoices;

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row
  execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- PAYMENTS
-- -----------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),

  invoice_id uuid not null
    references public.invoices(id) on delete cascade,

  amount numeric(12, 2) not null
    check (amount > 0),

  payment_method text not null default 'other'
    check (
      payment_method in (
        'cash',
        'check',
        'ach',
        'credit_card',
        'esa',
        'voucher',
        'scholarship',
        'other'
      )
    ),

  reference_number text,

  paid_at timestamptz not null default now(),

  recorded_by_user_id uuid
    references public.users(id) on delete set null,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_invoice_id on public.payments(invoice_id);
create index if not exists idx_payments_paid_at on public.payments(paid_at);

drop trigger if exists payments_set_updated_at on public.payments;

create trigger payments_set_updated_at
  before update on public.payments
  for each row
  execute function public.trigger_set_updated_at();

-- Sibling discount: only one student per family receives 5% discount
create or replace function public.apply_sibling_discount(
  p_billing_account_id uuid,
  p_student_id uuid,
  p_subtotal numeric
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account public.family_billing_accounts%rowtype;
  v_discount numeric;
begin
  select * into v_account
  from public.family_billing_accounts
  where id = p_billing_account_id;

  if not found then
    return 0;
  end if;

  if v_account.sibling_discount_student_id is null then
    return 0;
  end if;

  if v_account.sibling_discount_student_id <> p_student_id then
    return 0;
  end if;

  v_discount := round(p_subtotal * (v_account.sibling_discount_percent / 100.0), 2);
  return v_discount;
end;
$$;

create or replace function public.school_id_for_billing_account(p_account_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select school_id
  from public.family_billing_accounts
  where id = p_account_id;
$$;
