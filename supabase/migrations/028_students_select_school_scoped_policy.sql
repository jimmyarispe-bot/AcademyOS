-- Student read: CEO, assigned school leader, or linked family

drop policy if exists "students_select_school_scoped" on students;

create policy "students_select_school_scoped"
on students
for select
using (
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
  or exists (
    select 1
    from student_family_link sfl
    where sfl.student_id = students.id
    and sfl.user_id = auth.uid()
  )
);
