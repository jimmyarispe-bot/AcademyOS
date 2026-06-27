select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
grant select, insert, update, delete on public.prospects to authenticated;

grant select, insert, update, delete on public.prospect_guardians to authenticated;

grant select, insert, update, delete on public.admissions_applications to authenticated;

grant select, insert, update, delete on public.application_documents to authenticated;

grant select, insert, update, delete on public.scholarship_applications to authenticated;

grant select, insert, update, delete on public.scholarship_documents to authenticated;

grant select, insert, update, delete on public.admissions_notes to authenticated;

grant select, insert, update, delete on public.admissions_tasks to authenticated;