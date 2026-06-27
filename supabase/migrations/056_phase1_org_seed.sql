-- =========================================
-- PHASE 1: ORGANIZATION SEED DATA
-- Academy schools, campuses, leadership
-- Idempotent: safe to re-run after partial apply
-- =========================================

-- Schools
insert into public.schools (id, name, address, timezone)
values
  ('a1000000-0000-4000-8000-000000000001', 'Academy FL', 'Florida, USA', 'America/New_York'),
  ('a1000000-0000-4000-8000-000000000002', 'Academy GA', 'Georgia, USA', 'America/New_York'),
  ('a1000000-0000-4000-8000-000000000003', 'Academy HS', 'Global', 'America/New_York'),
  ('a1000000-0000-4000-8000-000000000004', 'Academy Virtual', 'Global', 'America/New_York')
on conflict (id) do nothing;

-- School years (year-round and traditional)
insert into public.school_years (id, school_id, name, start_date, end_date, is_current, status)
values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2025-2026 Year-Round', '2025-07-01', '2026-06-30', true, 'active'),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', '2025-2026 Year-Round', '2025-07-01', '2026-06-30', true, 'active'),
  ('b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', '2025-2026 Traditional', '2025-08-15', '2026-06-01', true, 'active'),
  ('b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000004', '2025-2026 Year-Round', '2025-07-01', '2026-06-30', true, 'active')
on conflict (id) do nothing;

-- Campuses
insert into public.campuses (id, school_id, name, code, is_primary, status)
values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Academy FL Campus', 'FL-CAMPUS', true, 'active'),
  ('c1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Academy FL Virtual', 'FL-VIRTUAL', false, 'active'),
  ('c1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002', 'Academy GA Campus', 'GA-CAMPUS', true, 'active'),
  ('c1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000002', 'Academy GA Hybrid', 'GA-HYBRID', false, 'active'),
  ('c1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000003', 'Academy HS Global', 'HS-GLOBAL', true, 'active'),
  ('c1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000004', 'Academy Virtual Global', 'VIRT-GLOBAL', true, 'active')
on conflict (id) do nothing;

-- Leadership auth accounts (idempotent by email).
-- Creates auth.users + auth.identities only when the email is not already registered.
-- Existing production auth accounts are never modified or replaced.
do $$
declare
  seed record;
  v_user_id uuid;
begin
  for seed in
    select *
    from (
      values
        ('jimmy@academyos.org', 'Jimmy Arispe'),
        ('danni@academyos.org', 'Danni Treu')
    ) as leadership(email, full_name)
  loop
    select au.id
    into v_user_id
    from auth.users au
    where lower(au.email) = lower(seed.email);

    if v_user_id is null then
      v_user_id := gen_random_uuid();

      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      )
      values (
        '00000000-0000-0000-0000-000000000000',
        v_user_id,
        'authenticated',
        'authenticated',
        lower(seed.email),
        extensions.crypt('AcademyOS-Seed-ChangeMe!', extensions.gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', seed.full_name),
        now(),
        now(),
        '',
        '',
        '',
        ''
      );

      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      values (
        v_user_id,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(seed.email)),
        'email',
        v_user_id::text,
        now(),
        now(),
        now()
      );
    elsif not exists (
      select 1
      from auth.identities i
      where i.user_id = v_user_id
        and i.provider = 'email'
    ) then
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      values (
        v_user_id,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(seed.email)),
        'email',
        v_user_id::text,
        now(),
        now(),
        now()
      );
    end if;
  end loop;
end $$;

-- Leadership profiles: public.users.id must match auth.users.id (users_auth_fk).
-- Sync from auth.users by email; never insert synthetic profile UUIDs.
insert into public.users (id, email, full_name)
select
  au.id,
  lower(au.email),
  seed.full_name
from (
  values
    ('jimmy@academyos.org', 'Jimmy Arispe'),
    ('danni@academyos.org', 'Danni Treu')
) as seed(email, full_name)
inner join auth.users au
  on lower(au.email) = lower(seed.email)
on conflict (id) do update
  set full_name = excluded.full_name;

-- Jimmy Arispe (Founder): SCHOOL_LEADER across all schools
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.users u
cross join public.roles r
where lower(u.email) = 'jimmy@academyos.org'
  and r.name = 'SCHOOL_LEADER'
on conflict do nothing;

-- Danni Treu (CEO)
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.users u
cross join public.roles r
where lower(u.email) = 'danni@academyos.org'
  and r.name = 'CEO'
on conflict do nothing;

-- School assignments for leadership (only when profile exists)
insert into public.user_schools (user_id, school_id)
select u.id, s.id
from public.users u
cross join public.schools s
where lower(u.email) in ('jimmy@academyos.org', 'danni@academyos.org')
on conflict do nothing;

-- Default tuition plans
insert into public.tuition_plans (school_id, name, program, annual_amount, payment_schedule, status)
select s.id, 'Standard Tuition — ' || s.name, null, 12000.00, 'monthly', 'active'
from public.schools s
where not exists (
  select 1 from public.tuition_plans tp where tp.school_id = s.id
);

-- Default HR positions
insert into public.positions (school_id, title, department, employment_type)
select s.id, 'Chief Executive Officer', 'Executive', 'full_time'
from public.schools s
where s.name = 'Academy FL'
  and not exists (
    select 1 from public.positions p
    where p.school_id = s.id and p.title = 'Chief Executive Officer'
  );

insert into public.positions (school_id, title, department, employment_type)
select s.id, title, dept, 'full_time'
from public.schools s
cross join (
  values
    ('Teacher', 'Instruction'),
    ('Admissions Coordinator', 'Admissions'),
    ('Finance Manager', 'Finance')
) as roles(title, dept)
where not exists (
  select 1 from public.positions p
  where p.school_id = s.id and p.title = roles.title
);
