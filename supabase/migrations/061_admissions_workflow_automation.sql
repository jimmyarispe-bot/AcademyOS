-- =========================================
-- ADMISSIONS WORKFLOW AUTOMATION
-- stage_entered_at, stage history, backfill
-- Idempotent: safe to re-run
-- =========================================

-- Track when the lead entered its current stage
alter table public.admissions_leads
  add column if not exists stage_entered_at timestamptz not null default now();

update public.admissions_leads
set stage_entered_at = coalesce(created_at, now())
where stage_entered_at is null
   or stage_entered_at = created_at;

-- Stage change audit trail
create table if not exists public.admissions_lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.admissions_leads(id) on delete cascade,
  previous_stage text,
  new_stage text not null,
  changed_by uuid references public.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_lead_stage_history_lead_id
  on public.admissions_lead_stage_history(lead_id);

create index if not exists idx_lead_stage_history_changed_at
  on public.admissions_lead_stage_history(changed_at desc);

-- Backfill initial stage entry for existing leads without history
insert into public.admissions_lead_stage_history (lead_id, previous_stage, new_stage, changed_at)
select al.id, null, al.lead_stage, coalesce(al.created_at, now())
from public.admissions_leads al
where not exists (
  select 1
  from public.admissions_lead_stage_history h
  where h.lead_id = al.id
);

-- RLS
alter table public.admissions_lead_stage_history enable row level security;

drop policy if exists admissions_lead_stage_history_staff_all on public.admissions_lead_stage_history;

create policy admissions_lead_stage_history_staff_all
on public.admissions_lead_stage_history
for all
using (can_access_school(school_id_for_admission_lead(lead_id)))
with check (can_access_school(school_id_for_admission_lead(lead_id)));

drop policy if exists admissions_lead_stage_history_guardian_select on public.admissions_lead_stage_history;

create policy admissions_lead_stage_history_guardian_select
on public.admissions_lead_stage_history
for select
using (is_guardian_of_lead(lead_id));
