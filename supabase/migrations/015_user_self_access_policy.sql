-- Users can read own profile; CEO and school leaders can read all users

create policy "user_self_access"
on users
for select
using (
  id = auth.uid()
  or has_role('CEO')
  or has_role('SCHOOL_LEADER')
);
