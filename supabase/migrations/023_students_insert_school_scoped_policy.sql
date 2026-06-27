-- CEO: any valid school; school leader: assigned schools only (user_schools)

drop policy if exists "students_insert_scoped_to_school" on students;

create policy "students_insert_school_scoped"
on students
for insert
with check (
  exists (select 1 from schools where schools.id = students.school_id)
  and (
    has_role('CEO')
    or (
      has_role('SCHOOL_LEADER')
      and exists (
        select 1
        from user_schools us
        where us.user_id = auth.uid()
        and us.school_id = students.school_id
      )
    )
  )
);
