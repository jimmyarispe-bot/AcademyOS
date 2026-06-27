-- =========================================
-- RLS: AcademyOS Cloud Platform
-- Cloud Console — cloud.* permissions only (AcademyOS employees)
-- =========================================

alter table public.cloud_customers enable row level security;
alter table public.cloud_subscription_plans enable row level security;
alter table public.cloud_subscriptions enable row level security;
alter table public.cloud_licenses enable row level security;
alter table public.cloud_contracts enable row level security;
alter table public.cloud_invoices enable row level security;
alter table public.cloud_provisioning_jobs enable row level security;
alter table public.cloud_onboarding_sessions enable row level security;
alter table public.cloud_support_tickets enable row level security;
alter table public.cloud_customer_success_snapshots enable row level security;
alter table public.cloud_usage_analytics enable row level security;
alter table public.cloud_product_analytics enable row level security;
alter table public.cloud_platform_health enable row level security;
alter table public.cloud_releases enable row level security;
alter table public.cloud_feature_flags enable row level security;
alter table public.cloud_incidents enable row level security;
alter table public.cloud_deployments enable row level security;
alter table public.cloud_marketplace_modules enable row level security;
alter table public.cloud_marketplace_installations enable row level security;
alter table public.cloud_white_label_settings enable row level security;
alter table public.cloud_system_status enable row level security;
alter table public.cloud_audit_logs enable row level security;

-- Helper: any cloud console access
-- cloud.admin grants full access; other cloud.* grant read or scoped write

drop policy if exists cloud_customers_access on public.cloud_customers;
create policy cloud_customers_access on public.cloud_customers
  for all to authenticated
  using (
    has_permission('cloud.admin') or has_permission('cloud.sales') or has_permission('cloud.support')
    or has_permission('cloud.analytics') or has_permission('cloud.finance')
  )
  with check (has_permission('cloud.admin') or has_permission('cloud.sales'));

drop policy if exists cloud_subscription_plans_read on public.cloud_subscription_plans;
create policy cloud_subscription_plans_read on public.cloud_subscription_plans
  for select to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.sales') or has_permission('cloud.finance'));

drop policy if exists cloud_subscriptions_access on public.cloud_subscriptions;
create policy cloud_subscriptions_access on public.cloud_subscriptions
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.sales') or has_permission('cloud.finance'))
  with check (has_permission('cloud.admin') or has_permission('cloud.sales') or has_permission('cloud.finance'));

drop policy if exists cloud_licenses_access on public.cloud_licenses;
create policy cloud_licenses_access on public.cloud_licenses
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.sales'))
  with check (has_permission('cloud.admin') or has_permission('cloud.sales'));

drop policy if exists cloud_contracts_access on public.cloud_contracts;
create policy cloud_contracts_access on public.cloud_contracts
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.sales') or has_permission('cloud.finance'))
  with check (has_permission('cloud.admin') or has_permission('cloud.sales'));

drop policy if exists cloud_invoices_access on public.cloud_invoices;
create policy cloud_invoices_access on public.cloud_invoices
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.finance'))
  with check (has_permission('cloud.admin') or has_permission('cloud.finance'));

drop policy if exists cloud_provisioning_access on public.cloud_provisioning_jobs;
create policy cloud_provisioning_access on public.cloud_provisioning_jobs
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.operations') or has_permission('cloud.sales'))
  with check (has_permission('cloud.admin') or has_permission('cloud.operations'));

drop policy if exists cloud_onboarding_access on public.cloud_onboarding_sessions;
create policy cloud_onboarding_access on public.cloud_onboarding_sessions
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.support') or has_permission('cloud.sales'))
  with check (has_permission('cloud.admin') or has_permission('cloud.support'));

drop policy if exists cloud_support_tickets_access on public.cloud_support_tickets;
create policy cloud_support_tickets_access on public.cloud_support_tickets
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.support'))
  with check (has_permission('cloud.admin') or has_permission('cloud.support'));

drop policy if exists cloud_cs_snapshots_read on public.cloud_customer_success_snapshots;
create policy cloud_cs_snapshots_read on public.cloud_customer_success_snapshots
  for select to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.analytics') or has_permission('cloud.support'));

drop policy if exists cloud_cs_snapshots_write on public.cloud_customer_success_snapshots;
create policy cloud_cs_snapshots_write on public.cloud_customer_success_snapshots
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.analytics'))
  with check (has_permission('cloud.admin') or has_permission('cloud.analytics'));

drop policy if exists cloud_usage_analytics_read on public.cloud_usage_analytics;
create policy cloud_usage_analytics_read on public.cloud_usage_analytics
  for select to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.analytics'));

drop policy if exists cloud_product_analytics_read on public.cloud_product_analytics;
create policy cloud_product_analytics_read on public.cloud_product_analytics
  for select to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.analytics'));

drop policy if exists cloud_platform_health_read on public.cloud_platform_health;
create policy cloud_platform_health_read on public.cloud_platform_health
  for select to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.operations'));

drop policy if exists cloud_platform_health_write on public.cloud_platform_health;
create policy cloud_platform_health_write on public.cloud_platform_health
  for insert to authenticated
  with check (has_permission('cloud.admin') or has_permission('cloud.operations'));

drop policy if exists cloud_releases_access on public.cloud_releases;
create policy cloud_releases_access on public.cloud_releases
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.engineering'))
  with check (has_permission('cloud.admin') or has_permission('cloud.engineering'));

drop policy if exists cloud_feature_flags_access on public.cloud_feature_flags;
create policy cloud_feature_flags_access on public.cloud_feature_flags
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.engineering'))
  with check (has_permission('cloud.admin') or has_permission('cloud.engineering'));

drop policy if exists cloud_incidents_access on public.cloud_incidents;
create policy cloud_incidents_access on public.cloud_incidents
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.operations'))
  with check (has_permission('cloud.admin') or has_permission('cloud.operations'));

drop policy if exists cloud_deployments_access on public.cloud_deployments;
create policy cloud_deployments_access on public.cloud_deployments
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.operations') or has_permission('cloud.engineering'))
  with check (has_permission('cloud.admin') or has_permission('cloud.operations'));

drop policy if exists cloud_marketplace_modules_read on public.cloud_marketplace_modules;
create policy cloud_marketplace_modules_read on public.cloud_marketplace_modules
  for select to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.sales') or has_permission('cloud.engineering'));

drop policy if exists cloud_marketplace_installations_access on public.cloud_marketplace_installations;
create policy cloud_marketplace_installations_access on public.cloud_marketplace_installations
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.sales'))
  with check (has_permission('cloud.admin') or has_permission('cloud.sales'));

drop policy if exists cloud_white_label_access on public.cloud_white_label_settings;
create policy cloud_white_label_access on public.cloud_white_label_settings
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.sales'))
  with check (has_permission('cloud.admin') or has_permission('cloud.sales'));

drop policy if exists cloud_system_status_read on public.cloud_system_status;
create policy cloud_system_status_read on public.cloud_system_status
  for select to authenticated using (true);

drop policy if exists cloud_system_status_write on public.cloud_system_status;
create policy cloud_system_status_write on public.cloud_system_status
  for all to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.operations'))
  with check (has_permission('cloud.admin') or has_permission('cloud.operations'));

drop policy if exists cloud_audit_logs_read on public.cloud_audit_logs;
create policy cloud_audit_logs_read on public.cloud_audit_logs
  for select to authenticated
  using (has_permission('cloud.admin') or has_permission('cloud.operations'));

drop policy if exists cloud_audit_logs_write on public.cloud_audit_logs;
create policy cloud_audit_logs_write on public.cloud_audit_logs
  for insert to authenticated
  with check (has_permission('cloud.admin') or has_permission('cloud.support') or has_permission('cloud.operations') or has_permission('cloud.sales') or has_permission('cloud.finance'));
