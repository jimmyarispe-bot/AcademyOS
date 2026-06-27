-- =========================================

-- PHASE 1: ADMISSIONS CRM

-- Rename prospects → admissions_leads, tours, extended stages

-- Idempotent: safe if rename steps already applied

-- =========================================



-- Rename core lead table

do $$

begin

  if to_regclass('public.prospects') is not null

     and to_regclass('public.admissions_leads') is null

  then

    alter table public.prospects rename to admissions_leads;

  end if;

end $$;



do $$

begin

  if exists (

    select 1

    from information_schema.columns

    where table_schema = 'public'

      and table_name = 'admissions_leads'

      and column_name = 'status'

  ) then

    alter table public.admissions_leads rename column status to lead_stage;

  end if;

end $$;



-- Drop legacy check before migrating stage values (old constraint rejects Phase 1 stages)

alter table public.admissions_leads drop constraint if exists prospects_status_check;

alter table public.admissions_leads drop constraint if exists admissions_leads_lead_stage_check;



-- Migrate legacy stage values to Phase 1 stages

update public.admissions_leads set lead_stage = 'new_inquiry' where lead_stage = 'inquiry';

update public.admissions_leads set lead_stage = 'declined' where lead_stage = 'withdrawn';



do $$

begin

  if not exists (

    select 1

    from pg_constraint

    where conname = 'admissions_leads_lead_stage_check'

      and conrelid = 'public.admissions_leads'::regclass

  ) then

    alter table public.admissions_leads

      add constraint admissions_leads_lead_stage_check

      check (

        lead_stage in (

          'new_inquiry',

          'information_sent',

          'tour_scheduled',

          'tour_completed',

          'application_started',

          'application_submitted',

          'records_requested',

          'admissions_review',

          'accepted',

          'waitlisted',

          'declined',

          'enrolled'

        )

      );

  end if;

end $$;



alter table public.admissions_leads

  alter column lead_stage set default 'new_inquiry';



-- Program and funding source

alter table public.admissions_leads

  add column if not exists program text

    check (

      program is null

      or program in (

        'academy_fl_campus',

        'academy_fl_virtual',

        'academy_ga_campus',

        'academy_ga_hybrid',

        'academy_hs',

        'academy_virtual'

      )

    );



alter table public.admissions_leads

  add column if not exists funding_source text

    check (

      funding_source is null

      or funding_source in (

        'private_pay',

        'esa',

        'voucher',

        'tax_credit_scholarship',

        'school_scholarship'

      )

    );



alter table public.admissions_leads

  add column if not exists guardian_email text;



alter table public.admissions_leads

  add column if not exists guardian_phone text;



alter table public.admissions_leads

  add column if not exists guardian_first_name text;



alter table public.admissions_leads

  add column if not exists guardian_last_name text;



alter table public.admissions_leads

  add column if not exists assigned_to_user_id uuid

    references public.users(id) on delete set null;



create index if not exists idx_admissions_leads_program

  on public.admissions_leads(program);



create index if not exists idx_admissions_leads_funding_source

  on public.admissions_leads(funding_source);



create index if not exists idx_admissions_leads_lead_stage

  on public.admissions_leads(lead_stage);



create index if not exists idx_admissions_leads_assigned_to

  on public.admissions_leads(assigned_to_user_id);



-- Rename indexes from prospects era

alter index if exists idx_prospects_school_id rename to idx_admissions_leads_school_id;

alter index if exists idx_prospects_status rename to idx_admissions_leads_lead_stage_legacy;

alter index if exists idx_prospects_inquiry_date rename to idx_admissions_leads_inquiry_date;



-- Rename guardian table

do $$

begin

  if to_regclass('public.prospect_guardians') is not null

     and to_regclass('public.admissions_lead_guardians') is null

  then

    alter table public.prospect_guardians rename to admissions_lead_guardians;

  end if;

end $$;



do $$

begin

  if exists (

    select 1

    from information_schema.columns

    where table_schema = 'public'

      and table_name = 'admissions_lead_guardians'

      and column_name = 'prospect_id'

  ) then

    alter table public.admissions_lead_guardians rename column prospect_id to lead_id;

  end if;

end $$;



alter index if exists idx_prospect_guardians_prospect_id

  rename to idx_admissions_lead_guardians_lead_id;

alter index if exists idx_prospect_guardians_email

  rename to idx_admissions_lead_guardians_email;



-- Update FK references on notes, tasks, applications

do $$

begin

  if exists (

    select 1

    from information_schema.columns

    where table_schema = 'public'

      and table_name = 'admissions_notes'

      and column_name = 'prospect_id'

  ) then

    alter table public.admissions_notes rename column prospect_id to lead_id;

  end if;

end $$;



do $$

begin

  if exists (

    select 1

    from information_schema.columns

    where table_schema = 'public'

      and table_name = 'admissions_tasks'

      and column_name = 'prospect_id'

  ) then

    alter table public.admissions_tasks rename column prospect_id to lead_id;

  end if;

end $$;



do $$

begin

  if exists (

    select 1

    from information_schema.columns

    where table_schema = 'public'

      and table_name = 'admissions_applications'

      and column_name = 'prospect_id'

  ) then

    alter table public.admissions_applications rename column prospect_id to lead_id;

  end if;

end $$;



alter index if exists idx_admissions_notes_prospect_id

  rename to idx_admissions_notes_lead_id;

alter index if exists idx_admissions_tasks_prospect_id

  rename to idx_admissions_tasks_lead_id;

alter index if exists idx_admissions_applications_prospect_id

  rename to idx_admissions_applications_lead_id;



-- -----------------------------------------

-- ADMISSIONS TOURS

-- -----------------------------------------



create table if not exists public.admissions_tours (

  id uuid primary key default gen_random_uuid(),



  lead_id uuid not null

    references public.admissions_leads(id) on delete cascade,



  scheduled_at timestamptz not null,

  duration_minutes smallint not null default 60

    check (duration_minutes > 0),



  tour_type text not null default 'in_person'

    check (tour_type in ('in_person', 'virtual')),



  tour_status text not null default 'scheduled'

    check (

      tour_status in (

        'scheduled',

        'completed',

        'cancelled',

        'no_show'

      )

    ),



  campus_id uuid

    references public.campuses(id) on delete set null,



  host_user_id uuid

    references public.users(id) on delete set null,



  notes text,

  completed_at timestamptz,



  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()

);



create index if not exists idx_admissions_tours_lead_id

  on public.admissions_tours(lead_id);



create index if not exists idx_admissions_tours_scheduled_at

  on public.admissions_tours(scheduled_at);



create index if not exists idx_admissions_tours_tour_status

  on public.admissions_tours(tour_status);



drop trigger if exists admissions_tours_set_updated_at on public.admissions_tours;



create trigger admissions_tours_set_updated_at

  before update on public.admissions_tours

  for each row

  execute function public.trigger_set_updated_at();



-- Update helper functions

create or replace function public.school_id_for_admission_lead(p_lead_id uuid)

returns uuid

language sql

stable

security invoker

set search_path = public

as $$

  select school_id

  from public.admissions_leads

  where id = p_lead_id;

$$;



create or replace function public.school_id_for_prospect(p_prospect_id uuid)

returns uuid

language sql

stable

security invoker

set search_path = public

as $$

  select school_id

  from public.admissions_leads

  where id = p_prospect_id;

$$;



create or replace function public.is_guardian_of_lead(p_lead_id uuid)

returns boolean

language sql

stable

security invoker

set search_path = public

as $$

  select exists (

    select 1

    from public.admissions_lead_guardians lg

    join public.users u on u.id = auth.uid()

    where lg.lead_id = p_lead_id

      and lg.email is not null

      and lower(lg.email) = lower(u.email)

  );

$$;



create or replace function public.is_guardian_of_prospect(p_prospect_id uuid)

returns boolean

language sql

stable

security invoker

set search_path = public

as $$

  select public.is_guardian_of_lead(p_prospect_id);

$$;



create or replace function public.school_id_for_admissions_application(p_application_id uuid)

returns uuid

language sql

stable

security invoker

set search_path = public

as $$

  select al.school_id

  from public.admissions_applications aa

  join public.admissions_leads al on al.id = aa.lead_id

  where aa.id = p_application_id;

$$;


