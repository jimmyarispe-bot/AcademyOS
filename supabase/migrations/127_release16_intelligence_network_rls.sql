-- =========================================
-- RLS: AcademyOS Intelligence Network (Release 16)
-- Tenant-isolated — contributions scoped to org; benchmarks are aggregated
-- =========================================

alter table public.ain_participation_settings enable row level security;
alter table public.ain_contributions enable row level security;
alter table public.ain_benchmark_snapshots enable row level security;
alter table public.ain_research_reports enable row level security;
alter table public.ain_forecasts enable row level security;
alter table public.ain_recommendations enable row level security;
alter table public.ain_executive_rankings enable row level security;
alter table public.ain_audit_log enable row level security;

drop policy if exists ain_participation_org on public.ain_participation_settings;
create policy ain_participation_org on public.ain_participation_settings
  for all to authenticated
  using (
    (has_permission('network.view') or has_permission('network.manage') or has_permission('network.admin'))
    and exists (select 1 from public.schools s where s.organization_id = ain_participation_settings.organization_id)
  )
  with check (has_permission('network.manage') or has_permission('network.admin'));

drop policy if exists ain_contributions_org on public.ain_contributions;
create policy ain_contributions_org on public.ain_contributions
  for all to authenticated
  using (
    (has_permission('network.view') or has_permission('network.manage'))
    and exists (select 1 from public.schools s where s.organization_id = ain_contributions.organization_id)
  )
  with check (has_permission('network.manage') or has_permission('network.admin'));

drop policy if exists ain_benchmarks_read on public.ain_benchmark_snapshots;
create policy ain_benchmarks_read on public.ain_benchmark_snapshots
  for select to authenticated
  using (has_permission('network.view') or has_permission('network.manage') or has_permission('network.admin'));

drop policy if exists ain_benchmarks_write on public.ain_benchmark_snapshots;
create policy ain_benchmarks_write on public.ain_benchmark_snapshots
  for insert to authenticated
  with check (has_permission('network.admin'));

drop policy if exists ain_research_read on public.ain_research_reports;
create policy ain_research_read on public.ain_research_reports
  for select to authenticated
  using (has_permission('network.view') or has_permission('network.manage') or has_permission('network.admin'));

drop policy if exists ain_forecasts_org on public.ain_forecasts;
create policy ain_forecasts_org on public.ain_forecasts
  for all to authenticated
  using (
    (has_permission('network.view') or has_permission('network.manage'))
    and exists (select 1 from public.schools s where s.organization_id = ain_forecasts.organization_id)
  )
  with check (has_permission('network.manage') or has_permission('network.admin'));

drop policy if exists ain_recommendations_org on public.ain_recommendations;
create policy ain_recommendations_org on public.ain_recommendations
  for all to authenticated
  using (
    (has_permission('network.view') or has_permission('network.manage'))
    and exists (select 1 from public.schools s where s.organization_id = ain_recommendations.organization_id)
  )
  with check (has_permission('network.manage') or has_permission('network.admin'));

drop policy if exists ain_rankings_read on public.ain_executive_rankings;
create policy ain_rankings_read on public.ain_executive_rankings
  for select to authenticated
  using (has_permission('network.view') or has_permission('network.manage') or has_permission('network.admin'));

drop policy if exists ain_audit_org on public.ain_audit_log;
create policy ain_audit_org on public.ain_audit_log
  for all to authenticated
  using (
    (organization_id is null or exists (select 1 from public.schools s where s.organization_id = ain_audit_log.organization_id))
    and (has_permission('network.view') or has_permission('network.admin'))
  )
  with check (has_permission('network.manage') or has_permission('network.admin'));
