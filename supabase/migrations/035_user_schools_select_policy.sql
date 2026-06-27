-- Renamed user_schools read policy

drop policy if exists "user_can_view_own_school_links" on user_schools;

create policy "user_schools_select"
on user_schools
for select
using (
  user_id = auth.uid()
  or has_role('CEO')
);
