-- 348_provisioning_stops_assigning_florida_2026_09_12.sql
--
-- Nobody is auto-assigned to a campus any more.
--
-- THE BUG. `provision_auth_user` runs from the `on_auth_user_created` trigger,
-- in the same transaction that creates a person's `public.users` row. For every
-- non-founder it attached them to The Academy FL — hard-coded by uuid,
-- `is_primary` true — before any administrator had chosen anything:
--
--     -- Prefer Academy FL as primary school when present
--     select s.id into v_primary_school_id
--     from public.schools s
--     where s.organization_id = v_org_id
--       and s.id = 'a1000000-0000-4000-8000-000000000001'
--
-- User Management then added whatever campus was actually ticked, so the person
-- came out holding both. Nina Gaddy is the worked example: account created
-- 2026-09-12 13:05:00.400126 with the Florida rows written in that same
-- microsecond, Georgia added deliberately at 13:05:04. Assigned to Georgia,
-- able to read Florida, and her Admissions header said "The Academy FL" because
-- the header reads the primary assignment.
--
-- This is not one person's misconfiguration. Every account ever created through
-- this trigger got Florida, and 59 children's records sit behind it.
--
-- THE FIX, IN THREE PARTS.
--
--   1. The function no longer grants any school to a non-founder. They leave
--      provisioning with a role and no campus, and User Management grants
--      exactly what was ticked. Access is now something given, never defaulted.
--
--   2. Nina's Florida rows are removed from both tables. Both, because
--      `can_access_school` is satisfied by either one — deleting from a single
--      table looks like a fix and changes nothing.
--
--   3. The verification at the bottom lists every non-founder holding a campus
--      that was attached in the same transaction as their account. Those are
--      the rows this trigger handed out. It reports, it does not delete: I am
--      not guessing which of those somebody later decided was correct.
--
-- WHAT THIS DOES NOT DO. It does not touch founders, who still receive every
-- school in the organisation from a configured bootstrap list. It does not
-- revoke anybody's campus except Nina's Florida. Part 3 is the list you decide
-- from.
--
-- Safe to re-run.

create or replace function public.provision_auth_user(
  p_user_id uuid,
  p_email text default null,
  p_full_name text default null,
  p_meta jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_full_name text;
  v_meta jsonb;
  v_org_id uuid;
  v_org_slug text;
  v_default_role text;
  v_bootstrap_emails text[];
  v_role_name text;
  v_is_founder boolean := false;
  v_primary_school_id uuid;
begin
  if p_user_id is null then
    return;
  end if;

  select
    coalesce(nullif(btrim(p_email), ''), au.email),
    coalesce(
      nullif(btrim(p_full_name), ''),
      nullif(btrim(coalesce(p_meta, au.raw_user_meta_data)->>'full_name'), ''),
      nullif(btrim(coalesce(p_meta, au.raw_user_meta_data)->>'name'), '')
    ),
    coalesce(p_meta, au.raw_user_meta_data, '{}'::jsonb)
  into v_email, v_full_name, v_meta
  from auth.users au
  where au.id = p_user_id;

  if v_email is null then
    -- auth row missing (should not happen on trigger path)
    v_email := nullif(btrim(p_email), '');
    v_full_name := nullif(btrim(p_full_name), '');
    v_meta := coalesce(p_meta, '{}'::jsonb);
  end if;

  if v_email is null then
    return;
  end if;

  -- 1) public.users
  insert into public.users (id, email, full_name)
  values (p_user_id, v_email, v_full_name)
  on conflict (id) do nothing;

  -- 2) Resolve provisioning config
  select
    c.default_org_slug,
    c.default_role_name,
    coalesce(c.founder_bootstrap_emails, '{}'::text[])
  into v_org_slug, v_default_role, v_bootstrap_emails
  from public.auth_provisioning_config c
  where c.id = 1;

  v_org_slug := coalesce(nullif(btrim(v_org_slug), ''), 'the-academy-way');
  v_default_role := coalesce(nullif(btrim(v_default_role), ''), 'TEAM_MEMBER');

  select o.id
  into v_org_id
  from public.org_organizations o
  where o.slug = v_org_slug
  order by o.created_at
  limit 1;

  if v_org_id is null then
    select o.id
    into v_org_id
    from public.org_organizations o
    order by o.created_at
    limit 1;
  end if;

  -- Founder bootstrap: configured email list and/or explicit metadata flag
  v_is_founder :=
    exists (
      select 1
      from unnest(v_bootstrap_emails) as e
      where nullif(btrim(e), '') is not null
        and lower(btrim(e)) = lower(v_email)
    )
    or lower(coalesce(v_meta->>'bootstrap_role', '')) = 'founder'
    or lower(coalesce(v_meta->>'role', '')) = 'founder';

  v_role_name := case when v_is_founder then 'FOUNDER' else v_default_role end;

  -- Ensure FOUNDER role exists when needed
  if v_is_founder then
    insert into public.roles (name, display_name, description, is_system, sort_order)
    values (
      'FOUNDER',
      'Founder',
      'Highest platform role with JAG and AcademyOS access.',
      true,
      1
    )
    on conflict (name) do nothing;
  end if;

  -- 3) Default (or Founder) role
  insert into public.user_roles (user_id, role_id)
  select p_user_id, r.id
  from public.roles r
  where r.name = v_role_name
  on conflict (user_id, role_id) do nothing;

  -- 4) Organization membership
  if v_org_id is not null then
    insert into public.user_organization_memberships (
      organization_id,
      user_id,
      membership_role,
      status,
      is_primary,
      permissions,
      joined_at
    )
    values (
      v_org_id,
      p_user_id,
      case when v_is_founder then 'owner' else 'member' end,
      'active',
      true,
      case
        when v_is_founder then '["org.view","org.manage","users.view","users.manage"]'::jsonb
        else '["org.view"]'::jsonb
      end,
      now()
    )
    on conflict (organization_id, user_id) do nothing;

    -- SCHOOLS ARE NOT HANDED OUT HERE ANY MORE.
    --
    -- What this used to do: every newly provisioned non-founder was attached to
    -- The Academy FL — by hard-coded uuid, marked is_primary, in the same
    -- transaction that created their public.users row. Before any administrator
    -- had chosen anything. User Management would then add the campus that was
    -- actually selected, so the person ended up with both, and the FL row was
    -- the primary one, which is what every workspace header reads.
    --
    -- Nina Gaddy, 12 September: account created 13:05:00.400126 with FL
    -- attached in the same instant; GA added deliberately four seconds later.
    -- She was assigned to Georgia and could see Florida, and her Admissions
    -- header said "The Academy FL".
    --
    -- Access is not a default. Somebody with no assignment should see nothing
    -- and ask, which is a bad morning; somebody auto-assigned to a campus
    -- nobody granted them sees children's records they were never given, and
    -- nobody finds out. A provisioning trigger is the wrong place to decide
    -- that question, because it runs before the decision has been made.
    --
    -- So non-founders leave here with a role and no campus, and User Management
    -- grants exactly what was ticked.
    --
    -- FOUNDERS still receive every school in the organisation. That is a
    -- configured list of bootstrap emails, not a guess — it is the one case
    -- where the answer genuinely is "all of them". The primary flag now falls
    -- on the oldest school rather than on Florida specifically; no campus is
    -- named in this function any more.
    if v_is_founder then
      select s.id
      into v_primary_school_id
      from public.schools s
      where s.organization_id = v_org_id
      order by s.created_at nulls last, s.name
      limit 1;

      insert into public.user_schools (user_id, school_id)
      select p_user_id, s.id
      from public.schools s
      where s.organization_id = v_org_id
      on conflict (user_id, school_id) do nothing;

      insert into public.user_org_assignments (
        user_id,
        school_id,
        campus_id,
        program_id,
        department_id,
        all_campuses,
        all_programs,
        is_primary
      )
      select
        p_user_id,
        s.id,
        null,
        null,
        null,
        true,
        true,
        (s.id = v_primary_school_id)
      from public.schools s
      where s.organization_id = v_org_id
      on conflict (user_id, school_id, campus_id, program_id, department_id) do nothing;
    end if;

  end if;
end;
$$;

revoke all on function public.provision_auth_user(uuid, text, text, jsonb) from public;
grant execute on function public.provision_auth_user(uuid, text, text, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- 2) Nina Gaddy keeps Georgia and loses Florida.
--    Both tables. `can_access_school` accepts either, so half a removal is none.
-- -----------------------------------------------------------------------------

delete from public.user_schools us
using public.users u
where us.user_id = u.id
  and lower(u.email) = 'nina.gaddy@theacademyga.org'
  and us.school_id = 'a1000000-0000-4000-8000-000000000001';

delete from public.user_org_assignments uoa
using public.users u
where uoa.user_id = u.id
  and lower(u.email) = 'nina.gaddy@theacademyga.org'
  and uoa.school_id = 'a1000000-0000-4000-8000-000000000001';

-- Georgia becomes her primary, so her workspace header stops saying Florida.
update public.user_org_assignments uoa
set is_primary = true
from public.users u
where uoa.user_id = u.id
  and lower(u.email) = 'nina.gaddy@theacademyga.org'
  and uoa.school_id = 'a1000000-0000-4000-8000-000000000002';

-- -----------------------------------------------------------------------------
-- 3) VERIFICATION
-- -----------------------------------------------------------------------------

-- 3a. Nina. Expect exactly one row: The Academy GA, on both tables, primary.
select
  'nina after' as check,
  s.name as school,
  exists (
    select 1 from public.user_schools us
    where us.user_id = u.id and us.school_id = s.id
  ) as in_user_schools,
  uoa.is_primary
from public.users u
join public.user_org_assignments uoa on uoa.user_id = u.id
join public.schools s on s.id = uoa.school_id
where lower(u.email) = 'nina.gaddy@theacademyga.org'
order by s.name;

-- 3b. The function no longer names a campus. Expect false.
select
  'function still hard-codes a campus' as check,
  pg_get_functiondef(p.oid) like '%a1000000-0000-4000-8000-000000000001%' as still_hard_coded
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'provision_auth_user';

-- 3c. Everyone else the trigger gave a campus to. A row here means that campus
--     arrived with the account rather than from a decision — same transaction,
--     same microsecond. Read it as "check this one", not as "delete this one":
--     some of these people were later assigned that campus on purpose.
select
  u.full_name,
  u.email,
  s.name as school_attached_at_signup,
  u.created_at as account_created,
  us.created_at as school_attached,
  (
    select string_agg(sch.name, ', ' order by sch.name)
    from public.user_org_assignments a
    join public.schools sch on sch.id = a.school_id
    where a.user_id = u.id
  ) as all_schools_now,
  (
    select string_agg(r.name, ', ' order by r.name)
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = u.id
  ) as roles
from public.users u
join public.user_schools us on us.user_id = u.id
join public.schools s on s.id = us.school_id
-- Same transaction, within a two-second window rather than on exact equality.
-- The two columns are not guaranteed to be the same timestamp type, and an
-- equality test that silently coerces is how migration 344 matched nothing.
where abs(extract(epoch from (us.created_at::timestamp - u.created_at::timestamp))) < 2
  and not exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = u.id and r.name = 'FOUNDER'
  )
order by u.created_at desc;
