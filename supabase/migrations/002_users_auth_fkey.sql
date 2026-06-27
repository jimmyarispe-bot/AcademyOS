-- Link public.users to Supabase Auth (auth.users)
-- IDs must match auth signup; random UUID defaults are no longer valid.

alter table users alter column id drop default;

alter table users
add constraint users_auth_fk
foreign key (id)
references auth.users(id)
on delete cascade;
