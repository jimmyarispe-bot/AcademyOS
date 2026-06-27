-- =========================================
-- RLS: Configuration Studio
-- =========================================

alter table public.config_sections enable row level security;
alter table public.config_version_history enable row level security;
alter table public.config_module_definitions enable row level security;
alter table public.config_module_installations enable row level security;
alter table public.config_setup_sessions enable row level security;
alter table public.config_go_live_checks enable row level security;
alter table public.config_go_live_launches enable row level security;
alter table public.config_packages enable row level security;
alter table public.config_organization_templates enable row level security;

drop policy if exists config_sections_read on public.config_sections;
create policy config_sections_read on public.config_sections
  for select to authenticated
  using (
    has_permission('configuration.view')
    or has_permission('configuration.manage')
    or has_permission('configuration.admin')
    or has_permission('org.view')
  );

drop policy if exists config_sections_write on public.config_sections;
create policy config_sections_write on public.config_sections
  for all to authenticated
  using (
    has_permission('configuration.manage')
    or has_permission('configuration.admin')
    or has_permission('school.configure')
  )
  with check (
    has_permission('configuration.manage')
    or has_permission('configuration.admin')
    or has_permission('school.configure')
  );

drop policy if exists config_version_history_read on public.config_version_history;
create policy config_version_history_read on public.config_version_history
  for select to authenticated
  using (
    has_permission('configuration.view')
    or has_permission('configuration.admin')
    or has_permission('audit.view_all')
  );

drop policy if exists config_version_history_write on public.config_version_history;
create policy config_version_history_write on public.config_version_history
  for insert to authenticated
  with check (has_permission('configuration.manage') or has_permission('configuration.admin'));

drop policy if exists config_module_definitions_read on public.config_module_definitions;
create policy config_module_definitions_read on public.config_module_definitions
  for select to authenticated using (true);

drop policy if exists config_module_installations_access on public.config_module_installations;
create policy config_module_installations_access on public.config_module_installations
  for all to authenticated
  using (has_permission('configuration.manage') or has_permission('configuration.admin'))
  with check (has_permission('configuration.manage') or has_permission('configuration.admin'));

drop policy if exists config_setup_sessions_access on public.config_setup_sessions;
create policy config_setup_sessions_access on public.config_setup_sessions
  for all to authenticated
  using (
    has_permission('configuration.manage')
    or has_permission('configuration.admin')
    or started_by = auth.uid()
  )
  with check (has_permission('configuration.manage') or has_permission('configuration.admin'));

drop policy if exists config_go_live_checks_read on public.config_go_live_checks;
create policy config_go_live_checks_read on public.config_go_live_checks
  for select to authenticated
  using (
    has_permission('configuration.view')
    or has_permission('configuration.launch')
    or has_permission('configuration.admin')
  );

drop policy if exists config_go_live_checks_write on public.config_go_live_checks;
create policy config_go_live_checks_write on public.config_go_live_checks
  for all to authenticated
  using (has_permission('configuration.admin') or has_permission('configuration.launch'))
  with check (has_permission('configuration.admin') or has_permission('configuration.launch'));

drop policy if exists config_go_live_launches_access on public.config_go_live_launches;
create policy config_go_live_launches_access on public.config_go_live_launches
  for all to authenticated
  using (has_permission('configuration.launch') or has_permission('configuration.admin'))
  with check (has_permission('configuration.launch') or has_permission('configuration.admin'));

drop policy if exists config_packages_access on public.config_packages;
create policy config_packages_access on public.config_packages
  for all to authenticated
  using (has_permission('configuration.admin') or has_permission('configuration.manage'))
  with check (has_permission('configuration.admin') or has_permission('configuration.manage'));

drop policy if exists config_organization_templates_read on public.config_organization_templates;
create policy config_organization_templates_read on public.config_organization_templates
  for select to authenticated using (is_active = true);
