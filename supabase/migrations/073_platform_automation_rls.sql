-- =========================================
-- PLATFORM AUTOMATION RLS (073)
-- Idempotent: safe to re-run
-- =========================================

alter table public.platform_audit_events enable row level security;
alter table public.platform_timeline_events enable row level security;
alter table public.platform_queue_jobs enable row level security;
alter table public.platform_notification_templates enable row level security;
alter table public.platform_template_versions enable row level security;
alter table public.platform_business_hours enable row level security;
alter table public.platform_holidays enable row level security;
alter table public.platform_escalation_rules enable row level security;
alter table public.platform_workflow_marketplace enable row level security;
alter table public.platform_mission_control_items enable row level security;

-- Audit: school-scoped read, insert for staff
drop policy if exists platform_audit_read on public.platform_audit_events;
create policy platform_audit_read on public.platform_audit_events
for select using (school_id is null or can_access_school(school_id));

drop policy if exists platform_audit_insert on public.platform_audit_events;
create policy platform_audit_insert on public.platform_audit_events
for insert with check (school_id is null or can_access_school(school_id));

-- Timeline
drop policy if exists platform_timeline_read on public.platform_timeline_events;
create policy platform_timeline_read on public.platform_timeline_events
for select using (school_id is null or can_access_school(school_id));

drop policy if exists platform_timeline_insert on public.platform_timeline_events;
create policy platform_timeline_insert on public.platform_timeline_events
for insert with check (school_id is null or can_access_school(school_id));

-- Queue jobs
drop policy if exists platform_queue_staff on public.platform_queue_jobs;
create policy platform_queue_staff on public.platform_queue_jobs
for all using (school_id is null or can_access_school(school_id))
with check (school_id is null or can_access_school(school_id));

-- Templates: org read, school write
drop policy if exists platform_templates_read on public.platform_notification_templates;
create policy platform_templates_read on public.platform_notification_templates
for select using (school_id is null or can_access_school(school_id));

drop policy if exists platform_templates_write on public.platform_notification_templates;
create policy platform_templates_write on public.platform_notification_templates
for all using (school_id is not null and can_access_school(school_id))
with check (school_id is not null and can_access_school(school_id));

-- Template versions
drop policy if exists platform_template_versions_read on public.platform_template_versions;
create policy platform_template_versions_read on public.platform_template_versions
for select using (
  exists (
    select 1 from public.platform_notification_templates t
    where t.id = template_id and (t.school_id is null or can_access_school(t.school_id))
  )
);

-- Business hours & holidays
drop policy if exists platform_business_hours on public.platform_business_hours;
create policy platform_business_hours on public.platform_business_hours
for all using (can_access_school(school_id)) with check (can_access_school(school_id));

drop policy if exists platform_holidays on public.platform_holidays;
create policy platform_holidays on public.platform_holidays
for all using (school_id is null or can_access_school(school_id))
with check (school_id is null or can_access_school(school_id));

-- Escalation rules
drop policy if exists platform_escalation_read on public.platform_escalation_rules;
create policy platform_escalation_read on public.platform_escalation_rules
for select using (school_id is null or can_access_school(school_id));

drop policy if exists platform_escalation_write on public.platform_escalation_rules;
create policy platform_escalation_write on public.platform_escalation_rules
for all using (school_id is not null and can_access_school(school_id))
with check (school_id is not null and can_access_school(school_id));

-- Marketplace: read all authenticated
drop policy if exists platform_marketplace_read on public.platform_workflow_marketplace;
create policy platform_marketplace_read on public.platform_workflow_marketplace
for select using (is_published = true);

-- Mission control
drop policy if exists platform_mission_control_read on public.platform_mission_control_items;
create policy platform_mission_control_read on public.platform_mission_control_items
for select using (school_id is null or can_access_school(school_id));

drop policy if exists platform_mission_control_write on public.platform_mission_control_items;
create policy platform_mission_control_write on public.platform_mission_control_items
for all using (school_id is null or can_access_school(school_id))
with check (school_id is null or can_access_school(school_id));

grant select, insert on table public.platform_audit_events to authenticated;
grant select, insert on table public.platform_timeline_events to authenticated;
grant select, insert, update, delete on table public.platform_queue_jobs to authenticated;
grant select, insert, update, delete on table public.platform_notification_templates to authenticated;
grant select, insert on table public.platform_template_versions to authenticated;
grant select, insert, update, delete on table public.platform_business_hours to authenticated;
grant select, insert, update, delete on table public.platform_holidays to authenticated;
grant select, insert, update, delete on table public.platform_escalation_rules to authenticated;
grant select on table public.platform_workflow_marketplace to authenticated;
grant select, insert, update on table public.platform_mission_control_items to authenticated;

grant all on table public.platform_audit_events to service_role;
grant all on table public.platform_timeline_events to service_role;
grant all on table public.platform_queue_jobs to service_role;
grant all on table public.platform_notification_templates to service_role;
grant all on table public.platform_template_versions to service_role;
grant all on table public.platform_business_hours to service_role;
grant all on table public.platform_holidays to service_role;
grant all on table public.platform_escalation_rules to service_role;
grant all on table public.platform_workflow_marketplace to service_role;
grant all on table public.platform_mission_control_items to service_role;

notify pgrst, 'reload schema';
