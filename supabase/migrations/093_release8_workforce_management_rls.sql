-- =========================================
-- RELEASE 8 RLS: Workforce Management
-- =========================================

alter table public.employee_service_history enable row level security;
alter table public.hr_job_postings enable row level security;
alter table public.hr_job_applications enable row level security;
alter table public.hr_candidate_interviews enable row level security;
alter table public.hr_onboarding_tasks enable row level security;
alter table public.employee_time_entries enable row level security;
alter table public.leave_requests enable row level security;
alter table public.performance_evaluations enable row level security;
alter table public.performance_goals enable row level security;
alter table public.pd_courses enable row level security;
alter table public.employee_training_records enable row level security;
alter table public.substitute_pool_members enable row level security;
alter table public.substitute_assignments enable row level security;
alter table public.volunteers enable row level security;
alter table public.volunteer_hours enable row level security;
alter table public.employee_documents enable row level security;

-- Service history
drop policy if exists employee_service_history_access on public.employee_service_history;
create policy employee_service_history_access on public.employee_service_history
  for all to authenticated using (
    can_access_school((select school_id from public.employees e where e.id = employee_id))
    or is_self_employee(employee_id)
  ) with check (can_access_school((select school_id from public.employees e where e.id = employee_id)));

-- Recruiting
drop policy if exists hr_job_postings_access on public.hr_job_postings;
create policy hr_job_postings_access on public.hr_job_postings
  for all to authenticated using (can_access_school(school_id)) with check (can_access_school(school_id));

drop policy if exists hr_job_applications_access on public.hr_job_applications;
create policy hr_job_applications_access on public.hr_job_applications
  for all to authenticated using (
    exists (select 1 from public.hr_job_postings jp where jp.id = job_posting_id and can_access_school(jp.school_id))
  );

drop policy if exists hr_candidate_interviews_access on public.hr_candidate_interviews;
create policy hr_candidate_interviews_access on public.hr_candidate_interviews
  for all to authenticated using (
    exists (
      select 1 from public.hr_job_applications ja
      join public.hr_job_postings jp on jp.id = ja.job_posting_id
      where ja.id = application_id and can_access_school(jp.school_id)
    )
  );

-- Onboarding
drop policy if exists hr_onboarding_tasks_access on public.hr_onboarding_tasks;
create policy hr_onboarding_tasks_access on public.hr_onboarding_tasks
  for all to authenticated using (
    can_access_school((select school_id from public.employees e where e.id = employee_id))
    or is_self_employee(employee_id)
  ) with check (
    can_access_school((select school_id from public.employees e where e.id = employee_id))
    or is_self_employee(employee_id)
  );

-- Time & leave
drop policy if exists employee_time_entries_access on public.employee_time_entries;
create policy employee_time_entries_access on public.employee_time_entries
  for all to authenticated using (can_access_school(school_id) or is_self_employee(employee_id))
  with check (can_access_school(school_id) or is_self_employee(employee_id));

drop policy if exists leave_requests_access on public.leave_requests;
create policy leave_requests_access on public.leave_requests
  for all to authenticated using (can_access_school(school_id) or is_self_employee(employee_id))
  with check (can_access_school(school_id) or is_self_employee(employee_id));

-- Performance
drop policy if exists performance_evaluations_access on public.performance_evaluations;
create policy performance_evaluations_access on public.performance_evaluations
  for all to authenticated using (can_access_school(school_id) or is_self_employee(employee_id));

drop policy if exists performance_goals_access on public.performance_goals;
create policy performance_goals_access on public.performance_goals
  for all to authenticated using (
    can_access_school((select school_id from public.employees e where e.id = employee_id))
    or is_self_employee(employee_id)
  );

-- PD
drop policy if exists pd_courses_access on public.pd_courses;
create policy pd_courses_access on public.pd_courses
  for select to authenticated using (school_id is null or can_access_school(school_id) or has_permission('employee.self_service'));

drop policy if exists pd_courses_write on public.pd_courses;
create policy pd_courses_write on public.pd_courses
  for all to authenticated using (school_id is null or can_access_school(school_id))
  with check (school_id is null or can_access_school(school_id));

drop policy if exists employee_training_records_access on public.employee_training_records;
create policy employee_training_records_access on public.employee_training_records
  for all to authenticated using (
    can_access_school((select school_id from public.employees e where e.id = employee_id))
    or is_self_employee(employee_id)
  );

-- Substitutes & volunteers
drop policy if exists substitute_pool_access on public.substitute_pool_members;
create policy substitute_pool_access on public.substitute_pool_members
  for all to authenticated using (can_access_school(school_id));

drop policy if exists substitute_assignments_access on public.substitute_assignments;
create policy substitute_assignments_access on public.substitute_assignments
  for all to authenticated using (
    exists (select 1 from public.substitute_pool_members sp where sp.id = substitute_id and can_access_school(sp.school_id))
  );

drop policy if exists volunteers_access on public.volunteers;
create policy volunteers_access on public.volunteers
  for all to authenticated using (can_access_school(school_id));

drop policy if exists volunteer_hours_access on public.volunteer_hours;
create policy volunteer_hours_access on public.volunteer_hours
  for all to authenticated using (
    exists (select 1 from public.volunteers v where v.id = volunteer_id and can_access_school(v.school_id))
  );

-- Document vault
drop policy if exists employee_documents_access on public.employee_documents;
create policy employee_documents_access on public.employee_documents
  for all to authenticated using (
    can_access_school((select school_id from public.employees e where e.id = employee_id))
    or is_self_employee(employee_id)
  ) with check (can_access_school((select school_id from public.employees e where e.id = employee_id)));

grant select, insert, update, delete on public.employee_service_history to authenticated;
grant select, insert, update, delete on public.hr_job_postings to authenticated;
grant select, insert, update, delete on public.hr_job_applications to authenticated;
grant select, insert, update, delete on public.hr_candidate_interviews to authenticated;
grant select, insert, update, delete on public.hr_onboarding_tasks to authenticated;
grant select, insert, update, delete on public.employee_time_entries to authenticated;
grant select, insert, update, delete on public.leave_requests to authenticated;
grant select, insert, update, delete on public.performance_evaluations to authenticated;
grant select, insert, update, delete on public.performance_goals to authenticated;
grant select, insert, update, delete on public.pd_courses to authenticated;
grant select, insert, update, delete on public.employee_training_records to authenticated;
grant select, insert, update, delete on public.substitute_pool_members to authenticated;
grant select, insert, update, delete on public.substitute_assignments to authenticated;
grant select, insert, update, delete on public.volunteers to authenticated;
grant select, insert, update, delete on public.volunteer_hours to authenticated;
grant select, insert, update, delete on public.employee_documents to authenticated;
