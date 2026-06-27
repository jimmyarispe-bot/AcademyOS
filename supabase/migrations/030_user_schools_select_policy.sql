-- Users read own school assignments; CEO reads all

create policy "user_can_view_own_school_links"
on user_schools
for select
using (
  user_id = auth.uid()
  or has_role('CEO')
);
