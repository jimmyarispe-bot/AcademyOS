-- RLS: Integration Hub enterprise extensions

alter table public.ihub_integration_registry enable row level security;
alter table public.ihub_credential_vault enable row level security;
alter table public.ihub_custom_connectors enable row level security;
alter table public.ihub_webhook_dead_letter enable row level security;
alter table public.ihub_marketplace_reviews enable row level security;
alter table public.ihub_executive_snapshots enable row level security;

drop policy if exists ihub_integration_registry_access on public.ihub_integration_registry;
create policy ihub_integration_registry_access on public.ihub_integration_registry
  for all to authenticated
  using (has_permission('integration.view') or has_permission('integration.admin'))
  with check (has_permission('integration.manage') or has_permission('integration.admin'));

drop policy if exists ihub_credential_vault_access on public.ihub_credential_vault;
create policy ihub_credential_vault_access on public.ihub_credential_vault
  for all to authenticated
  using (has_permission('integration.admin'))
  with check (has_permission('integration.admin'));

drop policy if exists ihub_custom_connectors_access on public.ihub_custom_connectors;
create policy ihub_custom_connectors_access on public.ihub_custom_connectors
  for all to authenticated
  using (has_permission('integration.view') or has_permission('integration.admin'))
  with check (has_permission('integration.manage') or has_permission('integration.admin'));

drop policy if exists ihub_webhook_dlq_access on public.ihub_webhook_dead_letter;
create policy ihub_webhook_dlq_access on public.ihub_webhook_dead_letter
  for all to authenticated
  using (has_permission('integration.view') or has_permission('integration.admin'))
  with check (has_permission('integration.manage') or has_permission('integration.admin'));

drop policy if exists ihub_marketplace_reviews_read on public.ihub_marketplace_reviews;
create policy ihub_marketplace_reviews_read on public.ihub_marketplace_reviews
  for select to authenticated
  using (has_permission('integration.view') or has_permission('integration.marketplace'));

drop policy if exists ihub_marketplace_reviews_write on public.ihub_marketplace_reviews;
create policy ihub_marketplace_reviews_write on public.ihub_marketplace_reviews
  for insert to authenticated
  with check (has_permission('integration.marketplace') or has_permission('integration.admin'));

drop policy if exists ihub_executive_snapshots_read on public.ihub_executive_snapshots;
create policy ihub_executive_snapshots_read on public.ihub_executive_snapshots
  for select to authenticated
  using (has_permission('integration.view') or has_permission('integration.admin'));

drop policy if exists ihub_executive_snapshots_write on public.ihub_executive_snapshots;
create policy ihub_executive_snapshots_write on public.ihub_executive_snapshots
  for insert to authenticated
  with check (has_permission('integration.manage') or has_permission('integration.admin'));
