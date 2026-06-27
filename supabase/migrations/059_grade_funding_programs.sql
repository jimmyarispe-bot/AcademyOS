-- =========================================
-- GRADE DROPDOWNS + NORMALIZED FUNDING SOURCES (059)
-- Multi-select funding via junction tables; migrate legacy column.
-- Idempotent: safe to re-run after partial apply.
-- =========================================

-- ---------------------------------------------------------------------------
-- Funding source lookup + junction tables
-- ---------------------------------------------------------------------------

create table if not exists public.funding_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  sort_order int not null default 0
);

insert into public.funding_sources (code, label, sort_order) values
  ('parent_pay', 'Parent Pay', 1),
  ('family_scholarship', 'Family Scholarship', 2),
  ('school_scholarship', 'School Scholarship', 3),
  ('outside_scholarship', 'Outside Scholarship', 4),
  ('esa', 'ESA', 5),
  ('step_up_for_students', 'Step Up For Students', 6),
  ('mckay_scholarship', 'McKay Scholarship', 7),
  ('fes_ua', 'FES-UA', 8),
  ('district_placement', 'District Placement', 9),
  ('vocational_rehabilitation', 'Vocational Rehabilitation', 10),
  ('medicaid_waiver', 'Medicaid Waiver', 11),
  ('state_agency_placement', 'State Agency Placement', 12),
  ('grant_funded', 'Grant Funded', 13),
  ('corporate_sponsorship', 'Corporate Sponsorship', 14),
  ('other', 'Other', 15)
on conflict (code) do update set
  label = excluded.label,
  sort_order = excluded.sort_order;

create table if not exists public.admissions_lead_funding_sources (
  lead_id uuid not null references public.admissions_leads(id) on delete cascade,
  funding_source_id uuid not null references public.funding_sources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, funding_source_id)
);

create index if not exists idx_admissions_lead_funding_sources_lead
  on public.admissions_lead_funding_sources(lead_id);

create index if not exists idx_admissions_lead_funding_sources_source
  on public.admissions_lead_funding_sources(funding_source_id);

create table if not exists public.student_funding_sources (
  student_id uuid not null references public.students(id) on delete cascade,
  funding_source_id uuid not null references public.funding_sources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, funding_source_id)
);

create index if not exists idx_student_funding_sources_student
  on public.student_funding_sources(student_id);

create index if not exists idx_student_funding_sources_source
  on public.student_funding_sources(funding_source_id);

-- Migrate legacy admissions_leads.funding_source into junction table
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admissions_leads'
      and column_name = 'funding_source'
  ) then
    insert into public.admissions_lead_funding_sources (lead_id, funding_source_id)
    select
      al.id,
      fs.id
    from public.admissions_leads al
    join public.funding_sources fs on fs.code = case al.funding_source
      when 'private_pay' then 'parent_pay'
      when 'esa' then 'esa'
      when 'voucher' then 'step_up_for_students'
      when 'tax_credit_scholarship' then 'family_scholarship'
      when 'school_scholarship' then 'school_scholarship'
      else coalesce(al.funding_source, 'other')
    end
    where al.funding_source is not null
    on conflict do nothing;

    alter table public.admissions_leads drop constraint if exists admissions_leads_funding_source_check;
    alter table public.admissions_leads drop column if exists funding_source;
  end if;
end $$;

drop index if exists public.idx_admissions_leads_funding_source;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.funding_sources enable row level security;

drop policy if exists funding_sources_read on public.funding_sources;
create policy funding_sources_read
on public.funding_sources
for select
to authenticated
using (true);

alter table public.admissions_lead_funding_sources enable row level security;

drop policy if exists admissions_lead_funding_sources_staff_all on public.admissions_lead_funding_sources;
create policy admissions_lead_funding_sources_staff_all
on public.admissions_lead_funding_sources
for all
using (
  can_access_school((
    select school_id from public.admissions_leads where id = lead_id
  ))
)
with check (
  can_access_school((
    select school_id from public.admissions_leads where id = lead_id
  ))
);

alter table public.student_funding_sources enable row level security;

drop policy if exists student_funding_sources_staff_all on public.student_funding_sources;
create policy student_funding_sources_staff_all
on public.student_funding_sources
for all
using (
  can_access_school((
    select school_id from public.students where id = student_id
  ))
)
with check (
  can_access_school((
    select school_id from public.students where id = student_id
  ))
);

-- ---------------------------------------------------------------------------
-- API grants for new tables
-- ---------------------------------------------------------------------------

grant select on public.funding_sources to authenticated, anon;
grant select, insert, update, delete on public.admissions_lead_funding_sources to authenticated;
grant select, insert, update, delete on public.student_funding_sources to authenticated;
grant all on public.funding_sources to service_role;
grant all on public.admissions_lead_funding_sources to service_role;
grant all on public.student_funding_sources to service_role;

notify pgrst, 'reload schema';
