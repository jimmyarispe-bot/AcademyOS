-- Use is_assigned_to_school() instead of inline user_schools exists

drop policy if exists "students_insert_school_scoped" on students;

create policy "students_insert_school_scoped"
on students
for insert
with check (
  exists (select 1 from schools s where s.id = students.school_id)
  and (
    has_role('CEO')
    or (
      has_role('SCHOOL_LEADER')
      and is_assigned_to_school(students.school_id)
    )
  )
);

drop policy if exists "students_select_school_scoped" on students;

create policy "students_select_school_scoped"
on students
for select
using (
  has_role('CEO')
  or (
    has_role('SCHOOL_LEADER')
    and is_assigned_to_school(students.school_id)
  )
  or exists (
    select 1
    from student_family_link sfl
    where sfl.student_id = students.id
    and sfl.user_id = auth.uid()
  )
);
