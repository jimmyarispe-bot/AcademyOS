-- =========================================
-- ADMISSIONS AUTOMATION ENGINE RLS (071)
-- Idempotent: safe to re-run
-- =========================================

alter table public.admissions_template_versions enable row level security;
alter table public.admissions_interviews enable row level security;
alter table public.admissions_workflows enable row level security;
alter table public.admissions_workflow_steps enable row level security;
alter table public.admissions_workflow_executions enable row level security;
alter table public.admissions_workflow_queue enable row level security;
alter table public.admissions_escalation_rules enable row level security;
alter table public.admissions_automation_audit_log enable row level security;

-- Workflows: read org + school; write school-scoped
drop policy if exists workflows_read on public.admissions_workflows;
create policy workflows_read on public.admissions_workflows
for select using (school_id is null or can_access_school(school_id));

drop policy if exists workflows_write on public.admissions_workflows;
create policy workflows_write on public.admissions_workflows
for all using (school_id is not null and can_access_school(school_id))
with check (school_id is not null and can_access_school(school_id));

-- Workflow steps inherit workflow access
drop policy if exists workflow_steps_read on public.admissions_workflow_steps;
create policy workflow_steps_read on public.admissions_workflow_steps
for select using (
  exists (
    select 1 from public.admissions_workflows w
    where w.id = workflow_id
      and (w.school_id is null or can_access_school(w.school_id))
  )
);

drop policy if exists workflow_steps_write on public.admissions_workflow_steps;
create policy workflow_steps_write on public.admissions_workflow_steps
for all using (
  exists (
    select 1 from public.admissions_workflows w
    where w.id = workflow_id
      and w.school_id is not null
      and can_access_school(w.school_id)
  )
) with check (
  exists (
    select 1 from public.admissions_workflows w
    where w.id = workflow_id
      and w.school_id is not null
      and can_access_school(w.school_id)
  )
);

-- Executions, queue, audit: staff via lead school
drop policy if exists workflow_executions_staff on public.admissions_workflow_executions;
create policy workflow_executions_staff on public.admissions_workflow_executions
for all using (can_access_school(school_id_for_admission_lead(lead_id)))
with check (can_access_school(school_id_for_admission_lead(lead_id)));

drop policy if exists workflow_queue_staff on public.admissions_workflow_queue;
create policy workflow_queue_staff on public.admissions_workflow_queue
for all using (can_access_school(school_id_for_admission_lead(lead_id)))
with check (can_access_school(school_id_for_admission_lead(lead_id)));

drop policy if exists automation_audit_staff on public.admissions_automation_audit_log;
create policy automation_audit_staff on public.admissions_automation_audit_log
for select using (
  school_id is null
  or can_access_school(school_id)
  or (lead_id is not null and can_access_school(school_id_for_admission_lead(lead_id)))
);

drop policy if exists automation_audit_insert on public.admissions_automation_audit_log;
create policy automation_audit_insert on public.admissions_automation_audit_log
for insert with check (
  school_id is null
  or can_access_school(school_id)
  or (lead_id is not null and can_access_school(school_id_for_admission_lead(lead_id)))
);

-- Interviews
drop policy if exists interviews_staff on public.admissions_interviews;
create policy interviews_staff on public.admissions_interviews
for all using (can_access_school(school_id_for_admission_lead(lead_id)))
with check (can_access_school(school_id_for_admission_lead(lead_id)));

-- Escalation rules
drop policy if exists escalation_rules_read on public.admissions_escalation_rules;
create policy escalation_rules_read on public.admissions_escalation_rules
for select using (school_id is null or can_access_school(school_id));

drop policy if exists escalation_rules_write on public.admissions_escalation_rules;
create policy escalation_rules_write on public.admissions_escalation_rules
for all using (school_id is not null and can_access_school(school_id))
with check (school_id is not null and can_access_school(school_id));

-- Template versions
drop policy if exists template_versions_read on public.admissions_template_versions;
create policy template_versions_read on public.admissions_template_versions
for select using (
  exists (
    select 1 from public.admissions_communication_templates t
    where t.id = template_id
      and (t.school_id is null or can_access_school(t.school_id))
  )
);

drop policy if exists template_versions_write on public.admissions_template_versions;
create policy template_versions_write on public.admissions_template_versions
for insert with check (
  exists (
    select 1 from public.admissions_communication_templates t
    where t.id = template_id
      and t.school_id is not null
      and can_access_school(t.school_id)
  )
);

grant select, insert, update, delete on table public.admissions_workflows to authenticated;
grant select, insert, update, delete on table public.admissions_workflow_steps to authenticated;
grant select, insert, update, delete on table public.admissions_workflow_executions to authenticated;
grant select, insert, update, delete on table public.admissions_workflow_queue to authenticated;
grant select, insert, update, delete on table public.admissions_escalation_rules to authenticated;
grant select, insert on table public.admissions_automation_audit_log to authenticated;
grant select, insert, update, delete on table public.admissions_interviews to authenticated;
grant select, insert on table public.admissions_template_versions to authenticated;

grant all on table public.admissions_workflows to service_role;
grant all on table public.admissions_workflow_steps to service_role;
grant all on table public.admissions_workflow_executions to service_role;
grant all on table public.admissions_workflow_queue to service_role;
grant all on table public.admissions_escalation_rules to service_role;
grant all on table public.admissions_automation_audit_log to service_role;
grant all on table public.admissions_interviews to service_role;
grant all on table public.admissions_template_versions to service_role;

notify pgrst, 'reload schema';
