-- Assign users (e.g. school leaders) to schools

create table user_schools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  created_at timestamp default now(),
  unique (user_id, school_id)
);

create index idx_user_schools_user_id on user_schools(user_id);
create index idx_user_schools_school_id on user_schools(school_id);
