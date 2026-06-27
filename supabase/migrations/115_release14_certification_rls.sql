-- =========================================
-- RLS: Version 1.0 Certification Center
-- =========================================

alter table public.cert_runs enable row level security;
alter table public.cert_workflow_tests enable row level security;
alter table public.cert_security_checks enable row level security;
alter table public.cert_performance_metrics enable row level security;
alter table public.cert_accessibility_checks enable row level security;
alter table public.cert_mobile_checks enable row level security;
alter table public.cert_integration_health enable row level security;
alter table public.cert_dr_tests enable row level security;
alter table public.cert_documentation enable row level security;
alter table public.cert_university_paths enable row level security;
alter table public.cert_university_progress enable row level security;
alter table public.cert_demo_environments enable row level security;
alter table public.cert_readiness_snapshots enable row level security;
alter table public.cert_health_scans enable row level security;

drop policy if exists cert_runs_access on public.cert_runs;
create policy cert_runs_access on public.cert_runs
  for all to authenticated
  using (has_permission('certification.view') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_workflow_tests_read on public.cert_workflow_tests;
create policy cert_workflow_tests_read on public.cert_workflow_tests
  for select to authenticated
  using (
    exists (select 1 from public.cert_runs r where r.id = cert_run_id
      and (has_permission('certification.view') or has_permission('certification.admin')))
  );

drop policy if exists cert_workflow_tests_write on public.cert_workflow_tests;
create policy cert_workflow_tests_write on public.cert_workflow_tests
  for all to authenticated
  using (has_permission('certification.manage') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_security_checks_read on public.cert_security_checks;
create policy cert_security_checks_read on public.cert_security_checks
  for select to authenticated
  using (has_permission('certification.view') or has_permission('certification.admin'));

drop policy if exists cert_security_checks_write on public.cert_security_checks;
create policy cert_security_checks_write on public.cert_security_checks
  for all to authenticated
  using (has_permission('certification.manage') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_performance_metrics_read on public.cert_performance_metrics;
create policy cert_performance_metrics_read on public.cert_performance_metrics
  for select to authenticated
  using (has_permission('certification.view') or has_permission('certification.admin'));

drop policy if exists cert_performance_metrics_write on public.cert_performance_metrics;
create policy cert_performance_metrics_write on public.cert_performance_metrics
  for all to authenticated
  using (has_permission('certification.manage') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_accessibility_checks_read on public.cert_accessibility_checks;
create policy cert_accessibility_checks_read on public.cert_accessibility_checks
  for select to authenticated using (has_permission('certification.view') or has_permission('certification.admin'));

drop policy if exists cert_accessibility_checks_write on public.cert_accessibility_checks;
create policy cert_accessibility_checks_write on public.cert_accessibility_checks
  for all to authenticated
  using (has_permission('certification.manage') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_mobile_checks_read on public.cert_mobile_checks;
create policy cert_mobile_checks_read on public.cert_mobile_checks
  for select to authenticated using (has_permission('certification.view') or has_permission('certification.admin'));

drop policy if exists cert_mobile_checks_write on public.cert_mobile_checks;
create policy cert_mobile_checks_write on public.cert_mobile_checks
  for all to authenticated
  using (has_permission('certification.manage') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_integration_health_read on public.cert_integration_health;
create policy cert_integration_health_read on public.cert_integration_health
  for select to authenticated using (has_permission('certification.view') or has_permission('certification.admin'));

drop policy if exists cert_integration_health_write on public.cert_integration_health;
create policy cert_integration_health_write on public.cert_integration_health
  for all to authenticated
  using (has_permission('certification.manage') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_dr_tests_read on public.cert_dr_tests;
create policy cert_dr_tests_read on public.cert_dr_tests
  for select to authenticated using (has_permission('certification.view') or has_permission('certification.admin'));

drop policy if exists cert_dr_tests_write on public.cert_dr_tests;
create policy cert_dr_tests_write on public.cert_dr_tests
  for all to authenticated
  using (has_permission('certification.manage') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_documentation_read on public.cert_documentation;
create policy cert_documentation_read on public.cert_documentation
  for select to authenticated using (true);

drop policy if exists cert_documentation_write on public.cert_documentation;
create policy cert_documentation_write on public.cert_documentation
  for all to authenticated
  using (has_permission('certification.manage') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_university_paths_read on public.cert_university_paths;
create policy cert_university_paths_read on public.cert_university_paths
  for select to authenticated using (true);

drop policy if exists cert_university_progress_access on public.cert_university_progress;
create policy cert_university_progress_access on public.cert_university_progress
  for all to authenticated
  using (user_id = auth.uid() or has_permission('certification.admin'))
  with check (user_id = auth.uid() or has_permission('certification.admin'));

drop policy if exists cert_demo_environments_access on public.cert_demo_environments;
create policy cert_demo_environments_access on public.cert_demo_environments
  for all to authenticated
  using (has_permission('certification.view') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_readiness_snapshots_read on public.cert_readiness_snapshots;
create policy cert_readiness_snapshots_read on public.cert_readiness_snapshots
  for select to authenticated
  using (has_permission('certification.view') or has_permission('certification.admin'));

drop policy if exists cert_readiness_snapshots_write on public.cert_readiness_snapshots;
create policy cert_readiness_snapshots_write on public.cert_readiness_snapshots
  for all to authenticated
  using (has_permission('certification.admin'))
  with check (has_permission('certification.admin'));

drop policy if exists cert_health_scans_read on public.cert_health_scans;
create policy cert_health_scans_read on public.cert_health_scans
  for select to authenticated
  using (has_permission('certification.view') or has_permission('certification.admin'));

drop policy if exists cert_health_scans_write on public.cert_health_scans;
create policy cert_health_scans_write on public.cert_health_scans
  for all to authenticated
  using (has_permission('certification.admin'))
  with check (has_permission('certification.admin'));
