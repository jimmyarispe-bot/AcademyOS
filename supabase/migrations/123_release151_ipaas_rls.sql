-- RLS: Release 15.1 iPaaS extensions

alter table public.ihub_automation_workflows enable row level security;
alter table public.ihub_automation_runs enable row level security;
alter table public.ihub_command_center_snapshots enable row level security;
alter table public.ihub_connector_certifications enable row level security;
alter table public.ihub_provisioning_jobs enable row level security;
alter table public.ihub_usage_metering enable row level security;
alter table public.ihub_dr_backups enable row level security;
alter table public.ihub_dr_drills enable row level security;
alter table public.ihub_event_retention_policies enable row level security;
alter table public.ihub_event_dead_letter enable row level security;

drop policy if exists ihub_automation_workflows_access on public.ihub_automation_workflows;
create policy ihub_automation_workflows_access on public.ihub_automation_workflows
  for all to authenticated
  using (has_permission('integration.view') or has_permission('integration.admin'))
  with check (has_permission('integration.manage') or has_permission('integration.admin'));

drop policy if exists ihub_automation_runs_access on public.ihub_automation_runs;
create policy ihub_automation_runs_access on public.ihub_automation_runs
  for all to authenticated
  using (has_permission('integration.view') or has_permission('integration.admin'))
  with check (has_permission('integration.manage') or has_permission('integration.admin'));

drop policy if exists ihub_command_center_read on public.ihub_command_center_snapshots;
create policy ihub_command_center_read on public.ihub_command_center_snapshots
  for select to authenticated
  using (has_permission('integration.operations') or has_permission('integration.view') or has_permission('integration.admin'));

drop policy if exists ihub_command_center_write on public.ihub_command_center_snapshots;
create policy ihub_command_center_write on public.ihub_command_center_snapshots
  for insert to authenticated
  with check (has_permission('integration.operations') or has_permission('integration.admin'));

drop policy if exists ihub_connector_certifications_read on public.ihub_connector_certifications;
create policy ihub_connector_certifications_read on public.ihub_connector_certifications
  for select to authenticated
  using (has_permission('integration.view') or has_permission('integration.marketplace'));

drop policy if exists ihub_connector_certifications_write on public.ihub_connector_certifications;
create policy ihub_connector_certifications_write on public.ihub_connector_certifications
  for all to authenticated
  using (has_permission('integration.admin'))
  with check (has_permission('integration.admin'));

drop policy if exists ihub_provisioning_jobs_access on public.ihub_provisioning_jobs;
create policy ihub_provisioning_jobs_access on public.ihub_provisioning_jobs
  for all to authenticated
  using (has_permission('integration.admin') or has_permission('cloud.admin'))
  with check (has_permission('integration.admin') or has_permission('cloud.admin'));

drop policy if exists ihub_usage_metering_access on public.ihub_usage_metering;
create policy ihub_usage_metering_access on public.ihub_usage_metering
  for all to authenticated
  using (has_permission('integration.view') or has_permission('integration.operations'))
  with check (has_permission('integration.admin') or has_permission('integration.operations'));

drop policy if exists ihub_dr_backups_access on public.ihub_dr_backups;
create policy ihub_dr_backups_access on public.ihub_dr_backups
  for all to authenticated
  using (has_permission('integration.admin') or has_permission('integration.security'))
  with check (has_permission('integration.admin') or has_permission('integration.security'));

drop policy if exists ihub_dr_drills_access on public.ihub_dr_drills;
create policy ihub_dr_drills_access on public.ihub_dr_drills
  for all to authenticated
  using (has_permission('integration.admin') or has_permission('integration.security'))
  with check (has_permission('integration.admin') or has_permission('integration.security'));

drop policy if exists ihub_event_retention_access on public.ihub_event_retention_policies;
create policy ihub_event_retention_access on public.ihub_event_retention_policies
  for all to authenticated
  using (has_permission('integration.admin'))
  with check (has_permission('integration.admin'));

drop policy if exists ihub_event_dead_letter_access on public.ihub_event_dead_letter;
create policy ihub_event_dead_letter_access on public.ihub_event_dead_letter
  for all to authenticated
  using (has_permission('integration.view') or has_permission('integration.operations'))
  with check (has_permission('integration.manage') or has_permission('integration.admin'));
