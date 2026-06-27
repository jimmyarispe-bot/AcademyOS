-- RLS: Integration Hub & Open Platform

alter table public.ihub_events enable row level security;
alter table public.ihub_event_subscriptions enable row level security;
alter table public.ihub_oauth_clients enable row level security;
alter table public.ihub_api_audit_log enable row level security;
alter table public.ihub_sync_conflicts enable row level security;
alter table public.ihub_sync_schedules enable row level security;
alter table public.ihub_mapping_profiles enable row level security;
alter table public.ihub_developer_apps enable row level security;
alter table public.ihub_sandbox_keys enable row level security;
alter table public.ihub_sdk_packages enable row level security;
alter table public.ihub_monitoring_snapshots enable row level security;
alter table public.ihub_marketplace_listings enable row level security;

drop policy if exists ihub_events_access on public.ihub_events;
create policy ihub_events_access on public.ihub_events
  for all to authenticated
  using (has_permission('integration.view') or has_permission('integration.admin'))
  with check (has_permission('integration.manage') or has_permission('integration.admin'));

drop policy if exists ihub_event_subscriptions_access on public.ihub_event_subscriptions;
create policy ihub_event_subscriptions_access on public.ihub_event_subscriptions
  for all to authenticated
  using (has_permission('integration.view') or has_permission('integration.admin'))
  with check (has_permission('integration.manage') or has_permission('integration.admin'));

drop policy if exists ihub_oauth_clients_access on public.ihub_oauth_clients;
create policy ihub_oauth_clients_access on public.ihub_oauth_clients
  for all to authenticated
  using (has_permission('integration.admin') or has_permission('developer.portal'))
  with check (has_permission('integration.admin') or has_permission('developer.portal'));

drop policy if exists ihub_api_audit_read on public.ihub_api_audit_log;
create policy ihub_api_audit_read on public.ihub_api_audit_log
  for select to authenticated
  using (has_permission('integration.view') or has_permission('integration.admin'));

drop policy if exists ihub_api_audit_write on public.ihub_api_audit_log;
create policy ihub_api_audit_write on public.ihub_api_audit_log
  for insert to authenticated
  with check (has_permission('integration.manage') or has_permission('integration.admin'));

drop policy if exists ihub_sync_conflicts_access on public.ihub_sync_conflicts;
create policy ihub_sync_conflicts_access on public.ihub_sync_conflicts
  for all to authenticated
  using (has_permission('integration.view') or has_permission('integration.admin'))
  with check (has_permission('integration.manage') or has_permission('integration.admin'));

drop policy if exists ihub_sync_schedules_access on public.ihub_sync_schedules;
create policy ihub_sync_schedules_access on public.ihub_sync_schedules
  for all to authenticated
  using (has_permission('integration.view') or has_permission('integration.admin'))
  with check (has_permission('integration.manage') or has_permission('integration.admin'));

drop policy if exists ihub_mapping_profiles_access on public.ihub_mapping_profiles;
create policy ihub_mapping_profiles_access on public.ihub_mapping_profiles
  for all to authenticated
  using (has_permission('integration.view') or has_permission('integration.admin'))
  with check (has_permission('integration.manage') or has_permission('integration.admin'));

drop policy if exists ihub_developer_apps_access on public.ihub_developer_apps;
create policy ihub_developer_apps_access on public.ihub_developer_apps
  for all to authenticated
  using (has_permission('developer.portal') or has_permission('integration.admin'))
  with check (has_permission('developer.portal') or has_permission('integration.admin'));

drop policy if exists ihub_sandbox_keys_access on public.ihub_sandbox_keys;
create policy ihub_sandbox_keys_access on public.ihub_sandbox_keys
  for all to authenticated
  using (has_permission('developer.portal') or has_permission('integration.admin'))
  with check (has_permission('developer.portal') or has_permission('integration.admin'));

drop policy if exists ihub_sdk_packages_read on public.ihub_sdk_packages;
create policy ihub_sdk_packages_read on public.ihub_sdk_packages
  for select to authenticated
  using (has_permission('integration.view') or has_permission('developer.portal'));

drop policy if exists ihub_monitoring_read on public.ihub_monitoring_snapshots;
create policy ihub_monitoring_read on public.ihub_monitoring_snapshots
  for select to authenticated
  using (has_permission('integration.view') or has_permission('integration.admin'));

drop policy if exists ihub_monitoring_write on public.ihub_monitoring_snapshots;
create policy ihub_monitoring_write on public.ihub_monitoring_snapshots
  for insert to authenticated
  with check (has_permission('integration.manage') or has_permission('integration.admin'));

drop policy if exists ihub_marketplace_read on public.ihub_marketplace_listings;
create policy ihub_marketplace_read on public.ihub_marketplace_listings
  for select to authenticated
  using (has_permission('integration.view') or has_permission('developer.portal'));

drop policy if exists ihub_marketplace_write on public.ihub_marketplace_listings;
create policy ihub_marketplace_write on public.ihub_marketplace_listings
  for all to authenticated
  using (has_permission('integration.admin') or has_permission('developer.portal'))
  with check (has_permission('integration.admin') or has_permission('developer.portal'));
