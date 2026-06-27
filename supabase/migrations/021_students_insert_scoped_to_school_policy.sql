-- Renamed insert policy: valid school_id required; CEO = any school

drop policy if exists "school_scoped_student_insert" on students;

create policy "students_insert_scoped_to_school"
on students
for insert
with check (
  exists (select 1 from schools s where s.id = school_id)
  and (
    has_role('CEO')
    or (
      has_role('SCHOOL_LEADER')
      and exists (select 1 from users u where u.id = auth.uid())
    )
  )
);
