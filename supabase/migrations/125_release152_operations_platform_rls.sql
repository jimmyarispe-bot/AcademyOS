-- =========================================
-- RLS: AcademyOS Operations Platform (Release 15.2)
-- operations.* permissions — AcademyOS employees
-- =========================================

alter table public.ops_executive_snapshots enable row level security;
alter table public.ops_customer_health_profiles enable row level security;
alter table public.ops_revenue_snapshots enable row level security;
alter table public.ops_platform_snapshots enable row level security;
alter table public.ops_security_snapshots enable row level security;
alter table public.ops_support_snapshots enable row level security;
alter table public.ops_deployment_rollouts enable row level security;
alter table public.ops_partners enable row level security;
alter table public.ops_university_courses enable row level security;
alter table public.ops_university_enrollments enable row level security;
alter table public.ops_marketplace_business enable row level security;
alter table public.ops_backup_records enable row level security;

drop policy if exists ops_executive_snapshots_access on public.ops_executive_snapshots;
create policy ops_executive_snapshots_access on public.ops_executive_snapshots
  for all to authenticated
  using (has_permission('operations.view') or has_permission('operations.executive') or has_permission('operations.manage'))
  with check (has_permission('operations.manage') or has_permission('operations.executive'));

drop policy if exists ops_customer_health_access on public.ops_customer_health_profiles;
create policy ops_customer_health_access on public.ops_customer_health_profiles
  for all to authenticated
  using (has_permission('operations.view') or has_permission('operations.manage') or has_permission('operations.support'))
  with check (has_permission('operations.manage') or has_permission('operations.support'));

drop policy if exists ops_revenue_snapshots_access on public.ops_revenue_snapshots;
create policy ops_revenue_snapshots_access on public.ops_revenue_snapshots
  for all to authenticated
  using (has_permission('operations.view') or has_permission('operations.billing') or has_permission('operations.executive'))
  with check (has_permission('operations.billing') or has_permission('operations.manage'));

drop policy if exists ops_platform_snapshots_access on public.ops_platform_snapshots;
create policy ops_platform_snapshots_access on public.ops_platform_snapshots
  for all to authenticated
  using (has_permission('operations.view') or has_permission('operations.manage'))
  with check (has_permission('operations.manage'));

drop policy if exists ops_security_snapshots_access on public.ops_security_snapshots;
create policy ops_security_snapshots_access on public.ops_security_snapshots
  for all to authenticated
  using (has_permission('operations.view') or has_permission('operations.security') or has_permission('operations.manage'))
  with check (has_permission('operations.security') or has_permission('operations.manage'));

drop policy if exists ops_support_snapshots_access on public.ops_support_snapshots;
create policy ops_support_snapshots_access on public.ops_support_snapshots
  for all to authenticated
  using (has_permission('operations.view') or has_permission('operations.support') or has_permission('operations.manage'))
  with check (has_permission('operations.support') or has_permission('operations.manage'));

drop policy if exists ops_deployment_rollouts_access on public.ops_deployment_rollouts;
create policy ops_deployment_rollouts_access on public.ops_deployment_rollouts
  for all to authenticated
  using (has_permission('operations.view') or has_permission('operations.manage'))
  with check (has_permission('operations.manage'));

drop policy if exists ops_partners_access on public.ops_partners;
create policy ops_partners_access on public.ops_partners
  for all to authenticated
  using (has_permission('operations.view') or has_permission('operations.partners') or has_permission('operations.manage'))
  with check (has_permission('operations.partners') or has_permission('operations.manage'));

drop policy if exists ops_university_courses_read on public.ops_university_courses;
create policy ops_university_courses_read on public.ops_university_courses
  for select to authenticated
  using (has_permission('operations.view') or has_permission('operations.manage'));

drop policy if exists ops_university_enrollments_access on public.ops_university_enrollments;
create policy ops_university_enrollments_access on public.ops_university_enrollments
  for all to authenticated
  using (has_permission('operations.view') or has_permission('operations.manage'))
  with check (has_permission('operations.manage') or user_id = auth.uid());

drop policy if exists ops_marketplace_business_access on public.ops_marketplace_business;
create policy ops_marketplace_business_access on public.ops_marketplace_business
  for all to authenticated
  using (has_permission('operations.view') or has_permission('operations.analytics') or has_permission('operations.billing'))
  with check (has_permission('operations.manage') or has_permission('operations.analytics'));

drop policy if exists ops_backup_records_access on public.ops_backup_records;
create policy ops_backup_records_access on public.ops_backup_records
  for all to authenticated
  using (has_permission('operations.view') or has_permission('operations.manage') or has_permission('operations.security'))
  with check (has_permission('operations.manage') or has_permission('operations.security'));
