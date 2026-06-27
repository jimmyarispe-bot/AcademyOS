-- =========================================
-- SPRINT 1.7 ADDITIONS RLS (077)
-- =========================================

alter table public.platform_scope_grants enable row level security;
alter table public.platform_record_classifications enable row level security;
alter table public.platform_classification_permissions enable row level security;
alter table public.platform_sensitive_access_log enable row level security;
alter table public.platform_digital_signatures enable row level security;
alter table public.platform_record_locks enable row level security;
alter table public.platform_record_unlock_events enable row level security;
alter table public.platform_approval_rules enable row level security;
alter table public.platform_approval_requests enable row level security;
alter table public.user_mfa_settings enable row level security;
alter table public.platform_identity_providers enable row level security;

-- Scope grants
drop policy if exists platform_scope_grants_read on public.platform_scope_grants;
create policy platform_scope_grants_read on public.platform_scope_grants
  for select to authenticated
  using (user_id = auth.uid() or has_permission('users.view') or is_enterprise_admin());

drop policy if exists platform_scope_grants_manage on public.platform_scope_grants;
create policy platform_scope_grants_manage on public.platform_scope_grants
  for all to authenticated
  using (has_permission('users.manage') and (is_enterprise_admin() or can_access_school(school_id)))
  with check (has_permission('users.manage') and (is_enterprise_admin() or can_access_school(school_id)));

-- Classifications
drop policy if exists platform_classification_permissions_read on public.platform_classification_permissions;
create policy platform_classification_permissions_read on public.platform_classification_permissions
  for select to authenticated using (true);

drop policy if exists platform_record_classifications_read on public.platform_record_classifications;
create policy platform_record_classifications_read on public.platform_record_classifications
  for select to authenticated
  using (
    (school_id is null or can_access_school(school_id))
    and can_access_classification(classification)
  );

drop policy if exists platform_record_classifications_manage on public.platform_record_classifications;
create policy platform_record_classifications_manage on public.platform_record_classifications
  for all to authenticated
  using (
    has_permission('security.view') or is_enterprise_admin()
    and (school_id is null or can_access_school(school_id))
  )
  with check (
    has_permission('security.view') or is_enterprise_admin()
    and (school_id is null or can_access_school(school_id))
  );

-- Sensitive access log
drop policy if exists platform_sensitive_access_log_read on public.platform_sensitive_access_log;
create policy platform_sensitive_access_log_read on public.platform_sensitive_access_log
  for select to authenticated
  using (
    has_permission('audit.view_all') or has_permission('security.view') or is_enterprise_admin()
    or user_id = auth.uid()
  );

drop policy if exists platform_sensitive_access_log_insert on public.platform_sensitive_access_log;
create policy platform_sensitive_access_log_insert on public.platform_sensitive_access_log
  for insert to authenticated with check (true);

-- Digital signatures
drop policy if exists platform_digital_signatures_read on public.platform_digital_signatures;
create policy platform_digital_signatures_read on public.platform_digital_signatures
  for select to authenticated
  using (school_id is null or can_access_school(school_id) or signer_user_id = auth.uid());

drop policy if exists platform_digital_signatures_insert on public.platform_digital_signatures;
create policy platform_digital_signatures_insert on public.platform_digital_signatures
  for insert to authenticated
  with check (signer_user_id = auth.uid() or has_permission('records.unlock') or is_enterprise_admin());

-- Record locks
drop policy if exists platform_record_locks_read on public.platform_record_locks;
create policy platform_record_locks_read on public.platform_record_locks
  for select to authenticated
  using (school_id is null or can_access_school(school_id));

drop policy if exists platform_record_locks_manage on public.platform_record_locks;
create policy platform_record_locks_manage on public.platform_record_locks
  for all to authenticated
  using (has_permission('records.unlock') or is_enterprise_admin())
  with check (has_permission('records.unlock') or is_enterprise_admin());

drop policy if exists platform_record_unlock_events_read on public.platform_record_unlock_events;
create policy platform_record_unlock_events_read on public.platform_record_unlock_events
  for select to authenticated
  using (has_permission('audit.view_all') or has_permission('security.view') or is_enterprise_admin());

drop policy if exists platform_record_unlock_events_insert on public.platform_record_unlock_events;
create policy platform_record_unlock_events_insert on public.platform_record_unlock_events
  for insert to authenticated
  with check (has_permission('records.unlock') or is_enterprise_admin());

-- Approval matrix
drop policy if exists platform_approval_rules_read on public.platform_approval_rules;
create policy platform_approval_rules_read on public.platform_approval_rules
  for select to authenticated
  using (
    has_permission('approvals.configure') or has_permission('approvals.review')
    or is_enterprise_admin()
  );

drop policy if exists platform_approval_rules_manage on public.platform_approval_rules;
create policy platform_approval_rules_manage on public.platform_approval_rules
  for all to authenticated
  using (has_permission('approvals.configure') or is_founder())
  with check (has_permission('approvals.configure') or is_founder());

drop policy if exists platform_approval_requests_read on public.platform_approval_requests;
create policy platform_approval_requests_read on public.platform_approval_requests
  for select to authenticated
  using (
    requested_by = auth.uid()
    or has_permission('approvals.review')
    or is_enterprise_admin()
    or (school_id is not null and can_access_school(school_id))
  );

drop policy if exists platform_approval_requests_insert on public.platform_approval_requests;
create policy platform_approval_requests_insert on public.platform_approval_requests
  for insert to authenticated with check (requested_by = auth.uid() or is_enterprise_admin());

drop policy if exists platform_approval_requests_update on public.platform_approval_requests;
create policy platform_approval_requests_update on public.platform_approval_requests
  for update to authenticated
  using (has_permission('approvals.review') or is_enterprise_admin() or has_permission('workflows.approve_any'))
  with check (has_permission('approvals.review') or is_enterprise_admin() or has_permission('workflows.approve_any'));

-- MFA settings (own row)
drop policy if exists user_mfa_settings_own on public.user_mfa_settings;
create policy user_mfa_settings_own on public.user_mfa_settings
  for all to authenticated
  using (user_id = auth.uid() or has_permission('users.manage') or is_enterprise_admin())
  with check (user_id = auth.uid() or has_permission('users.manage') or is_enterprise_admin());

-- Identity providers (admin only)
drop policy if exists platform_identity_providers_read on public.platform_identity_providers;
create policy platform_identity_providers_read on public.platform_identity_providers
  for select to authenticated
  using (has_permission('org.manage') or is_enterprise_admin());

drop policy if exists platform_identity_providers_manage on public.platform_identity_providers;
create policy platform_identity_providers_manage on public.platform_identity_providers
  for all to authenticated
  using (is_founder() or has_permission('org.manage'))
  with check (is_founder() or has_permission('org.manage'));

notify pgrst, 'reload schema';
