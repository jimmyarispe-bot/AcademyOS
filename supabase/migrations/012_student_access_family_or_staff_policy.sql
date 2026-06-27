-- Student read access for staff, family, and teachers (replaces students_self_or_family)

drop policy if exists "students_self_or_family" on students;

create policy "student_access_family_or_staff"
on students
for select
using (
  has_role('CEO')
  or has_role('SCHOOL_LEADER')
  or exists (
    select 1 from student_family_link sfl
    where sfl.student_id = students.id
    and sfl.user_id = auth.uid()
  )
  or exists (
    select 1 from classes c
    where c.school_id = students.school_id
    and c.teacher_id = auth.uid()
  )
);
