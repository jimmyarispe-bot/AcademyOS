-- =========================================
-- SPRINT 1.7 ADDITIONS (076): Enterprise Authority, Classification, Compliance
-- Extends 074 — idempotent
-- =========================================

-- -----------------------------------------
-- 13. FOUNDER & EXECUTIVE AUTHORITY
-- -----------------------------------------

alter table public.roles
  add column if not exists is_immutable boolean not null default false;

update public.roles set is_immutable = true, is_system = true
  where name = 'FOUNDER';

update public.roles set display_name = coalesce(display_name, 'Founder'), description = coalesce(description, 'Immutable enterprise authority — unrestricted platform access')
  where name = 'FOUNDER';

-- Prevent deletion of immutable roles (Founder)
create or replace function public.prevent_immutable_role_delete()
returns trigger language plpgsql as $$
begin
  if old.is_immutable then
    raise exception 'Role % is immutable and cannot be deleted', old.name;
  end if;
  return old;
end;
$$;

drop trigger if exists roles_prevent_immutable_delete on public.roles;
create trigger roles_prevent_immutable_delete
  before delete on public.roles
  for each row execute function public.prevent_immutable_role_delete();

-- -----------------------------------------
-- ENTERPRISE HELPERS
-- -----------------------------------------

create or replace function public.is_founder()
returns boolean language sql stable as $$
  select has_role('FOUNDER');
$$;

create or replace function public.is_enterprise_admin()
returns boolean language sql stable as $$
  select has_role('FOUNDER') or has_role('CEO') or has_role('EXECUTIVE_DIRECTOR');
$$;

create or replace function public.is_ceo()
returns boolean language sql stable as $$
  select has_role('CEO');
$$;

-- Founder: unrestricted. CEO/Executive: all seeded permissions. Others: matrix.
create or replace function public.has_permission(permission_key text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  if has_role('FOUNDER') then return true; end if;
  if has_role('CEO') or has_role('EXECUTIVE_DIRECTOR') then return true; end if;

  if exists (
    select 1 from public.user_role_ids(uid) rt
    join public.platform_role_permissions prp on prp.role_id = rt
    where prp.permission_key = has_permission.permission_key and prp.effect = 'deny'
  ) then return false; end if;

  return exists (
    select 1 from public.user_role_ids(uid) rt
    join public.platform_role_permissions prp on prp.role_id = rt
    where prp.permission_key = has_permission.permission_key and prp.effect = 'allow'
  );
end;
$$;

-- 14. School-level security — enterprise admins bypass; others require assignment
create or replace function public.can_access_school(school_id uuid)
returns boolean language sql stable as $$
  select
    is_enterprise_admin()
    or (
      (has_role('SCHOOL_LEADER') or has_role('TEACHER') or has_role('ADMISSIONS')
        or has_role('FINANCE') or has_role('HR') or has_role('REGISTRAR')
        or has_role('SCHOLARSHIP_MANAGER') or has_role('STATE_FUNDING_MANAGER')
        or has_role('SUPPORT_STAFF') or has_role('THERAPIST'))
      and (
        is_assigned_to_school(school_id)
        or exists (
          select 1 from public.user_org_assignments uoa
          where uoa.user_id = auth.uid() and uoa.school_id = can_access_school.school_id
        )
      )
    )
    or (
      has_role('PARENT') and exists (
        select 1 from public.student_family_link sfl
        join public.students s on s.id = sfl.student_id
        where sfl.user_id = auth.uid() and s.school_id = can_access_school.school_id
      )
    )
    or (
      has_role('STUDENT') and exists (
        select 1 from public.students s
        where s.user_id = auth.uid() and s.school_id = can_access_school.school_id
      )
    );
$$;

-- 16/17 Parent & student portal scope
create or replace function public.can_access_student_record(check_student_id uuid)
returns boolean language sql stable as $$
  select
    is_enterprise_admin()
    or exists (
      select 1 from public.students s
      where s.id = check_student_id and can_access_school(s.school_id)
    )
    or exists (
      select 1 from public.student_family_link sfl
      where sfl.student_id = check_student_id and sfl.user_id = auth.uid()
    )
    or exists (
      select 1 from public.students s
      where s.id = check_student_id and s.user_id = auth.uid()
    );
$$;

-- -----------------------------------------
-- EXPANDED PERMISSIONS (13, 20, 19)
-- -----------------------------------------

insert into public.platform_permissions (permission_key, name, description, module, category, sort_order) values
  ('founder.override', 'Override Permissions', 'Emergency permission override', 'executive', 'founder', 1),
  ('founder.emergency_access', 'Emergency Access', 'Break-glass enterprise access', 'executive', 'founder', 2),
  ('records.unlock', 'Unlock Records', 'Unlock finalized records', 'security', 'records', 3),
  ('workflows.approve_any', 'Approve Any Workflow', 'Approve any pending workflow', 'automation', 'workflows', 4),
  ('audit.view_all', 'View All Audit Logs', 'Cross-module audit visibility', 'security', 'audit', 5),
  ('licensing.manage', 'Manage Licensing', 'Organization licensing', 'organization', 'licensing', 6),
  ('global.reporting', 'Global Reporting', 'Enterprise-wide reports', 'executive', 'reporting', 7),
  ('compliance.view', 'View Compliance Dashboard', 'FERPA, funding, security compliance', 'compliance', 'compliance', 8),
  ('finance.billing', 'Billing', 'Tuition and invoice management', 'finance', 'billing', 81),
  ('finance.scholarships', 'Finance Scholarships', 'Scholarship financial operations', 'finance', 'scholarships', 82),
  ('finance.state_funding', 'Finance State Funding', 'State funding financial ops', 'finance', 'funding', 83),
  ('finance.payroll', 'Finance Payroll', 'Payroll processing and approval', 'finance', 'payroll', 84),
  ('finance.accounting', 'Accounting', 'General accounting records', 'finance', 'accounting', 85),
  ('finance.banking', 'Banking', 'Banking and reconciliation', 'finance', 'banking', 86),
  ('finance.audit', 'Financial Audit Reports', 'Financial audit and compliance reports', 'finance', 'audit', 87),
  ('finance.approve', 'Financial Approvals', 'Approve financial transactions', 'finance', 'approval', 88),
  ('ferpa.view_iep', 'View IEP Records', 'Individualized education programs', 'compliance', 'ferpa', 90),
  ('ferpa.view_medical', 'View Medical Records', 'Student medical information', 'compliance', 'ferpa', 91),
  ('ferpa.view_discipline', 'View Discipline Records', 'Discipline and behavior records', 'compliance', 'ferpa', 92),
  ('ferpa.view_evaluations', 'View Evaluations', 'Psychological and educational evaluations', 'compliance', 'ferpa', 93),
  ('portal.parent.access', 'Parent Portal Access', 'Access parent portal for linked children', 'parent_portal', 'portal', 200),
  ('portal.student.access', 'Student Portal Access', 'Access student portal for self', 'student_portal', 'portal', 201),
  ('approvals.configure', 'Configure Approval Matrix', 'Edit executive approval thresholds', 'executive', 'approvals', 110),
  ('approvals.review', 'Review Approvals', 'Act on pending approval requests', 'executive', 'approvals', 111),
  ('search.global', 'Global Search', 'Permission-filtered global search', 'platform', 'search', 112)
on conflict (permission_key) do update set name = excluded.name, description = excluded.description;

-- Founder gets all new permissions (already has all via 074 CEO/FOUNDER seed — re-seed for new keys)
insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r cross join public.platform_permissions p
where r.name in ('FOUNDER', 'CEO', 'EXECUTIVE_DIRECTOR')
on conflict (role_id, permission_key) do nothing;

-- CEO operational bundle (explicit — cannot delete Founder handled by trigger)
insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r cross join public.platform_permissions p
where r.name = 'CEO'
  and p.permission_key in (
    'users.manage', 'executive.dashboard', 'mission_control.access', 'finance.override_tuition',
    'finance.approve', 'payroll.run', 'global.reporting', 'compliance.view', 'approvals.review'
  )
on conflict (role_id, permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r cross join public.platform_permissions p
where r.name = 'PARENT' and p.permission_key = 'portal.parent.access'
on conflict (role_id, permission_key) do nothing;

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'allow'
from public.roles r cross join public.platform_permissions p
where r.name = 'STUDENT' and p.permission_key = 'portal.student.access'
on conflict (role_id, permission_key) do nothing;

-- -----------------------------------------
-- 15. PROGRAM-LEVEL PERMISSIONS
-- -----------------------------------------

create table if not exists public.platform_scope_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  scope_type text not null check (scope_type in ('school', 'program', 'department', 'grade_band', 'classroom')),
  program_id uuid references public.org_programs(id) on delete cascade,
  department_id uuid references public.org_departments(id) on delete cascade,
  grade_band text,
  classroom_id uuid,
  label text,
  granted_permissions text[] not null default '{}',
  denied_permissions text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_platform_scope_grants_user on public.platform_scope_grants(user_id, school_id);

drop trigger if exists platform_scope_grants_set_updated_at on public.platform_scope_grants;
create trigger platform_scope_grants_set_updated_at
  before update on public.platform_scope_grants
  for each row execute function public.trigger_set_updated_at();

-- -----------------------------------------
-- 18. DATA CLASSIFICATION
-- -----------------------------------------

create table if not exists public.platform_record_classifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  module text not null,
  entity_type text not null,
  entity_id uuid not null,
  classification text not null default 'internal'
    check (classification in (
      'public', 'internal', 'confidential', 'restricted',
      'medical', 'financial', 'executive', 'special_education'
    )),
  classified_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_record_classifications_unique unique (entity_type, entity_id)
);

create index if not exists idx_record_classifications_entity
  on public.platform_record_classifications(entity_type, entity_id);

create table if not exists public.platform_classification_permissions (
  classification text primary key,
  required_permission text not null references public.platform_permissions(permission_key),
  description text
);

insert into public.platform_classification_permissions (classification, required_permission, description) values
  ('public', 'students.view', 'Public school information'),
  ('internal', 'students.view', 'Internal staff records'),
  ('confidential', 'students.edit', 'Confidential student data'),
  ('restricted', 'security.view', 'Restricted access records'),
  ('medical', 'ferpa.view_medical', 'Medical and health records'),
  ('financial', 'finance.view', 'Financial records'),
  ('executive', 'executive.dashboard', 'Executive-only information'),
  ('special_education', 'ferpa.view_iep', 'IEP and special education records')
on conflict (classification) do nothing;

create or replace function public.can_access_classification(check_classification text)
returns boolean language sql stable as $$
  select
    is_founder()
    or exists (
      select 1 from public.platform_classification_permissions cp
      where cp.classification = check_classification
        and has_permission(cp.required_permission)
    );
$$;

-- -----------------------------------------
-- 19. FERPA & SENSITIVE ACCESS AUDIT
-- -----------------------------------------

create table if not exists public.platform_sensitive_access_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  record_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  classification text,
  access_action text not null default 'view'
    check (access_action in ('view', 'edit', 'export', 'print')),
  ip_address text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sensitive_access_entity
  on public.platform_sensitive_access_log(entity_type, entity_id, created_at desc);

-- Extend security event types
alter table public.platform_security_events drop constraint if exists platform_security_events_event_type_check;
alter table public.platform_security_events add constraint platform_security_events_event_type_check
  check (event_type in (
    'failed_login', 'permission_change', 'role_assignment', 'role_removal',
    'impersonation_start', 'impersonation_end', 'export', 'sensitive_access',
    'org_assignment_change', 'school_config_change', 'record_unlock',
    'approval_submitted', 'approval_decided', 'classification_change'
  ));

-- -----------------------------------------
-- 21. DIGITAL SIGNATURES
-- -----------------------------------------

create table if not exists public.platform_digital_signatures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  module text not null,
  document_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  signer_user_id uuid references public.users(id) on delete set null,
  signer_name text not null,
  signer_email text,
  signed_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  device_info jsonb not null default '{}'::jsonb,
  document_version text not null default '1',
  document_hash text,
  signature_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_digital_signatures_entity
  on public.platform_digital_signatures(entity_type, entity_id);

-- -----------------------------------------
-- 22. RECORD LOCKING
-- -----------------------------------------

create table if not exists public.platform_record_locks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  module text not null,
  entity_type text not null,
  entity_id uuid not null,
  lock_reason text not null,
  locked_by uuid references public.users(id) on delete set null,
  locked_at timestamptz not null default now(),
  is_active boolean not null default true,
  constraint platform_record_locks_unique unique (entity_type, entity_id)
);

create table if not exists public.platform_record_unlock_events (
  id uuid primary key default gen_random_uuid(),
  lock_id uuid not null references public.platform_record_locks(id) on delete cascade,
  unlocked_by uuid references public.users(id) on delete set null,
  unlock_reason text not null,
  ip_address text,
  created_at timestamptz not null default now()
);

create or replace function public.is_record_locked(check_entity_type text, check_entity_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.platform_record_locks
    where entity_type = check_entity_type and entity_id = check_entity_id and is_active = true
  );
$$;

-- -----------------------------------------
-- 23. EXECUTIVE APPROVAL MATRIX
-- -----------------------------------------

create table if not exists public.platform_approval_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  rule_key text not null,
  name text not null,
  module text not null,
  description text,
  condition_config jsonb not null default '{}'::jsonb,
  approver_roles text[] not null default '{}',
  approver_permissions text[] not null default '{}',
  threshold_value numeric,
  threshold_unit text,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_approval_rules_key unique (school_id, rule_key)
);

drop trigger if exists platform_approval_rules_set_updated_at on public.platform_approval_rules;
create trigger platform_approval_rules_set_updated_at
  before update on public.platform_approval_rules
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.platform_approval_requests (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.platform_approval_rules(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  module text not null,
  entity_type text not null,
  entity_id uuid not null,
  title text not null,
  summary text not null default '',
  requested_by uuid references public.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  decision_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_approval_requests_status
  on public.platform_approval_requests(status, created_at desc);

-- Seed default approval rules (configurable without code)
insert into public.platform_approval_rules
  (school_id, rule_key, name, module, description, condition_config, approver_roles, threshold_value, threshold_unit)
select null, 'scholarship_over_10k', 'Scholarship over $10,000', 'scholarships',
  'Requires Founder approval for large scholarship awards',
  '{"field":"award_amount","operator":">"}'::jsonb, ARRAY['FOUNDER'], 10000, 'usd'
on conflict (school_id, rule_key) do nothing;

insert into public.platform_approval_rules
  (school_id, rule_key, name, module, description, condition_config, approver_roles, threshold_value, threshold_unit)
select null, 'tuition_override_20pct', 'Tuition override >20%', 'finance',
  'Requires CEO approval for significant tuition overrides',
  '{"field":"override_percent","operator":">"}'::jsonb, ARRAY['CEO'], 20, 'percent'
on conflict (school_id, rule_key) do nothing;

insert into public.platform_approval_rules
  (school_id, rule_key, name, module, description, condition_config, approver_roles)
select null, 'payroll_adjustment', 'Payroll adjustment', 'hr',
  'Requires Finance + CEO approval for payroll adjustments',
  '{"field":"adjustment_type","operator":"exists"}'::jsonb, ARRAY['FINANCE', 'CEO']
on conflict (school_id, rule_key) do nothing;

insert into public.platform_approval_rules
  (school_id, rule_key, name, module, description, condition_config, approver_roles)
select null, 'student_expulsion', 'Student expulsion', 'sis',
  'Requires School Leader + CEO approval',
  '{"field":"action","value":"expulsion"}'::jsonb, ARRAY['SCHOOL_LEADER', 'CEO']
on conflict (school_id, rule_key) do nothing;

-- -----------------------------------------
-- 24. MFA READINESS
-- -----------------------------------------

create table if not exists public.user_mfa_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  mfa_required boolean not null default false,
  preferred_method text check (preferred_method in ('totp', 'sms', 'email', 'passkey')),
  totp_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  email_verification_enabled boolean not null default false,
  passkey_enabled boolean not null default false,
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Require MFA flag for executive/financial roles (enforcement deferred to future sprint)
insert into public.user_mfa_settings (user_id, mfa_required)
select ur.user_id, true
from public.user_roles ur
join public.roles r on r.id = ur.role_id
where r.name in ('FOUNDER', 'CEO', 'EXECUTIVE_DIRECTOR', 'FINANCE', 'HR')
on conflict (user_id) do update set mfa_required = true;

-- -----------------------------------------
-- 28. FUTURE EXTERNAL IDENTITY (SSO architecture)
-- -----------------------------------------

create table if not exists public.platform_identity_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  provider_type text not null
    check (provider_type in ('google_workspace', 'microsoft_entra', 'azure_ad', 'okta', 'clever', 'classlink', 'saml', 'oidc')),
  name text not null,
  is_enabled boolean not null default false,
  organization_id uuid references public.org_organizations(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  domain_allowlist text[] not null default '{}',
  role_mapping jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_identity_providers (provider_key, provider_type, name, is_enabled) values
  ('google_workspace', 'google_workspace', 'Google Workspace', false),
  ('microsoft_entra', 'microsoft_entra', 'Microsoft Entra ID', false),
  ('azure_ad', 'azure_ad', 'Azure AD', false),
  ('okta', 'okta', 'Okta', false),
  ('clever', 'clever', 'Clever', false),
  ('classlink', 'classlink', 'ClassLink', false)
on conflict (provider_key) do nothing;

drop trigger if exists platform_identity_providers_set_updated_at on public.platform_identity_providers;
create trigger platform_identity_providers_set_updated_at
  before update on public.platform_identity_providers
  for each row execute function public.trigger_set_updated_at();

-- Grants for new functions
grant execute on function public.is_founder() to authenticated, service_role;
grant execute on function public.is_enterprise_admin() to authenticated, service_role;
grant execute on function public.is_ceo() to authenticated, service_role;
grant execute on function public.can_access_student_record(uuid) to authenticated, service_role;
grant execute on function public.can_access_classification(text) to authenticated, service_role;
grant execute on function public.is_record_locked(text, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
