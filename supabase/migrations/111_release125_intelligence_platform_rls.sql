-- =========================================
-- RLS: Enterprise Intelligence & AI Readiness Framework
-- =========================================

alter table public.aip_provider_definitions enable row level security;
alter table public.aip_provider_instances enable row level security;
alter table public.aip_prompts enable row level security;
alter table public.aip_prompt_versions enable row level security;
alter table public.aip_policies enable row level security;
alter table public.aip_knowledge_sources enable row level security;
alter table public.aip_org_settings enable row level security;
alter table public.aip_school_settings enable row level security;
alter table public.aip_module_settings enable row level security;
alter table public.aip_jobs enable row level security;
alter table public.aip_job_logs enable row level security;
alter table public.aip_token_usage enable row level security;
alter table public.aip_audit_logs enable row level security;
alter table public.aip_approvals enable row level security;
alter table public.aip_test_runs enable row level security;

drop policy if exists aip_provider_definitions_read on public.aip_provider_definitions;
create policy aip_provider_definitions_read on public.aip_provider_definitions
  for select to authenticated using (true);

drop policy if exists aip_provider_instances_access on public.aip_provider_instances;
create policy aip_provider_instances_access on public.aip_provider_instances
  for all to authenticated
  using (has_permission('ai.view') or has_permission('ai.providers') or has_permission('ai.admin'))
  with check (has_permission('ai.providers') or has_permission('ai.admin'));

drop policy if exists aip_prompts_access on public.aip_prompts;
create policy aip_prompts_access on public.aip_prompts
  for all to authenticated
  using (has_permission('ai.view') or has_permission('ai.prompts') or has_permission('ai.manage') or has_permission('ai.admin'))
  with check (has_permission('ai.prompts') or has_permission('ai.manage') or has_permission('ai.admin'));

drop policy if exists aip_prompt_versions_access on public.aip_prompt_versions;
create policy aip_prompt_versions_access on public.aip_prompt_versions
  for all to authenticated
  using (
    exists (
      select 1 from public.aip_prompts p
      where p.id = prompt_id
        and (has_permission('ai.view') or has_permission('ai.prompts') or has_permission('ai.admin'))
    )
  )
  with check (has_permission('ai.prompts') or has_permission('ai.manage') or has_permission('ai.admin'));

drop policy if exists aip_policies_access on public.aip_policies;
create policy aip_policies_access on public.aip_policies
  for all to authenticated
  using (has_permission('ai.view') or has_permission('ai.manage') or has_permission('ai.admin'))
  with check (has_permission('ai.manage') or has_permission('ai.admin'));

drop policy if exists aip_knowledge_sources_access on public.aip_knowledge_sources;
create policy aip_knowledge_sources_access on public.aip_knowledge_sources
  for all to authenticated
  using (has_permission('ai.view') or has_permission('ai.manage') or has_permission('ai.admin'))
  with check (has_permission('ai.manage') or has_permission('ai.admin'));

drop policy if exists aip_org_settings_access on public.aip_org_settings;
create policy aip_org_settings_access on public.aip_org_settings
  for all to authenticated
  using (has_permission('ai.view') or has_permission('ai.admin'))
  with check (has_permission('ai.admin'));

drop policy if exists aip_school_settings_access on public.aip_school_settings;
create policy aip_school_settings_access on public.aip_school_settings
  for all to authenticated
  using (has_permission('ai.view') or has_permission('ai.manage') or has_permission('ai.admin'))
  with check (has_permission('ai.manage') or has_permission('ai.admin'));

drop policy if exists aip_module_settings_access on public.aip_module_settings;
create policy aip_module_settings_access on public.aip_module_settings
  for all to authenticated
  using (has_permission('ai.view') or has_permission('ai.manage') or has_permission('ai.admin'))
  with check (has_permission('ai.manage') or has_permission('ai.admin'));

drop policy if exists aip_jobs_access on public.aip_jobs;
create policy aip_jobs_access on public.aip_jobs
  for all to authenticated
  using (has_permission('ai.view') or has_permission('ai.use') or has_permission('ai.admin') or requested_by = auth.uid())
  with check (has_permission('ai.use') or has_permission('ai.admin'));

drop policy if exists aip_job_logs_read on public.aip_job_logs;
create policy aip_job_logs_read on public.aip_job_logs
  for select to authenticated
  using (
    exists (
      select 1 from public.aip_jobs j
      where j.id = job_id
        and (has_permission('ai.view') or has_permission('ai.admin'))
    )
  );

drop policy if exists aip_token_usage_read on public.aip_token_usage;
create policy aip_token_usage_read on public.aip_token_usage
  for select to authenticated
  using (has_permission('ai.view') or has_permission('ai.admin') or user_id = auth.uid());

drop policy if exists aip_token_usage_write on public.aip_token_usage;
create policy aip_token_usage_write on public.aip_token_usage
  for insert to authenticated
  with check (has_permission('ai.admin') or has_permission('ai.use'));

drop policy if exists aip_audit_logs_read on public.aip_audit_logs;
create policy aip_audit_logs_read on public.aip_audit_logs
  for select to authenticated
  using (has_permission('ai.view') or has_permission('ai.admin') or requested_by = auth.uid());

drop policy if exists aip_audit_logs_write on public.aip_audit_logs;
create policy aip_audit_logs_write on public.aip_audit_logs
  for insert to authenticated
  with check (has_permission('ai.use') or has_permission('ai.admin'));

drop policy if exists aip_approvals_access on public.aip_approvals;
create policy aip_approvals_access on public.aip_approvals
  for all to authenticated
  using (has_permission('ai.view') or has_permission('ai.manage') or has_permission('ai.admin'))
  with check (has_permission('ai.manage') or has_permission('ai.admin'));

drop policy if exists aip_test_runs_access on public.aip_test_runs;
create policy aip_test_runs_access on public.aip_test_runs
  for all to authenticated
  using (has_permission('ai.testing') or has_permission('ai.admin') or run_by = auth.uid())
  with check (has_permission('ai.testing') or has_permission('ai.admin'));
