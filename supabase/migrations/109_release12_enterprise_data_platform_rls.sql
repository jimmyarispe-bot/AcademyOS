-- =========================================
-- RLS: Enterprise Data Platform
-- =========================================

alter table public.edp_import_batches enable row level security;
alter table public.edp_import_records enable row level security;
alter table public.edp_export_batches enable row level security;
alter table public.edp_mapping_templates enable row level security;
alter table public.edp_connector_definitions enable row level security;
alter table public.edp_connector_instances enable row level security;
alter table public.edp_sync_jobs enable row level security;
alter table public.edp_sync_logs enable row level security;
alter table public.edp_api_keys enable row level security;
alter table public.edp_webhooks enable row level security;
alter table public.edp_webhook_deliveries enable row level security;
alter table public.edp_backups enable row level security;
alter table public.edp_archives enable row level security;
alter table public.edp_clone_jobs enable row level security;
alter table public.edp_migration_sessions enable row level security;
alter table public.edp_quality_snapshots enable row level security;
alter table public.edp_warehouse_snapshots enable row level security;
alter table public.edp_validation_results enable row level security;

drop policy if exists edp_import_batches_access on public.edp_import_batches;
create policy edp_import_batches_access on public.edp_import_batches
  for all to authenticated
  using (
    (organization_id is null or exists (select 1 from public.schools s where s.organization_id = edp_import_batches.organization_id))
    and (has_permission('data.view') or has_permission('data.import') or has_permission('data.admin'))
  )
  with check (has_permission('data.import') or has_permission('data.admin'));

drop policy if exists edp_import_records_access on public.edp_import_records;
create policy edp_import_records_access on public.edp_import_records
  for all to authenticated
  using (
    exists (
      select 1 from public.edp_import_batches b
      where b.id = batch_id
        and (has_permission('data.view') or has_permission('data.import') or has_permission('data.admin'))
    )
  )
  with check (has_permission('data.import') or has_permission('data.admin'));

drop policy if exists edp_export_batches_access on public.edp_export_batches;
create policy edp_export_batches_access on public.edp_export_batches
  for all to authenticated
  using (has_permission('data.view') or has_permission('data.export') or has_permission('data.admin'))
  with check (has_permission('data.export') or has_permission('data.admin'));

drop policy if exists edp_mapping_templates_access on public.edp_mapping_templates;
create policy edp_mapping_templates_access on public.edp_mapping_templates
  for all to authenticated
  using (has_permission('data.view') or has_permission('data.manage') or has_permission('data.admin'))
  with check (has_permission('data.manage') or has_permission('data.admin'));

drop policy if exists edp_connector_definitions_read on public.edp_connector_definitions;
create policy edp_connector_definitions_read on public.edp_connector_definitions
  for select to authenticated using (true);

drop policy if exists edp_connector_instances_access on public.edp_connector_instances;
create policy edp_connector_instances_access on public.edp_connector_instances
  for all to authenticated
  using (has_permission('data.manage') or has_permission('data.admin'))
  with check (has_permission('data.manage') or has_permission('data.admin'));

drop policy if exists edp_sync_jobs_access on public.edp_sync_jobs;
create policy edp_sync_jobs_access on public.edp_sync_jobs
  for all to authenticated
  using (has_permission('data.view') or has_permission('data.manage') or has_permission('data.admin'))
  with check (has_permission('data.manage') or has_permission('data.admin'));

drop policy if exists edp_sync_logs_read on public.edp_sync_logs;
create policy edp_sync_logs_read on public.edp_sync_logs
  for select to authenticated
  using (
    exists (
      select 1 from public.edp_sync_jobs j
      where j.id = sync_job_id
        and (has_permission('data.view') or has_permission('data.admin'))
    )
  );

drop policy if exists edp_api_keys_access on public.edp_api_keys;
create policy edp_api_keys_access on public.edp_api_keys
  for all to authenticated
  using (has_permission('data.admin'))
  with check (has_permission('data.admin'));

drop policy if exists edp_webhooks_access on public.edp_webhooks;
create policy edp_webhooks_access on public.edp_webhooks
  for all to authenticated
  using (has_permission('data.manage') or has_permission('data.admin'))
  with check (has_permission('data.manage') or has_permission('data.admin'));

drop policy if exists edp_webhook_deliveries_read on public.edp_webhook_deliveries;
create policy edp_webhook_deliveries_read on public.edp_webhook_deliveries
  for select to authenticated
  using (
    exists (
      select 1 from public.edp_webhooks w
      where w.id = webhook_id
        and (has_permission('data.view') or has_permission('data.admin'))
    )
  );

drop policy if exists edp_backups_access on public.edp_backups;
create policy edp_backups_access on public.edp_backups
  for all to authenticated
  using (has_permission('data.export') or has_permission('data.admin'))
  with check (has_permission('data.export') or has_permission('data.admin'));

drop policy if exists edp_archives_access on public.edp_archives;
create policy edp_archives_access on public.edp_archives
  for all to authenticated
  using (has_permission('data.view') or has_permission('data.admin'))
  with check (has_permission('data.admin'));

drop policy if exists edp_clone_jobs_access on public.edp_clone_jobs;
create policy edp_clone_jobs_access on public.edp_clone_jobs
  for all to authenticated
  using (has_permission('data.admin'))
  with check (has_permission('data.admin'));

drop policy if exists edp_migration_sessions_access on public.edp_migration_sessions;
create policy edp_migration_sessions_access on public.edp_migration_sessions
  for all to authenticated
  using (
    has_permission('data.import') or has_permission('data.admin')
    or started_by = auth.uid()
  )
  with check (has_permission('data.import') or has_permission('data.admin'));

drop policy if exists edp_quality_snapshots_read on public.edp_quality_snapshots;
create policy edp_quality_snapshots_read on public.edp_quality_snapshots
  for select to authenticated
  using (has_permission('data.view') or has_permission('data.admin'));

drop policy if exists edp_quality_snapshots_write on public.edp_quality_snapshots;
create policy edp_quality_snapshots_write on public.edp_quality_snapshots
  for all to authenticated
  using (has_permission('data.admin'))
  with check (has_permission('data.admin'));

drop policy if exists edp_warehouse_snapshots_read on public.edp_warehouse_snapshots;
create policy edp_warehouse_snapshots_read on public.edp_warehouse_snapshots
  for select to authenticated
  using (has_permission('data.view') or has_permission('data.admin'));

drop policy if exists edp_warehouse_snapshots_write on public.edp_warehouse_snapshots;
create policy edp_warehouse_snapshots_write on public.edp_warehouse_snapshots
  for all to authenticated
  using (has_permission('data.admin'))
  with check (has_permission('data.admin'));

drop policy if exists edp_validation_results_read on public.edp_validation_results;
create policy edp_validation_results_read on public.edp_validation_results
  for select to authenticated
  using (has_permission('data.view') or has_permission('data.import') or has_permission('data.admin'));
