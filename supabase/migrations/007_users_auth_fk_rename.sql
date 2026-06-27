-- Align constraint name with users_auth_fk (replaces users_id_fkey from earlier 002)

alter table users drop constraint if exists users_id_fkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_auth_fk'
  ) then
    alter table users alter column id drop default;

    alter table users
    add constraint users_auth_fk
    foreign key (id)
    references auth.users(id)
    on delete cascade;
  end if;
end $$;
