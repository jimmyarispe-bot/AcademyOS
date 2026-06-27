-- =========================================
-- ADMISSIONS stage_entered_at trigger + schema reload (062)
-- Keeps stage_entered_at in sync when lead_stage changes so the
-- app never needs to POST the column through PostgREST.
-- Idempotent: safe to re-run
-- =========================================

create or replace function public.set_admissions_lead_stage_entered_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.stage_entered_at is null then
      new.stage_entered_at := coalesce(new.created_at, now());
    end if;
  elsif tg_op = 'UPDATE' and old.lead_stage is distinct from new.lead_stage then
    new.stage_entered_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_admissions_leads_stage_entered_at on public.admissions_leads;

create trigger trg_admissions_leads_stage_entered_at
  before insert or update on public.admissions_leads
  for each row
  execute function public.set_admissions_lead_stage_entered_at();

-- 061 added stage_entered_at but did not reload PostgREST; reads/writes fail until cache refreshes.
notify pgrst, 'reload schema';
