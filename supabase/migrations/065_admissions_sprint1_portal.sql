-- =========================================
-- ADMISSIONS SPRINT 1: PARENT PORTAL
-- Application fields, state funding verification,
-- document metadata, guardian write policies,
-- public inquiry RPC, storage bucket, acceptance helper
-- Idempotent: safe to re-run
-- =========================================

-- ---------------------------------------------------------------------------
-- Application portal fields
-- ---------------------------------------------------------------------------

alter table public.admissions_applications
  add column if not exists previous_school text;

alter table public.admissions_applications
  add column if not exists emergency_contact_name text;

alter table public.admissions_applications
  add column if not exists emergency_contact_phone text;

alter table public.admissions_applications
  add column if not exists learning_needs_summary text;

alter table public.admissions_applications
  add column if not exists submitted_at timestamptz;

alter table public.application_documents
  add column if not exists mime_type text;

alter table public.application_documents
  add column if not exists file_size_bytes bigint
    check (file_size_bytes is null or file_size_bytes >= 0);

alter table public.application_documents
  add column if not exists document_status text not null default 'uploaded'
    check (document_status in ('uploaded', 'under_review', 'approved', 'rejected'));

-- ---------------------------------------------------------------------------
-- State funding verification
-- ---------------------------------------------------------------------------

create table if not exists public.state_funding_verifications (
  id uuid primary key default gen_random_uuid(),

  application_id uuid not null
    references public.admissions_applications(id) on delete cascade,

  funding_source_code text not null,

  state_program_id text,

  verification_status text not null default 'pending'
    check (
      verification_status in (
        'pending',
        'documents_submitted',
        'under_review',
        'verified',
        'rejected'
      )
    ),

  verified_by_user_id uuid
    references public.users(id) on delete set null,

  verified_at timestamptz,
  rejection_reason text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint state_funding_verifications_application_source_unique
    unique (application_id, funding_source_code)
);

create index if not exists idx_state_funding_verifications_application_id
  on public.state_funding_verifications(application_id);

create index if not exists idx_state_funding_verifications_status
  on public.state_funding_verifications(verification_status);

drop trigger if exists state_funding_verifications_set_updated_at
  on public.state_funding_verifications;

create trigger state_funding_verifications_set_updated_at
  before update on public.state_funding_verifications
  for each row
  execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage bucket for admissions documents
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admissions-documents',
  'admissions-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Public inquiry RPC (anon-safe insert)
-- ---------------------------------------------------------------------------

create or replace function public.submit_public_admissions_inquiry(
  p_school_id uuid,
  p_first_name text,
  p_last_name text,
  p_preferred_name text,
  p_date_of_birth date,
  p_current_grade text,
  p_applying_for_grade text,
  p_program text,
  p_referral_source text,
  p_guardian_first_name text,
  p_guardian_last_name text,
  p_guardian_email text,
  p_guardian_phone text,
  p_funding_source_codes text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_funding_id uuid;
  v_code text;
begin
  if p_school_id is null then
    raise exception 'school_id is required';
  end if;

  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then
    raise exception 'Student first and last name are required';
  end if;

  if coalesce(trim(p_guardian_email), '') = '' then
    raise exception 'Guardian email is required';
  end if;

  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'Invalid school';
  end if;

  insert into public.admissions_leads (
    school_id,
    first_name,
    last_name,
    preferred_name,
    date_of_birth,
    current_grade,
    applying_for_grade,
    program,
    referral_source,
    guardian_first_name,
    guardian_last_name,
    guardian_email,
    guardian_phone,
    lead_stage
  )
  values (
    p_school_id,
    trim(p_first_name),
    trim(p_last_name),
    nullif(trim(p_preferred_name), ''),
    p_date_of_birth,
    nullif(trim(p_current_grade), ''),
    nullif(trim(p_applying_for_grade), ''),
    nullif(trim(p_program), ''),
    nullif(trim(p_referral_source), ''),
    nullif(trim(p_guardian_first_name), ''),
    nullif(trim(p_guardian_last_name), ''),
    lower(trim(p_guardian_email)),
    nullif(trim(p_guardian_phone), ''),
    'new_inquiry'
  )
  returning id into v_lead_id;

  insert into public.admissions_lead_guardians (
    lead_id,
    first_name,
    last_name,
    email,
    phone,
    primary_guardian,
    receives_billing,
    receives_school_communications
  )
  values (
    v_lead_id,
    coalesce(nullif(trim(p_guardian_first_name), ''), 'Guardian'),
    coalesce(nullif(trim(p_guardian_last_name), ''), 'Contact'),
    lower(trim(p_guardian_email)),
    nullif(trim(p_guardian_phone), ''),
    true,
    true,
    true
  );

  foreach v_code in array coalesce(p_funding_source_codes, '{}'::text[])
  loop
    select id into v_funding_id
    from public.funding_sources
    where code = v_code;

    if v_funding_id is not null then
      insert into public.admissions_lead_funding_sources (lead_id, funding_source_id)
      values (v_lead_id, v_funding_id)
      on conflict do nothing;
    end if;
  end loop;

  insert into public.admissions_lead_stage_history (
    lead_id,
    previous_stage,
    new_stage,
    changed_by,
    changed_at
  )
  values (
    v_lead_id,
    null,
    'new_inquiry',
    null,
    now()
  );

  return v_lead_id;
end;
$$;

grant execute on function public.submit_public_admissions_inquiry(
  uuid, text, text, text, date, text, text, text, text, text, text, text, text, text[]
) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Ensure state funding rows exist for an application
-- ---------------------------------------------------------------------------

create or replace function public.ensure_state_funding_verifications(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_code text;
begin
  select aa.lead_id into v_lead_id
  from public.admissions_applications aa
  where aa.id = p_application_id;

  if v_lead_id is null then
    raise exception 'Application not found';
  end if;

  for v_code in
    select fs.code
    from public.admissions_lead_funding_sources alfs
    join public.funding_sources fs on fs.id = alfs.funding_source_id
    where alfs.lead_id = v_lead_id
      and fs.funding_source_category = 'state_funding'
  loop
    insert into public.state_funding_verifications (
      application_id,
      funding_source_code,
      verification_status
    )
    values (p_application_id, v_code, 'pending')
    on conflict (application_id, funding_source_code) do nothing;
  end loop;
end;
$$;

grant execute on function public.ensure_state_funding_verifications(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: state funding verifications
-- ---------------------------------------------------------------------------

alter table public.state_funding_verifications enable row level security;

drop policy if exists state_funding_verifications_staff_all
  on public.state_funding_verifications;

create policy state_funding_verifications_staff_all
on public.state_funding_verifications
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

drop policy if exists state_funding_verifications_guardian_select
  on public.state_funding_verifications;

create policy state_funding_verifications_guardian_select
on public.state_funding_verifications
for select
using (
  exists (
    select 1
    from public.admissions_applications aa
    where aa.id = state_funding_verifications.application_id
      and is_guardian_of_lead(aa.lead_id)
  )
);

drop policy if exists state_funding_verifications_guardian_update
  on public.state_funding_verifications;

create policy state_funding_verifications_guardian_update
on public.state_funding_verifications
for update
using (
  exists (
    select 1
    from public.admissions_applications aa
    where aa.id = state_funding_verifications.application_id
      and is_guardian_of_lead(aa.lead_id)
  )
)
with check (
  exists (
    select 1
    from public.admissions_applications aa
    where aa.id = state_funding_verifications.application_id
      and is_guardian_of_lead(aa.lead_id)
  )
);

-- ---------------------------------------------------------------------------
-- RLS: guardian write on applications + documents + scholarships
-- ---------------------------------------------------------------------------

drop policy if exists admissions_applications_guardian_insert
  on public.admissions_applications;

create policy admissions_applications_guardian_insert
on public.admissions_applications
for insert
with check (is_guardian_of_lead(lead_id));

drop policy if exists admissions_applications_guardian_update
  on public.admissions_applications;

create policy admissions_applications_guardian_update
on public.admissions_applications
for update
using (is_guardian_of_lead(lead_id))
with check (is_guardian_of_lead(lead_id));

drop policy if exists application_documents_guardian_insert
  on public.application_documents;

create policy application_documents_guardian_insert
on public.application_documents
for insert
with check (
  exists (
    select 1
    from public.admissions_applications aa
    where aa.id = application_documents.application_id
      and is_guardian_of_lead(aa.lead_id)
  )
);

drop policy if exists application_documents_guardian_delete
  on public.application_documents;

create policy application_documents_guardian_delete
on public.application_documents
for delete
using (
  exists (
    select 1
    from public.admissions_applications aa
    where aa.id = application_documents.application_id
      and is_guardian_of_lead(aa.lead_id)
  )
);

drop policy if exists scholarship_applications_guardian_insert
  on public.scholarship_applications;

create policy scholarship_applications_guardian_insert
on public.scholarship_applications
for insert
with check (
  exists (
    select 1
    from public.admissions_applications aa
    where aa.id = scholarship_applications.application_id
      and is_guardian_of_lead(aa.lead_id)
  )
);

drop policy if exists scholarship_applications_guardian_update
  on public.scholarship_applications;

create policy scholarship_applications_guardian_update
on public.scholarship_applications
for update
using (
  exists (
    select 1
    from public.admissions_applications aa
    where aa.id = scholarship_applications.application_id
      and is_guardian_of_lead(aa.lead_id)
  )
)
with check (
  exists (
    select 1
    from public.admissions_applications aa
    where aa.id = scholarship_applications.application_id
      and is_guardian_of_lead(aa.lead_id)
  )
);

drop policy if exists scholarship_documents_guardian_insert
  on public.scholarship_documents;

create policy scholarship_documents_guardian_insert
on public.scholarship_documents
for insert
with check (
  exists (
    select 1
    from public.scholarship_applications sa
    join public.admissions_applications aa on aa.id = sa.application_id
    where sa.id = scholarship_documents.scholarship_application_id
      and is_guardian_of_lead(aa.lead_id)
  )
);

drop policy if exists scholarship_documents_guardian_delete
  on public.scholarship_documents;

create policy scholarship_documents_guardian_delete
on public.scholarship_documents
for delete
using (
  exists (
    select 1
    from public.scholarship_applications sa
    join public.admissions_applications aa on aa.id = sa.application_id
    where sa.id = scholarship_documents.scholarship_application_id
      and is_guardian_of_lead(aa.lead_id)
  )
);

drop policy if exists admissions_lead_guardians_guardian_insert
  on public.admissions_lead_guardians;

create policy admissions_lead_guardians_guardian_insert
on public.admissions_lead_guardians
for insert
with check (is_guardian_of_lead(lead_id));

-- ---------------------------------------------------------------------------
-- Storage policies (admissions-documents bucket)
-- ---------------------------------------------------------------------------

drop policy if exists admissions_documents_staff_all on storage.objects;

create policy admissions_documents_staff_all
on storage.objects
for all
to authenticated
using (
  bucket_id = 'admissions-documents'
  and can_access_school(
    (
      select al.school_id
      from public.admissions_applications aa
      join public.admissions_leads al on al.id = aa.lead_id
      where aa.id::text = (storage.foldername(name))[1]
    )
  )
)
with check (
  bucket_id = 'admissions-documents'
  and can_access_school(
    (
      select al.school_id
      from public.admissions_applications aa
      join public.admissions_leads al on al.id = aa.lead_id
      where aa.id::text = (storage.foldername(name))[1]
    )
  )
);

drop policy if exists admissions_documents_guardian_rw on storage.objects;

create policy admissions_documents_guardian_rw
on storage.objects
for all
to authenticated
using (
  bucket_id = 'admissions-documents'
  and exists (
    select 1
    from public.admissions_applications aa
    where aa.id::text = (storage.foldername(name))[1]
      and is_guardian_of_lead(aa.lead_id)
  )
)
with check (
  bucket_id = 'admissions-documents'
  and exists (
    select 1
    from public.admissions_applications aa
    where aa.id::text = (storage.foldername(name))[1]
      and is_guardian_of_lead(aa.lead_id)
  )
);

grant select, insert, update, delete on table public.state_funding_verifications to authenticated;
grant all on table public.state_funding_verifications to service_role;

notify pgrst, 'reload schema';
