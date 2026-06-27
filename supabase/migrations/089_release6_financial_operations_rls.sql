-- =========================================
-- RELEASE 6: FINANCIAL OPERATIONS RLS
-- Idempotent: safe to re-run
-- =========================================

-- Guardian family access helper used in policies below
-- (defined in 088; recreate for idempotency)
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

-- Staff finance policy helper
create or replace function public.finance_account_policy(p_account_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select can_access_school(school_id_for_billing_account(p_account_id));
$$;

-- ---------------------------------------------------------------------------
-- Family billing extensions
-- ---------------------------------------------------------------------------

alter table public.family_billing_payers enable row level security;
alter table public.family_payment_methods enable row level security;
alter table public.family_autopay_enrollments enable row level security;
alter table public.payment_plans enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.billing_credits enable row level security;
alter table public.billing_adjustments enable row level security;
alter table public.scholarship_funds enable row level security;
alter table public.scholarship_award_payments enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.budget_forecast_snapshots enable row level security;
alter table public.payroll_cost_allocations enable row level security;

-- Guardian read on billing account
drop policy if exists family_billing_accounts_guardian_select on public.family_billing_accounts;
create policy family_billing_accounts_guardian_select
on public.family_billing_accounts for select
using (is_guardian_of_family(family_id));

-- Payers
drop policy if exists family_billing_payers_staff_all on public.family_billing_payers;
create policy family_billing_payers_staff_all
on public.family_billing_payers for all
using (finance_account_policy(billing_account_id))
with check (finance_account_policy(billing_account_id));

drop policy if exists family_billing_payers_guardian_select on public.family_billing_payers;
create policy family_billing_payers_guardian_select
on public.family_billing_payers for select
using (
  exists (
    select 1 from public.family_billing_accounts a
    where a.id = family_billing_payers.billing_account_id
      and is_guardian_of_family(a.family_id)
  )
);

-- Payment methods
drop policy if exists family_payment_methods_staff_all on public.family_payment_methods;
create policy family_payment_methods_staff_all
on public.family_payment_methods for all
using (finance_account_policy(billing_account_id))
with check (finance_account_policy(billing_account_id));

drop policy if exists family_payment_methods_guardian_all on public.family_payment_methods;
create policy family_payment_methods_guardian_all
on public.family_payment_methods for all
using (
  exists (
    select 1 from public.family_billing_accounts a
    where a.id = family_payment_methods.billing_account_id
      and is_guardian_of_family(a.family_id)
  )
)
with check (
  exists (
    select 1 from public.family_billing_accounts a
    where a.id = family_payment_methods.billing_account_id
      and is_guardian_of_family(a.family_id)
  )
);

-- AutoPay
drop policy if exists family_autopay_enrollments_staff_all on public.family_autopay_enrollments;
create policy family_autopay_enrollments_staff_all
on public.family_autopay_enrollments for all
using (finance_account_policy(billing_account_id))
with check (finance_account_policy(billing_account_id));

drop policy if exists family_autopay_enrollments_guardian_all on public.family_autopay_enrollments;
create policy family_autopay_enrollments_guardian_all
on public.family_autopay_enrollments for all
using (
  exists (
    select 1 from public.family_billing_accounts a
    where a.id = family_autopay_enrollments.billing_account_id
      and is_guardian_of_family(a.family_id)
  )
)
with check (
  exists (
    select 1 from public.family_billing_accounts a
    where a.id = family_autopay_enrollments.billing_account_id
      and is_guardian_of_family(a.family_id)
  )
);

-- Payment plans
drop policy if exists payment_plans_staff_all on public.payment_plans;
create policy payment_plans_staff_all
on public.payment_plans for all
using (finance_account_policy(billing_account_id))
with check (finance_account_policy(billing_account_id));

drop policy if exists payment_plans_guardian_select on public.payment_plans;
create policy payment_plans_guardian_select
on public.payment_plans for select
using (
  exists (
    select 1 from public.family_billing_accounts a
    where a.id = payment_plans.billing_account_id
      and is_guardian_of_family(a.family_id)
  )
);

-- Invoice line items
drop policy if exists invoice_line_items_staff_all on public.invoice_line_items;
create policy invoice_line_items_staff_all
on public.invoice_line_items for all
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_line_items.invoice_id
      and finance_account_policy(i.billing_account_id)
  )
)
with check (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_line_items.invoice_id
      and finance_account_policy(i.billing_account_id)
  )
);

drop policy if exists invoice_line_items_guardian_select on public.invoice_line_items;
create policy invoice_line_items_guardian_select
on public.invoice_line_items for select
using (
  exists (
    select 1 from public.invoices i
    join public.family_billing_accounts a on a.id = i.billing_account_id
    where i.id = invoice_line_items.invoice_id
      and is_guardian_of_family(a.family_id)
  )
);

-- Guardian invoice/payment read
drop policy if exists invoices_guardian_select on public.invoices;
create policy invoices_guardian_select
on public.invoices for select
using (
  exists (
    select 1 from public.family_billing_accounts a
    where a.id = invoices.billing_account_id
      and is_guardian_of_family(a.family_id)
  )
);

drop policy if exists payments_guardian_select on public.payments;
create policy payments_guardian_select
on public.payments for select
using (
  exists (
    select 1 from public.invoices i
    join public.family_billing_accounts a on a.id = i.billing_account_id
    where i.id = payments.invoice_id
      and is_guardian_of_family(a.family_id)
  )
);

-- Credits & adjustments
drop policy if exists billing_credits_staff_all on public.billing_credits;
create policy billing_credits_staff_all
on public.billing_credits for all
using (finance_account_policy(billing_account_id))
with check (finance_account_policy(billing_account_id));

drop policy if exists billing_credits_guardian_select on public.billing_credits;
create policy billing_credits_guardian_select
on public.billing_credits for select
using (
  exists (
    select 1 from public.family_billing_accounts a
    where a.id = billing_credits.billing_account_id
      and is_guardian_of_family(a.family_id)
  )
);

drop policy if exists billing_adjustments_staff_all on public.billing_adjustments;
create policy billing_adjustments_staff_all
on public.billing_adjustments for all
using (finance_account_policy(billing_account_id))
with check (finance_account_policy(billing_account_id));

-- Scholarship funds
drop policy if exists scholarship_funds_staff_all on public.scholarship_funds;
create policy scholarship_funds_staff_all
on public.scholarship_funds for all
using (can_access_school(school_id))
with check (can_access_school(school_id));

drop policy if exists scholarship_award_payments_staff_all on public.scholarship_award_payments;
create policy scholarship_award_payments_staff_all
on public.scholarship_award_payments for all
using (
  exists (
    select 1 from public.scholarship_applications sa
    join public.admissions_applications aa on aa.id = sa.application_id
    where sa.id = scholarship_award_payments.scholarship_application_id
      and can_access_school(school_id_for_admission_lead(aa.lead_id))
  )
)
with check (
  exists (
    select 1 from public.scholarship_applications sa
    join public.admissions_applications aa on aa.id = sa.application_id
    where sa.id = scholarship_award_payments.scholarship_application_id
      and can_access_school(school_id_for_admission_lead(aa.lead_id))
  )
);

-- Financial transactions (GL)
drop policy if exists financial_transactions_staff_all on public.financial_transactions;
create policy financial_transactions_staff_all
on public.financial_transactions for all
using (can_access_school(school_id))
with check (can_access_school(school_id));

-- Budget forecasts
drop policy if exists budget_forecast_snapshots_staff_all on public.budget_forecast_snapshots;
create policy budget_forecast_snapshots_staff_all
on public.budget_forecast_snapshots for all
using (can_access_school(school_id))
with check (can_access_school(school_id));

-- Payroll allocations
drop policy if exists payroll_cost_allocations_staff_all on public.payroll_cost_allocations;
create policy payroll_cost_allocations_staff_all
on public.payroll_cost_allocations for all
using (can_access_school(school_id))
with check (can_access_school(school_id));
