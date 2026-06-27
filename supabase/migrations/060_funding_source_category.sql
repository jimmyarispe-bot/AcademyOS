-- =========================================
-- FUNDING SOURCE CATEGORY (060)
-- Adds funding_source_category for grouped reporting.
-- Idempotent: safe to re-run after partial apply.
-- =========================================

alter table public.funding_sources
  add column if not exists funding_source_category text;

update public.funding_sources set funding_source_category = case code
  when 'parent_pay' then 'parent'
  when 'family_scholarship' then 'scholarship'
  when 'school_scholarship' then 'scholarship'
  when 'outside_scholarship' then 'scholarship'
  when 'esa' then 'state_funding'
  when 'step_up_for_students' then 'state_funding'
  when 'mckay_scholarship' then 'state_funding'
  when 'fes_ua' then 'state_funding'
  when 'district_placement' then 'public_placement'
  when 'vocational_rehabilitation' then 'government_program'
  when 'medicaid_waiver' then 'government_program'
  when 'state_agency_placement' then 'government_program'
  when 'grant_funded' then 'scholarship'
  when 'corporate_sponsorship' then 'corporate'
  when 'other' then 'other'
  else 'other'
end
where funding_source_category is null;

alter table public.funding_sources
  alter column funding_source_category set not null;

alter table public.funding_sources
  drop constraint if exists funding_sources_category_check;

alter table public.funding_sources
  add constraint funding_sources_category_check
  check (funding_source_category in (
    'parent',
    'scholarship',
    'state_funding',
    'public_placement',
    'government_program',
    'corporate',
    'other'
  ));

create index if not exists idx_funding_sources_category
  on public.funding_sources(funding_source_category);

notify pgrst, 'reload schema';
