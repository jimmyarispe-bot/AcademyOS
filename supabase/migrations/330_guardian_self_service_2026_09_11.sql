-- 330_guardian_self_service_2026_09_11.sql
--
-- Let a parent see their own record.
--
-- WHY. `guardians` carries exactly one policy — `guardians_staff_all`, keyed on
-- `can_access_school(school_id_for_family(family_id))`. Staff can see every
-- guardian at a school they can access. A parent can see nothing, including
-- themselves. The go-live email asking families to check their details in JAG
-- would land on a page that, even after its other bugs are fixed, cannot read
-- the row it is asking them to correct.
--
-- WHAT THIS GRANTS, AND WHAT IT DOES NOT. Select only, and only on the row
-- whose `user_id` is the signed-in user. There is deliberately no update
-- policy.
--
-- Row-level security secures ROWS, not COLUMNS. An update policy scoped to
-- "your own row" would also permit a parent, working through the API rather
-- than the page, to set `receives_billing`, `financial_responsibility_percent`,
-- `custody_status` or `legal_restrictions` on that row. Those are financial and
-- legal facts about a family, and they belong to the school. So writes go
-- through a server action that locates the row by session user, never by an id
-- supplied by the caller, and sets four fields: first name, last name, email,
-- phone. Column control lives in one place and it is readable.
--
-- NOTE ON WHAT THIS DOES NOT YET MAKE POSSIBLE. Parents have no accounts — the
-- `users` table holds five rows, all staff — and every guardian row has a null
-- `user_id`, including the 77 created from billing data. This policy matches
-- nothing today. It is the third of four links in the chain, and the remaining
-- one is parent account invitations.
--
-- Safe to re-run.

drop policy if exists guardians_self_select on public.guardians;

create policy guardians_self_select
on public.guardians
for select
using (user_id = auth.uid());

comment on policy guardians_self_select on public.guardians is
  'A signed-in guardian may read their own row. Select only: writes go through a server action that restricts which columns may change, because RLS cannot.';

-- How many guardians could ever use this, which is the honest measure of
-- whether parent self-service is reachable yet.
select
  count(*)                                              as guardians,
  count(user_id)                                        as linked_to_an_account,
  count(*) filter (
    where communication_preferences ->> 'needs_confirmation' = 'true'
  )                                                     as awaiting_confirmation
from public.guardians;
