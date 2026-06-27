-- =========================================
-- SPRINT 2: ADMISSIONS RLS
-- AcademyOS — row level security for admissions tables
-- Idempotent: safe to re-run after partial apply
-- =========================================
-- RBAC chain (Phase 1):
--   auth.uid() → has_role() → can_access_school()
-- =========================================

-- -----------------------------------------
-- Helper functions
-- -----------------------------------------

create or replace function public.school_id_for_prospect(p_prospect_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select school_id
  from public.prospects
  where id = p_prospect_id;
$$;

create or replace function public.school_id_for_admissions_application(p_application_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select p.school_id
  from public.admissions_applications aa
  join public.prospects p on p.id = aa.prospect_id
  where aa.id = p_application_id;
$$;

create or replace function public.is_guardian_of_prospect(p_prospect_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.prospect_guardians pg
    join public.users u on u.id = auth.uid()
    where pg.prospect_id = p_prospect_id
      and pg.email is not null
      and lower(pg.email) = lower(u.email)
  );
$$;

-- -----------------------------------------
-- Enable RLS
-- -----------------------------------------

alter table public.prospects enable row level security;
alter table public.prospect_guardians enable row level security;
alter table public.admissions_applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.scholarship_applications enable row level security;
alter table public.scholarship_documents enable row level security;
alter table public.admissions_notes enable row level security;
alter table public.admissions_tasks enable row level security;

-- =========================================
-- PROSPECTS
-- =========================================

drop policy if exists prospects_staff_all on public.prospects;

create policy prospects_staff_all
on public.prospects
for all
using (can_access_school(school_id))
with check (can_access_school(school_id));

drop policy if exists prospects_guardian_select on public.prospects;

create policy prospects_guardian_select
on public.prospects
for select
using (is_guardian_of_prospect(id));

-- =========================================
-- PROSPECT GUARDIANS
-- =========================================

drop policy if exists prospect_guardians_staff_all on public.prospect_guardians;

create policy prospect_guardians_staff_all
on public.prospect_guardians
for all
using (can_access_school(school_id_for_prospect(prospect_id)))
with check (can_access_school(school_id_for_prospect(prospect_id)));

drop policy if exists prospect_guardians_guardian_select on public.prospect_guardians;

create policy prospect_guardians_guardian_select
on public.prospect_guardians
for select
using (is_guardian_of_prospect(prospect_id));

-- =========================================
-- ADMISSIONS APPLICATIONS
-- =========================================

drop policy if exists admin_full_access on public.admissions_applications;

create policy admin_full_access
on public.admissions_applications
for all
using (can_access_school(school_id_for_prospect(prospect_id)))
with check (can_access_school(school_id_for_prospect(prospect_id)));

drop policy if exists guardian_own_prospect_access on public.admissions_applications;

create policy guardian_own_prospect_access
on public.admissions_applications
for select
using (is_guardian_of_prospect(prospect_id));

-- =========================================
-- APPLICATION DOCUMENTS
-- =========================================

drop policy if exists application_documents_staff_all on public.application_documents;

create policy application_documents_staff_all
on public.application_documents
for all
using (
  can_access_school(
    school_id_for_admissions_application(application_id)
  )
)
with check (
  can_access_school(
    school_id_for_admissions_application(application_id)
  )
);

drop policy if exists application_documents_guardian_select on public.application_documents;

create policy application_documents_guardian_select
on public.application_documents
for select
using (
  exists (
    select 1
    from public.admissions_applications aa
    where aa.id = application_documents.application_id
      and is_guardian_of_prospect(aa.prospect_id)
  )
);

-- =========================================
-- SCHOLARSHIP APPLICATIONS
-- =========================================

drop policy if exists scholarship_applications_staff_all on public.scholarship_applications;

create policy scholarship_applications_staff_all
on public.scholarship_applications
for all
using (
  can_access_school(
    school_id_for_admissions_application(application_id)
  )
)
with check (
  can_access_school(
    school_id_for_admissions_application(application_id)
  )
);

drop policy if exists scholarship_applications_guardian_select on public.scholarship_applications;

create policy scholarship_applications_guardian_select
on public.scholarship_applications
for select
using (
  exists (
    select 1
    from public.admissions_applications aa
    where aa.id = scholarship_applications.application_id
      and is_guardian_of_prospect(aa.prospect_id)
  )
);

-- =========================================
-- SCHOLARSHIP DOCUMENTS
-- =========================================

drop policy if exists scholarship_documents_staff_all on public.scholarship_documents;

create policy scholarship_documents_staff_all
on public.scholarship_documents
for all
using (
  can_access_school(
    school_id_for_admissions_application(
      (
        select sa.application_id
        from public.scholarship_applications sa
        where sa.id = scholarship_documents.scholarship_application_id
      )
    )
  )
)
with check (
  can_access_school(
    school_id_for_admissions_application(
      (
        select sa.application_id
        from public.scholarship_applications sa
        where sa.id = scholarship_documents.scholarship_application_id
      )
    )
  )
);

drop policy if exists scholarship_documents_guardian_select on public.scholarship_documents;

create policy scholarship_documents_guardian_select
on public.scholarship_documents
for select
using (
  exists (
    select 1
    from public.scholarship_applications sa
    join public.admissions_applications aa on aa.id = sa.application_id
    where sa.id = scholarship_documents.scholarship_application_id
      and is_guardian_of_prospect(aa.prospect_id)
  )
);

-- =========================================
-- ADMISSIONS NOTES (staff only)
-- =========================================

drop policy if exists admissions_notes_staff_all on public.admissions_notes;

create policy admissions_notes_staff_all
on public.admissions_notes
for all
using (can_access_school(school_id_for_prospect(prospect_id)))
with check (can_access_school(school_id_for_prospect(prospect_id)));

-- =========================================
-- ADMISSIONS TASKS (staff only)
-- =========================================

drop policy if exists admissions_tasks_staff_all on public.admissions_tasks;

create policy admissions_tasks_staff_all
on public.admissions_tasks
for all
using (can_access_school(school_id_for_prospect(prospect_id)))
with check (can_access_school(school_id_for_prospect(prospect_id)));
