-- CEO-only insert, update, delete on user_schools (select still via user_schools_select)

create policy "user_schools_manage_ceo_only"
on user_schools
for all
using (has_role('CEO'))
with check (has_role('CEO'));
