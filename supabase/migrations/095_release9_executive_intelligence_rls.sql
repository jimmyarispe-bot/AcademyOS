-- =========================================
-- RELEASE 9 RLS: Executive Intelligence
-- =========================================

alter table public.executive_kpi_definitions enable row level security;
alter table public.executive_kpi_snapshots enable row level security;
alter table public.executive_dashboard_layouts enable row level security;
alter table public.executive_insights enable row level security;
alter table public.executive_risk_register enable row level security;
alter table public.executive_strategic_goals enable row level security;
alter table public.executive_strategic_initiatives enable row level security;
alter table public.executive_strategic_milestones enable row level security;
alter table public.executive_compliance_requirements enable row level security;
alter table public.executive_grants enable row level security;
alter table public.executive_report_templates enable row level security;
alter table public.executive_report_runs enable row level security;
alter table public.executive_forecast_scenarios enable row level security;

-- KPI definitions: read for executives, write for admins
drop policy if exists executive_kpi_definitions_read on public.executive_kpi_definitions;
create policy executive_kpi_definitions_read on public.executive_kpi_definitions
  for select to authenticated
  using (has_permission('executive.intelligence') or has_permission('executive.dashboard') or has_permission('global.reporting'));

drop policy if exists executive_kpi_definitions_manage on public.executive_kpi_definitions;
create policy executive_kpi_definitions_manage on public.executive_kpi_definitions
  for all to authenticated
  using (has_permission('executive.strategic') or has_permission('founder.override'))
  with check (has_permission('executive.strategic') or has_permission('founder.override'));

-- KPI snapshots
drop policy if exists executive_kpi_snapshots_access on public.executive_kpi_snapshots;
create policy executive_kpi_snapshots_access on public.executive_kpi_snapshots
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.intelligence') or has_permission('executive.dashboard') or has_permission('global.reporting'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.intelligence') or has_permission('executive.strategic'))
  );

-- Dashboard layouts: own records
drop policy if exists executive_dashboard_layouts_own on public.executive_dashboard_layouts;
create policy executive_dashboard_layouts_own on public.executive_dashboard_layouts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Insights
drop policy if exists executive_insights_access on public.executive_insights;
create policy executive_insights_access on public.executive_insights
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.intelligence') or has_permission('executive.dashboard'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and has_permission('executive.intelligence')
  );

-- Risk register
drop policy if exists executive_risk_register_access on public.executive_risk_register;
create policy executive_risk_register_access on public.executive_risk_register
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.risk_view') or has_permission('executive.intelligence'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.risk_view') or has_permission('executive.strategic'))
  );

-- Strategic planning
drop policy if exists executive_strategic_goals_access on public.executive_strategic_goals;
create policy executive_strategic_goals_access on public.executive_strategic_goals
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.strategic') or has_permission('executive.intelligence'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and has_permission('executive.strategic')
  );

drop policy if exists executive_strategic_initiatives_access on public.executive_strategic_initiatives;
create policy executive_strategic_initiatives_access on public.executive_strategic_initiatives
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.strategic') or has_permission('executive.intelligence'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and has_permission('executive.strategic')
  );

drop policy if exists executive_strategic_milestones_access on public.executive_strategic_milestones;
create policy executive_strategic_milestones_access on public.executive_strategic_milestones
  for all to authenticated
  using (
    exists (
      select 1 from public.executive_strategic_initiatives i
      where i.id = initiative_id
        and (i.school_id is null or can_access_school(i.school_id))
        and (has_permission('executive.strategic') or has_permission('executive.intelligence'))
    )
  )
  with check (
    exists (
      select 1 from public.executive_strategic_initiatives i
      where i.id = initiative_id
        and (i.school_id is null or can_access_school(i.school_id))
        and has_permission('executive.strategic')
    )
  );

-- Compliance center
drop policy if exists executive_compliance_requirements_access on public.executive_compliance_requirements;
create policy executive_compliance_requirements_access on public.executive_compliance_requirements
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.intelligence') or has_permission('compliance.view'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.strategic') or has_permission('compliance.view'))
  );

-- Grants
drop policy if exists executive_grants_access on public.executive_grants;
create policy executive_grants_access on public.executive_grants
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.intelligence') or has_permission('finance.view'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.strategic') or has_permission('finance.view'))
  );

-- Report templates & runs
drop policy if exists executive_report_templates_access on public.executive_report_templates;
create policy executive_report_templates_access on public.executive_report_templates
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.board_reports') or has_permission('global.reporting'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.board_reports') or has_permission('global.reporting'))
  );

drop policy if exists executive_report_runs_access on public.executive_report_runs;
create policy executive_report_runs_access on public.executive_report_runs
  for all to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.board_reports') or has_permission('global.reporting'))
  )
  with check (
    (school_id is null or can_access_school(school_id))
    and (has_permission('executive.board_reports') or has_permission('global.reporting'))
  );

-- Forecast scenarios
drop policy if exists executive_forecast_scenarios_access on public.executive_forecast_scenarios;
create policy executive_forecast_scenarios_access on public.executive_forecast_scenarios
  for all to authenticated
  using (
    can_access_school(school_id)
    and (has_permission('executive.intelligence') or has_permission('finance.forecast'))
  )
  with check (
    can_access_school(school_id)
    and (has_permission('executive.intelligence') or has_permission('finance.forecast'))
  );

-- Reporting views: read via school access
grant select on public.rpt_enrollment_summary to authenticated;
grant select on public.rpt_admissions_pipeline to authenticated;
grant select on public.rpt_financial_kpis to authenticated;
grant select on public.rpt_student_outcomes to authenticated;
grant select on public.rpt_workforce_kpis to authenticated;
