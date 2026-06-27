-- Enrollment read access for CEO, teachers, and linked family

create policy "enrollment_access"
on enrollments
for select
using (
  has_role('CEO')
  or exists (
    select 1 from classes c
    where c.id = enrollments.class_id
    and c.teacher_id = auth.uid()
  )
  or exists (
    select 1 from student_family_link sfl
    where sfl.student_id = enrollments.student_id
    and sfl.user_id = auth.uid()
  )
);
