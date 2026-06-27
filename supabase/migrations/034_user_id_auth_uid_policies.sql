-- Self-read policies required for has_role() and family-link subqueries

create policy "user_can_view_own_roles"
on user_roles
for select
using (
  user_id = auth.uid()
  or has_role('CEO')
);

create policy "user_can_view_own_family_links"
on student_family_link
for select
using (
  user_id = auth.uid()
  or has_role('CEO')
);
