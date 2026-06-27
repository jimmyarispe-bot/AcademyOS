-- Role check helper for RLS policies (uses auth.uid() + user_roles)

create or replace function has_role(role_name text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
    and r.name = role_name
  );
$$;
