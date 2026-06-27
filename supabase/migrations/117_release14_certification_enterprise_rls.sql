-- RLS: Enterprise Certification extensions

alter table public.cert_scalability_tests enable row level security;
alter table public.cert_pwa_checks enable row level security;
alter table public.cert_bugs enable row level security;
alter table public.cert_support_readiness enable row level security;
alter table public.cert_health_reports enable row level security;

drop policy if exists cert_scalability_read on public.cert_scalability_tests;
create policy cert_scalability_read on public.cert_scalability_tests
  for select to authenticated using (has_permission('certification.view') or has_permission('certification.admin'));

drop policy if exists cert_scalability_write on public.cert_scalability_tests;
create policy cert_scalability_write on public.cert_scalability_tests
  for all to authenticated
  using (has_permission('certification.manage') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_pwa_read on public.cert_pwa_checks;
create policy cert_pwa_read on public.cert_pwa_checks
  for select to authenticated using (has_permission('certification.view') or has_permission('certification.admin'));

drop policy if exists cert_pwa_write on public.cert_pwa_checks;
create policy cert_pwa_write on public.cert_pwa_checks
  for all to authenticated
  using (has_permission('certification.manage') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_bugs_access on public.cert_bugs;
create policy cert_bugs_access on public.cert_bugs
  for all to authenticated
  using (has_permission('certification.view') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_support_read on public.cert_support_readiness;
create policy cert_support_readiness_read on public.cert_support_readiness
  for select to authenticated using (has_permission('certification.view') or has_permission('certification.admin'));

drop policy if exists cert_support_write on public.cert_support_readiness;
create policy cert_support_readiness_write on public.cert_support_readiness
  for all to authenticated
  using (has_permission('certification.manage') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));

drop policy if exists cert_health_reports_read on public.cert_health_reports;
create policy cert_health_reports_read on public.cert_health_reports
  for select to authenticated using (has_permission('certification.view') or has_permission('certification.admin'));

drop policy if exists cert_health_reports_write on public.cert_health_reports;
create policy cert_health_reports_write on public.cert_health_reports
  for all to authenticated
  using (has_permission('certification.manage') or has_permission('certification.admin'))
  with check (has_permission('certification.manage') or has_permission('certification.admin'));
