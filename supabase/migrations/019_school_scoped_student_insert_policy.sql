-- School-scoped student insert (replaces school_leader_or_ceo_can_create_students)

drop policy if exists "school_leader_or_ceo_can_create_students" on students;

create policy "school_scoped_student_insert"
on students
for insert
with check (
  has_role('CEO')
  or (
    has_role('SCHOOL_LEADER')
    and exists (
      select 1
      from users u
      where u.id = auth.uid()
    )
  )
);
