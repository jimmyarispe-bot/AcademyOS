-- School membership check for RLS (family, teacher, CEO, or school leader)

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
  or has_role('SCHOOL_LEADER');
$$;
