-- 349_school_leader_no_money_2026_09_12.sql
--
-- School Leaders see admissions and students. They do not see money.
--
-- THE REQUIREMENT, verbatim: "both heather and nina should never see anything
-- about money, scholarships, funds, funding, taxes. only admissions related for
-- these 2 users."
--
-- WHY THIS IS DONE AT THE ROLE AND NOT PER PERSON. There is no per-user
-- permission table in this schema — `platform_role_permissions` is keyed on
-- (role_id, permission_key) and nothing else. Permissions are a property of the
-- role. So the honest way to say "these two people" is to say it about
-- SCHOOL_LEADER, which is the role they hold. The verification at the bottom
-- lists everybody who holds it, so if that set is wider than the two of them you
-- will see it before you trust this.
--
-- WHY `deny` AND NOT DELETE. Two places grant these permissions and deleting
-- only reaches one.
--
--   The database grants them: migration 074 gave SCHOOL_LEADER
--   `scholarships.view`, `funding.view` and `finance.view` outright.
--
--   The application grants them again, separately, from a hard-coded map:
--   SCHOOL_LEADER maps to ADMISSIONS_ACCESS, and that group expands to include
--   `scholarships.view` and `scholarships.approve`. That map is TypeScript. It
--   does not read this table, and deleting a row here does not touch it.
--
-- A deleted row leaves the code map intact and the permission still granted —
-- another migration reporting success while changing nothing. A `deny` row is
-- read by both: `has_permission()` checks deny first and returns false, and
-- `loadUserPermissionsWithClient` subtracts denied keys from the mapped set
-- after expanding it. One row, both layers.
--
-- WHY DRIVEN OFF THE CATALOG. Hand-typing the key list is how one gets missed.
-- This selects every permission in the money modules, so re-running it after new
-- finance permissions are added denies those too. Re-run it when that happens —
-- a `deny` row is static and will not appear on its own.
--
-- Safe to re-run.

insert into public.platform_role_permissions (role_id, permission_key, effect)
select r.id, p.permission_key, 'deny'
from public.roles r
cross join public.platform_permissions p
where r.name = 'SCHOOL_LEADER'
  and (
    p.module in ('finance', 'scholarships', 'funding', 'accounting', 'payroll', 'banking', 'billing')
    or p.permission_key like 'finance.%'
    or p.permission_key like 'fi.%'
    or p.permission_key like 'scholarships.%'
    or p.permission_key like 'funding.%'
    or p.permission_key like 'payroll.%'
    or p.permission_key like 'billing.%'
    or p.permission_key like 'accounting.%'
    or p.permission_key like 'banking.%'
    or p.permission_key like 'tuition.%'
    or p.permission_key like 'tax.%'
    or p.permission_key = 'FINANCE_ACCESS'
    or p.permission_key = 'ACCOUNTING_ACCESS'
    or p.permission_key = 'PAYROLL_ACCESS'
    or p.permission_key = 'BANKING_ACCESS'
  )
  -- Admissions is the whole point of the role and is never denied, even where a
  -- key mentions funding. `admissions.view` opens the lead list; the funding
  -- pages inside admissions are guarded separately, in the application.
  and p.permission_key not like 'admissions.%'
on conflict (role_id, permission_key) do update
  set effect = 'deny';

-- -----------------------------------------------------------------------------
-- VERIFICATION
-- -----------------------------------------------------------------------------

-- 1. Who holds SCHOOL_LEADER. Expect Heather Badger-Brown and Nina Gaddy, and
--    nobody else. A third name means this migration just changed somebody you
--    did not have in mind.
select
  '1. holds SCHOOL_LEADER' as check,
  coalesce(u.full_name, '(no name)') as person,
  u.email,
  '' as detail
from public.users u
join public.user_roles ur on ur.user_id = u.id
join public.roles r on r.id = ur.role_id
where r.name = 'SCHOOL_LEADER'

union all

-- 2. Every money permission now denied to the role. These are the keys that
--    will come back false from has_permission() and be subtracted from the
--    application's mapped set.
select
  '2. denied',
  prp.permission_key,
  p.module,
  p.name
from public.platform_role_permissions prp
join public.roles r on r.id = prp.role_id
join public.platform_permissions p on p.permission_key = prp.permission_key
where r.name = 'SCHOOL_LEADER'
  and prp.effect = 'deny'

union all

-- 3. Anything money-shaped still sitting at 'allow'. Expect nothing. A row here
--    is a key the pattern above did not match, and it is still visible to them.
select
  '3. STILL ALLOWED',
  prp.permission_key,
  p.module,
  p.name
from public.platform_role_permissions prp
join public.roles r on r.id = prp.role_id
join public.platform_permissions p on p.permission_key = prp.permission_key
where r.name = 'SCHOOL_LEADER'
  and prp.effect = 'allow'
  and (
    p.module in ('finance', 'scholarships', 'funding', 'accounting', 'payroll', 'banking', 'billing')
    or p.permission_key ~ '^(finance|fi|scholarships|funding|payroll|billing|accounting|banking|tuition|tax)\.'
  )

union all

-- 4. Admissions and students are untouched. Expect three admissions rows and the
--    students rows, all 'allow'. If this is empty the migration went too far.
select
  '4. kept',
  prp.permission_key,
  prp.effect,
  ''
from public.platform_role_permissions prp
join public.roles r on r.id = prp.role_id
where r.name = 'SCHOOL_LEADER'
  and (prp.permission_key like 'admissions.%' or prp.permission_key like 'students.%')

order by 1, 2;
