select
  ur.user_id,
  r.name as role_name
from public.user_roles ur
join public.roles r
  on r.id = ur.role_id
where ur.user_id = 'f8eec2be-1e6f-444a-945d-4356c9ee04ee';