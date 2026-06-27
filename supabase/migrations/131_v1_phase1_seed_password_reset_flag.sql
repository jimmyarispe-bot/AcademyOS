-- =========================================
-- V1.0 Phase 1: Seed account password reset requirement (B-17)
-- Flags development seed accounts to change password on first login.
-- =========================================

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('must_reset_password', true)
where lower(email) in ('jimmy@academyos.org', 'danni@academyos.org');

-- Ensure public.users mirror exists for seed accounts
insert into public.users (id, email, full_name)
select au.id, au.email, coalesce(au.raw_user_meta_data->>'full_name', au.email)
from auth.users au
where lower(au.email) in ('jimmy@academyos.org', 'danni@academyos.org')
on conflict (id) do nothing;
