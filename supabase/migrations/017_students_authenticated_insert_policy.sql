-- Any authenticated user may insert students

create policy "authenticated_insert_only"
on students
for insert
with check (auth.uid() is not null);
