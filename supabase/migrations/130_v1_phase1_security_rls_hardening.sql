-- =========================================
-- V1.0 Phase 1 Security: Admissions & SSIS RLS hardening (B-04, B-05–B-08)
-- Restricts staff admissions policies to admissions permissions (not all school members).
-- Fixes SSIS write scopes and classification policy precedence.
-- =========================================

-- Helper: admissions staff can read
create or replace function public.admissions_staff_can_view()
returns boolean
language sql
stable
as $$
  select
    is_enterprise_admin()
    or has_permission('admissions.view')
    or has_permission('admissions.manage')
    or has_permission('admissions.accept');
$$;

create or replace function public.admissions_staff_can_manage()
returns boolean
language sql
stable
as $$
  select
    is_enterprise_admin()
    or has_permission('admissions.manage')
    or has_permission('admissions.accept');
$$;

-- ADMISSIONS LEADS
drop policy if exists admissions_leads_staff_all on public.admissions_leads;

create policy admissions_leads_staff_select on public.admissions_leads
  for select to authenticated
  using (can_access_school(school_id) and admissions_staff_can_view());

create policy admissions_leads_staff_insert on public.admissions_leads
  for insert to authenticated
  with check (can_access_school(school_id) and admissions_staff_can_manage());

create policy admissions_leads_staff_update on public.admissions_leads
  for update to authenticated
  using (can_access_school(school_id) and admissions_staff_can_manage())
  with check (can_access_school(school_id) and admissions_staff_can_manage());

create policy admissions_leads_staff_delete on public.admissions_leads
  for delete to authenticated
  using (can_access_school(school_id) and admissions_staff_can_manage());

-- LEAD GUARDIANS
drop policy if exists admissions_lead_guardians_staff_all on public.admissions_lead_guardians;

create policy admissions_lead_guardians_staff_select on public.admissions_lead_guardians
  for select to authenticated
  using (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_view()
  );

create policy admissions_lead_guardians_staff_write on public.admissions_lead_guardians
  for all to authenticated
  using (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  )
  with check (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  );

-- TOURS
drop policy if exists admissions_tours_staff_all on public.admissions_tours;

create policy admissions_tours_staff_select on public.admissions_tours
  for select to authenticated
  using (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_view()
  );

create policy admissions_tours_staff_write on public.admissions_tours
  for all to authenticated
  using (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  )
  with check (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  );

-- NOTES
drop policy if exists admissions_notes_staff_all on public.admissions_notes;

create policy admissions_notes_staff_select on public.admissions_notes
  for select to authenticated
  using (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_view()
  );

create policy admissions_notes_staff_write on public.admissions_notes
  for all to authenticated
  using (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  )
  with check (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  );

-- TASKS
drop policy if exists admissions_tasks_staff_all on public.admissions_tasks;

create policy admissions_tasks_staff_select on public.admissions_tasks
  for select to authenticated
  using (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_view()
  );

create policy admissions_tasks_staff_write on public.admissions_tasks
  for all to authenticated
  using (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  )
  with check (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  );

-- APPLICATIONS
drop policy if exists admissions_applications_staff_all on public.admissions_applications;

create policy admissions_applications_staff_select on public.admissions_applications
  for select to authenticated
  using (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_view()
  );

create policy admissions_applications_staff_write on public.admissions_applications
  for all to authenticated
  using (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  )
  with check (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  );

-- AUTOMATION WORKFLOWS (071) — restrict write to admissions staff
drop policy if exists workflows_read on public.admissions_workflows;
create policy workflows_read on public.admissions_workflows
  for select to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and admissions_staff_can_view()
  );

drop policy if exists workflows_write on public.admissions_workflows;
create policy workflows_write on public.admissions_workflows
  for all to authenticated
  using (
    school_id is not null
    and can_access_school(school_id)
    and admissions_staff_can_manage()
  )
  with check (
    school_id is not null
    and can_access_school(school_id)
    and admissions_staff_can_manage()
  );

drop policy if exists workflow_executions_staff on public.admissions_workflow_executions;
create policy workflow_executions_staff on public.admissions_workflow_executions
  for all to authenticated
  using (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  )
  with check (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  );

drop policy if exists workflow_queue_staff on public.admissions_workflow_queue;
create policy workflow_queue_staff on public.admissions_workflow_queue
  for all to authenticated
  using (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  )
  with check (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  );

drop policy if exists interviews_staff on public.admissions_interviews;
create policy interviews_staff on public.admissions_interviews
  for all to authenticated
  using (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  )
  with check (
    can_access_school(school_id_for_admission_lead(lead_id))
    and admissions_staff_can_manage()
  );

-- SSIS medical expiry write (B-05)
drop policy if exists ssis_medical_expiry_write on public.ssis_medical_expiry_alerts;

create policy ssis_medical_expiry_write on public.ssis_medical_expiry_alerts
  for all to authenticated
  using (
    sis_student_policy(student_id, 'students.edit')
    and can_access_classification('medical')
  )
  with check (
    sis_student_policy(student_id, 'students.edit')
    and can_access_classification('medical')
  );

-- SSIS funding records write (B-06)
drop policy if exists ssis_funding_records_write on public.ssis_student_funding_records;

create policy ssis_funding_records_write on public.ssis_student_funding_records
  for all to authenticated
  using (
    sis_student_policy(student_id)
    and (
      has_permission('finance.manage')
      or has_permission('ssis.funding.manage')
      or is_enterprise_admin()
    )
  )
  with check (
    sis_student_policy(student_id)
    and (
      has_permission('finance.manage')
      or has_permission('ssis.funding.manage')
      or is_enterprise_admin()
    )
  );

-- SIS admissions conversions insert (B-07)
drop policy if exists sis_admissions_conversions_insert on public.sis_admissions_conversions;

create policy sis_admissions_conversions_insert on public.sis_admissions_conversions
  for insert to authenticated
  with check (
    sis_student_policy(student_id, 'students.edit')
    or is_enterprise_admin()
  );

-- Classification manage policy precedence fix (B-08)
drop policy if exists platform_record_classifications_manage on public.platform_record_classifications;

create policy platform_record_classifications_manage on public.platform_record_classifications
  for all to authenticated
  using (
    (has_permission('security.view') or is_enterprise_admin())
    and (school_id is null or can_access_school(school_id))
  )
  with check (
    (has_permission('security.view') or is_enterprise_admin())
    and (school_id is null or can_access_school(school_id))
  );

-- Restrict open security event inserts (defense in depth)
drop policy if exists platform_security_events_insert on public.platform_security_events;

create policy platform_security_events_insert on public.platform_security_events
  for insert to authenticated
  with check (user_id = auth.uid() or is_enterprise_admin());

drop policy if exists platform_sensitive_access_log_insert on public.platform_sensitive_access_log;

create policy platform_sensitive_access_log_insert on public.platform_sensitive_access_log
  for insert to authenticated
  with check (user_id = auth.uid() or is_enterprise_admin());

-- Revoke unnecessary anon grant on has_permission
revoke execute on function public.has_permission(text) from anon;

grant execute on function public.admissions_staff_can_view() to authenticated, service_role;
grant execute on function public.admissions_staff_can_manage() to authenticated, service_role;
