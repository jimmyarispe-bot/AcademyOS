-- Authenticated users with a public.users profile can read schools

create policy "school_scoped_access"
on schools
for select
using (
  exists (
    select 1 from users u
    where u.id = auth.uid()
  )
);
