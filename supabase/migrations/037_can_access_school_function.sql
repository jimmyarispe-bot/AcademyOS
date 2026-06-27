-- Unified school access: CEO, or assigned school leader / teacher

create or replace function can_access_school(school_id uuid)
returns boolean
language sql
stable
as $$
  select
    has_role('CEO')
    or (
      has_role('SCHOOL_LEADER')
      and is_assigned_to_school(school_id)
    )
    or (
      has_role('TEACHER')
      and is_assigned_to_school(school_id)
    );
$$;
