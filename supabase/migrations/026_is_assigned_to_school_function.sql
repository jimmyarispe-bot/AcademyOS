-- Reusable school assignment check via user_schools

create or replace function is_assigned_to_school(school uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from user_schools us
    where us.user_id = auth.uid()
    and us.school_id = school
  );
$$;

-- Align is_school_member: school leaders scoped to assigned schools

create or replace function is_school_member(school uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from students s
    where s.school_id = school
    and exists (
      select 1
      from student_family_link sfl
      where sfl.student_id = s.id
      and sfl.user_id = auth.uid()
    )
  )
  or exists (
    select 1
    from classes c
    where c.school_id = school
    and c.teacher_id = auth.uid()
  )
  or has_role('CEO')
  or (
    has_role('SCHOOL_LEADER')
    and is_assigned_to_school(school)
  );
$$;

-- school_access: remove blanket school-leader read (handled by is_school_member)

drop policy if exists "school_access" on schools;

create policy "school_access"
on schools
for select
using (
  has_role('CEO')
  or is_school_member(id)
);

-- students policies: use is_assigned_to_school helper

drop policy if exists "students_insert_school_scoped" on students;

create policy "students_insert_school_scoped"
on students
for insert
with check (
  exists (select 1 from schools where schools.id = students.school_id)
  and (
    has_role('CEO')
    or (
      has_role('SCHOOL_LEADER')
      and exists (select 1 from users u where u.id = auth.uid())
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
    and exists (select 1 from users u where u.id = auth.uid())
    and is_assigned_to_school(students.school_id)
  )
  or exists (
    select 1
    from student_family_link sfl
    where sfl.student_id = students.id
    and sfl.user_id = auth.uid()
  )
);
