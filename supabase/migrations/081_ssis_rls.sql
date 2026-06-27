-- =========================================
-- SSIS RLS (081)
-- =========================================

alter table public.ssis_lifecycle_transitions enable row level security;
alter table public.ssis_student_sibling_links enable row level security;
alter table public.ssis_medication_administration_logs enable row level security;
alter table public.ssis_medical_expiry_alerts enable row level security;
alter table public.ssis_sped_objectives enable row level security;
alter table public.ssis_academic_observations enable row level security;
alter table public.ssis_academic_artifacts enable row level security;
alter table public.ssis_behavior_plans enable row level security;
alter table public.ssis_student_funding_records enable row level security;
alter table public.ssis_parent_engagement_events enable row level security;
alter table public.ssis_success_score_config enable row level security;
alter table public.ssis_student_success_scores enable row level security;
alter table public.ssis_communication_events enable row level security;

-- Reuse sis_student_policy from 079
drop policy if exists ssis_lifecycle_transitions_all on public.ssis_lifecycle_transitions;
create policy ssis_lifecycle_transitions_all on public.ssis_lifecycle_transitions
  for all to authenticated
  using (sis_student_policy(student_id))
  with check (sis_student_policy(student_id, 'students.edit'));

drop policy if exists ssis_sibling_links_all on public.ssis_student_sibling_links;
create policy ssis_sibling_links_all on public.ssis_student_sibling_links
  for all to authenticated
  using (sis_student_policy(student_id))
  with check (sis_student_policy(student_id, 'students.edit'));

drop policy if exists ssis_med_admin_all on public.ssis_medication_administration_logs;
create policy ssis_med_admin_all on public.ssis_medication_administration_logs
  for all to authenticated
  using (sis_student_policy(student_id) and can_access_classification('medical'))
  with check (sis_student_policy(student_id, 'students.edit') and can_access_classification('medical'));

drop policy if exists ssis_medical_expiry_read on public.ssis_medical_expiry_alerts;
create policy ssis_medical_expiry_read on public.ssis_medical_expiry_alerts
  for select to authenticated
  using (sis_student_policy(student_id) and can_access_classification('medical'));

drop policy if exists ssis_medical_expiry_write on public.ssis_medical_expiry_alerts;
create policy ssis_medical_expiry_write on public.ssis_medical_expiry_alerts
  for all to authenticated
  using (has_permission('students.edit') or is_enterprise_admin())
  with check (has_permission('students.edit') or is_enterprise_admin());

drop policy if exists ssis_sped_objectives_all on public.ssis_sped_objectives;
create policy ssis_sped_objectives_all on public.ssis_sped_objectives
  for all to authenticated
  using (sis_student_policy(student_id) and can_access_classification('special_education'))
  with check (sis_student_policy(student_id, 'students.edit') and can_access_classification('special_education'));

drop policy if exists ssis_academic_observations_all on public.ssis_academic_observations;
create policy ssis_academic_observations_all on public.ssis_academic_observations
  for all to authenticated using (sis_student_policy(student_id))
  with check (sis_student_policy(student_id, 'students.edit'));

drop policy if exists ssis_academic_artifacts_all on public.ssis_academic_artifacts;
create policy ssis_academic_artifacts_all on public.ssis_academic_artifacts
  for all to authenticated using (sis_student_policy(student_id))
  with check (sis_student_policy(student_id, 'students.edit'));

drop policy if exists ssis_behavior_plans_all on public.ssis_behavior_plans;
create policy ssis_behavior_plans_all on public.ssis_behavior_plans
  for all to authenticated
  using (sis_student_policy(student_id, 'students.behavior'))
  with check (sis_student_policy(student_id, 'students.behavior'));

drop policy if exists ssis_funding_records_select on public.ssis_student_funding_records;
create policy ssis_funding_records_select on public.ssis_student_funding_records
  for select to authenticated
  using (
    sis_student_policy(student_id)
    and (has_permission('ssis.funding.view') or has_permission('finance.view') or is_enterprise_admin())
  );

drop policy if exists ssis_funding_records_write on public.ssis_student_funding_records;
create policy ssis_funding_records_write on public.ssis_student_funding_records
  for all to authenticated
  using (has_permission('finance.view') or is_enterprise_admin())
  with check (has_permission('finance.view') or is_enterprise_admin());

drop policy if exists ssis_parent_engagement_all on public.ssis_parent_engagement_events;
create policy ssis_parent_engagement_all on public.ssis_parent_engagement_events
  for all to authenticated using (sis_student_policy(student_id))
  with check (sis_student_policy(student_id, 'students.edit'));

drop policy if exists ssis_success_score_config_read on public.ssis_success_score_config;
create policy ssis_success_score_config_read on public.ssis_success_score_config
  for select to authenticated using (can_access_school(school_id) or is_enterprise_admin());

drop policy if exists ssis_success_score_config_write on public.ssis_success_score_config;
create policy ssis_success_score_config_write on public.ssis_success_score_config
  for all to authenticated
  using (has_permission('schools.manage') or is_enterprise_admin())
  with check (has_permission('schools.manage') or is_enterprise_admin());

drop policy if exists ssis_success_scores_read on public.ssis_student_success_scores;
create policy ssis_success_scores_read on public.ssis_student_success_scores
  for select to authenticated
  using (sis_student_policy(student_id) and (has_permission('ssis.score.view') or has_permission('students.view')));

drop policy if exists ssis_success_scores_insert on public.ssis_student_success_scores;
create policy ssis_success_scores_insert on public.ssis_student_success_scores
  for insert to authenticated with check (has_permission('students.edit') or is_enterprise_admin());

drop policy if exists ssis_communication_read on public.ssis_communication_events;
create policy ssis_communication_read on public.ssis_communication_events
  for select to authenticated
  using (sis_student_policy(student_id) and (has_permission('ssis.timeline.view') or has_permission('students.view')));

drop policy if exists ssis_communication_insert on public.ssis_communication_events;
create policy ssis_communication_insert on public.ssis_communication_events
  for insert to authenticated with check (sis_student_policy(student_id, 'students.edit'));
