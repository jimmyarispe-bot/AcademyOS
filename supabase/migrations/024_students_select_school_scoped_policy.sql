-- School-scoped student read (replaces student_access_family_or_staff)

drop policy if exists "student_access_family_or_staff" on students;

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
