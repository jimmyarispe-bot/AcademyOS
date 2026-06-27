-- =========================================
-- RELEASE 10.5: FINANCIAL INTELLIGENCE & BUSINESS ANALYTICS
-- BI layer — extends (does not replace) operational finance
-- =========================================

-- ---------------------------------------------------------------------------
-- 1. Cost allocation rules
-- ---------------------------------------------------------------------------

create table if not exists public.fi_allocation_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  rule_key text not null,
  name text not null,
  category text not null
    check (category in (
      'payroll','benefits','payroll_tax','technology','curriculum','facility',
      'admin_overhead','marketing','insurance','utilities','occupancy','shared'
    )),
  allocation_method text not null default 'enrollment'
    check (allocation_method in ('enrollment','instructional_hours','revenue','square_feet','headcount','fixed')),
  allocation_pct numeric(8,4) not null default 0,
  fixed_amount numeric(14,2),
  is_active boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (school_id, rule_key, effective_from)
);

-- ---------------------------------------------------------------------------
-- 2. Profitability snapshots (class, teacher, program, student, school, family)
-- ---------------------------------------------------------------------------

create table if not exists public.fi_profitability_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  entity_type text not null
    check (entity_type in ('class','teacher','program','student','school','family','campus')),
  entity_id uuid,
  entity_key text,
  period_type text not null default 'monthly'
    check (period_type in ('weekly','monthly','quarterly','annual')),
  period_start date not null,
  period_end date not null,
  revenue numeric(14,2) not null default 0,
  total_cost numeric(14,2) not null default 0,
  gross_margin numeric(14,2) not null default 0,
  net_margin numeric(14,2) not null default 0,
  contribution_margin numeric(14,2) not null default 0,
  margin_pct numeric(8,4) not null default 0,
  ebitda_contribution numeric(14,2),
  health_indicator text not null default 'green'
    check (health_indicator in ('green','yellow','red')),
  enrollment_count integer,
  capacity integer,
  instructional_hours numeric(10,2),
  revenue_per_seat numeric(12,2),
  cost_per_seat numeric(12,2),
  profit_per_seat numeric(12,2),
  revenue_per_hour numeric(12,2),
  cost_per_hour numeric(12,2),
  profit_per_hour numeric(12,2),
  break_even_enrollment numeric(8,2),
  metrics jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  unique (school_id, entity_type, entity_id, entity_key, period_type, period_start)
);

create index if not exists idx_fi_profitability_entity on public.fi_profitability_snapshots(entity_type, entity_id, period_start desc);
create index if not exists idx_fi_profitability_school on public.fi_profitability_snapshots(school_id, period_start desc);

-- ---------------------------------------------------------------------------
-- 3. Break-even analysis
-- ---------------------------------------------------------------------------

create table if not exists public.fi_break_even_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  entity_type text not null check (entity_type in ('class','program','teacher','campus','school')),
  entity_id uuid,
  entity_key text,
  minimum_students numeric(8,2),
  optimal_students numeric(8,2),
  max_profitability_students numeric(8,2),
  current_enrollment integer,
  available_seats integer,
  unused_capacity_hours numeric(10,2),
  is_underperforming boolean not null default false,
  is_overstaffed boolean not null default false,
  snapshot_date date not null default current_date,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_fi_break_even_school on public.fi_break_even_snapshots(school_id, snapshot_date desc);

-- ---------------------------------------------------------------------------
-- 4. Scenario modeling
-- ---------------------------------------------------------------------------

create table if not exists public.fi_scenarios (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  name text not null,
  description text,
  scenario_type text not null default 'custom'
    check (scenario_type in (
      'tuition_increase','tuition_decrease','hire_teachers','add_classes','close_classes',
      'enrollment_increase','enrollment_decrease','scholarship_change','esa_change',
      'grant_change','salary_increase','facility_expansion','custom'
    )),
  baseline_period_start date,
  baseline_period_end date,
  inputs jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','computed','archived')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fi_scenario_results (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.fi_scenarios(id) on delete cascade,
  projected_revenue numeric(14,2) not null default 0,
  projected_expenses numeric(14,2) not null default 0,
  projected_payroll numeric(14,2) not null default 0,
  projected_ebitda numeric(14,2) not null default 0,
  projected_cash_flow numeric(14,2) not null default 0,
  projected_margin_pct numeric(8,4) not null default 0,
  delta_revenue numeric(14,2) not null default 0,
  delta_ebitda numeric(14,2) not null default 0,
  outputs jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. QuickBooks / external financial import (source tracking — no ops replacement)
-- ---------------------------------------------------------------------------

create table if not exists public.fi_import_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  source_system text not null default 'quickbooks'
    check (source_system in ('quickbooks','csv','excel','iif','qbo_export','manual')),
  import_type text not null
    check (import_type in (
      'chart_of_accounts','general_ledger','journal_entries','profit_loss',
      'balance_sheet','cash_flow','budget','payroll_summary','vendors','customers',
      'classes','locations','transactions','historical'
    )),
  file_name text,
  file_format text,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed','reconciled')),
  row_count integer not null default 0,
  error_message text,
  imported_by uuid references public.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.fi_external_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  import_batch_id uuid references public.fi_import_batches(id) on delete set null,
  external_account_id text,
  account_number text,
  account_name text not null,
  account_type text,
  parent_account text,
  is_active boolean not null default true,
  source_system text not null default 'quickbooks',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.fi_external_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  import_batch_id uuid references public.fi_import_batches(id) on delete set null,
  external_transaction_id text,
  transaction_date date not null,
  account_name text,
  account_number text,
  debit_amount numeric(14,2) not null default 0,
  credit_amount numeric(14,2) not null default 0,
  amount numeric(14,2) not null default 0,
  description text,
  class_name text,
  location_name text,
  vendor_name text,
  customer_name text,
  source_system text not null default 'quickbooks',
  reconciliation_status text not null default 'unmatched'
    check (reconciliation_status in ('unmatched','matched','ignored')),
  matched_entity_type text,
  matched_entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_fi_external_txn_school on public.fi_external_transactions(school_id, transaction_date desc);
create index if not exists idx_fi_import_batches_school on public.fi_import_batches(school_id, imported_at desc);

-- ---------------------------------------------------------------------------
-- 6. Financial intelligence alerts
-- ---------------------------------------------------------------------------

create table if not exists public.fi_financial_alerts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  alert_type text not null
    check (alert_type in (
      'class_below_breakeven','program_loss','low_cash','declining_enrollment',
      'scholarship_overallocation','state_funding_discrepancy','payroll_spike',
      'budget_overrun','collection_issue','grant_compliance'
    )),
  severity text not null default 'normal' check (severity in ('low','normal','high','critical')),
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  mission_control_item_id uuid,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_fi_alerts_school on public.fi_financial_alerts(school_id, is_resolved, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists fi_scenarios_set_updated_at on public.fi_scenarios;
create trigger fi_scenarios_set_updated_at
  before update on public.fi_scenarios
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Reporting views
-- ---------------------------------------------------------------------------

create or replace view public.rpt_fi_class_profitability as
select
  p.school_id,
  p.entity_id as course_section_id,
  p.entity_key as section_code,
  p.period_type,
  p.period_start,
  p.revenue,
  p.total_cost,
  p.gross_margin,
  p.net_margin,
  p.margin_pct,
  p.health_indicator,
  p.enrollment_count,
  p.capacity,
  p.break_even_enrollment,
  p.revenue_per_seat,
  p.profit_per_seat,
  p.metrics
from public.fi_profitability_snapshots p
where p.entity_type = 'class';

create or replace view public.rpt_fi_program_profitability as
select
  p.school_id,
  p.entity_key as program,
  p.period_start,
  p.revenue,
  p.total_cost,
  p.net_margin,
  p.ebitda_contribution,
  p.margin_pct,
  p.health_indicator,
  p.enrollment_count,
  p.metrics
from public.fi_profitability_snapshots p
where p.entity_type = 'program';

create or replace view public.rpt_fi_school_summary as
select
  p.school_id,
  sch.name as school_name,
  p.period_start,
  p.revenue,
  p.total_cost,
  p.gross_margin,
  p.net_margin,
  p.ebitda_contribution,
  p.margin_pct,
  p.health_indicator,
  p.enrollment_count,
  p.metrics
from public.fi_profitability_snapshots p
left join public.schools sch on sch.id = p.school_id
where p.entity_type = 'school';

grant select on public.rpt_fi_class_profitability to authenticated;
grant select on public.rpt_fi_program_profitability to authenticated;
grant select on public.rpt_fi_school_summary to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Permissions
-- ---------------------------------------------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order)
values
  ('fi.view', 'Financial Intelligence View', 'View profitability and analytics dashboards', 'finance', 'financial_intelligence', 420),
  ('fi.manage', 'Financial Intelligence Manage', 'Configure allocation rules and run calculations', 'finance', 'financial_intelligence', 421),
  ('fi.executive', 'Financial Intelligence Executive', 'Executive financial intelligence dashboards', 'finance', 'financial_intelligence', 422),
  ('fi.import', 'Financial Intelligence Import', 'Import QuickBooks and CSV financial data', 'finance', 'financial_intelligence', 423),
  ('fi.scenarios', 'Financial Intelligence Scenarios', 'Run scenario modeling', 'finance', 'financial_intelligence', 424)
on conflict (permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR', 'SCHOOL_LEADER')
  and p.permission_key in ('fi.view', 'fi.executive', 'fi.scenarios')
on conflict do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r
cross join public.platform_permissions p
where r.name in ('CEO', 'FOUNDER', 'EXECUTIVE_DIRECTOR')
  and p.permission_key in ('fi.manage', 'fi.import')
on conflict do nothing;

-- Default allocation rules (network template)
insert into public.fi_allocation_rules (school_id, rule_key, name, category, allocation_method, allocation_pct)
select null, v.rule_key, v.name, v.category, v.allocation_method, v.allocation_pct
from (values
  ('admin_overhead_default', 'Administrative Overhead', 'admin_overhead', 'revenue', 12.0),
  ('technology_default', 'Technology Cost', 'technology', 'enrollment', 8.0),
  ('facility_default', 'Facility Cost', 'facility', 'instructional_hours', 10.0),
  ('insurance_default', 'Insurance Allocation', 'insurance', 'headcount', 3.0),
  ('marketing_default', 'Marketing Allocation', 'marketing', 'revenue', 5.0)
) as v(rule_key, name, category, allocation_method, allocation_pct)
where not exists (select 1 from public.fi_allocation_rules where school_id is null limit 1);
