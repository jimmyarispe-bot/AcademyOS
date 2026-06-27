-- =========================================
-- ADMISSIONS COMMUNICATION ENGINE RLS (069)
-- Idempotent: safe to re-run
-- =========================================

alter table public.admissions_communication_templates enable row level security;
alter table public.admissions_communication_queue enable row level security;
alter table public.admissions_staff_notifications enable row level security;
alter table public.admissions_portal_notifications enable row level security;

-- Templates: read org-wide + school; write school-scoped only
drop policy if exists comm_templates_read on public.admissions_communication_templates;
create policy comm_templates_read on public.admissions_communication_templates
for select using (
  school_id is null
  or can_access_school(school_id)
);

drop policy if exists comm_templates_write on public.admissions_communication_templates;
create policy comm_templates_write on public.admissions_communication_templates
for all using (
  school_id is not null and can_access_school(school_id)
) with check (
  school_id is not null and can_access_school(school_id)
);

-- Queue: staff only
drop policy if exists comm_queue_staff on public.admissions_communication_queue;
create policy comm_queue_staff on public.admissions_communication_queue
for all using (can_access_school(school_id_for_admission_lead(lead_id)))
with check (can_access_school(school_id_for_admission_lead(lead_id)));

-- Staff notifications
drop policy if exists staff_notifications_own on public.admissions_staff_notifications;
create policy staff_notifications_own on public.admissions_staff_notifications
for all using (user_id = auth.uid() or can_access_school(school_id))
with check (can_access_school(school_id));

-- Portal notifications
drop policy if exists portal_notifications_staff on public.admissions_portal_notifications;
create policy portal_notifications_staff on public.admissions_portal_notifications
for all using (can_access_school(school_id_for_admission_lead(lead_id)))
with check (can_access_school(school_id_for_admission_lead(lead_id)));

drop policy if exists portal_notifications_guardian on public.admissions_portal_notifications;
create policy portal_notifications_guardian on public.admissions_portal_notifications
for select using (is_guardian_of_lead(lead_id));

drop policy if exists portal_notifications_guardian_update on public.admissions_portal_notifications;
create policy portal_notifications_guardian_update on public.admissions_portal_notifications
for update using (is_guardian_of_lead(lead_id))
with check (is_guardian_of_lead(lead_id));

grant select, insert, update, delete on table public.admissions_communication_templates to authenticated;
grant select, insert, update, delete on table public.admissions_communication_queue to authenticated;
grant select, insert, update, delete on table public.admissions_staff_notifications to authenticated;
grant select, insert, update, delete on table public.admissions_portal_notifications to authenticated;

grant all on table public.admissions_communication_templates to service_role;
grant all on table public.admissions_communication_queue to service_role;
grant all on table public.admissions_staff_notifications to service_role;
grant all on table public.admissions_portal_notifications to service_role;

notify pgrst, 'reload schema';
