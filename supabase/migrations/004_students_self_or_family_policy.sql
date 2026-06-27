-- Parents/guardians can read students linked via student_family_link

create policy "students_self_or_family"
on students
for select
using (
  exists (
    select 1 from student_family_link sfl
    where sfl.student_id = students.id
    and sfl.user_id = auth.uid()
  )
);
