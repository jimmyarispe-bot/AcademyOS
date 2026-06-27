-- =========================================
-- ADMISSIONS SPRINT 1.5: COMPLETION FOUNDATION
-- Checklist engine, funding catalog, awards,
-- reconciliation, decisions, enrollment packets
-- Idempotent: safe to re-run
-- =========================================

-- ---------------------------------------------------------------------------
-- School admissions settings (goals, marketing ROI inputs)
-- ---------------------------------------------------------------------------

create table if not exists public.school_admissions_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools(id) on delete cascade,
  enrollment_goal integer not null default 0 check (enrollment_goal >= 0),
  marketing_spend_annual numeric(12, 2) not null default 0 check (marketing_spend_annual >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists school_admissions_settings_set_updated_at on public.school_admissions_settings;
create trigger school_admissions_settings_set_updated_at
  before update on public.school_admissions_settings
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Admissions checklist template (per-school customizable)
-- ---------------------------------------------------------------------------

create table if not exists public.admissions_checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  item_key text not null,
  label text not null,
  description text,
  category text not null default 'general'
    check (category in ('general', 'documents', 'funding', 'enrollment', 'events')),
  is_required boolean not null default true,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admissions_checklist_template_items_school_key_unique
    unique (school_id, item_key)
);

create index if not exists idx_checklist_template_school
  on public.admissions_checklist_template_items(school_id);

drop trigger if exists admissions_checklist_template_items_set_updated_at
  on public.admissions_checklist_template_items;
create trigger admissions_checklist_template_items_set_updated_at
  before update on public.admissions_checklist_template_items
  for each row execute function public.trigger_set_updated_at();

-- Per-application checklist progress
create table if not exists public.admissions_application_checklist_items (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.admissions_applications(id) on delete cascade,
  item_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'waived', 'not_applicable')),
  completed_at timestamptz,
  completed_by uuid references public.users(id) on delete set null,
  notes text,
  document_id uuid references public.application_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admissions_application_checklist_items_unique
    unique (application_id, item_key)
);

create index if not exists idx_application_checklist_application
  on public.admissions_application_checklist_items(application_id);

drop trigger if exists admissions_application_checklist_items_set_updated_at
  on public.admissions_application_checklist_items;
create trigger admissions_application_checklist_items_set_updated_at
  before update on public.admissions_application_checklist_items
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Funding program catalog
-- ---------------------------------------------------------------------------

create table if not exists public.funding_program_catalog (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  program_code text not null,
  program_name text not null,
  state_code text not null,
  funding_agency text not null,
  maximum_award numeric(12, 2) check (maximum_award is null or maximum_award >= 0),
  payment_schedule text not null default 'monthly'
    check (payment_schedule in ('annual', 'semester', 'quarterly', 'monthly', 'lump_sum')),
  renewal_rules text,
  required_documents jsonb not null default '[]'::jsonb,
  export_format text not null default 'csv',
  website text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funding_program_catalog_code_unique unique (program_code)
);

create index if not exists idx_funding_program_catalog_school
  on public.funding_program_catalog(school_id);

create index if not exists idx_funding_program_catalog_state
  on public.funding_program_catalog(state_code);

drop trigger if exists funding_program_catalog_set_updated_at on public.funding_program_catalog;
create trigger funding_program_catalog_set_updated_at
  before update on public.funding_program_catalog
  for each row execute function public.trigger_set_updated_at();

-- Extend state funding verifications into full award records
alter table public.state_funding_verifications
  add column if not exists funding_program_id uuid
    references public.funding_program_catalog(id) on delete set null;

alter table public.state_funding_verifications
  add column if not exists state_code text;

alter table public.state_funding_verifications
  add column if not exists award_amount numeric(12, 2)
    check (award_amount is null or award_amount >= 0);

alter table public.state_funding_verifications
  add column if not exists award_id text;

alter table public.state_funding_verifications
  add column if not exists state_student_id text;

alter table public.state_funding_verifications
  add column if not exists award_year text;

alter table public.state_funding_verifications
  add column if not exists renewal_date date;

alter table public.state_funding_verifications
  add column if not exists award_letter_document_id uuid
    references public.application_documents(id) on delete set null;

alter table public.state_funding_verifications
  add column if not exists lead_id uuid
    references public.admissions_leads(id) on delete cascade;

alter table public.state_funding_verifications
  add column if not exists student_id uuid
    references public.students(id) on delete set null;

-- Backfill lead_id from applications
update public.state_funding_verifications sfv
set lead_id = aa.lead_id
from public.admissions_applications aa
where aa.id = sfv.application_id
  and sfv.lead_id is null;

-- ---------------------------------------------------------------------------
-- Funding reconciliation
-- ---------------------------------------------------------------------------

create table if not exists public.state_funding_expected_payments (
  id uuid primary key default gen_random_uuid(),
  state_funding_verification_id uuid not null
    references public.state_funding_verifications(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  expected_amount numeric(12, 2) not null check (expected_amount >= 0),
  expected_date date not null,
  award_year text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_state_funding_expected_verification
  on public.state_funding_expected_payments(state_funding_verification_id);

drop trigger if exists state_funding_expected_payments_set_updated_at
  on public.state_funding_expected_payments;
create trigger state_funding_expected_payments_set_updated_at
  before update on public.state_funding_expected_payments
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.state_funding_received_payments (
  id uuid primary key default gen_random_uuid(),
  state_funding_verification_id uuid not null
    references public.state_funding_verifications(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_date date not null,
  reference_number text,
  notes text,
  recorded_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_state_funding_received_verification
  on public.state_funding_received_payments(state_funding_verification_id);

drop trigger if exists state_funding_received_payments_set_updated_at
  on public.state_funding_received_payments;
create trigger state_funding_received_payments_set_updated_at
  before update on public.state_funding_received_payments
  for each row execute function public.trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Admissions decisions & communications audit
-- ---------------------------------------------------------------------------

create table if not exists public.admissions_decisions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.admissions_leads(id) on delete cascade,
  application_id uuid references public.admissions_applications(id) on delete set null,
  decision_type text not null
    check (decision_type in ('accept', 'waitlist', 'deny', 'request_info')),
  decision_notes text,
  email_subject text,
  email_body text,
  email_sent_at timestamptz,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_admissions_decisions_lead
  on public.admissions_decisions(lead_id);

create table if not exists public.admissions_communications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.admissions_leads(id) on delete cascade,
  application_id uuid references public.admissions_applications(id) on delete set null,
  communication_type text not null default 'email',
  subject text not null,
  body text not null,
  sent_to text not null,
  sent_by uuid references public.users(id) on delete set null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_admissions_communications_lead
  on public.admissions_communications(lead_id);

-- ---------------------------------------------------------------------------
-- Enrollment packet generator
-- ---------------------------------------------------------------------------

create table if not exists public.enrollment_packet_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  template_key text not null,
  title text not null,
  body_html text not null,
  requires_signature boolean not null default true,
  state_code text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollment_packet_templates_school_key_unique
    unique (school_id, template_key)
);

drop trigger if exists enrollment_packet_templates_set_updated_at on public.enrollment_packet_templates;
create trigger enrollment_packet_templates_set_updated_at
  before update on public.enrollment_packet_templates
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.enrollment_packets (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.admissions_applications(id) on delete cascade,
  lead_id uuid not null references public.admissions_leads(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  packet_status text not null default 'draft'
    check (packet_status in ('draft', 'sent', 'partially_signed', 'completed')),
  generated_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_enrollment_packets_application
  on public.enrollment_packets(application_id);

drop trigger if exists enrollment_packets_set_updated_at on public.enrollment_packets;
create trigger enrollment_packets_set_updated_at
  before update on public.enrollment_packets
  for each row execute function public.trigger_set_updated_at();

create table if not exists public.enrollment_packet_signatures (
  id uuid primary key default gen_random_uuid(),
  enrollment_packet_id uuid not null
    references public.enrollment_packets(id) on delete cascade,
  template_key text not null,
  signer_name text not null,
  signer_email text not null,
  signature_text text not null,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint enrollment_packet_signatures_unique
    unique (enrollment_packet_id, template_key, signer_email)
);

create index if not exists idx_enrollment_packet_signatures_packet
  on public.enrollment_packet_signatures(enrollment_packet_id);

-- ---------------------------------------------------------------------------
-- Seed default checklist items for a school
-- ---------------------------------------------------------------------------

create or replace function public.seed_admissions_checklist_for_school(p_school_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admissions_checklist_template_items
    (school_id, item_key, label, category, is_required, sort_order)
  values
    (p_school_id, 'inquiry', 'Inquiry Submitted', 'general', true, 1),
    (p_school_id, 'tour', 'Campus Tour', 'events', true, 2),
    (p_school_id, 'interview', 'Student Interview', 'events', true, 3),
    (p_school_id, 'application', 'Application Completed', 'general', true, 4),
    (p_school_id, 'birth_certificate', 'Birth Certificate', 'documents', true, 5),
    (p_school_id, 'immunization', 'Immunization Record', 'documents', true, 6),
    (p_school_id, 'report_cards', 'Previous Report Cards', 'documents', true, 7),
    (p_school_id, 'iep', 'IEP Documentation', 'documents', false, 8),
    (p_school_id, 'psychological_evaluation', 'Psychological Evaluation', 'documents', false, 9),
    (p_school_id, 'medical_forms', 'Medical Forms', 'documents', true, 10),
    (p_school_id, 'state_scholarship_award_letter', 'State Scholarship Award Letter', 'funding', false, 11),
    (p_school_id, 'financial_aid_documents', 'Financial Aid Documents', 'funding', false, 12),
    (p_school_id, 'parent_agreements', 'Parent Agreements', 'enrollment', true, 13),
    (p_school_id, 'enrollment_packet', 'Enrollment Packet Signed', 'enrollment', true, 14)
  on conflict (school_id, item_key) do update set
    label = excluded.label,
    category = excluded.category,
    is_required = excluded.is_required,
    sort_order = excluded.sort_order;
end;
$$;

-- Initialize checklist for all schools
do $$
declare
  r record;
begin
  for r in select id from public.schools loop
    perform public.seed_admissions_checklist_for_school(r.id);
  end loop;
end $$;

-- Sync application checklist from school template
create or replace function public.sync_application_checklist(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  select al.school_id into v_school_id
  from public.admissions_applications aa
  join public.admissions_leads al on al.id = aa.lead_id
  where aa.id = p_application_id;

  if v_school_id is null then
    raise exception 'Application not found';
  end if;

  perform public.seed_admissions_checklist_for_school(v_school_id);

  insert into public.admissions_application_checklist_items (application_id, item_key, status)
  select p_application_id, t.item_key, 'pending'
  from public.admissions_checklist_template_items t
  where t.school_id = v_school_id
    and t.is_active = true
  on conflict (application_id, item_key) do nothing;
end;
$$;

grant execute on function public.seed_admissions_checklist_for_school(uuid) to authenticated, service_role;
grant execute on function public.sync_application_checklist(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Duplicate detection RPC
-- ---------------------------------------------------------------------------

create or replace function public.detect_admission_duplicates(
  p_first_name text,
  p_last_name text,
  p_guardian_email text default null,
  p_guardian_phone text default null,
  p_date_of_birth date default null,
  p_exclude_lead_id uuid default null
)
returns table (
  match_type text,
  entity_type text,
  entity_id uuid,
  display_name text,
  detail text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    'student_name'::text,
    'admissions_lead'::text,
    al.id,
    (al.first_name || ' ' || al.last_name)::text,
    ('Lead stage: ' || al.lead_stage)::text
  from public.admissions_leads al
  where (p_exclude_lead_id is null or al.id <> p_exclude_lead_id)
    and lower(al.first_name) = lower(trim(p_first_name))
    and lower(al.last_name) = lower(trim(p_last_name))
    and (
      p_date_of_birth is null
      or al.date_of_birth = p_date_of_birth
    );

  return query
  select
    'guardian_email'::text,
    'admissions_lead'::text,
    al.id,
    (coalesce(al.guardian_first_name, '') || ' ' || coalesce(al.guardian_last_name, ''))::text,
    ('Student: ' || al.first_name || ' ' || al.last_name)::text
  from public.admissions_leads al
  where (p_exclude_lead_id is null or al.id <> p_exclude_lead_id)
    and p_guardian_email is not null
    and trim(p_guardian_email) <> ''
    and al.guardian_email is not null
    and lower(al.guardian_email) = lower(trim(p_guardian_email));

  return query
  select
    'guardian_phone'::text,
    'admissions_lead'::text,
    al.id,
    (al.first_name || ' ' || al.last_name)::text,
    ('Phone match on lead')::text
  from public.admissions_leads al
  where (p_exclude_lead_id is null or al.id <> p_exclude_lead_id)
    and p_guardian_phone is not null
    and trim(p_guardian_phone) <> ''
    and al.guardian_phone is not null
    and regexp_replace(al.guardian_phone, '[^0-9]', '', 'g')
      = regexp_replace(p_guardian_phone, '[^0-9]', '', 'g');

  return query
  select
    'student_dob'::text,
    'student'::text,
    s.id,
    (s.first_name || ' ' || s.last_name)::text,
    ('Active student record')::text
  from public.students s
  where p_date_of_birth is not null
    and s.date_of_birth = p_date_of_birth
    and lower(s.first_name) = lower(trim(p_first_name))
    and lower(s.last_name) = lower(trim(p_last_name));

  return query
  select
    'guardian_email'::text,
    'guardian'::text,
    g.id,
    (g.first_name || ' ' || g.last_name)::text,
    ('Existing guardian profile')::text
  from public.guardians g
  where p_guardian_email is not null
    and trim(p_guardian_email) <> ''
    and g.email is not null
    and lower(g.email) = lower(trim(p_guardian_email));
end;
$$;

grant execute on function public.detect_admission_duplicates(text, text, text, text, date, uuid)
  to authenticated, service_role;

-- Seed org-wide funding program catalog (Florida/Georgia examples)
insert into public.funding_program_catalog (
  program_code, program_name, state_code, funding_agency,
  maximum_award, payment_schedule, renewal_rules, required_documents, website, is_active
) values
  (
    'fl_esa',
    'Florida ESA (Family Empowerment Scholarship)',
    'FL',
    'Florida Department of Education',
    8000,
    'quarterly',
    'Annual renewal with award letter and enrollment verification',
    '["esa_award_letter","state_enrollment_form","proof_of_residency"]'::jsonb,
    'https://www.fldoe.org/schools/school-choice/',
    true
  ),
  (
    'fl_step_up',
    'Step Up For Students',
    'FL',
    'Step Up For Students',
    7500,
    'quarterly',
    'Renew prior to award year expiration',
    '["esa_award_letter","state_enrollment_form"]'::jsonb,
    'https://www.stepupforstudents.org',
    true
  ),
  (
    'ga_esa',
    'Georgia Special Needs Scholarship',
    'GA',
    'Georgia Department of Education',
    6500,
    'semester',
    'Annual application window',
    '["esa_award_letter","state_enrollment_form","proof_of_residency"]'::jsonb,
    'https://www.gadoe.org/',
    true
  )
on conflict (program_code) do update set
  program_name = excluded.program_name,
  state_code = excluded.state_code,
  funding_agency = excluded.funding_agency,
  maximum_award = excluded.maximum_award,
  payment_schedule = excluded.payment_schedule,
  renewal_rules = excluded.renewal_rules,
  required_documents = excluded.required_documents,
  website = excluded.website,
  is_active = excluded.is_active;

-- Seed default enrollment packet templates per school
do $$
declare
  r record;
begin
  for r in select id from public.schools loop
    insert into public.enrollment_packet_templates
      (school_id, template_key, title, body_html, requires_signature, sort_order)
    values
      (r.id, 'enrollment_agreement', 'Enrollment Agreement',
       '<p>I agree to enroll my student under the terms of the AcademyOS enrollment agreement.</p>', true, 1),
      (r.id, 'tuition_agreement', 'Tuition Agreement',
       '<p>I agree to the tuition and payment schedule outlined by the school.</p>', true, 2),
      (r.id, 'parent_handbook', 'Parent Handbook Acknowledgement',
       '<p>I have received and agree to the Parent Handbook policies.</p>', true, 3),
      (r.id, 'technology_agreement', 'Technology Agreement',
       '<p>I agree to acceptable technology use policies for my student.</p>', true, 4),
      (r.id, 'media_release', 'Media Release',
       '<p>I grant permission for school-related media use as described.</p>', false, 5),
      (r.id, 'ferpa', 'FERPA Forms',
       '<p>I acknowledge FERPA rights and consent as applicable.</p>', true, 6)
    on conflict (school_id, template_key) do nothing;
  end loop;
end $$;

-- Initialize admissions settings per school
insert into public.school_admissions_settings (school_id, enrollment_goal, marketing_spend_annual)
select s.id, 50, 25000
from public.schools s
on conflict (school_id) do nothing;

notify pgrst, 'reload schema';
