-- =========================================
-- RELEASE 6: FINANCIAL OPERATIONS PLATFORM
-- Extends Phase 1 billing, scholarships, state funding
-- Idempotent: safe to re-run
-- =========================================

-- ---------------------------------------------------------------------------
-- 1. Family Financial Center extensions
-- ---------------------------------------------------------------------------

alter table public.family_billing_accounts
  add column if not exists credit_balance numeric(12, 2) not null default 0 check (credit_balance >= 0);

alter table public.family_billing_accounts
  add column if not exists collections_status text not null default 'current'
    check (collections_status in ('current', 'past_due', 'payment_plan', 'collections', 'written_off'));

alter table public.family_billing_accounts
  add column if not exists autopay_enabled boolean not null default false;

alter table public.family_billing_accounts
  add column if not exists payment_plan_id uuid;

alter table public.family_billing_accounts
  add column if not exists custody_billing_notes text;

create table if not exists public.family_billing_payers (
  id uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references public.family_billing_accounts(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  payer_name text not null,
  payer_email text,
  responsibility_percent numeric(5, 2) not null default 100
    check (responsibility_percent > 0 and responsibility_percent <= 100),
  is_primary boolean not null default false,
  custody_basis text check (custody_basis is null or custody_basis in ('primary', 'joint', 'split', 'other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_billing_payers_account on public.family_billing_payers(billing_account_id);

drop trigger if exists family_billing_payers_set_updated_at on public.family_billing_payers;
create trigger family_billing_payers_set_updated_at
  before update on public.family_billing_payers
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.family_payment_methods (
  id uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references public.family_billing_accounts(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  method_type text not null check (method_type in ('credit_card', 'debit_card', 'ach', 'other')),
  provider text not null default 'square_planned',
  external_token_ref text,
  last_four text,
  exp_month integer,
  exp_year integer,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_payment_methods_account on public.family_payment_methods(billing_account_id);

drop trigger if exists family_payment_methods_set_updated_at on public.family_payment_methods;
create trigger family_payment_methods_set_updated_at
  before update on public.family_payment_methods
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.family_autopay_enrollments (
  id uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references public.family_billing_accounts(id) on delete cascade,
  payment_method_id uuid references public.family_payment_methods(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'cancelled', 'failed')),
  day_of_month integer check (day_of_month is null or (day_of_month >= 1 and day_of_month <= 28)),
  enrolled_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists family_autopay_enrollments_set_updated_at on public.family_autopay_enrollments;
create trigger family_autopay_enrollments_set_updated_at
  before update on public.family_autopay_enrollments
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Tuition engine extensions
-- ---------------------------------------------------------------------------

alter table public.tuition_plans
  add column if not exists billing_frequency text not null default 'monthly'
    check (billing_frequency in ('annual', 'semester', 'quarterly', 'monthly', 'weekly', 'daily', 'hourly'));

alter table public.tuition_plans
  add column if not exists service_type text not null default 'tuition'
    check (service_type in ('tuition', 'therapy', 'tutoring', 'summer', 'hourly_service', 'custom'));

alter table public.tuition_plans
  add column if not exists hourly_rate numeric(12, 2) check (hourly_rate is null or hourly_rate >= 0);

alter table public.tuition_plans
  add column if not exists tax_rate_percent numeric(5, 2) not null default 0
    check (tax_rate_percent >= 0 and tax_rate_percent <= 100);

-- ---------------------------------------------------------------------------
-- 5. Accounts receivable extensions
-- ---------------------------------------------------------------------------

create table if not exists public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references public.family_billing_accounts(id) on delete cascade,
  name text not null,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  installment_amount numeric(12, 2) not null check (installment_amount >= 0),
  installment_count integer not null check (installment_count > 0),
  frequency text not null default 'monthly'
    check (frequency in ('weekly', 'biweekly', 'monthly')),
  start_date date not null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'defaulted', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_plans_account on public.payment_plans(billing_account_id);

alter table public.family_billing_accounts
  drop constraint if exists family_billing_accounts_payment_plan_id_fkey;
alter table public.family_billing_accounts
  add constraint family_billing_accounts_payment_plan_id_fkey
  foreign key (payment_plan_id) references public.payment_plans(id) on delete set null;

drop trigger if exists payment_plans_set_updated_at on public.payment_plans;
create trigger payment_plans_set_updated_at
  before update on public.payment_plans
  for each row execute function public.trigger_set_updated_at();

alter table public.invoices
  add column if not exists scholarship_credit numeric(12, 2) not null default 0 check (scholarship_credit >= 0);

alter table public.invoices
  add column if not exists state_funding_credit numeric(12, 2) not null default 0 check (state_funding_credit >= 0);

alter table public.invoices
  add column if not exists grant_credit numeric(12, 2) not null default 0 check (grant_credit >= 0);

alter table public.invoices
  add column if not exists discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0);

alter table public.invoices
  add column if not exists tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0);

alter table public.invoices
  add column if not exists late_fee_amount numeric(12, 2) not null default 0 check (late_fee_amount >= 0);

alter table public.invoices
  add column if not exists family_responsibility numeric(12, 2) not null default 0 check (family_responsibility >= 0);

alter table public.invoices
  add column if not exists payment_plan_id uuid references public.payment_plans(id) on delete set null;

alter table public.invoices
  add column if not exists program text;

alter table public.invoices
  add column if not exists funding_source_code text;

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_type text not null check (line_type in (
    'tuition', 'therapy', 'tutoring', 'fee', 'discount', 'scholarship', 'state_funding', 'grant', 'tax', 'late_fee', 'credit', 'other'
  )),
  description text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_amount numeric(12, 2) not null default 0,
  amount numeric(12, 2) not null default 0,
  student_id uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_line_items_invoice on public.invoice_line_items(invoice_id);

create table if not exists public.billing_credits (
  id uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references public.family_billing_accounts(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  remaining_amount numeric(12, 2) not null check (remaining_amount >= 0),
  reason text,
  source_module text not null default 'finance',
  status text not null default 'available'
    check (status in ('available', 'applied', 'expired', 'void')),
  expires_on date,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_credits_account on public.billing_credits(billing_account_id);

drop trigger if exists billing_credits_set_updated_at on public.billing_credits;
create trigger billing_credits_set_updated_at
  before update on public.billing_credits
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.billing_adjustments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete set null,
  billing_account_id uuid not null references public.family_billing_accounts(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('credit', 'debit', 'write_off', 'refund')),
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null,
  approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_adjustments_account on public.billing_adjustments(billing_account_id);

alter table public.payments
  add column if not exists payment_status text not null default 'completed'
    check (payment_status in ('pending', 'completed', 'failed', 'refunded', 'disputed'));

alter table public.payments
  add column if not exists receipt_number text;

alter table public.payments
  add column if not exists external_processor_ref text;

alter table public.payments
  add column if not exists failure_reason text;

-- ---------------------------------------------------------------------------
-- 3. Scholarship Center extensions
-- ---------------------------------------------------------------------------

create table if not exists public.scholarship_funds (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  fund_name text not null,
  fund_type text not null check (fund_type in (
    'internal', 'outside', 'need_based', 'merit', 'restricted', 'donor'
  )),
  donor_name text,
  total_allocation numeric(12, 2) not null default 0 check (total_allocation >= 0),
  remaining_balance numeric(12, 2) not null default 0 check (remaining_balance >= 0),
  restrictions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scholarship_funds_school on public.scholarship_funds(school_id);

drop trigger if exists scholarship_funds_set_updated_at on public.scholarship_funds;
create trigger scholarship_funds_set_updated_at
  before update on public.scholarship_funds
  for each row execute function public.trigger_set_updated_at();

alter table public.scholarship_applications
  add column if not exists scholarship_fund_id uuid references public.scholarship_funds(id) on delete set null;

alter table public.scholarship_applications
  add column if not exists scholarship_type text
    check (scholarship_type is null or scholarship_type in ('internal', 'outside', 'need_based', 'merit', 'restricted', 'donor'));

alter table public.scholarship_applications
  add column if not exists renewal_date date;

alter table public.scholarship_applications
  add column if not exists conditions text;

alter table public.scholarship_applications
  add column if not exists remaining_award_balance numeric(12, 2)
    check (remaining_award_balance is null or remaining_award_balance >= 0);

alter table public.scholarship_applications
  add column if not exists expires_on date;

alter table public.scholarship_applications
  add column if not exists student_id uuid references public.students(id) on delete set null;

create table if not exists public.scholarship_award_payments (
  id uuid primary key default gen_random_uuid(),
  scholarship_application_id uuid not null references public.scholarship_applications(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  payment_method text not null default 'scholarship',
  notes text,
  recorded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_scholarship_award_payments_app
  on public.scholarship_award_payments(scholarship_application_id);

-- ---------------------------------------------------------------------------
-- 9. General ledger readiness
-- ---------------------------------------------------------------------------

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  source_module text not null check (source_module in (
    'finance', 'scholarships', 'state_funding', 'payroll', 'grants', 'contracts', 'admissions'
  )),
  transaction_type text not null,
  category text not null,
  amount numeric(12, 2) not null,
  transaction_date date not null default current_date,
  student_id uuid references public.students(id) on delete set null,
  family_id uuid references public.families(id) on delete set null,
  program text,
  funding_source_code text,
  invoice_id uuid references public.invoices(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  scholarship_application_id uuid references public.scholarship_applications(id) on delete set null,
  entity_type text,
  entity_id uuid,
  approval_status text not null default 'posted'
    check (approval_status in ('pending', 'approved', 'posted', 'void')),
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_financial_transactions_school_date
  on public.financial_transactions(school_id, transaction_date desc);
create index if not exists idx_financial_transactions_student on public.financial_transactions(student_id);
create index if not exists idx_financial_transactions_family on public.financial_transactions(family_id);

-- ---------------------------------------------------------------------------
-- 7. Budget & forecasting
-- ---------------------------------------------------------------------------

create table if not exists public.budget_forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  snapshot_name text not null,
  period_start date not null,
  period_end date not null,
  forecast_tuition numeric(14, 2) not null default 0,
  forecast_scholarships numeric(14, 2) not null default 0,
  forecast_state_funding numeric(14, 2) not null default 0,
  forecast_grants numeric(14, 2) not null default 0,
  forecast_payroll numeric(14, 2) not null default 0,
  actual_tuition numeric(14, 2) not null default 0,
  actual_scholarships numeric(14, 2) not null default 0,
  actual_state_funding numeric(14, 2) not null default 0,
  actual_grants numeric(14, 2) not null default 0,
  actual_payroll numeric(14, 2) not null default 0,
  enrollment_count integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_budget_forecast_school on public.budget_forecast_snapshots(school_id, period_start desc);

drop trigger if exists budget_forecast_snapshots_set_updated_at on public.budget_forecast_snapshots;
create trigger budget_forecast_snapshots_set_updated_at
  before update on public.budget_forecast_snapshots
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Payroll cost allocation
-- ---------------------------------------------------------------------------

create table if not exists public.payroll_cost_allocations (
  id uuid primary key default gen_random_uuid(),
  payroll_record_id uuid references public.payroll_records(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  school_id uuid not null references public.schools(id) on delete cascade,
  program text,
  funding_source_code text,
  grant_code text,
  student_id uuid references public.students(id) on delete set null,
  allocation_percent numeric(5, 2) not null default 100
    check (allocation_percent > 0 and allocation_percent <= 100),
  allocated_amount numeric(12, 2) not null default 0 check (allocated_amount >= 0),
  instructional_minutes integer not null default 0 check (instructional_minutes >= 0),
  period_start date,
  period_end date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payroll_cost_allocations_school on public.payroll_cost_allocations(school_id);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.is_guardian_of_family(p_family_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.guardians g
    where g.family_id = p_family_id
      and g.user_id = auth.uid()
  );
$$;

create or replace function public.sync_billing_account_balance(p_account_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_outstanding numeric;
  v_credits numeric;
begin
  select coalesce(sum(i.total_amount - i.amount_paid), 0)
  into v_outstanding
  from public.invoices i
  where i.billing_account_id = p_account_id
    and i.invoice_status not in ('paid', 'void');

  select coalesce(sum(c.remaining_amount), 0)
  into v_credits
  from public.billing_credits c
  where c.billing_account_id = p_account_id
    and c.status = 'available';

  update public.family_billing_accounts
  set
    balance = v_outstanding,
    credit_balance = v_credits,
    collections_status = case
      when v_outstanding <= 0 then 'current'
      when exists (
        select 1 from public.invoices i
        where i.billing_account_id = p_account_id
          and i.invoice_status = 'overdue'
      ) then 'past_due'
      else collections_status
    end,
    updated_at = now()
  where id = p_account_id;
end;
$$;

create or replace function public.calculate_tuition_invoice_totals(
  p_billing_account_id uuid,
  p_student_id uuid,
  p_subtotal numeric,
  p_scholarship_credit numeric default 0,
  p_state_funding_credit numeric default 0,
  p_grant_credit numeric default 0,
  p_discount_amount numeric default 0,
  p_tax_rate_percent numeric default 0,
  p_late_fee numeric default 0
)
returns table (
  sibling_discount numeric,
  tax_amount numeric,
  total_amount numeric,
  family_responsibility numeric
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sibling numeric;
  v_taxable numeric;
  v_tax numeric;
  v_total numeric;
  v_family numeric;
begin
  v_sibling := public.apply_sibling_discount(p_billing_account_id, p_student_id, p_subtotal);
  v_taxable := greatest(p_subtotal - v_sibling - p_scholarship_credit - p_state_funding_credit - p_grant_credit - p_discount_amount, 0);
  v_tax := round(v_taxable * (coalesce(p_tax_rate_percent, 0) / 100.0), 2);
  v_total := v_taxable + v_tax + coalesce(p_late_fee, 0);
  v_family := greatest(v_total, 0);

  return query select v_sibling, v_tax, v_total, v_family;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order) values
  ('finance.family_center', 'Family Financial Center', 'Manage family billing profiles and payers', 'finance', 'billing', 20),
  ('finance.ar', 'Accounts Receivable', 'Manage credits, adjustments, and collections', 'finance', 'billing', 21),
  ('finance.forecast', 'Budget & Forecasting', 'View and manage financial forecasts', 'finance', 'reporting', 22),
  ('finance.executive', 'Executive Finance', 'Executive and board financial dashboards', 'finance', 'reporting', 23),
  ('finance.portal', 'Family Financial Portal', 'Parent access to billing and payments', 'finance', 'portal', 24)
on conflict (permission_key) do update set name = excluded.name, description = excluded.description;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r cross join public.platform_permissions p
where r.name in ('FINANCE', 'SCHOOL_LEADER', 'CEO', 'EXECUTIVE_DIRECTOR', 'FOUNDER')
  and p.permission_key in ('finance.family_center', 'finance.ar', 'finance.forecast', 'finance.executive')
on conflict (role_id, permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r cross join public.platform_permissions p
where r.name = 'GUARDIAN'
  and p.permission_key = 'finance.portal'
on conflict (role_id, permission_key) do nothing;
