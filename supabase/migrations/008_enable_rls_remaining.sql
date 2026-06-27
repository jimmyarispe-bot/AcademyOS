-- RLS for tables added after original 003 (safe no-op if already enabled)

alter table school_settings enable row level security;
alter table roles enable row level security;
alter table user_roles enable row level security;
