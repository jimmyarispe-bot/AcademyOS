-- Replace open authenticated insert with CEO / school leader only

drop policy if exists "authenticated_insert_only" on students;

create policy "school_leader_or_ceo_can_create_students"
on students
for insert
with check (
  has_role('CEO')
  or has_role('SCHOOL_LEADER')
);
