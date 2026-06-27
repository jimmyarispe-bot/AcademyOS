-- =========================================
-- RELEASE 7 RLS: Parent & Student Experience
-- =========================================

alter table public.portal_conversations enable row level security;
alter table public.portal_messages enable row level security;
alter table public.portal_message_reads enable row level security;
alter table public.portal_message_attachments enable row level security;
alter table public.portal_family_notifications enable row level security;
alter table public.portal_form_templates enable row level security;
alter table public.portal_form_submissions enable row level security;
alter table public.portal_conference_requests enable row level security;
alter table public.portal_calendar_export_tokens enable row level security;

-- Conversations: parents of student, staff with school access, message participants
drop policy if exists portal_conversations_select on public.portal_conversations;
create policy portal_conversations_select on public.portal_conversations
for select to authenticated using (
  is_parent_of_student(student_id)
  or can_access_school(school_id)
  or created_by_user_id = auth.uid()
  or assigned_staff_user_id = auth.uid()
);

drop policy if exists portal_conversations_insert on public.portal_conversations;
create policy portal_conversations_insert on public.portal_conversations
for insert to authenticated with check (
  (is_parent_of_student(student_id) and has_permission('portal.messaging'))
  or can_access_school(school_id)
);

drop policy if exists portal_conversations_update on public.portal_conversations;
create policy portal_conversations_update on public.portal_conversations
for update to authenticated using (
  is_parent_of_student(student_id) or can_access_school(school_id)
);

-- Messages
drop policy if exists portal_messages_select on public.portal_messages;
create policy portal_messages_select on public.portal_messages
for select to authenticated using (
  exists (
    select 1 from public.portal_conversations c
    where c.id = conversation_id
      and (is_parent_of_student(c.student_id) or can_access_school(c.school_id))
  )
);

drop policy if exists portal_messages_insert on public.portal_messages;
create policy portal_messages_insert on public.portal_messages
for insert to authenticated with check (
  exists (
    select 1 from public.portal_conversations c
    where c.id = conversation_id
      and (
        (is_parent_of_student(c.student_id) and has_permission('portal.messaging'))
        or can_access_school(c.school_id)
      )
  )
);

-- Message reads
drop policy if exists portal_message_reads_all on public.portal_message_reads;
create policy portal_message_reads_all on public.portal_message_reads
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Attachments
drop policy if exists portal_message_attachments_select on public.portal_message_attachments;
create policy portal_message_attachments_select on public.portal_message_attachments
for select to authenticated using (
  exists (
    select 1 from public.portal_messages m
    join public.portal_conversations c on c.id = m.conversation_id
    where m.id = message_id
      and (is_parent_of_student(c.student_id) or can_access_school(c.school_id))
  )
);

drop policy if exists portal_message_attachments_insert on public.portal_message_attachments;
create policy portal_message_attachments_insert on public.portal_message_attachments
for insert to authenticated with check (
  exists (
    select 1 from public.portal_messages m
    join public.portal_conversations c on c.id = m.conversation_id
    where m.id = message_id
      and (is_parent_of_student(c.student_id) or can_access_school(c.school_id))
  )
);

-- Family notifications
drop policy if exists portal_family_notifications_select on public.portal_family_notifications;
create policy portal_family_notifications_select on public.portal_family_notifications
for select to authenticated using (user_id = auth.uid() or can_access_school(
  (select s.school_id from public.students s where s.id = student_id limit 1)
));

drop policy if exists portal_family_notifications_insert on public.portal_family_notifications;
create policy portal_family_notifications_insert on public.portal_family_notifications
for insert to authenticated with check (can_access_school(
  coalesce(
    (select s.school_id from public.students s where s.id = student_id limit 1),
    (select f.school_id from public.families f where f.id = family_id limit 1)
  )
) or user_id = auth.uid());

drop policy if exists portal_family_notifications_update on public.portal_family_notifications;
create policy portal_family_notifications_update on public.portal_family_notifications
for update to authenticated using (user_id = auth.uid());

-- Form templates: parents read active; staff manage
drop policy if exists portal_form_templates_select on public.portal_form_templates;
create policy portal_form_templates_select on public.portal_form_templates
for select to authenticated using (is_active and (can_access_school(school_id) or has_permission('portal.forms.submit')));

drop policy if exists portal_form_templates_write on public.portal_form_templates;
create policy portal_form_templates_write on public.portal_form_templates
for all to authenticated using (can_access_school(school_id)) with check (can_access_school(school_id));

-- Form submissions
drop policy if exists portal_form_submissions_select on public.portal_form_submissions;
create policy portal_form_submissions_select on public.portal_form_submissions
for select to authenticated using (
  submitted_by_user_id = auth.uid()
  or (student_id is not null and is_parent_of_student(student_id))
  or (family_id is not null and is_guardian_of_family(family_id))
  or exists (
    select 1 from public.portal_form_templates t
    where t.id = template_id and can_access_school(t.school_id)
  )
);

drop policy if exists portal_form_submissions_insert on public.portal_form_submissions;
create policy portal_form_submissions_insert on public.portal_form_submissions
for insert to authenticated with check (
  has_permission('portal.forms.submit')
  and (
    student_id is null or is_parent_of_student(student_id)
  )
  and (
    family_id is null or is_guardian_of_family(family_id)
  )
);

-- Conference requests
drop policy if exists portal_conference_requests_select on public.portal_conference_requests;
create policy portal_conference_requests_select on public.portal_conference_requests
for select to authenticated using (
  is_parent_of_student(student_id) or can_access_school(school_id)
);

drop policy if exists portal_conference_requests_insert on public.portal_conference_requests;
create policy portal_conference_requests_insert on public.portal_conference_requests
for insert to authenticated with check (
  is_parent_of_student(student_id) and has_permission('portal.conferences')
);

drop policy if exists portal_conference_requests_update on public.portal_conference_requests;
create policy portal_conference_requests_update on public.portal_conference_requests
for update to authenticated using (
  is_parent_of_student(student_id) or can_access_school(school_id)
);

-- Parent-visible meetings (extend read for parents)
drop policy if exists instructional_meetings_parent_select on public.student_instructional_meetings;
create policy instructional_meetings_parent_select on public.student_instructional_meetings
for select to authenticated using (
  parent_visible = true and is_parent_of_student(student_id)
);

-- Calendar export tokens
drop policy if exists portal_calendar_tokens_own on public.portal_calendar_export_tokens;
create policy portal_calendar_tokens_own on public.portal_calendar_export_tokens
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.portal_conversations to authenticated;
grant select, insert on public.portal_messages to authenticated;
grant select, insert, update on public.portal_message_reads to authenticated;
grant select, insert on public.portal_message_attachments to authenticated;
grant select, insert, update on public.portal_family_notifications to authenticated;
grant select on public.portal_form_templates to authenticated;
grant select, insert on public.portal_form_submissions to authenticated;
grant select, insert, update on public.portal_conference_requests to authenticated;
grant select, insert, delete on public.portal_calendar_export_tokens to authenticated;

-- Parent read policies for enrolled-family portal (FERPA-scoped via is_parent_of_student)
drop policy if exists student_growth_goals_parent_select on public.student_growth_goals;
create policy student_growth_goals_parent_select on public.student_growth_goals
  for select to authenticated using (is_parent_of_student(student_id));

drop policy if exists student_learning_artifacts_parent_select on public.student_learning_artifacts;
create policy student_learning_artifacts_parent_select on public.student_learning_artifacts
  for select to authenticated using (is_parent_of_student(student_id));

drop policy if exists ssis_academic_observations_parent_select on public.ssis_academic_observations;
create policy ssis_academic_observations_parent_select on public.ssis_academic_observations
  for select to authenticated using (is_parent_of_student(student_id));

drop policy if exists ssis_funding_records_parent_select on public.ssis_student_funding_records;
create policy ssis_funding_records_parent_select on public.ssis_student_funding_records
  for select to authenticated using (is_parent_of_student(student_id));

drop policy if exists ssis_medical_alerts_parent_select on public.ssis_medical_expiry_alerts;
create policy ssis_medical_alerts_parent_select on public.ssis_medical_expiry_alerts
  for select to authenticated using (is_parent_of_student(student_id));

drop policy if exists student_enrollments_parent_select on public.student_enrollments;
create policy student_enrollments_parent_select on public.student_enrollments
  for select to authenticated using (is_parent_of_student(student_id));

drop policy if exists student_service_sessions_parent_select on public.student_service_sessions;
create policy student_service_sessions_parent_select on public.student_service_sessions
  for select to authenticated using (is_parent_of_student(student_id));
