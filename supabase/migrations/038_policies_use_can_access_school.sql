-- Use can_access_school(school_id) in student and class policies

drop policy if exists "class_access" on classes;

create policy "class_access"
on classes
for select
using (
  can_access_school(school_id)
  or teacher_id = auth.uid()
);

drop policy if exists "students_insert_school_scoped" on students;

create policy "students_insert_school_scoped"
on students
for insert
with check (
  exists (select 1 from schools s where s.id = school_id)
  and can_access_school(school_id)
);

drop policy if exists "students_select_school_scoped" on students;

create policy "students_select_school_scoped"
on students
for select
using (
  can_access_school(school_id)
  or exists (
    select 1
    from student_family_link sfl
    where sfl.student_id = students.id
    and sfl.user_id = auth.uid()
  )
);
