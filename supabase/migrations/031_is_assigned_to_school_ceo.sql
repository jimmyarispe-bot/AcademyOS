-- School assignment check; CEO passes for any school
-- Must drop first: PostgreSQL cannot rename parameters via CREATE OR REPLACE

drop function if exists is_assigned_to_school(uuid);

create function is_assigned_to_school(school_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from user_schools us
    where us.user_id = auth.uid()
    and us.school_id = is_assigned_to_school.school_id
  )
  or has_role('CEO');
$$;