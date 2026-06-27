-- =========================================
-- RLS: Financial Intelligence & Business Analytics
-- =========================================

alter table public.fi_allocation_rules enable row level security;
alter table public.fi_profitability_snapshots enable row level security;
alter table public.fi_break_even_snapshots enable row level security;
alter table public.fi_scenarios enable row level security;
alter table public.fi_scenario_results enable row level security;
alter table public.fi_import_batches enable row level security;
alter table public.fi_external_accounts enable row level security;
alter table public.fi_external_transactions enable row level security;
alter table public.fi_financial_alerts enable row level security;

drop policy if exists fi_allocation_rules_access on public.fi_allocation_rules;
create policy fi_allocation_rules_access on public.fi_allocation_rules
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('fi.view') or has_permission('fi.manage') or has_permission('fi.executive'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and has_permission('fi.manage')
  );

drop policy if exists fi_profitability_snapshots_read on public.fi_profitability_snapshots;
create policy fi_profitability_snapshots_read on public.fi_profitability_snapshots
  for select to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (
      has_permission('fi.view') or has_permission('fi.executive')
      or has_permission('finance.view') or has_permission('finance.executive')
      or has_permission('executive.intelligence')
    )
  );

drop policy if exists fi_profitability_snapshots_write on public.fi_profitability_snapshots;
create policy fi_profitability_snapshots_write on public.fi_profitability_snapshots
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and has_permission('fi.manage')
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and has_permission('fi.manage')
  );

drop policy if exists fi_break_even_access on public.fi_break_even_snapshots;
create policy fi_break_even_access on public.fi_break_even_snapshots
  for all to authenticated
  using (
    can_access_school(school_id)
    and (has_permission('fi.view') or has_permission('fi.executive'))
  )
  with check (can_access_school(school_id) and has_permission('fi.manage'));

drop policy if exists fi_scenarios_access on public.fi_scenarios;
create policy fi_scenarios_access on public.fi_scenarios
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('fi.scenarios') or has_permission('fi.executive') or created_by = auth.uid())
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and (has_permission('fi.scenarios') or has_permission('fi.executive'))
  );

drop policy if exists fi_scenario_results_access on public.fi_scenario_results;
create policy fi_scenario_results_access on public.fi_scenario_results
  for all to authenticated
  using (
    exists (
      select 1 from public.fi_scenarios s
      where s.id = scenario_id
        and (has_permission('fi.scenarios') or has_permission('fi.executive'))
    )
  )
  with check (
    exists (select 1 from public.fi_scenarios s where s.id = scenario_id and has_permission('fi.scenarios'))
  );

drop policy if exists fi_import_batches_access on public.fi_import_batches;
create policy fi_import_batches_access on public.fi_import_batches
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('fi.import') or has_permission('fi.manage'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and has_permission('fi.import')
  );

drop policy if exists fi_external_accounts_access on public.fi_external_accounts;
create policy fi_external_accounts_access on public.fi_external_accounts
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('fi.view') or has_permission('fi.import'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and has_permission('fi.import')
  );

drop policy if exists fi_external_transactions_access on public.fi_external_transactions;
create policy fi_external_transactions_access on public.fi_external_transactions
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('fi.view') or has_permission('fi.import'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and has_permission('fi.import')
  );

drop policy if exists fi_financial_alerts_access on public.fi_financial_alerts;
create policy fi_financial_alerts_access on public.fi_financial_alerts
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('fi.view') or has_permission('fi.executive') or has_permission('finance.view'))
  )
  with check (has_permission('fi.manage') or has_permission('fi.executive'));

grant select, insert, update, delete on public.fi_allocation_rules to authenticated;
grant select, insert, update, delete on public.fi_profitability_snapshots to authenticated;
grant select, insert, update, delete on public.fi_break_even_snapshots to authenticated;
grant select, insert, update, delete on public.fi_scenarios to authenticated;
grant select, insert, update, delete on public.fi_scenario_results to authenticated;
grant select, insert, update, delete on public.fi_import_batches to authenticated;
grant select, insert, update, delete on public.fi_external_accounts to authenticated;
grant select, insert, update, delete on public.fi_external_transactions to authenticated;
grant select, insert, update on public.fi_financial_alerts to authenticated;
