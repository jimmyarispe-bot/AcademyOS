-- =========================================
-- RLS: Executive Decision Intelligence (EDI)
-- =========================================

alter table public.edi_recommendations enable row level security;
alter table public.edi_decision_history enable row level security;
alter table public.edi_scenarios enable row level security;
alter table public.edi_scenario_results enable row level security;
alter table public.edi_capacity_snapshots enable row level security;
alter table public.edi_briefings enable row level security;
alter table public.edi_scorecard_snapshots enable row level security;
alter table public.edi_educational_roi enable row level security;

drop policy if exists edi_recommendations_read on public.edi_recommendations;
create policy edi_recommendations_read on public.edi_recommendations
  for select to authenticated
  using (
    can_access_school(school_id)
    and (
      has_permission('edi.view') or has_permission('edi.executive')
      or has_permission('edi.manage') or has_permission('executive.intelligence')
    )
  );

drop policy if exists edi_recommendations_write on public.edi_recommendations;
create policy edi_recommendations_write on public.edi_recommendations
  for all to authenticated
  using (
    can_access_school(school_id)
    and (has_permission('edi.manage') or has_permission('edi.executive'))
  )
  with check (
    can_access_school(school_id)
    and (has_permission('edi.manage') or has_permission('edi.executive'))
  );

drop policy if exists edi_decision_history_access on public.edi_decision_history;
create policy edi_decision_history_access on public.edi_decision_history
  for all to authenticated
  using (
    can_access_school(school_id)
    and (
      has_permission('edi.view') or has_permission('edi.manage')
      or has_permission('edi.executive')
    )
  )
  with check (
    can_access_school(school_id)
    and (has_permission('edi.manage') or has_permission('edi.executive'))
  );

drop policy if exists edi_scenarios_access on public.edi_scenarios;
create policy edi_scenarios_access on public.edi_scenarios
  for all to authenticated
  using (
    can_access_school(school_id)
    and (has_permission('edi.executive') or has_permission('edi.manage') or created_by = auth.uid())
  )
  with check (
    can_access_school(school_id)
    and (has_permission('edi.executive') or has_permission('edi.manage'))
  );

drop policy if exists edi_scenario_results_access on public.edi_scenario_results;
create policy edi_scenario_results_access on public.edi_scenario_results
  for all to authenticated
  using (
    exists (
      select 1 from public.edi_scenarios s
      where s.id = scenario_id
        and can_access_school(s.school_id)
        and (has_permission('edi.executive') or has_permission('edi.manage'))
    )
  )
  with check (
    exists (
      select 1 from public.edi_scenarios s
      where s.id = scenario_id
        and can_access_school(s.school_id)
        and (has_permission('edi.executive') or has_permission('edi.manage'))
    )
  );

drop policy if exists edi_capacity_access on public.edi_capacity_snapshots;
create policy edi_capacity_access on public.edi_capacity_snapshots
  for all to authenticated
  using (
    can_access_school(school_id)
    and (has_permission('edi.view') or has_permission('edi.executive'))
  )
  with check (
    can_access_school(school_id)
    and has_permission('edi.executive')
  );

drop policy if exists edi_briefings_read on public.edi_briefings;
create policy edi_briefings_read on public.edi_briefings
  for select to authenticated
  using (
    can_access_school(school_id)
    and (
      has_permission('edi.view') or has_permission('edi.executive')
      or has_permission('edi.board')
    )
  );

drop policy if exists edi_briefings_write on public.edi_briefings;
create policy edi_briefings_write on public.edi_briefings
  for all to authenticated
  using (
    can_access_school(school_id)
    and (has_permission('edi.executive') or has_permission('edi.manage'))
  )
  with check (
    can_access_school(school_id)
    and (has_permission('edi.executive') or has_permission('edi.manage'))
  );

drop policy if exists edi_scorecard_access on public.edi_scorecard_snapshots;
create policy edi_scorecard_access on public.edi_scorecard_snapshots
  for all to authenticated
  using (
    can_access_school(school_id)
    and (
      has_permission('edi.view') or has_permission('edi.executive')
      or has_permission('edi.board')
    )
  )
  with check (
    can_access_school(school_id)
    and has_permission('edi.executive')
  );

drop policy if exists edi_educational_roi_access on public.edi_educational_roi;
create policy edi_educational_roi_access on public.edi_educational_roi
  for all to authenticated
  using (
    can_access_school(school_id)
    and (has_permission('edi.view') or has_permission('edi.executive'))
  )
  with check (
    can_access_school(school_id)
    and has_permission('edi.executive')
  );
