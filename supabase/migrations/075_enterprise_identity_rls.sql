-- =========================================
-- SPRINT 1.7: ENTERPRISE IDENTITY RLS (075)
-- =========================================

alter table public.org_organizations enable row level security;
alter table public.org_regions enable row level security;
alter table public.org_programs enable row level security;
alter table public.org_departments enable row level security;
alter table public.platform_permissions enable row level security;
alter table public.platform_role_permissions enable row level security;
alter table public.user_org_assignments enable row level security;
alter table public.platform_impersonation_sessions enable row level security;
alter table public.user_preferences enable row level security;
alter table public.school_branding enable row level security;
alter table public.family_households enable row level security;
alter table public.student_authorized_contacts enable row level security;
alter table public.platform_security_events enable row level security;

-- Organization hierarchy
drop policy if exists org_organizations_read on public.org_organizations;
create policy org_organizations_read on public.org_organizations
  for select to authenticated
  using (has_permission('org.view') or has_role('CEO') or has_role('FOUNDER'));

drop policy if exists org_organizations_manage on public.org_organizations;
create policy org_organizations_manage on public.org_organizations
  for all to authenticated
  using (has_permission('org.manage'))
  with check (has_permission('org.manage'));

drop policy if exists org_regions_read on public.org_regions;
create policy org_regions_read on public.org_regions
  for select to authenticated
  using (has_permission('org.view') or has_role('CEO') or has_role('FOUNDER'));

drop policy if exists org_regions_manage on public.org_regions;
create policy org_regions_manage on public.org_regions
  for all to authenticated
  using (has_permission('org.manage'))
  with check (has_permission('org.manage'));

drop policy if exists org_programs_read on public.org_programs;
create policy org_programs_read on public.org_programs
  for select to authenticated
  using (can_access_school(school_id) or has_permission('org.view'));

drop policy if exists org_programs_manage on public.org_programs;
create policy org_programs_manage on public.org_programs
  for all to authenticated
  using (has_permission('org.manage') and can_access_school(school_id))
  with check (has_permission('org.manage') and can_access_school(school_id));

drop policy if exists org_departments_read on public.org_departments;
create policy org_departments_read on public.org_departments
  for select to authenticated
  using (can_access_school(school_id) or has_permission('org.view'));

drop policy if exists org_departments_manage on public.org_departments;
create policy org_departments_manage on public.org_departments
  for all to authenticated
  using (has_permission('org.manage') and can_access_school(school_id))
  with check (has_permission('org.manage') and can_access_school(school_id));

-- Permissions (read for admins; matrix edit requires roles.manage)
drop policy if exists platform_permissions_read on public.platform_permissions;
create policy platform_permissions_read on public.platform_permissions
  for select to authenticated
  using (true);

drop policy if exists platform_role_permissions_read on public.platform_role_permissions;
create policy platform_role_permissions_read on public.platform_role_permissions
  for select to authenticated
  using (has_permission('roles.view') or has_role('CEO') or has_role('FOUNDER'));

drop policy if exists platform_role_permissions_manage on public.platform_role_permissions;
create policy platform_role_permissions_manage on public.platform_role_permissions
  for all to authenticated
  using (has_permission('roles.manage'))
  with check (has_permission('roles.manage'));

-- User org assignments
drop policy if exists user_org_assignments_read on public.user_org_assignments;
create policy user_org_assignments_read on public.user_org_assignments
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission('users.view')
    or has_role('CEO')
    or has_role('FOUNDER')
  );

drop policy if exists user_org_assignments_manage on public.user_org_assignments;
create policy user_org_assignments_manage on public.user_org_assignments
  for all to authenticated
  using (has_permission('users.manage'))
  with check (has_permission('users.manage'));

-- Impersonation sessions
drop policy if exists impersonation_read on public.platform_impersonation_sessions;
create policy impersonation_read on public.platform_impersonation_sessions
  for select to authenticated
  using (
    actor_user_id = auth.uid()
    or target_user_id = auth.uid()
    or has_permission('security.view')
    or has_role('CEO')
    or has_role('FOUNDER')
  );

drop policy if exists impersonation_insert on public.platform_impersonation_sessions;
create policy impersonation_insert on public.platform_impersonation_sessions
  for insert to authenticated
  with check (has_permission('impersonate.users') and actor_user_id = auth.uid());

drop policy if exists impersonation_update on public.platform_impersonation_sessions;
create policy impersonation_update on public.platform_impersonation_sessions
  for update to authenticated
  using (actor_user_id = auth.uid() or has_permission('security.view'))
  with check (actor_user_id = auth.uid() or has_permission('security.view'));

-- User preferences (own row only unless admin)
drop policy if exists user_preferences_own on public.user_preferences;
create policy user_preferences_own on public.user_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- School branding
drop policy if exists school_branding_read on public.school_branding;
create policy school_branding_read on public.school_branding
  for select to authenticated
  using (can_access_school(school_id) or has_permission('school.configure'));

drop policy if exists school_branding_manage on public.school_branding;
create policy school_branding_manage on public.school_branding
  for all to authenticated
  using (has_permission('school.configure') and can_access_school(school_id))
  with check (has_permission('school.configure') and can_access_school(school_id));

-- Family households & authorized contacts
drop policy if exists family_households_staff on public.family_households;
create policy family_households_staff on public.family_households
  for all to authenticated
  using (
    exists (
      select 1 from public.families f
      where f.id = family_households.family_id
        and can_access_school(f.school_id)
    )
  )
  with check (
    exists (
      select 1 from public.families f
      where f.id = family_households.family_id
        and can_access_school(f.school_id)
    )
  );

drop policy if exists student_authorized_contacts_staff on public.student_authorized_contacts;
create policy student_authorized_contacts_staff on public.student_authorized_contacts
  for all to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_authorized_contacts.student_id
        and can_access_school(s.school_id)
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_authorized_contacts.student_id
        and can_access_school(s.school_id)
    )
  );

-- Security events
drop policy if exists platform_security_events_read on public.platform_security_events;
create policy platform_security_events_read on public.platform_security_events
  for select to authenticated
  using (
    has_permission('security.view')
    or has_role('CEO')
    or has_role('FOUNDER')
    or user_id = auth.uid()
    or actor_user_id = auth.uid()
  );

drop policy if exists platform_security_events_insert on public.platform_security_events;
create policy platform_security_events_insert on public.platform_security_events
  for insert to authenticated
  with check (true);

-- Extend roles table: allow custom role creation by admins
drop policy if exists roles_manage_custom on public.roles;
create policy roles_manage_custom on public.roles
  for insert to authenticated
  with check (has_permission('roles.manage'));

drop policy if exists roles_update_custom on public.roles;
create policy roles_update_custom on public.roles
  for update to authenticated
  using (has_permission('roles.manage') and (is_custom = true or has_role('CEO') or has_role('FOUNDER')))
  with check (has_permission('roles.manage'));

-- Grant API access to permission helpers
grant execute on function public.has_permission(text) to authenticated, anon, service_role;
grant execute on function public.user_role_ids(uuid) to authenticated, service_role;
grant execute on function public.user_can_access_school(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
